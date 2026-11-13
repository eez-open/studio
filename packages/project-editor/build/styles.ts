import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import {
    STYLE_STATES,
    StateStyle,
    getBorderColors,
    getStyleProperty,
    type Style
} from "project-editor/features/style/style";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { Section } from "project-editor/store";
import { MessageType } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";

export const STYLE_FLAGS_HORZ_ALIGN_LEFT = 0;
export const STYLE_FLAGS_HORZ_ALIGN_RIGHT = 1;
export const STYLE_FLAGS_HORZ_ALIGN_CENTER = 2;

export const STYLE_FLAGS_VERT_ALIGN_TOP = 0 << 3;
export const STYLE_FLAGS_VERT_ALIGN_BOTTOM = 1 << 3;
export const STYLE_FLAGS_VERT_ALIGN_CENTER = 2 << 3;

export const STYLE_FLAGS_BLINK = 1 << 6;
export const STYLE_FLAGS_ELLIPSIS = 1 << 7;

// The styles of the states of the styles of the assets (see Style.stateDeltas):
// a StateStyle for each state with properties, added to the assets (the list
// grows while it is walked, the state styles have no states). The indexes are
// kept in assets.stateStyleIndexes for buildStyle.
function addStateStyles(assets: Assets) {
    for (let i = 0; i < assets.styles.length; i++) {
        const style = assets.styles[i];
        if (
            !style ||
            style.isStateStyle ||
            assets.stateStyleIndexes.has(style)
        ) {
            continue;
        }

        const stateDeltas = style.stateDeltas;

        const indexes = STYLE_STATES.map(state => {
            const delta = stateDeltas?.[state];
            if (!delta || Object.keys(delta).length == 0) {
                return 0;
            }
            return assets.doGetStyleIndex(
                ProjectEditor.getProject(style),
                new StateStyle(style, state, delta)
            );
        });

        assets.stateStyleIndexes.set(style, indexes);
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(Math.round(value), min), max);
}

export function buildGuiStylesEnum(assets: Assets) {
    let styles = assets.styles.filter(style => style.id != undefined || style.alwaysBuild);

    const styleEnumItems = styles.map((style, i) => {
        return `${TAB}${getName(
            "STYLE_ID_",
            style.name ? style : "inline" + i,
            NamingConvention.UnderscoreUpperCase
        )}${style.id != undefined ? `= ${style.id}` : ""}`;
    });

    styleEnumItems.unshift(`${TAB}STYLE_ID_NONE = 0`);

    return `enum StylesEnum {\n${styleEnumItems.join(",\n")}\n};`;
}

export function buildGuiStylesData(assets: Assets, dataBuffer: DataBuffer) {
    function buildStyle(style: Style, position: number) {
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

        if (style.ellipsisProperty) {
            flags |= STYLE_FLAGS_ELLIPSIS;
        }

        dataBuffer.writeUint16(flags);

        // backgroundColor
        let backgroundColor =
            position == assets.editorPageStylePosition
                ? assets.getColorIndexFromStyleColor(
                      assets.editorBuild!.pageBackgroundColor!
                  )
                : assets.getColorIndex(style, "backgroundColor");
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

        // borderSize
        dataBuffer.writeUint8(style.borderSizeRect.top);
        dataBuffer.writeUint8(style.borderSizeRect.right);
        dataBuffer.writeUint8(style.borderSizeRect.bottom);
        dataBuffer.writeUint8(style.borderSizeRect.left);

        // borderColor: the top border, the other sides are written at the end
        // (one to four colors, see getBorderColors)
        const borderColorValue = getStyleProperty(style, "borderColor", false);
        const borderColors = (
            getBorderColors(borderColorValue) ?? [
                borderColorValue,
                borderColorValue,
                borderColorValue,
                borderColorValue
            ]
        ).map(color => {
            const colorIndex = assets.getColorIndexFromStyleColor(color);
            return isNaN(colorIndex) ? 0 : colorIndex;
        });
        dataBuffer.writeUint16(borderColors[0]);

        // borderRadius
        dataBuffer.writeUint8(style.borderRadiusSpec.topLeftX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.topLeftY || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.topRightX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.topRightY || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomRightX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomRightY || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomLeftX || 0);
        dataBuffer.writeUint8(style.borderRadiusSpec.bottomLeftY || 0);

        // font, int8: in a project with a master project the fonts of the
        // project are negative
        let fontIndex = style.fontName
            ? assets.getFontIndex(style, "fontName")
            : 0;
        if (fontIndex < -128 || fontIndex > 127) {
            assets.projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                `font index ${fontIndex} doesn't fit into the style font (-128 to 127)`,
                style
            );
            fontIndex = 0;
        }
        dataBuffer.writeInt8(fontIndex);

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
            // inherited value, the style of the widget in the page layout
            // inherits it from the widget style
            backgroundImage = assets.getBitmapIndex(
                style,
                "backgroundImageProperty"
            );
        }
        dataBuffer.writeInt16(backgroundImage);

        // stateStyles
        const stateStyleIndexes = assets.stateStyleIndexes.get(style);
        for (let i = 0; i < STYLE_STATES.length; i++) {
            dataBuffer.writeInt16(stateStyleIndexes ? stateStyleIndexes[i] : 0);
        }

        // letterSpacing, in 1/64 px
        dataBuffer.writeInt16(
            clamp(style.letterSpacingProperty * 64, -32768, 32767)
        );

        // lineHeight
        dataBuffer.writeUint16(clamp(style.lineHeightProperty, 0, 65535));

        // focusRingColor
        let focusRingColor = assets.getColorIndex(style, "focusRingColor");
        if (isNaN(focusRingColor)) {
            focusRingColor = 0;
        }
        dataBuffer.writeUint16(focusRingColor);

        // focusRingWidth, focusRingOffset
        dataBuffer.writeUint8(clamp(style.focusRingWidthProperty, 0, 255));
        dataBuffer.writeUint8(clamp(style.focusRingOffsetProperty, 0, 255));

        // shadowColor
        let shadowColor = assets.getColorIndex(style, "shadowColor");
        if (isNaN(shadowColor)) {
            shadowColor = 0;
        }
        dataBuffer.writeUint16(shadowColor);

        // shadowOffsetX, shadowOffsetY, shadowBlur, shadowSpread
        dataBuffer.writeInt8(clamp(style.shadowOffsetXProperty, -128, 127));
        dataBuffer.writeInt8(clamp(style.shadowOffsetYProperty, -128, 127));
        dataBuffer.writeUint8(clamp(style.shadowBlurProperty, 0, 255));
        dataBuffer.writeInt8(clamp(style.shadowSpreadProperty, -128, 127));

        // borderColorRight, borderColorBottom, borderColorLeft
        dataBuffer.writeUint16(borderColors[1]);
        dataBuffer.writeUint16(borderColors[2]);
        dataBuffer.writeUint16(borderColors[3]);
    }

    // The index of a style is its position in assets.styles (id - 1 for a
    // style with an id), so a missing id leaves a hole. Keep the positions:
    // write the first style in place of a missing one.
    let styles: Style[] = [];
    if (!assets.projectStore.projectTypeTraits.isDashboard) {
        addStateStyles(assets);

        const firstStyle = assets.styles.find(style => !!style);
        styles = Array.from(assets.styles, style => style ?? firstStyle!);
    }
    dataBuffer.writeArray(styles, buildStyle);
}
