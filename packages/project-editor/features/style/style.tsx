import React from "react";
import path from "path";
import { observable, computed, makeObservable } from "mobx";
import { zipObject, map } from "lodash";

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
    getKey
} from "project-editor/core/object";
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
    getAncestorOfType
} from "project-editor/store";
import {
    isDashboardProject,
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

export type BorderRadiusSpec = {
    topLeftX: number;
    topLeftY: number;
    topRightX: number;
    topRightY: number;
    bottomLeftX: number;
    bottomLeftY: number;
    bottomRightX: number;
    bottomRightY: number;
};

////////////////////////////////////////////////////////////////////////////////

export function isWidgetParentOfStyle(object: IEezObject) {
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

////////////////////////////////////////////////////////////////////////////////

function openCssHelpPage(cssAttributeName: string) {
    const { shell } = require("electron");
    shell.openExternal(
        `https://developer.mozilla.org/en-US/docs/Web/CSS/${
            cssAttributeName != "css" ? cssAttributeName : ""
        }`
    );
}

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

export class ConditionalStyle extends EezObject {
    style: string;
    condition: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "allStyles"
            }
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
                    getAncestorOfType<Widget>(
                        conditionalStyleItem,
                        ProjectEditor.WidgetClass.classInfo
                    )!,
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

const useStyleProperty: PropertyInfo = {
    name: "useStyle",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "allStyles",
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

                                properties.forEach(propertyInfo => {
                                    stylePropertyValues[propertyInfo.name] =
                                        getProperty(object, propertyInfo.name);

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
        if (
            !getAncestorOfType(object, ProjectEditor.ComponentClass.classInfo)
        ) {
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
    disabled: isV1Project
};

const activeBackgroundColorProperty: PropertyInfo = {
    name: "activeBackgroundColor",
    displayName: "Active back. color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    disabled: isV1Project,
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
    disabled: isV1Project
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
    disabled: isV1Project
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

const cssProperty: PropertyInfo = {
    name: "css",
    displayName: "Additional CSS",
    propertyNameAbove: true,
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
        propertyNameAbove: true,
        type: PropertyType.MultilineText,
        disabled: (object: IEezObject, propertyInfo: PropertyInfo) => {
            if (isNotDashboardProject(object)) {
                return true;
            }
            if (
                !getAncestorOfType(
                    object,
                    ProjectEditor.ComponentClass.classInfo
                )
            ) {
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
    propertyNameAbove: true,
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

const properties = [
    idProperty,
    nameProperty,
    descriptionProperty,
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
    cssProperty,
    dynamicCssProperty,
    cssPreviewProperty,
    alwaysBuildProperty
];

const propertiesMap: { [propertyName: string]: PropertyInfo } = zipObject(
    map(properties, p => p.name),
    map(properties, p => p)
) as any;

////////////////////////////////////////////////////////////////////////////////

let nextTransientId = 0;

export class Style extends EezObject {
    id: number | undefined;
    name: string;
    description?: string;
    useStyle?: string;
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

    css?: string;
    dynamicCSS?: string;

    _transientId: number;

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

            borderSizeProperty: computed({
                keepAlive: true
            }),

            borderSizeRect: computed({
                keepAlive: true
            }),

            borderRadiusProperty: computed({
                keepAlive: true
            }),

            borderRadiusSpec: computed({
                keepAlive: true
            }),

            alignHorizontalProperty: computed({
                keepAlive: true
            }),

            alignVerticalProperty: computed({
                keepAlive: true
            }),

            directionProperty: computed({
                keepAlive: true
            }),

            colorProperty: computed({
                keepAlive: true
            }),

            color16: computed({
                keepAlive: true
            }),

            backgroundColorProperty: computed({
                keepAlive: true
            }),

            backgroundColor16: computed({
                keepAlive: true
            }),

            backgroundImageProperty: computed({
                keepAlive: true
            }),

            activeColorProperty: computed({
                keepAlive: true
            }),

            activeColor16: computed({
                keepAlive: true
            }),

            activeBackgroundColorProperty: computed({
                keepAlive: true
            }),

            activeBackgroundColor16: computed({
                keepAlive: true
            }),

            focusColorProperty: computed({
                keepAlive: true
            }),

            focusColor16: computed({
                keepAlive: true
            }),

            focusBackgroundColorProperty: computed({
                keepAlive: true
            }),

            focusBackgroundColor16: computed({
                keepAlive: true
            }),

            borderColorProperty: computed({
                keepAlive: true
            }),

            borderColor16: computed({
                keepAlive: true
            }),

            borderStyleProperty: computed({
                keepAlive: true
            }),

            paddingProperty: computed({
                keepAlive: true
            }),

            paddingRect: computed({
                keepAlive: true
            }),

            marginProperty: computed({
                keepAlive: true
            }),

            marginRect: computed({
                keepAlive: true
            }),

            opacityProperty: computed({
                keepAlive: true
            }),

            boxShadowProperty: computed({
                keepAlive: true
            }),

            blinkProperty: computed({
                keepAlive: true
            }),

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
            description: observable,
            useStyle: observable,
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
                values: {}
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

            if (projectStore.projectTypeTraits.isDashboard) {
                if (
                    style.useStyle &&
                    !findStyle(projectStore.project, style.useStyle)
                ) {
                    messages.push(propertyNotFoundMessage(style, "useStyle"));
                }

                if (style.dynamicCSS) {
                    const widget = getAncestorOfType<Widget>(
                        style,
                        ProjectEditor.WidgetClass.classInfo
                    );
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
        showTreeCollapseIcon: "has-children"
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

    get colorProperty(): string {
        return getStyleProperty(this, "color");
    }

    get color16(): number {
        return strToColor16(this.colorProperty);
    }

    get backgroundColorProperty(): string {
        return getStyleProperty(this, "backgroundColor");
    }

    get backgroundColor16(): number {
        return strToColor16(this.backgroundColorProperty);
    }

    get backgroundImageProperty(): string {
        return getStyleProperty(this, "backgroundImage");
    }

    get activeColorProperty(): string {
        return getStyleProperty(this, "activeColor");
    }

    get activeColor16(): number {
        return strToColor16(this.activeColorProperty);
    }

    get activeBackgroundColorProperty(): string {
        return getStyleProperty(this, "activeBackgroundColor");
    }

    get activeBackgroundColor16(): number {
        return strToColor16(this.activeBackgroundColorProperty);
    }

    get focusColorProperty(): string {
        return getStyleProperty(this, "focusColor");
    }

    get focusColor16(): number {
        return strToColor16(this.focusColorProperty);
    }

    get focusBackgroundColorProperty(): string {
        return getStyleProperty(this, "focusBackgroundColor");
    }

    get focusBackgroundColor16(): number {
        return strToColor16(this.focusBackgroundColorProperty);
    }

    get borderColorProperty(): string {
        return getStyleProperty(this, "borderColor");
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
            this.blinkProperty === otherStyle.blinkProperty
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
            const widget = getAncestorOfType<Widget>(
                this,
                ProjectEditor.WidgetClass.classInfo
            );
            if (widget) {
                this.conditionalStyles.forEach((conditionalStyle, index) => {
                    let condition =
                        ProjectEditor.evalProperty(
                            flowContext,
                            widget,
                            `${getKey(this)}.${
                                conditionalStylesProperty.name
                            }[${index}].${
                                ProjectEditor.conditionalStyleConditionProperty
                                    .name
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
            const widget = getAncestorOfType<Widget>(
                this,
                ProjectEditor.WidgetClass.classInfo
            );
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
                    propertyName === "borderColor")
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
