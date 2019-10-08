import { getColorRGB, blendColor, to16bitsColor } from "eez-studio-shared/color";

import { Font } from "project-editor/features/gui/font";

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
    return font && font.glyphs._array.find(glyph => glyph.encoding == encoding);
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

function drawGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    encoding: number,
    font: Font
): number {
    let glyph = getGlyph(font, encoding);
    if (!glyph || !glyph.glyphBitmap) {
        return 0;
    }

    let x_glyph = x + glyph.x;
    let y_glyph = y + font.ascent - (glyph.y + glyph.height);

    let width = glyph.width;
    let height = glyph.height;

    if (width > 0 && height > 0) {
        if (font.bpp === 8) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const color = blendColor(fgColor, bgColor, glyph.getPixel(x, y) / 255);
                    const i = (y * MAX_GLYPH_WIDTH + x) * 4;
                    pixelData[i + 0] = color[0];
                    pixelData[i + 1] = color[1];
                    pixelData[i + 2] = color[2];
                }
            }
        } else {
            const fgColorRGB = getColorRGB(fgColor);
            const bgColorRGB = getColorRGB(bgColor);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * MAX_GLYPH_WIDTH + x) * 4;
                    if (glyph.getPixel(x, y)) {
                        pixelData[i + 0] = fgColorRGB.r;
                        pixelData[i + 1] = fgColorRGB.g;
                        pixelData[i + 2] = fgColorRGB.b;
                    } else {
                        pixelData[i + 0] = bgColorRGB.r;
                        pixelData[i + 1] = bgColorRGB.g;
                        pixelData[i + 2] = bgColorRGB.b;
                    }
                }
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
    font: Font
) {
    if (!pixelImageData) {
        pixelImageData = ctx.createImageData(MAX_GLYPH_WIDTH, MAX_GLYPH_HEIGHT);
        pixelData = pixelImageData.data;
        pixelData.fill(255);
    }

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
