import React from "react";
import { observable, action } from "mobx";

import { Rect } from "eez-studio-shared/geometry";

import * as data from "project-editor/project/features/data/data";

import * as Widget from "project-editor/project/features/gui/widget";
import { Style, getStyleProperty } from "project-editor/project/features/gui/style";
import { Bitmap } from "project-editor/project/features/gui/bitmap";
import { findFont, findBitmap } from "project-editor/project/features/gui/gui";
import * as lcd from "project-editor/project/features/gui/lcd";
import { Font } from "project-editor/project/features/gui/font";

////////////////////////////////////////////////////////////////////////////////

function styleGetBorderRadius(style: Style) {
    return getStyleProperty(style, "borderRadius");
}

function styleIsHorzAlignLeft(style: Style) {
    return getStyleProperty(style, "alignHorizontal") == "left";
}

function styleIsHorzAlignRight(style: Style) {
    return getStyleProperty(style, "alignHorizontal") == "right";
}

function styleIsVertAlignTop(style: Style) {
    return getStyleProperty(style, "alignVertical") == "top";
}

function styleIsVertAlignBottom(style: Style) {
    return getStyleProperty(style, "alignVertical") == "bottom";
}

function styleGetFont(style: Style) {
    let font = getStyleProperty(style, "font");
    return font && findFont(font);
}

////////////////////////////////////////////////////////////////////////////////

function draw(w: number, h: number, callback: (ctx: CanvasRenderingContext2D) => void) {
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
            const task = this.tasks.pop();
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

const textDrawingInBackground = new TextDrawingInBackground();

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

export function drawMultilineText(
    text: string,
    w: number,
    h: number,
    style: Style,
    inverse: boolean
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

        let backgroundColor = inverse
            ? getStyleProperty(style, "color")
            : getStyleProperty(style, "backgroundColor");
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

        let height = Math.floor(0.9 * font.height);

        x1 += style.paddingRect.left;
        x2 -= style.paddingRect.right;
        y1 += style.paddingRect.top;
        y2 -= style.paddingRect.bottom;

        const spaceGlyph = font.glyphs._array.find(glyph => glyph.encoding == 32);
        const spaceWidth = (spaceGlyph && spaceGlyph.dx) || 0;

        let x = x1;
        let y = y1;

        let i = 0;
        while (true) {
            let j = i;
            while (i < text.length && text[i] != " " && text[i] != "\n") {
                i++;
            }

            let width = lcd.measureStr(text.substr(j, i - j), font, 0);

            while (width > x2 - x + 1) {
                y += height;
                if (y + height > y2) {
                    break;
                }

                x = x1;
            }

            if (y + height > y2) {
                break;
            }

            if (width > 0 && height > 0) {
                if (inverse) {
                    lcd.setBackColor(getStyleProperty(style, "color"));
                    lcd.setColor(getStyleProperty(style, "backgroundColor"));
                } else {
                    lcd.setBackColor(getStyleProperty(style, "backgroundColor"));
                    lcd.setColor(getStyleProperty(style, "color"));
                }

                textDrawingInBackground.drawStr(
                    ctx,
                    text.substr(j, i - j),
                    x,
                    y,
                    width,
                    height,
                    font
                );

                x += width;
            }

            while (text[i] == " ") {
                x += spaceWidth;
                i++;
            }

            if (i == text.length || text[i] == "\n") {
                y += height;

                if (i == text.length) {
                    break;
                }

                i++;

                let extraHeightBetweenParagraphs = Math.floor(0.2 * height);

                y += extraHeightBetweenParagraphs;

                if (y + height > y2) {
                    break;
                }
                x = x1;
            }
        }
    });
}

////////////////////////////////////////////////////////////////////////////////

