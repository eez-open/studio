import { blendColor } from "eez-studio-shared/util";

import { FontProperties } from "project-editor/project/features/gui/fontMetaData";

let fgColor: string;
let bgColor: string;
let x: number, y: number, x1: number, y1: number, x2: number, y2: number;

export function setColor(color: string) {
    fgColor = color;
}

export function setBackColor(color: string) {
    bgColor = color;
}

export function drawRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    ctx.beginPath();
    ctx.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 1;
    ctx.stroke();
}

export function fillRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    ctx.beginPath();
    ctx.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    ctx.fillStyle = fgColor;
    ctx.fill();
}

export function drawHLine(ctx: CanvasRenderingContext2D, x: number, y: number, l: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l, y);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

export function drawVLine(ctx: CanvasRenderingContext2D, x: number, y: number, l: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + l);
    ctx.strokeStyle = fgColor;
    ctx.stroke();
}

function setPixel(ctx: CanvasRenderingContext2D, color: string) {
    ctx.beginPath();
    ctx.rect(x, y, 1, 1);
    ctx.fillStyle = color;
    ctx.fill();

    if (++x > x2) {
        x = x1;
        if (++y > y2) {
            y = y1;
        }
    }
}

function setXY(x1_: number, y1_: number, x2_: number, y2_: number) {
    x1 = x1_;
    y1 = y1_;
    x2 = x2_;
    y2 = y2_;

    x = x1;
    y = y1;
}

function getGlyph(font: FontProperties, encoding: number) {
    return font && font.glyphs.find(glyph => glyph.encoding == encoding);
}

function measureGlyph(encoding: number, font: FontProperties): number {
    let glyph = getGlyph(font, encoding);
    if (!glyph) {
        return 0;
    }

    return glyph.dx || 0;
}

export function measureStr(text: string, font: FontProperties, maxWidth: number): number {
    let width = 0;

    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);
        let glyph_width = measureGlyph(encoding, font);
        if (maxWidth > 0 && width + glyph_width > maxWidth) {
            break;
        }
        width += glyph_width;
    }

    return width;
}

function drawGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    encoding: number,
    font: FontProperties
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
        setXY(x_glyph, y_glyph, x_glyph + width - 1, y_glyph + height - 1);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (font.bpp === 8) {
                    setPixel(ctx, blendColor(fgColor, bgColor, glyph.getPixel(x, y) / 255));
                } else {
                    setPixel(ctx, glyph.getPixel(x, y) ? fgColor : bgColor);
                }
            }
        }
    }

    return glyph.dx || 0;
}

export function drawStr(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: FontProperties
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
