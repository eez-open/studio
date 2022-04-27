import {
    from1to8bpp,
    isEncodingInAnyGroup
} from "project-editor/features/font/utils";
import type {
    Params,
    FontProperties,
    GlyphProperties
} from "project-editor/features/font/font-extract";

const fs = require("fs");

export function extractFont(params: Params) {
    return new Promise<FontProperties>((resolve, reject) => {
        let cacheFilePath =
            params.absoluteFilePath +
            "-" +
            params.bpp +
            ".eez-studio-project-editor-cache";

        fs.readFile(cacheFilePath, "utf8", (err: any, data: any) => {
            if (!err) {
                let font = JSON.parse(data);
                font.name = name;
                resolve(font);
                return;
            }

            fs.readFile(
                data.absoluteFilePath,
                "utf8",
                (err: any, data: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        let state = "FONT";
                        let font: FontProperties = <any>{
                            name,
                            renderingEngine: "bdf",
                            source: {
                                filePath: data.relativeFilePath
                            },
                            bpp: params.bpp,
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
                                    if (!params.createBlankGlyphs) {
                                        glyph.width = parseInt(parts[1]);
                                        glyph.height = parseInt(parts[2]);
                                        glyph.x = parseInt(parts[3]);
                                        glyph.y = parseInt(parts[4]);
                                    }
                                } else if (name == "DWIDTH") {
                                    if (!params.createBlankGlyphs) {
                                        glyph.dx = parseInt(parts[1]);
                                    }
                                } else if (name == "BITMAP") {
                                    pixelArray = [];
                                    state = "BITMAP";
                                }
                            } else if (state == "BITMAP") {
                                if (name == "ENDCHAR") {
                                    if (!params.createBlankGlyphs) {
                                        let glyphBitmap = {
                                            width: glyph.width,
                                            height: glyph.height,
                                            pixelArray
                                        };

                                        if (params.bpp === 8) {
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
                                        filePath: params.relativeFilePath,
                                        encoding: glyph.encoding
                                    };
                                    if (
                                        params.createGlyphs &&
                                        (params.encodings == undefined ||
                                            isEncodingInAnyGroup(
                                                glyph.encoding,
                                                params.encodings
                                            ))
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

                        if (data.fromEncoding && data.toEncoding) {
                            font.glyphs = font.glyphs.sort((a, b) => {
                                if (a.encoding < b.encoding) {
                                    return -1;
                                } else if (a.encoding > b.encoding) {
                                    return 1;
                                }
                                return 0;
                            });

                            for (
                                let i = data.fromEncoding, j = 0;
                                i <= data.toEncoding;
                                i++, j++
                            ) {
                                if (
                                    j >= font.glyphs.length ||
                                    font.glyphs[j].encoding != i
                                ) {
                                    let glyph: GlyphProperties = <any>{};

                                    glyph.encoding = i;
                                    glyph.source = <any>{
                                        filePath: data.relativeFilePath,
                                        encoding: glyph.encoding
                                    };

                                    font.glyphs.splice(j, 0, glyph);
                                }
                            }
                        }

                        fs.writeFile(
                            cacheFilePath,
                            JSON.stringify(font),
                            "utf8",
                            (err: any) => {
                                if (err) {
                                    console.error(err);
                                }
                            }
                        );

                        resolve(font);
                    }
                }
            );
        });
    });
}