export function drawBitmap(bitmap: Bitmap, w: number, h: number, style: Style, inverse: boolean) {
    const imageElement = bitmap.imageElement;
    if (!imageElement) {
        return undefined;
    }

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

        let backgroundColor = inverse
            ? getStyleProperty(style, "color")
            : getStyleProperty(style, "backgroundColor");
        lcd.setColor(backgroundColor);
        lcd.fillRect(ctx, x1, y1, x2, y2, borderRadius);

        let width = imageElement.width;
        let height = imageElement.height;

        let x_offset: number;
        if (styleIsHorzAlignLeft(style)) {
            x_offset = x1 + style.paddingRect.left;
        } else if (styleIsHorzAlignRight(style)) {
            x_offset = x2 - style.paddingRect.right - width;
        } else {
            x_offset = Math.floor(x1 + (x2 - x1 - width) / 2);
        }

        let y_offset: number;
        if (styleIsVertAlignTop(style)) {
            y_offset = y1 + style.paddingRect.top;
        } else if (styleIsVertAlignBottom(style)) {
            y_offset = y2 - style.paddingRect.bottom - height;
        } else {
            y_offset = Math.floor(y1 + (y2 - y1 - height) / 2);
        }

        backgroundColor = inverse
            ? getStyleProperty(style, "color")
            : getStyleProperty(style, "backgroundColor");
        lcd.setColor(backgroundColor);
        lcd.fillRect(ctx, x1, y1, x2, y2);

        if (inverse) {
            lcd.setBackColor(getStyleProperty(style, "color"));
            lcd.setColor(getStyleProperty(style, "backgroundColor"));
        } else {
            lcd.setBackColor(getStyleProperty(style, "backgroundColor"));
            lcd.setColor(getStyleProperty(style, "color"));
        }

        lcd.setColor(bitmap.backgroundColor || "transparent");
        lcd.fillRect(ctx, x_offset, y_offset, x_offset + width - 1, y_offset + height - 1);

        lcd.drawBitmap(ctx, imageElement, x_offset, y_offset, width, height);
    });
}

////////////////////////////////////////////////////////////////////////////////

export function drawRectangle(w: number, h: number, style: Style, inverse: boolean) {
    if (w > 0 && h > 0) {
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
                        Math.max(
                            borderSize.top,
                            borderSize.right,
                            borderSize.bottom,
                            borderSize.left
                        ),
                    0
                );
            }

            lcd.setColor(
                inverse
                    ? getStyleProperty(style, "backgroundColor")
                    : getStyleProperty(style, "color")
            );
            lcd.fillRect(ctx, x1, y1, x2, y2, borderRadius);
        });
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export function drawDisplayDataWidget(widget: Widget.Widget, rect: Rect) {
    let text = (widget.data && (data.get(widget.data) as string)) || "";
    return drawText(text, rect.width, rect.height, widget.style, false);
}

export function drawTextWidget(widget: Widget.Widget, rect: Rect) {
    let textWidget = widget as Widget.TextWidget;
    let text = (textWidget.data ? (data.get(textWidget.data) as string) : textWidget.text) || "";
    return drawText(text, rect.width, rect.height, textWidget.style, false);
}

export function drawMultilineTextWidget(widget: Widget.Widget, rect: Rect) {
    let multilineTextWidget = widget as Widget.MultilineTextWidget;
    let text =
        (multilineTextWidget.data
            ? (data.get(multilineTextWidget.data) as string)
            : multilineTextWidget.text) || "";
    return drawMultilineText(text, rect.width, rect.height, multilineTextWidget.style, false);
}

export function drawRectangleWidget(widget: Widget.Widget, rect: Rect) {
    let rectangleWidget = widget as Widget.RectangleWidget;
    return drawRectangle(rect.width, rect.height, widget.style, rectangleWidget.invertColors);
}

export function drawBitmapWidget(widget: Widget.Widget, rect: Rect) {
    let bitmapWidget = widget as Widget.BitmapWidget;

    let bitmap;

    if (bitmapWidget.bitmap) {
        bitmap = findBitmap(bitmapWidget.bitmap);
    } else if (bitmapWidget.data) {
        bitmap = findBitmap(data.get(bitmapWidget.data) as string);
    }

    if (bitmap) {
        return drawBitmap(bitmap, rect.width, rect.height, bitmapWidget.style, false);
    }

    return undefined;
}

