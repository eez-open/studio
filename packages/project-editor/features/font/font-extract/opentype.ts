import fs from "fs";
import { load, parse, Font as OpenTypeFont } from "opentype.js";

import {
    toArrayBuffer,
    getEncodingArrayFromEncodingRanges
} from "project-editor/features/font/utils";
import type {
    Params,
    FontProperties,
    GlyphProperties
} from "project-editor/features/font/font-extract";

////////////////////////////////////////////////////////////////////////////////

export async function extractFont(params: Params) {
    return new Promise<FontProperties>((resolve, reject) => {
        load(params.absoluteFilePath, (err, font) => {
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

            const canvas = document.createElement(
                "canvas"
            ) as HTMLCanvasElement;
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext("2d")!;

            const fontSize = params.size * (4 / 3);

            var scale = (1 / (font.unitsPerEm || 1000)) * fontSize;

            const x = 512;
            const y = 512;

            const ascent = Math.round(font.ascender * scale);
            const descent = Math.round(-font.descender * scale);

            const fontProperties: FontProperties = {
                name: params.name || "",
                renderingEngine: "opentype",
                source: {
                    filePath: params.relativeFilePath,
                    size: params.size,
                    threshold: params.threshold
                },
                bpp: params.bpp,
                threshold: params.threshold,
                height: ascent + descent,
                ascent,
                descent,
                glyphs: []
            };

            function addGlyph(encoding: number) {
                const glyph =
                    allEncodings.indexOf(encoding) != -1
                        ? font!.charToGlyph(String.fromCharCode(encoding))
                        : undefined;

                const bb = glyph
                    ? glyph.getBoundingBox()
                    : {
                          x1: 0,
                          x2: 0,
                          y1: 0,
                          y2: 0
                      };
                const x1 = Math.floor(bb.x1 * scale);
                const x2 = Math.ceil(bb.x2 * scale);
                const y1 = Math.floor(bb.y1 * scale);
                const y2 = Math.ceil(bb.y2 * scale);

                let glyphProperties: GlyphProperties = {} as any;

                glyphProperties.encoding = encoding;

                glyphProperties.dx = glyph
                    ? Math.ceil(glyph.advanceWidth * scale)
                    : 0;

                glyphProperties.x = x1;
                glyphProperties.y = y1;
                glyphProperties.width = x2 - x1;
                glyphProperties.height = y2 - y1;

                glyphProperties.source = {
                    filePath: params.relativeFilePath,
                    size: params.size,
                    threshold: params.threshold,
                    encoding
                } as any;

                glyphProperties.glyphBitmap = {
                    width: 0,
                    height: 0,
                    pixelArray: []
                };

                if (
                    glyph &&
                    glyphProperties.width > 0 &&
                    glyphProperties.height > 0
                ) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    glyph.draw(ctx, x, y, fontSize, {
                        hinting: true
                    } as any);

                    glyphProperties.glyphBitmap.width = glyphProperties.width;
                    glyphProperties.glyphBitmap.height = glyphProperties.height;

                    const imageData = ctx.getImageData(
                        x + x1,
                        y - y2,
                        glyphProperties.width,
                        glyphProperties.height
                    );

                    const pixelArray = glyphProperties.glyphBitmap.pixelArray;

                    if (params.bpp === 8) {
                        for (
                            let i = 0;
                            i < glyphProperties.width * glyphProperties.height;
                            i++
                        ) {
                            pixelArray.push(imageData.data[i * 4 + 3]);
                        }
                    } else {
                        let widthInBytes = Math.floor(
                            (glyphProperties.width + 7) / 8
                        );

                        for (let y = 0; y < glyphProperties.height; y++) {
                            for (let x = 0; x < glyphProperties.width; x++) {
                                const index =
                                    y * widthInBytes + Math.floor(x / 8);
                                if (index == pixelArray.length) {
                                    pixelArray.push(0);
                                }

                                if (
                                    imageData.data[
                                        (y * glyphProperties.width + x) * 4 + 3
                                    ] > params.threshold
                                ) {
                                    pixelArray[index] |= 0x80 >> x % 8;
                                }
                            }
                        }
                    }
                }

                fontProperties.glyphs.push(glyphProperties);
            }

            const allEncodings = getAllGlyphEncodingsInOpenTypeFont(font);

            let encodings = params.encodings
                ? getEncodingArrayFromEncodingRanges(params.encodings)
                : allEncodings;

            for (const encoding of encodings) {
                addGlyph(encoding);
            }

            resolve(fontProperties);
        });
    });
}

////////////////////////////////////////////////////////////////////////////////

