import { toArrayBuffer } from "font-services/util";
import { FontProperties, GlyphProperties } from "font-services/interfaces";

const fs = require("fs");

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

            let font: FontProperties = <any>{
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
                screenOrientation: "all",
                glyphs: []
            };

            if (createGlyphs) {
                function addGlyph(glyph: any, encoding: number) {
                    let glyphProperties: GlyphProperties = <any>{};

                    glyphProperties.encoding = encoding;

                    if (!createBlankGlyphs) {
                        let dx = Math.round(glyph.advanceWidth * scale);

                        glyphProperties.dx = dx;

                        // get pixels
                        let canvas = document.createElement("canvas");
                        canvas.width = dx;
                        canvas.height = height;

                        let xMin = canvas.width;
                        let xMax = 0;
                        let yMin = canvas.height;
                        let yMax = 0;

                        let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");

                        let x = 0;
                        let y = openTypeFont.ascender * scale;

                        glyph.draw(ctx, x, y, sizePX);

                        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
                                    glyphProperties.width * glyphProperties.height
                                );
                                let i = 0;
                                for (let y = yMin; y <= yMax; y++) {
                                    for (let x = xMin; x <= xMax; x++) {
                                        pixelArray[i++] =
                                            pixelMatrix[(y * canvas.width + x) * 4 + 3];
                                    }
                                }
                            } else {
                                pixelArray = [];

                                let widthInBytes = Math.floor((glyphProperties.width + 7) / 8);

                                for (let y = yMin; y <= yMax; y++) {
                                    for (
                                        let x = xMin, iByte = 0;
                                        iByte < widthInBytes && x <= xMax;
                                        iByte++
                                    ) {
                                        let byteData = 0;

                                        for (let iBit = 0; iBit < 8 && x <= xMax; iBit++, x++) {
                                            let i = (y * canvas.width + x) * 4 + 3;
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

                    glyphProperties.source = <any>{
                        filePath: filePath,
                        size: size,
                        threshold: threshold,
                        encoding: encoding
                    };

                    font.glyphs.push(glyphProperties);
                }

                if (fromEncoding && toEncoding) {
                    for (let encoding = fromEncoding; encoding <= toEncoding; encoding++) {
                        let glyph = openTypeFont.charToGlyph(String.fromCharCode(encoding));
                        if (glyph) {
                            addGlyph(glyph, encoding);
                        }
                    }
                } else {
                    for (let i = 0; i < openTypeFont.glyphs.length; i++) {
                        let glyph = openTypeFont.glyphs.glyphs[i];
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

export function getAllGlyphEncodings(filePath: string) {
    // use opentype lib to get all encodings since we don't know how to do it using fontExtract module
    return new Promise<number[]>((resolve, reject) => {
        fs.readFile(filePath, (err: any, data: any) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const opentype = require("../../libs/opentype.min.js");

                    const openTypeFont = opentype.parse(toArrayBuffer(data));

                    if (!openTypeFont.supported) {
                        reject("Font is not supported!");
                    } else {
                        const encodings = [];

                        for (let i = 0; i < openTypeFont.glyphs.length; i++) {
                            let glyph = openTypeFont.glyphs.glyphs[i];
                            if (glyph.unicode !== undefined) {
                                encodings.push(glyph.unicode);
                            }
                        }

                        resolve(encodings);
                    }
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}
