import type {
    Params,
    FontProperties,
    GlyphProperties,
    IFontExtract
} from "project-editor/features/font/font-extract";

import fs from "fs";
import path from "path";
import { getName, NamingConvention } from "project-editor/build/helper";
const collectFontData = require("lv_font_conv/lib/collect_font_data");
const getFontBinData = require("lv_font_conv/lib/writers/bin");
const getFontSourceData = require("lv_font_conv/lib/writers/lvgl");

let extractBusy = false;

export class ExtractFont implements IFontExtract {
    fontProperties: FontProperties;
    allEncodings: number[];
    fontData: any;

    constructor(private params: Params) {}

    async start() {
        let source_bin = fs.readFileSync(this.params.absoluteFilePath);

        const range: number[] = [];
        this.params.encodings!.map(encodingRange =>
            range.push(encodingRange.from, encodingRange.to, encodingRange.from)
        );

        const symbols = this.params.symbols ?? "";

        const fonts = [
            {
                source_path: this.params.absoluteFilePath,
                source_bin,
                ranges: [
                    {
                        range,
                        symbols
                    }
                ]
            }
        ];

        const output = getName(
            "ui_font_",
            this.params.name || "",
            NamingConvention.UnderscoreLowerCase
        );

        const args = {
            font: fonts,
            size: this.params.size,
            bpp: this.params.bpp,
            no_compress: true,
            lcd: false,
            lcd_v: false,
            use_color_info: false,
            format: "lvgl",
            output
        };

        // wait for !extractBusy
        await new Promise<void>(resolve => {
            const interval = setInterval(() => {
                if (!extractBusy) {
                    clearInterval(interval);
                    resolve();
                }
            }, 10);
        });

        extractBusy = true;

        this.fontData = await collectFontData(args);

        // write font bin file
        const bin: Buffer = getFontBinData(args, this.fontData)[output];
        const lvglBinFilePath =
            path.dirname(this.params.absoluteFilePath) + "/" + output + ".bin";
        await fs.promises.writeFile(lvglBinFilePath, bin);

        // write font C file
        const source: Buffer = getFontSourceData(args, this.fontData)[output];
        const lvglSourceFilePath =
            path.dirname(this.params.absoluteFilePath) + "/" + output + ".c";
        await fs.promises.writeFile(lvglSourceFilePath, source);

        extractBusy = false;

        this.fontProperties = {
            name: this.params.name || "",
            renderingEngine: "LVGL",
            source: {
                filePath: this.params.relativeFilePath,
                size: this.params.size,
                threshold: this.params.threshold
            },
            bpp: this.params.bpp,
            threshold: this.params.threshold,
            height: this.fontData.ascent - this.fontData.descent,
            ascent: this.fontData.ascent,
            descent: -this.fontData.descent,
            glyphs: [],
            lvglGlyphs: {
                encodings: this.params.encodings!,
                symbols
            },
            lvglBinFilePath,
            lvglSourceFilePath
        };
    }

    getAllGlyphs = () => {
        return this.fontData.glyphs.map((glyph: any) => {
            let glyphProperties: GlyphProperties = {} as any;

            glyphProperties.encoding = glyph.code;

            glyphProperties.dx = glyph.advanceWidth;

            glyphProperties.x = glyph.bbox.x;
            glyphProperties.y = glyph.bbox.y;
            glyphProperties.width = glyph.bbox.width;
            glyphProperties.height = glyph.bbox.height;

            glyphProperties.source = {
                filePath: this.params.relativeFilePath,
                size: this.params.size,
                threshold: this.params.threshold,
                encoding: glyph.code
            } as any;

            const pixelArray: number[] = [];
            for (const row of glyph.pixels) {
                pixelArray.push(...row);
            }

            glyphProperties.glyphBitmap = {
                width: glyph.bbox.width,
                height: glyph.bbox.height,
                pixelArray
            };

            return glyphProperties;
        });
    };

    freeResources() {}
}
