import React from "react";
import fs from "fs";
import path from "path";
import { observable, computed, makeObservable } from "mobx";
import { keepAliveComputed } from "project-editor/core/keep-alive";

import { isValid, strToColor16 } from "eez-studio-shared/color";

import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    IEezObject,
    EezObject,
    InheritedValue,
    PropertyType,
    getProperty,
    MessageType,
    PropertyProps,
    getParent,
    IMessage,
    getKey,
    setParent
} from "project-editor/core/object";
import { makeTagsProperty } from "project-editor/core/tags";
import {
    getChildOfObject,
    isAnyPropertyModified,
    Message,
    propertyInvalidValueMessage,
    propertyNotFoundMessage,
    updateObject,
    propertyNotSetMessage,
    createObject,
    isEezObjectArray,
    getClassInfo,
    type ProjectStore
} from "project-editor/store";
import {
    getSerializationFilePath,
    getSerializationOrStoreProject
} from "project-editor/store/serialization";
import {
    isDashboardProject,
    isEezGuiProject,
    isNotDashboardProject,
    isV1Project,
    isV3OrNewerProject
} from "project-editor/project/project-type-traits";
import { getProjectStore } from "project-editor/store";
import { validators } from "eez-studio-shared/validation";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    getAllProjectsWithThemes,
    getThemedColor,
    ITheme
} from "project-editor/features/style/theme";
import type { Font } from "project-editor/features/font/font";
import {
    Project,
    findFont,
    findStyle,
    findBitmap
} from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { MenuItem } from "@electron/remote";
import type { ProjectEditorFeature } from "project-editor/store/features";
import {
    makeExpressionProperty,
    type Widget
} from "project-editor/flow/component";
import { checkExpression } from "project-editor/flow/expression";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { PageLayout } from "project-editor/features/page/page";
import { ColorFormat } from "./color-format";

////////////////////////////////////////////////////////////////////////////////

const propertyMenu = (props: PropertyProps): Electron.MenuItem[] => {
    let menuItems: Electron.MenuItem[] = [];

    if (isDashboardProject(props.objects[0])) {
        const cssAttributeName = props.propertyInfo.cssAttributeName;
        if (cssAttributeName) {
            menuItems.push(
                new MenuItem({
                    label: "Help",
                    click: () => {
                        openCssHelpPage(cssAttributeName);
                    }
                })
            );
        }
    }

    return menuItems;
};

const backgroundColorPropertyMenu = (
    props: PropertyProps
): Electron.MenuItem[] => {
    let menuItems: Electron.MenuItem[] = [];

    menuItems.push(
        new MenuItem({
            label: "Transparent",
            click: () => {
                props.objects.forEach(object =>
                    updateObject(object, {
                        [props.propertyInfo.name]: "transparent"
                    })
                );
            }
        })
    );

    if (isDashboardProject(props.objects[0])) {
        menuItems.push(
            new MenuItem({
                label: "Help",
                click: () => {
                    openCssHelpPage("background-color");
                }
            })
        );
    }

    return menuItems;
};

////////////////////////////////////////////////////////////////////////////////

const conditionalStyleConditionProperty = makeExpressionProperty(
    {
        name: "condition",
        type: PropertyType.MultilineText
    },
    "boolean"
);

