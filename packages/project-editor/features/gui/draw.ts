import { observable, action } from "mobx";

import { findFont } from "project-editor/features/gui/gui";
import { Style, getStyleProperty } from "project-editor/features/gui/style";
import * as lcd from "project-editor/features/gui/lcd";
import { Font } from "project-editor/features/gui/font";

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

export function draw(w: number, h: number, callback: (ctx: CanvasRenderingContext2D) => void) {
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
            lcd.setColor(task.color);
            lcd.setBackColor(task.backColor);
            lcd.drawStr(ctx, task.text, 0, 0, task.font);

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
        const color = lcd.getColor();
        const backColor = lcd.getBackColor();
        const id = `${text},${color},${backColor},${font._id},${font._modificationTime}`;
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
    return draw(w, h, (ctx: CanvasRenderingContext2D) => {
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
            lcd.setColor(getStyleProperty(style, "borderColor"));
            lcd.fillRect(ctx, x1, y1, x2, y2, borderRadius);
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
        lcd.setColor(backgroundColor);
        lcd.fillRect(ctx, x1, y1, x2, y2, borderRadius);

        const font = styleGetFont(style);
        if (!font) {
            return;
        }

        try {
            text = JSON.parse('"' + text + '"');
        } catch (e) {
            console.log(e, text);
        }

        let width = lcd.measureStr(text, font, x2 - x1 + 1);
        let height = font.height;

        if (width > 0 && height > 0) {
            let x_offset: number;
            if (styleIsHorzAlignLeft(style)) {
                x_offset = x1 + style.paddingRect.left;
            } else if (styleIsHorzAlignRight(style)) {
                x_offset = x2 - style.paddingRect.right - width;
            } else {
                x_offset = Math.floor(x1 + (x2 - x1 + 1 - width) / 2);
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
                lcd.setBackColor(styleColor);
                lcd.setColor(styleBackgroundColor);
            } else {
                lcd.setBackColor(styleBackgroundColor);
                lcd.setColor(styleColor);
            }
            textDrawingInBackground.drawStr(ctx, text, x_offset, y_offset, width, height, font);
        }
    });
}
