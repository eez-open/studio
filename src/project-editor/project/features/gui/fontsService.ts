import { ProjectStore } from "project-editor/core/store";

import { FontProperties } from "project-editor/project/features/gui/fontMetaData";
import { GlyphProperties } from "project-editor/project/features/gui/glyph";

let fs = EEZStudio.electron.remote.require("fs");
let path = EEZStudio.electron.remote.require("path");

////////////////////////////////////////////////////////////////////////////////

function loadBdfFont(
    name: string | undefined,
    filePath: string,
    createGlyphs: boolean,
    fromEncoding: number | undefined,
    toEncoding: number | undefined,
    createBlankGlyphs: boolean,
    resolve: (font: any) => void,
    reject: (error: any) => void
) {
    let absoluteFilePath = ProjectStore.getAbsoluteFilePath(filePath);
    let cacheFilePath = absoluteFilePath + ".eez-studio-project-editor-cache";

    fs.readFile(cacheFilePath, "utf8", (err: any, data: any) => {
        if (!err) {
            let font = JSON.parse(data);
            resolve(font);
            return;
        }

        fs.readFile(absoluteFilePath, "utf8", (err: any, data: any) => {
            if (err) {
                reject(err);
            } else {
                let state = "FONT";
                let font: FontProperties = <any>{
                    name: name,
                    source: {
                        filePath: filePath
                    },
                    ascent: 0,
                    descent: 0,
                    height: 0,
                    screenOrientation: "all",
                    glyphs: []
                };

                let glyph: GlyphProperties;
                let pixelArray: number[];

                data.split(/[\r\n]+/g).forEach((line: string) => {
                    let parts = line.split(/[ \t]+/g);
                    let name = parts[0];

                    if (state == "FONT") {
                        if (name == "FONT_ASCENT") {
                            font.ascent = parseInt(parts[1]);
                            font.height = font.ascent + font.descent;
                        } else if (name == "FONT_DESCENT") {
                            font.descent = parseInt(parts[1]);
                            font.height = font.ascent + font.descent;
                        } else if (name == "STARTCHAR") {
                            glyph = <any>{};
                            state = "CHAR";
                        }
                    } else if (state == "CHAR") {
                        if (name == "ENCODING") {
                            glyph.encoding = parseInt(parts[1]);
                        } else if (name == "BBX") {
                            if (!createBlankGlyphs) {
                                glyph.width = parseInt(parts[1]);
                                glyph.height = parseInt(parts[2]);
                                glyph.x = parseInt(parts[3]);
                                glyph.y = parseInt(parts[4]);
                            }
                        } else if (name == "DWIDTH") {
                            if (!createBlankGlyphs) {
                                glyph.dx = parseInt(parts[1]);
                            }
                        } else if (name == "BITMAP") {
                            pixelArray = [];
                            state = "BITMAP";
                        }
                    } else if (state == "BITMAP") {
                        if (name == "ENDCHAR") {
                            if (!createBlankGlyphs) {
                                glyph.glyphBitmap = {
                                    width: glyph.width,
                                    height: glyph.height,
                                    pixelArray: pixelArray
                                };
                            }
                            glyph.source = <any>{
                                filePath: filePath,
                                encoding: glyph.encoding
                            };
                            if (
                                createGlyphs &&
                                (fromEncoding === undefined || glyph.encoding >= fromEncoding) &&
                                (toEncoding === undefined || glyph.encoding <= toEncoding)
                            ) {
                                font.glyphs.push(glyph);
                            }
                            state = "FONT";
                        } else {
                            let matches = line.match(/../g);
                            if (matches) {
                                matches.forEach((hex: string) => {
                                    pixelArray.push(parseInt(hex, 16));
                                });
                            }
                        }
                    }
                });

                if (fromEncoding && toEncoding) {
                    font.glyphs = font.glyphs.sort((a, b) => {
                        if (a.encoding < b.encoding) {
                            return -1;
                        } else if (a.encoding > b.encoding) {
                            return 1;
                        }
                        return 0;
                    });

                    for (let i = fromEncoding, j = 0; i <= toEncoding; ++i, ++j) {
                        if (j >= font.glyphs.length || font.glyphs[j].encoding != i) {
                            let glyph: GlyphProperties = <any>{};

                            glyph.encoding = i;
                            glyph.source = <any>{
                                filePath: filePath,
                                encoding: glyph.encoding
                            };

                            font.glyphs.splice(j, 0, glyph);
                        }
                    }
                }

                fs.writeFile(cacheFilePath, JSON.stringify(font), "utf8", (err: any) => {
                    if (err) {
                        console.error(err);
                    }
                });

                resolve(font);
            }
        });
    });
}

