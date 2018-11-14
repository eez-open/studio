import { observable, computed } from "mobx";

import { showGenericDialog } from "eez-studio-shared/ui/generic-dialog";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import { loadObject, objectToJS, getParent, getMetaData } from "project-editor/core/store";
import { EezObject, registerMetaData } from "project-editor/core/metaData";
import * as util from "project-editor/core/util";

import { GlyphSelectFieldType } from "project-editor/project/features/gui/FontEditor";
import { FontProperties } from "project-editor/project/features/gui/fontMetaData";

let path = EEZStudio.electron.remote.require("path");

////////////////////////////////////////////////////////////////////////////////

function formatEncoding(encoding: number) {
    return `${util.formatNumber(encoding, 10, 4)}/0x${util.formatNumber(
        encoding,
        16,
        4
    )} (${String.fromCharCode(encoding)})`;
}

////////////////////////////////////////////////////////////////////////////////

export function selectGlyph(glyph: GlyphProperties) {
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
            large: true,
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
        return <any>{
            x: result.context.encoding.glyph.x,
            y: result.context.encoding.glyph.y,
            width: result.context.encoding.glyph.width,
            height: result.context.encoding.glyph.height,
            dx: result.context.encoding.glyph.dx,
            glyphBitmap: result.context.encoding.glyph.glyphBitmap,
            source: loadObject(glyph, result.values, glyphSourceMetaData)
        };
    });
}

////////////////////////////////////////////////////////////////////////////////

export class GlyphSourceProperties extends EezObject {
    @observable
    filePath?: string;
    @observable
    size?: number;
    @observable
    encoding?: number;

    toString() {
        return getMetaData(this).label(this);
    }
}

export const glyphSourceMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return GlyphSourceProperties;
    },
    className: "GlyphSource",

    label: (glyphSource: GlyphSourceProperties) => {
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

    properties: () => [
        {
            name: "filePath",
            type: "string"
        },
        {
            name: "size",
            type: "number"
        },
        {
            name: "encoding",
            type: "number"
        }
    ]
});

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
    rect: util.Rect;
}

export class GlyphProperties extends EezObject {
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
    source?: GlyphSourceProperties;

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

        let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

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
        return getParent(getParent(this)!) as FontProperties;
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

        let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");
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
                x: xOffset + xResult * GLYPH_EDITOR_PIXEL_SIZE,
                y: yOffset + yResult * GLYPH_EDITOR_PIXEL_SIZE,
                width: GLYPH_EDITOR_PIXEL_SIZE,
                height: GLYPH_EDITOR_PIXEL_SIZE
            }
        };
    }
}

export const glyphMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return GlyphProperties;
    },
    className: "Glyph",
    label: (glyph: GlyphProperties) => {
        return glyph.encoding != undefined ? formatEncoding(glyph.encoding) : "";
    },
    properties: () => [
        {
            name: "encoding",
            type: "number"
        },
        {
            name: "x",
            type: "number"
        },
        {
            name: "y",
            type: "number"
        },
        {
            name: "width",
            type: "number"
        },
        {
            name: "height",
            type: "number"
        },
        {
            name: "dx",
            type: "number"
        },
        {
            name: "source",
            type: "object",
            typeMetaData: glyphSourceMetaData,
            onSelect: selectGlyph
        },
        {
            name: "glyphBitmap",
            type: "any",
            hideInPropertyGrid: true,
            skipSearch: true
        }
    ]
});
