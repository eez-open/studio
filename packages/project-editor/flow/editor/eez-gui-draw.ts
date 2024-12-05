import tinycolor from "tinycolor2";

import { getColorRGB, to16bitsColor } from "eez-studio-shared/color";

import { findBitmap } from "project-editor/project/project";
import type { Style } from "project-editor/features/style/style";
import type { Font } from "project-editor/features/font/font";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getPixelByteIndex } from "project-editor/features/font/utils";
import type { IFontExtract } from "project-editor/features/font/font-extract";

////////////////////////////////////////////////////////////////////////////////

type BorderRadiusSpec = {
    topLeftX: number;
    topLeftY: number;
    topRightX: number;
    topRightY: number;
    bottomLeftX: number;
    bottomLeftY: number;
    bottomRightX: number;
    bottomRightY: number;
};

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

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    ctx.fillStyle = fgColor;
    ctx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
}

export function fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lineWidth: number,
    radius: BorderRadiusSpec | number
) {
    const x = x1 + lineWidth / 2;
    const y = y1 + lineWidth / 2;
    const width = x2 - x1 + 1 - lineWidth;
    const height = y2 - y1 + 1 - lineWidth;

    let r: BorderRadiusSpec;
    if (typeof radius == "number") {
        r = {
            topLeftX: radius,
            topLeftY: radius,
            topRightX: radius,
            topRightY: radius,
            bottomLeftX: radius,
            bottomLeftY: radius,
            bottomRightX: radius,
            bottomRightY: radius
        };
    } else {
        r = radius;
    }

    ctx.beginPath();
    ctx.moveTo(x + r.topLeftX, y);
    ctx.lineTo(x + width - r.topRightX, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r.topRightY);
    ctx.lineTo(x + width, y + height - r.bottomRightY);
    ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - r.bottomRightX,
        y + height
    );
    ctx.lineTo(x + r.bottomLeftX, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r.bottomLeftY);
    ctx.lineTo(x, y + r.topLeftY);
    ctx.quadraticCurveTo(x, y, x + r.topLeftX, y);
    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();
    if (lineWidth > 0) {
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

export function drawHLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    l: number
) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.5);
    ctx.lineTo(x + 0.5 + l, y + 0.5);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

export function drawVLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    l: number
) {
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
    if (!glyph || !glyph.pixelArray) {
        return 0;
    }

    const glyphBitmap = {
        width: glyph.width,
        height: glyph.height,
        pixelArray: glyph.pixelArray
    };

    let x_glyph = x + glyph.x;
    let y_glyph = y + font.ascent - (glyph.y + glyph.height);

    let width = glyph.width;
    let height = glyph.height;

    if (width > 0 && height > 0) {
        let i = 0;
        const offset = (MAX_GLYPH_WIDTH - width) * 4;
        const fgColorRgb = tinycolor(fgColor).toRgb();
        const bgColorRgb = tinycolor(bgColor).toRgb();
        const pixelArray = glyphBitmap.pixelArray;
        if (pixelArray) {
            const project = ProjectEditor.getProject(font);
            if (font.bpp === 8 || project.projectTypeTraits.isLVGL) {
                let pixelArrayIndex = 0;
                const pixelArrayOffset = glyph.width - width;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        pixelData[i++] = fgColorRgb.r;
                        pixelData[i++] = fgColorRgb.g;
                        pixelData[i++] = fgColorRgb.b;
                        pixelData[i++] = pixelArray[pixelArrayIndex++];
                    }
                    i += offset;
                    pixelArrayIndex += pixelArrayOffset;
                }
            } else {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixel =
                            pixelArray[getPixelByteIndex(glyphBitmap, x, y)] &
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
                        pixelData[i++] = 255;
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
                    pixelData[i++] = bgColorRgb.a;
                }
                i += offset;
            }
        }
        ctx.fillStyle = bgColor;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas
            .getContext("2d")!
            .putImageData(pixelImageData, 0, 0, 0, 0, width, height);

        ctx.drawImage(canvas, x_glyph, y_glyph);
    }

    return glyph.dx || 0;
}

