import fs from "fs";
import path from "path";
import React from "react";
import { observer } from "mobx-react";
import { clipboard, nativeImage } from "@electron/remote";
import {
    observable,
    computed,
    makeObservable,
    runInAction
} from "mobx";
import { dialog, getCurrentWindow } from "@electron/remote";

import { Rect } from "eez-studio-shared/geometry";
import {
    VALIDATION_MESSAGE_REQUIRED,
    validators
} from "eez-studio-shared/validation";

import * as notification from "eez-studio-ui/notification";
import { Button } from "eez-studio-ui/button";

import { AbsoluteFileInput } from "project-editor/ui-components/FileInput";

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
    IOnSelectParams,
    PropertyProps,
    IMessage,
    ProjectType,
    setParent
} from "project-editor/core/object";
import {
    getLabel,
    getProjectStore,
    Message,
    createObject,
    ProjectStore
} from "project-editor/store";
import {
    isEezGuiLiteProject,
    isLVGLProject,
    isNotV1Project,
    isV1Project
} from "project-editor/project/project-type-traits";

import type { Project } from "project-editor/project/project";

import {
    AdditionalFontSourceParams,
    EncodingRange,
    extractFont,
    FontRenderingEngine,
    ExtractFontParams
} from "project-editor/features/font/font-extract";

import { showGenericDialog } from "project-editor/core/util";

import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    deserializePixelArray,
    EditorImageHitTestResult,
    formatEncoding,
    getPixel,
    IGlyphBitmap,
    resizeGlyphBitmap,
    serializePixelArray
} from "project-editor/features/font/utils";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { getLvglDefaultFontBpp } from "project-editor/lvgl/lvgl-versions";
import { settingsController } from "home/settings";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

export class GlyphSource extends EezObject {
    filePath?: string;
    size?: number;
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
                type: PropertyType.String,
                skipSearch: true
            },
            {
                name: "size",
                displayName: "Font size",
                type: PropertyType.Number,
                formText: object => {
                    if (object && isLVGLProject(object)) {
                        return undefined;
                    }
                    return object
                        ? ProjectEditor.getProjectStore(object)
                              .projectTypeTraits.isLVGL
                            ? "In pixels"
                            : "In points"
                        : undefined;
                }
            },
            {
                name: "encoding",
                type: PropertyType.Number
            }
        ]
    };

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            filePath: observable,
            size: observable,
            encoding: observable
        });
    }

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
    encoding: number;
    x: number;
    y: number;
    width: number;
    height: number;
    dx: number;
    glyphBitmap?: IGlyphBitmap;
    source?: GlyphSource;

    static classInfo: ClassInfo = {
        label: (glyph: Glyph) => {
            return glyph.encoding != undefined
                ? formatEncoding(glyph.encoding)
                : "";
        },
        propertiesPanelLabel: (glyph: Glyph) => {
            return `Font character: ${Glyph.classInfo.label!(glyph)}`;
        },
        properties: [
            {
                name: "encoding",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "x",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "y",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "width",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "height",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "dx",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "source",
                type: PropertyType.Object,
                isOptional: true,
                defaultValue: {},
                typeClass: GlyphSource,
                onSelect: (
                    object: IEezObject,
                    propertyInfo: PropertyInfo,
                    params?: IOnSelectParams
                ) => {
                    return ProjectEditor.browseGlyph(object as Glyph);
                },
                readOnlyInPropertyGrid: isLVGLProject
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

    constructor() {
        super();
        makeObservable(this, {
            pixelArray: computed,
            imageSize: computed,
            font: computed,
            editorImage: computed,
            topLeftOffset: computed
        });
    }

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            encoding: observable,
            x: observable,
            y: observable,
            width: observable,
            height: observable,
            dx: observable,
            glyphBitmap: observable,
            source: observable
        });
    }

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

    get imageSize() {
        return {
            width: this.font.maxDx || 0,
            height: this.font.height || 0
        };
    }

    get font() {
        return getParent(getParent(this)) as Font;
    }

    getPixel(x: number, y: number): number {
        return getPixel(this.glyphBitmap, x, y, this.font.bpp);
    }

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
            const project = ProjectEditor.getProject(this);

            ctx.fillStyle = settingsController.isDarkTheme ? "white" : "black";
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelValue = getPixel(
                        this.glyphBitmap,
                        x,
                        y,
                        project.projectTypeTraits.isLVGL ? 8 : font.bpp
                    );

                    if (font.bpp === 8 || project.projectTypeTraits.isLVGL) {
                        ctx.globalAlpha = pixelValue / 255;
                    } else if (font.bpp === 4) {
                        ctx.globalAlpha = pixelValue / 15;
                    } else if (font.bpp === 2) {
                        ctx.globalAlpha = pixelValue / 3;
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

            const font = this.font;
            const maxAlpha = (1 << font.bpp) - 1;
            for (let x = 0; x < this.glyphBitmap.width; x++) {
                for (let y = 0; y < this.glyphBitmap.height; y++) {
                    const i = (y * this.glyphBitmap.width + x) * 4;
                    const pixel = this.getPixel(x, y);
                    const value =
                        font.bpp === 8
                            ? pixel
                            : font.bpp === 1
                              ? pixel
                                  ? 255
                                  : 0
                              : Math.round((pixel * 255) / maxAlpha);
                    buffer[i + 0] = 255 - value;
                    buffer[i + 1] = 255 - value;
                    buffer[i + 2] = 255 - value;
                    buffer[i + 3] = 255;
                }
            }

            clipboard.writeImage(
                (nativeImage as any).createFromBuffer(buffer, {
                    width: this.glyphBitmap.width,
                    height: this.glyphBitmap.height
                })
            );
        }
    }

    pasteFromClipboard() {
        const image = clipboard.readImage();
        if (image) {
            const buffer = image.toBitmap();

            const width = image.getSize().width;
            const height = image.getSize().height;
            const pixelArray = new Array(width * height);

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const r = buffer[(y * width + x) * 4 + 0];
                    const g = buffer[(y * width + x) * 4 + 1];
                    const b = buffer[(y * width + x) * 4 + 2];
                    const a = buffer[(y * width + x) * 4 + 3];

                    pixelArray[y * width + x] =
                        (255 - (r + g + b) / 3) * (a / 255);
                }
            }

            getProjectStore(this).updateObject(this, {
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
    filePath: string;
    size?: number;

    static classInfo: ClassInfo = {
        getClass: (projectStore: ProjectStore, jsObject: any) => {
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
                type: PropertyType.RelativeFile,
                fileFilters: [
                    {
                        name: "Font files",
                        extensions: ["ttf", "otf"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ],
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "size",
                displayName: "Font size",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: (fontSource: FontSource) =>
                    isLVGLProject(fontSource) &&
                    !fontSource.font.lvglUseFreeType,
                formText: object => {
                    if (object && isLVGLProject(object)) {
                        return undefined;
                    }
                    return object
                        ? ProjectEditor.getProjectStore(object)
                              .projectTypeTraits.isLVGL
                            ? "In pixels"
                            : "In points"
                        : undefined;
                }
            }
        ]
    };

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            filePath: observable,
            size: observable
        });
    }

    get font() {
        return getParent(this) as Font;
    }
}