export function drawButtonWidget(widget: Widget.Widget, rect: Rect) {
    let buttonWidget = widget as Widget.ButtonWidget;
    let text = buttonWidget.data && data.get(buttonWidget.data);
    if (!text) {
        text = buttonWidget.text;
    }
    let style =
        buttonWidget.enabled && data.getBool(buttonWidget.enabled)
            ? buttonWidget.style
            : buttonWidget.disabledStyle;
    return drawText(text, rect.width, rect.height, style, false);
}

export function drawToggleButtonWidget(widget: Widget.Widget, rect: Rect) {
    let toggleButtonWidget = widget as Widget.ToggleButtonWidget;
    let text = toggleButtonWidget.text1 || "";
    return drawText(text, rect.width, rect.height, toggleButtonWidget.style, false);
}

export function drawButtonGroupWidget(widget: Widget.Widget, rect: Rect) {
    let buttonLabels = (widget.data && data.getValueList(widget.data)) || [];
    let selectedButton = (widget.data && data.get(widget.data)) || 0;
    let style = widget.style;

    return draw(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
        let x = 0;
        let y = 0;
        let w = rect.width;
        let h = rect.height;

        if (w > h) {
            // horizontal orientation
            let buttonWidth = Math.floor(w / buttonLabels.length);
            x += Math.floor((w - buttonWidth * buttonLabels.length) / 2);
            let buttonHeight = h;
            for (let i = 0; i < buttonLabels.length; i++) {
                ctx.drawImage(
                    drawText(
                        buttonLabels[i],
                        buttonWidth,
                        buttonHeight,
                        style,
                        i == selectedButton
                    ),
                    x,
                    y
                );
                x += buttonWidth;
            }
        } else {
            // vertical orientation
            let buttonWidth = w;
            let buttonHeight = Math.floor(h / buttonLabels.length);

            y += Math.floor((h - buttonHeight * buttonLabels.length) / 2);

            let labelHeight = Math.min(buttonWidth, buttonHeight);
            let yOffset = Math.floor((buttonHeight - labelHeight) / 2);

            for (let i = 0; i < buttonLabels.length; i++) {
                ctx.drawImage(
                    drawText(buttonLabels[i], buttonWidth, labelHeight, style, i == selectedButton),
                    x,
                    y + yOffset
                );
                y += buttonHeight;
            }
        }
    });
}