export function loadFontUsingOpentypeJS(
    name: string | undefined,
    filePath: string,
    bpp: number,
    size: number,
    threshold: number,
    createGlyphs: boolean,
    fromEncoding: number | undefined,
    toEncoding: number | undefined,
    createBlankGlyphs: boolean,
    resolve: (font: any) => void,
    reject: (error: any) => void
) {
    fs.readFile(filePath, (err: any, data: any) => {
        if (err) {
            reject(err);
        } else {
            let openTypeFont = opentype.parse(toArrayBuffer(data));

            if (!openTypeFont.supported) {
                reject("Font is not supported!");
                return;
            }

            const PPI = 100;
            let sizePX = (size * PPI) / 72;

            let scale = (1 / openTypeFont.unitsPerEm) * sizePX;

            let ascent = Math.round(openTypeFont.ascender * scale);
            let descent = Math.round(-openTypeFont.descender * scale);
            let height = ascent + descent;

            let font: FontProperties = {
                name: name,
                source: {
                    filePath: filePath,
                    size: size,
                    threshold: threshold
                },
                bpp,
                ascent: ascent,
                descent: descent,
                height: height,
                glyphs: []
            } as any;

            if (createGlyphs) {
                function addGlyph(glyph: any, encoding: number) {
                    let glyphProperties: GlyphProperties = {} as any;

                    glyphProperties.encoding = encoding;

                    if (!createBlankGlyphs) {
                        let dx = Math.round(glyph.advanceWidth * scale);

                        glyphProperties.dx = dx;

                        // get pixels
                        let canvas = document.createElement(
                            "canvas"
                        ) as HTMLCanvasElement;
                        canvas.width = dx;
                        canvas.height = height;

                        let xMin = canvas.width;
                        let xMax = 0;
                        let yMin = canvas.height;
                        let yMax = 0;

                        let ctx = canvas.getContext("2d")!;

                        let x = 0;
                        let y = openTypeFont.ascender * scale;

                        glyph.draw(ctx, x, y, sizePX);

                        let imageData = ctx.getImageData(
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        );
                        let pixelMatrix = imageData.data;

                        let hasPixels = false;

                        for (let y = 0; y < canvas.height; y++) {
                            for (let x = 0; x < canvas.width; x++) {
                                let i = (y * canvas.width + x) * 4 + 3;

                                let hasPixel: boolean = false;

                                if (bpp === 8) {
                                    if (pixelMatrix[i]) {
                                        hasPixel = true;
                                    }
                                } else {
                                    if (pixelMatrix[i] >= threshold) {
                                        hasPixel = true;
                                        pixelMatrix[i] = 255;
                                    }
                                }

                                if (hasPixel) {
                                    if (x < xMin) {
                                        xMin = x;
                                    } else if (x > xMax) {
                                        xMax = x;
                                    }

                                    if (y < yMin) {
                                        yMin = y;
                                    } else if (y > yMax) {
                                        yMax = y;
                                    }

                                    hasPixels = true;
                                }
                            }
                        }

                        if (hasPixels) {
                            glyphProperties.x = xMin;
                            glyphProperties.y = ascent - yMax;
                            glyphProperties.width = xMax - xMin + 1;
                            glyphProperties.height = yMax - yMin + 1;

                            let pixelArray: Array<number>;

                            if (bpp === 8) {
                                pixelArray = new Array<number>(
                                    glyphProperties.width *
                                        glyphProperties.height
                                );
                                let i = 0;
                                for (let y = yMin; y <= yMax; y++) {
                                    for (let x = xMin; x <= xMax; x++) {
                                        pixelArray[i++] =
                                            pixelMatrix[
                                                (y * canvas.width + x) * 4 + 3
                                            ];
                                    }
                                }
                            } else {
                                pixelArray = [];

                                let widthInBytes = Math.floor(
                                    (glyphProperties.width + 7) / 8
                                );

                                for (let y = yMin; y <= yMax; y++) {
                                    for (
                                        let x = xMin, iByte = 0;
                                        iByte < widthInBytes && x <= xMax;
                                        iByte++
                                    ) {
                                        let byteData = 0;

                                        for (
                                            let iBit = 0;
                                            iBit < 8 && x <= xMax;
                                            iBit++, x++
                                        ) {
                                            let i =
                                                (y * canvas.width + x) * 4 + 3;
                                            if (pixelMatrix[i] > threshold) {
                                                byteData |= 0x80 >> iBit;
                                            }
                                        }

                                        pixelArray.push(byteData);
                                    }
                                }
                            }

                            glyphProperties.glyphBitmap = {
                                width: glyphProperties.width,
                                height: glyphProperties.height,
                                pixelArray: pixelArray
                            };
                        } else {
                            glyphProperties.x = 0;
                            glyphProperties.y = 0;
                            glyphProperties.width = 0;
                            glyphProperties.height = 0;
                            glyphProperties.glyphBitmap = {
                                width: 0,
                                height: 0,
                                pixelArray: []
                            };
                        }
                    }

                    glyphProperties.source = {
                        filePath: filePath,
                        size: size,
                        threshold: threshold,
                        encoding: encoding
                    } as any;

                    font.glyphs.push(glyphProperties);
                }

                if (fromEncoding && toEncoding) {
                    for (
                        let encoding = fromEncoding;
                        encoding <= toEncoding;
                        encoding++
                    ) {
                        let glyph = openTypeFont.charToGlyph(
                            String.fromCharCode(encoding)
                        );
                        if (glyph) {
                            addGlyph(glyph, encoding);
                        }
                    }
                } else {
                    for (let i = 0; i < openTypeFont.glyphs.length; i++) {
                        let glyph = openTypeFont.glyphs.get(i);
                        if (glyph.unicode !== undefined) {
                            addGlyph(glyph, glyph.unicode);
                        }
                    }
                }
            }

            resolve(font);
        }
    });
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