registerClass("FontSource", FontSource);

////////////////////////////////////////////////////////////////////////////////

const EmptySpacePropertyGridUI = observer(
    class EmptySpacePropertyGridUI extends React.Component<PropertyProps> {
        render() {
            if (this.props.objects.length > 1) {
                return null;
            }

            return <div style={{ marginTop: 10 }}></div>;
        }
    }
);

const EditGlyphsPropertyGridUI = observer(
    class EditGlyphsPropertyGridUI extends React.Component<PropertyProps> {
        render() {
            if (this.props.objects.length > 1) {
                return null;
            }

            return (
                <div
                    style={{
                        marginBottom:
                            this.props.objects[0] instanceof Font ? 10 : 0,
                        display: "flex"
                    }}
                >
                    <div style={{ width: "33%" }}></div>
                    <div style={{ width: "100%" }}>
                        <Button
                            color="primary"
                            size="small"
                            onClick={() =>
                                onEditGlyphs(this.props.objects[0] as Font)
                            }
                        >
                            Add or Remove Characters
                        </Button>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class AdditionalFontSource extends EezObject {
    filePath: string;
    lvglRanges: string;
    lvglSymbols: string;

    static classInfo: ClassInfo = {
        label: () => "",

        properties: [
            {
                name: "filePath",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    {
                        name: "Font files",
                        extensions: ["ttf", "otf", "woff"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ],
                readOnlyInPropertyGrid: true
            },
            {
                name: "lvglRanges",
                displayName: "Ranges",
                type: PropertyType.String,
                readOnlyInPropertyGrid: true
            },
            {
                name: "lvglSymbols",
                displayName: "Symbols",
                type: PropertyType.String,
                readOnlyInPropertyGrid: true
            },
            {
                name: "editGlyphs",
                type: PropertyType.Any,
                computed: true,
                propertyGridFullRowComponent: EditGlyphsPropertyGridUI,
                skipSearch: true
            }
        ],

        defaultValue: {
            filePath: "",
            lvglRanges: "",
            lvglSymbols: ""
        },

        newItem: async (parent: IEezObject) => {
            const projectStore = getProjectStore(parent);

            let result = await showGenericDialog(projectStore, {
                dialogDefinition: {
                    title: "New Additional Font Source",
                    fields: [
                        {
                            name: "filePath",
                            displayName: "Font file",
                            type: AbsoluteFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "Font files",
                                        extensions: ["ttf", "otf", "woff"]
                                    },
                                    {
                                        name: "All Files",
                                        extensions: ["*"]
                                    }
                                ]
                            }
                        },
                        {
                            name: "ranges",
                            type: "string",
                            validators: [
                                validateRanges,
                                requiredRangesOrSymbols
                            ],
                            formText:
                                "Ranges and/or characters to include. Example: 32-127,140,160-170,200,210-255"
                        },
                        {
                            name: "symbols",
                            type: "string",
                            validators: [requiredRangesOrSymbols],
                            formText:
                                "List of characters to include. Example: abc01234äöüčćšđ"
                        }
                    ]
                },
                values: {},
                modal: true,
                backdrop: "static"
            });

            let relativeFilePath = getProjectStore(
                parent
            ).getFilePathRelativeToProjectPath(result.values.filePath);

            const additionalFontSource = createObject<AdditionalFontSource>(
                projectStore,
                {
                    filePath: relativeFilePath,
                    lvglRanges: result.values.ranges,
                    lvglSymbols: result.values.symbols
                },
                AdditionalFontSource
            );

            return additionalFontSource;
        },

        check: (
            additionalFontSource: AdditionalFontSource,
            messages: IMessage[]
        ) => {
            if (!additionalFontSource.filePath) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        "Font file path is required",
                        additionalFontSource
                    )
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            filePath: observable,
            lvglRanges: observable,
            lvglSymbols: observable
        });
    }
}

registerClass("AdditionalFontSource", AdditionalFontSource);

////////////////////////////////////////////////////////////////////////////////

