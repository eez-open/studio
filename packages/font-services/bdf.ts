import { FontProperties, GlyphProperties } from "font-services/interfaces";
import { from1to8bpp } from "font-services/util";

const fs = require("fs");

export function extractBdfFont(
    name: string | undefined,
    absoluteFilePath: string,
    relativeFilePath: string,
    bpp: number,
    createGlyphs: boolean,
    fromEncoding: number | undefined,
    toEncoding: number | undefined,
    createBlankGlyphs: boolean
) {
    return new Promise<FontProperties>((resolve, reject) => {
        let cacheFilePath = absoluteFilePath + "-" + bpp + ".eez-studio-project-editor-cache";

        fs.readFile(cacheFilePath, "utf8", (err: any, data: any) => {
            if (!err) {
                let font = JSON.parse(data);
                font.name = name;
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
                            filePath: relativeFilePath
                        },
                        bpp,
                        ascent: 0,
                        descent: 0,
                        height: 0,
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
                                    let glyphBitmap = {
                                        width: glyph.width,
                                        height: glyph.height,
                                        pixelArray
                                    };

                                    if (bpp === 8) {
                                        glyph.glyphBitmap = from1to8bpp({
                                            width: glyph.width,
                                            height: glyph.height,
                                            pixelArray
                                        });
                                    } else {
                                        glyph.glyphBitmap = glyphBitmap;
                                    }
                                }
                                glyph.source = <any>{
                                    filePath: relativeFilePath,
                                    encoding: glyph.encoding
                                };
                                if (
                                    createGlyphs &&
                                    (fromEncoding === undefined ||
                                        glyph.encoding >= fromEncoding) &&
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

                        for (let i = fromEncoding, j = 0; i <= toEncoding; i++, j++) {
                            if (j >= font.glyphs.length || font.glyphs[j].encoding != i) {
                                let glyph: GlyphProperties = <any>{};

                                glyph.encoding = i;
                                glyph.source = <any>{
                                    filePath: relativeFilePath,
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
    });
}
