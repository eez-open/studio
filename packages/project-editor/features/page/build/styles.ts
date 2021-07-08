import * as projectBuild from "project-editor/project/build";
import { Style } from "project-editor/features/style/style";
import { Assets } from "project-editor/features/page/build/assets";
import {
    DataBuffer,
    Struct,
    UInt16,
    UInt8,
    ObjectList,
    buildListData
} from "project-editor/features/page/build/pack";

export const STYLE_FLAGS_HORZ_ALIGN_LEFT = 0;
export const STYLE_FLAGS_HORZ_ALIGN_RIGHT = 1;
export const STYLE_FLAGS_HORZ_ALIGN_CENTER = 2;

export const STYLE_FLAGS_VERT_ALIGN_TOP = 0 << 3;
export const STYLE_FLAGS_VERT_ALIGN_BOTTOM = 1 << 3;
export const STYLE_FLAGS_VERT_ALIGN_CENTER = 2 << 3;

export const STYLE_FLAGS_BLINK = 1 << 6;

export function buildGuiStylesEnum(assets: Assets) {
    let styles = assets.styles
        .map((style, i) => {
            if (style) {
                return `${projectBuild.TAB}${projectBuild.getName(
                    "STYLE_ID_",
                    style.name ? style : "inline" + i,
                    projectBuild.NamingConvention.UnderscoreUpperCase
                )} = ${i}`;
            } else {
                return undefined;
            }
        })
        .filter(style => !!style);

    styles.unshift(`${projectBuild.TAB}STYLE_ID_NONE = 0`);

    return `enum StylesEnum {\n${styles.join(",\n")}\n};`;
}

export function buildGuiStylesData(
    assets: Assets,
    dataBuffer: DataBuffer | null
) {
    function buildStyle(style: Style) {
        let result = new Struct();

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

        result.addField(new UInt16(flags));

        // colors
        let backgroundColor = assets.getColorIndex(style, "backgroundColor");
        if (isNaN(backgroundColor)) {
            backgroundColor = 0;
        }
        result.addField(new UInt16(backgroundColor));

        let color = assets.getColorIndex(style, "color");
        if (isNaN(color)) {
            color = 0;
        }
        result.addField(new UInt16(color));

        let activeBackgroundColor = assets.getColorIndex(
            style,
            "activeBackgroundColor"
        );
        if (isNaN(activeBackgroundColor)) {
            activeBackgroundColor = 0;
        }
        result.addField(new UInt16(activeBackgroundColor));

        let activeColor = assets.getColorIndex(style, "activeColor");
        if (isNaN(activeColor)) {
            activeColor = 0;
        }
        result.addField(new UInt16(activeColor));

        let focusBackgroundColor = assets.getColorIndex(
            style,
            "focusBackgroundColor"
        );
        if (isNaN(focusBackgroundColor)) {
            focusBackgroundColor = 0;
        }
        result.addField(new UInt16(focusBackgroundColor));

        let focusColor = assets.getColorIndex(style, "focusColor");
        if (isNaN(focusColor)) {
            focusColor = 0;
        }
        result.addField(new UInt16(focusColor));

        result.addField(new UInt8(style.borderSizeRect.top));
        result.addField(new UInt8(style.borderSizeRect.right));
        result.addField(new UInt8(style.borderSizeRect.bottom));
        result.addField(new UInt8(style.borderSizeRect.left));

        result.addField(new UInt16(style.borderRadius || 0));

        let borderColor = assets.getColorIndex(style, "borderColor");
        if (isNaN(borderColor)) {
            borderColor = 0;
        }
        result.addField(new UInt16(borderColor));

        // font
        let fontIndex = style.fontName
            ? assets.getFontIndex(style, "fontName")
            : 0;
        result.addField(new UInt8(fontIndex));

        // opacity
        result.addField(new UInt8(style.opacityProperty));

        // padding
        result.addField(new UInt8(style.paddingRect.top));
        result.addField(new UInt8(style.paddingRect.right));
        result.addField(new UInt8(style.paddingRect.bottom));
        result.addField(new UInt8(style.paddingRect.left));

        // margin
        result.addField(new UInt8(style.marginRect.top));
        result.addField(new UInt8(style.marginRect.right));
        result.addField(new UInt8(style.marginRect.bottom));
        result.addField(new UInt8(style.marginRect.left));

        return result;
    }

    return buildListData((document: Struct) => {
        let styles = new ObjectList();
        if (!assets.DocumentStore.masterProject) {
            const assetStyles = assets.styles.filter(
                style => !!style
            ) as Style[];
            assetStyles.forEach(style => {
                styles.addItem(buildStyle(style));
            });
        }
        document.addField(styles);
    }, dataBuffer);
}
