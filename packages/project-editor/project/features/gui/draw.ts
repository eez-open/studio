import { Rect } from "project-editor/core/util";
import { isObjectInstanceOf, objectToJS } from "project-editor/core/store";
import { EezObject, EezArrayObject } from "project-editor/core/metaData";

import * as data from "project-editor/project/features/data/data";

import * as Widget from "project-editor/project/features/gui/widget";
import {
    Style,
    getStyleProperty,
    getDefaultStyle
} from "project-editor/project/features/gui/style";
import { Bitmap } from "project-editor/project/features/gui/bitmap";
import {
    findPage,
    findStyle,
    findStyleOrGetDefault,
    findFont,
    findBitmap
} from "project-editor/project/features/gui/gui";
import * as lcd from "project-editor/project/features/gui/lcd";
import { createWidgetTree } from "project-editor/project/features/gui/widget-tree";

import { drawTree } from "project-editor/components/CanvasEditorUtil";

////////////////////////////////////////////////////////////////////////////////

const MAX_DRAW_CACHE_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

export interface WidgetCursor {
    widget: Widget.Widget;
    x: number;
    y: number;
    width: number;
    height: number;
}

////////////////////////////////////////////////////////////////////////////////

function styleHasBorder(style: Style) {
    return getStyleProperty(style, "borderSize") == 1;
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

let cache: string[] = [];
let cacheMap: Map<string, HTMLCanvasElement> = new Map<string, HTMLCanvasElement>();

function drawFromCache(
    section: string,
    id: string,
    w: number,
    h: number,
    callback: (ctx: CanvasRenderingContext2D) => void
) {
    id = section + "." + id;
    let canvas = cacheMap.get(id);
    if (!canvas) {
        canvas = document.createElement("canvas");

        canvas.width = w;
        canvas.height = h;

        let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

        callback(ctx);

        if (cache.length == MAX_DRAW_CACHE_SIZE) {
            let cacheKey = cache.shift();
            if (cacheKey) {
                cacheMap.delete(cacheKey);
            }
        }
        cache.push(id);
        cacheMap.set(id, canvas);

        //let fs = EEZStudio.electron.remote.require('fs');
        //fs.writeFileSync('C:\\Users\\martin\\temp\\' + id.replace(/[^a-zA-Z_0-9]/g, '_') + '.png', canvas.toDataURL().substring("data:image/png;base64,".length), 'base64');
    }

    return canvas;
}

////////////////////////////////////////////////////////////////////////////////

function getCacheId(obj: EezObject) {
    let id: string = "";

    let modificationTime = obj._modificationTime;
    if (modificationTime != undefined) {
        id = obj._id + "-" + modificationTime;
    } else {
        id = obj._id;
    }

    if (isObjectInstanceOf(obj, Style.classInfo)) {
        let style = obj as Style;

        const font = styleGetFont(style);
        if (font) {
            id += getCacheId(font);
        }

        let inheritFromStyle = style.inheritFrom && findStyle(style.inheritFrom);
        if (inheritFromStyle) {
            id += "," + getCacheId(inheritFromStyle);
        } else {
            let defaultStyle = getDefaultStyle();
            if (style != defaultStyle) {
                id += "," + getCacheId(defaultStyle);
            }
        }
    }

    return id;
}

////////////////////////////////////////////////////////////////////////////////

export function drawText(
    text: string,
    w: number,
    h: number,
    style: Style,
    inverse: boolean
) {
    return drawFromCache(
        "drawText",
        getCacheId(style) + "." + text + "." + w + "." + h + "." + inverse,
        w,
        h,
        (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = w - 1;
            let y2 = h - 1;

            if (styleHasBorder(style)) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                lcd.drawRect(ctx, x1, y1, x2, y2);
                x1++;
                y1++;
                x2--;
                y2--;
            }

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

            let x_offset: number;
            if (styleIsHorzAlignLeft(style)) {
                x_offset = x1 + getStyleProperty(style, "paddingHorizontal");
            } else if (styleIsHorzAlignRight(style)) {
                x_offset = x2 - getStyleProperty(style, "paddingHorizontal") - width;
            } else {
                x_offset = Math.floor(x1 + (x2 - x1 + 1 - width) / 2);
            }

            let y_offset: number;
            if (styleIsVertAlignTop(style)) {
                y_offset = y1 + getStyleProperty(style, "paddingVertical");
            } else if (styleIsVertAlignBottom(style)) {
                y_offset = y2 - getStyleProperty(style, "paddingVertical") - height;
            } else {
                y_offset = Math.floor(y1 + (y2 - y1 + 1 - height) / 2);
            }

            let backgroundColor = inverse
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
            lcd.drawStr(ctx, text, x_offset, y_offset, font);
        }
    );
}

