// The style of the eez-gui-lite projects: the properties eez-gui-lite draws
// (eezgui_style_t in eez-gui-lite.h). A copy of the EEZ-GUI Style
// (features/style/style.tsx) with only these properties, so the EEZ-GUI styles
// can change without changing eez-gui-lite. The project styles of an
// eez-gui-lite project and the styles of its widgets (eez-gui-lite/widgets.tsx)
// are of this class (see LiteStyle.classInfo.getClass and Style.classInfo.getClass).
//
// The project styles are a flat list of complete styles: no child styles and
// no "useStyle". A widget style uses one project style ("useStyle") and can
// change some of its properties. Older projects are flattened when loaded
// (flattenLiteStylesJs).

import { computed, makeObservable, observable } from "mobx";
import { MenuItem } from "@electron/remote";

import { isValid, strToColor16 } from "eez-studio-shared/color";
import { validators } from "eez-studio-shared/validation";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    EezObject,
    getParent,
    getProperty,
    IEezObject,
    IMessage,
    InheritedValue,
    MessageType,
    PropertyInfo,
    PropertyProps,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { makeTagsProperty } from "project-editor/core/tags";
import { keepAliveComputed } from "project-editor/core/keep-alive";
import {
    createObject,
    getChildOfObject,
    getProjectStore,
    isAnyPropertyModified,
    Message,
    propertyInvalidValueMessage,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    updateObject,
    type ProjectStore
} from "project-editor/store";
import { getSerializationOrStoreProject } from "project-editor/store/serialization";
import { getThemedColor } from "project-editor/features/style/theme";
import { ColorFormat } from "project-editor/features/style/color-format";
import type { Font } from "project-editor/features/font/font";
import {
    findFont,
    findStyle,
    type Project
} from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

// true if the project that is loaded, or the project of the store when no
// project is loaded, is an eez-gui-lite project
export function isEezGuiLiteProjectStore(projectStore: ProjectStore) {
    return !!getSerializationOrStoreProject(projectStore)?.projectTypeTraits
        .isEezGuiLite;
}

function findLiteStyle(project: Project, styleName: string | undefined) {
    return findStyle(project, styleName) as unknown as LiteStyle | undefined;
}

////////////////////////////////////////////////////////////////////////////////

const backgroundColorPropertyMenu = (
    props: PropertyProps
): Electron.MenuItem[] => [
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
];

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

// the style of a widget (not one of the project styles)
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

const nameProperty: PropertyInfo = {
    name: "name",
    type: PropertyType.String,
    unique: (
        style: LiteStyle,
        parent: LiteStyle | Project,
        propertyInfo?: PropertyInfo
    ) => {
        const oldIdentifier = propertyInfo
            ? getProperty(style, propertyInfo.name)
            : undefined;

        return styleNameUnique(parent, oldIdentifier);
    },
    disabled: isWidgetParentOfStyle
};

const tagsProperty: PropertyInfo = {
    ...makeTagsProperty(),
    // widget style is not listed in the Project Explorer
    hideInPropertyGrid: isWidgetParentOfStyle
};

const descriptionProperty: PropertyInfo = {
    name: "description",
    type: PropertyType.MultilineText,
    disabled: isWidgetParentOfStyle
};