export function drawGlyph2(encoding: number, fontExtract: IFontExtract) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const glyph = fontExtract.getGlyph && fontExtract.getGlyph(encoding);
    if (glyph) {
        const font = fontExtract.fontProperties;

        let width = glyph.width;
        let height = glyph.height;

        if (glyph.glyphBitmap && width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;

            let ctx = canvas.getContext("2d")!;

            const pixelImageData = ctx.createImageData(width, height);
            const pixelData = pixelImageData.data;

            let i = 0;
            const fgColorRgb = tinycolor(fgColor).toRgb();
            const bgColorRgb = tinycolor(bgColor).toRgb();
            const pixelArray = glyph.glyphBitmap.pixelArray;
            if (pixelArray) {
                if (font.bpp === 8) {
                    let pixelArrayIndex = 0;
                    const pixelArrayOffset = glyph.glyphBitmap.width - width;
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            pixelData[i++] = fgColorRgb.r;
                            pixelData[i++] = fgColorRgb.g;
                            pixelData[i++] = fgColorRgb.b;
                            pixelData[i++] = pixelArray[pixelArrayIndex++];
                        }
                        pixelArrayIndex += pixelArrayOffset;
                    }
                } else {
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const pixel =
                                pixelArray[
                                    getPixelByteIndex(glyph.glyphBitmap, x, y)
                                ] &
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
                    }
                }
            } else {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        pixelData[i++] = bgColorRgb.r;
                        pixelData[i++] = bgColorRgb.g;
                        pixelData[i++] = bgColorRgb.b;
                        pixelData[i++] = bgColorRgb.a;
                    }
                }
            }

            ctx.putImageData(pixelImageData, 0, 0);
        }
    }

    return canvas;
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
    ctx.drawImage(bitmap, x, y, width, height);
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

export function drawBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    style: Style,
    inverse: boolean,
    color?: string
) {
    let x1 = x;
    let y1 = y;
    let x2 = x + width - 1;
    let y2 = y + height - 1;

    if (width > 0 && height > 0) {
        const savedGlobalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = style.opacityProperty / 255;

        if (color == undefined) {
            color = inverse
                ? style.backgroundColorProperty
                : style.colorProperty;
        }

        const borderSize = style.borderSizeRect;
        if (
            borderSize.top > 0 ||
            borderSize.right > 0 ||
            borderSize.bottom > 0 ||
            borderSize.left > 0
        ) {
            setColor(style.borderColorProperty);

            let borderRadius = style.borderRadiusSpec;
            if (
                borderRadius.topLeftX > 0 ||
                borderRadius.topLeftY > 0 ||
                borderRadius.topRightX > 0 ||
                borderRadius.topRightY > 0 ||
                borderRadius.bottomLeftX > 0 ||
                borderRadius.bottomLeftY > 0 ||
                borderRadius.bottomRightX > 0 ||
                borderRadius.bottomRightY > 0
            ) {
                setBackColor(color);

                let lineWidth = borderSize.top;
                if (lineWidth < borderSize.right) {
                    lineWidth = borderSize.right;
                }
                if (lineWidth < borderSize.bottom) {
                    lineWidth = borderSize.bottom;
                }
                if (lineWidth < borderSize.left) {
                    lineWidth = borderSize.left;
                }

                fillRoundedRect(ctx, x1, y1, x2, y2, lineWidth, borderRadius);

                ctx.globalAlpha = savedGlobalAlpha;

                return {
                    x1: x1 + lineWidth,
                    y1: y1 + lineWidth,
                    x2: x2 - lineWidth,
                    y2: y2 - lineWidth
                };
            }

            if (borderSize.left > 0) {
                fillRect(ctx, x1, y1, x1 + borderSize.left - 1, y2);
            }
            if (borderSize.top > 0) {
                fillRect(ctx, x1, y1, x2, y1 + borderSize.top - 1);
            }
            if (borderSize.right > 0) {
                fillRect(ctx, x2 - (borderSize.right - 1), y1, x2, y2);
            }
            if (borderSize.bottom > 0) {
                fillRect(ctx, x1, y2 - (borderSize.bottom - 1), x2, y2);
            }

            x1 += borderSize.left;
            y1 += borderSize.top;
            x2 -= borderSize.right;
            y2 -= borderSize.bottom;
        } else {
            let borderRadius = style.borderRadiusSpec;
            if (
                borderRadius.topLeftX > 0 ||
                borderRadius.topLeftY > 0 ||
                borderRadius.topRightX > 0 ||
                borderRadius.topRightY > 0 ||
                borderRadius.bottomLeftX > 0 ||
                borderRadius.bottomLeftY > 0 ||
                borderRadius.bottomRightX > 0 ||
                borderRadius.bottomRightY > 0
            ) {
                setBackColor(color);

                fillRoundedRect(ctx, x1, y1, x2, y2, 0, borderRadius);

                ctx.globalAlpha = savedGlobalAlpha;

                return {
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2
                };
            }
        }

        setColor(color);
        fillRect(ctx, x1, y1, x2, y2);

        if (style.backgroundImageProperty) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(style),
                style.backgroundImageProperty
            );
            const imageElement = bitmap?.imageElement;
            if (imageElement) {
                drawBitmap(ctx, imageElement, 0, 0, width, height);
            }
        }

        ctx.globalAlpha = savedGlobalAlpha;
    }

    return { x1, y1, x2, y2 };
}

