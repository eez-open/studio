import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { formatNumber } from "eez-studio-shared/util";
import { Rect } from "eez-studio-shared/geometry";
import { _minBy, _maxBy } from "eez-studio-shared/algorithm";
import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";
import { IconAction, TextAction } from "eez-studio-ui/action";
import { IFieldComponentProps } from "eez-studio-ui/generic-dialog";
import styled from "eez-studio-ui/styled-components";
import { Splitter } from "eez-studio-ui/splitter";
import { Loader } from "eez-studio-ui/loader";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import {
    ClassInfo,
    EezObject,
    registerClass,
    EezArrayObject,
    PropertyType,
    getProperty,
    asArray,
    EditorComponent,
    cloneObject
} from "project-editor/model/object";
import { DocumentStore, NavigationStore } from "project-editor/model/store";
import { loadObject, objectToJS } from "project-editor/model/serialization";
import { ProjectStore } from "project-editor/core/store";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

import extractFont from "font-services/font-extract";
import rebuildFont from "font-services/font-rebuild";
import { FontProperties as FontValue } from "font-services/interfaces";

const path = EEZStudio.electron.remote.require("path");

////////////////////////////////////////////////////////////////////////////////

function formatEncoding(encoding: number) {
    return `${formatNumber(encoding, 10, 4)}/0x${formatNumber(
        encoding,
        16,
        4
    )} (${String.fromCharCode(encoding)})`;
}

////////////////////////////////////////////////////////////////////////////////

export function selectGlyph(glyph: Glyph) {
    function isFont(obj: any) {
        return obj["filePath"];
    }

    function isNonBdfFont(obj: any) {
        return isFont(obj) && path.extname(obj["filePath"]) != ".bdf";
    }

    function isNonBdfFontAnd1BitPerPixel(obj: any) {
        return isNonBdfFont(obj) && obj["bpp"] === 1;
    }

    return showGenericDialog({
        dialogDefinition: {
            title: "Select Glyph",
            size: "large",
            fields: [
                {
                    name: "filePath",
                    displayName: "Font",
                    type: RelativeFileInput,
                    options: {
                        filters: [
                            { name: "Font files", extensions: ["bdf", "ttf", "otf"] },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    }
                },
                {
                    name: "bpp",
                    type: "number",
                    visible: () => false
                },
                {
                    name: "size",
                    type: "number",
                    visible: isNonBdfFont
                },
                {
                    name: "threshold",
                    type: "number",
                    visible: isNonBdfFontAnd1BitPerPixel
                },
                {
                    name: "encoding",
                    type: GlyphSelectFieldType,
                    options: {
                        fontFilePathField: "filePath",
                        fontBppField: "bpp",
                        fontSizeField: "size",
                        fontThresholdField: "threshold"
                    }
                }
            ]
        },
        values: Object.assign({}, glyph.source && objectToJS(glyph.source), {
            bpp: glyph.getFont().bpp
        })
    }).then(result => {
        return {
            x: result.context.encoding.glyph.x,
            y: result.context.encoding.glyph.y,
            width: result.context.encoding.glyph.width,
            height: result.context.encoding.glyph.height,
            dx: result.context.encoding.glyph.dx,
            glyphBitmap: result.context.encoding.glyph.glyphBitmap,
            source: loadObject(glyph, result.values, GlyphSource)
        };
    });
}

////////////////////////////////////////////////////////////////////////////////

export class GlyphSource extends EezObject {
    @observable
    filePath?: string;
    @observable
    size?: number;
    @observable
    encoding?: number;

    static classInfo: ClassInfo = {
        label: (glyphSource: GlyphSource) => {
            if (!glyphSource.filePath || !glyphSource.encoding) {
                return "";
            }

            let label = glyphSource.filePath;
            if (glyphSource.size != undefined) {
                label += ", " + glyphSource.size;
            }
            label += ", " + formatEncoding(glyphSource.encoding);

            return label;
        },

        properties: [
            {
                name: "filePath",
                type: PropertyType.String
            },
            {
                name: "size",
                type: PropertyType.Number
            },
            {
                name: "encoding",
                type: PropertyType.Number
            }
        ]
    };

    toString() {
        return this._label;
    }
}

registerClass(GlyphSource);

////////////////////////////////////////////////////////////////////////////////

export interface GlyphBitmap {
    width: number;
    height: number;
    pixelArray: number[];
}

function getPixelByteIndex(glyphBitmap: GlyphBitmap, x: number, y: number): number {
    return y * Math.floor((glyphBitmap.width + 7) / 8) + Math.floor(x / 8);
}

export function getPixel(
    glyphBitmap: GlyphBitmap | undefined,
    x: number,
    y: number,
    bpp: number
): number {
    if (glyphBitmap && x < glyphBitmap.width && y < glyphBitmap.height) {
        if (bpp === 8) {
            return glyphBitmap.pixelArray[y * glyphBitmap.width + x];
        } else {
            return glyphBitmap.pixelArray[getPixelByteIndex(glyphBitmap, x, y)] & (0x80 >> x % 8);
        }
    } else {
        return 0;
    }
}

function setPixelInplace(
    glyphBitmap: GlyphBitmap,
    x: number,
    y: number,
    color: number,
    bpp: number
) {
    if (bpp === 8) {
        glyphBitmap.pixelArray[y * glyphBitmap.width + x] = color;
    } else {
        let byteIndex = getPixelByteIndex(glyphBitmap, x, y);
        if (glyphBitmap.pixelArray[byteIndex] === undefined) {
            glyphBitmap.pixelArray[byteIndex] = 0;
        }
        glyphBitmap.pixelArray[byteIndex] |= 0x80 >> x % 8;
        if (color) {
            glyphBitmap.pixelArray[byteIndex] |= 0x80 >> x % 8;
        } else {
            glyphBitmap.pixelArray[byteIndex] &= ~(0x80 >> x % 8) & 0xff;
        }
    }
}

export function setPixel(
    glyphBitmap: GlyphBitmap,
    x: number,
    y: number,
    color: number,
    bpp: number
) {
    let result = resizeGlyphBitmap(
        glyphBitmap,
        Math.max((glyphBitmap && glyphBitmap.width) || 0, x + 1),
        Math.max((glyphBitmap && glyphBitmap.height) || 0, y + 1),
        bpp
    );
    setPixelInplace(result, x, y, color, bpp);
    return result;
}

function resizeGlyphBitmap(glyphBitmap: GlyphBitmap, width: number, height: number, bpp: number) {
    let result = {
        width: width,
        height: height,
        pixelArray: []
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            setPixelInplace(result, x, y, getPixel(glyphBitmap, x, y, bpp), bpp);
        }
    }

    return result;
}