// only in the widget styles, the project styles don't inherit
const useStyleProperty: PropertyInfo = {
    name: "useStyle",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "allStyles",
    disabled: (style: LiteStyle) => !isWidgetParentOfStyle(style),
    propertyMenu: (props: PropertyProps): Electron.MenuItem[] => {
        const projectStore = getProjectStore(props.objects[0]);

        let menuItems: Electron.MenuItem[] = [];

        if (!isAnyPropertyModified(props)) {
            return menuItems;
        }

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

        if (props.objects.length !== 1) {
            return menuItems;
        }

        const object = props.objects[0] as LiteStyle;

        menuItems.push(
            new MenuItem({
                label: "Create New Style",
                click: async () => {
                    const result = await showGenericDialog({
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
                                            projectStore.project.allStyles
                                        )
                                    ]
                                }
                            ]
                        },
                        values: {}
                    });

                    projectStore.undoManager.setCombineCommands(true);

                    const stylePropertyValues: any = {};
                    const objectPropertyValues: any = {};

                    properties.forEach(propertyInfo => {
                        stylePropertyValues[propertyInfo.name] = getProperty(
                            object,
                            propertyInfo.name
                        );

                        objectPropertyValues[propertyInfo.name] = undefined;
                    });

                    stylePropertyValues.name = result.values.name;

                    objectPropertyValues.useStyle = result.values.name;

                    projectStore.addObject(
                        projectStore.project.styles,
                        createObject<LiteStyle>(
                            projectStore,
                            stylePropertyValues,
                            LiteStyle
                        )
                    );
                    projectStore.updateObject(object, objectPropertyValues);

                    projectStore.undoManager.setCombineCommands(false);
                }
            })
        );

        const style = object.parentStyle;
        if (style) {
            menuItems.push(
                new MenuItem({
                    label: "Update Style",
                    click: () => {
                        projectStore.undoManager.setCombineCommands(true);

                        const stylePropertyValues: any = {};
                        const objectPropertyValues: any = {};
                        properties.forEach(propertyInfo => {
                            if (
                                propertyInfo.inheritable &&
                                getProperty(object, propertyInfo.name) !==
                                    undefined
                            ) {
                                stylePropertyValues[propertyInfo.name] =
                                    getProperty(object, propertyInfo.name);

                                objectPropertyValues[propertyInfo.name] =
                                    undefined;
                            }
                        });

                        projectStore.updateObject(style, stylePropertyValues);
                        projectStore.updateObject(object, objectPropertyValues);

                        projectStore.undoManager.setCombineCommands(false);
                    }
                })
            );
        }

        return menuItems;
    }
};

const fontProperty: PropertyInfo = {
    name: "font",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "fonts",
    defaultValue: undefined,
    inheritable: true
};

const alignHorizontalProperty: PropertyInfo = {
    name: "alignHorizontal",
    type: PropertyType.Enum,
    enumItems: [{ id: "center" }, { id: "left" }, { id: "right" }],
    defaultValue: "center",
    inheritable: true
};

const alignVerticalProperty: PropertyInfo = {
    name: "alignVertical",
    type: PropertyType.Enum,
    enumItems: [{ id: "center" }, { id: "top" }, { id: "bottom" }],
    defaultValue: "center",
    inheritable: true
};

const colorProperty: PropertyInfo = {
    name: "color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true
};

const backgroundColorProperty: PropertyInfo = {
    name: "backgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    propertyMenu: backgroundColorPropertyMenu
};

const activeColorProperty: PropertyInfo = {
    name: "activeColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true
};

const activeBackgroundColorProperty: PropertyInfo = {
    name: "activeBackgroundColor",
    displayName: "Active back. color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    propertyMenu: backgroundColorPropertyMenu
};