export class ConditionalStyle extends EezObject {
    style: string;
    condition: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "allStyles"
            },
            conditionalStyleConditionProperty
        ],
        check: (
            conditionalStyleItem: ConditionalStyle,
            messages: IMessage[]
        ) => {
            if (
                conditionalStyleItem.style &&
                !findStyle(
                    ProjectEditor.getProject(conditionalStyleItem),
                    conditionalStyleItem.style
                )
            ) {
                messages.push(
                    propertyNotFoundMessage(conditionalStyleItem, "style")
                );
            }

            try {
                checkExpression(
                    ProjectEditor.getWidget(conditionalStyleItem)!,
                    conditionalStyleItem.condition
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid condition: ${err}`,
                        getChildOfObject(conditionalStyleItem, "condition")
                    )
                );
            }
        },
        defaultValue: {},
        listLabel: (conditionalStyleItem: ConditionalStyle, collapsed) =>
            !collapsed ? (
                ""
            ) : (
                <>
                    {conditionalStyleItem.style}:
                    {conditionalStyleItem.condition}
                </>
            )
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            style: observable,
            condition: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

const idProperty: PropertyInfo = {
    name: "id",
    type: PropertyType.Number,
    isOptional: true,
    unique: true,
    inheritable: false,
    disabled: style =>
        isWidgetParentOfStyle(style) || isDashboardProject(style),
    defaultValue: undefined
};

function styleNameUnique(
    parent: IEezObject,
    oldIdentifier: string | undefined
) {
    return (object: any, ruleName: string) => {
        const newIdentifer = object[ruleName];
        if (oldIdentifier != undefined && newIdentifer == oldIdentifier) {
            return null;
        }

        if (
            findStyle(ProjectEditor.getProject(parent), newIdentifer) ==
            undefined
        ) {
            return null;
        }

        return "Not an unique name";
    };
}

const nameProperty: PropertyInfo = {
    name: "name",
    type: PropertyType.String,
    unique: (
        style: Style,
        parent: Style | Project,
        propertyInfo?: PropertyInfo
    ) => {
        const oldIdentifier = propertyInfo
            ? getProperty(style, propertyInfo.name)
            : undefined;

        return styleNameUnique(parent, oldIdentifier);
    },
    disabled: isWidgetParentOfStyle
};

const descriptionProperty: PropertyInfo = {
    name: "description",
    type: PropertyType.MultilineText,
    disabled: isWidgetParentOfStyle
};

// In EEZ-GUI v3 projects the project styles are complete and don't inherit:
// only a widget style and a state style (its base style) use another style.
const useStyleProperty: PropertyInfo = {
    name: "useStyle",
    displayName: (style: Style) => (style.state ? "Base style" : "Use style"),
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "allStyles",
    disabled: (style: Style) =>
        !isNotEezGuiV3Style(style) &&
        !isWidgetParentOfStyle(style) &&
        !style.state,
    propertyMenu: (props: PropertyProps): Electron.MenuItem[] => {
        const projectStore = getProjectStore(props.objects[0]);

        let menuItems: Electron.MenuItem[] = [];

        if (isAnyPropertyModified(props)) {
            menuItems.push(
                new MenuItem({
                    label: "Reset All Modifications",
                    click: () => {
                        const propertyValues: any = {};
                        properties.forEach(propertyInfo => {
                            if (propertyInfo.inheritable) {
                                propertyValues[propertyInfo.name] = undefined;
                            }
                        });
                        props.updateObject(propertyValues);
                    }
                })
            );

            if (props.objects.length === 1) {
                const object = props.objects[0] as Style;

                menuItems.push(
                    new MenuItem({
                        label: "Create New Style",
                        click: () => {
                            return showGenericDialog({
                                dialogDefinition: {
                                    title: "New Style",
                                    fields: [
                                        {
                                            name: "name",
                                            type: "string",
                                            validators: [
                                                validators.required,
                                                validators.unique(
                                                    {},
                                                    projectStore.project
                                                        .allStyles
                                                )
                                            ]
                                        }
                                    ]
                                },
                                values: {}
                            }).then(result => {
                                projectStore.undoManager.setCombineCommands(
                                    true
                                );

                                const stylePropertyValues: any = {};
                                const objectPropertyValues: any = {};

                                // in EEZ-GUI v3 projects the new style is
                                // complete (all the values the style has)
                                const isComplete = !isNotEezGuiV3Style(object);

                                properties.forEach(propertyInfo => {
                                    stylePropertyValues[propertyInfo.name] =
                                        isComplete && propertyInfo.inheritable
                                            ? getStyleProperty(
                                                  object,
                                                  propertyInfo.name,
                                                  false
                                              )
                                            : isComplete &&
                                                propertyInfo == useStyleProperty
                                              ? undefined
                                              : getProperty(
                                                    object,
                                                    propertyInfo.name
                                                );

                                    objectPropertyValues[propertyInfo.name] =
                                        undefined;
                                });

                                stylePropertyValues.name = result.values.name;

                                objectPropertyValues.useStyle =
                                    result.values.name;

                                projectStore.addObject(
                                    projectStore.project.styles,
                                    createObject<Style>(
                                        projectStore,
                                        stylePropertyValues,
                                        Style
                                    )
                                );
                                projectStore.updateObject(
                                    object,
                                    objectPropertyValues
                                );

                                projectStore.undoManager.setCombineCommands(
                                    false
                                );
                            });
                        }
                    })
                );

                const style = (props.objects[0] as Style).parentStyle;
                if (style) {
                    menuItems.push(
                        new MenuItem({
                            label: "Update Style",
                            click: () => {
                                projectStore.undoManager.setCombineCommands(
                                    true
                                );

                                const stylePropertyValues: any = {};
                                const objectPropertyValues: any = {};
                                properties.forEach(propertyInfo => {
                                    if (
                                        propertyInfo.inheritable &&
                                        getProperty(
                                            object,
                                            propertyInfo.name
                                        ) !== undefined
                                    ) {
                                        stylePropertyValues[propertyInfo.name] =
                                            getProperty(
                                                object,
                                                propertyInfo.name
                                            );

                                        objectPropertyValues[
                                            propertyInfo.name
                                        ] = undefined;
                                    }
                                });

                                projectStore.updateObject(
                                    style,
                                    stylePropertyValues
                                );
                                projectStore.updateObject(
                                    object,
                                    objectPropertyValues
                                );

                                projectStore.undoManager.setCombineCommands(
                                    false
                                );
                            }
                        })
                    );
                }
            }
        }

        return menuItems;
    }
};

export const conditionalStylesProperty: PropertyInfo = {
    name: "conditionalStyles",
    type: PropertyType.Array,
    typeClass: ConditionalStyle,
    partOfNavigation: false,
    enumerable: false,
    defaultValue: [],
    disabled: (object: IEezObject, propertyInfo: PropertyInfo) => {
        if (isNotDashboardProject(object)) {
            return true;
        }
        if (!ProjectEditor.getComponent(object)) {
            return true;
        }
        return false;
    }
};

const fontProperty: PropertyInfo = {
    name: "font",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "fonts",
    defaultValue: undefined,
    inheritable: true,
    disabled: isDashboardProject
};

const fontFamilyProperty: PropertyInfo = {
    name: "fontFamily",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    disabled: isNotDashboardProject,
    cssAttributeName: "font-family",
    propertyMenu
};

const fontSizeProperty: PropertyInfo = {
    name: "fontSize",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    disabled: isNotDashboardProject,
    cssAttributeName: "font-size",
    propertyMenu
};

const fontWeightProperty: PropertyInfo = {
    name: "fontWeight",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "normal"
        },
        {
            id: "bold"
        },
        {
            id: "lighter"
        },
        {
            id: "bolder"
        },
        {
            id: "100"
        },
        {
            id: "200"
        },
        {
            id: "300"
        },
        {
            id: "400"
        },
        {
            id: "500"
        },
        {
            id: "600"
        },
        {
            id: "700"
        },
        {
            id: "800"
        },
        {
            id: "900"
        }
    ],
    defaultValue: undefined,
    inheritable: true,
    disabled: isNotDashboardProject,
    cssAttributeName: "font-weight",
    propertyMenu
};

const fontStyleProperty: PropertyInfo = {
    name: "fontStyle",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "normal"
        },
        {
            id: "italic"
        },
        {
            id: "oblique"
        }
    ],
    defaultValue: undefined,
    inheritable: true,
    disabled: isNotDashboardProject,
    cssAttributeName: "font-style",
    propertyMenu
};

const alignHorizontalProperty: PropertyInfo = {
    name: "alignHorizontal",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "center"
        },
        {
            id: "left"
        },
        {
            id: "right"
        }
    ],
    defaultValue: "center",
    inheritable: true
};

const alignVerticalProperty: PropertyInfo = {
    name: "alignVertical",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "center"
        },
        {
            id: "top"
        },
        {
            id: "bottom"
        }
    ],
    defaultValue: "center",
    inheritable: true
};

const directionProperty: PropertyInfo = {
    name: "direction",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "ltr"
        },
        {
            id: "rtl"
        },
        {
            id: "initial"
        },
        {
            id: "inherit"
        }
    ],
    defaultValue: undefined,
    inheritable: true,
    disabled: isNotDashboardProject,
    cssAttributeName: "direction",
    propertyMenu
};

const colorProperty: PropertyInfo = {
    name: "color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    cssAttributeName: "color",
    propertyMenu
};

const backgroundColorProperty: PropertyInfo = {
    name: "backgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    cssAttributeName: "background-color",
    propertyMenu: backgroundColorPropertyMenu
};

const backgroundImageProperty: PropertyInfo = {
    name: "backgroundImage",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "bitmaps",
    inheritable: true,
    propertyMenu
};

const activeColorProperty: PropertyInfo = {
    name: "activeColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    cssAttributeName: "color",
    propertyMenu,
    disabled: isNotOldStateColorStyle
};

const activeBackgroundColorProperty: PropertyInfo = {
    name: "activeBackgroundColor",
    displayName: "Active back. color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    disabled: isNotOldStateColorStyle,
    cssAttributeName: "background-color",
    propertyMenu: backgroundColorPropertyMenu
};

const focusColorProperty: PropertyInfo = {
    name: "focusColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    cssAttributeName: "color",
    propertyMenu,
    disabled: isNotOldStateColorStyle
};

const focusBackgroundColorProperty: PropertyInfo = {
    name: "focusBackgroundColor",
    displayName: "Focus back. color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    cssAttributeName: "background-color",
    propertyMenu: backgroundColorPropertyMenu,
    disabled: isNotOldStateColorStyle
};

const borderSizeProperty: PropertyInfo = {
    name: "borderSize",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true,
    cssAttributeName: "border-width",
    propertyMenu
};

const borderRadiusProperty: PropertyInfo = {
    name: "borderRadius",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true,
    cssAttributeName: "border-radius",
    propertyMenu
};

const borderColorProperty: PropertyInfo = {
    name: "borderColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    cssAttributeName: "border-color",
    propertyMenu
};

const borderStyleProperty: PropertyInfo = {
    name: "borderStyle",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "dotted"
        },
        {
            id: "dashed"
        },
        {
            id: "solid"
        },
        {
            id: "double"
        },
        {
            id: "groove"
        },
        {
            id: "ridge"
        },
        {
            id: "inset"
        },
        {
            id: "outset"
        },
        {
            id: "none"
        },
        {
            id: "hidden"
        }
    ],
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "border-style",
    propertyMenu,
    disabled: isNotDashboardProject
};

const paddingProperty: PropertyInfo = {
    name: "padding",
    type: PropertyType.String,
    defaultValue: "0",
    cssAttributeName: "padding",
    propertyMenu,
    inheritable: true
};

const marginProperty: PropertyInfo = {
    name: "margin",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true,
    disabled: isV3OrNewerProject
};

const opacityProperty: PropertyInfo = {
    name: "opacity",
    type: PropertyType.Number,
    defaultValue: "255",
    cssAttributeName: "opacity",
    propertyMenu,
    inheritable: true
};

const boxShadowProperty: PropertyInfo = {
    name: "boxShadow",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "box-shadow",
    propertyMenu,
    disabled: isNotDashboardProject
};

const blinkProperty: PropertyInfo = {
    name: "blink",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: true,
    checkboxStyleSwitch: true
};

// The properties of the styles of the EEZ-GUI v3 projects (eez-framework),
// hidden in LVGL and dashboard projects.
function isNotEezGuiV3Style(object: IEezObject) {
    return !isEezGuiProject(object) || !isV3OrNewerProject(object);
}

// The active and focus colors are in the EEZ-GUI v2 and dashboard projects
// (the EEZ-GUI v3 projects have the pressed and focused state styles, an
// EEZ-GUI v1 project has no active and focus colors).
function isNotOldStateColorStyle(object: IEezObject) {
    return isV1Project(object) || !isNotEezGuiV3Style(object);
}

// the states of a widget with their own style, in the order of
// Style::stateStyles in the framework (StyleState)
export const STYLE_STATES = [
    "pressed",
    "focused",
    "disabled",
    "selected",
    "checked"
] as const;

export type StyleStateName = (typeof STYLE_STATES)[number];

// A state style is a project style with a state that uses its base style
// ("useStyle"): it holds the properties the base style has in that state. The
// widgets drawn with the base style (also with some of its properties changed
// in the widget style) use them in that state, over their own style.
const stateProperty: PropertyInfo = {
    name: "state",
    type: PropertyType.Enum,
    enumItems: STYLE_STATES.map(id => ({ id })),
    nonInheritable: true,
    disabled: (style: Style) =>
        isNotEezGuiV3Style(style) || isWidgetParentOfStyle(style)
};

const letterSpacingProperty: PropertyInfo = {
    name: "letterSpacing",
    displayName: "Letter spacing",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const lineHeightProperty: PropertyInfo = {
    name: "lineHeight",
    displayName: "Line height",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const ellipsisProperty: PropertyInfo = {
    name: "ellipsis",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: true,
    checkboxStyleSwitch: true,
    disabled: isNotEezGuiV3Style
};

const focusRingWidthProperty: PropertyInfo = {
    name: "focusRingWidth",
    displayName: "Focus ring width",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const focusRingOffsetProperty: PropertyInfo = {
    name: "focusRingOffset",
    displayName: "Focus ring offset",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const focusRingColorProperty: PropertyInfo = {
    name: "focusRingColor",
    displayName: "Focus ring color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "transparent",
    inheritable: true,
    propertyMenu,
    disabled: isNotEezGuiV3Style
};

const shadowOffsetXProperty: PropertyInfo = {
    name: "shadowOffsetX",
    displayName: "Shadow offset X",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const shadowOffsetYProperty: PropertyInfo = {
    name: "shadowOffsetY",
    displayName: "Shadow offset Y",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const shadowBlurProperty: PropertyInfo = {
    name: "shadowBlur",
    displayName: "Shadow blur",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const shadowSpreadProperty: PropertyInfo = {
    name: "shadowSpread",
    displayName: "Shadow spread",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true,
    disabled: isNotEezGuiV3Style
};

const shadowColorProperty: PropertyInfo = {
    name: "shadowColor",
    displayName: "Shadow color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "transparent",
    inheritable: true,
    propertyMenu,
    disabled: isNotEezGuiV3Style
};

// the number properties of the EEZ-GUI v3 styles: name, label in the check
// messages and the range
const NUMBER_PROPERTY_RANGES: {
    name: string;
    label: string;
    min: number;
    max: number;
    integer: boolean;
}[] = [
    { name: "letterSpacing", label: "Letter spacing", min: -100, max: 100, integer: false },
    { name: "lineHeight", label: "Line height", min: 0, max: 1000, integer: true },
    { name: "focusRingWidth", label: "Focus ring width", min: 0, max: 255, integer: true },
    { name: "focusRingOffset", label: "Focus ring offset", min: 0, max: 255, integer: true },
    { name: "shadowOffsetX", label: "Shadow offset X", min: -128, max: 127, integer: true },
    { name: "shadowOffsetY", label: "Shadow offset Y", min: -128, max: 127, integer: true },
    { name: "shadowBlur", label: "Shadow blur", min: 0, max: 255, integer: true },
    { name: "shadowSpread", label: "Shadow spread", min: -128, max: 127, integer: true }
];

const cssProperty: PropertyInfo = {
    name: "css",
    displayName: "Additional CSS",
    type: PropertyType.CSS,
    cssAttributeName: "css",
    nonInheritable: true,
    propertyMenu,
    disabled: isNotDashboardProject
};

export const dynamicCssProperty = makeExpressionProperty(
    {
        name: "dynamicCSS",
        displayName: "Dynamic CSS",
        type: PropertyType.MultilineText,
        disabled: (object: IEezObject, propertyInfo: PropertyInfo) => {
            if (isNotDashboardProject(object)) {
                return true;
            }
            if (!ProjectEditor.getComponent(object)) {
                return true;
            }
            return false;
        }
    },
    "string"
);

const cssPreviewProperty: PropertyInfo = {
    name: "cssPreview",
    displayName: "CSS preview",
    type: PropertyType.CSS,
    disabled: isNotDashboardProject,
    readOnlyInPropertyGrid: true,
    computed: true
};

const alwaysBuildProperty: PropertyInfo = {
    name: "alwaysBuild",
    displayName: "Always add to the generated code",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: false,
    disabled: (style: Style) =>
        isWidgetParentOfStyle(style) || isDashboardProject(style)
};

const tagsProperty: PropertyInfo = {
    ...makeTagsProperty(),
    // widget style is not listed in the Project Explorer
    hideInPropertyGrid: isWidgetParentOfStyle
};

const properties = [
    idProperty,
    nameProperty,
    tagsProperty,
    descriptionProperty,
    stateProperty,
    useStyleProperty,
    conditionalStylesProperty,
    fontProperty,
    fontFamilyProperty,
    fontSizeProperty,
    fontWeightProperty,
    fontStyleProperty,
    alignHorizontalProperty,
    alignVerticalProperty,
    directionProperty,
    colorProperty,
    backgroundColorProperty,
    backgroundImageProperty,
    activeColorProperty,
    activeBackgroundColorProperty,
    focusColorProperty,
    focusBackgroundColorProperty,
    borderSizeProperty,
    borderRadiusProperty,
    borderColorProperty,
    borderStyleProperty,
    paddingProperty,
    marginProperty,
    opacityProperty,
    boxShadowProperty,
    blinkProperty,
    letterSpacingProperty,
    lineHeightProperty,
    ellipsisProperty,
    focusRingWidthProperty,
    focusRingOffsetProperty,
    focusRingColorProperty,
    shadowOffsetXProperty,
    shadowOffsetYProperty,
    shadowBlurProperty,
    shadowSpreadProperty,
    shadowColorProperty,
    cssProperty,
    dynamicCssProperty,
    cssPreviewProperty,
    alwaysBuildProperty
];

const propertiesMap: { [propertyName: string]: PropertyInfo } = {};
for (const property of properties) {
    propertiesMap[property.name] = property;
}

////////////////////////////////////////////////////////////////////////////////

let nextTransientId = 0;

export class Style extends EezObject {
    id: number | undefined;
    name: string;
    tags?: string;
    description?: string;
    useStyle?: string;
    state?: StyleStateName;
    conditionalStyles?: ConditionalStyle[];
    childStyles: Style[];
    alwaysBuild: boolean;

    font?: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    alignHorizontal?: string;
    alignVertical?: string;
    direction?: string;
    color?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    activeColor?: string;
    activeBackgroundColor?: string;
    focusColor?: string;
    focusBackgroundColor?: string;
    borderSize?: string;
    borderRadius?: string;
    borderColor?: string;
    borderStyle?: string;
    padding?: string;
    margin?: string;
    opacity: number;
    boxShadow?: string;
    blink?: boolean;
    letterSpacing?: number;
    lineHeight?: number;
    ellipsis?: boolean;
    focusRingWidth?: number;
    focusRingOffset?: number;
    focusRingColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    shadowSpread?: number;
    shadowColor?: string;

    css?: string;
    dynamicCSS?: string;

    _transientId: number;

    // a style of a state built from the state child styles (see StateStyle)
    isStateStyle = false;

    constructor() {
        super();

        this._transientId = nextTransientId++;

        makeObservable(this, {
            fontName: computed,
            fontObject: computed,
            fontFamilyProperty: computed,
            fontSizeProperty: computed,
            fontWeightProperty: computed,
            fontStyleProperty: computed,

            borderSizeProperty: keepAliveComputed(),

            borderSizeRect: keepAliveComputed(),

            borderRadiusProperty: keepAliveComputed(),

            borderRadiusSpec: keepAliveComputed(),

            alignHorizontalProperty: keepAliveComputed(),

            alignVerticalProperty: keepAliveComputed(),

            directionProperty: keepAliveComputed(),

            colorProperty: keepAliveComputed(),

            color16: keepAliveComputed(),

            backgroundColorProperty: keepAliveComputed(),

            backgroundColor16: keepAliveComputed(),

            backgroundImageProperty: keepAliveComputed(),

            activeColorProperty: keepAliveComputed(),

            activeColor16: keepAliveComputed(),

            activeBackgroundColorProperty: keepAliveComputed(),

            activeBackgroundColor16: keepAliveComputed(),

            focusColorProperty: keepAliveComputed(),

            focusColor16: keepAliveComputed(),

            focusBackgroundColorProperty: keepAliveComputed(),

            focusBackgroundColor16: keepAliveComputed(),

            borderColorProperty: keepAliveComputed(),

            borderColor16: keepAliveComputed(),

            borderStyleProperty: keepAliveComputed(),

            paddingProperty: keepAliveComputed(),

            paddingRect: keepAliveComputed(),

            marginProperty: keepAliveComputed(),

            marginRect: keepAliveComputed(),

            opacityProperty: keepAliveComputed(),

            boxShadowProperty: keepAliveComputed(),

            blinkProperty: keepAliveComputed(),

            letterSpacingProperty: keepAliveComputed(),
            lineHeightProperty: keepAliveComputed(),
            ellipsisProperty: keepAliveComputed(),
            focusRingWidthProperty: keepAliveComputed(),
            focusRingOffsetProperty: keepAliveComputed(),
            focusRingColorProperty: keepAliveComputed(),
            shadowOffsetXProperty: keepAliveComputed(),
            shadowOffsetYProperty: keepAliveComputed(),
            shadowBlurProperty: keepAliveComputed(),
            shadowSpreadProperty: keepAliveComputed(),
            shadowColorProperty: keepAliveComputed(),

            stateBaseStyle: keepAliveComputed(),
            stateDeltas: keepAliveComputed(),
            stateKey: keepAliveComputed(),

            cssDeclarations: computed,
            cssPreview: computed,
            classNames: computed,
            dynamicCSS: observable
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            id: observable,
            name: observable,
            tags: observable,
            description: observable,
            useStyle: observable,
            state: observable,
            conditionalStyles: observable,
            childStyles: observable,
            alwaysBuild: observable,
            font: observable,
            fontFamily: observable,
            fontSize: observable,
            fontWeight: observable,
            fontStyle: observable,
            alignHorizontal: observable,
            alignVertical: observable,
            direction: observable,
            color: observable,
            backgroundColor: observable,
            backgroundImage: observable,
            activeColor: observable,
            activeBackgroundColor: observable,
            focusColor: observable,
            focusBackgroundColor: observable,
            borderSize: observable,
            borderRadius: observable,
            borderColor: observable,
            borderStyle: observable,
            padding: observable,
            margin: observable,
            opacity: observable,
            boxShadow: observable,
            blink: observable,
            letterSpacing: observable,
            lineHeight: observable,
            ellipsis: observable,
            focusRingWidth: observable,
            focusRingOffset: observable,
            focusRingColor: observable,
            shadowOffsetX: observable,
            shadowOffsetY: observable,
            shadowBlur: observable,
            shadowSpread: observable,
            shadowColor: observable,
            css: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            ...properties,
            {
                name: "childStyles",
                type: PropertyType.Array,
                typeClass: Style,
                hideInPropertyGrid: true
            }
        ],
        // eez-gui-lite projects have their own style class
        // (eez-gui-lite/style.tsx)
        getClass: (projectStore: ProjectStore) =>
            getSerializationOrStoreProject(projectStore)?.projectTypeTraits
                .isEezGuiLite
                ? ProjectEditor.LiteStyleClass
                : Style,
        beforeLoadHook(object: Style, jsObject: any) {
            if (
                jsObject.paddingHorizontal !== undefined ||
                jsObject.paddingVertical !== undefined
            ) {
                const paddingHorizontal = jsObject.paddingHorizontal || 0;
                const paddingVertical = jsObject.paddingVertical || 0;

                delete jsObject.paddingHorizontal;
                delete jsObject.paddingVertical;

                if (paddingHorizontal !== paddingVertical) {
                    jsObject.padding =
                        paddingVertical + " " + paddingHorizontal;
                } else {
                    jsObject.padding = paddingHorizontal;
                }
            }

            if (typeof jsObject.borderRadius == "number") {
                jsObject.borderRadius = jsObject.borderRadius.toString();
            }

            if ((window as any).__eezProjectMigration) {
                const targetFont = __eezProjectMigration.fonts[jsObject.font];
                if (targetFont) {
                    jsObject.font = targetFont;
                }
            }
        },
        propertiesPanelLabel: (style: Style) => {
            return `Project style: ${style.name}`;
        },
        // no child styles in EEZ-GUI v3 projects
        findPastePlaceInside: (style: Style) =>
            isNotEezGuiV3Style(style) ? style.childStyles : undefined,
        isPropertyMenuSupported: true,
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Style",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.invalidCharacters("."),
                                styleNameUnique(parent, undefined)
                            ]
                        }
                    ]
                },
                values: {},
                modal: true,
                backdrop: "static"
            });

            const styleProperties: Partial<Style> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const style = createObject<Style>(
                project._store,
                styleProperties,
                Style
            );

            return style;
        },
        getInheritedValue: (styleObject: Style, propertyName: string) =>
            getInheritedValue(styleObject, propertyName, false),
        icon: "material:format_color_fill",
        defaultValue: {},
        check: (style: Style, messages: IMessage[]) => {
            const projectStore = getProjectStore(style);

            if (projectStore.projectTypeTraits.isLVGL) {
                return;
            }

            function checkColor(propertyName: string) {
                const color = (style as any)[propertyName];
                if (color) {
                    const colorValue = getThemedColor(
                        projectStore,
                        color
                    ).colorValue;
                    if (!isValid(colorValue)) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `invalid color`,
                                getChildOfObject(style, propertyName)
                            )
                        );
                    }
                }
            }

            checkColor("color");
            checkColor("backgroundColor");
            checkColor("activeColor");
            checkColor("activeBackgroundColor");
            checkColor("focusColor");
            checkColor("focusBackgroundColor");
            checkColor("borderColor");
            checkColor("focusRingColor");
            checkColor("shadowColor");

            if (!isNotEezGuiV3Style(style)) {
                for (const range of NUMBER_PROPERTY_RANGES) {
                    const value = (style as any)[range.name];
                    if (value == undefined) {
                        continue;
                    }
                    if (
                        typeof value != "number" ||
                        !Number.isFinite(value) ||
                        value < range.min ||
                        value > range.max ||
                        (range.integer && !Number.isInteger(value))
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `"${range.label}": must be ${
                                    range.integer ? "an integer " : ""
                                }from ${range.min} to ${range.max}.`,
                                getChildOfObject(style, range.name)
                            )
                        );
                    }
                }

                checkFlatStyle(style, messages);
            }

            if (projectStore.projectTypeTraits.isDashboard) {
                if (
                    style.useStyle &&
                    !findStyle(projectStore.project, style.useStyle)
                ) {
                    messages.push(propertyNotFoundMessage(style, "useStyle"));
                }

                if (style.dynamicCSS) {
                    const widget = ProjectEditor.getWidget(style);
                    if (widget) {
                        try {
                            checkExpression(widget, style.dynamicCSS);
                        } catch (err) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Invalid Dynamic CSS expression: ${err}`,
                                    getChildOfObject(style, "dynamicCSS")
                                )
                            );
                        }
                    }
                }

                // TODO
            } else {
                ProjectEditor.checkAssetId(
                    projectStore,
                    "allStyles",
                    style,
                    messages
                );

                if (
                    style.useStyle &&
                    !findStyle(projectStore.project, style.useStyle)
                ) {
                    messages.push(propertyNotFoundMessage(style, "useStyle"));
                } else {
                    if (!style.fontName) {
                        messages.push(propertyNotSetMessage(style, "font"));
                    } else if (!style.fontObject) {
                        messages.push(propertyNotFoundMessage(style, "font"));
                    }

                    let borderSizeError = Style.getRect(
                        style.borderSizeProperty
                    ).error;
                    if (borderSizeError) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `"Border size": ${borderSizeError}.`,
                                getChildOfObject(style, "borderSize")
                            )
                        );
                    }

                    let borderRadiusError = Style.getRect(
                        style.borderRadiusProperty
                    ).error;
                    if (borderRadiusError) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `"Border radius": ${borderRadiusError}.`,
                                getChildOfObject(style, "borderRadius")
                            )
                        );
                    }

                    let alignHorizontal = style.alignHorizontalProperty;
                    if (
                        alignHorizontal &&
                        alignHorizontal != "left" &&
                        alignHorizontal != "center" &&
                        alignHorizontal != "right"
                    ) {
                        messages.push(
                            propertyInvalidValueMessage(
                                style,
                                "alignHorizontal"
                            )
                        );
                    }

                    let alignVertical = style.alignVerticalProperty;
                    if (
                        alignVertical &&
                        alignVertical != "top" &&
                        alignVertical != "center" &&
                        alignVertical != "bottom"
                    ) {
                        messages.push(
                            propertyInvalidValueMessage(style, "alignVertical")
                        );
                    }

                    let direction = style.directionProperty;
                    if (
                        direction &&
                        direction != "ltr" &&
                        direction != "rtl" &&
                        direction != "initial" &&
                        direction != "inherit"
                    ) {
                        messages.push(
                            propertyInvalidValueMessage(style, "direction")
                        );
                    }

                    if (isNaN(style.color16)) {
                        messages.push(
                            propertyInvalidValueMessage(style, "color")
                        );
                    }

                    if (isNaN(style.backgroundColor16)) {
                        messages.push(
                            propertyInvalidValueMessage(
                                style,
                                "backgroundColor"
                            )
                        );
                    }

                    if (
                        projectStore.project.settings.general.projectVersion !==
                        "v1"
                    ) {
                        if (isNaN(style.activeColor16)) {
                            messages.push(
                                propertyInvalidValueMessage(
                                    style,
                                    "activeColor"
                                )
                            );
                        }

                        if (isNaN(style.activeBackgroundColor16)) {
                            messages.push(
                                propertyInvalidValueMessage(
                                    style,
                                    "activeBackgroundColor"
                                )
                            );
                        }

                        if (isNaN(style.focusColor16)) {
                            messages.push(
                                propertyInvalidValueMessage(style, "focusColor")
                            );
                        }

                        if (isNaN(style.focusBackgroundColor16)) {
                            messages.push(
                                propertyInvalidValueMessage(
                                    style,
                                    "focusBackgroundColor"
                                )
                            );
                        }
                    }

                    if (isNaN(style.borderColor16)) {
                        messages.push(
                            propertyInvalidValueMessage(style, "borderColor")
                        );
                    }

                    let paddingError = Style.getRect(
                        style.paddingProperty
                    ).error;
                    if (paddingError) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `"Padding": ${paddingError}.`,
                                getChildOfObject(style, "padding")
                            )
                        );
                    }

                    if (!isV3OrNewerProject(style)) {
                        let marginError = Style.getRect(
                            style.marginProperty
                        ).error;
                        if (marginError) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `"Margin": ${marginError}.`,
                                    getChildOfObject(style, "margin")
                                )
                            );
                        }
                    }
                }
            }
        },
        showTreeCollapseIcon: "has-children",
        // sorted by name, a state style is listed under its base style
        sortedTreeParent: (style: Style) =>
            style.state && style.useStyle && !isWidgetParentOfStyle(style)
                ? ProjectEditor.getProject(style).allStyles.find(
                      projectStyle => projectStyle.name == style.useStyle
                  )
                : undefined
    };

    get parentStyle(): Style | undefined {
        if (this.useStyle) {
            return findStyle(ProjectEditor.getProject(this), this.useStyle);
        }

        // since getParent is not observable, we need to do this
        // to invalidate all computed observables when parent changes
        const styleArray = getParent(this) as Style[];
        if (!isEezObjectArray(styleArray)) {
            return undefined;
        }
        styleArray.indexOf(this);

        const object = getParent(styleArray);
        if (object instanceof Style) {
            return object;
        }

        return undefined;
    }

    get fontName(): string {
        return getStyleProperty(this, "font");
    }

    get fontObject(): Font | undefined {
        if (this.font) {
            return findFont(ProjectEditor.getProject(this), this.font);
        }

        if (this.parentStyle) {
            return getInheritedValue(this.parentStyle, "fontObject")
                ?.value as Font;
        }

        return undefined;
    }

    get fontFamilyProperty(): string {
        return getStyleProperty(this, "fontFamily");
    }

    get fontSizeProperty(): string {
        return getStyleProperty(this, "fontSize");
    }

    get fontWeightProperty(): string {
        return getStyleProperty(this, "fontWeight");
    }

    get fontStyleProperty(): string {
        return getStyleProperty(this, "fontStyle");
    }

    static getRect(value: string) {
        let error;
        let top = 0;
        let right = 0;
        let bottom = 0;
        let left = 0;

        if (value !== undefined) {
            if (typeof value === "number") {
                if (!Number.isFinite(value)) {
                    error = `value is not a valid number`;
                } else if (value < 0) {
                    error = `value must be >= 0 && <= 255`;
                } else if (value > 255) {
                    error = `value must be >= 0 && <= 255`;
                } else {
                    top = right = bottom = left = value;
                }
            } else if (typeof value === "string") {
                const x = value.trim().split(/\W+/);

                if (x.length === 1) {
                    const value = parseInt(x[0]);
                    if (!Number.isFinite(value)) {
                        error = `value is not a valid number`;
                    } else if (value < 0) {
                        error = `value must be >= 0 && <= 255`;
                    } else if (value > 255) {
                        error = `value must be >= 0 && <= 255`;
                    } else {
                        top = right = bottom = left = value;
                    }
                } else if (x.length === 2) {
                    const topBottomValue = parseInt(x[0]);
                    if (!Number.isFinite(topBottomValue)) {
                        error = `"top/bottom" value is not a valid number`;
                    } else if (topBottomValue < 0) {
                        error = `"top/bottom" value must be >= 0 && <= 255`;
                    } else if (topBottomValue > 255) {
                        error = `"top/bottom" value must be >= 0 && <= 255`;
                    } else {
                        top = bottom = topBottomValue;
                    }

                    const rightLeftValue = parseInt(x[1]);
                    if (!Number.isFinite(rightLeftValue)) {
                        error = `"right/left" value is not a valid number`;
                    } else if (rightLeftValue < 0) {
                        error = `"right/left" value must be >= 0 && <= 255`;
                    } else if (rightLeftValue > 255) {
                        error = `"right/left" value must be >= 0 && <= 255`;
                    } else {
                        right = left = rightLeftValue;
                    }
                } else if (x.length === 3) {
                    const topLeftValue = parseInt(x[0]);
                    if (!Number.isFinite(topLeftValue)) {
                        error = `"top/left" value is not a valid number`;
                    } else if (topLeftValue < 0) {
                        error = `"top/left" value must be >= 0 && <= 255`;
                    } else if (topLeftValue > 255) {
                        error = `"top/left" value must be >= 0 && <= 255`;
                    } else {
                        top = left = topLeftValue;
                    }

                    const rightValue = parseInt(x[1]);
                    if (!Number.isFinite(rightValue)) {
                        error = `"right" value is not a valid number`;
                    } else if (rightValue < 0) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else if (rightValue > 255) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else {
                        right = rightValue;
                    }

                    const bottomValue = parseInt(x[2]);
                    if (!Number.isFinite(bottomValue)) {
                        error = `"bottom" value is not a valid number`;
                    } else if (bottomValue < 0) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else if (bottomValue > 255) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else {
                        bottom = bottomValue;
                    }
                } else if (x.length === 4) {
                    const topValue = parseInt(x[0]);
                    if (!Number.isFinite(topValue)) {
                        error = `"top" value is not a valid number`;
                    } else if (topValue < 0) {
                        error = `"top" value must be >= 0 && <= 255`;
                    } else if (topValue > 255) {
                        error = `"top" value must be >= 0 && <= 255`;
                    } else {
                        top = topValue;
                    }

                    const rightValue = parseInt(x[1]);
                    if (!Number.isFinite(rightValue)) {
                        error = `"right" value is not a valid number`;
                    } else if (rightValue < 0) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else if (rightValue > 255) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else {
                        right = rightValue;
                    }

                    const bottomValue = parseInt(x[2]);
                    if (!Number.isFinite(bottomValue)) {
                        error = `"bottom" value is not a valid number`;
                    } else if (bottomValue < 0) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else if (bottomValue > 255) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else {
                        bottom = bottomValue;
                    }

                    const leftValue = parseInt(x[3]);
                    if (!Number.isFinite(leftValue)) {
                        error = `"left" value is not a valid number`;
                    } else if (leftValue < 0) {
                        error = `"left" value must be >= 0 && <= 255`;
                    } else if (leftValue > 255) {
                        error = `"left" value must be >= 0 && <= 255`;
                    } else {
                        left = leftValue;
                    }
                } else {
                    error = `invalid value`;
                }
            } else {
                error = "invalid value type";
            }
        }

        return {
            error,
            rect: {
                top,
                right,
                bottom,
                left
            }
        };
    }

    static getRadiusSpec(value: string) {
        let error;
        let topLeftX = 0;
        let topLeftY = 0;
        let topRightX = 0;
        let topRightY = 0;
        let bottomLeftX = 0;
        let bottomLeftY = 0;
        let bottomRightX = 0;
        let bottomRightY = 0;

        if (value !== undefined) {
            if (typeof value === "number") {
                if (!Number.isFinite(value)) {
                    error = `value is not a valid number`;
                } else if (value < 0) {
                    error = `value must be >= 0 && <= 255`;
                } else if (value > 255) {
                    error = `value must be >= 0 && <= 255`;
                } else {
                    topLeftX =
                        topLeftY =
                        topRightX =
                        topRightY =
                        bottomLeftX =
                        bottomLeftY =
                        bottomRightX =
                        bottomRightY =
                            value;
                }
            } else if (typeof value === "string") {
                let parts = value.trim().split("/");
                if (parts.length == 1) {
                    parts.push(parts[0]);
                }

                if (parts.length == 2) {
                    let x = parts[0]
                        .trim()
                        .split(/\W+/)
                        .map(x => parseInt(x));
                    if (x.length == 1) {
                        x = [x[0], x[0], x[0], x[0]];
                    } else if (x.length == 2) {
                        x = [x[0], x[1], x[0], x[1]];
                    } else if (x.length == 3) {
                        x = [x[0], x[1], x[2], x[1]];
                    }

                    let y = parts[1]
                        .trim()
                        .split(/\W+/)
                        .map(y => parseInt(y));
                    if (y.length == 1) {
                        y = [y[0], y[0], y[0], y[0]];
                    } else if (y.length == 2) {
                        y = [y[0], y[1], y[0], y[1]];
                    } else if (y.length == 3) {
                        y = [y[0], y[1], y[2], y[1]];
                    }

                    if (x.length == 4 && y.length == 4) {
                        for (let i = 0; i < 4; i++) {
                            if (!Number.isFinite(x[i])) {
                                error = `value is not a valid number`;
                            } else if (x[i] < 0) {
                                error = `value must be >= 0 && <= 255`;
                            } else if (x[i] > 255) {
                                error = `value must be >= 0 && <= 255`;
                            }
                        }
                        if (!error) {
                            for (let i = 0; i < 4; i++) {
                                if (!Number.isFinite(y[i])) {
                                    error = `value is not a valid number`;
                                } else if (y[i] < 0) {
                                    error = `value must be >= 0 && <= 255`;
                                } else if (y[i] > 255) {
                                    error = `value must be >= 0 && <= 255`;
                                }
                            }

                            topLeftX = x[0];
                            topLeftY = y[0];
                            topRightX = x[1];
                            topRightY = y[1];
                            bottomRightX = x[2];
                            bottomRightY = y[2];
                            bottomLeftX = x[3];
                            bottomLeftY = y[3];
                        }
                    } else {
                        error = `invalid value`;
                    }
                } else {
                    error = `invalid value`;
                }
            } else {
                error = "invalid value type";
            }
        }

        return {
            error,
            spec: {
                topLeftX,
                topLeftY,
                topRightX,
                topRightY,
                bottomLeftX,
                bottomLeftY,
                bottomRightX,
                bottomRightY
            }
        };
    }

    get borderSizeProperty(): string {
        return getStyleProperty(this, "borderSize");
    }

    get borderSizeRect() {
        return Style.getRect(this.borderSizeProperty).rect;
    }

    get borderRadiusProperty(): string {
        return getStyleProperty(this, "borderRadius");
    }

    get borderRadiusSpec() {
        return Style.getRadiusSpec(this.borderRadiusProperty).spec;
    }

    get alignHorizontalProperty(): string {
        return getStyleProperty(this, "alignHorizontal");
    }

    get alignVerticalProperty(): string {
        return getStyleProperty(this, "alignVertical");
    }

    get directionProperty(): string {
        return getStyleProperty(this, "direction");
    }

    getColorStyleProperty(propertyName: string) {
        const color = getStyleProperty(this, propertyName);
        if (color == undefined || color == "transparent" || color == "rgba(0, 0, 0, 0)") {
            return color;
        }
        const colorFormat = ColorFormat.parse(color, ProjectEditor.getProject(this));
        return colorFormat.getHexString();
    }

    get colorProperty(): string {
        return this.getColorStyleProperty("color");
    }

    get color16(): number {
        return strToColor16(this.colorProperty);
    }

    get backgroundColorProperty(): string {
        return this.getColorStyleProperty("backgroundColor");
    }

    get backgroundColor16(): number {
        return strToColor16(this.backgroundColorProperty);
    }

    get backgroundImageProperty(): string {
        return getStyleProperty(this, "backgroundImage");
    }

    get activeColorProperty(): string {
        return this.getColorStyleProperty("activeColor");
    }

    get activeColor16(): number {
        return strToColor16(this.activeColorProperty);
    }

    get activeBackgroundColorProperty(): string {
        return this.getColorStyleProperty("activeBackgroundColor");
    }

    get activeBackgroundColor16(): number {
        return strToColor16(this.activeBackgroundColorProperty);
    }

    get focusColorProperty(): string {
        return this.getColorStyleProperty("focusColor");
    }

    get focusColor16(): number {
        return strToColor16(this.focusColorProperty);
    }

    get focusBackgroundColorProperty(): string {
        return this.getColorStyleProperty("focusBackgroundColor");
    }

    get focusBackgroundColor16(): number {
        return strToColor16(this.focusBackgroundColorProperty);
    }

    get borderColorProperty(): string {
        return this.getColorStyleProperty("borderColor");
    }

    get borderColor16(): number {
        return strToColor16(this.borderColorProperty);
    }

    get borderStyleProperty(): string {
        return getStyleProperty(this, "borderStyle");
    }

    get paddingProperty(): string {
        return getStyleProperty(this, "padding");
    }

    get paddingRect() {
        return Style.getRect(this.paddingProperty).rect;
    }

    get marginProperty(): string {
        return getStyleProperty(this, "margin");
    }

    get marginRect() {
        return Style.getRect(this.marginProperty).rect;
    }

    get opacityProperty(): number {
        const opacity = getStyleProperty(this, "opacity");
        if (isNaN(opacity)) {
            return 255;
        }
        return opacity;
    }

    get boxShadowProperty(): number {
        return getStyleProperty(this, "boxShadow");
    }

    get blinkProperty(): number {
        return getStyleProperty(this, "blink");
    }

    getNumberStyleProperty(propertyName: string) {
        const value = Number(getStyleProperty(this, propertyName));
        return Number.isFinite(value) ? value : 0;
    }

    get letterSpacingProperty(): number {
        return this.getNumberStyleProperty("letterSpacing");
    }

    get lineHeightProperty(): number {
        return this.getNumberStyleProperty("lineHeight");
    }

    get ellipsisProperty(): boolean {
        return !!getStyleProperty(this, "ellipsis");
    }

    get focusRingWidthProperty(): number {
        return this.getNumberStyleProperty("focusRingWidth");
    }

    get focusRingOffsetProperty(): number {
        return this.getNumberStyleProperty("focusRingOffset");
    }

    get focusRingColorProperty(): string {
        return this.getColorStyleProperty("focusRingColor");
    }

    get shadowOffsetXProperty(): number {
        return this.getNumberStyleProperty("shadowOffsetX");
    }

    get shadowOffsetYProperty(): number {
        return this.getNumberStyleProperty("shadowOffsetY");
    }

    get shadowBlurProperty(): number {
        return this.getNumberStyleProperty("shadowBlur");
    }

    get shadowSpreadProperty(): number {
        return this.getNumberStyleProperty("shadowSpread");
    }

    get shadowColorProperty(): string {
        return this.getColorStyleProperty("shadowColor");
    }

    // The project style whose state styles this style has: this one, or the
    // one a widget style (or its style in a page layout) uses.
    get stateBaseStyle(): Style | undefined {
        const visited = new Set<Style>();
        for (
            let style: Style | undefined = this;
            style && !visited.has(style);
            style = style.parentStyle
        ) {
            visited.add(style);
            if (!isWidgetParentOfStyle(style)) {
                return style.state ? undefined : style;
            }
        }
        return undefined;
    }

    // The properties of the style in each state: the own properties of the
    // state styles of its project style (stateBaseStyle). undefined for a style
    // without states and for a state style.
    get stateDeltas():
        | Partial<Record<StyleStateName, { [propertyName: string]: any }>>
        | undefined {
        if (this.isStateStyle || this.state || isNotEezGuiV3Style(this)) {
            return undefined;
        }

        const baseStyle = this.stateBaseStyle;
        if (!baseStyle) {
            return undefined;
        }

        let result:
            | Partial<Record<StyleStateName, { [propertyName: string]: any }>>
            | undefined;

        for (const stateStyle of getStateStyles(baseStyle)) {
            if (!result) {
                result = {};
            }
            let delta = result[stateStyle.state!];
            if (!delta) {
                delta = {};
                result[stateStyle.state!] = delta;
            }

            for (const propertyInfo of stateStyleProperties) {
                const value = getProperty(stateStyle, propertyInfo.name);
                if (value !== undefined && !(propertyInfo.name in delta)) {
                    delta[propertyInfo.name] = value;
                }
            }
        }

        return result;
    }

    // the state properties (stateDeltas) as a string, the same for the styles
    // with the same states
    get stateKey(): string {
        const stateDeltas = this.stateDeltas;
        if (!stateDeltas) {
            return "";
        }
        return JSON.stringify(
            STYLE_STATES.map(state => {
                const delta = stateDeltas[state];
                return delta
                    ? Object.keys(delta)
                          .sort()
                          .map(name => [name, delta[name]])
                    : [];
            })
        );
    }

    // true if the style has no style properties of its own (useStyle is not
    // a style property)
    get hasNoOwnStyleProperties(): boolean {
        for (const propertyInfo of stateStyleProperties) {
            if (getProperty(this, propertyInfo.name) !== undefined) {
                return false;
            }
        }
        return true;
    }

    compareTo(otherStyle: Style): boolean {
        return (
            this.fontName === otherStyle.fontName &&
            this.fontFamilyProperty === otherStyle.fontFamilyProperty &&
            this.fontSizeProperty === otherStyle.fontSizeProperty &&
            this.fontWeightProperty === otherStyle.fontWeightProperty &&
            this.fontStyleProperty === otherStyle.fontStyleProperty &&
            this.alignHorizontalProperty ===
                otherStyle.alignHorizontalProperty &&
            this.alignVerticalProperty === otherStyle.alignVerticalProperty &&
            this.directionProperty === otherStyle.directionProperty &&
            this.colorProperty === otherStyle.colorProperty &&
            this.backgroundColorProperty ===
                otherStyle.backgroundColorProperty &&
            this.backgroundImageProperty ===
                otherStyle.backgroundImageProperty &&
            this.activeColorProperty === otherStyle.activeColorProperty &&
            this.activeBackgroundColorProperty ===
                otherStyle.activeBackgroundColorProperty &&
            this.focusColorProperty === otherStyle.focusColorProperty &&
            this.focusBackgroundColorProperty ===
                otherStyle.focusBackgroundColorProperty &&
            this.borderSizeProperty === otherStyle.borderSizeProperty &&
            this.borderRadiusProperty === otherStyle.borderRadiusProperty &&
            this.borderColorProperty === otherStyle.borderColorProperty &&
            this.borderStyleProperty === otherStyle.borderStyleProperty &&
            this.paddingProperty === otherStyle.paddingProperty &&
            this.marginProperty === otherStyle.marginProperty &&
            this.opacityProperty === otherStyle.opacityProperty &&
            this.boxShadowProperty === otherStyle.boxShadowProperty &&
            this.blinkProperty === otherStyle.blinkProperty &&
            this.letterSpacingProperty === otherStyle.letterSpacingProperty &&
            this.lineHeightProperty === otherStyle.lineHeightProperty &&
            this.ellipsisProperty === otherStyle.ellipsisProperty &&
            this.focusRingWidthProperty ===
                otherStyle.focusRingWidthProperty &&
            this.focusRingOffsetProperty ===
                otherStyle.focusRingOffsetProperty &&
            this.focusRingColorProperty ===
                otherStyle.focusRingColorProperty &&
            this.shadowOffsetXProperty === otherStyle.shadowOffsetXProperty &&
            this.shadowOffsetYProperty === otherStyle.shadowOffsetYProperty &&
            this.shadowBlurProperty === otherStyle.shadowBlurProperty &&
            this.shadowSpreadProperty === otherStyle.shadowSpreadProperty &&
            this.shadowColorProperty === otherStyle.shadowColorProperty &&
            // the states of a state style are not used
            (this.isStateStyle || this.stateKey === otherStyle.stateKey)
        );
    }

    get cssDeclarations() {
        const projectStore = getProjectStore(this);

        let spec = [
            {
                selector: "",
                attrs: [
                    ["direction", this.direction],
                    ["font-family", this.fontFamily],
                    ["font-weight", this.fontWeight],
                    ["font-style", this.fontStyle],
                    [
                        "color",
                        this.color &&
                            getThemedColor(projectStore, this.color).colorValue
                    ],
                    [
                        "background-color",
                        this.backgroundColor &&
                            getThemedColor(projectStore, this.backgroundColor)
                                .colorValue
                    ],
                    [
                        "border-color",
                        this.borderColor &&
                            getThemedColor(projectStore, this.borderColor)
                                .colorValue
                    ],
                    ["border-style", this.borderStyle],
                    ["box-shadow", this.boxShadow]
                ]
            },
            {
                selector: ":active",
                attrs: [
                    [
                        "color",
                        this.activeColor &&
                            getThemedColor(projectStore, this.activeColor)
                                .colorValue
                    ],
                    [
                        "background-color",
                        this.activeBackgroundColor &&
                            getThemedColor(
                                projectStore,
                                this.activeBackgroundColor
                            ).colorValue
                    ]
                ]
            },
            {
                selector: ":focus",
                attrs: [
                    [
                        "color",
                        this.focusColor &&
                            getThemedColor(projectStore, this.focusColor)
                                .colorValue
                    ],
                    [
                        "background-color",
                        this.focusBackgroundColor &&
                            getThemedColor(
                                projectStore,
                                this.focusBackgroundColor
                            ).colorValue
                    ]
                ]
            }
        ];

        function appendPx(value: string | undefined) {
            if (!value) {
                return undefined;
            }

            let result: number | string = Number.parseInt(value);
            if (isNaN(result)) {
                result = value;
            } else {
                if (result.toString() == value) {
                    result = value + "px";
                } else {
                    result = value;
                }
            }

            return result;
        }

        function addNumberStyle(attr: string, value: string | undefined) {
            const modValue = appendPx(value);
            if (modValue != undefined) {
                spec[0].attrs.push([attr, modValue]);
            }
        }

        addNumberStyle("font-size", this.fontSize);
        addNumberStyle("border-width", this.borderSize);

        if (this.borderRadius) {
            const value = this.borderRadius
                .split("/")
                .map(part =>
                    part
                        .split(/\s+/)
                        .map(value => appendPx(value))
                        .join(" ")
                )
                .join(" / ");

            spec[0].attrs.push(["border-radius", value]);
        }

        if (this.padding) {
            const values = this.padding
                .split(/\s+/)
                .map(value => appendPx(value))
                .join(" ");

            spec[0].attrs.push(["padding", values]);
        }

        if (
            this.alignHorizontal != undefined ||
            this.alignVertical != undefined
        ) {
            spec[0].attrs.push(["display", "flex"]);

            spec[0].attrs.push([
                "justify-content",
                this.alignHorizontal == "left"
                    ? "flex-start"
                    : this.alignHorizontal == "right"
                    ? "flex-end"
                    : "center"
            ]);

            spec[0].attrs.push([
                "align-items",
                this.alignVertical == "top"
                    ? "flex-start"
                    : this.alignVertical == "bottom"
                    ? "flex-end"
                    : "center"
            ]);
        }

        if (!isNaN(this.opacity)) {
            spec[0].attrs.push(["opacity", this.opacity.toString()]);
        }

        if (this.blink) {
            spec[0].attrs.push(["animation", "blinker 1s linear infinite"]);
        }

        if (this.backgroundImageProperty) {
            const project = ProjectEditor.getProject(this);
            const bitmap = findBitmap(project, this.backgroundImageProperty);
            if (bitmap) {
                spec[0].attrs.push([
                    "background-image",
                    `url(${bitmap.imageSrc})`
                ]);
                spec[0].attrs.push(["background-repeat", `no-repeat`]);
            }
        }

        spec.forEach(value => {
            value.attrs = value.attrs.filter(attr => !!attr[1]);
        });

        spec = spec.filter(value => value.attrs.length > 0);

        let declarations = "";

        spec.forEach(value => {
            const attrs = value.attrs.map(attr => `${attr[0]}: ${attr[1]};`);

            if (declarations) {
                declarations += "\n";
            }

            if (value.selector) {
                declarations += `&${value.selector} {\n\t${attrs.join(
                    "\n\t"
                )}\n}`;
            } else {
                declarations += attrs.join("\n");
            }
        });

        if (this.blink) {
            declarations +=
                "\n@keyframes blinker {\n\t50% {\n\t\topacity: 0;\n\t}\n}";
        }

        if (this.css) {
            if (declarations) {
                declarations += "\n";
            }
            declarations += this.css;
        }

        return declarations;
    }

    get cssPreview() {
        const project = ProjectEditor.getProject(this);
        if (!project.projectTypeTraits.isDashboard) {
            return "";
        }

        function getCssPreview(style: Style, visited: Style[]): string {
            if (visited.indexOf(style) != -1) {
                return "";
            }
            visited.push(style);

            let cssPreview = "";

            if (style.parentStyle) {
                const parentCssPreview = getCssPreview(
                    style.parentStyle,
                    visited
                );
                if (parentCssPreview) {
                    if (cssPreview) {
                        cssPreview += "\n";
                    }
                    cssPreview += parentCssPreview;
                }
            }

            if (style.cssDeclarations) {
                if (cssPreview) {
                    cssPreview += "\n";
                }
                if (style.name) {
                    cssPreview += `/* ${style.name} */\n`;
                } else {
                    cssPreview += `/* inline style */\n`;
                }
                cssPreview += style.cssDeclarations;
            }

            return cssPreview;
        }

        return getCssPreview(this, []);
    }

    get globalClassName() {
        return "eez-project-style-" + this.name + "-" + this._transientId;
    }

    get classNames(): string[] {
        function getClassNames(style: Style, visited: Style[]): string[] {
            const classNames = [];

            if (visited.indexOf(style) == -1) {
                visited.push(style);

                if (style.parentStyle) {
                    classNames.push(
                        ...getClassNames(style.parentStyle, visited)
                    );
                }

                if (style.cssDeclarations) {
                    classNames.push(style.globalClassName);
                }
            }

            return classNames;
        }

        if (!isDashboardProject(this)) {
            return [];
        }

        return getClassNames(this, []);
    }

    getConditionalClassNames(flowContext: IFlowContext): string[] {
        const classNames: string[] = [];

        if (this.conditionalStyles) {
            const widget = ProjectEditor.getWidget(this);
            if (widget) {
                this.conditionalStyles.forEach((conditionalStyle, index) => {
                    let condition =
                        ProjectEditor.evalProperty(
                            flowContext,
                            widget,
                            `${getKey(this)}.${
                                conditionalStylesProperty.name
                            }[${index}].${
                                conditionalStyleConditionProperty.name
                            }`
                        ) ?? false;

                    if (condition) {
                        const style = findStyle(
                            flowContext.projectStore.project,
                            conditionalStyle.style
                        );

                        if (style) {
                            classNames.push(...style.classNames);
                        }
                    }
                });
            }
        }
        return classNames;
    }

    getDynamicCSSClassName(flowContext: IFlowContext) {
        if (this.dynamicCSS) {
            const widget = ProjectEditor.getWidget(this);
            if (widget) {
                let value = ProjectEditor.evalProperty(
                    flowContext,
                    widget,
                    `${getKey(this)}.${dynamicCssProperty.name}`
                );

                if (!value) {
                    return undefined;
                }

                const { css } =
                    require("@emotion/css") as typeof import("@emotion/css");

                return css`
                    &&&&& {
                        ${value}
                    }
                `;
            }
        }

        return undefined;
    }

    render() {
        if (!this.cssDeclarations) {
            return null;
        }

        // increase specificity, so this style overrides for example:
        // .EezStudio_FlowCanvasContainer.EezStudio_FlowEditorCanvasContainer .EezStudio_ComponentEnclosure.ButtonWidget button
        const selector = `.${this.globalClassName}.${this.globalClassName}.${this.globalClassName}.${this.globalClassName}`;

        const { Global, css } =
            require("@emotion/react") as typeof import("@emotion/react");

        return (
            <Global
                key={this.objID}
                styles={css`
                    ${selector} {
                        ${this.cssDeclarations}
                    }
                `}
            ></Global>
        );
    }
}