const ExportFontFilePropertyGridUI = observer(
    class ExportFontFilePropertyGridUI extends React.Component<PropertyProps> {
        export = async () => {
            const font = this.props.objects[0] as Font;

            const result = await dialog.showSaveDialog(getCurrentWindow(), {
                filters: [{ name: "All Files", extensions: ["*"] }],
                defaultPath: font.source!.filePath
            });
            let filePath = result.filePath;

            if (filePath) {
                const bin = Buffer.from(font.embeddedFontFile!, "base64");
                try {
                    await fs.promises.writeFile(filePath, bin);
                    notification.info(`Font file exported.`);
                } catch (error) {
                    notification.error(error.toString());
                }
            }
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div style={{ marginBottom: 10, display: "flex" }}>
                    <div style={{ width: "33%" }}></div>
                    <div style={{ width: "100%" }}>
                        <Button
                            color="primary"
                            size="small"
                            onClick={this.export}
                        >
                            Export Font File
                        </Button>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ViewGlyphsPropertyGridUI = observer(
    class ViewGlyphsPropertyGridUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        view = async () => {
            this.context.navigationStore.showObjects(
                this.props.objects,
                true,
                false,
                false,
                {
                    forceOpenEditor: true
                }
            );
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div
                    style={{ marginTop: 10, marginBottom: 10, display: "flex" }}
                >
                    <div style={{ width: "33%" }}></div>
                    <div style={{ width: "100%" }}>
                        <Button
                            color="primary"
                            size="small"
                            onClick={this.view}
                        >
                            View Glyphs
                        </Button>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ChangeBitsPerPixel = observer(
    class ChangeBitsPerPixel extends React.Component<PropertyProps> {
        onModify = async () => {
            const font = this.props.objects[0] as Font;
            const projectStore = ProjectEditor.getProjectStore(font);

            const result = await showGenericDialog(projectStore, {
                dialogDefinition: {
                    title: "Change bits per pixel",
                    fields: [
                        {
                            name: "bpp",
                            displayName: "Bits per pixel",
                            type: "enum",
                            enumItems: [1, 2, 4, 8]
                        }
                    ]
                },
                values: {
                    bpp: font.bpp
                }
            });

            const newBpp = result.values.bpp;

            if (font.bpp === newBpp) {
                return;
            }

            // Group glyphs by their source file path and size.
            // Glyphs with their own GlyphSource use that; others
            // fall back to the font-level FontSource.
            const sourceGroups = new Map<
                string,
                {
                    relativeFilePath: string;
                    size: number;
                    encodings: number[];
                }
            >();

            for (const glyph of font.glyphs) {
                const relPath =
                    glyph.source?.filePath || font.source?.filePath;
                const size =
                    glyph.source?.size ||
                    font.source?.size ||
                    font.height;

                if (!relPath) {
                    continue;
                }

                const key = `${relPath}\0${size}`;
                let group = sourceGroups.get(key);
                if (!group) {
                    group = {
                        relativeFilePath: relPath,
                        size,
                        encodings: []
                    };
                    sourceGroups.set(key, group);
                }
                group.encodings.push(glyph.encoding);
            }

            if (sourceGroups.size === 0) {
                projectStore.updateObject(font, {
                    bpp: newBpp
                });
                return;
            }

            // Extract glyphs from each source file
            const allNewGlyphs = new Map<
                number,
                {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    dx: number;
                    glyphBitmap?: any;
                }
            >();

            let firstFontProperties: any;

            try {
                for (const group of sourceGroups.values()) {
                    // Build encoding ranges from sorted encodings
                    const sorted = group.encodings.slice().sort(
                        (a, b) => a - b
                    );
                    const encodings: EncodingRange[] = [];
                    let i = 0;
                    while (i < sorted.length) {
                        const from = sorted[i];
                        while (
                            i + 1 < sorted.length &&
                            sorted[i + 1] === sorted[i] + 1
                        ) {
                            i++;
                        }
                        encodings.push({ from, to: sorted[i] });
                        i++;
                    }

                    const fontProperties = await extractFont({
                        name: font.name,
                        absoluteFilePath:
                            projectStore.getAbsoluteFilePath(
                                group.relativeFilePath
                            ),
                        embeddedFontFile: font.embeddedFontFile,
                        relativeFilePath: group.relativeFilePath,
                        renderingEngine: font.renderingEngine,
                        bpp: newBpp,
                        size: group.size,
                        threshold: font.threshold,
                        createGlyphs: true,
                        encodings,
                        createBlankGlyphs: false,
                        doNotAddGlyphIfNotFound: true
                    });

                    if (!firstFontProperties) {
                        firstFontProperties = fontProperties;
                    }

                    for (const g of fontProperties.glyphs) {
                        allNewGlyphs.set(g.encoding, g);
                    }
                }
            } catch (error) {
                notification.error(
                    `Failed to change bits per pixel: ${error}`
                );
                return;
            }

            projectStore.undoManager.setCombineCommands(true);

            projectStore.updateObject(font, {
                bpp: firstFontProperties.bpp,
                ascent: firstFontProperties.ascent,
                descent: firstFontProperties.descent,
                height: firstFontProperties.height
            });

            for (const glyph of font.glyphs) {
                const newGlyphProps = allNewGlyphs.get(glyph.encoding);
                if (newGlyphProps) {
                    projectStore.updateObject(glyph, {
                        x: newGlyphProps.x,
                        y: newGlyphProps.y,
                        width: newGlyphProps.width,
                        height: newGlyphProps.height,
                        dx: newGlyphProps.dx,
                        glyphBitmap: newGlyphProps.glyphBitmap
                    });
                }
            }

            projectStore.undoManager.setCombineCommands(false);
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <div style={{ marginBottom: 10, display: "flex" }}>
                    <div style={{ width: "33%" }}></div>
                    <div style={{ width: "100%" }}>
                        <Button
                            color="primary"
                            size="small"
                            onClick={this.onModify}
                        >
                            Change bits per pixel
                        </Button>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class Font extends EezObject {
    id: number | undefined;
    name: string;
    description?: string;
    renderingEngine: FontRenderingEngine;
    source?: FontSource;
    embeddedFontFile?: string;
    bpp: number;
    threshold: number;
    height: number;
    ascent: number;
    descent: number;
    glyphs: Glyph[];
    screenOrientation: string;
    alwaysBuild: boolean;

    lvglRanges: string;
    lvglSymbols: string;
    lvglAdditionalSources: AdditionalFontSource[];
    lvglFallbackFont: string;
    lvglUseFreeType: boolean;
    lvglFreeTypeRenderMode: string;
    lvglFreeTypeStyle: string;
    lvglFreeTypeFilePath: string;

    _lvglFontDefinition:
        | {
              binFile: string;
              sourceFile: string;
          }
        | undefined;
    _lvglFontDefinitionExtractFontParams: ExtractFontParams | undefined;

    _lvglGlyphsDirty: boolean;

    constructor() {
        super();

        makeObservable(this, {
            glyphsMap: computed({ keepAlive: true }),
            maxDx: computed
        });
    }

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            id: observable,
            name: observable,
            description: observable,
            renderingEngine: observable,
            source: observable,
            embeddedFontFile: observable,
            bpp: observable,
            threshold: observable,
            height: observable,
            ascent: observable,
            descent: observable,
            glyphs: observable,
            screenOrientation: observable,
            alwaysBuild: observable,
            lvglRanges: observable,
            lvglSymbols: observable,
            lvglAdditionalSources: observable,
            lvglFallbackFont: observable,
            lvglUseFreeType: observable,
            lvglFreeTypeRenderMode: observable,
            lvglFreeTypeStyle: observable,
            lvglFreeTypeFilePath: observable,
            _lvglFontDefinition: observable,
            _lvglExtractFontParams: computed({
                keepAlive: true
            }),
            _lvglGlyphsDirty: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup,
                disabled: (font: Font) =>
                    isLVGLProject(font) || isEezGuiLiteProject(font)
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
                name: "renderingEngine",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "freetype",
                        label: "FreeType"
                    },
                    {
                        id: "opentype",
                        label: "OpenType"
                    }
                ],
                disabled: (font: Font) => isLVGLProject(font),
                enumDisallowUndefined: true
            },
            {
                name: "source",
                type: PropertyType.Object,
                typeClass: FontSource,
                readOnlyInPropertyGrid: isLVGLProject
            },
            {
                name: "embeddedFontFile",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "bpp",
                displayName: "Bits per pixel",
                type: PropertyType.Enum,
                enumItems: [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 8 }],
                defaultValue: 1,
                readOnlyInPropertyGrid: true,
                enumDisallowUndefined: true,
                disabled: (font: Font) =>
                    (isNotV1Project(font) &&
                        !isLVGLProject(font) &&
                        !isEezGuiLiteProject(font)) ||
                    (isLVGLProject(font) && font.lvglUseFreeType)
            },
            {
                name: "changeBitsPerPixel",
                type: PropertyType.Any,
                computed: true,
                propertyGridFullRowComponent: ChangeBitsPerPixel,
                skipSearch: true,
                disabled: (font: Font) =>
                    (!isLVGLProject(font) && !isEezGuiLiteProject(font)) ||
                    (isLVGLProject(font) && font.lvglUseFreeType)
            },
            {
                name: "threshold",
                type: PropertyType.Number,
                defaultValue: 128,
                disabled: (font: Font) =>
                    isLVGLProject(font) || font.bpp != 1
            },
            {
                name: "height",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject,
                disabled: (font: Font) =>
                    isLVGLProject(font) && font.lvglUseFreeType
            },
            {
                name: "ascent",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject,
                disabled: (font: Font) =>
                    isLVGLProject(font) && font.lvglUseFreeType
            },
            {
                name: "descent",
                type: PropertyType.Number,
                readOnlyInPropertyGrid: isLVGLProject,
                disabled: (font: Font) =>
                    isLVGLProject(font) && font.lvglUseFreeType
            },
            {
                name: "glyphs",
                typeClass: Glyph,
                type: PropertyType.Array,
                isOptional: true,
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
                disabled: isNotV1Project
            },
            {
                name: "alwaysBuild",
                displayName: "Always add to the generated code",
                type: PropertyType.Boolean,
                disabled: isLVGLProject
            },
            {
                name: "lvglGlyphs",
                type: PropertyType.Any,
                hideInPropertyGrid: true
            },
            {
                name: "emptySpace1",
                type: PropertyType.Any,
                computed: true,
                propertyGridFullRowComponent: EmptySpacePropertyGridUI,
                skipSearch: true,
                disabled: object => !isLVGLProject(object)
            },
            {
                name: "lvglRanges",
                displayName: "Ranges",
                type: PropertyType.String,
                readOnlyInPropertyGrid: true,
                disabled: (font: Font) =>
                    !isLVGLProject(font) ||
                    (isLVGLProject(font) && font.lvglUseFreeType)
            },
            {
                name: "lvglSymbols",
                displayName: "Symbols",
                type: PropertyType.String,
                readOnlyInPropertyGrid: true,
                disabled: (font: Font) =>
                    !isLVGLProject(font) ||
                    (isLVGLProject(font) && font.lvglUseFreeType)
            },
            {
                name: "editGlyphs",
                type: PropertyType.Any,
                computed: true,
                propertyGridFullRowComponent: EditGlyphsPropertyGridUI,
                skipSearch: true,
                disabled: (font: Font) =>
                    !isLVGLProject(font) ||
                    (isLVGLProject(font) && font.lvglUseFreeType)
            },
            {
                name: "lvglAdditionalSources",
                displayName: "Additional sources",
                type: PropertyType.Array,
                typeClass: AdditionalFontSource,
                defaultValue: [],
                disabled: (font: Font) =>
                    !isLVGLProject(font) ||
                    (isLVGLProject(font) && font.lvglUseFreeType),
                noColSpanForArray: true
            },
            {
                name: "emptySpace2",
                type: PropertyType.Any,
                computed: true,
                propertyGridFullRowComponent: EmptySpacePropertyGridUI,
                skipSearch: true,
                disabled: object => !isLVGLProject(object)
            },
            {
                name: "lvglFallbackFont",
                displayName: "Fallback font",
                type: PropertyType.String,
                disabled: (font: Font) =>
                    !isLVGLProject(font) ||
                    (isLVGLProject(font) && font.lvglUseFreeType),
                formText: object =>
                    "E.g. lv_font_montserrat_24 or ui_font_my_custom_font"
            },
            {
                name: "lvglUseFreeType",
                displayName: "Use FreeType for rendering",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                readOnlyInPropertyGrid: true,
                disabled: (font: Font) =>
                    !isLVGLProject(font) || !font.lvglUseFreeType
            },
            {
                name: "lvglFreeTypeRenderMode",
                displayName: "Render Mode",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "BITMAP",
                        label: "Bitmap"
                    },
                    {
                        id: "OUTLINE",
                        label: "Outline"
                    }
                ],
                disabled: (font: Font) =>
                    !isLVGLProject(font) ||
                    !font.lvglUseFreeType ||
                    ProjectEditor.getProjectStore(
                        font
                    ).project.settings.general.lvglVersion.startsWith("8.")
            },
            {
                name: "lvglFreeTypeStyle",
                displayName: "Style",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "NORMAL",
                        label: "Normal"
                    },
                    {
                        id: "ITALIC",
                        label: "Italic"
                    },
                    {
                        id: "BOLD",
                        label: "Bold"
                    },
                    {
                        id: "BOLD_ITALIC",
                        label: "Bold Italic"
                    }
                ],
                disabled: (font: Font) =>
                    !isLVGLProject(font) || !font.lvglUseFreeType
            },
            {
                name: "lvglFreeTypeFilePath",
                displayName: "File path",
                type: PropertyType.String,
                disabled: (font: Font) =>
                    !isLVGLProject(font) || !font.lvglUseFreeType
            },
            {
                name: "exportFontFile",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: ExportFontFilePropertyGridUI,
                skipSearch: true,
                hideInPropertyGrid: (font: Font) => {
                    return !font.embeddedFontFile;
                }
            },
            {
                name: "viewGlyphs",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: ViewGlyphsPropertyGridUI,
                skipSearch: true,
                hideInPropertyGrid: (font: Font) => {
                    return !isLVGLProject(font) || font.lvglUseFreeType;
                }
            }
        ],
        propertiesPanelLabel: (font: Font) => {
            return `Font: ${font.name}`;
        },
        beforeLoadHook: (
            font: Font,
            fontJs: Partial<Font> & {
                lvglSourceFile?: string;
                lvglGlyphs?: {
                    encodings: EncodingRange[];
                    symbols: string;
                };
            },
            project: Project
        ) => {
            if ((fontJs as any).renderEngine != undefined) {
                fontJs.renderingEngine = (fontJs as any).renderEngine;
            } else if (fontJs.renderingEngine == undefined) {
                fontJs.renderingEngine = "freetype";
            }

            if (
                !fontJs.lvglRanges &&
                !fontJs.lvglSymbols &&
                fontJs.lvglGlyphs
            ) {
                function getLvglRanges() {
                    const encodings = fontJs.lvglGlyphs!.encodings;
                    if (encodings && encodings.length > 0) {
                        return encodings
                            .map(encoding =>
                                encoding.from != encoding.to
                                    ? `${encoding.from} - ${encoding.to}`
                                    : `${encoding.from}`
                            )
                            .join(",");
                    }

                    return "";
                }

                function getLvglSymbols() {
                    return fontJs.lvglGlyphs!.symbols ?? "";
                }

                fontJs.lvglRanges = getLvglRanges();
                fontJs.lvglSymbols = getLvglSymbols();
                delete fontJs.lvglGlyphs;
            }

            if (fontJs.lvglSourceFile) {
                delete fontJs.lvglSourceFile;
            }

            if (
                fontJs.source?.filePath &&
                path.isAbsolute(fontJs.source.filePath)
            ) {
                const projectStore = project._store;
                fontJs.source.filePath =
                    projectStore.getFilePathRelativeToProjectPath(
                        fontJs.source.filePath
                    );
            }

            if ((fontJs as any).lvglAdditionalSources == undefined) {
                (fontJs as any).lvglAdditionalSources = [];
            }

            if (fontJs.lvglUseFreeType) {
                if (fontJs.lvglFreeTypeRenderMode == undefined) {
                    fontJs.lvglFreeTypeRenderMode = "BITMAP";
                }
            }
        },
        check: (font: Font, messages: IMessage[]) => {
            const projectStore = getProjectStore(font);

            ProjectEditor.checkAssetId(projectStore, "fonts", font, messages);
        },
        newItem: async (parent: IEezObject) => {
            function is1BitPerPixel(obj: IEezObject) {
                return getProperty(obj, "bpp") === 1;
            }

            function isCreateGlyphs(obj: IEezObject) {
                return getProperty(obj, "createGlyphs");
            }

            const projectStore = getProjectStore(parent);

            let values = projectStore.projectTypeTraits.isLVGL
                ? {
                      size: 14,
                      bpp: getLvglDefaultFontBpp(parent),
                      ranges: "32-127",
                      symbols: "",
                      useFreeType: false,
                      lvglFreeTypeRenderMode: "BITMAP",
                      lvglFreeTypeStyle: "NORMAL"
                  }
                : {
                      renderingEngine: "opentype",
                      size: 14,
                      bpp: 8,
                      threshold: 128,
                      fromGlyph: 32,
                      toGlyph: 127,
                      createGlyphs: true,
                      createBlankGlyphs: false
                  };

            try {
                while (true) {
                    let result;

                    let lvglRanges;
                    let lvglSymbols;

                    if (projectStore.projectTypeTraits.isLVGL) {
                        result = await showGenericDialog(projectStore, {
                            dialogDefinition: {
                                title: "New Font",
                                fields: [
                                    {
                                        name: "name",
                                        type: "string",
                                        validators: [
                                            validators.required,
                                            validators.invalidCharacters("."),
                                            validators.unique(undefined, parent)
                                        ]
                                    },
                                    {
                                        name: "filePath",
                                        displayName: "Font file",
                                        type: AbsoluteFileInput,
                                        validators: [validators.required],
                                        options: {
                                            filters: [
                                                {
                                                    name: "Font files",
                                                    extensions: [
                                                        "ttf",
                                                        "otf",
                                                        "woff"
                                                    ]
                                                },
                                                {
                                                    name: "All Files",
                                                    extensions: ["*"]
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: "bpp",
                                        displayName: "Bits per pixel",
                                        type: "enum",
                                        enumItems: [1, 2, 4, 8],
                                        visible: values =>
                                            values.useFreeType === false
                                    },
                                    {
                                        name: "size",
                                        displayName: "Font size (pixels)",
                                        type: "number"
                                    },
                                    {
                                        name: "ranges",
                                        type: "string",
                                        validators: [
                                            validateRanges,
                                            requiredRangesOrSymbols
                                        ],
                                        formText:
                                            "Ranges and/or characters to include. Example: 32-127,140,160-170,200,210-255",
                                        visible: values =>
                                            values.useFreeType === false
                                    },
                                    {
                                        name: "symbols",
                                        type: "string",
                                        validators: [requiredRangesOrSymbols],
                                        formText:
                                            "List of characters to include. Example: abc01234äöüčćšđ",
                                        visible: values =>
                                            values.useFreeType === false
                                    },
                                    {
                                        name: "useFreeType",
                                        displayName:
                                            "Use FreeType for rendering",
                                        type: "boolean",
                                        checkboxStyleSwitch: true
                                    },
                                    {
                                        name: "lvglFreeTypeRenderMode",
                                        displayName: "Render Mode",
                                        type: "enum",
                                        enumItems: [
                                            {
                                                id: "BITMAP",
                                                label: "Bitmap"
                                            },
                                            {
                                                id: "OUTLINE",
                                                label: "Outline"
                                            }
                                        ],
                                        // Disabled until LVGL FreeType integration is fixed
                                        visible: values =>
                                            false &&
                                            values.useFreeType === true &&
                                            !projectStore.project.settings.general.lvglVersion.startsWith(
                                                "8."
                                            )
                                    },
                                    {
                                        name: "lvglFreeTypeStyle",
                                        displayName: "Style",
                                        type: "enum",
                                        enumItems: [
                                            {
                                                id: "NORMAL",
                                                label: "Normal"
                                            },
                                            {
                                                id: "ITALIC",
                                                label: "Italic"
                                            },
                                            {
                                                id: "BOLD",
                                                label: "Bold"
                                            },
                                            {
                                                id: "BOLD_ITALIC",
                                                label: "Bold Italic"
                                            }
                                        ],
                                        visible: values =>
                                            values.useFreeType === true
                                    },
                                    {
                                        name: "lvglFreeTypeFilePath",
                                        displayName: "File path",
                                        type: "string",
                                        validators: [validators.required],
                                        visible: values =>
                                            values.useFreeType === true
                                    }
                                ]
                            },
                            values,
                            modal: true,
                            backdrop: "static"
                        });

                        result.values.renderingEngine = "LVGL";
                        if (!result.values.useFreeType) {
                            result.values.threshold = 128;
                            result.values.createGlyphs = true;
                            result.values.createBlankGlyphs = false;
                            result.values.encodings = getEncodings(
                                result.values.ranges
                            );

                            lvglRanges = result.values.ranges;
                            lvglSymbols = result.values.symbols;

                            const { encodings, symbols } =
                                getLvglEncodingsAndSymbols(
                                    lvglRanges,
                                    lvglSymbols
                                );
                            result.values.encodings = encodings;
                            result.values.symbols = symbols;
                        }
                    } else {
                        result = await showGenericDialog(projectStore, {
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
                                        displayName: "Font file",
                                        type: AbsoluteFileInput,
                                        validators: [validators.required],
                                        options: {
                                            filters: [
                                                {
                                                    name: "Font files",
                                                    extensions: ["ttf", "otf"]
                                                },
                                                {
                                                    name: "All Files",
                                                    extensions: ["*"]
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: "renderingEngine",
                                        displayName: "Rendering engine",
                                        type: "enum",
                                        enumItems: [
                                            {
                                                id: "freetype",
                                                label: "FreeType"
                                            },
                                            {
                                                id: "opentype",
                                                label: "OpenType"
                                            }
                                        ]
                                    },
                                    {
                                        name: "bpp",
                                        displayName: "Bits per pixel",
                                        type: "enum",
                                        enumItems: [1, 2, 4, 8],
                                        visible: () =>
                                            isV1Project(parent) ||
                                            isEezGuiLiteProject(parent)
                                    },
                                    {
                                        name: "size",
                                        displayName: "Font size (points)",
                                        type: "number"
                                    },
                                    {
                                        name: "threshold",
                                        type: "number",
                                        visible: is1BitPerPixel
                                    },
                                    {
                                        name: "createGlyphs",
                                        displayName: "Create characters",
                                        type: "boolean",
                                        checkboxStyleSwitch: true
                                    },
                                    {
                                        name: "fromGlyph",
                                        displayName: "From character",
                                        type: "number",
                                        visible: isCreateGlyphs
                                    },
                                    {
                                        name: "toGlyph",
                                        displayName: "To character",
                                        type: "number",
                                        visible: isCreateGlyphs
                                    },
                                    {
                                        name: "createBlankGlyphs",
                                        displayName: "Create blank characters",
                                        type: "boolean",
                                        visible: isCreateGlyphs,
                                        checkboxStyleSwitch: true
                                    }
                                ],
                                className: "EezStudio_NewFontDialog"
                            },
                            values,
                            modal: true,
                            backdrop: "static"
                        });
                    }

                    values = result.values;

                    try {
                        let font;
                        if (
                            projectStore.projectTypeTraits.isLVGL &&
                            result.values.useFreeType
                        ) {
                            let relativeFilePath = getProjectStore(
                                parent
                            ).getFilePathRelativeToProjectPath(
                                result.values.filePath
                            );

                            font = createObject<Font>(
                                projectStore,
                                {
                                    name: result.values.name,
                                    source: {
                                        filePath: relativeFilePath,
                                        size: result.values.size
                                    } as any,
                                    glyphs: [],
                                    lvglUseFreeType: true,
                                    lvglFreeTypeRenderMode:
                                        result.values.lvglFreeTypeRenderMode,
                                    lvglFreeTypeStyle:
                                        result.values.lvglFreeTypeStyle,
                                    lvglFreeTypeFilePath:
                                        result.values.lvglFreeTypeFilePath
                                },
                                Font
                            );
                        } else {
                            let absoluteFilePath = result.values.filePath;
                            let relativeFilePath = getProjectStore(
                                parent
                            ).getFilePathRelativeToProjectPath(
                                result.values.filePath
                            );

                            const fontProperties = await extractFont({
                                name: result.values.name,
                                absoluteFilePath,
                                relativeFilePath,
                                renderingEngine: result.values.renderingEngine,
                                bpp: result.values.bpp,
                                size: result.values.size,
                                threshold: result.values.threshold,
                                createGlyphs: result.values.createGlyphs,
                                encodings: projectStore.projectTypeTraits.isLVGL
                                    ? result.values.encodings
                                    : result.values.createGlyphs
                                      ? result.values.encodings
                                          ? result.values.encodings
                                          : [
                                                {
                                                    from: result.values
                                                        .fromGlyph,
                                                    to: result.values.toGlyph
                                                }
                                            ]
                                      : [],
                                symbols: result.values.symbols,
                                createBlankGlyphs:
                                    result.values.createBlankGlyphs,
                                doNotAddGlyphIfNotFound: false,
                                lvglVersion:
                                    projectStore.project.settings.general
                                        .lvglVersion,
                                lvglInclude:
                                    projectStore.project.settings.build
                                        .lvglInclude,
                                getAllGlyphs: projectStore.projectTypeTraits
                                    .isLVGL
                                    ? true
                                    : undefined
                            });

                            if (projectStore.projectTypeTraits.isLVGL) {
                                (fontProperties as Font).lvglRanges =
                                    lvglRanges;
                                (fontProperties as Font).lvglSymbols =
                                    lvglSymbols;
                            }

                            font = createObject<Font>(
                                projectStore,
                                fontProperties as any,
                                Font
                            );
                        }

                        notification.info(`Added ${result.values.name} font.`);

                        return font;
                    } catch (err) {
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
                            notification.error(`Adding ${Font.name} failed!`);
                        }
                    }
                }
            } catch (err) {
                // canceled
                return undefined;
            }
        },
        icon: "material:font_download"
    };

    get glyphsMap() {
        const map = new Map<number, Glyph>();
        this.glyphs.forEach(glyph => map.set(glyph.encoding, glyph));
        return map;
    }

    get maxDx() {
        return Math.max(...this.glyphs.map(glyph => glyph.dx)) || 0;
    }

    getMaxEncoding() {
        return Math.max(...this.glyphs.map(glyph => glyph.encoding));
    }

    getAdditionalSourcesParams(
        projectStore: ProjectStore
    ): AdditionalFontSourceParams[] {
        if (
            !this.lvglAdditionalSources ||
            this.lvglAdditionalSources.length === 0
        ) {
            return [];
        }

        return this.lvglAdditionalSources
            .filter(additionalSource => additionalSource.filePath)
            .map(additionalSource => {
                const { encodings, symbols } = getLvglEncodingsAndSymbols(
                    additionalSource.lvglRanges || "",
                    additionalSource.lvglSymbols || ""
                );

                return {
                    absoluteFilePath: projectStore.getAbsoluteFilePath(
                        additionalSource.filePath
                    ),
                    relativeFilePath: additionalSource.filePath,
                    size: this.source!.size!,
                    encodings,
                    symbols
                };
            });
    }

    get _lvglExtractFontParams(): ExtractFontParams | undefined {
        if ((!this.lvglRanges && !this.lvglSymbols) || this.lvglUseFreeType) {
            return undefined;
        }

        const projectStore = ProjectEditor.getProjectStore(this);

        const { encodings, symbols } = getLvglEncodingsAndSymbols(
            this.lvglRanges,
            this.lvglSymbols
        );

        const lvglVersion = projectStore.project.settings.general.lvglVersion;
        const lvglInclude = projectStore.project.settings.build.lvglInclude;

        ////////////////////////////////////////
        // build opts_string

        let opts_string = "";

        //
        opts_string += `--bpp ${this.bpp} --size ${this.source!
            .size!} --no-compress --font ${this.source!.filePath}`;

        const lvglSymbols = this.lvglSymbols.replace(/\s/g, "");
        if (lvglSymbols) {
            opts_string += ` --symbols ${lvglSymbols}`;
        }

        const lvglRanges = this.lvglRanges.replace(/\s/g, "");
        if (lvglRanges) {
            opts_string += ` --range ${lvglRanges}`;
        }

        if (this.lvglFallbackFont) {
            opts_string += ` --lv-fallback ${this.lvglFallbackFont}`;
        }

        opts_string += " --format lvgl";

        // Build opts_string for additional sources
        for (const additionalSource of this.lvglAdditionalSources || []) {
            if (!additionalSource.filePath) continue;
            opts_string += ` --font ${additionalSource.filePath}`;
            const addSymbols = (additionalSource.lvglSymbols || "").replace(
                /\s/g,
                ""
            );
            if (addSymbols) {
                opts_string += ` --symbols ${addSymbols}`;
            }
            const addRanges = (additionalSource.lvglRanges || "").replace(
                /\s/g,
                ""
            );
            if (addRanges) {
                opts_string += ` --range ${addRanges}`;
            }
        }

        ////////////////////////////////////////

        return {
            name: this.name,
            absoluteFilePath: projectStore.getAbsoluteFilePath(
                this.source!.filePath
            ),
            embeddedFontFile: this.embeddedFontFile,
            relativeFilePath: this.source!.filePath,
            renderingEngine: this.renderingEngine,
            bpp: this.bpp,
            size: this.source!.size!,
            threshold: this.threshold,
            createGlyphs: false,
            encodings,
            symbols,
            createBlankGlyphs: false,
            doNotAddGlyphIfNotFound: false,
            getAllGlyphs: true,
            lvglVersion,
            lvglInclude,
            additionalSources: this.getAdditionalSourcesParams(projectStore),
            opts_string,
            lv_fallback: this.lvglFallbackFont
        };
    }

    reloadLvglGlyphs() {
        if (isLVGLProject(this) && this._lvglGlyphsDirty) {
            setTimeout(async () => {
                let extractFontParams = this._lvglExtractFontParams;
                if (extractFontParams) {
                    extractFontParams = { ... extractFontParams, createGlyphs: true };
                    const result = await extractFont(extractFontParams);
                    if (result.glyphs) {
                        const projectStore = ProjectEditor.getProjectStore(this);
                        const glyphs = result.glyphs;
                        runInAction(() => {
                            this.glyphs.splice(0, this.glyphs.length);
                            for (const glyphProperties of glyphs) {
                                const glyph = createObject<Glyph>(
                                    projectStore,
                                    glyphProperties as any,
                                    Glyph
                                );
                                setParent(glyph, this.glyphs);
                                this.glyphs.push(glyph);
                            }
                        });
                    }
                }
            });
        }        
    }

    async buildLvglFontDefinition(
        extractFontParams: ExtractFontParams | undefined
    ) {
        runInAction(() => {
            this._lvglGlyphsDirty = true;
        });

        this._lvglFontDefinitionExtractFontParams = extractFontParams;

        if (!extractFontParams) {
            if (this._lvglFontDefinition) {
                runInAction(() => {
                    this._lvglFontDefinition = undefined;
                });
            }
            return;
        }

        try {
            let result;

            const projectStore = ProjectEditor.getProjectStore(this);

            result =
                projectStore.fontsCacheStore.getCachedFontDefinition(
                    extractFontParams
                );

            if (!result) {
                try {
                    result = await extractFont(extractFontParams);
                } catch (err) {
                }
            }

            if (result && result.lvglBinFile && result.lvglSourceFile) {
                const binFile = result.lvglBinFile;
                const sourceFile = result.lvglSourceFile;

                runInAction(() => {
                    if (this._lvglFontDefinition) {
                        this._lvglFontDefinition.binFile = binFile;
                        this._lvglFontDefinition.sourceFile = sourceFile;
                    } else {
                        this._lvglFontDefinition = {
                            binFile,
                            sourceFile
                        };
                    }
                });               
            } else {
                runInAction(() => {
                    this._lvglFontDefinition = undefined;
                });                
            }
        } catch (err) {
            console.error(err);

            runInAction(() => {
                this._lvglFontDefinition = undefined;
            });
        }
    }

    getLvglBinFile() {
        const currentExtractFontParams = this._lvglExtractFontParams;

        if (
            !this._lvglFontDefinitionExtractFontParams ||
            this._lvglFontDefinitionExtractFontParams !=
                currentExtractFontParams
        ) {
            this._lvglFontDefinitionExtractFontParams =
                currentExtractFontParams;

            setTimeout(async () => {
                await this.buildLvglFontDefinition(currentExtractFontParams);
            });
        }

        return this._lvglFontDefinition?.binFile;
    }

    async getLvglBinFileAsync() {
        if (!this._lvglFontDefinition) {
            await this.buildLvglFontDefinition(this._lvglExtractFontParams);
        }
        return this._lvglFontDefinition?.binFile;
    }

    async getLvglSourceFile() {
        if (!this._lvglFontDefinition) {
            await this.buildLvglFontDefinition(this._lvglExtractFontParams);
        }
        return this._lvglFontDefinition?.sourceFile;
    }
}

