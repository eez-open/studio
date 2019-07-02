import { _map, _zipObject } from "eez-studio-shared/algorithm";

import { observable, computed } from "mobx";

import { strToColor16 } from "eez-studio-shared/color";

import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    EezObject,
    InheritedValue,
    PropertyType,
    getProperty,
    isObjectInstanceOf,
    findClass,
    getChildOfObject,
    MessageType
} from "eez-studio-shared/model/object";
import { loadObject } from "eez-studio-shared/model/serialization";
import * as output from "eez-studio-shared/model/output";

import { getPageContext } from "eez-studio-page-editor/page-context";

////////////////////////////////////////////////////////////////////////////////

export function isWidgetParentOfStyle(object: EezObject) {
    const widgetClass = findClass("Widget")!;
    while (true) {
        if (isObjectInstanceOf(object, widgetClass.classInfo)) {
            return true;
        }
        if (!object._parent) {
            return false;
        }
        object = object._parent;
    }
}

////////////////////////////////////////////////////////////////////////////////

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
    referencedObjectCollectionPath: ["gui", "styles"]
};

const fontProperty: PropertyInfo = {
    name: "font",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: ["gui", "fonts"],
    defaultValue: undefined,
    inheritable: true
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

const colorProperty: PropertyInfo = {
    name: "color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: ["gui", "colors"],
    defaultValue: "#000000",
    inheritable: true
};

const backgroundColorProperty: PropertyInfo = {
    name: "backgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: ["gui", "colors"],
    defaultValue: "#ffffff",
    inheritable: true
};

const borderSizeProperty: PropertyInfo = {
    name: "borderSize",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const borderRadiusProperty: PropertyInfo = {
    name: "borderRadius",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true
};

const borderColorProperty: PropertyInfo = {
    name: "borderColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: ["gui", "colors"],
    defaultValue: "#000000",
    inheritable: true
};

const paddingProperty: PropertyInfo = {
    name: "padding",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const opacityProperty: PropertyInfo = {
    name: "opacity",
    type: PropertyType.Number,
    defaultValue: 255,
    inheritable: true
};

const blinkProperty: PropertyInfo = {
    name: "blink",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: true
};

const alwaysBuildProperty: PropertyInfo = {
    name: "alwaysBuild",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: false,
    hideInPropertyGrid: isWidgetParentOfStyle
};

const properties = [
    nameProperty,
    descriptionProperty,
    inheritFromProperty,
    fontProperty,
    alignHorizontalProperty,
    alignVerticalProperty,
    colorProperty,
    backgroundColorProperty,
    borderSizeProperty,
    borderRadiusProperty,
    borderColorProperty,
    paddingProperty,
    opacityProperty,
    blinkProperty,
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
    translateThemedColors?: boolean
): InheritedValue {
    if (translateThemedColors == undefined) {
        translateThemedColors = true;
    }

    let value = getProperty(styleObject, propertyName);
    if (value !== undefined) {
        if (
            translateThemedColors &&
            (propertyName === "color" ||
                propertyName === "backgroundColor" ||
                propertyName === "borderColor")
        ) {
            value = getPageContext().getThemedColor(value);
        }

        return {
            value: value,
            source: styleObject
        };
    }

    if (styleObject.inheritFrom) {
        let inheritFromStyleObject = getPageContext().findStyle(styleObject.inheritFrom);
        if (inheritFromStyleObject) {
            return getInheritedValue(inheritFromStyleObject, propertyName, translateThemedColors);
        }
    }

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class Style extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable inheritFrom?: string;
    @observable font?: string;
    @observable alignHorizontal?: string;
    @observable alignVertical?: string;
    @observable color?: string;
    @observable backgroundColor?: string;
    @observable borderSize?: string;
    @observable borderRadius?: number;
    @observable borderColor?: string;
    @observable padding?: string;
    @observable opacity: number;
    @observable blink?: boolean;
    @observable alwaysBuild: boolean;

    static classInfo: ClassInfo = {
        properties,
        beforeLoadHook(object: Style, jsObject: any) {
            const paddingHorizontal = jsObject.paddingHorizontal || 0;
            const paddingVertical = jsObject.paddingVertical || 0;

            delete jsObject.paddingHorizontal;
            delete jsObject.paddingVertical;

            if (paddingHorizontal !== paddingVertical) {
                jsObject.padding = paddingVertical + " " + paddingHorizontal;
            } else {
                jsObject.padding = paddingHorizontal;
            }
        },
        isPropertyMenuSupported: true,
        newItem: (object: EezObject) => {
            return Promise.resolve({
                name: "Style"
            });
        },
        getInheritedValue: (styleObject: Style, propertyName: string) =>
            getInheritedValue(styleObject, propertyName, false),
        navigationComponentId: "styles",
        icon: "format_color_fill",
        defaultValue: {}
    };

    @computed
    get fontName(): string {
        return getStyleProperty(this, "font");
    }

    @computed
    get fontObject(): any {
        let fontName = this.fontName;
        if (fontName) {
            return getPageContext().findFont(fontName);
        }
        return getDefaultStyle().fontObject;
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
                    error = `value must be >= 0 && <= 15`;
                } else if (value > 15) {
                    error = `value must be >= 0 && <= 15`;
                } else {
                    top = right = bottom = left = value;
                }
            } else if (typeof value === "string") {
                const x = value.split(/\W+/);

                if (x.length === 1) {
                    const value = parseInt(x[0]);
                    if (!Number.isFinite(value)) {
                        error = `value is not a valid number`;
                    } else if (value < 0) {
                        error = `value must be >= 0 && <= 15`;
                    } else if (value > 15) {
                        error = `value must be >= 0 && <= 15`;
                    } else {
                        top = right = bottom = left = value;
                    }
                } else if (x.length === 2) {
                    const topBottomValue = parseInt(x[0]);
                    if (!Number.isFinite(topBottomValue)) {
                        error = `"top/bottom" value is not a valid number`;
                    } else if (topBottomValue < 0) {
                        error = `"top/bottom" value must be >= 0 && <= 15`;
                    } else if (topBottomValue > 15) {
                        error = `"top/bottom" value must be >= 0 && <= 15`;
                    } else {
                        top = bottom = topBottomValue;
                    }

                    const rightLeftValue = parseInt(x[0]);
                    if (!Number.isFinite(rightLeftValue)) {
                        error = `"right/left" value is not a valid number`;
                    } else if (rightLeftValue < 0) {
                        error = `"right/left" value must be >= 0 && <= 15`;
                    } else if (rightLeftValue > 15) {
                        error = `"right/left" value must be >= 0 && <= 15`;
                    } else {
                        right = left = rightLeftValue;
                    }
                } else if (x.length === 4) {
                    const topValue = parseInt(x[0]);
                    if (!Number.isFinite(topValue)) {
                        error = `"top" value is not a valid number`;
                    } else if (topValue < 0) {
                        error = `"top" value must be >= 0 && <= 15`;
                    } else if (topValue > 15) {
                        error = `"top" value must be >= 0 && <= 15`;
                    } else {
                        top = topValue;
                    }

                    const rightValue = parseInt(x[1]);
                    if (!Number.isFinite(rightValue)) {
                        error = `"right" value is not a valid number`;
                    } else if (rightValue < 0) {
                        error = `"right" value must be >= 0 && <= 15`;
                    } else if (rightValue > 15) {
                        error = `"right" value must be >= 0 && <= 15`;
                    } else {
                        right = rightValue;
                    }

                    const bottomValue = parseInt(x[2]);
                    if (!Number.isFinite(bottomValue)) {
                        error = `"bottom" value is not a valid number`;
                    } else if (bottomValue < 0) {
                        error = `"bottom" value must be >= 0 && <= 15`;
                    } else if (bottomValue > 15) {
                        error = `"bottom" value must be >= 0 && <= 15`;
                    } else {
                        bottom = bottomValue;
                    }

                    const leftValue = parseInt(x[3]);
                    if (!Number.isFinite(leftValue)) {
                        error = `"left" value is not a valid number`;
                    } else if (leftValue < 0) {
                        error = `"left" value must be >= 0 && <= 15`;
                    } else if (leftValue > 15) {
                        error = `"left" value must be >= 0 && <= 15`;
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

    @computed
    get borderSizeProperty(): string {
        return getStyleProperty(this, "borderSize");
    }

    @computed
    get borderSizeRect() {
        return Style.getRect(this.borderSizeProperty).rect;
    }

    @computed
    get borderRadiusProperty(): number {
        return getStyleProperty(this, "borderRadius");
    }

    @computed
    get alignHorizontalProperty(): string {
        return getStyleProperty(this, "alignHorizontal");
    }

    @computed
    get alignVerticalProperty(): string {
        return getStyleProperty(this, "alignVertical");
    }

    @computed
    get colorProperty(): string {
        return getStyleProperty(this, "color");
    }

    @computed
    get color16(): number {
        return strToColor16(this.colorProperty);
    }

    @computed
    get backgroundColorProperty(): string {
        return getStyleProperty(this, "backgroundColor");
    }

    @computed
    get backgroundColor16(): number {
        return strToColor16(this.backgroundColorProperty);
    }

    @computed
    get borderColorProperty(): string {
        return getStyleProperty(this, "borderColor");
    }

    @computed
    get borderColor16(): number {
        return strToColor16(this.borderColorProperty);
    }

    @computed
    get paddingProperty(): string {
        return getStyleProperty(this, "padding");
    }

    @computed
    get paddingRect() {
        return Style.getRect(this.paddingProperty).rect;
    }

    @computed
    get opacityProperty(): number {
        const opacity = getStyleProperty(this, "opacity");
        if (isNaN(opacity)) {
            return 255;
        }
        return opacity;
    }

    @computed
    get blinkProperty(): number {
        return getStyleProperty(this, "blink");
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.fontObject) {
            messages.push(output.propertyNotFoundMessage(this, "font"));
        }

        let borderSizeError = Style.getRect(this.borderSizeProperty).error;
        if (borderSizeError) {
            messages.push(
                new output.Message(
                    MessageType.ERROR,
                    `"Border size": ${borderSizeError}.`,
                    getChildOfObject(this, "borderSize")
                )
            );
        }

        let borderRadius = this.borderRadiusProperty;
        if (borderRadius < 0) {
            messages.push(output.propertyInvalidValueMessage(this, "borderRadius"));
        }

        let alignHorizontal = this.alignHorizontalProperty;
        if (
            alignHorizontal != "left" &&
            alignHorizontal != "center" &&
            alignHorizontal != "right"
        ) {
            messages.push(output.propertyInvalidValueMessage(this, "alignHorizontal"));
        }

        let alignVertical = this.alignVerticalProperty;
        if (alignVertical != "top" && alignVertical != "center" && alignVertical != "bottom") {
            messages.push(output.propertyInvalidValueMessage(this, "alignVertical"));
        }

        if (isNaN(this.color16)) {
            messages.push(output.propertyInvalidValueMessage(this, "color"));
        }

        if (isNaN(this.backgroundColor16)) {
            messages.push(output.propertyInvalidValueMessage(this, "backgroundColor"));
        }

        if (isNaN(this.borderColor16)) {
            messages.push(output.propertyInvalidValueMessage(this, "borderColor"));
        }

        let paddingError = Style.getRect(this.paddingProperty).error;
        if (paddingError) {
            messages.push(
                new output.Message(
                    MessageType.ERROR,
                    `"Padding": ${borderSizeError}.`,
                    getChildOfObject(this, "padding")
                )
            );
        }

        return messages;
    }

    compareTo(otherStyle: Style): boolean {
        return (
            this.fontName === otherStyle.fontName &&
            this.alignHorizontalProperty === otherStyle.alignHorizontalProperty &&
            this.alignVerticalProperty === otherStyle.alignVerticalProperty &&
            this.colorProperty === otherStyle.colorProperty &&
            this.backgroundColorProperty === otherStyle.backgroundColorProperty &&
            this.borderSizeProperty === otherStyle.borderSizeProperty &&
            this.borderRadiusProperty === otherStyle.borderRadiusProperty &&
            this.borderColorProperty === otherStyle.borderColorProperty &&
            this.paddingProperty === otherStyle.paddingProperty &&
            this.opacityProperty === otherStyle.opacityProperty &&
            this.blinkProperty === otherStyle.blinkProperty
        );
    }
}

registerClass(Style);

////////////////////////////////////////////////////////////////////////////////

let DEFAULT_STYLE: Style;

export function getDefaultStyle(): Style {
    let defaultStyle = getPageContext().findStyle("default");
    if (defaultStyle) {
        return defaultStyle;
    }

    if (!DEFAULT_STYLE) {
        DEFAULT_STYLE = loadObject(
            undefined,
            {
                name: "default",
                font: fontProperty.defaultValue,
                alignHorizontal: alignHorizontalProperty.defaultValue,
                alignVertical: alignVerticalProperty.defaultValue,
                color: colorProperty.defaultValue,
                backgroundColor: backgroundColorProperty.defaultValue,
                borderSize: borderSizeProperty.defaultValue,
                borderRadius: borderRadiusProperty.defaultValue,
                borderColor: borderColorProperty.defaultValue,
                padding: paddingProperty.defaultValue,
                opacity: opacityProperty.defaultValue,
                blink: blinkProperty.defaultValue
            },
            Style
        ) as Style;
    }

    return DEFAULT_STYLE;
}

////////////////////////////////////////////////////////////////////////////////

export function getStyleProperty(
    styleNameOrObject: Style | string | undefined,
    propertyName: string,
    translateThemedColors?: boolean
): any {
    let style: Style;
    if (!styleNameOrObject) {
        style = getDefaultStyle();
    } else if (typeof styleNameOrObject == "string") {
        style = getPageContext().findStyle(styleNameOrObject) || getDefaultStyle();
    } else {
        style = styleNameOrObject;
    }

    let inheritedValue = getInheritedValue(style, propertyName, translateThemedColors);
    if (inheritedValue) {
        return inheritedValue.value;
    }

    return propertiesMap[propertyName].defaultValue;
}