registerClass("Style", Style);

////////////////////////////////////////////////////////////////////////////////

// widget style properties that can be changed in the page layout
const pageLayoutStyleProperties = properties.filter(
    propertyInfo =>
        (propertyInfo.inheritable || propertyInfo == useStyleProperty) &&
        propertyInfo.type != PropertyType.Array &&
        propertyInfo.type != PropertyType.Object
);

function definePageLayoutStyleProperties(
    style: Style,
    getValue: (propertyName: string) => any
) {
    for (const propertyInfo of pageLayoutStyleProperties) {
        Object.defineProperty(style, propertyInfo.name, {
            get: () => getValue(propertyInfo.name),
            enumerable: true,
            configurable: true
        });
    }
}

// Style of the widget in the page layout (see PageLayout). The values changed
// in the page layout (stored in the Widget.layoutProperties) are the own values
// of this style and all other values are inherited from the widget style.
// This style is not part of the project, changes are stored by the
// updatePageLayoutValues.
export class PageLayoutStyle extends Style {
    private baseStyleWithLayoutUseStyle: Style | undefined;

    constructor(
        public widget: Widget,
        public stylePropertyName: string,
        public pageLayout: PageLayout,
        private isApplyToAllLayouts: () => boolean
    ) {
        super();

        definePageLayoutStyleProperties(this, propertyName => {
            const value = this.pageLayoutValues?.[propertyName];
            if (value !== undefined) {
                return value;
            }

            // when the changes are applied to all page layouts, the widget
            // style is edited
            if (this.isApplyToAllLayouts()) {
                return (this.baseStyle as any)[propertyName];
            }

            // if not changed in the page layout, the style used by the widget
            // style is used (see parentStyle)
            if (propertyName == "useStyle") {
                return this.baseStyle.useStyle;
            }

            return undefined;
        });

        setParent(this, widget);
    }