export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    style: Style,
    inverse: boolean,
    overrideBackgroundColor?: string,
    boolSkipBackground: boolean = false
) {
    const styleColor = style.colorProperty;
    const styleBackgroundColor =
        overrideBackgroundColor !== undefined
            ? overrideBackgroundColor
            : style.backgroundColorProperty;

    let { x1, y1, x2, y2 } = boolSkipBackground
        ? { x1: x, y1: y, x2: x + w - 1, y2: y + h - 1 }
        : drawBackground(
              ctx,
              x,
              y,
              w,
              h,
              style,
              false,
              inverse ? styleColor : styleBackgroundColor
          );

    const font = styleGetFont(style);
    if (!font) {
        return;
    }

    try {
        text = JSON.parse('"' + text + '"');
    } catch (e) {}

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

////////////////////////////////////////////////////////////////////////////////

interface ImageBuffer {
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
}

export function pixelRGBA(
    imageBuffer: ImageBuffer,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    x = Math.floor(x);
    y = Math.floor(y);

    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 0] = r;
    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 1] = g;
    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 2] = b;
    imageBuffer.pixels[y * imageBuffer.width * 4 + x * 4 + 3] = a;
}

export function pixelRGBAWeight(
    imageBuffer: ImageBuffer,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
    weight: number
) {
    /*
     * Modify Alpha by weight
     */
    let ax = a;
    ax = (ax * weight) >> 8;
    if (ax > 255) {
        a = 255;
    } else {
        a = ax & 0x000000ff;
    }

    pixelRGBA(imageBuffer, x, y, r, g, b, a);
}

export function vlineRGBA(
    imageBuffer: ImageBuffer,
    x: number,
    y1: number,
    y2: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    x = Math.floor(x);
    y1 = Math.floor(y1);
    y2 = Math.floor(y2);

    if (y1 > y2) {
        const temp = y1;
        y1 = y2;
        y2 = temp;
    }

    for (let y = y1; y <= y2; y++) {
        pixelRGBA(imageBuffer, x, y, r, g, b, a);
    }
}

export function hlineRGBA(
    imageBuffer: ImageBuffer,
    x1: number,
    x2: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    x1 = Math.floor(x1);
    x2 = Math.floor(x2);
    y = Math.floor(y);

    if (x1 > x2) {
        const temp = x1;
        x1 = x2;
        x2 = temp;
    }

    for (let x = x1; x <= x2; x++) {
        pixelRGBA(imageBuffer, x, y, r, g, b, a);
    }
}

