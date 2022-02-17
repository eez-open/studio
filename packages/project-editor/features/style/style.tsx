import { observable, computed, makeObservable } from "mobx";
import { css } from "@emotion/css";

import { _map, _zipObject } from "eez-studio-shared/algorithm";
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
    getParent
} from "project-editor/core/object";
import {
    getChildOfObject,
    isDashboardProject,
    isNotDashboardProject,
    isV1Project,
    isV3OrNewerProject,
    isAnyPropertyModified,
    Message,
    propertyInvalidValueMessage,
    propertyNotFoundMessage,
    propertyNotUniqueMessage,
    updateObject
} from "project-editor/core/store";
import { getDocumentStore } from "project-editor/core/store";
import { validators } from "eez-studio-shared/validation";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { findFont } from "project-editor/features/font/font";
import { getThemedColor } from "project-editor/features/style/theme";
import type { Font } from "project-editor/features/font/font";
import { metrics } from "project-editor/features/style/metrics";
import type { Project } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { MenuItem } from "@electron/remote";

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

const idProperty: PropertyInfo = {
    name: "id",
    type: PropertyType.Number,
    inheritable: false,
    isOptional: true,
    unique: true,
    hideInPropertyGrid: style =>
        isWidgetParentOfStyle(style) || isDashboardProject(style),
    defaultValue: undefined
};

const nameProperty: PropertyInfo = {
    name: "name",
    type: PropertyType.String,
    unique: true,
    hideInPropertyGrid: isWidgetParentOfStyle
};

const descriptionProperty: PropertyInfo = {
    name: "description",
    type: PropertyType.MultilineText,
    hideInPropertyGrid: isWidgetParentOfStyle
};