    get baseStyle(): Style {
        return (this.widget as any)[this.stylePropertyName];
    }

    get pageLayoutValues(): { [propertyName: string]: any } | undefined {
        return this.widget.layoutProperties?.[this.pageLayout.name]?.[
            this.stylePropertyName
        ];
    }

    override get parentStyle(): Style | undefined {
        if (this.pageLayoutValues?.useStyle === undefined) {
            return this.baseStyle;
        }

        // widget style inherits from the style selected in the page layout
        if (!this.baseStyleWithLayoutUseStyle) {
            const style = new Style();

            definePageLayoutStyleProperties(style, propertyName =>
                propertyName == "useStyle"
                    ? this.pageLayoutValues?.useStyle
                    : (this.baseStyle as any)[propertyName]
            );

            setParent(style, this.widget);

            this.baseStyleWithLayoutUseStyle = style;
        }

        return this.baseStyleWithLayoutUseStyle;
    }
}

////////////////////////////////////////////////////////////////////////////////

// the style properties a state child style can change
const stateStyleProperties = pageLayoutStyleProperties.filter(
    propertyInfo => propertyInfo != useStyleProperty
);

// The style of a widget in a state, built for the assets: the properties of
// the state (see Style.stateDeltas) over the base style.
export class StateStyle extends Style {
    constructor(
        public baseStyle: Style,
        public stateName: StyleStateName,
        delta: { [propertyName: string]: any }
    ) {
        super();

        this.isStateStyle = true;

        definePageLayoutStyleProperties(this, propertyName =>
            propertyName == "useStyle" ? undefined : delta[propertyName]
        );

        setParent(this, baseStyle);
    }

