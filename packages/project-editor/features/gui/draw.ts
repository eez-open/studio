import tinycolor from "tinycolor2";

import { blendColor, to16bitsColor } from "eez-studio-shared/color";

import { Style } from "project-editor/features/gui/style";
import { Font, getPixelByteIndex } from "project-editor/features/gui/font";

////////////////////////////////////////////////////////////////////////////////

let fgColor: string;
let bgColor: string;

export function getColor() {
    return fgColor;
}

export function setColor(color: string) {
    fgColor = to16bitsColor(color);
}

export function getBackColor() {
    return bgColor;
}

export function setBackColor(color: string) {
    bgColor = to16bitsColor(color);
}

export function drawRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    ctx.beginPath();
    ctx.rect(x1 + 0.5, y1 + 0.5, x2 - x1 + 1, y2 - y1 + 1);
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 1;
    ctx.stroke();
}

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number = 0
) {
    if (r == 0) {
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
        ctx.fillStyle = fgColor;
        ctx.fill();
    } else {
        // draw rounded rect
        fillRect(ctx, x1 + r, y1, x2 - r, y1 + r - 1);
        fillRect(ctx, x1, y1 + r, x1 + r - 1, y2 - r);
        fillRect(ctx, x2 + 1 - r, y1 + r, x2, y2 - r);
        fillRect(ctx, x1 + r, y2 - r + 1, x2 - r, y2);
        fillRect(ctx, x1 + r, y1 + r, x2 - r, y2 - r);

        for (let ry = 0; ry <= r; ry++) {
            let rx = Math.round(Math.sqrt(r * r - ry * ry));
            drawHLine(ctx, x2 - r, y2 - r + ry, rx);
            drawHLine(ctx, x1 + r - rx, y2 - r + ry, rx);
            drawHLine(ctx, x2 - r, y1 + r - ry, rx);
            drawHLine(ctx, x1 + r - rx, y1 + r - ry, rx);
        }
    }
}

export function drawHLine(ctx: CanvasRenderingContext2D, x: number, y: number, l: number) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.5);
    ctx.lineTo(x + 0.5 + l, y + 0.5);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

export function drawVLine(ctx: CanvasRenderingContext2D, x: number, y: number, l: number) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.5);
    ctx.lineTo(x + 0.5, y + l + 0.5);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

function getGlyph(font: Font, encoding: number) {
    return font && font.glyphsMap.get(encoding);
}

function measureGlyph(encoding: number, font: Font): number {
    let glyph = getGlyph(font, encoding);
    if (!glyph) {
        return 0;
    }

    return glyph.dx || 0;
}

export function measureStr(text: string, font: Font, maxWidth: number): number {
    let width = 0;

    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);
        let glyph_width = measureGlyph(encoding, font);
        if (maxWidth > 0 && width + glyph_width > maxWidth) {
            return maxWidth;
        }
        width += glyph_width;
    }

    return width;
}

let MAX_GLYPH_WIDTH = 256;
let MAX_GLYPH_HEIGHT = 256;
let pixelImageData: ImageData;
let pixelData: Uint8ClampedArray;

export function drawGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    encoding: number,
    font: Font
): number {
    if (!pixelImageData) {
        pixelImageData = ctx.createImageData(MAX_GLYPH_WIDTH, MAX_GLYPH_HEIGHT);
        pixelData = pixelImageData.data;
        pixelData.fill(255);
    }

    let glyph = getGlyph(font, encoding);
    if (!glyph || !glyph.glyphBitmap) {
        return 0;
    }

    let x_glyph = x + glyph.x;
    let y_glyph = y + font.ascent - (glyph.y + glyph.height);

    let width = glyph.width;
    let height = glyph.height;

    if (width > 0 && height > 0) {
        let i = 0;
        const offset = (MAX_GLYPH_WIDTH - width) * 4;
        const fgColorRgb = tinycolor(fgColor).toRgb();
        const bgColorRgb = tinycolor(bgColor).toRgb();
        const pixelArray = glyph.glyphBitmap.pixelArray;
        if (pixelArray) {
            if (font.bpp === 8) {
                let pixelArrayIndex = 0;
                const pixelArrayOffset = glyph.glyphBitmap.width - width;
                const mixedColor = { r: 0, g: 0, b: 0 };
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const color = blendColor(
                            fgColorRgb,
                            bgColorRgb,
                            pixelArray[pixelArrayIndex++] / 255,
                            mixedColor
                        );
                        pixelData[i++] = color.r;
                        pixelData[i++] = color.g;
                        pixelData[i++] = color.b;
                        i++;
                    }
                    i += offset;
                    pixelArrayIndex += pixelArrayOffset;
                }
            } else {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixel =
                            pixelArray[getPixelByteIndex(glyph.glyphBitmap, x, y)] &
                            (0x80 >> x % 8);
                        if (pixel) {
                            pixelData[i++] = fgColorRgb.r;
                            pixelData[i++] = fgColorRgb.g;
                            pixelData[i++] = fgColorRgb.b;
                        } else {
                            pixelData[i++] = bgColorRgb.r;
                            pixelData[i++] = bgColorRgb.g;
                            pixelData[i++] = bgColorRgb.b;
                        }
                        i++;
                    }
                    i += offset;
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    pixelData[i++] = bgColorRgb.r;
                    pixelData[i++] = bgColorRgb.g;
                    pixelData[i++] = bgColorRgb.b;
                    i++;
                }
                i += offset;
            }
        }
        ctx.putImageData(pixelImageData, x_glyph, y_glyph, 0, 0, width, height);
    }

    return glyph.dx || 0;
}

