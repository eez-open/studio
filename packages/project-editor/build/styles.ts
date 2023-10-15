import { uniqBy } from "lodash";

import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import type { Style } from "project-editor/features/style/style";
import type { Assets, DataBuffer } from "project-editor/build/assets";

export const STYLE_FLAGS_HORZ_ALIGN_LEFT = 0;
export const STYLE_FLAGS_HORZ_ALIGN_RIGHT = 1;
export const STYLE_FLAGS_HORZ_ALIGN_CENTER = 2;

export const STYLE_FLAGS_VERT_ALIGN_TOP = 0 << 3;
export const STYLE_FLAGS_VERT_ALIGN_BOTTOM = 1 << 3;
export const STYLE_FLAGS_VERT_ALIGN_CENTER = 2 << 3;

export const STYLE_FLAGS_BLINK = 1 << 6;

export function buildGuiStylesEnum(assets: Assets) {
    let styles = assets.styles.filter(style => style.id != undefined);
    styles = uniqBy(styles, style => style.id);

    const styleEnumItems = styles.map((style, i) => {
        return `${TAB}${getName(
            "STYLE_ID_",
            style.name ? style : "inline" + i,
            NamingConvention.UnderscoreUpperCase
        )} = ${style.id}`;
    });

    styleEnumItems.unshift(`${TAB}STYLE_ID_NONE = 0`);

    return `enum StylesEnum {\n${styleEnumItems.join(",\n")}\n};`;
}

export function buildGuiStylesData(assets: Assets, dataBuffer: DataBuffer) {
    function buildStyle(style: Style) {
        // flags
        let flags = 0;

        let styleAlignHorizontal = style.alignHorizontalProperty;
        if (styleAlignHorizontal == "left") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_LEFT;
        } else if (styleAlignHorizontal == "right") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_RIGHT;
        } else {
            flags |= STYLE_FLAGS_HORZ_ALIGN_CENTER;
        }

        let styleAlignVertical = style.alignVerticalProperty;
        if (styleAlignVertical == "top") {
            flags |= STYLE_FLAGS_VERT_ALIGN_TOP;
        } else if (styleAlignVertical == "bottom") {
            flags |= STYLE_FLAGS_VERT_ALIGN_BOTTOM;
        } else {
            flags |= STYLE_FLAGS_VERT_ALIGN_CENTER;
        }

        let styleBlink = style.blinkProperty;
        if (styleBlink) {
            flags |= STYLE_FLAGS_BLINK;
        }

        dataBuffer.writeUint16(flags);

        // backgroundColor
        let backgroundColor = assets.getColorIndex(style, "backgroundColor");
        if (isNaN(backgroundColor)) {
            backgroundColor = 0;
        }
        dataBuffer.writeUint16(backgroundColor);

        // color
        let color = assets.getColorIndex(style, "color");
        if (isNaN(color)) {
            color = 0;
        }
        dataBuffer.writeUint16(color);

        // activeBackgroundColor
        let activeBackgroundColor = assets.getColorIndex(
            style,
            "activeBackgroundColor"
        );
        if (isNaN(activeBackgroundColor)) {
            activeBackgroundColor = 0;
        }
        dataBuffer.writeUint16(activeBackgroundColor);

        // activeColor
        let activeColor = assets.getColorIndex(style, "activeColor");
        if (isNaN(activeColor)) {
            activeColor = 0;
        }
        dataBuffer.writeUint16(activeColor);

        // focusBackgroundColor
        let focusBackgroundColor = assets.getColorIndex(
            style,
            "focusBackgroundColor"
        );
        if (isNaN(focusBackgroundColor)) {
            focusBackgroundColor = 0;
        }
        dataBuffer.writeUint16(focusBackgroundColor);

        // focusColor
        let focusColor = assets.getColorIndex(style, "focusColor");
        if (isNaN(focusColor)) {
            focusColor = 0;
        }
        dataBuffer.writeUint16(focusColor);

        // borderSize
        dataBuffer.writeUint8(style.borderSizeRect.top);
        dataBuffer.writeUint8(style.borderSizeRect.right);
        dataBuffer.writeUint8(style.borderSizeRect.bottom);
        dataBuffer.writeUint8(style.borderSizeRect.left);

        // borderColor
        let borderColor = assets.getColorIndex(style, "borderColor");
        if (isNaN(borderColor)) {
            borderColor = 0;
        }
        dataBuffer.writeUint16(borderColor);

        // borderRadius
        dataBuffer.writeUint8(style.borderRadiusSpec.topLeftX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.topLeftY || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.topRightX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.topRightY || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomRightX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomRightY || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomLeftX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomLeftY || 0);

        // font
        let fontIndex = style.fontName
            ? assets.getFontIndex(style, "fontName")
            : 0;
        dataBuffer.writeUint8(fontIndex);

        // opacity
        dataBuffer.writeUint8(style.opacityProperty);

        // padding
        dataBuffer.writeUint8(style.paddingRect.top);
        dataBuffer.writeUint8(style.paddingRect.right);
        dataBuffer.writeUint8(style.paddingRect.bottom);
        dataBuffer.writeUint8(style.paddingRect.left);

        // backgroundImage
        let backgroundImage: number = 0;
        if (style.backgroundImageProperty) {
            backgroundImage = assets.getBitmapIndex(style, "backgroundImage");
        }
        dataBuffer.writeInt16(backgroundImage);
    }

    const styles = assets.projectStore.projectTypeTraits.isDashboard
        ? []
        : assets.styles.filter(style => !!style);
    dataBuffer.writeArray(styles, buildStyle);
}