registerClass("Font", Font);

////////////////////////////////////////////////////////////////////////////////

export function getEncodings(ranges: string): EncodingRange[] | undefined {
    let encodings: EncodingRange[] = [];

    ranges = ranges.trim();
    if (ranges != "") {
        let rangeArr = ranges.split(",");

        for (let i = 0; i < rangeArr.length; i++) {
            let parts2 = rangeArr[i].split("=>");

            let mapped_from: number | undefined;
            if (parts2.length == 2) {
                mapped_from = parseInt(parts2[1]);
                if (isNaN(mapped_from) || mapped_from < 0) {
                    return undefined;
                }
            }

            let parts = parts2[0].split("-");
            if (parts.length < 1 || parts.length > 2) {
                return undefined;
            }

            const from = parseInt(parts[0]);
            if (isNaN(from) || from < 0) {
                return undefined;
            }

            if (parts.length == 2) {
                const to = parseInt(parts[1]);
                if (isNaN(to) || to < 0 || to < from) {
                    return undefined;
                }
                encodings.push({ from, to, mapped_from });
            } else {
                encodings.push({ from, to: from, mapped_from });
            }
        }
    }

    return encodings;
}

export function validateRanges(object: any, ruleName: string) {
    const ranges = object[ruleName];
    if (ranges == undefined) {
        return VALIDATION_MESSAGE_REQUIRED;
    }

    return getEncodings(ranges) ? null : "Invalid range";
}

