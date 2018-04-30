import { _map, _zipObject } from "shared/algorithm";

import { observable, computed } from "mobx";

import { loadObject } from "project-editor/core/store";
import {
    PropertyMetaData,
    registerMetaData,
    EezObject,
    InheritedValue
} from "project-editor/core/metaData";
import * as output from "project-editor/core/output";
import { strToColor16 } from "project-editor/core/util";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import { findFontIndex } from "project-editor/project/features/gui/gui";

import { drawText } from "project-editor/project/features/gui/draw";
import { StyleEditor } from "project-editor/project/features/gui/StyleEditor";
import { findStyle, findStyleOrGetDefault } from "project-editor/project/features/gui/gui";
import { FontProperties } from "project-editor/project/features/gui/fontMetaData";

////////////////////////////////////////////////////////////////////////////////

const nameProperty: PropertyMetaData = {
    name: "name",
    type: "string",
    unique: true
};

const descriptionProperty: PropertyMetaData = {
    name: "description",
    type: "multiline-text"
};

const inheritFromProperty: PropertyMetaData = {
    name: "inheritFrom",
    type: "object-reference",
    referencedObjectCollectionPath: ["gui", "styles"]
};

const fontProperty: PropertyMetaData = {
    name: "font",
    type: "object-reference",
    referencedObjectCollectionPath: ["gui", "fonts"],
    defaultValue: undefined,
    inheritable: true
};

const alignHorizontalProperty: PropertyMetaData = {
    name: "alignHorizontal",
    type: "enum",
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

const alignVerticalProperty: PropertyMetaData = {
    name: "alignVertical",
    type: "enum",
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

const colorProperty: PropertyMetaData = {
    name: "color",
    type: "color",
    defaultValue: "#000000",
    inheritable: true
};

const backgroundColorProperty: PropertyMetaData = {
    name: "backgroundColor",
    type: "color",
    defaultValue: "#ffffff",
    inheritable: true
};

const borderSizeProperty: PropertyMetaData = {
    name: "borderSize",
    type: "number",
    defaultValue: 0,
    inheritable: true
};

const borderColorProperty: PropertyMetaData = {
    name: "borderColor",
    type: "color",
    defaultValue: "#000000",
    inheritable: true
};

const paddingHorizontalProperty: PropertyMetaData = {
    name: "paddingHorizontal",
    type: "number",
    defaultValue: 0,
    inheritable: true
};

const paddingVerticalProperty: PropertyMetaData = {
    name: "paddingVertical",
    type: "number",
    defaultValue: 0,
    inheritable: true
};

const blinkProperty: PropertyMetaData = {
    name: "blink",
    type: "boolean",
    defaultValue: false,
    inheritable: true
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
    blinkProperty
];

const propertiesMap: { [propertyName: string]: PropertyMetaData } = _zipObject(
    _map(properties, p => p.name),
    _map(properties, p => p)
) as any;

////////////////////////////////////////////////////////////////////////////////

function getInheritedValue(object: EezObject, propertyName: string): InheritedValue {
    let styleProperties = object as StyleProperties;

    let value = styleProperties[propertyName];
    if (value !== undefined) {
        return {
            value: value,
            source: styleProperties.name
        };
    }

    if (styleProperties.inheritFrom) {
        let inheritFromStyleProperties = findStyle(styleProperties.inheritFrom);
        if (inheritFromStyleProperties) {
            return getInheritedValue(inheritFromStyleProperties, propertyName);
        }
    }

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class StyleProperties extends EezObject {
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
    @observable blink?: boolean;

    @computed
    get fontObject(): FontProperties {
        return getStyleProperty(this, "font");
    }

    @computed
    get fontIndex(): number {
        let font = this.fontObject;
        if (font) {
            return findFontIndex(font);
        }
        return -1;
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
    get blinkProperty(): number {
        return getStyleProperty(this, "blink");
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.fontObject) {
            messages.push(output.propertyNotSetMessage(this, "font"));
        } else if (this.fontIndex == -1) {
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

        return super.check().concat(messages);
    }
}

export const styleMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return StyleProperties;
    },
    className: "Style",
    label: (style: StyleProperties) => {
        return style.name;
    },
    properties: () => properties,
    newItem: (object: EezObject) => {
        return Promise.resolve({
            name: "Style"
        });
    },
    editorComponent: StyleEditor,
    getInheritedValue: getInheritedValue,
    navigationComponent: ListNavigationWithContent,
    navigationComponentId: "styles",
    icon: "format_color_fill"
});

////////////////////////////////////////////////////////////////////////////////

export function getStyleProperty(
    styleOrString: StyleProperties | string | undefined,
    propertyName: string
): any {
    let style: StyleProperties;
    if (!styleOrString) {
        style = getDefaultStyle();
    } else if (typeof styleOrString == "string") {
        style = findStyleOrGetDefault(styleOrString);
    } else {
        style = styleOrString;
    }

    let inheritedValue = getInheritedValue(style, propertyName);
    if (inheritedValue) {
        return inheritedValue.value;
    }

    return propertiesMap[propertyName].defaultValue;
}

////////////////////////////////////////////////////////////////////////////////

let DEFAULT_STYLE: StyleProperties;

export function getDefaultStyle(): StyleProperties {
    let defaultStyle = findStyle("default");
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
                blink: blinkProperty.defaultValue
            },
            styleMetaData
        ) as StyleProperties;
    }

    return DEFAULT_STYLE;
}

////////////////////////////////////////////////////////////////////////////////

export function drawStylePreview(canvas: HTMLCanvasElement, style: StyleProperties) {
    let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");
    ctx.save();
    ctx.translate(Math.floor((canvas.width - 240) / 2), Math.floor((canvas.height - 320) / 2));
    ctx.drawImage(drawText("Hello!", 240, 160, style, false), 0, 0);
    ctx.drawImage(drawText("Hello!", 240, 160, style, true), 0, 160);
    ctx.restore();
}