export function aalineRGBA(
    imageBuffer: ImageBuffer,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
    g: number,
    b: number,
    a: number,
    draw_endpoint: number
) {
    let xx0: number, yy0: number, xx1: number, yy1: number;
    let erracc: number, erradj: number;
    let wgt: number;
    let dx: number,
        dy: number,
        tmp: number,
        xdir: number,
        y0p1: number,
        x0pxdir: number;

    /*
     * Keep on working with 32bit numbers
     */
    xx0 = x1;
    yy0 = y1;
    xx1 = x2;
    yy1 = y2;

    /*
     * Reorder points to make dy positive
     */
    if (yy0 > yy1) {
        tmp = yy0;
        yy0 = yy1;
        yy1 = tmp;
        tmp = xx0;
        xx0 = xx1;
        xx1 = tmp;
    }

    /*
     * Calculate distance
     */
    dx = xx1 - xx0;
    dy = yy1 - yy0;

    /*
     * Adjust for negative dx and set xdir
     */
    if (dx >= 0) {
        xdir = 1;
    } else {
        xdir = -1;
        dx = -dx;
    }

    /*
     * Check for special cases
     */
    if (dx == 0) {
        /*
         * Vertical line
         */
        if (draw_endpoint) {
            vlineRGBA(imageBuffer, x1, y1, y2, r, g, b, a);
        } else {
            if (dy > 0) {
                vlineRGBA(imageBuffer, x1, yy0, yy0 + dy, r, g, b, a);
            } else {
                pixelRGBA(imageBuffer, x1, y1, r, g, b, a);
            }
        }
        return;
    } else if (dy == 0) {
        /*
         * Horizontal line
         */
        if (draw_endpoint) {
            hlineRGBA(imageBuffer, x1, x2, y1, r, g, b, a);
        } else {
            if (dx > 0) {
                hlineRGBA(imageBuffer, xx0, xx0 + xdir * dx, y1, r, g, b, a);
            } else {
                pixelRGBA(imageBuffer, x1, y1, r, g, b, a);
            }
        }
        return;
    }
    // else if (dx == dy && draw_endpoint) {
    //     /*
    //      * Diagonal line (with endpoint)
    //      */
    //     lineRGBA(imageBuffer, x1, y1, x2, y2, r, g, b, a);
    //     return;
    // }

    /*
     * Zero accumulator
     */
    erracc = 0;

    /*
     * Draw the initial pixel in the foreground color
     */
    pixelRGBA(imageBuffer, x1, y1, r, g, b, a);

    /*
     * x-major or y-major?
     */
    if (dy > dx) {
        /*
         * y-major.  Calculate 16-bit fixed point fractional part of a pixel that
         * X advances every time Y advances 1 pixel, truncating the result so that
         * we won't overrun the endpoint along the X axis
         */
        /*
         * Not-so-portable version: erradj = ((Uint64)dx << 32) / (Uint64)dy;
         */
        erradj = dx / dy;

        /*
         * draw all pixels other than the first and last
         */
        x0pxdir = xx0 + xdir;
        while (--dy) {
            erracc += erradj;
            if (erracc >= 1.0) {
                erracc -= 1.0;
                /*
                 * rollover in error accumulator, x coord advances
                 */
                xx0 = x0pxdir;
                x0pxdir += xdir;
            }
            yy0++; /* y-major so always advance Y */

            /*
             * the AAbits most significant bits of erracc give us the intensity
             * weighting for this pixel, and the complement of the weighting for
             * the paired pixel.
             */
            wgt = Math.floor(erracc * 255);
            pixelRGBAWeight(
                imageBuffer,
                xx0,
                yy0,
                r,
                g,
                b,
                a,
                Number(255 - wgt)
            );
            pixelRGBAWeight(imageBuffer, x0pxdir, yy0, r, g, b, a, Number(wgt));
        }
    } else {
        /*
         * x-major line.  Calculate 16-bit fixed-point fractional part of a pixel
         * that Y advances each time X advances 1 pixel, truncating the result so
         * that we won't overrun the endpoint along the X axis.
         */
        /*
         * Not-so-portable version: erradj = ((Uint64)dy << 32) / (Uint64)dx;
         */
        erradj = dy / dx;

        /*
         * draw all pixels other than the first and last
         */
        y0p1 = yy0 + 1;
        while (--dx) {
            erracc += erradj;
            if (erracc >= 1.0) {
                erracc -= 1.0;
                /*
                 * Accumulator turned over, advance y
                 */
                yy0 = y0p1;
                y0p1++;
            }
            xx0 += xdir; /* x-major so always advance X */
            /*
             * the AAbits most significant bits of erracc give us the intensity
             * weighting for this pixel, and the complement of the weighting for
             * the paired pixel.
             */
            wgt = Math.floor(erracc * 255);
            pixelRGBAWeight(
                imageBuffer,
                xx0,
                yy0,
                r,
                g,
                b,
                a,
                Number(255 - wgt)
            );
            pixelRGBAWeight(imageBuffer, xx0, y0p1, r, g, b, a, Number(wgt));
        }
    }

    /*
     * Do we have to draw the endpoint
     */
    if (draw_endpoint) {
        /*
         * Draw final pixel, always exactly intersected by the line and doesn't
         * need to be weighted.
         */
        pixelRGBA(imageBuffer, x2, y2, r, g, b, a);
    }
}