function loadFontUsingOpentypeJS(
    name: string | undefined,
    filePath: string,
    size: number,
    threshold: number,
    createGlyphs: boolean,
    fromEncoding: number | undefined,
    toEncoding: number | undefined,
    createBlankGlyphs: boolean,
    resolve: (font: any) => void,
    reject: (error: any) => void
) {
    function toArrayBuffer(buffer: any) {
        let ab = new ArrayBuffer(buffer.length);
        let view = new Uint8Array(ab);
        for (let i = 0; i < buffer.length; ++i) {
            view[i] = buffer[i];
        }
        return ab;
    }

    fs.readFile(ProjectStore.getAbsoluteFilePath(filePath), (err: any, data: any) => {
        if (err) {
            reject(err);
        } else {
            let openTypeFont = opentype.parse(toArrayBuffer(data));

            if (!openTypeFont.supported) {
                reject("Font is not supported!");
                return;
            }

            let PPI = 100;
            let sizePX = size * PPI / 72;

            let scale = 1 / openTypeFont.unitsPerEm * sizePX;

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
                        let y = ascent;

                        glyph.draw(ctx, x, y, sizePX);

                        if (glyph.xMin != undefined) {
                            x = Math.round(glyph.xMin * scale) - glyph.xMin * scale;
                            y = ascent - (Math.round(glyph.yMax * scale) - glyph.yMax * scale);

                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.save();
                            ctx.translate(x, y);
                            glyph.draw(ctx, 0, 0, sizePX);
                            ctx.restore();
                        }

                        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        let pixelMatrix = imageData.data;

                        let hasPixels = false;

                        for (let y = 0; y < canvas.height; ++y) {
                            for (let x = 0; x < canvas.width; ++x) {
                                let i = (y * canvas.width + x) * 4 + 3;
                                if (pixelMatrix[i] >= threshold) {
                                    hasPixels = true;
                                    pixelMatrix[i] = 255;
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
                                }
                            }
                        }

                        if (hasPixels) {
                            glyphProperties.x = xMin;
                            glyphProperties.y = ascent - yMax;
                            glyphProperties.width = xMax - xMin + 1;
                            glyphProperties.height = yMax - yMin + 1;

                            let widthInBytes = Math.floor((glyphProperties.width + 7) / 8);

                            let pixelArray = [];

                            for (let y = yMin; y <= yMax; ++y) {
                                for (
                                    let x = xMin, iByte = 0;
                                    iByte < widthInBytes && x <= xMax;
                                    ++iByte
                                ) {
                                    let byteData = 0;

                                    for (let iBit = 0; iBit < 8 && x <= xMax; ++iBit, ++x) {
                                        let i = (y * canvas.width + x) * 4 + 3;
                                        if (pixelMatrix[i] == 255) {
                                            byteData |= 0x80 >> iBit;
                                        }
                                    }

                                    pixelArray.push(byteData);
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
                    for (let encoding = fromEncoding; encoding <= toEncoding; ++encoding) {
                        let glyph = openTypeFont.charToGlyph(String.fromCharCode(encoding));
                        if (glyph) {
                            addGlyph(glyph, encoding);
                        }
                    }
                } else {
                    for (let i = 0; i < openTypeFont.glyphs.length; ++i) {
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

export function loadFontFromFile(
    name: string | undefined,
    filePath: string,
    size: number,
    threshold: number,
    createGlyphs: boolean,
    fromEncoding?: number,
    toEncoding?: number,
    createBlankGlyphs?: boolean
) {
    return new Promise<FontProperties>((resolve, reject) => {
        if (path.extname(filePath) == ".bdf") {
            return loadBdfFont(
                name,
                filePath,
                createGlyphs,
                fromEncoding,
                toEncoding,
                createBlankGlyphs || false,
                resolve,
                reject
            );
        } else {
            return loadFontUsingOpentypeJS(
                name,
                filePath,
                size,
                threshold,
                createGlyphs,
                fromEncoding,
                toEncoding,
                createBlankGlyphs || false,
                resolve,
                reject
            );
        }
    });
}