    override get parentStyle(): Style | undefined {
        return this.baseStyle;
    }
}

////////////////////////////////////////////////////////////////////////////////

// the state styles of a project style (in the same project), in the order of
// the project styles
function getStateStyles(baseStyle: Style) {
    if (!baseStyle.name) {
        return [];
    }
    return ProjectEditor.getProject(baseStyle).allStyles.filter(
        style => style.state && style.useStyle == baseStyle.name
    );
}

// the checks of the project styles of an EEZ-GUI v3 project (see
// useStyleProperty and stateProperty)
function checkFlatStyle(style: Style, messages: IMessage[]) {
    if (isWidgetParentOfStyle(style)) {
        return;
    }

    if (!style.state) {
        if (style.useStyle) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `A project style doesn't use another style, only a state style uses its base style.`,
                    getChildOfObject(style, "useStyle")
                )
            );
        }
        return;
    }

    if (!style.useStyle) {
        messages.push(propertyNotSetMessage(style, "useStyle"));
        return;
    }

    const baseStyle = ProjectEditor.getProject(style).allStyles.find(
        projectStyle => projectStyle.name == style.useStyle
    );
    if (!baseStyle) {
        messages.push(
            new Message(
                MessageType.ERROR,
                `The base style "${style.useStyle}" is not a style of this project.`,
                getChildOfObject(style, "useStyle")
            )
        );
        return;
    }

    if (baseStyle.state) {
        messages.push(
            new Message(
                MessageType.ERROR,
                `The base style "${style.useStyle}" is a state style.`,
                getChildOfObject(style, "useStyle")
            )
        );
        return;
    }

    if (
        getStateStyles(baseStyle).find(
            stateStyle => stateStyle != style && stateStyle.state == style.state
        )
    ) {
        messages.push(
            new Message(
                MessageType.ERROR,
                `More than one state style for the state "${style.state}" of the style "${style.useStyle}".`,
                getChildOfObject(style, "state")
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const EEZ_GUI_PROJECT_TYPES = [
    "firmware",
    "firmware-module",
    "resource",
    "applet"
];

// the project JSON of an EEZ-GUI v3 project (see isNotEezGuiV3Style)
function isEezGuiV3ProjectJs(projectJs: any) {
    const general = projectJs?.settings?.general;
    return (
        !!general &&
        EEZ_GUI_PROJECT_TYPES.indexOf(general.projectType) != -1 &&
        general.projectVersion != "v1" &&
        general.projectVersion != "v2"
    );
}

// true if the project styles have child styles or a style that is not a
// state style uses another style
function hasStyleInheritanceJs(styles: any[] | undefined) {
    return (
        Array.isArray(styles) &&
        styles.some(
            style =>
                (Array.isArray(style.childStyles) &&
                    style.childStyles.length > 0) ||
                (!!style.useStyle && !style.state)
        )
    );
}

// The project styles of an EEZ-GUI v3 project that is loaded: flattened (see
// flattenEezGuiStylesJs), the looks of the states as state styles (see
// convertEezGuiStateLooksJs).
export function convertEezGuiProjectStylesJs(projectJs: any) {
    if (!isEezGuiV3ProjectJs(projectJs)) {
        return;
    }
    flattenEezGuiProjectStylesJs(projectJs);
    convertEezGuiStateLooksJs(projectJs);
}

// The project styles of an EEZ-GUI v3 project that is loaded, flattened (see
// flattenEezGuiStylesJs). The styles of a module project can use the styles of
// its master project, which is read for that.
function flattenEezGuiProjectStylesJs(projectJs: any) {
    if (!hasStyleInheritanceJs(projectJs.styles)) {
        return;
    }

    let masterStyles: any[] | undefined;

    const masterProject = projectJs.settings.general.masterProject;
    const filePath = getSerializationFilePath();
    if (masterProject && filePath) {
        try {
            // as OpenProjectsManager.getAbsoluteFilePath (not imported, it
            // would load the project modules before this one is loaded)
            const normalize = (filePath: string) =>
                filePath.replace(/(\\|\/)/g, "/");
            const masterProjectJs = JSON.parse(
                fs.readFileSync(
                    path.resolve(
                        path.dirname(normalize(filePath)),
                        normalize(masterProject)
                    ),
                    "utf8"
                )
            );
            if (isEezGuiV3ProjectJs(masterProjectJs)) {
                flattenEezGuiStylesJs(masterProjectJs, undefined);
                masterStyles = masterProjectJs.styles;
            }
        } catch (err) {
            console.error(err);
        }
    }

    flattenEezGuiStylesJs(projectJs, masterStyles);
}

////////////////////////////////////////////////////////////////////////////////

const OLD_STATE_COLOR_PROPERTIES = [
    "activeColor",
    "activeBackgroundColor",
    "focusColor",
    "focusBackgroundColor"
];

// the state style of a widget in the EEZ-GUI v1/v2 projects
const OLD_WIDGET_STATE_STYLES: { [propertyName: string]: StyleStateName } = {
    disabledStyle: "disabled",
    checkedStyle: "checked",
    selectedStyle: "selected"
};

// true for a fully transparent color (also a theme color of the first theme)
function isTransparentColorJs(projectJs: any, color: any): boolean {
    if (typeof color != "string") {
        return false;
    }
    const value = color.trim().toLowerCase().replace(/\s+/g, "");
    if (
        value == "transparent" ||
        value == "rgba(0,0,0,0)" ||
        /^#[0-9a-f]{6}00$/.test(value)
    ) {
        return true;
    }
    const colorIndex = (projectJs.colors ?? []).findIndex(
        (themeColor: any) => themeColor.name == color
    );
    if (colorIndex != -1) {
        const themeValue = projectJs.themes?.[0]?.colors?.[colorIndex];
        return typeof themeValue == "string" && isTransparentColorJs({}, themeValue);
    }
    return false;
}

// The looks of the states in an older EEZ-GUI v3 project (active and focus
// colors, the state styles of some widgets) as state styles (see
// stateProperty). The project styles are flat (flattenEezGuiStylesJs).
// - pressed: from the active colors of a style that has them. Without a
//   pressed state style a pressed widget is drawn with the color and the
//   background swapped (not over a transparent background), so there is a
//   pressed state style only for another look. A style used only by Switch and
//   Progress widgets gets none (their active background was the on/filled
//   part).
// - checked: the active background of a style of Switch widgets (the on part,
//   without a checked state style it is the background) and Progress widgets
//   (the filled part, without a checked state style it is the color).
// - focused: from the focus colors of a style that has them, a focus ring for
//   a ScrollBar (it drew a 2 px frame in the focus color).
// - disabled, checked, selected: from the disabled style of a Button, the
//   checked style of a ToggleButton, the selected style of a ButtonGroup: the
//   properties that differ from the style of the widget. Only if the widget
//   style uses a style of this project which has no state style for the state
//   yet (otherwise the look of the widget is lost).
// The active and focus colors of the widget styles and the focus style of
// Text and DisplayData widgets (not used in EEZ-GUI v3) are dropped. A new
// state style is named <style>_<state> and placed after the style and its
// state styles.
function convertEezGuiStateLooksJs(projectJs: any) {
    if (!Array.isArray(projectJs.styles)) {
        return;
    }

    const styles: any[] = projectJs.styles;

    const byName = new Map<string, any>();
    for (const style of styles) {
        if (style.name != undefined && !byName.has(style.name)) {
            byName.set(style.name, style);
        }
    }

    const defaults: { [propertyName: string]: any } = {};
    for (const propertyInfo of properties) {
        if (propertyInfo.defaultValue !== undefined) {
            defaults[propertyInfo.name] = propertyInfo.defaultValue;
        }
    }
    const getValue = (style: any, propertyName: string) =>
        style[propertyName] !== undefined
            ? style[propertyName]
            : defaults[propertyName];

    // the widgets, the widget types (without "Widget") that use each style
    // and the style objects of the pages
    const widgets: any[] = [];
    const users = new Map<string, Set<string>>();
    const pageStyles: any[] = [];
    const walk = (object: any) => {
        if (Array.isArray(object)) {
            object.forEach(walk);
        } else if (object && typeof object == "object") {
            if (
                object.useStyle !== undefined ||
                object.conditionalStyles !== undefined
            ) {
                pageStyles.push(object);
            }
            if (
                typeof object.type == "string" &&
                object.style &&
                typeof object.style == "object"
            ) {
                widgets.push(object);
                const type = object.type.endsWith("Widget")
                    ? object.type.slice(0, -"Widget".length)
                    : object.type;
                const useStyle = object.style.useStyle;
                if (useStyle) {
                    let types = users.get(useStyle);
                    if (!types) {
                        types = new Set();
                        users.set(useStyle, types);
                    }
                    types.add(type);
                }
            }
            for (const value of Object.values(object)) {
                walk(value);
            }
        }
    };
    for (const page of [
        ...(projectJs.userPages ?? []),
        ...(projectJs.userWidgets ?? [])
    ]) {
        walk(page.components ?? []);
    }

    const names = new Set(byName.keys());
    const getUniqueName = (name: string) => {
        let uniqueName = name;
        for (let i = 2; names.has(uniqueName); i++) {
            uniqueName = `${name}_${i}`;
        }
        names.add(uniqueName);
        return uniqueName;
    };

    const newStateStyles = new Map<any, any[]>();
    const hasStateStyle = (baseStyle: any, state: string) =>
        styles.some(
            style => style.state == state && style.useStyle == baseStyle.name
        ) ||
        (newStateStyles.get(baseStyle) ?? []).some(
            style => style.state == state
        );
    const addStateStyle = (baseStyle: any, state: string, props: any) => {
        if (hasStateStyle(baseStyle, state)) {
            return;
        }
        let stateStyles = newStateStyles.get(baseStyle);
        if (!stateStyles) {
            stateStyles = [];
            newStateStyles.set(baseStyle, stateStyles);
        }
        stateStyles.push({
            name: getUniqueName(`${baseStyle.name}_${state}`),
            state,
            useStyle: baseStyle.name,
            ...props
        });
    };

    for (const baseStyle of styles) {
        if (baseStyle.state || baseStyle.name == undefined) {
            continue;
        }

        const types = users.get(baseStyle.name) ?? new Set<string>();
        const isSwitchOrProgress = types.has("Switch") || types.has("Progress");
        const isOnlySwitchOrProgress =
            types.size > 0 &&
            [...types].every(type => type == "Switch" || type == "Progress");

        const color = getValue(baseStyle, "color");
        const backgroundColor = getValue(baseStyle, "backgroundColor");
        const activeColor = getValue(baseStyle, "activeColor");
        const activeBackgroundColor = getValue(
            baseStyle,
            "activeBackgroundColor"
        );

        if (
            (baseStyle.activeColor !== undefined ||
                baseStyle.activeBackgroundColor !== undefined) &&
            !isOnlySwitchOrProgress
        ) {
            const [swappedColor, swappedBackgroundColor] = isTransparentColorJs(
                projectJs,
                backgroundColor
            )
                ? [color, backgroundColor]
                : [backgroundColor, color];
            if (
                activeColor != swappedColor ||
                activeBackgroundColor != swappedBackgroundColor
            ) {
                // can be empty: the colors stay when pressed
                const props: any = {};
                if (activeColor != color) {
                    props.color = activeColor;
                }
                if (activeBackgroundColor != backgroundColor) {
                    props.backgroundColor = activeBackgroundColor;
                }
                addStateStyle(baseStyle, "pressed", props);
            }
        }

        if (
            isSwitchOrProgress &&
            ((types.has("Switch") && activeBackgroundColor != backgroundColor) ||
                (types.has("Progress") && activeBackgroundColor != color))
        ) {
            addStateStyle(baseStyle, "checked", {
                backgroundColor: activeBackgroundColor
            });
        }

        if (
            baseStyle.focusColor !== undefined ||
            baseStyle.focusBackgroundColor !== undefined
        ) {
            const focusColor = getValue(baseStyle, "focusColor");
            const focusBackgroundColor = getValue(
                baseStyle,
                "focusBackgroundColor"
            );
            if (types.has("ScrollBar")) {
                addStateStyle(baseStyle, "focused", {
                    focusRingWidth: 2,
                    focusRingOffset: 0,
                    focusRingColor: focusColor
                });
            } else if (
                focusColor != color ||
                focusBackgroundColor != backgroundColor
            ) {
                const props: any = {};
                if (focusColor != color) {
                    props.color = focusColor;
                }
                if (focusBackgroundColor != backgroundColor) {
                    props.backgroundColor = focusBackgroundColor;
                }
                addStateStyle(baseStyle, "focused", props);
            }
        }
    }

    const stateNames = stateStyleProperties
        .map(propertyInfo => propertyInfo.name)
        .filter(name => OLD_STATE_COLOR_PROPERTIES.indexOf(name) == -1);

    for (const widget of widgets) {
        for (const [propertyName, state] of Object.entries(
            OLD_WIDGET_STATE_STYLES
        )) {
            const stateStyleJs = widget[propertyName];
            if (stateStyleJs === undefined) {
                continue;
            }
            delete widget[propertyName];

            if (!stateStyleJs || typeof stateStyleJs != "object") {
                continue;
            }
            const ownNames = stateNames.filter(
                name => stateStyleJs[name] !== undefined
            );
            if (
                (!stateStyleJs.useStyle || stateStyleJs.useStyle == "default") &&
                ownNames.length == 0
            ) {
                continue;
            }

            const baseStyle = byName.get(widget.style.useStyle);
            if (!baseStyle || baseStyle.state) {
                continue;
            }
            const usedStyle = stateStyleJs.useStyle
                ? byName.get(stateStyleJs.useStyle)
                : undefined;

            const props: any = {};
            for (const name of stateNames) {
                const value =
                    stateStyleJs[name] !== undefined
                        ? stateStyleJs[name]
                        : usedStyle
                          ? getValue(usedStyle, name)
                          : getValue(baseStyle, name);
                if (value !== getValue(baseStyle, name)) {
                    props[name] = value;
                }
            }
            if (Object.keys(props).length > 0) {
                addStateStyle(baseStyle, state, props);
            }
        }

        delete widget.focusStyle;
    }

    for (const style of [...styles, ...pageStyles]) {
        for (const name of OLD_STATE_COLOR_PROPERTIES) {
            delete style[name];
        }
    }

    if (newStateStyles.size > 0) {
        const result: any[] = [];
        for (let i = 0; i < styles.length; i++) {
            const style = styles[i];
            result.push(style);
            const stateStyles = newStateStyles.get(style);
            if (stateStyles) {
                // after the state styles of the style
                while (
                    i + 1 < styles.length &&
                    styles[i + 1].state &&
                    styles[i + 1].useStyle == style.name
                ) {
                    result.push(styles[++i]);
                }
                result.push(...stateStyles);
            }
        }
        projectJs.styles = result;
    }
}

// The project styles of an older EEZ-GUI v3 project (a tree of styles that
// inherit from their parent style or from the style in "useStyle", with child
// styles for the states) as a flat list of complete styles, in the order of the
// tree (depth first):
// - each style gets the properties it inherited as its own
// - each style gets its state styles right after it: a state style has the
//   state, uses the style ("useStyle") and has the properties of the state the
//   style had (from the state child styles of the style and of the styles it
//   inherited from, the nearest one wins, see Style.stateDeltas before). A
//   state child style of the style itself is kept, the others are new styles
//   named <style>_<state>.
// masterStyles: the (flat) styles of the master project, for the styles that
// use one of them. Called with the project JSON before the project is loaded;
// the widget styles keep their "useStyle".
export function flattenEezGuiStylesJs(
    projectJs: any,
    masterStyles: any[] | undefined
) {
    if (!hasStyleInheritanceJs(projectJs.styles)) {
        return;
    }

    const list: { style: any; parent: any }[] = [];
    const byName = new Map<string, any>();

    function collect(styles: any[], parent: any) {
        for (const style of styles) {
            list.push({ style, parent });
            if (style.name != undefined && !byName.has(style.name)) {
                byName.set(style.name, style);
            }
            if (Array.isArray(style.childStyles)) {
                collect(style.childStyles, style);
            }
        }
    }
    collect(projectJs.styles, undefined);

    const masterByName = new Map<string, any>();
    for (const style of masterStyles ?? []) {
        if (style.name != undefined && !masterByName.has(style.name)) {
            masterByName.set(style.name, style);
        }
    }

    const findByName = (name: string) =>
        byName.get(name) ?? masterByName.get(name);

    const parents = new Map(list.map(({ style, parent }) => [style, parent]));

    const getBase = (style: any) =>
        style.useStyle
            ? findByName(style.useStyle)
            : parents.get(style);

    // the state styles of a style: its child styles with a state and the
    // styles with a state that use it
    const stateStylesOf = new Map<any, any[]>();
    const addStateStyle = (baseStyle: any, stateStyle: any) => {
        let stateStyles = stateStylesOf.get(baseStyle);
        if (!stateStyles) {
            stateStyles = [];
            stateStylesOf.set(baseStyle, stateStyles);
        }
        stateStyles.push(stateStyle);
    };
    // the base style of a state style is the one in "useStyle" (a state
    // child style in the older format has its parent style)
    for (const { style, parent } of list) {
        if (style.state) {
            const baseStyle = style.useStyle
                ? findByName(style.useStyle)
                : parent;
            if (baseStyle) {
                addStateStyle(baseStyle, style);
            }
        }
    }
    for (const style of masterStyles ?? []) {
        if (style.state && style.useStyle) {
            const baseStyle = masterByName.get(style.useStyle);
            if (baseStyle) {
                addStateStyle(baseStyle, style);
            }
        }
    }

    // undefined: the default value (also for an inheritance cycle)
    const resolve = (style: any, propertyName: string) => {
        const visited = new Set<any>();
        for (let s = style; s && !visited.has(s); s = getBase(s)) {
            visited.add(s);
            if (s[propertyName] !== undefined) {
                return s[propertyName];
            }
        }
        return undefined;
    };

    const inheritable = properties
        .filter(propertyInfo => propertyInfo.inheritable)
        .map(propertyInfo => propertyInfo.name);
    const stateNames = stateStyleProperties.map(
        propertyInfo => propertyInfo.name
    );

    // all values before any style is changed
    const results = list
        .filter(({ style }) => !style.state)
        .map(({ style }) => {
            const values = inheritable.map(propertyName =>
                resolve(style, propertyName)
            );

            const deltas: { [state: string]: { [name: string]: any } } = {};
            const visited = new Set<any>();
            for (let s = style; s && !visited.has(s); s = getBase(s)) {
                visited.add(s);
                for (const stateStyle of stateStylesOf.get(s) ?? []) {
                    let delta = deltas[stateStyle.state];
                    if (!delta) {
                        delta = {};
                        deltas[stateStyle.state] = delta;
                    }
                    for (const propertyName of stateNames) {
                        if (
                            stateStyle[propertyName] !== undefined &&
                            !(propertyName in delta)
                        ) {
                            delta[propertyName] = stateStyle[propertyName];
                        }
                    }
                }
            }

            return { style, values, deltas };
        });

    const names = new Set([...byName.keys(), ...masterByName.keys()]);
    const getUniqueName = (name: string) => {
        let uniqueName = name;
        for (let i = 2; names.has(uniqueName); i++) {
            uniqueName = `${name}_${i}`;
        }
        names.add(uniqueName);
        return uniqueName;
    };

    const ownStyles = new Set(list.map(({ style }) => style));
    const usedStateStyles = new Set<any>();
    const styles: any[] = [];

    for (const { style, values, deltas } of results) {
        inheritable.forEach((propertyName, i) => {
            if (values[i] === undefined) {
                delete style[propertyName];
            } else {
                style[propertyName] = values[i];
            }
        });
        delete style.useStyle;
        delete style.childStyles;
        styles.push(style);

        for (const state of STYLE_STATES) {
            const delta = deltas[state];
            if (!delta) {
                continue;
            }

            let stateStyle = (stateStylesOf.get(style) ?? []).find(
                stateStyle =>
                    stateStyle.state == state &&
                    ownStyles.has(stateStyle) &&
                    !usedStateStyles.has(stateStyle)
            );
            if (!stateStyle) {
                stateStyle = {
                    name: getUniqueName(`${style.name}_${state}`),
                    state
                };
            }
            usedStateStyles.add(stateStyle);

            for (const propertyName of stateNames) {
                delete stateStyle[propertyName];
            }
            Object.assign(stateStyle, delta);
            stateStyle.useStyle = style.name;
            delete stateStyle.childStyles;
            styles.push(stateStyle);
        }
    }

    // the state styles that are no state of a style of this project are kept
    for (const { style, parent } of list) {
        if (style.state && !usedStateStyles.has(style)) {
            if (!style.useStyle && parent) {
                style.useStyle = parent.name;
            }
            delete style.childStyles;
            styles.push(style);
        }
    }

    projectJs.styles = styles;
}

function isWidgetParentOfStyle(object: IEezObject) {
    while (true) {
        if (object instanceof ProjectEditor.ComponentClass) {
            return true;
        }
        if (!getParent(object)) {
            return false;
        }
        object = getParent(object);
    }
}

function openCssHelpPage(cssAttributeName: string) {
    const { shell } = require("electron");
    shell.openExternal(
        `https://developer.mozilla.org/en-US/docs/Web/CSS/${
            cssAttributeName != "css" ? cssAttributeName : ""
        }`
    );
}

function getInheritedValue(
    styleObject: Style,
    propertyName: string,
    translateThemedColors?: boolean
): InheritedValue {
    function getInheritedValue(
        styleObject: Style,
        propertyName: string,
        translateThemedColors: boolean | undefined,
        visited: Style[]
    ): InheritedValue {
        if (visited.indexOf(styleObject) != -1) {
            return undefined;
        }

        visited.push(styleObject);

        if (translateThemedColors == undefined) {
            translateThemedColors = true;
        }

        let value = getProperty(styleObject, propertyName);
        if (value !== undefined) {
            if (
                translateThemedColors &&
                (propertyName === "color" ||
                    propertyName === "backgroundColor" ||
                    propertyName === "activeColor" ||
                    propertyName === "activeBackgroundColor" ||
                    propertyName === "focusColor" ||
                    propertyName === "focusBackgroundColor" ||
                    propertyName === "borderColor" ||
                    propertyName === "focusRingColor" ||
                    propertyName === "shadowColor")
            ) {
                value = getThemedColor(
                    getProjectStore(styleObject),
                    value
                ).colorValue;
            }

            return {
                value: value,
                source: styleObject
            };
        }

        if (styleObject.parentStyle) {
            return getInheritedValue(
                styleObject.parentStyle,
                propertyName,
                translateThemedColors,
                visited
            );
        }

        return {
            value: getProjectStore(styleObject).projectTypeTraits.isDashboard
                ? undefined
                : propertiesMap[propertyName]?.defaultValue,
            source: undefined
        };
    }

    return getInheritedValue(
        styleObject,
        propertyName,
        translateThemedColors,
        []
    );
}

export function getStyleProperty(
    style: Style,
    propertyName: string,
    translateThemedColors?: boolean
): any {
    let inheritedValue = getInheritedValue(
        style,
        propertyName,
        translateThemedColors
    );

    return inheritedValue?.value;
}

export function getAdditionalStyleFlowProperties(widget: Widget) {
    const additionalProperties: PropertyInfo[] = [];

    const classInfo = getClassInfo(widget);

    for (const propertyInfo of classInfo.properties) {
        if (
            propertyInfo.type == PropertyType.Object &&
            propertyInfo.typeClass == Style
        ) {
            const style = (widget as any)[propertyInfo.name] as Style;
            // an optional style (e.g. the disabled style of a Button in an
            // EEZ-GUI v3 project)
            if (!style) {
                continue;
            }

            if (style.conditionalStyles) {
                for (
                    let index = 0;
                    index < style.conditionalStyles.length;
                    index++
                ) {
                    additionalProperties.push(
                        Object.assign({}, conditionalStyleConditionProperty, {
                            name: `${propertyInfo.name}.${conditionalStylesProperty.name}[${index}].${conditionalStyleConditionProperty.name}`
                        })
                    );
                }
            }

            if (style.dynamicCSS) {
                additionalProperties.push(
                    Object.assign({}, dynamicCssProperty, {
                        name: `${propertyInfo.name}.${dynamicCssProperty.name}`
                    })
                );
            }
        }
    }

    return additionalProperties;
}

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-style",
    version: "0.1.0",
    description: "Styles support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Styles",
    mandatory: true,
    key: "styles",
    type: PropertyType.Array,
    typeClass: Style,
    icon: "material:format_color_fill",
    create: () => [],
    // the project styles of the eez-gui-lite and EEZ-GUI v3 projects don't
    // inherit: the styles of an older project are flattened
    fromJsHook: (projectJs: any) => {
        if (projectJs?.settings?.general?.projectType == "eez-gui-lite") {
            ProjectEditor.LiteStyleClass.flattenStylesJs(projectJs);
        } else {
            convertEezGuiProjectStylesJs(projectJs);
        }
    },
    check: (projectStore, object: EezObject[], messages: IMessage[]) => {
        const projects = getAllProjectsWithThemes(projectStore);
        if (projects.length > 1) {
            const projectNames = projects.map(project =>
                path.basename(
                    projectStore.openProjectsManager.getProjectFilePath(
                        project
                    )!
                )
            );

            messages.push(
                new Message(
                    MessageType.ERROR,
                    `Themes are defined in multiple projects: ${projectNames.join(
                        ", "
                    )}`
                )
            );
        }
    },
    afterLoadProject: (project: Project) => {
        if (project.themes) {
            const themes = project.themes;
            const colors = project.colors!;
            for (const theme of themes) {
                for (let i = 0; i < colors.length; i++) {
                    project.setThemeColor(
                        theme.objID,
                        colors[i].objID,
                        theme.colors![i]
                    );
                }
            }
        }
    },
    toJsHook: (jsObject: Project, project: Project) => {
        jsObject.themes.forEach((theme: ITheme, i: number) => {
            theme.colors = project.themes[i].colors;
        });
    }
};

export default feature;