export function requiredRangesOrSymbols(object: any, ruleName: string) {
    const ranges = object["ranges"];
    const symbols = object["symbols"];

    if (!ranges && !symbols) {
        return "Either ranges or symbols are required";
    }

    return null;
}

export function removeDuplicates(encodings: EncodingRange[], symbols: string) {
    function cleanUpRanges(ranges: EncodingRange[]): EncodingRange[] {
        if (ranges.length <= 1) {
            return ranges;
        }

        // Sort the ranges based on their 'from' values
        ranges.sort((a, b) => a.from - b.from);

        const cleanedRanges: EncodingRange[] = [];
        let currentRange = ranges[0];

        for (let i = 1; i < ranges.length; i++) {
            const nextRange = ranges[i];

            if (nextRange.from <= currentRange.to) {
                // There is an overlap, update the 'to' value of the current range
                currentRange.to = Math.max(currentRange.to, nextRange.to);
            } else {
                // No overlap, add the current range to the cleaned ranges
                cleanedRanges.push(currentRange);
                currentRange = nextRange;
            }
        }

        // Add the last remaining range to the cleaned ranges
        cleanedRanges.push(currentRange);

        return cleanedRanges;
    }

    encodings = cleanUpRanges(encodings);

    function isCharacterInEncodings(ch: number) {
        for (const range of encodings) {
            if (ch >= range.from && ch <= range.to) {
                return true;
            }
        }
        return false;
    }

    let symbolsDeduplicated = "";
    for (let i = 0; i < symbols.length; i++) {
        if (
            symbolsDeduplicated.indexOf(symbols[i]) == -1 &&
            !isCharacterInEncodings(symbols.codePointAt(i)!)
        ) {
            symbolsDeduplicated += symbols[i];
        }
    }

    return { encodings, symbols: symbolsDeduplicated };
}