export function drawMultilineText(
    text: string,
    w: number,
    h: number,
    style: Style,
    inverse: boolean
) {
    return drawFromCache(
        "drawMultilineText",
        getCacheId(style) + "." + text + "." + w + "." + h + "." + inverse,
        w,
        h,
        (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = w - 1;
            let y2 = h - 1;

            if (styleHasBorder(style)) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                lcd.drawRect(ctx, x1, y1, x2, y2);
                x1++;
                y1++;
                x2--;
                y2--;
            }

            let backgroundColor = inverse
                ? getStyleProperty(style, "color")
                : getStyleProperty(style, "backgroundColor");
            lcd.setColor(backgroundColor);
            lcd.fillRect(ctx, x1, y1, x2, y2);

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

            x1 += getStyleProperty(style, "paddingHorizontal");
            x2 -= getStyleProperty(style, "paddingHorizontal");
            y1 += getStyleProperty(style, "paddingVertical");
            y2 -= getStyleProperty(style, "paddingVertical");

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

                if (inverse) {
                    lcd.setBackColor(getStyleProperty(style, "color"));
                    lcd.setColor(getStyleProperty(style, "backgroundColor"));
                } else {
                    lcd.setBackColor(getStyleProperty(style, "backgroundColor"));
                    lcd.setColor(getStyleProperty(style, "color"));
                }

                lcd.drawStr(ctx, text.substr(j, i - j), x, y, font);

                x += width;

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
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

export function drawBitmap(
    bitmap: Bitmap,
    w: number,
    h: number,
    style: Style,
    inverse: boolean
) {
    const imageElement = bitmap.imageElement;
    if (!imageElement) {
        return undefined;
    }

    return drawFromCache(
        "drawBitmap",
        getCacheId(style) + "." + getCacheId(bitmap) + "." + "." + w + "." + h + "." + inverse,
        w,
        h,
        (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = w - 1;
            let y2 = h - 1;

            if (styleHasBorder(style)) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                lcd.drawRect(ctx, x1, y1, x2, y2);
                x1++;
                y1++;
                x2--;
                y2--;
            }

            let backgroundColor = inverse
                ? getStyleProperty(style, "color")
                : getStyleProperty(style, "backgroundColor");
            lcd.setColor(backgroundColor);
            lcd.fillRect(ctx, x1, y1, x2, y2);

            let width = imageElement.width;
            let height = imageElement.height;

            let x_offset: number;
            if (styleIsHorzAlignLeft(style)) {
                x_offset = x1 + getStyleProperty(style, "paddingHorizontal");
            } else if (styleIsHorzAlignRight(style)) {
                x_offset = x2 - getStyleProperty(style, "paddingHorizontal") - width;
            } else {
                x_offset = Math.floor(x1 + (x2 - x1 - width) / 2);
            }

            let y_offset: number;
            if (styleIsVertAlignTop(style)) {
                y_offset = y1 + getStyleProperty(style, "paddingVertical");
            } else if (styleIsVertAlignBottom(style)) {
                y_offset = y2 - getStyleProperty(style, "paddingVertical") - height;
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

            lcd.setColor(getStyleProperty(bitmap && bitmap.style, "backgroundColor"));
            lcd.fillRect(ctx, x_offset, y_offset, x_offset + width - 1, y_offset + height - 1);

            lcd.drawBitmap(ctx, imageElement, x_offset, y_offset, width, height);
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

export function drawRectangle(w: number, h: number, style: Style, inverse: boolean) {
    if (w > 0 && h > 0) {
        return drawFromCache(
            "drawRectangle",
            getCacheId(style) + "." + w + "." + h + "." + inverse,
            w,
            h,
            (ctx: CanvasRenderingContext2D) => {
                let x1 = 0;
                let y1 = 0;
                let x2 = w - 1;
                let y2 = h - 1;

                if (styleHasBorder(style)) {
                    lcd.setColor(getStyleProperty(style, "borderColor"));
                    lcd.drawRect(ctx, x1, y1, x2, y2);
                    x1++;
                    y1++;
                    x2--;
                    y2--;
                }

                lcd.setColor(
                    inverse
                        ? getStyleProperty(style, "backgroundColor")
                        : getStyleProperty(style, "color")
                );
                lcd.fillRect(ctx, x1, y1, x2, y2);
            }
        );
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export function drawDefaultWidget(widget: Widget.Widget, rect: Rect) {
    return drawRectangle(rect.width, rect.height, findStyleOrGetDefault(widget.style), true);
}

export function drawDisplayDataWidget(widget: Widget.Widget, rect: Rect) {
    let text = (widget.data && ((<string>data.get(widget.data)) as string)) || "";
    return drawText(text, rect.width, rect.height, findStyleOrGetDefault(widget.style), false);
}

export function drawTextWidget(widget: Widget.Widget, rect: Rect) {
    let textWidget = widget as Widget.TextWidget;
    let text = (textWidget.data ? (data.get(textWidget.data) as string) : textWidget.text) || "";
    return drawText(text, rect.width, rect.height, findStyleOrGetDefault(textWidget.style), false);
}

export function drawMultilineTextWidget(widget: Widget.Widget, rect: Rect) {
    let multilineTextWidget = widget as Widget.MultilineTextWidget;
    let text =
        (multilineTextWidget.data
            ? (data.get(multilineTextWidget.data) as string)
            : multilineTextWidget.text) || "";
    return drawMultilineText(
        text,
        rect.width,
        rect.height,
        findStyleOrGetDefault(multilineTextWidget.style),
        false
    );
}

export function drawRectangleWidget(widget: Widget.Widget, rect: Rect) {
    let rectangleWidget = widget as Widget.RectangleWidget;
    return drawRectangle(
        rect.width,
        rect.height,
        findStyleOrGetDefault(widget.style),
        rectangleWidget.invertColors
    );
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
        return drawBitmap(
            bitmap,
            rect.width,
            rect.height,
            findStyleOrGetDefault(bitmapWidget.style),
            false
        );
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
    return drawText(text, rect.width, rect.height, findStyleOrGetDefault(style), false);
}

export function drawToggleButtonWidget(widget: Widget.Widget, rect: Rect) {
    let toggleButtonWidget = widget as Widget.ToggleButtonWidget;
    let text = toggleButtonWidget.text1 || "";
    return drawText(
        text,
        rect.width,
        rect.height,
        findStyleOrGetDefault(toggleButtonWidget.style),
        false
    );
}

export function drawButtonGroupWidget(widget: Widget.Widget, rect: Rect) {
    let buttonLabels = (widget.data && data.getValueList(widget.data)) || [];
    let selectedButton = (widget.data && <number>data.get(widget.data)) || 0;
    let style = findStyleOrGetDefault(widget.style);

    return drawFromCache(
        "drawButtonGroup",

        getCacheId(style) +
            "." +
            buttonLabels.join(",") +
            "." +
            selectedButton +
            "." +
            rect.width +
            "." +
            rect.height,

        rect.width,
        rect.height,

        (ctx: CanvasRenderingContext2D) => {
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
                        drawText(
                            buttonLabels[i],
                            buttonWidth,
                            labelHeight,
                            style,
                            i == selectedButton
                        ),
                        x,
                        y + yOffset
                    );
                    y += buttonHeight;
                }
            }
        }
    );
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

    let style = findStyleOrGetDefault(scaleWidget.style);

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
    let style = findStyleOrGetDefault(scaleWidget.style);

    return drawFromCache(
        "drawScaleWidget",

        getCacheId(style) +
            "." +
            scaleWidget.data +
            "." +
            scaleWidget.needlePosition +
            "." +
            scaleWidget.needleHeight +
            "." +
            rect.width +
            "." +
            rect.height,

        rect.width,
        rect.height,

        (ctx: CanvasRenderingContext2D) => {
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
        }
    );
}

export function drawBarGraphWidget(widget: Widget.Widget, rect: Rect) {
    let barGraphWidget = widget as Widget.BarGraphWidget;
    let style = findStyleOrGetDefault(barGraphWidget.style);

    return drawFromCache(
        "drawBarGraphWidget",

        getCacheId(style) +
            "." +
            barGraphWidget.data +
            "." +
            barGraphWidget.orientation +
            "." +
            barGraphWidget.textStyle +
            "." +
            barGraphWidget.line1Data +
            "." +
            barGraphWidget.line1Style +
            "." +
            barGraphWidget.line2Data +
            "." +
            barGraphWidget.line2Style +
            "." +
            rect.width +
            "." +
            rect.height,

        rect.width,
        rect.height,

        (ctx: CanvasRenderingContext2D) => {
            let min = (barGraphWidget.data && data.getMin(barGraphWidget.data)) || 0;
            let max = (barGraphWidget.data && data.getMax(barGraphWidget.data)) || 0;

            let valueText = (barGraphWidget.data && <string>data.get(barGraphWidget.data)) || "0";
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
                let textStyle = findStyleOrGetDefault(barGraphWidget.textStyle);
                const font = styleGetFont(textStyle);
                if (font) {
                    let w = lcd.measureStr(valueText, font, rect.width);

                    let padding = getStyleProperty(textStyle, "paddingHorizontal");
                    w += padding;

                    let modifiedTextStyle: Style = objectToJS(textStyle);

                    let x: number;
                    if (pos + w <= rect.width) {
                        modifiedTextStyle.backgroundColor = getStyleProperty(
                            style,
                            "backgroundColor"
                        );
                        x = pos;
                    } else {
                        modifiedTextStyle.backgroundColor = getStyleProperty(style, "color");
                        x = pos - w - padding;
                    }

                    ctx.drawImage(
                        drawText(valueText, w, rect.height, modifiedTextStyle, false),
                        x,
                        0
                    );
                }
            }

            function drawLine(lineData: string | undefined, lineStyle: string | undefined) {
                let value = (lineData && parseFloat(<string>data.get(lineData))) || 0;
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
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

export function drawYTGraphWidget(widget: Widget.Widget, rect: Rect) {
    let ytGraphWidget = widget as Widget.YTGraphWidget;
    let style = findStyleOrGetDefault(ytGraphWidget.style);

    return drawFromCache(
        "drawYTGraphWidget",

        getCacheId(style) +
            "." +
            ytGraphWidget.y1Style +
            "." +
            ytGraphWidget.y2Data +
            "." +
            ytGraphWidget.y2Style +
            "." +
            rect.width +
            "." +
            rect.height,

        rect.width,
        rect.height,

        (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = rect.width - 1;
            let y2 = rect.height - 1;

            if (styleHasBorder(style)) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                lcd.drawRect(ctx, x1, y1, x2, y2);
                x1++;
                y1++;
                x2--;
                y2--;
            }

            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            lcd.fillRect(ctx, x1, y1, x2, y2);
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

export function drawUpDownWidget(widget: Widget.Widget, rect: Rect) {
    let upDownWidget = widget as Widget.UpDownWidget;
    let style = findStyleOrGetDefault(upDownWidget.style);
    let buttonsStyle = findStyleOrGetDefault(upDownWidget.buttonsStyle);

    return drawFromCache(
        "drawUpDownWidget",

        getCacheId(style) +
            "." +
            upDownWidget.data +
            "." +
            rect.width +
            "." +
            rect.height +
            getCacheId(buttonsStyle) +
            upDownWidget.downButtonText +
            upDownWidget.upButtonText,

        rect.width,
        rect.height,

        (ctx: CanvasRenderingContext2D) => {
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
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

export function drawListGraphWidget(widget: Widget.Widget, rect: Rect) {
    let listGraphWidget = widget as Widget.ListGraphWidget;
    let style = findStyleOrGetDefault(listGraphWidget.style);

    return drawFromCache(
        "drawListGraphWidget",

        getCacheId(style) +
            "." +
            listGraphWidget.dwellData +
            "." +
            listGraphWidget.y1Data +
            "." +
            listGraphWidget.y1Style +
            "." +
            listGraphWidget.y2Data +
            "." +
            listGraphWidget.y2Style +
            "." +
            listGraphWidget.cursorData +
            "." +
            listGraphWidget.cursorStyle +
            "." +
            rect.width +
            "." +
            rect.height,

        rect.width,
        rect.height,

        (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = rect.width - 1;
            let y2 = rect.height - 1;

            if (styleHasBorder(style)) {
                lcd.setColor(getStyleProperty(style, "borderColor"));
                lcd.drawRect(ctx, x1, y1, x2, y2);
                x1++;
                y1++;
                x2--;
                y2--;
            }

            lcd.setColor(getStyleProperty(style, "backgroundColor"));
            lcd.fillRect(ctx, x1, y1, x2, y2);
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

export function drawLayoutViewWidget(widget: Widget.Widget, rect: Rect) {
    let pageViewWidget = widget as Widget.LayoutViewWidget;

    let layoutName;
    if (pageViewWidget.layout) {
        layoutName = pageViewWidget.layout;
    } else if (pageViewWidget.data) {
        layoutName = data.get(pageViewWidget.data) as string;
    }

    if (layoutName) {
        const layout = findPage(layoutName);
        if (layout) {
            return drawFromCache(
                "drawLayoutViewWidget",
                getCacheId(layout) + "." + rect.width + "." + rect.height,
                rect.width,
                rect.height,
                (ctx: CanvasRenderingContext2D) => {
                    let tree = createWidgetTree(layout.resolutions._array[0], true);
                    drawTree(ctx, tree, 1, () => {});
                }
            );
        }
    }

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export function drawAppViewWidget(widget: Widget.Widget, rect: Rect) {
    let pageViewWidget = widget as Widget.AppViewWidget;

    if (pageViewWidget.data) {
        const pageName = data.get(pageViewWidget.data) as string;
        if (pageName) {
            const page = findPage(pageName);
            let x;
            if (page) {
                x = drawFromCache(
                    "drawAppViewWidget",
                    getCacheId(page) + "." + rect.width + "." + rect.height,
                    rect.width,
                    rect.height,
                    (ctx: CanvasRenderingContext2D) => {
                        let tree = createWidgetTree(page.resolutions._array[0], true);
                        drawTree(ctx, tree, 1, () => {});
                    }
                );
            }
            if (x) {
                return x;
            }
        }
    }

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export function drawWidget(widget: Widget.Widget, rect: Rect) {
    let widgetType = Widget.getWidgetType(widget);
    if (widgetType) {
        let draw = widgetType.draw;
        if (draw) {
            return draw(widget, rect);
        }
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

function drawPageFrameWithColor(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    scale: number,
    color: string
) {
    lcd.setColor(color);
    ctx.save();
    ctx.shadowColor = "#999";
    ctx.shadowBlur = Math.max(5, Math.ceil(20 * scale));
    ctx.shadowOffsetX = Math.max(2, Math.ceil(5 * scale));
    ctx.shadowOffsetY = Math.max(2, Math.ceil(5 * scale));
    lcd.fillRect(ctx, rect.x, rect.y, rect.x + rect.width - 1, rect.y + rect.height - 1);
    ctx.restore();
}

export function drawPageFrame(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    scale: number,
    style: string
) {
    drawPageFrameWithColor(ctx, rect, scale, getStyleProperty(style, "backgroundColor"));
}

export function drawNotFoundPageFrame(ctx: CanvasRenderingContext2D, rect: Rect, scale: number) {
    drawPageFrameWithColor(ctx, rect, scale, "red");
}

export function drawPage(
    pageResolution: {
        width: number;
        height: number;
        widgets: EezArrayObject<Widget.Widget>;
    } & EezObject
) {
    let canvas = document.createElement("canvas");

    canvas.width = pageResolution.width;
    canvas.height = pageResolution.height;

    let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let tree = createWidgetTree(pageResolution, true);
    drawTree(ctx, tree, 1, () => {});

    return canvas;
}