function drawScale(
    ctx: CanvasRenderingContext2D,
    scaleWidget: Widget.ScaleWidget,
    rect: Rect,
    y_from: number,
    y_to: number,
    y_min: number,
    y_max: number,
    y_value: number,
    f: number,
    d: number
) {
    let vertical = scaleWidget.needlePosition == "left" || scaleWidget.needlePosition == "right";
    let flip = scaleWidget.needlePosition == "left" || scaleWidget.needlePosition == "top";

    let needleSize: number;

    let x1: number, l1: number, x2: number, l2: number;
    if (vertical) {
        needleSize = scaleWidget.needleHeight || 0;

        if (flip) {
            x1 = scaleWidget.needleWidth + 2;
            l1 = rect.width - (scaleWidget.needleWidth + 2);
            x2 = 0;
            l2 = scaleWidget.needleWidth || 0;
        } else {
            x1 = 0;
            l1 = rect.width - (scaleWidget.needleWidth + 2);
            x2 = rect.width - scaleWidget.needleWidth;
            l2 = scaleWidget.needleWidth || 0;
        }
    } else {
        needleSize = scaleWidget.needleWidth || 0;

        if (flip) {
            x1 = scaleWidget.needleHeight + 2;
            l1 = rect.height - (scaleWidget.needleHeight + 2);
            x2 = 0;
            l2 = scaleWidget.needleHeight || 0;
        } else {
            x1 = 0;
            l1 = rect.height - scaleWidget.needleHeight - 2;
            x2 = rect.height - scaleWidget.needleHeight;
            l2 = scaleWidget.needleHeight || 0;
        }
    }

    let s = (10 * f) / d;

    let y_offset: number;
    if (vertical) {
        y_offset = Math.floor(rect.height - 1 - (rect.height - (y_max - y_min)) / 2);
    } else {
        y_offset = Math.floor((rect.width - (y_max - y_min)) / 2);
    }

    let style = scaleWidget.style;

    for (let y_i = y_from; y_i <= y_to; y_i++) {
        let y: number;

        if (vertical) {
            y = y_offset - y_i;
        } else {
            y = y_offset + y_i;
        }

        // draw ticks
        if (y_i >= y_min && y_i <= y_max) {
            if (y_i % s == 0) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                if (vertical) {
                    lcd.drawHLine(ctx, x1, y, l1);
                } else {
                    lcd.drawVLine(ctx, y, x1, l1);
                }
            } else if (y_i % (s / 2) == 0) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                if (vertical) {
                    if (flip) {
                        lcd.drawHLine(ctx, x1 + l1 / 2, y, l1 / 2);
                    } else {
                        lcd.drawHLine(ctx, x1, y, l1 / 2);
                    }
                } else {
                    if (flip) {
                        lcd.drawVLine(ctx, y, x1 + l1 / 2, l1 / 2);
                    } else {
                        lcd.drawVLine(ctx, y, x1, l1 / 2);
                    }
                }
            } else if (y_i % (s / 10) == 0) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                if (vertical) {
                    if (flip) {
                        lcd.drawHLine(ctx, x1 + l1 - l1 / 4, y, l1 / 4);
                    } else {
                        lcd.drawHLine(ctx, x1, y, l1 / 4);
                    }
                } else {
                    if (flip) {
                        lcd.drawVLine(ctx, y, x1 + l1 - l1 / 4, l1 / 4);
                    } else {
                        lcd.drawVLine(ctx, y, x1, l1 / 4);
                    }
                }
            } else {
                lcd.setColor(getStyleProperty(style, "backgroundColor"));
                if (vertical) {
                    lcd.drawHLine(ctx, x1, y, l1);
                } else {
                    lcd.drawVLine(ctx, y, x1, l1);
                }
            }
        }

        let d = Math.abs(y_i - y_value);
        if (d <= Math.floor(needleSize / 2)) {
            // draw thumb
            lcd.setColor(getStyleProperty(style, "color"));
            if (vertical) {
                if (flip) {
                    lcd.drawHLine(ctx, x2, y, l2 - d);
                } else {
                    lcd.drawHLine(ctx, x2 + d, y, l2 - d);
                }
            } else {
                if (flip) {
                    lcd.drawVLine(ctx, y, x2, l2 - d);
                } else {
                    lcd.drawVLine(ctx, y, x2 + d, l2 - d);
                }
            }

            if (y_i != y_value) {
                lcd.setColor(getStyleProperty(style, "backgroundColor"));
                if (vertical) {
                    if (flip) {
                        lcd.drawHLine(ctx, x2 + l2 - d, y, d);
                    } else {
                        lcd.drawHLine(ctx, x2, y, d);
                    }
                } else {
                    if (flip) {
                        lcd.drawVLine(ctx, y, x2 + l2 - d, d);
                    } else {
                        lcd.drawVLine(ctx, y, x2, d);
                    }
                }
            }
        } else {
            // erase
            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            if (vertical) {
                lcd.drawHLine(ctx, x2, y, l2);
            } else {
                lcd.drawVLine(ctx, y, x2, l2);
            }
        }
    }
}

