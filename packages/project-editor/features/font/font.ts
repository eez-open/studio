import { observable, computed } from "mobx";

import { formatNumber } from "eez-studio-shared/util";
import { Rect } from "eez-studio-shared/geometry";
import { _minBy, _maxBy, _range } from "eez-studio-shared/algorithm";
import { validators } from "eez-studio-shared/validation";

import * as notification from "eez-studio-ui/notification";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import {
    ClassInfo,
    IEezObject,
    EezObject,
    registerClass,
    PropertyType,
    getProperty,
    getParent,
    MessageType,
    PropertyInfo,
    IOnSelectParams
} from "project-editor/core/object";
import {
    getLabel,
    getDocumentStore,
    Message,
    hideInPropertyGridIfNotV1
} from "project-editor/core/store";
import type { Project } from "project-editor/project/project";

import extractFont from "font-services/font-extract";

import { showGenericDialog } from "project-editor/core/util";

import { metrics } from "project-editor/features/page/metrics";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    deserializePixelArray,
    EditorImageHitTestResult,
    getPixel,
    IGlyphBitmap,
    resizeGlyphBitmap,
    serializePixelArray
} from "project-editor/features/font/font-utils";

////////////////////////////////////////////////////////////////////////////////

function formatEncoding(encoding: number) {
    return `${formatNumber(encoding, 10, 4)}/0x${formatNumber(
        encoding,
        16,
        4
    )} (${String.fromCharCode(encoding)})`;
}

////////////////////////////////////////////////////////////////////////////////

export class GlyphSource extends EezObject {
    @observable filePath?: string;
    @observable size?: number;
    @observable encoding?: number;

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
        return getLabel(this);
    }
}

registerClass("GlyphSource", GlyphSource);

////////////////////////////////////////////////////////////////////////////////

const GLYPH_EDITOR_PIXEL_SIZE = 16;
const GLYPH_EDITOR_GRID_LINE_OUTER_COLOR = "#ddd";
const GLYPH_EDITOR_GRID_LINE_INNER_COLOR = "#999";
const GLYPH_EDITOR_BASE_LINE_COLOR = "#00f";
const GLYPH_EDITOR_PADDING_LEFT = 100;
const GLYPH_EDITOR_PADDING_TOP = 100;
const GLYPH_EDITOR_PADDING_RIGHT = 200;
const GLYPH_EDITOR_PADDING_BOTTOM = 100;

export class Glyph extends EezObject {
    @observable encoding: number;
    @observable x: number;
    @observable y: number;
    @observable width: number;
    @observable height: number;
    @observable dx: number;
    @observable glyphBitmap?: IGlyphBitmap;
    @observable source?: GlyphSource;