export function aapolygonRGBA(
    imageBuffer: ImageBuffer,
    vx: number[],
    vy: number[],
    n: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    for (let i = 1; i < n; i++) {
        aalineRGBA(
            imageBuffer,
            vx[i - 1],
            vy[i - 1],
            vx[i],
            vy[i],
            r,
            g,
            b,
            a,
            0
        );
    }

    aalineRGBA(imageBuffer, vx[n - 1], vy[n - 1], vx[0], vy[0], r, g, b, a, 0);
}

export function filledPolygonRGBA(
    imageBuffer: ImageBuffer,
    vx: number[],
    vy: number[],
    n: number,
    r: number,
    g: number,
    b: number,
    a: number
) {
    let i: number;
    let y: number, xa: number, xb: number;
    let miny: number, maxy: number;
    let x1: number, y1: number;
    let x2: number, y2: number;
    let ind1: number, ind2: number;
    let ints: number;
    let gfxPrimitivesPolyInts: number[] = [];

    /*
     * Sanity check number of edges
     */
    if (n < 3) {
        return;
    }

    /*
     * Determine Y maxima
     */
    miny = vy[0];
    maxy = vy[0];
    for (i = 1; i < n; i++) {
        if (vy[i] < miny) {
            miny = vy[i];
        } else if (vy[i] > maxy) {
            maxy = vy[i];
        }
    }

    /*
     * Draw, scanning y
     */
    for (y = miny; y <= maxy; y++) {
        ints = 0;
        for (i = 0; i < n; i++) {
            if (!i) {
                ind1 = n - 1;
                ind2 = 0;
            } else {
                ind1 = i - 1;
                ind2 = i;
            }
            y1 = vy[ind1];
            y2 = vy[ind2];
            if (y1 < y2) {
                x1 = vx[ind1];
                x2 = vx[ind2];
            } else if (y1 > y2) {
                y2 = vy[ind1];
                y1 = vy[ind2];
                x2 = vx[ind1];
                x1 = vx[ind2];
            } else {
                continue;
            }
            if ((y >= y1 && y < y2) || (y == maxy && y > y1 && y <= y2)) {
                gfxPrimitivesPolyInts[ints++] = Math.round(
                    x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)
                );
            }
        }

        gfxPrimitivesPolyInts.sort();

        for (i = 0; i < ints; i += 2) {
            xa = gfxPrimitivesPolyInts[i] + 1;
            xb = gfxPrimitivesPolyInts[i + 1] - 1;
            hlineRGBA(imageBuffer, xa, xb, y, r, g, b, a);
        }

        gfxPrimitivesPolyInts = [];
    }
}

