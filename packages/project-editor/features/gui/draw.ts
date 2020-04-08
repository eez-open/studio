import { observable, action } from "mobx";

import { getColorRGB, blendColor, to16bitsColor } from "eez-studio-shared/color";

import { getModificationTime, getId } from "project-editor/core/object";

import { findFont } from "project-editor/features/gui/gui";
import { Style, getStyleProperty } from "project-editor/features/gui/style";
import { Font } from "project-editor/features/gui/font";

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
    return font && font.glyphs.find(glyph => glyph.encoding == encoding);
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

////////////////////////////////////////////////////////////////////////////////

export function styleGetBorderRadius(style: Style) {
    return getStyleProperty(style, "borderRadius");
}

export function styleIsHorzAlignLeft(style: Style) {
    return getStyleProperty(style, "alignHorizontal") == "left";
}

export function styleIsHorzAlignRight(style: Style) {
    return getStyleProperty(style, "alignHorizontal") == "right";
}

export function styleIsHorzAlignLeftRight(style: Style) {
    return getStyleProperty(style, "alignHorizontal") == "left-right";
}

export function styleIsVertAlignTop(style: Style) {
    return getStyleProperty(style, "alignVertical") == "top";
}

export function styleIsVertAlignBottom(style: Style) {
    return getStyleProperty(style, "alignVertical") == "bottom";
}

export function styleGetFont(style: Style) {
    let font = getStyleProperty(style, "font");
    return font && findFont(font);
}

////////////////////////////////////////////////////////////////////////////////

export function drawOnCanvas(
    w: number,
    h: number,
    callback: (ctx: CanvasRenderingContext2D) => void
) {
    let canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    callback(ctx);
    return canvas;
}

////////////////////////////////////////////////////////////////////////////////

const MAX_CACHE_SIZE = 2000;

class TextDrawingInBackground {
    @observable cache: string[] = [];
    @observable cacheMap: Map<string, HTMLCanvasElement> = new Map<string, HTMLCanvasElement>();
    @observable tasks: {
        id: string;
        text: string;
        font: Font;
        width: number;
        height: number;
        color: string;
        backColor: string;
    }[] = [];

    requestAnimationFrameId: any;

    runTasks = action(() => {
        this.requestAnimationFrameId = undefined;
        const beginTime = new Date().getTime();
        while (true) {
            const task = this.tasks.shift();
            if (!task) {
                return;
            }

            let canvas = document.createElement("canvas");
            canvas.width = task.width;
            canvas.height = task.height;
            let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
            setColor(task.color);
            setBackColor(task.backColor);
            drawStr(ctx, task.text, 0, 0, task.font);

            this.cache.push(task.id);
            this.cacheMap.set(task.id, canvas);

            if (this.cache.length > MAX_CACHE_SIZE) {
                this.cacheMap.delete(this.cache.shift()!);
            }

            if (new Date().getTime() - beginTime > 100) {
                this.requestAnimationFrameId = window.requestAnimationFrame(this.runTasks);
                return;
            }
        }
    });

    drawStr(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        font: Font
    ) {
        const color = getColor();
        const backColor = getBackColor();
        const id = `${text},${color},${backColor},${getId(font)},${getModificationTime(
            font
        )},${width},${height}`;
        const canvas = this.cacheMap.get(id);
        if (canvas) {
            ctx.drawImage(canvas, x, y);
        } else {
            this.tasks.push({
                id,
                text,
                font,
                width,
                height,
                color,
                backColor
            });
            if (!this.requestAnimationFrameId) {
                this.requestAnimationFrameId = window.requestAnimationFrame(this.runTasks);
            }
        }
    }
}

export const textDrawingInBackground = new TextDrawingInBackground();

////////////////////////////////////////////////////////////////////////////////

export function drawText(
    text: string,
    w: number,
    h: number,
    style: Style,
    inverse: boolean,
    overrideBackgroundColor?: string
) {
    return drawOnCanvas(w, h, (ctx: CanvasRenderingContext2D) => {
        let x1 = 0;
        let y1 = 0;
        let x2 = w - 1;
        let y2 = h - 1;

        const borderSize = style.borderSizeRect;
        let borderRadius = styleGetBorderRadius(style) || 0;
        if (
            borderSize.top > 0 ||
            borderSize.right > 0 ||
            borderSize.bottom > 0 ||
            borderSize.left > 0
        ) {
            setColor(getStyleProperty(style, "borderColor"));
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

        const styleColor = getStyleProperty(style, "color");
        const styleBackgroundColor =
            overrideBackgroundColor !== undefined
                ? overrideBackgroundColor
                : getStyleProperty(style, "backgroundColor");

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
            const horizontallyFits = width <= x2 - x1 + 1;

            let x_offset: number;
            if (
                styleIsHorzAlignLeft(style) ||
                (styleIsHorzAlignLeftRight(style) && horizontallyFits)
            ) {
                x_offset = x1 + style.paddingRect.left;
            } else if (
                styleIsHorzAlignRight(style) ||
                (styleIsHorzAlignLeftRight(style) && !horizontallyFits)
            ) {
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
            textDrawingInBackground.drawStr(ctx, text, x_offset, y_offset, width, height, font);
        }
    });
}