const inheritFromProperty: PropertyInfo = {
    name: "inheritFrom",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "styles",
    propertyMenu: (props: PropertyProps): Electron.MenuItem[] => {
        const DocumentStore = getDocumentStore(props.objects[0]);

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
                                                    DocumentStore.project.styles
                                                )
                                            ]
                                        }
                                    ]
                                },
                                values: {}
                            }).then(result => {
                                DocumentStore.undoManager.setCombineCommands(
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

                                objectPropertyValues.inheritFrom =
                                    result.values.name;

                                DocumentStore.addObject(
                                    DocumentStore.project.styles,
                                    stylePropertyValues
                                );
                                DocumentStore.updateObject(
                                    object,
                                    objectPropertyValues
                                );

                                DocumentStore.undoManager.setCombineCommands(
                                    false
                                );
                            });
                        }
                    })
                );

                const style = findStyle(
                    DocumentStore.project,
                    (props.objects[0] as Style).inheritFrom
                );
                if (style) {
                    menuItems.push(
                        new MenuItem({
                            label: "Update Style",
                            click: () => {
                                DocumentStore.undoManager.setCombineCommands(
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

                                DocumentStore.updateObject(
                                    style,
                                    stylePropertyValues
                                );
                                DocumentStore.updateObject(
                                    object,
                                    objectPropertyValues
                                );

                                DocumentStore.undoManager.setCombineCommands(
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

const fontProperty: PropertyInfo = {
    name: "font",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "fonts",
    defaultValue: undefined,
    inheritable: true,
    hideInPropertyGrid: isDashboardProject
};

const fontFamilyProperty: PropertyInfo = {
    name: "fontFamily",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    hideInPropertyGrid: isNotDashboardProject,
    cssAttributeName: "font-family",
    propertyMenu
};

const fontSizeProperty: PropertyInfo = {
    name: "fontSize",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    hideInPropertyGrid: isNotDashboardProject,
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
    hideInPropertyGrid: isNotDashboardProject,
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
    hideInPropertyGrid: isNotDashboardProject,
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
    defaultValue: undefined,
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
    defaultValue: undefined,
    inheritable: true
};

const colorProperty: PropertyInfo = {
    name: "color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "color",
    propertyMenu
};

const backgroundColorProperty: PropertyInfo = {
    name: "backgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: undefined,
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
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "color",
    propertyMenu,
    hideInPropertyGrid: isV1Project
};

const activeBackgroundColorProperty: PropertyInfo = {
    name: "activeBackgroundColor",
    displayName: "Active back. color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: undefined,
    inheritable: true,
    hideInPropertyGrid: isV1Project,
    cssAttributeName: "background-color",
    propertyMenu: backgroundColorPropertyMenu
};

const focusColorProperty: PropertyInfo = {
    name: "focusColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "color",
    propertyMenu,
    hideInPropertyGrid: isV1Project
};

const focusBackgroundColorProperty: PropertyInfo = {
    name: "focusBackgroundColor",
    displayName: "Focus back. color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "background-color",
    propertyMenu: backgroundColorPropertyMenu,
    hideInPropertyGrid: isV1Project
};

const borderSizeProperty: PropertyInfo = {
    name: "borderSize",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "border-width",
    propertyMenu
};

const borderRadiusProperty: PropertyInfo = {
    name: "borderRadius",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    cssAttributeName: "border-radius",
    propertyMenu
};

const borderColorProperty: PropertyInfo = {
    name: "borderColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: undefined,
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
    hideInPropertyGrid: isNotDashboardProject
};

const paddingProperty: PropertyInfo = {
    name: "padding",
    type: PropertyType.String,
    defaultValue: undefined,
    cssAttributeName: "padding",
    propertyMenu,
    inheritable: true
};

const marginProperty: PropertyInfo = {
    name: "margin",
    type: PropertyType.String,
    defaultValue: undefined,
    inheritable: true,
    hideInPropertyGrid: isV3OrNewerProject
};

const opacityProperty: PropertyInfo = {
    name: "opacity",
    type: PropertyType.Number,
    defaultValue: undefined,
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
    hideInPropertyGrid: isNotDashboardProject
};

const blinkProperty: PropertyInfo = {
    name: "blink",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: true
};

const cssProperty: PropertyInfo = {
    name: "css",
    displayName: "Additional CSS",
    type: PropertyType.CSS,
    cssAttributeName: "css",
    propertyMenu,
    hideInPropertyGrid: isNotDashboardProject
};

const cssPreviewProperty: PropertyInfo = {
    name: "cssPreview",
    displayName: "CSS preview",
    type: PropertyType.CSS,
    hideInPropertyGrid: isNotDashboardProject,
    readOnlyInPropertyGrid: true,
    computed: true
};

const alwaysBuildProperty: PropertyInfo = {
    name: "alwaysBuild",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: false,
    hideInPropertyGrid: (style: Style) =>
        isWidgetParentOfStyle(style) || isDashboardProject(style)
};

const properties = [
    idProperty,
    nameProperty,
    descriptionProperty,
    inheritFromProperty,
    fontProperty,
    fontFamilyProperty,
    fontSizeProperty,
    fontWeightProperty,
    fontStyleProperty,
    alignHorizontalProperty,
    alignVerticalProperty,
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
    cssPreviewProperty,
    alwaysBuildProperty
];

const propertiesMap: { [propertyName: string]: PropertyInfo } = _zipObject(
    _map(properties, p => p.name),
    _map(properties, p => p)
) as any;

////////////////////////////////////////////////////////////////////////////////

function getInheritedValue(
    styleObject: Style,
    propertyName: string,
    visited: Style[],
    translateThemedColors?: boolean
): InheritedValue {
    if (translateThemedColors == undefined) {
        translateThemedColors = true;
    }

    if (visited.indexOf(styleObject) != -1) {
        return undefined;
    } else {
        visited.push(styleObject);
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
            value = getThemedColor(getDocumentStore(styleObject), value);
        }

        return {
            value: value,
            source: styleObject
        };
    }

    if (styleObject.inheritFrom) {
        let inheritFromStyleObject = findStyle(
            ProjectEditor.getProject(styleObject),
            styleObject.inheritFrom
        );

        if (inheritFromStyleObject) {
            return getInheritedValue(
                inheritFromStyleObject,
                propertyName,
                visited,
                translateThemedColors
            );
        }
    }

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class Style extends EezObject {
    id: number | undefined;
    name: string;
    description?: string;
    inheritFrom?: string;
    alwaysBuild: boolean;

    font?: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    alignHorizontal?: string;
    alignVertical?: string;
    color?: string;
    backgroundColor?: string;
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

    static classInfo: ClassInfo = {
        properties,
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
        },
        isPropertyMenuSupported: true,
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Style",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        getInheritedValue: (styleObject: Style, propertyName: string) =>
            getInheritedValue(styleObject, propertyName, [], false),
        icon: "format_color_fill",
        defaultValue: {},
        check: (style: Style) => {
            let messages: Message[] = [];

            const DocumentStore = getDocumentStore(style);

            function checkColor(propertyName: string) {
                const color = (style as any)[propertyName];
                if (color) {
                    const colorValue = getThemedColor(DocumentStore, color);
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

            if (DocumentStore.project.isDashboardProject) {
                if (
                    style.inheritFrom &&
                    !findStyle(DocumentStore.project, style.inheritFrom)
                ) {
                    messages.push(
                        propertyNotFoundMessage(style, "inheritFrom")
                    );
                }

                // TODO
            } else {
                if (style.id != undefined) {
                    if (!(style.id > 0 || style.id < 32768)) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `"Id": invalid value, should be greater then 0 and less then 32768.`,
                                getChildOfObject(style, "id")
                            )
                        );
                    } else {
                        if (
                            DocumentStore.project.allStyleIdToStyleMap.get(
                                style.id
                            )!.length > 1
                        ) {
                            messages.push(
                                propertyNotUniqueMessage(style, "id")
                            );
                        }
                    }
                }

                if (
                    style.inheritFrom &&
                    !findStyle(DocumentStore.project, style.inheritFrom)
                ) {
                    messages.push(
                        propertyNotFoundMessage(style, "inheritFrom")
                    );
                } else {
                    // if (!object.fontName) {
                    //     messages.push(output.propertyNotFoundMessage(object, "font"));
                    // }

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
                        DocumentStore.project.settings.general
                            .projectVersion !== "v1"
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

            return messages;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            id: observable,
            name: observable,
            description: observable,
            inheritFrom: observable,
            alwaysBuild: observable,
            font: observable,
            fontFamily: observable,
            fontSize: observable,
            fontWeight: observable,
            fontStyle: observable,
            alignHorizontal: observable,
            alignVertical: observable,
            color: observable,
            backgroundColor: observable,
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
            css: observable,
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
            classNames: computed
        });
    }

    get fontName(): string {
        return getStyleProperty(this, "font");
    }

    get fontObject(): Font | undefined {
        if (this.font) {
            return findFont(ProjectEditor.getProject(this), this.font);
        }

        if (this.inheritFrom) {
            let inheritFromStyleObject = findStyle(
                ProjectEditor.getProject(this),
                this.inheritFrom
            );

            if (inheritFromStyleObject) {
                return getInheritedValue(inheritFromStyleObject, "fontObject", [
                    this
                ])?.value as Font;
            }
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
        const DocumentStore = getDocumentStore(this);

        let spec = [
            {
                selector: "",
                attrs: [
                    ["font-family", this.fontFamily],
                    ["font-weight", this.fontWeight],
                    ["font-style", this.fontStyle],
                    [
                        "color",
                        this.color && getThemedColor(DocumentStore, this.color)
                    ],
                    [
                        "background-color",
                        this.backgroundColor &&
                            getThemedColor(DocumentStore, this.backgroundColor)
                    ],
                    [
                        "border-color",
                        this.borderColor &&
                            getThemedColor(DocumentStore, this.borderColor)
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
                            getThemedColor(DocumentStore, this.activeColor)
                    ],
                    [
                        "background-color",
                        this.activeBackgroundColor &&
                            getThemedColor(
                                DocumentStore,
                                this.activeBackgroundColor
                            )
                    ]
                ]
            },
            {
                selector: ":focus",
                attrs: [
                    [
                        "color",
                        this.focusColor &&
                            getThemedColor(DocumentStore, this.focusColor)
                    ],
                    [
                        "background-color",
                        this.focusBackgroundColor &&
                            getThemedColor(
                                DocumentStore,
                                this.focusBackgroundColor
                            )
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

        if (this.opacity) {
            spec[0].attrs.push(["opacity", this.opacity.toString()]);
        }

        if (this.blink) {
            spec[0].attrs.push(["animation", "blinker 1s linear infinite"]);
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
        let cssPreview = "";

        if (this.inheritFrom) {
            const inheritFromStyle = findStyle(
                ProjectEditor.getProject(this),
                this.inheritFrom
            );
            if (inheritFromStyle && inheritFromStyle.cssPreview) {
                if (cssPreview) {
                    cssPreview += "\n";
                }
                cssPreview += inheritFromStyle.cssPreview;
            }
        }

        if (this.cssDeclarations) {
            if (cssPreview) {
                cssPreview += "\n";
            }
            if (this.name) {
                cssPreview += `/* ${this.name} */\n`;
            } else {
                cssPreview += `/* inline style */\n`;
            }
            cssPreview += this.cssDeclarations;
        }

        return cssPreview;
    }

    get classNames(): string[] {
        const classNames = [];

        if (isDashboardProject(this)) {
            if (this.inheritFrom) {
                const inheritFromStyle = findStyle(
                    ProjectEditor.getProject(this),
                    this.inheritFrom
                );
                if (inheritFromStyle) {
                    classNames.push(...inheritFromStyle.classNames);
                }
            }

            if (this.cssDeclarations) {
                // use &&&& to increase specificity, so this style overrides for example:
                // .EezStudio_FlowCanvasContainer.EezStudio_FlowEditorCanvasContainer .EezStudio_ComponentEnclosure.ButtonWidget button
                classNames.push(css(`&&&& { ${this.cssDeclarations} }`));
            }
        }

        return classNames;
    }
}

registerClass("Style", Style);

////////////////////////////////////////////////////////////////////////////////

export function getStyleProperty(
    style: Style,
    propertyName: string,
    translateThemedColors?: boolean
): any {
    let inheritedValue = getInheritedValue(
        style,
        propertyName,
        [],
        translateThemedColors
    );
    if (inheritedValue) {
        return inheritedValue.value;
    }

    return propertiesMap[propertyName].defaultValue;
}

////////////////////////////////////////////////////////////////////////////////

export function findStyle(project: Project, styleName: string | undefined) {
    if (styleName == undefined) {
        return undefined;
    }

    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "styles",
        styleName
    ) as Style | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-style",
    version: "0.1.0",
    description: "Styles support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Styles",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "styles",
                type: PropertyType.Array,
                typeClass: Style,
                icon: "format_color_fill",
                create: () => [],
                metrics,
                toJsHook: (jsObject: Project, project: Project) => {
                    //
                    jsObject.colors.forEach((color: any) => delete color.id);

                    jsObject.themes.forEach((theme: any, i: number) => {
                        delete theme.id;
                        theme.colors = project.themes[i].colors;
                    });

                    delete (jsObject as Partial<Project>).themeColors;
                }
            }
        }
    }
};