const borderSizeProperty: PropertyInfo = {
    name: "borderSize",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const borderColorProperty: PropertyInfo = {
    name: "borderColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true
};

const paddingProperty: PropertyInfo = {
    name: "padding",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const blinkProperty: PropertyInfo = {
    name: "blink",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: true,
    checkboxStyleSwitch: true
};

const alwaysBuildProperty: PropertyInfo = {
    name: "alwaysBuild",
    displayName: "Always add to the generated code",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: false,
    disabled: isWidgetParentOfStyle
};

const properties = [
    nameProperty,
    tagsProperty,
    descriptionProperty,
    useStyleProperty,
    fontProperty,
    alignHorizontalProperty,
    alignVerticalProperty,
    colorProperty,
    backgroundColorProperty,
    activeColorProperty,
    activeBackgroundColorProperty,
    borderSizeProperty,
    borderColorProperty,
    paddingProperty,
    blinkProperty,
    alwaysBuildProperty
];

const propertiesMap: { [propertyName: string]: PropertyInfo } = {};
for (const property of properties) {
    propertiesMap[property.name] = property;
}

const COLOR_PROPERTY_NAMES = [
    "color",
    "backgroundColor",
    "activeColor",
    "activeBackgroundColor",
    "borderColor"
];

////////////////////////////////////////////////////////////////////////////////

export class LiteStyle extends EezObject {
    // see flattenLiteStylesJs (called through ProjectEditor.LiteStyleClass,
    // an import would change the order in which the modules are loaded)
    static flattenStylesJs(projectJs: any) {
        flattenLiteStylesJs(projectJs);
    }

    name: string;
    tags?: string;
    description?: string;
    useStyle?: string;
    alwaysBuild: boolean;

    font?: string;
    alignHorizontal?: string;
    alignVertical?: string;
    color?: string;
    backgroundColor?: string;
    activeColor?: string;
    activeBackgroundColor?: string;
    borderSize?: string;
    borderColor?: string;
    padding?: string;
    blink?: boolean;

    constructor() {
        super();

        makeObservable(this, {
            fontName: computed,
            fontObject: computed,
            borderSizeProperty: keepAliveComputed(),
            borderSizeRect: keepAliveComputed(),
            alignHorizontalProperty: keepAliveComputed(),
            alignVerticalProperty: keepAliveComputed(),
            colorProperty: keepAliveComputed(),
            color16: keepAliveComputed(),
            backgroundColorProperty: keepAliveComputed(),
            backgroundColor16: keepAliveComputed(),
            activeColorProperty: keepAliveComputed(),
            activeColor16: keepAliveComputed(),
            activeBackgroundColorProperty: keepAliveComputed(),
            activeBackgroundColor16: keepAliveComputed(),
            borderColorProperty: keepAliveComputed(),
            borderColor16: keepAliveComputed(),
            paddingProperty: keepAliveComputed(),
            paddingRect: keepAliveComputed(),
            blinkProperty: keepAliveComputed()
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            tags: observable,
            description: observable,
            useStyle: observable,
            alwaysBuild: observable,
            font: observable,
            alignHorizontal: observable,
            alignVertical: observable,
            color: observable,
            backgroundColor: observable,
            activeColor: observable,
            activeBackgroundColor: observable,
            borderSize: observable,
            borderColor: observable,
            padding: observable,
            blink: observable
        });
    }

    static classInfo: ClassInfo = {
        properties,
        // a style pasted into a project that is not an eez-gui-lite project
        // is an EEZ-GUI style
        getClass: (projectStore: ProjectStore) =>
            isEezGuiLiteProjectStore(projectStore)
                ? LiteStyle
                : ProjectEditor.StyleClass,
        propertiesPanelLabel: (style: LiteStyle) => {
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
                values: {},
                modal: true,
                backdrop: "static"
            });

            const project = ProjectEditor.getProject(parent);

            return createObject<LiteStyle>(
                project._store,
                { name: result.values.name },
                LiteStyle
            );
        },
        getInheritedValue: (styleObject: LiteStyle, propertyName: string) =>
            getInheritedValue(styleObject, propertyName, false),
        icon: "material:format_color_fill",
        defaultValue: {},
        check: (style: LiteStyle, messages: IMessage[]) => {
            const projectStore = getProjectStore(style);

            for (const propertyName of COLOR_PROPERTY_NAMES) {
                const color = (style as any)[propertyName];
                if (
                    color &&
                    !isValid(getThemedColor(projectStore, color).colorValue)
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `invalid color`,
                            getChildOfObject(style, propertyName)
                        )
                    );
                }
            }

            if (style.useStyle && !findStyle(projectStore.project, style.useStyle)) {
                messages.push(propertyNotFoundMessage(style, "useStyle"));
                return;
            }

            if (!style.fontName) {
                messages.push(propertyNotSetMessage(style, "font"));
            } else if (!style.fontObject) {
                messages.push(propertyNotFoundMessage(style, "font"));
            }

            const borderSizeError = LiteStyle.getRect(
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

            const alignHorizontal = style.alignHorizontalProperty;
            if (
                alignHorizontal &&
                alignHorizontal != "left" &&
                alignHorizontal != "center" &&
                alignHorizontal != "right"
            ) {
                messages.push(
                    propertyInvalidValueMessage(style, "alignHorizontal")
                );
            }

            const alignVertical = style.alignVerticalProperty;
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
                messages.push(propertyInvalidValueMessage(style, "color"));
            }

            if (isNaN(style.backgroundColor16)) {
                messages.push(
                    propertyInvalidValueMessage(style, "backgroundColor")
                );
            }

            if (isNaN(style.activeColor16)) {
                messages.push(propertyInvalidValueMessage(style, "activeColor"));
            }

            if (isNaN(style.activeBackgroundColor16)) {
                messages.push(
                    propertyInvalidValueMessage(style, "activeBackgroundColor")
                );
            }

            if (isNaN(style.borderColor16)) {
                messages.push(propertyInvalidValueMessage(style, "borderColor"));
            }

            const paddingError = LiteStyle.getRect(style.paddingProperty).error;
            if (paddingError) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `"Padding": ${paddingError}.`,
                        getChildOfObject(style, "padding")
                    )
                );
            }
        }
    };

    // the project style a widget style uses
    get parentStyle(): LiteStyle | undefined {
        if (this.useStyle) {
            return findLiteStyle(ProjectEditor.getProject(this), this.useStyle);
        }
        return undefined;
    }

    get fontName(): string {
        return getLiteStyleProperty(this, "font");
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

    // "top right bottom left" with 1 to 4 values from 0 to 255
    static getRect(value: string) {
        let error;
        let top = 0;
        let right = 0;
        let bottom = 0;
        let left = 0;

        const parse = (text: string, label: string) => {
            const value = parseInt(text);
            if (!Number.isFinite(value)) {
                error = `${label}value is not a valid number`;
            } else if (value < 0 || value > 255) {
                error = `${label}value must be >= 0 && <= 255`;
            } else {
                return value;
            }
            return 0;
        };

        if (value !== undefined) {
            if (typeof value === "number") {
                top = right = bottom = left = parse(value, "");
            } else if (typeof value === "string") {
                const x = value.trim().split(/\W+/);

                if (x.length === 1) {
                    top = right = bottom = left = parse(x[0], "");
                } else if (x.length === 2) {
                    top = bottom = parse(x[0], `"top/bottom" `);
                    right = left = parse(x[1], `"right/left" `);
                } else if (x.length === 3) {
                    top = left = parse(x[0], `"top/left" `);
                    right = parse(x[1], `"right" `);
                    bottom = parse(x[2], `"bottom" `);
                } else if (x.length === 4) {
                    top = parse(x[0], `"top" `);
                    right = parse(x[1], `"right" `);
                    bottom = parse(x[2], `"bottom" `);
                    left = parse(x[3], `"left" `);
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

    get borderSizeProperty(): string {
        return getLiteStyleProperty(this, "borderSize");
    }

    get borderSizeRect() {
        return LiteStyle.getRect(this.borderSizeProperty).rect;
    }

    get alignHorizontalProperty(): string {
        return getLiteStyleProperty(this, "alignHorizontal");
    }

    get alignVerticalProperty(): string {
        return getLiteStyleProperty(this, "alignVertical");
    }

    getColorStyleProperty(propertyName: string) {
        const color = getLiteStyleProperty(this, propertyName);
        if (
            color == undefined ||
            color == "transparent" ||
            color == "rgba(0, 0, 0, 0)"
        ) {
            return color;
        }
        const colorFormat = ColorFormat.parse(
            color,
            ProjectEditor.getProject(this)
        );
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

    get borderColorProperty(): string {
        return this.getColorStyleProperty("borderColor");
    }

    get borderColor16(): number {
        return strToColor16(this.borderColorProperty);
    }

    get paddingProperty(): string {
        return getLiteStyleProperty(this, "padding");
    }

    get paddingRect() {
        return LiteStyle.getRect(this.paddingProperty).rect;
    }

    get blinkProperty(): boolean {
        return getLiteStyleProperty(this, "blink");
    }

    // true if both styles give the same eezgui_style_t
    compareTo(otherStyle: LiteStyle): boolean {
        return (
            this.fontName === otherStyle.fontName &&
            this.alignHorizontalProperty ===
                otherStyle.alignHorizontalProperty &&
            this.alignVerticalProperty === otherStyle.alignVerticalProperty &&
            this.colorProperty === otherStyle.colorProperty &&
            this.backgroundColorProperty ===
                otherStyle.backgroundColorProperty &&
            this.activeColorProperty === otherStyle.activeColorProperty &&
            this.activeBackgroundColorProperty ===
                otherStyle.activeBackgroundColorProperty &&
            this.borderSizeProperty === otherStyle.borderSizeProperty &&
            this.borderColorProperty === otherStyle.borderColorProperty &&
            this.paddingProperty === otherStyle.paddingProperty &&
            this.blinkProperty === otherStyle.blinkProperty
        );
    }
}

registerClass("LiteStyle", LiteStyle);

////////////////////////////////////////////////////////////////////////////////

function getInheritedValue(
    styleObject: LiteStyle,
    propertyName: string,
    translateThemedColors?: boolean
): InheritedValue {
    const visited: LiteStyle[] = [];

    if (translateThemedColors == undefined) {
        translateThemedColors = true;
    }

    for (
        let style: LiteStyle | undefined = styleObject;
        style && visited.indexOf(style) == -1;
        style = style.parentStyle
    ) {
        visited.push(style);

        let value = getProperty(style, propertyName);
        if (value !== undefined) {
            if (
                translateThemedColors &&
                COLOR_PROPERTY_NAMES.indexOf(propertyName) != -1
            ) {
                value = getThemedColor(getProjectStore(style), value)
                    .colorValue;
            }

            return {
                value: value,
                source: style
            };
        }
    }

    if (visited.length > 0 && visited[visited.length - 1].parentStyle) {
        // inheritance cycle
        return undefined;
    }

    return {
        value: propertiesMap[propertyName]?.defaultValue,
        source: undefined
    };
}

// the value of the style property, from the project style a widget style uses
// if the widget style doesn't change it
export function getLiteStyleProperty(
    style: LiteStyle,
    propertyName: string,
    translateThemedColors?: boolean
): any {
    return getInheritedValue(style, propertyName, translateThemedColors)
        ?.value;
}

////////////////////////////////////////////////////////////////////////////////

// The project styles of an older eez-gui-lite project (a tree of styles that
// inherit from their parent style or from the style in "useStyle") as a flat
// list of complete styles, in the order of the tree (depth first): each style
// gets the properties it inherited as its own. Called with the project JSON
// before the project is loaded; the widget styles keep their "useStyle".
export function flattenLiteStylesJs(projectJs: any) {
    if (!Array.isArray(projectJs.styles)) {
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

    const parents = new Map(list.map(({ style, parent }) => [style, parent]));

    const getBase = (style: any) =>
        style.useStyle
            ? byName.get(style.useStyle)
            : parents.get(style);

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

    // all values before any style is changed
    const resolved = list.map(({ style }) =>
        inheritable.map(propertyName => resolve(style, propertyName))
    );

    list.forEach(({ style }, i) => {
        inheritable.forEach((propertyName, j) => {
            if (resolved[i][j] === undefined) {
                delete style[propertyName];
            } else {
                style[propertyName] = resolved[i][j];
            }
        });
        delete style.useStyle;
        delete style.childStyles;
    });

    projectJs.styles = list.map(({ style }) => style);
}
