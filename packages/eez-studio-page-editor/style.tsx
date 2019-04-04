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
    findClass
} from "eez-studio-shared/model/object";
import { loadObject } from "eez-studio-shared/model/serialization";
import * as output from "eez-studio-shared/model/output";

import { PageContext } from "eez-studio-page-editor/page-context";

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
    type: PropertyType.Color,
    defaultValue: "#000000",
    inheritable: true
};

const backgroundColorProperty: PropertyInfo = {
    name: "backgroundColor",
    type: PropertyType.Color,
    defaultValue: "#ffffff",
    inheritable: true
};

const borderSizeProperty: PropertyInfo = {
    name: "borderSize",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true
};

const borderColorProperty: PropertyInfo = {
    name: "borderColor",
    type: PropertyType.Color,
    defaultValue: "#000000",
    inheritable: true
};

const paddingHorizontalProperty: PropertyInfo = {
    name: "paddingHorizontal",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true
};

const paddingVerticalProperty: PropertyInfo = {
    name: "paddingVertical",
    type: PropertyType.Number,
    defaultValue: 0,
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
    borderColorProperty,
    paddingHorizontalProperty,
    paddingVerticalProperty,
    opacityProperty,
    blinkProperty,
    alwaysBuildProperty
];

const propertiesMap: { [propertyName: string]: PropertyInfo } = _zipObject(
    _map(properties, p => p.name),
    _map(properties, p => p)
) as any;

////////////////////////////////////////////////////////////////////////////////

function getInheritedValue(styleObject: Style, propertyName: string): InheritedValue {
    let value = getProperty(styleObject, propertyName);
    if (value !== undefined) {
        return {
            value: value,
            source: styleObject
        };
    }

    if (styleObject.inheritFrom) {
        let inheritFromStyleObject = PageContext.findStyle(styleObject.inheritFrom);
        if (inheritFromStyleObject) {
            return getInheritedValue(inheritFromStyleObject, propertyName);
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
    @observable borderSize?: number;
    @observable borderColor?: string;
    @observable paddingHorizontal?: number;
    @observable paddingVertical?: number;
    @observable opacity: number;
    @observable blink?: boolean;
    @observable alwaysBuild: boolean;

    static classInfo: ClassInfo = {
        properties,
        isPropertyMenuSupported: true,
        newItem: (object: EezObject) => {
            return Promise.resolve({
                name: "Style"
            });
        },
        getInheritedValue: getInheritedValue,
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
            return PageContext.findFont(fontName);
        }
        return getDefaultStyle().fontObject;
    }

    @computed
    get borderSizeProperty(): number {
        return getStyleProperty(this, "borderSize");
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
    get color16(): number {
        return strToColor16(getStyleProperty(this, "color"));
    }

    @computed
    get backgroundColor16(): number {
        return strToColor16(getStyleProperty(this, "backgroundColor"));
    }

    @computed
    get borderColor16(): number {
        return strToColor16(getStyleProperty(this, "borderColor"));
    }

    @computed
    get paddingHorizontalProperty(): number {
        return getStyleProperty(this, "paddingHorizontal");
    }

    @computed
    get paddingVerticalProperty(): number {
        return getStyleProperty(this, "paddingVertical");
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

        let borderSize = this.borderSizeProperty;
        if (borderSize != 0 && borderSize != 1) {
            messages.push(output.propertyInvalidValueMessage(this, "borderSize"));
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

        return messages;
    }

    compareTo(otherStyle: Style): boolean {
        return (
            this.fontName === otherStyle.fontName &&
            this.alignHorizontalProperty === otherStyle.alignHorizontalProperty &&
            this.alignVerticalProperty === otherStyle.alignVerticalProperty &&
            this.color === otherStyle.color &&
            this.backgroundColor === otherStyle.backgroundColor &&
            this.borderSizeProperty === otherStyle.borderSizeProperty &&
            this.borderColor === otherStyle.borderColor &&
            this.paddingHorizontalProperty === otherStyle.paddingHorizontalProperty &&
            this.paddingVerticalProperty === otherStyle.paddingVerticalProperty &&
            this.opacityProperty === otherStyle.opacityProperty &&
            this.blinkProperty === otherStyle.blinkProperty
        );
    }
}

registerClass(Style);

////////////////////////////////////////////////////////////////////////////////

let DEFAULT_STYLE: Style;

export function getDefaultStyle(): Style {
    let defaultStyle = PageContext.findStyle("default");
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
                borderColor: borderColorProperty.defaultValue,
                paddingHorizontal: paddingHorizontalProperty.defaultValue,
                paddingVertical: paddingVerticalProperty.defaultValue,
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
    propertyName: string
): any {
    let style: Style;
    if (!styleNameOrObject) {
        style = getDefaultStyle();
    } else if (typeof styleNameOrObject == "string") {
        style = PageContext.findStyle(styleNameOrObject) || getDefaultStyle();
    } else {
        style = styleNameOrObject;
    }

    let inheritedValue = getInheritedValue(style, propertyName);
    if (inheritedValue) {
        return inheritedValue.value;
    }

    return propertiesMap[propertyName].defaultValue;
}