export function drawScaleWidget(widget: Widget.Widget, rect: Rect) {
    let scaleWidget = widget as Widget.ScaleWidget;
    let style = scaleWidget.style;

    return draw(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
        let value = 0;
        let min = (scaleWidget.data && data.getMin(scaleWidget.data)) || 0;
        let max = (scaleWidget.data && data.getMax(scaleWidget.data)) || 0;

        lcd.setColor(getStyleProperty(style, "backgroundColor"));
        lcd.fillRect(ctx, 0, 0, rect.width - 1, rect.height - 1);

        let vertical =
            scaleWidget.needlePosition == "left" || scaleWidget.needlePosition == "right";

        let needleSize: number;
        let f: number;
        if (vertical) {
            needleSize = scaleWidget.needleHeight || 0;
            f = Math.floor((rect.height - needleSize) / max);
        } else {
            needleSize = scaleWidget.needleWidth || 0;
            f = Math.floor((rect.width - needleSize) / max);
        }

        let d: number;
        if (max > 10) {
            d = 1;
        } else {
            f = 10 * (f / 10);
            d = 10;
        }

        let y_min = Math.round(min * f);
        let y_max = Math.round(max * f);
        let y_value = Math.round(value * f);

        let y_from_min = y_min - Math.floor(needleSize / 2);
        let y_from_max = y_max + Math.floor(needleSize / 2);

        drawScale(ctx, scaleWidget, rect, y_from_min, y_from_max, y_min, y_max, y_value, f, d);
    });
}

export function drawBarGraphWidget(widget: Widget.Widget, rect: Rect) {
    let barGraphWidget = widget as Widget.BarGraphWidget;
    let style = barGraphWidget.style;

    return draw(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
        let min = (barGraphWidget.data && data.getMin(barGraphWidget.data)) || 0;
        let max = (barGraphWidget.data && data.getMax(barGraphWidget.data)) || 0;
        let valueText = (barGraphWidget.data && data.get(barGraphWidget.data)) || "0";
        let value = parseFloat(valueText);
        if (isNaN(value)) {
            value = 0;
        }
        let horizontal =
            barGraphWidget.orientation == "left-right" ||
            barGraphWidget.orientation == "right-left";

        let d = horizontal ? rect.width : rect.height;

        function calcPos(value: number) {
            let pos = Math.round((value * d) / (max - min));
            if (pos < 0) {
                pos = 0;
            }
            if (pos > d) {
                pos = d;
            }
            return pos;
        }

        let pos = calcPos(value);

        if (barGraphWidget.orientation == "left-right") {
            lcd.setColor(getStyleProperty(style, "color"));
            lcd.fillRect(ctx, 0, 0, pos - 1, rect.height - 1);
            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            lcd.fillRect(ctx, pos, 0, rect.width - 1, rect.height - 1);
        } else if (barGraphWidget.orientation == "right-left") {
            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            lcd.fillRect(ctx, 0, 0, rect.width - pos - 1, rect.height - 1);
            lcd.setColor(getStyleProperty(style, "color"));
            lcd.fillRect(ctx, rect.width - pos, 0, rect.width - 1, rect.height - 1);
        } else if (barGraphWidget.orientation == "top-bottom") {
            lcd.setColor(getStyleProperty(style, "color"));
            lcd.fillRect(ctx, 0, 0, rect.width - 1, pos - 1);
            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            lcd.fillRect(ctx, 0, pos, rect.width - 1, rect.height - 1);
        } else {
            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            lcd.fillRect(ctx, 0, 0, rect.width - 1, rect.height - pos - 1);
            lcd.setColor(getStyleProperty(style, "color"));
            lcd.fillRect(ctx, 0, rect.height - pos, rect.width - 1, rect.height - 1);
        }

        if (horizontal) {
            let textStyle = barGraphWidget.textStyle;
            const font = styleGetFont(textStyle);
            if (font) {
                let w = lcd.measureStr(valueText, font, rect.width);
                w += style.paddingRect.left;

                if (w > 0 && rect.height > 0) {
                    let backgroundColor: string;
                    let x: number;

                    if (pos + w <= rect.width) {
                        backgroundColor = getStyleProperty(style, "backgroundColor");
                        x = pos;
                    } else {
                        backgroundColor = getStyleProperty(style, "color");
                        x = pos - w - style.paddingRect.right;
                    }

                    ctx.drawImage(
                        drawText(valueText, w, rect.height, textStyle, false, backgroundColor),
                        x,
                        0
                    );
                }
            }
        }

        function drawLine(lineData: string | undefined, lineStyle: Style) {
            let value = (lineData && parseFloat(data.get(lineData))) || 0;
            if (isNaN(value)) {
                value = 0;
            }
            let pos = calcPos(value);
            if (pos == d) {
                pos = d - 1;
            }
            lcd.setColor(getStyleProperty(lineStyle, "color"));
            if (barGraphWidget.orientation == "left-right") {
                lcd.drawVLine(ctx, pos, 0, rect.height - 1);
            } else if (barGraphWidget.orientation == "right-left") {
                lcd.drawVLine(ctx, rect.width - pos, 0, rect.height - 1);
            } else if (barGraphWidget.orientation == "top-bottom") {
                lcd.drawHLine(ctx, 0, pos, rect.width - 1);
            } else {
                lcd.drawHLine(ctx, 0, rect.height - pos, rect.width - 1);
            }
        }

        drawLine(barGraphWidget.line1Data, barGraphWidget.line1Style);
        drawLine(barGraphWidget.line2Data, barGraphWidget.line2Style);
    });
}