export function getLvglEncodingsAndSymbols(
    lvglRanges: string,
    lvglSymbols: string
) {
    const encodingsBeforeDeduplication = getEncodings(lvglRanges)!;
    return removeDuplicates(encodingsBeforeDeduplication, lvglSymbols);
}

////////////////////////////////////////////////////////////////////////////////

export async function onEditGlyphs(object: Font | AdditionalFontSource) {
    const projectStore = ProjectEditor.getProjectStore(object);

    const result = await showGenericDialog(projectStore, {
        dialogDefinition: {
            title: "Add or Remove Characters",
            fields: [
                {
                    name: "ranges",
                    type: "string",
                    validators: [validateRanges, requiredRangesOrSymbols],
                    formText:
                        "Ranges and/or characters to include. Example: 32-127,140,160-170,200,210-255"
                },
                {
                    name: "symbols",
                    type: "string",
                    validators: [requiredRangesOrSymbols],
                    formText:
                        "List of characters to include. Example: abc01234äöüčćšđ"
                }
            ]
        },
        values: {
            ranges: object.lvglRanges,
            symbols: object.lvglSymbols
        }
    });

    projectStore.updateObject(object, {
        lvglRanges: result.values.ranges,
        lvglSymbols: result.values.symbols
    });
}

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-font",
    version: "0.1.0",
    description: "Fonts support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Fonts",
    mandatory: false,
    key: "fonts",
    type: PropertyType.Array,
    typeClass: Font,
    icon: "material:font_download",
    create: () => [],
    check: (projectStore, object: EezObject[], messages: IMessage[]) => {
        if (object.length > 255) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    "Max. 255 fonts are supported",
                    object
                )
            );
        }
    },
    fromJsHook: (jsObject: Project) => {
        if (jsObject.fonts) {
            for (
                let fontIndex = 0;
                fontIndex < jsObject.fonts.length;
                fontIndex++
            ) {
                const font: any = jsObject.fonts[fontIndex];

                if (font.embeddedFontFileIndex != undefined) {
                    font.embeddedFontFile =
                        jsObject.fonts[
                            font.embeddedFontFileIndex
                        ].embeddedFontFile;
                    delete font.embeddedFontFileIndex;
                }
            }
        }
    },
    toJsHook: (jsObject: Project, project: Project) => {
        if (jsObject.fonts) {
            for (
                let fontIndex = 0;
                fontIndex < jsObject.fonts.length;
                fontIndex++
            ) {
                const font = jsObject.fonts[fontIndex];

                if (font.lvglRanges || font.lvglSymbols) {
                    font.glyphs = [];
                } else {
                    font.glyphs.forEach(glyph => {
                        if (glyph.glyphBitmap && glyph.glyphBitmap.pixelArray) {
                            (glyph.glyphBitmap as any).pixelArray =
                                serializePixelArray(
                                    glyph.glyphBitmap.pixelArray
                                );
                        }
                    });
                }

                if (
                    project.settings.general.projectType != ProjectType.LVGL ||
                    project.settings.general.embedFonts
                ) {
                    if (font.embeddedFontFile) {
                        let embeddedFontFileIndex = -1;

                        for (
                            let prevFontIndex = 0;
                            prevFontIndex < fontIndex;
                            prevFontIndex++
                        ) {
                            const prevFont = jsObject.fonts[prevFontIndex];
                            if (
                                prevFont.embeddedFontFile ==
                                font.embeddedFontFile
                            ) {
                                embeddedFontFileIndex = prevFontIndex;
                                break;
                            }
                        }

                        if (embeddedFontFileIndex != -1) {
                            delete font.embeddedFontFile;
                            (font as any).embeddedFontFileIndex =
                                embeddedFontFileIndex;
                        }
                    }
                } else {
                    font.embeddedFontFile = undefined;
                }
            }
        }
    }
};

export default feature;