export function drawStr(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    font: Font
) {
    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);
        x += drawGlyph(ctx, x, y, encoding, font);
    }
}

export function drawBitmap(
    ctx: CanvasRenderingContext2D,
    bitmap: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) {
    ctx.drawImage(bitmap, x + 0.5, y + 0.5, width, height);
}

////////////////////////////////////////////////////////////////////////////////

export function styleGetBorderRadius(style: Style) {
    return style.borderRadiusProperty;
}

export function styleIsHorzAlignLeft(style: Style) {
    return style.alignHorizontalProperty == "left";
}

export function styleIsHorzAlignRight(style: Style) {
    return style.alignHorizontalProperty == "right";
}

export function styleIsVertAlignTop(style: Style) {
    return style.alignVerticalProperty == "top";
}

export function styleIsVertAlignBottom(style: Style) {
    return style.alignVerticalProperty == "bottom";
}

export function styleGetFont(style: Style) {
    return style.fontObject;
}

////////////////////////////////////////////////////////////////////////////////

export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    style: Style,
    inverse: boolean,
    overrideBackgroundColor?: string
) {
    let x1 = x;
    let y1 = y;
    let x2 = x + w - 1;
    let y2 = y + h - 1;

    const borderSize = style.borderSizeRect;
    let borderRadius = styleGetBorderRadius(style) || 0;
    if (
        borderSize.top > 0 ||
        borderSize.right > 0 ||
        borderSize.bottom > 0 ||
        borderSize.left > 0
    ) {
        setColor(style.borderColorProperty);
        fillRect(ctx, x1, y1, x2, y2, borderRadius);
        x1 += borderSize.left;
        y1 += borderSize.top;
        x2 -= borderSize.right;
        y2 -= borderSize.bottom;
        borderRadius = Math.max(
            borderRadius -
                Math.max(borderSize.top, borderSize.right, borderSize.bottom, borderSize.left),
            0
        );
    }

    const styleColor = style.colorProperty;
    const styleBackgroundColor =
        overrideBackgroundColor !== undefined
            ? overrideBackgroundColor
            : style.backgroundColorProperty;

    let backgroundColor = inverse ? styleColor : styleBackgroundColor;
    setColor(backgroundColor);
    fillRect(ctx, x1, y1, x2, y2, borderRadius);

    const font = styleGetFont(style);
    if (!font) {
        return;
    }

    try {
        text = JSON.parse('"' + text + '"');
    } catch (e) {
        console.log(e, text);
    }

    let width = measureStr(text, font, 0);
    let height = font.height;

    if (width > 0 && height > 0) {
        let x_offset: number;
        if (styleIsHorzAlignLeft(style)) {
            x_offset = x1 + style.paddingRect.left;
        } else if (styleIsHorzAlignRight(style)) {
            x_offset = x2 - style.paddingRect.right - width;
        } else {
            x_offset = Math.floor(x1 + (x2 - x1 + 1 - width) / 2);
            if (x_offset < x1) {
                x_offset = x1;
            }
        }

        let y_offset: number;
        if (styleIsVertAlignTop(style)) {
            y_offset = y1 + style.paddingRect.top;
        } else if (styleIsVertAlignBottom(style)) {
            y_offset = y2 - style.paddingRect.bottom - height;
        } else {
            y_offset = Math.floor(y1 + (y2 - y1 + 1 - height) / 2);
        }

        if (inverse) {
            setBackColor(styleColor);
            setColor(styleBackgroundColor);
        } else {
            setBackColor(styleBackgroundColor);
            setColor(styleColor);
        }
        drawStr(ctx, text, x_offset, y_offset, width, height, font);
    }
}