function arcBarAsPolygon(
    xCenter: number,
    yCenter: number,
    radius: number,
    fromAngleDeg: number,
    toAngleDeg: number,
    width: number,
    vx: number[],
    vy: number[],
    n: number
) {
    const fromAngle = (fromAngleDeg * Math.PI) / 180;
    const toAngle = (toAngleDeg * Math.PI) / 180;

    let j = 0;

    vx[j] = Math.round(xCenter + (radius + width / 2.0) * Math.cos(fromAngle));
    vy[j] = Math.round(yCenter - (radius + width / 2.0) * Math.sin(fromAngle));
    j++;

    for (let i = 0; ; i++) {
        const angle = (i * 2 * Math.PI) / n;
        if (angle >= toAngle) {
            break;
        }
        if (angle > fromAngle) {
            vx[j] = Math.round(
                xCenter + (radius + width / 2.0) * Math.cos(angle)
            );
            vy[j] = Math.round(
                yCenter - (radius + width / 2.0) * Math.sin(angle)
            );
            j++;
        }
    }

    vx[j] = Math.round(xCenter + (radius + width / 2.0) * Math.cos(toAngle));
    vy[j] = Math.round(yCenter - (radius + width / 2.0) * Math.sin(toAngle));
    j++;

    vx[j] = Math.round(xCenter + (radius - width / 2.0) * Math.cos(toAngle));
    vy[j] = Math.round(yCenter - (radius - width / 2.0) * Math.sin(toAngle));
    j++;

    for (let i = 0; ; i++) {
        const angle = 2 * Math.PI - (i * 2 * Math.PI) / n;
        if (angle <= fromAngle) {
            break;
        }

        if (angle < toAngle) {
            vx[j] = Math.round(
                xCenter + (radius - width / 2.0) * Math.cos(angle)
            );
            vy[j] = Math.round(
                yCenter - (radius - width / 2.0) * Math.sin(angle)
            );
            j++;
        }
    }

    vx[j] = Math.round(xCenter + (radius - width / 2.0) * Math.cos(fromAngle));
    vy[j] = Math.round(yCenter - (radius - width / 2.0) * Math.sin(fromAngle));
    j++;

    n = j;

    return { n };
}

export function drawArcBar(
    imageBuffer: ImageBuffer,
    xCenter: number,
    yCenter: number,
    radius: number,
    fromAngleDeg: number,
    toAngleDeg: number,
    width: number
) {
    const N = 50;
    const vx: number[] = [];
    const vy: number[] = [];
    const { n } = arcBarAsPolygon(
        xCenter,
        yCenter,
        radius,
        fromAngleDeg,
        toAngleDeg,
        width,
        vx,
        vy,
        N
    );

    let { r, g, b, a } = getColorRGB(fgColor);
    a = Math.floor(a * 255);

    aapolygonRGBA(imageBuffer, vx, vy, n, r, g, b, a);
}

export function fillArcBar(
    imageBuffer: ImageBuffer,
    xCenter: number,
    yCenter: number,
    radius: number,
    fromAngleDeg: number,
    toAngleDeg: number,
    width: number
) {
    const N = 50;
    const vx: number[] = [];
    const vy: number[] = [];
    const { n } = arcBarAsPolygon(
        xCenter,
        yCenter,
        radius,
        fromAngleDeg,
        toAngleDeg,
        width,
        vx,
        vy,
        N
    );

    let { r, g, b, a } = getColorRGB(fgColor);
    a = Math.floor(a * 255);

    filledPolygonRGBA(imageBuffer, vx, vy, n, r, g, b, a);
}

export function fillCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
) {
    ctx.fillStyle = fgColor;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius, 0, 0, Math.PI * 2, false);
    ctx.fill();
}
