import fs from "fs";
import { load, parse, Font as OpenTypeFont } from "opentype.js";

import { toArrayBuffer } from "project-editor/features/font/utils";
import type {
    Params,
    FontProperties,
    GlyphProperties,
    IFontExtract
} from "project-editor/features/font/font-extract";

////////////////////////////////////////////////////////////////////////////////

export class ExtractFont implements IFontExtract {
    font: OpenTypeFont;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    fontSize: number;
    scale: number;
    fontProperties: FontProperties;
    allEncodings: number[];

    constructor(private params: Params) {}

    async start() {
        return new Promise<void>((resolve, reject) => {
            load(this.params.absoluteFilePath, (err, font) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!font) {
                    reject("Unexpected error!");
                    return;
                }

                if (!font.supported) {
                    reject("Font is not supported!");
                    return;
                }

                this.font = font;

                const canvas = document.createElement(
                    "canvas"
                ) as HTMLCanvasElement;
                canvas.width = 1024;
                canvas.height = 1024;
                const ctx = canvas.getContext("2d")!;

                // 1 pt = 1.333(3) px if resolution is 72
                this.fontSize = 1.333 * this.params.size;

                var scale = (1 / (font.unitsPerEm || 1000)) * this.fontSize;

                this.canvas = canvas;
                this.ctx = ctx;
                this.scale = scale;

                const ascent = Math.round(font.ascender * scale);
                const descent = Math.round(-font.descender * scale);

                this.fontProperties = {
                    name: this.params.name || "",
                    renderingEngine: "opentype",
                    source: {
                        filePath: this.params.relativeFilePath,
                        size: this.params.size,
                        threshold: this.params.threshold
                    },
                    bpp: this.params.bpp,
                    threshold: this.params.threshold,
                    height: ascent + descent,
                    ascent,
                    descent,
                    glyphs: []
                };

                this.allEncodings = getAllGlyphEncodingsInOpenTypeFont(font);

                resolve();
            });
        });
    }

    getGlyph(encoding: number) {
        const glyph =
            this.allEncodings.indexOf(encoding) != -1
                ? this.font.charToGlyph(String.fromCharCode(encoding))
                : undefined;

        if (!glyph && this.params.doNotAddGlyphIfNotFound) {
            return undefined;
        }

        const bb = glyph
            ? glyph.getBoundingBox()
            : {
                  x1: 0,
                  x2: 0,
                  y1: 0,
                  y2: 0
              };
        const x1 = Math.floor(bb.x1 * this.scale);
        const x2 = Math.ceil(bb.x2 * this.scale);
        const y1 = Math.floor(bb.y1 * this.scale);
        const y2 = Math.ceil(bb.y2 * this.scale);

        let glyphProperties: GlyphProperties = {} as any;

        glyphProperties.encoding = encoding;

        glyphProperties.dx = glyph
            ? Math.ceil(glyph.advanceWidth ?? 0 * this.scale)
            : 0;

        glyphProperties.x = x1;
        glyphProperties.y = y1;
        glyphProperties.width = x2 - x1;
        glyphProperties.height = y2 - y1;

        glyphProperties.source = {
            filePath: this.params.relativeFilePath,
            size: this.params.size,
            threshold: this.params.threshold,
            encoding
        } as any;

        glyphProperties.glyphBitmap = {
            width: 0,
            height: 0,
            pixelArray: []
        };

        if (
            !this.params.createBlankGlyphs &&
            glyph &&
            glyphProperties.width > 0 &&
            glyphProperties.height > 0
        ) {
            const x = 512;
            const y = 512;

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            glyph.draw(this.ctx, x, y, this.fontSize, {
                hinting: true
            } as any);

            glyphProperties.glyphBitmap.width = glyphProperties.width;
            glyphProperties.glyphBitmap.height = glyphProperties.height;

            const imageData = this.ctx.getImageData(
                x + x1,
                y - y2,
                glyphProperties.width,
                glyphProperties.height
            );

            const pixelArray = glyphProperties.glyphBitmap.pixelArray;

            if (this.params.bpp === 8) {
                for (
                    let i = 0;
                    i < glyphProperties.width * glyphProperties.height;
                    i++
                ) {
                    pixelArray.push(imageData.data[i * 4 + 3]);
                }
            } else {
                let widthInBytes = Math.floor((glyphProperties.width + 7) / 8);

                for (let y = 0; y < glyphProperties.height; y++) {
                    for (let x = 0; x < glyphProperties.width; x++) {
                        const index = y * widthInBytes + Math.floor(x / 8);
                        if (index == pixelArray.length) {
                            pixelArray.push(0);
                        }

                        if (
                            imageData.data[
                                (y * glyphProperties.width + x) * 4 + 3
                            ] > this.params.threshold
                        ) {
                            pixelArray[index] |= 0x80 >> x % 8;
                        }
                    }
                }
            }
        }

        return glyphProperties;
    }

    freeResources() {}
}

////////////////////////////////////////////////////////////////////////////////

function getAllGlyphEncodingsInOpenTypeFont(openTypeFont: OpenTypeFont) {
    const encodings = [];

    for (let i = 0; i < openTypeFont.glyphs.length; i++) {
        let glyph = openTypeFont.glyphs.get(i);
        if (glyph.unicode !== undefined) {
            encodings.push(glyph.unicode);
        }
    }

    return encodings;
}

export function getAllGlyphEncodings(filePath: string) {
    // use opentype lib to get all encodings since we don't know how to do it using fontExtract module
    return new Promise<number[]>((resolve, reject) => {
        fs.readFile(filePath, (err: any, data: any) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const openTypeFont = parse(toArrayBuffer(data));

                    if (!openTypeFont.supported) {
                        reject("Font is not supported!");
                    } else {
                        resolve(
                            getAllGlyphEncodingsInOpenTypeFont(openTypeFont)
                        );
                    }
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}