    static classInfo: ClassInfo = {
        label: (glyph: Glyph) => {
            return glyph.encoding != undefined
                ? formatEncoding(glyph.encoding)
                : "";
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
                onSelect: (
                    object: IEezObject,
                    propertyInfo: PropertyInfo,
                    params?: IOnSelectParams
                ) => {
                    return ProjectEditor.browseGlyph(object as Glyph);
                }
            },
            {
                name: "glyphBitmap",
                type: PropertyType.Any,
                hideInPropertyGrid: true,
                skipSearch: true
            }
        ],
        beforeLoadHook(object: IEezObject, jsObject: any) {
            if (jsObject.glyphBitmap) {
                if (
                    jsObject.width != jsObject.glyphBitmap.width ||
                    jsObject.height != jsObject.glyphBitmap.height
                ) {
                    if (jsObject.width == 0 && jsObject.height == 0) {
                        jsObject.glyphBitmap.width = 0;
                        jsObject.glyphBitmap.height = 0;
                        jsObject.glyphBitmap.pixelArray = [];
                    }
                }

                if (jsObject.glyphBitmap.pixelArray != undefined) {
                    jsObject.glyphBitmap.pixelArray = deserializePixelArray(
                        jsObject.glyphBitmap.pixelArray
                    );
                }
            }
        }
    };

    @computed
    get pixelArray(): number[] | undefined {
        if (!this.glyphBitmap) {
            return undefined;
        }

        if (
            this.width == this.glyphBitmap.width &&
            this.height == this.glyphBitmap.height
        ) {
            return this.glyphBitmap.pixelArray;
        }

        const font = this.font;

        return resizeGlyphBitmap(
            this.glyphBitmap,
            this.width,
            this.height,
            font.bpp
        ).pixelArray;
    }

    @computed
    get imageSize() {
        return {
            width: this.font.maxDx || 0,
            height: this.font.height || 0
        };
    }

    @computed
    get font() {
        return getParent(getParent(this)) as Font;
    }

    getPixel(x: number, y: number): number {
        return getPixel(this.glyphBitmap, x, y, this.font.bpp);
    }

    @computed
    get editorImage(): string {
        if (!this.glyphBitmap) {
            return "";
        }

        let font = this.font;

        let canvas = document.createElement("canvas");

        let fontAscent = font.ascent || 0;
        let fontHeight = font.height || 0;

        let x = this.x || 0;
        let y = this.y || 0;
        let width = this.width || 0;
        let height = this.height || 0;
        let dx = this.dx || 0;

        canvas.width =
            dx * GLYPH_EDITOR_PIXEL_SIZE +
            GLYPH_EDITOR_PADDING_LEFT +
            GLYPH_EDITOR_PADDING_RIGHT;
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
                ctx.lineTo(
                    x * GLYPH_EDITOR_PIXEL_SIZE,
                    clampY(yOffset) * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(
                    x * GLYPH_EDITOR_PIXEL_SIZE,
                    clampY(yOffset) * GLYPH_EDITOR_PIXEL_SIZE
                );
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
                ctx.lineTo(
                    x * GLYPH_EDITOR_PIXEL_SIZE,
                    fontHeight * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(x * GLYPH_EDITOR_PIXEL_SIZE, 0);
                ctx.lineTo(
                    x * GLYPH_EDITOR_PIXEL_SIZE,
                    fontHeight * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            }
        }

        // draw horizontal grid lines
        for (let y = 0; y <= fontHeight; y++) {
            if (y >= yOffset && y <= yOffset + height) {
                ctx.beginPath();
                ctx.moveTo(0, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.lineTo(
                    clampX(xOffset) * GLYPH_EDITOR_PIXEL_SIZE,
                    y * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(
                    clampX(xOffset) * GLYPH_EDITOR_PIXEL_SIZE,
                    y * GLYPH_EDITOR_PIXEL_SIZE
                );
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
                ctx.lineTo(
                    dx * GLYPH_EDITOR_PIXEL_SIZE,
                    y * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(0, y * GLYPH_EDITOR_PIXEL_SIZE);
                ctx.lineTo(
                    dx * GLYPH_EDITOR_PIXEL_SIZE,
                    y * GLYPH_EDITOR_PIXEL_SIZE
                );
                ctx.strokeStyle = GLYPH_EDITOR_GRID_LINE_OUTER_COLOR;
                ctx.stroke();
            }
        }

        // draw ascent line
        ctx.beginPath();
        ctx.moveTo(0, fontAscent * GLYPH_EDITOR_PIXEL_SIZE);
        ctx.lineTo(
            dx * GLYPH_EDITOR_PIXEL_SIZE,
            fontAscent * GLYPH_EDITOR_PIXEL_SIZE
        );
        ctx.strokeStyle = GLYPH_EDITOR_BASE_LINE_COLOR;
        ctx.stroke();

        // draw pixels
        if (this.glyphBitmap) {
            ctx.fillStyle = "black";
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelValue = getPixel(
                        this.glyphBitmap,
                        x,
                        y,
                        font.bpp
                    );

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
            ctx.globalAlpha = 1;
        }

        // draw measure lines
        const MEASURE_LINE_OFFSET = 20;
        const MEASURE_LINE_ARROW_WIDTH = 12;
        const MEASURE_LINE_ARROW_HEIGHT = 6;
        const MEASURE_LINE_COLOR = "#aaa";
        const MEASURE_LINE_LABEL_COLOR = "#999";
        const MEASURE_LINE_LABEL_FONT_SIZE = 12;
        const MEASURE_LINE_LABEL_FONT =
            MEASURE_LINE_LABEL_FONT_SIZE + "px Arial";

        ctx.strokeStyle = MEASURE_LINE_COLOR;
        ctx.fillStyle = MEASURE_LINE_LABEL_COLOR;
        ctx.font = MEASURE_LINE_LABEL_FONT;

        const beginDrawArrow = (x: number, y: number) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        const endDrawArrow = () => {
            ctx.closePath();
            ctx.fillStyle = MEASURE_LINE_COLOR;
            ctx.fill();
            ctx.fillStyle = MEASURE_LINE_LABEL_COLOR;
        };

        const drawLeftArrow = (x: number, y: number) => {
            beginDrawArrow(x, y);
            ctx.lineTo(
                x + MEASURE_LINE_ARROW_WIDTH,
                y - MEASURE_LINE_ARROW_HEIGHT / 2
            );
            ctx.lineTo(
                x + MEASURE_LINE_ARROW_WIDTH,
                y + MEASURE_LINE_ARROW_HEIGHT / 2
            );
            endDrawArrow();
        };

        const drawRightArrow = (x: number, y: number) => {
            beginDrawArrow(x, y);
            ctx.lineTo(
                x - MEASURE_LINE_ARROW_WIDTH,
                y - MEASURE_LINE_ARROW_HEIGHT / 2
            );
            ctx.lineTo(
                x - MEASURE_LINE_ARROW_WIDTH,
                y + MEASURE_LINE_ARROW_HEIGHT / 2
            );
            endDrawArrow();
        };

        const drawTopArrow = (x: number, y: number) => {
            beginDrawArrow(x, y);
            ctx.lineTo(
                x - MEASURE_LINE_ARROW_HEIGHT / 2,
                y + MEASURE_LINE_ARROW_WIDTH
            );
            ctx.lineTo(
                x + MEASURE_LINE_ARROW_HEIGHT / 2,
                y + MEASURE_LINE_ARROW_WIDTH
            );
            endDrawArrow();
        };

        const drawBottomArrow = (x: number, y: number) => {
            beginDrawArrow(x, y);
            ctx.lineTo(
                x - MEASURE_LINE_ARROW_HEIGHT / 2,
                y - MEASURE_LINE_ARROW_WIDTH
            );
            ctx.lineTo(
                x + MEASURE_LINE_ARROW_HEIGHT / 2,
                y - MEASURE_LINE_ARROW_WIDTH
            );
            endDrawArrow();
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
                y3 =
                    y1 +
                    MEASURE_LINE_ARROW_HEIGHT +
                    MEASURE_LINE_LABEL_FONT_SIZE / 2;
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
                x3 =
                    x1 +
                    MEASURE_LINE_ARROW_HEIGHT +
                    MEASURE_LINE_LABEL_FONT_SIZE / 2;
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

    @computed
    get topLeftOffset() {
        let font = this.font;

        let fontAscent = font.ascent || 0;

        let x = this.x || 0;
        let y = this.y || 0;
        let height = this.height || 0;

        return {
            x: GLYPH_EDITOR_PADDING_LEFT + x * GLYPH_EDITOR_PIXEL_SIZE,
            y:
                GLYPH_EDITOR_PADDING_TOP +
                (fontAscent - (y + height)) * GLYPH_EDITOR_PIXEL_SIZE
        };
    }

    editorImageHitTest(
        xTest: number,
        yTest: number
    ): EditorImageHitTestResult | undefined {
        let width = this.width || 0;
        let height = this.height || 0;

        let xResult = Math.floor(
            (xTest - this.topLeftOffset.x) / GLYPH_EDITOR_PIXEL_SIZE
        );
        let yResult = Math.floor(
            (yTest - this.topLeftOffset.y) / GLYPH_EDITOR_PIXEL_SIZE
        );

        if (
            xResult < 0 ||
            xResult >= width ||
            yResult < 0 ||
            yResult >= height
        ) {
            return undefined;
        }

        return {
            x: xResult,
            y: yResult,
            rect: this.getPixelRect(xResult, yResult)
        };
    }

    getPixelRect(x: number, y: number): Rect {
        return {
            left: this.topLeftOffset.x + x * GLYPH_EDITOR_PIXEL_SIZE,
            top: this.topLeftOffset.y + y * GLYPH_EDITOR_PIXEL_SIZE,
            width: GLYPH_EDITOR_PIXEL_SIZE,
            height: GLYPH_EDITOR_PIXEL_SIZE
        };
    }

    copyToClipboard() {
        if (this.glyphBitmap) {
            const buffer = Buffer.alloc(
                this.glyphBitmap.width * this.glyphBitmap.height * 4,
                0
            );

            for (let x = 0; x < this.glyphBitmap.width; x++) {
                for (let y = 0; y < this.glyphBitmap.height; y++) {
                    const i = (y * this.glyphBitmap.width + x) * 4;
                    buffer[i + 0] = 255 - this.getPixel(x, y);
                    buffer[i + 1] = 255 - this.getPixel(x, y);
                    buffer[i + 2] = 255 - this.getPixel(x, y);
                    buffer[i + 3] = 255;
                }
            }

            EEZStudio.remote.clipboard.writeImage(
                EEZStudio.remote.nativeImage.createFromBuffer(buffer, {
                    width: this.glyphBitmap.width,
                    height: this.glyphBitmap.height
                })
            );
        }
    }

    pasteFromClipboard() {
        const image = EEZStudio.remote.clipboard.readImage();
        if (image) {
            const buffer = image.getBitmap();

            const width = image.getSize().width;
            const height = image.getSize().height;
            const pixelArray = new Array(width * height);

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    pixelArray[y * width + x] =
                        255 - buffer[(y * width + x) * 4];
                }
            }

            getDocumentStore(this).updateObject(this, {
                width,
                height,
                glyphBitmap: {
                    width,
                    height,
                    pixelArray
                }
            });
        }
    }
}

registerClass("Glyph", Glyph);

////////////////////////////////////////////////////////////////////////////////

export class FontSource extends EezObject {
    @observable filePath: string;
    @observable size?: number;

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

registerClass("FontSource", FontSource);

////////////////////////////////////////////////////////////////////////////////

export class Font extends EezObject {
    @observable id: number | undefined;
    @observable name: string;
    @observable description?: string;
    @observable source?: FontSource;
    @observable bpp: number;
    @observable height: number;
    @observable ascent: number;
    @observable descent: number;
    @observable glyphs: Glyph[];
    @observable screenOrientation: string;
    @observable alwaysBuild: boolean;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                defaultValue: undefined
            },
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
                name: "screenOrientation",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "all"
                    },
                    {
                        id: "portrait"
                    },
                    {
                        id: "landscape"
                    }
                ],
                hideInPropertyGrid: hideInPropertyGridIfNotV1
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
            }
        ],
        newItem: (parent: IEezObject) => {
            function isFont(obj: IEezObject) {
                return getProperty(obj, "filePath");
            }

            function isNonBdfFont(obj: IEezObject) {
                const path = EEZStudio.remote.require("path");
                return (
                    isFont(obj) &&
                    path.extname(getProperty(obj, "filePath")) != ".bdf"
                );
            }

            function isNonBdfFontAnd1BitPerPixel(obj: IEezObject) {
                return isNonBdfFont(obj) && getProperty(obj, "bpp") === 1;
            }

            function isCreateGlyphs(obj: IEezObject) {
                return isFont(obj) && getProperty(obj, "createGlyphs");
            }

            return showGenericDialog(getDocumentStore(parent), {
                dialogDefinition: {
                    title: "New Font",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(undefined, parent)
                            ]
                        },
                        {
                            name: "filePath",
                            displayName: "Based on font",
                            type: RelativeFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "Font files",
                                        extensions: ["bdf", "ttf", "otf"]
                                    },
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
                        absoluteFilePath: getDocumentStore(
                            parent
                        ).getAbsoluteFilePath(result.values.filePath),
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
                            notification.info(
                                `Added ${result.values.name} font.`
                            );
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
                                notification.error(
                                    `Adding ${Font.name} failed: ${errorMessage}!`
                                );
                            } else {
                                notification.error(
                                    `Adding ${Font.name} failed!`
                                );
                            }

                            return false;
                        });
                })
                .catch(() => {
                    // canceled
                    return false;
                });
        },
        icon: "font_download"
    };

    @computed
    get glyphsMap() {
        const map = new Map<number, Glyph>();
        this.glyphs.forEach(glyph => map.set(glyph.encoding, glyph));
        return map;
    }

    @computed
    get maxDx() {
        return Math.max(...this.glyphs.map(glyph => glyph.dx)) || 0;
    }
}

registerClass("Font", Font);

////////////////////////////////////////////////////////////////////////////////

export function findFont(project: Project, fontName: string | undefined) {
    if (fontName == undefined) {
        return undefined;
    }
    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "fonts",
        fontName
    ) as Font | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-font",
    version: "0.1.0",
    description: "Fonts support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Fonts",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "fonts",
                type: PropertyType.Array,
                typeClass: Font,
                icon: "font_download",
                create: () => [],
                check: (object: IEezObject[]) => {
                    let messages: Message[] = [];

                    if (object.length > 255) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                "Max. 255 fonts are supported",
                                object
                            )
                        );
                    }

                    return messages;
                },
                metrics: metrics,
                toJsHook: (jsObject: Project, project: Project) => {
                    jsObject.fonts?.forEach(font =>
                        font.glyphs.forEach(glyph => {
                            if (
                                glyph.glyphBitmap &&
                                glyph.glyphBitmap.pixelArray
                            ) {
                                (glyph.glyphBitmap as any).pixelArray =
                                    serializePixelArray(
                                        glyph.glyphBitmap.pixelArray
                                    );
                            }
                        })
                    );
                }
            }
        }
    }
};
