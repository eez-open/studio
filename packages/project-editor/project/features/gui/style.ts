import { _map, _zipObject } from "eez-studio-shared/algorithm";

import { observable, computed } from "mobx";

import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    EezObject,
    InheritedValue,
    PropertyType,
    getProperty
} from "eez-studio-shared/model/object";
import { loadObject } from "eez-studio-shared/model/serialization";
import * as output from "eez-studio-shared/model/output";
import { strToColor16 } from "project-editor/core/util";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

import { findFont } from "project-editor/project/features/gui/gui";

import { drawText } from "project-editor/project/features/gui/draw";
import { StyleEditor } from "project-editor/project/features/gui/StyleEditor";
import { findStyle, findStyleOrGetDefault } from "project-editor/project/features/gui/gui";

////////////////////////////////////////////////////////////////////////////////

const nameProperty: PropertyInfo = {
    name: "name",
    type: PropertyType.String,
    unique: true
};

const descriptionProperty: PropertyInfo = {
    name: "description",
    type: PropertyType.MultilineText
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
    inheritable: false
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

function getInheritedValue(object: EezObject, propertyName: string): InheritedValue {
    let styleProperties = object as Style;

    let value = getProperty(styleProperties, propertyName);
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

export class Style extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    inheritFrom?: string;
    @observable
    font?: string;
    @observable
    alignHorizontal?: string;
    @observable
    alignVertical?: string;
    @observable
    color?: string;
    @observable
    backgroundColor?: string;
    @observable
    borderSize?: number;
    @observable
    borderColor?: string;
    @observable
    paddingHorizontal?: number;
    @observable
    paddingVertical?: number;
    @observable
    opacity: number;
    @observable
    blink?: boolean;
    @observable
    alwaysBuild: boolean;

    static classInfo: ClassInfo = {
        properties,
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
    };

    @computed
    get fontName(): string {
        return getStyleProperty(this, "font");
    }

    @computed
    get fontObject() {
        let fontName = this.fontName;
        if (fontName) {
            return findFont(fontName);
        }
        return null;
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

        if (!this.fontName) {
            messages.push(output.propertyNotSetMessage(this, "font"));
        } else if (!this.fontObject) {
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
}

registerClass(Style);

////////////////////////////////////////////////////////////////////////////////

export function getStyleProperty(
    styleOrString: Style | string | undefined,
    propertyName: string
): any {
    let style: Style;
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

let DEFAULT_STYLE: Style;

export function getDefaultStyle(): Style {
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
                opacity: opacityProperty.defaultValue,
                blink: blinkProperty.defaultValue
            },
            Style
        ) as Style;
    }

    return DEFAULT_STYLE;
}

////////////////////////////////////////////////////////////////////////////////

export function drawStylePreview(canvas: HTMLCanvasElement, style: Style) {
    let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");
    ctx.save();
    ctx.translate(Math.floor((canvas.width - 240) / 2), Math.floor((canvas.height - 320) / 2));
    ctx.drawImage(drawText("Hello!", 240, 160, style, false), 0, 0);
    ctx.drawImage(drawText("Hello!", 240, 160, style, true), 0, 160);
    ctx.restore();
}