const GLYPH_EDITOR_PIXEL_SIZE = 16;
const GLYPH_EDITOR_GRID_LINE_OUTER_COLOR = "#ddd";
const GLYPH_EDITOR_GRID_LINE_INNER_COLOR = "#999";
const GLYPH_EDITOR_BASE_LINE_COLOR = "#00f";
const GLYPH_EDITOR_PADDING_LEFT = 100;
const GLYPH_EDITOR_PADDING_TOP = 100;
const GLYPH_EDITOR_PADDING_RIGHT = 200;
const GLYPH_EDITOR_PADDING_BOTTOM = 100;

export interface EditorImageHitTestResult {
    x: number;
    y: number;
    rect: Rect;
}

export class Glyph extends EezObject {
    @observable
    encoding: number;
    @observable
    x: number;
    @observable
    y: number;
    @observable
    width: number;
    @observable
    height: number;
    @observable
    dx: number;

    @observable
    glyphBitmap?: GlyphBitmap;

    static classInfo: ClassInfo = {
        label: (glyph: Glyph) => {
            return glyph.encoding != undefined ? formatEncoding(glyph.encoding) : "";
        },
        properties: [
            {
                name: "encoding",
                type: PropertyType.Number
            },
            {
                name: "x",
                type: PropertyType.Number
            },
            {
                name: "y",
                type: PropertyType.Number
            },
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "height",
                type: PropertyType.Number
            },
            {
                name: "dx",
                type: PropertyType.Number
            },
            {
                name: "source",
                type: PropertyType.Object,
                typeClass: GlyphSource,
                onSelect: selectGlyph
            },
            {
                name: "glyphBitmap",
                type: PropertyType.Any,
                hideInPropertyGrid: true,
                skipSearch: true
            }
        ]
    };

    @computed
    get pixelArray(): number[] | undefined {
        if (!this.glyphBitmap) {
            return undefined;
        }

        if (this.width == this.glyphBitmap.width && this.height == this.glyphBitmap.height) {
            return this.glyphBitmap.pixelArray;
        }

        const font = this.getFont();

        return resizeGlyphBitmap(this.glyphBitmap, this.width, this.height, font.bpp).pixelArray;
    }

    @observable
    source?: GlyphSource;

    @computed
    get image(): string {
        let font = this.getFont();

        let canvasWidth = this.glyphBitmap ? this.dx : 1;
        let canvasHeight = font.height;

        canvasWidth = canvasWidth || 1;
        canvasHeight = canvasHeight || 1;

        let canvas = document.createElement("canvas");
        canvas.setAttribute("width", canvasWidth.toString());
        canvas.setAttribute("height", canvasHeight.toString());

        let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        if (this.glyphBitmap) {
            ctx.fillStyle = "black";

            let xOffset = this.x;
            let yOffset = font.ascent - (this.y + this.height);

            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.height; y++) {
                    const pixelValue = getPixel(this.glyphBitmap, x, y, font.bpp);
                    if (font.bpp === 8) {
                        ctx.globalAlpha = pixelValue / 255;
                        ctx.fillRect(x + xOffset, y + yOffset, 1, 1);
                    } else {
                        if (pixelValue) {
                            ctx.fillRect(x + xOffset, y + yOffset, 1, 1);
                        }
                    }
                }
            }
        }

        return canvas.toDataURL();
    }

    getFont() {
        return this._parent!._parent as Font;
    }

    getPixel(x: number, y: number): number {
        if (!this.glyphBitmap) {
            return 0;
        }

        let font = this.getFont();

        return getPixel(this.glyphBitmap, x, y, font.bpp);
    }

    @computed
    get editorImage(): string {
        if (!this.glyphBitmap) {
            return "";
        }

        let font = this.getFont();

        let canvas = document.createElement("canvas");

        let fontAscent = font.ascent || 0;
        let fontHeight = font.height || 0;

        let x = this.x || 0;
        let y = this.y || 0;
        let width = this.width || 0;
        let height = this.height || 0;
        let dx = this.dx || 0;

        canvas.width =
            dx * GLYPH_EDITOR_PIXEL_SIZE + GLYPH_EDITOR_PADDING_LEFT + GLYPH_EDITOR_PADDING_RIGHT;
        canvas.height =
            fontHeight * GLYPH_EDITOR_PIXEL_SIZE +
            GLYPH_EDITOR_PADDING_TOP +
            GLYPH_EDITOR_PADDING_BOTTOM;

        let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.translate(GLYPH_EDITOR_PADDING_LEFT, GLYPH_EDITOR_PADDING_TOP);

        let xOffset = x;
        let yOffset = fontAscent - (y + height);

        const clampX = (x: number) => {
            return Math.min(Math.max(x, 0), dx);
        };

        const clampY = (y: number) => {
            return Math.min(Math.max(y, 0), fontHeight);
        };

        ctx.lineWidth = 0.5;

        // draw vertical grid lines
        for (let x = 0; x <= dx; x++) {
            if (x >= xOffset && x <= xOffset + width) {
                ctx.beginPath();
                ctx.moveTo(x * GLYPH_EDITOR_PIXEL_SIZE, 0);
                ctx.lineTo(x * GLYPH_EDITOR_PIXEL_SIZE, clampY(yOffset) * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x * GLYPH_EDITOR_PIXEL_SIZE, clampY(yOffset) * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.lineTo(
                    x * GLYPH_EDITOR_PIXEL_SIZE,
                    clampY(yOffset + height) * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_INNER_COLOR;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(
                    x * GLYPH_EDITOR_PIXEL_SIZE,
                    clampY(yOffset + height) * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.lineTo(x * GLYPH_EDITOR_PIXEL_SIZE, fontHeight * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(x * GLYPH_EDITOR_PIXEL_SIZE, 0);
                ctx.lineTo(x * GLYPH_EDITOR_PIXEL_SIZE, fontHeight * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            }
        }

        // draw horizontal grid lines
        for (let y = 0; y <= fontHeight; y++) {
            if (y >= yOffset && y <= yOffset + height) {
                ctx.beginPath();
                ctx.moveTo(0, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.lineTo(clampX(xOffset) * GLYPH_EDITOR_PIXEL_SIZE, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(clampX(xOffset) * GLYPH_EDITOR_PIXEL_SIZE, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.lineTo(
                    clampX(xOffset + width) * GLYPH_EDITOR_PIXEL_SIZE,
                    y * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_INNER_COLOR;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(
                    clampX(xOffset + width) * GLYPH_EDITOR_PIXEL_SIZE,
                    y * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.lineTo(dx * GLYPH_EDITOR_PIXEL_SIZE, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(0, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.lineTo(dx * GLYPH_EDITOR_PIXEL_SIZE, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            }
        }

        // draw ascent line
        ctx.beginPath();
        ctx.moveTo(0, fontAscent * GLYPH_EDITOR_PIXEL_SIZE);
        ctx.lineTo(dx * GLYPH_EDITOR_PIXEL_SIZE, fontAscent * GLYPH_EDITOR_PIXEL_SIZE);
        ctx.strokeStyle = GLYPH_EDITOR_BASE_LINE_COLOR;
        ctx.stroke();

        // draw pixels
        if (this.glyphBitmap) {
            ctx.fillStyle = "black";
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelValue = getPixel(this.glyphBitmap, x, y, font.bpp);

                    if (font.bpp === 8) {
                        ctx.globalAlpha = pixelValue / 255;
                    }

                    if (pixelValue) {
                        ctx.beginPath();
                        ctx.rect(
                            (x + xOffset) * GLYPH_EDITOR_PIXEL_SIZE,
                            (y + yOffset) * GLYPH_EDITOR_PIXEL_SIZE,
                            GLYPH_EDITOR_PIXEL_SIZE,
                            GLYPH_EDITOR_PIXEL_SIZE
                        );
                        ctx.fill();
                    }
                }
            }
        }

        // draw measure SnapLines
        const MEASURE_LINE_OFFSET = 20;
        const MEASURE_LINE_ARROW_WIDTH = 12;
        const MEASURE_LINE_ARROW_HEIGHT = 6;
        const MEASURE_LINE_COLOR = "#aaa";
        const MEASURE_LINE_LABEL_FONT_SIZE = 12;
        const MEASURE_LINE_LABEL_FONT = MEASURE_LINE_LABEL_FONT_SIZE + "px Arial";

        ctx.strokeStyle = MEASURE_LINE_COLOR;
        ctx.fillStyle = MEASURE_LINE_COLOR;
        ctx.font = MEASURE_LINE_LABEL_FONT;

        const drawLeftArrow = (x: number, y: number) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + MEASURE_LINE_ARROW_WIDTH, y - MEASURE_LINE_ARROW_HEIGHT / 2);
            ctx.lineTo(x + MEASURE_LINE_ARROW_WIDTH, y + MEASURE_LINE_ARROW_HEIGHT / 2);
            ctx.closePath();
            ctx.fill();
        };

        const drawRightArrow = (x: number, y: number) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - MEASURE_LINE_ARROW_WIDTH, y - MEASURE_LINE_ARROW_HEIGHT / 2);
            ctx.lineTo(x - MEASURE_LINE_ARROW_WIDTH, y + MEASURE_LINE_ARROW_HEIGHT / 2);
            ctx.closePath();
            ctx.fill();
        };

        const drawTopArrow = (x: number, y: number) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - MEASURE_LINE_ARROW_HEIGHT / 2, y + MEASURE_LINE_ARROW_WIDTH);
            ctx.lineTo(x + MEASURE_LINE_ARROW_HEIGHT / 2, y + MEASURE_LINE_ARROW_WIDTH);
            ctx.closePath();
            ctx.fill();
        };

        const drawBottomArrow = (x: number, y: number) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - MEASURE_LINE_ARROW_HEIGHT / 2, y - MEASURE_LINE_ARROW_WIDTH);
            ctx.lineTo(x + MEASURE_LINE_ARROW_HEIGHT / 2, y - MEASURE_LINE_ARROW_WIDTH);
            ctx.closePath();
            ctx.fill();
        };

        const drawHorizontalMeasureLine = (
            x1: number,
            x2: number,
            y: number,
            lineOffset: number,
            label: string,
            position: "above" | "below"
        ) => {
            let tm = ctx.measureText(label);

            if (x1 > x2) {
                let temp = x1;
                x1 = x2;
                x2 = temp;
            }

            let y1: number;
            let y2: number;
            let y3: number;
            if (position == "above") {
                y1 = y - lineOffset;
                y2 = y1 + MEASURE_LINE_ARROW_HEIGHT / 2;
                y3 = y1 - MEASURE_LINE_ARROW_HEIGHT / 2;
            } else {
                y1 = y + lineOffset;
                y2 = y1 - MEASURE_LINE_ARROW_HEIGHT / 2;
                y3 = y1 + MEASURE_LINE_ARROW_HEIGHT + MEASURE_LINE_LABEL_FONT_SIZE / 2;
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1, y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x2, y1);
            ctx.lineTo(x2, y);
            ctx.stroke();

            if (x2 - x1 > 2.5 * MEASURE_LINE_ARROW_WIDTH) {
                ctx.beginPath();
                ctx.moveTo(x1, y2);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                drawLeftArrow(x1, y2);
                drawRightArrow(x2, y2);
            } else {
                ctx.beginPath();
                ctx.moveTo(x1 - 1.5 * MEASURE_LINE_ARROW_WIDTH, y2);
                ctx.lineTo(x2 + 1.5 * MEASURE_LINE_ARROW_WIDTH, y2);
                ctx.stroke();
                drawRightArrow(x1, y2);
                drawLeftArrow(x2, y2);
            }

            ctx.fillText(label, (x1 + x2 - tm.width) / 2, y3);
        };

        const drawVerticalMeasureLine = (
            y1: number,
            y2: number,
            x: number,
            lineOffset: number,
            label: string,
            position: "left" | "right"
        ) => {
            let tm = ctx.measureText(label);

            if (y1 > y2) {
                let temp = y1;
                y1 = y2;
                y2 = temp;
            }

            let x1: number;
            let x2: number;
            let x3: number;
            if (position == "left") {
                x1 = x - lineOffset;
                x2 = x1 + MEASURE_LINE_ARROW_HEIGHT / 2;
                x3 = x1 - MEASURE_LINE_ARROW_HEIGHT / 2;
            } else {
                x1 = x + lineOffset;
                x2 = x1 - MEASURE_LINE_ARROW_HEIGHT / 2;
                x3 = x1 + MEASURE_LINE_ARROW_HEIGHT + MEASURE_LINE_LABEL_FONT_SIZE / 2;
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x, y1);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1, y2);
            ctx.lineTo(x, y2);
            ctx.stroke();

            if (y2 - y1 > 2.5 * MEASURE_LINE_ARROW_WIDTH) {
                ctx.beginPath();
                ctx.moveTo(x2, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                drawTopArrow(x2, y1);
                drawBottomArrow(x2, y2);
            } else {
                ctx.beginPath();
                ctx.moveTo(x2, y1 - 1.5 * MEASURE_LINE_ARROW_WIDTH);
                ctx.lineTo(x2, y2 + 1.5 * MEASURE_LINE_ARROW_WIDTH);
                ctx.stroke();
                drawBottomArrow(x2, y1);
                drawTopArrow(x2, y2);
            }

            ctx.save();

            ctx.translate(x3, (y1 + y2 + tm.width) / 2);
            ctx.rotate(-Math.PI / 2);

            ctx.fillText(label, 0, 0);

            ctx.restore();
        };

        drawHorizontalMeasureLine(
            0,
            xOffset * GLYPH_EDITOR_PIXEL_SIZE,
            0,
            MEASURE_LINE_OFFSET,
            `x = ${x}px`,
            "above"
        );
        drawHorizontalMeasureLine(
            xOffset * GLYPH_EDITOR_PIXEL_SIZE,
            (xOffset + width) * GLYPH_EDITOR_PIXEL_SIZE,
            (yOffset + height) * GLYPH_EDITOR_PIXEL_SIZE,
            MEASURE_LINE_OFFSET,
            `Glyph width = ${width}px`,
            "below"
        );
        drawHorizontalMeasureLine(
            0,
            dx * GLYPH_EDITOR_PIXEL_SIZE,
            fontHeight * GLYPH_EDITOR_PIXEL_SIZE,
            MEASURE_LINE_OFFSET,
            `Dx = ${dx}px`,
            "below"
        );

        drawVerticalMeasureLine(
            (yOffset + height) * GLYPH_EDITOR_PIXEL_SIZE,
            fontAscent * GLYPH_EDITOR_PIXEL_SIZE,
            0,
            MEASURE_LINE_OFFSET,
            `y = ${y}px`,
            "left"
        );
        drawVerticalMeasureLine(
            yOffset * GLYPH_EDITOR_PIXEL_SIZE,
            (yOffset + height) * GLYPH_EDITOR_PIXEL_SIZE,
            (xOffset + width) * GLYPH_EDITOR_PIXEL_SIZE,
            MEASURE_LINE_OFFSET,
            `Glyph height = ${height}px`,
            "right"
        );
        drawVerticalMeasureLine(
            0,
            fontAscent * GLYPH_EDITOR_PIXEL_SIZE,
            dx * GLYPH_EDITOR_PIXEL_SIZE,
            2 * MEASURE_LINE_OFFSET,
            `Ascent = ${font.ascent}px`,
            "right"
        );
        drawVerticalMeasureLine(
            fontAscent * GLYPH_EDITOR_PIXEL_SIZE,
            fontHeight * GLYPH_EDITOR_PIXEL_SIZE,
            dx * GLYPH_EDITOR_PIXEL_SIZE,
            2 * MEASURE_LINE_OFFSET,
            `Descent = ${font.descent}px`,
            "right"
        );
        drawVerticalMeasureLine(
            0,
            fontHeight * GLYPH_EDITOR_PIXEL_SIZE,
            dx * GLYPH_EDITOR_PIXEL_SIZE,
            4 * MEASURE_LINE_OFFSET,
            `Font height = ${font.height}px`,
            "right"
        );

        return canvas.toDataURL();
    }

    editorImageHitTest(xTest: number, yTest: number): EditorImageHitTestResult | undefined {
        let font = this.getFont();

        let fontAscent = font.ascent || 0;

        let x = this.x || 0;
        let y = this.y || 0;
        let width = this.width || 0;
        let height = this.height || 0;

        let xOffset = GLYPH_EDITOR_PADDING_LEFT + x * GLYPH_EDITOR_PIXEL_SIZE;
        let yOffset =
            GLYPH_EDITOR_PADDING_TOP + (fontAscent - (y + height)) * GLYPH_EDITOR_PIXEL_SIZE;

        let xResult = Math.floor((xTest - xOffset) / GLYPH_EDITOR_PIXEL_SIZE);
        let yResult = Math.floor((yTest - yOffset) / GLYPH_EDITOR_PIXEL_SIZE);

        if (xResult < 0 || xResult >= width || yResult < 0 || yResult >= height) {
            return undefined;
        }

        return {
            x: xResult,
            y: yResult,
            rect: {
                left: xOffset + xResult * GLYPH_EDITOR_PIXEL_SIZE,
                top: yOffset + yResult * GLYPH_EDITOR_PIXEL_SIZE,
                width: GLYPH_EDITOR_PIXEL_SIZE,
                height: GLYPH_EDITOR_PIXEL_SIZE
            }
        };
    }
}

registerClass(Glyph);

////////////////////////////////////////////////////////////////////////////////

const GlyphSelectFieldContainerDiv = styled.div`
    height: 600px;
    border: 1px solid ${props => props.theme.borderColor};
    display: flex;
`;

@observer
export class GlyphSelectFieldType extends React.Component<
    IFieldComponentProps,
    {
        isLoading: boolean;
        font?: Font;
        selectedGlyph?: Glyph;
    }
> {
    fontFilePath: string;
    fontBpp: number;
    fontSize: number;
    fontThreshold: number;

    timeoutId: any;

    glyphs: any;
    glyphsContainer: any;

    constructor(props: IFieldComponentProps) {
        super(props);
        this.state = {
            isLoading: false,
            font: undefined,
            selectedGlyph: undefined
        };
    }

    componentDidMount() {
        this.loadFont();
    }

    componentDidUpdate() {
        this.loadFont();
    }

    loadFont() {
        let fontFilePath: string = this.props.values[
            this.props.fieldProperties.options.fontFilePathField
        ];
        if (!fontFilePath) {
            return;
        }

        let fontBpp: number = this.props.values[this.props.fieldProperties.options.fontBppField];
        if (!fontBpp) {
            return;
        }

        let fontSize: number;
        let fontThreshold: number = 0;

        if (!fontFilePath.toLowerCase().endsWith(".bdf")) {
            fontSize = this.props.values[this.props.fieldProperties.options.fontSizeField];
            if (!fontSize || fontSize < 8 || fontSize > 100) {
                return;
            }

            if (fontBpp !== 8) {
                fontThreshold = this.props.values[
                    this.props.fieldProperties.options.fontThresholdField
                ];
                if (!fontThreshold || fontThreshold < 1 || fontThreshold > 255) {
                    return;
                }
            }
        } else {
            fontSize = this.fontSize;
            fontThreshold = this.fontThreshold;
        }

        if (
            fontFilePath != this.fontFilePath ||
            fontBpp != this.fontBpp ||
            fontSize != this.fontSize ||
            fontThreshold != this.fontThreshold
        ) {
            this.fontFilePath = fontFilePath;
            this.fontBpp = fontBpp;
            this.fontSize = fontSize;
            this.fontThreshold = fontThreshold;

            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            this.timeoutId = setTimeout(() => {
                extractFont({
                    absoluteFilePath: ProjectStore.getAbsoluteFilePath(fontFilePath),
                    relativeFilePath: fontFilePath,
                    bpp: fontBpp,
                    size: fontSize,
                    threshold: fontThreshold,
                    createGlyphs: true
                })
                    .then((fontValue: FontValue) => {
                        const font: Font = loadObject(undefined, fontValue, Font) as Font;
                        this.onChange(
                            font,
                            font.glyphs._array.find(
                                glyph =>
                                    glyph.encoding ==
                                    this.props.values[this.props.fieldProperties.name]
                            )
                        );
                    })
                    .catch(error => {
                        console.error(error);
                        this.onChange(undefined, undefined);
                    });
            }, 1000);

            this.setState({
                isLoading: true,
                font: undefined,
                selectedGlyph: undefined
            });
        } else {
            if (this.glyphs) {
                this.glyphs.ensureVisible();
            }
        }
    }

    onChange(font: Font | undefined, glyph: Glyph | undefined) {
        this.setState({
            isLoading: false,
            font: font,
            selectedGlyph: glyph
        });

        this.props.onChange((glyph && glyph.encoding) || undefined);

        this.props.fieldContext[this.props.fieldProperties.name] = {
            font: font,
            glyph: glyph
        };
    }

    onSelectGlyph(glyph: Glyph) {
        this.onChange(this.state.font, glyph);
    }

    onDoubleClickGlyph(glyph: Glyph) {}

    render() {
        if (this.state.font) {
            return (
                <GlyphSelectFieldContainerDiv ref={(ref: any) => (this.glyphsContainer = ref)}>
                    <Glyphs
                        ref={ref => (this.glyphs = ref!)}
                        glyphs={this.state.font.glyphs._array}
                        selectedGlyph={this.state.selectedGlyph}
                        onSelectGlyph={this.onSelectGlyph.bind(this)}
                        onDoubleClickGlyph={this.onDoubleClickGlyph.bind(this)}
                    />
                </GlyphSelectFieldContainerDiv>
            );
        } else if (this.state.isLoading) {
            return (
                <div className="form-control-static">
                    <Loader />
                </div>
            );
        } else {
            return <div className="form-control-static" />;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GlyphComponent extends React.Component<
    {
        glyph: Glyph;
        isSelected: boolean;
        onSelect: () => void;
        onDoubleClick: () => void;
    },
    {}
> {
    render() {
        let classes: string[] = [];
        if (this.props.isSelected) {
            classes.push("selected");
        }

        return (
            <li
                key={this.props.glyph.encoding}
                className={classes.join(" ")}
                onClick={this.props.onSelect}
                onDoubleClick={this.props.onDoubleClick}
            >
                <div>
                    <img src={this.props.glyph.image} />
                    <div>{this.props.glyph._label}</div>
                </div>
            </li>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const Toolbar = styled.div`
    flex-wrap: nowrap;

    & > input {
        width: 200px;
        margin-left: 4px;
        margin-top: 3px;
    }
`;

const GlyphsDiv = styled.div`
    display: flex;
    flex-direction: column;
    overflow: hidden;

    ul {
        padding: 5px;
    }

    li {
        display: inline-block;
        margin: 5px;
        border: 2px solid #eee;
        padding: 5px;
        background-color: white;
        cursor: pointer;
    }

    li.selected {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    li > div {
        display: flex;
        align-items: center;
        flex-direction: column;
    }

    li > div > img {
        flex: 1;
    }

    li > div > div {
        font-size: 80%;
        font-family: monospace;
    }
`;

const GlyphsFilterDiv = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    padding: 5px;
    background-color: ${props => props.theme.panelHeaderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};
    input {
        height: 28px;
    }

    input {
        width: 100%;
    }
`;

const GlyphsContentDiv = styled.div`
    flex-grow: 1;
    display: flex;
    overflow: auto;
`;

@observer
class Glyphs extends React.Component<
    {
        glyphs: Glyph[];
        selectedGlyph: Glyph | undefined;
        onSelectGlyph: (glyph: Glyph) => void;
        onDoubleClickGlyph: (glyph: Glyph) => void;
        onRebuildGlyphs?: () => void;
        onAddGlyph?: () => void;
        onDeleteGlyph?: () => void;
    },
    {
        searchValue: string;
    }
> {
    state = {
        searchValue: ""
    };

    list: HTMLUListElement;

    onChange(event: any) {
        let searchValue: string = event.target.value;

        this.setState({
            searchValue: searchValue
        });

        searchValue = searchValue.toLowerCase();
        let glyph = this.props.glyphs.find(
            glyph => glyph._label.toLowerCase().indexOf(searchValue) != -1
        );

        if (glyph) {
            this.props.onSelectGlyph(glyph);
        }
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    ensureVisible() {
        const $selectedGlyph = $(this.list).find(".selected");
        if ($selectedGlyph.length == 1) {
            ($selectedGlyph[0] as any).scrollIntoViewIfNeeded();
        }
    }

    render() {
        const glyphs: JSX.Element[] = this.props.glyphs.map(glyph => (
            <GlyphComponent
                key={glyph._id}
                glyph={glyph}
                isSelected={glyph == this.props.selectedGlyph}
                onSelect={this.props.onSelectGlyph.bind(null, glyph)}
                onDoubleClick={this.props.onDoubleClickGlyph.bind(null, glyph)}
            />
        ));

        let rebuildGlyphsButton: JSX.Element | undefined;
        if (this.props.onRebuildGlyphs) {
            rebuildGlyphsButton = (
                <TextAction
                    text="Rebuild"
                    title="Rebuild Glyphs"
                    onClick={this.props.onRebuildGlyphs.bind(this)}
                />
            );
        }

        let addGlyphButton: JSX.Element | undefined;
        if (this.props.onAddGlyph) {
            addGlyphButton = (
                <IconAction
                    title="Add Glyph"
                    icon="material:add"
                    iconSize={16}
                    onClick={this.props.onAddGlyph.bind(this)}
                />
            );
        }

        let deleteGlyphButton: JSX.Element | undefined;
        if (this.props.onDeleteGlyph) {
            deleteGlyphButton = (
                <IconAction
                    title="Delete Glyph"
                    icon="material:delete"
                    iconSize={16}
                    onClick={this.props.onDeleteGlyph}
                />
            );
        }

        return (
            <GlyphsDiv>
                <GlyphsFilterDiv>
                    <Toolbar className="btn-toolbar" role="toolbar">
                        <input
                            type="text"
                            className="form-control"
                            value={this.state.searchValue}
                            onChange={this.onChange.bind(this)}
                            placeholder="search"
                        />
                        <div style={{ flexGrow: 1 }} />
                        {rebuildGlyphsButton}
                        {addGlyphButton}
                        {deleteGlyphButton}
                    </Toolbar>
                </GlyphsFilterDiv>
                <GlyphsContentDiv>
                    <ul ref={ref => (this.list = ref!)}>{glyphs}</ul>
                </GlyphsContentDiv>
            </GlyphsDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GlyphEditor extends React.Component<
    {
        glyph: Glyph | undefined;
    },
    {}
> {
    div: HTMLDivElement;

    @observable
    hitTestResult: EditorImageHitTestResult | undefined = undefined;
    isLeftButtonDown: boolean = false;
    lastToggledPixel:
        | {
              x: number;
              y: number;
          }
        | undefined = undefined;

    togglePixel() {
        if (this.props.glyph && this.hitTestResult) {
            let glyphBitmap = this.props.glyph.glyphBitmap;
            if (!glyphBitmap) {
                const width = this.hitTestResult.x + 1;
                const height = this.hitTestResult.y + 1;
                glyphBitmap = {
                    width,
                    height,
                    pixelArray: new Array<number>(width * height)
                };
            }

            const font = this.props.glyph.getFont();

            const newGlyphBitmap = setPixel(
                glyphBitmap,
                this.hitTestResult.x,
                this.hitTestResult.y,
                this.props.glyph.getPixel(this.hitTestResult.x, this.hitTestResult.y) ? 0 : 255,
                font.bpp
            );

            DocumentStore.updateObject(this.props.glyph, {
                glyphBitmap: newGlyphBitmap
            });

            this.lastToggledPixel = {
                x: this.hitTestResult.x,
                y: this.hitTestResult.y
            };
        }
    }

    @action
    selectPixel(event: any) {
        if (this.props.glyph) {
            this.hitTestResult = this.props.glyph.editorImageHitTest(
                event.nativeEvent.offsetX + $(this.div).scrollLeft(),
                event.nativeEvent.offsetY + $(this.div).scrollTop()
            );
        } else {
            this.hitTestResult = undefined;
        }
    }

    onMouseDown(event: any) {
        if (event.nativeEvent.which === 1) {
            this.isLeftButtonDown = true;

            this.lastToggledPixel = undefined;
            this.selectPixel(event);
            if (this.hitTestResult) {
                this.togglePixel();
            }
        }
    }

    @action
    onMouseMove(event: any) {
        this.selectPixel(event);
        if (this.isLeftButtonDown) {
            if (this.hitTestResult) {
                if (
                    !this.lastToggledPixel ||
                    (this.lastToggledPixel.x != this.hitTestResult.x ||
                        this.lastToggledPixel.y != this.hitTestResult.y)
                ) {
                    this.togglePixel();
                }
            } else {
                this.lastToggledPixel = undefined;
            }
        }
    }

    onMouseUp(event: any) {
        if (event.nativeEvent.which === 1) {
            this.isLeftButtonDown = false;
        }
    }

    render() {
        var glyph: JSX.Element | undefined;
        if (this.props.glyph) {
            glyph = (
                <img
                    src={this.props.glyph.editorImage}
                    style={{
                        pointerEvents: "none"
                    }}
                />
            );
        }

        var hitTest: JSX.Element | undefined;
        if (this.hitTestResult) {
            hitTest = (
                <div
                    style={{
                        position: "absolute",
                        left: this.hitTestResult.rect.left,
                        top: this.hitTestResult.rect.top,
                        width: this.hitTestResult.rect.width,
                        height: this.hitTestResult.rect.height,
                        backgroundColor: "blue",
                        pointerEvents: "none"
                    }}
                />
            );
        }

        return (
            <div
                ref={ref => (this.div = ref!)}
                onMouseDown={this.onMouseDown.bind(this)}
                onMouseMove={this.onMouseMove.bind(this)}
                onMouseUp={this.onMouseUp.bind(this)}
            >
                {glyph}
                {hitTest}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class FontEditor extends EditorComponent {
    get glyphs() {
        let font = this.props.editor.object as Font;
        return font.glyphs;
    }

    @observable
    selectedGlyph: Glyph | undefined;

    @action.bound
    onSelectGlyph(glyph: Glyph) {
        this.selectedGlyph = glyph;
    }

    @bind
    onDoubleClickGlyph(glyph: Glyph) {
        selectGlyph(glyph)
            .then(propertyValues => {
                DocumentStore.updateObject(glyph, propertyValues);
            })
            .catch(error => console.error(error));
    }

    get selectedObject() {
        return this.selectedGlyph;
    }

    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    @action.bound
    async onRebuildGlyphs() {
        try {
            const font = this.props.editor.object as Font;

            const newFont = await rebuildFont({
                font: objectToJS(font),
                projectFilePath: ProjectStore.filePath!
            });

            DocumentStore.replaceObject(font, loadObject(font._parent, newFont, Font));

            notification.info(`Font rebuilded.`);
        } catch (err) {
            notification.error(`Rebuild failed (${err})!`);
        }
    }

    @action.bound
    onAddGlyph() {
        let font = this.props.editor.object as Font;
        let newGlyph = cloneObject(
            undefined,
            font.glyphs._array[font.glyphs._array.length - 1]
        ) as Glyph;
        newGlyph.encoding = newGlyph.encoding + 1;
        newGlyph = DocumentStore.addObject(font.glyphs, newGlyph) as Glyph;
        this.selectedGlyph = newGlyph;
    }

    @action.bound
    onDeleteGlyph() {
        let font = this.props.editor.object as Font;
        let selectedGlyph = this.selectedGlyph;
        if (selectedGlyph && font.glyphs._array[font.glyphs._array.length - 1] == selectedGlyph) {
            DocumentStore.deleteObject(selectedGlyph);
        }
    }

    render() {
        let font = this.props.editor.object as Font;

        let onDeleteGlyph: (() => void) | undefined;
        if (
            this.selectedGlyph &&
            font.glyphs._array[font.glyphs._array.length - 1] == this.selectedGlyph
        ) {
            onDeleteGlyph = this.onDeleteGlyph;
        }

        return (
            <Splitter
                type="vertical"
                persistId="project-editor/font-editor"
                sizes={`50%|50%`}
                tabIndex={0}
                onFocus={this.focusHander.bind(this)}
            >
                <Glyphs
                    glyphs={this.glyphs._array}
                    selectedGlyph={this.selectedGlyph}
                    onSelectGlyph={this.onSelectGlyph}
                    onDoubleClickGlyph={this.onDoubleClickGlyph}
                    onRebuildGlyphs={this.onRebuildGlyphs}
                    onAddGlyph={this.onAddGlyph}
                    onDeleteGlyph={onDeleteGlyph}
                />
                <GlyphEditor glyph={this.selectedGlyph} />
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class FontSource extends EezObject {
    @observable
    filePath: string;
    @observable
    size?: number;

    static classInfo: ClassInfo = {
        getClass: (jsObject: any) => {
            return FontSource;
        },

        label: (fontSource: FontSource) => {
            let label = fontSource.filePath;
            if (fontSource.size != undefined) {
                label += ", " + fontSource.size;
            }
            return label;
        },

        properties: [
            {
                name: "filePath",
                type: PropertyType.String
            },
            {
                name: "size",
                type: PropertyType.Number
            }
        ]
    };
}

registerClass(FontSource);

////////////////////////////////////////////////////////////////////////////////

export class Font extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    source?: FontSource;
    @observable
    bpp: number;
    @observable
    height: number;
    @observable
    ascent: number;
    @observable
    descent: number;

    @observable
    glyphs: EezArrayObject<Glyph>;

    @observable
    alwaysBuild: boolean;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "source",
                type: PropertyType.Object,
                typeClass: FontSource,
                readOnlyInPropertyGrid: true
            },
            {
                name: "bpp",
                type: PropertyType.Enum,
                enumItems: [{ id: 1 }, { id: 8 }],
                defaultValue: 1,
                readOnlyInPropertyGrid: true
            },
            {
                name: "height",
                type: PropertyType.Number
            },
            {
                name: "ascent",
                type: PropertyType.Number
            },
            {
                name: "descent",
                type: PropertyType.Number
            },
            {
                name: "glyphs",
                typeClass: Glyph,
                type: PropertyType.Array,
                hideInPropertyGrid: true
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
            }
        ],
        newItem: (parent: EezObject) => {
            function isFont(obj: EezObject) {
                return getProperty(obj, "filePath");
            }

            function isNonBdfFont(obj: EezObject) {
                return isFont(obj) && path.extname(getProperty(obj, "filePath")) != ".bdf";
            }

            function isNonBdfFontAnd1BitPerPixel(obj: EezObject) {
                return isNonBdfFont(obj) && getProperty(obj, "bpp") === 1;
            }

            function isCreateGlyphs(obj: EezObject) {
                return isFont(obj) && getProperty(obj, "createGlyphs");
            }

            return showGenericDialog({
                dialogDefinition: {
                    title: "New Font",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(undefined, asArray(parent))
                            ]
                        },
                        {
                            name: "filePath",
                            displayName: "Based on font",
                            type: RelativeFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    { name: "Font files", extensions: ["bdf", "ttf", "otf"] },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        {
                            name: "bpp",
                            displayName: "Bits per pixel",
                            type: "enum",
                            enumItems: [1, 8]
                        },
                        {
                            name: "size",
                            type: "number",
                            visible: isNonBdfFont
                        },
                        {
                            name: "threshold",
                            type: "number",
                            visible: isNonBdfFontAnd1BitPerPixel
                        },
                        {
                            name: "createGlyphs",
                            type: "boolean",
                            visible: isFont
                        },
                        {
                            name: "fromGlyph",
                            type: "number",
                            visible: isCreateGlyphs
                        },
                        {
                            name: "toGlyph",
                            type: "number",
                            visible: isCreateGlyphs
                        },
                        {
                            name: "createBlankGlyphs",
                            type: "boolean",
                            visible: isCreateGlyphs
                        }
                    ]
                },
                values: {
                    size: 14,
                    bpp: 8,
                    threshold: 128,
                    fromGlyph: 32,
                    toGlyph: 127,
                    createGlyphs: true,
                    createBlankGlyphs: false
                }
            })
                .then(result => {
                    return extractFont({
                        name: result.values.name,
                        absoluteFilePath: ProjectStore.getAbsoluteFilePath(result.values.filePath),
                        relativeFilePath: result.values.filePath,
                        bpp: result.values.bpp,
                        size: result.values.size,
                        threshold: result.values.threshold,
                        createGlyphs: result.values.createGlyphs,
                        fromEncoding: result.values.fromGlyph,
                        toEncoding: result.values.toGlyph,
                        createBlankGlyphs: result.values.createBlankGlyphs
                    })
                        .then(font => {
                            notification.info(`Added ${result.values.name} font.`);
                            return font;
                        })
                        .catch(err => {
                            let errorMessage;
                            if (err) {
                                if (err.message) {
                                    errorMessage = err.message;
                                } else {
                                    errorMessage = err.toString();
                                }
                            }

                            if (errorMessage) {
                                notification.error(`Adding ${Font.name} failed: ${errorMessage}!`);
                            } else {
                                notification.error(`Adding ${Font.name} failed!`);
                            }

                            return false;
                        });
                })
                .catch(() => {
                    // canceled
                    return false;
                });
        },
        editorComponent: FontEditor,
        navigationComponent: ListNavigationWithContent,
        navigationComponentId: "fonts",
        icon: "font_download"
    };
}

registerClass(Font);

////////////////////////////////////////////////////////////////////////////////

export function getData(font: Font) {
    /*
    Font header:

    offset
    0           ascent              uint8
    1           descent             uint8
    2           encoding start      uint8
    3           encoding end        uint8
    4           1st encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    6           2nd encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    ...
    */

    /*
    Glyph header:

    offset
    0             DWIDTH                    int8
    1             BBX width                 uint8
    2             BBX height                uint8
    3             BBX xoffset               int8
    4             BBX yoffset               int8

    Note: byte 0 == 255 indicates empty glyph
    */

    const min = _minBy(font.glyphs._array, g => g.encoding);
    const startEncoding = (min && min.encoding) || 32;
    const max = _maxBy(font.glyphs._array, g => g.encoding);
    const endEncoding = (max && max.encoding) || 127;

    const data: number[] = [];

    function add(...values: number[]) {
        for (const value of values) {
            if (value < 0) {
                data.push(256 + value);
            } else {
                data.push(value);
            }
        }
    }

    if (startEncoding <= endEncoding) {
        add(font.ascent);
        add(font.descent);
        add(startEncoding);
        add(endEncoding);

        for (let i = startEncoding; i <= endEncoding; i++) {
            if (font.bpp === 8) {
                add(0);
                add(0);
                add(0);
                add(0);
            } else {
                add(0);
                add(0);
            }
        }

        for (let i = startEncoding; i <= endEncoding; i++) {
            const offsetIndex = 4 + (i - startEncoding) * (font.bpp === 8 ? 4 : 2);
            const offset = data.length;
            if (font.bpp === 8) {
                // uint32 LE
                data[offsetIndex + 0] = offset & 0xff;
                data[offsetIndex + 1] = (offset >> 8) & 0xff;
                data[offsetIndex + 2] = (offset >> 16) & 0xff;
                data[offsetIndex + 3] = offset >> 24;
            } else {
                // uint16 BE
                data[offsetIndex + 0] = offset >> 8;
                data[offsetIndex + 1] = offset & 0xff;
            }

            const glyph = font.glyphs._array[i - 32];

            if (glyph && glyph.pixelArray) {
                add(glyph.dx);
                add(glyph.width);
                add(glyph.height);
                add(glyph.x);
                add(glyph.y);

                add(...glyph.pixelArray);
            } else {
                add(255);
            }
        }
    }

    return data;
}