////////////////////////////////////////////////////////////////////////////////

export function drawYTGraphWidget(widget: Widget.Widget, rect: Rect) {
    let ytGraphWidget = widget as Widget.YTGraphWidget;
    let style = ytGraphWidget.style;

    return draw(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
        let x1 = 0;
        let y1 = 0;
        let x2 = rect.width - 1;
        let y2 = rect.height - 1;

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

        lcd.setColor(getStyleProperty(style, "backgroundColor"));
        lcd.fillRect(ctx, x1, y1, x2, y2, borderRadius);
    });
}

////////////////////////////////////////////////////////////////////////////////

export function drawUpDownWidget(widget: Widget.Widget, rect: Rect) {
    let upDownWidget = widget as Widget.UpDownWidget;
    let style = upDownWidget.style;
    let buttonsStyle = upDownWidget.buttonsStyle;

    return draw(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
        const buttonsFont = styleGetFont(buttonsStyle);
        if (!buttonsFont) {
            return;
        }

        let downButtonCanvas = drawText(
            upDownWidget.downButtonText || "<",
            buttonsFont.height,
            rect.height,
            buttonsStyle,
            false
        );
        ctx.drawImage(downButtonCanvas, 0, 0);

        let text = upDownWidget.data ? (data.get(upDownWidget.data) as string) : "";
        let textCanvas = drawText(
            text,
            rect.width - 2 * buttonsFont.height,
            rect.height,
            style,
            false
        );
        ctx.drawImage(textCanvas, buttonsFont.height, 0);

        let upButonCanvas = drawText(
            upDownWidget.upButtonText || ">",
            buttonsFont.height,
            rect.height,
            buttonsStyle,
            false
        );
        ctx.drawImage(upButonCanvas, rect.width - buttonsFont.height, 0);
    });
}

////////////////////////////////////////////////////////////////////////////////

export function drawListGraphWidget(widget: Widget.Widget, rect: Rect) {
    let listGraphWidget = widget as Widget.ListGraphWidget;
    let style = listGraphWidget.style;

    return draw(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
        let x1 = 0;
        let y1 = 0;
        let x2 = rect.width - 1;
        let y2 = rect.height - 1;

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

        lcd.setColor(getStyleProperty(style, "backgroundColor"));
        lcd.fillRect(ctx, x1, y1, x2, y2, borderRadius);
    });
}

////////////////////////////////////////////////////////////////////////////////

export function renderRootElement(child: React.ReactNode) {
    return child;
}
