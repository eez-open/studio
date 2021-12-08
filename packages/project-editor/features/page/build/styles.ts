import * as projectBuild from "project-editor/project/build";
import type { Style } from "project-editor/features/style/style";
import type {
    Assets,
    DataBuffer
} from "project-editor/features/page/build/assets";

export const STYLE_FLAGS_HORZ_ALIGN_LEFT = 0;
export const STYLE_FLAGS_HORZ_ALIGN_RIGHT = 1;
export const STYLE_FLAGS_HORZ_ALIGN_CENTER = 2;

export const STYLE_FLAGS_VERT_ALIGN_TOP = 0 << 3;
export const STYLE_FLAGS_VERT_ALIGN_BOTTOM = 1 << 3;
export const STYLE_FLAGS_VERT_ALIGN_CENTER = 2 << 3;

export const STYLE_FLAGS_BLINK = 1 << 6;

export function buildGuiStylesEnum(assets: Assets) {
    let styles = assets.styles.filter(style => !!style) as Style[];

    const styleEnumItems = styles.map((style, i) => {
        return `${projectBuild.TAB}${projectBuild.getName(
            "STYLE_ID_",
            style.name ? style : "inline" + i,
            projectBuild.NamingConvention.UnderscoreUpperCase
        )} = ${i + 1}`;
    });

    styleEnumItems.unshift(`${projectBuild.TAB}STYLE_ID_NONE = 0`);

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

        // colors
        let backgroundColor = assets.getColorIndex(style, "backgroundColor");
        if (isNaN(backgroundColor)) {
            backgroundColor = 0;
        }
        dataBuffer.writeUint16(backgroundColor);

        let color = assets.getColorIndex(style, "color");
        if (isNaN(color)) {
            color = 0;
        }
        dataBuffer.writeUint16(color);

        let activeBackgroundColor = assets.getColorIndex(
            style,
            "activeBackgroundColor"
        );
        if (isNaN(activeBackgroundColor)) {
            activeBackgroundColor = 0;
        }
        dataBuffer.writeUint16(activeBackgroundColor);

        let activeColor = assets.getColorIndex(style, "activeColor");
        if (isNaN(activeColor)) {
            activeColor = 0;
        }
        dataBuffer.writeUint16(activeColor);

        let focusBackgroundColor = assets.getColorIndex(
            style,
            "focusBackgroundColor"
        );
        if (isNaN(focusBackgroundColor)) {
            focusBackgroundColor = 0;
        }
        dataBuffer.writeUint16(focusBackgroundColor);

        let focusColor = assets.getColorIndex(style, "focusColor");
        if (isNaN(focusColor)) {
            focusColor = 0;
        }
        dataBuffer.writeUint16(focusColor);

        dataBuffer.writeUint8(style.borderSizeRect.top);
        dataBuffer.writeUint8(style.borderSizeRect.right);
        dataBuffer.writeUint8(style.borderSizeRect.bottom);
        dataBuffer.writeUint8(style.borderSizeRect.left);

        dataBuffer.writeUint16(style.borderRadius || 0);

        let borderColor = assets.getColorIndex(style, "borderColor");
        if (isNaN(borderColor)) {
            borderColor = 0;
        }
        dataBuffer.writeUint16(borderColor);

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

        // margin
        dataBuffer.writeUint8(style.marginRect.top);
        dataBuffer.writeUint8(style.marginRect.right);
        dataBuffer.writeUint8(style.marginRect.bottom);
        dataBuffer.writeUint8(style.marginRect.left);

        // backgroundImage
        let backgroundImage: number = 0;
        if (style.backgroundImageProperty) {
            backgroundImage = assets.getBitmapIndex(style, "backgroundImage");
        }
        dataBuffer.writeInt16(backgroundImage);
    }

    const styles = assets.styles.filter(style => !!style);
    dataBuffer.writeArray(styles, buildStyle);
}
