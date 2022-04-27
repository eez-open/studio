import { _range } from "eez-studio-shared/algorithm";
import { getAllGlyphEncodings } from "project-editor/features/font/font-extract/opentype";
import type {
    Params,
    FontProperties,
    GlyphProperties
} from "project-editor/features/font/font-extract";

const path = require("path");

const RESOLUTION = 100;
const HINTING = 1;
const GAMMA = 1.0;

////////////////////////////////////////////////////////////////////////////////

const wasmModule: any = {};

let wasmModuleReady = false;
wasmModule["onRuntimeInitialized"] = () => {
    wasmModuleReady = true;
};

(window as any).FreeTypeWasmModule = wasmModule;
require("../../libs/freetype-tools-wasm/freetype-tools");

////////////////////////////////////////////////////////////////////////////////

class FreeTypeFile {
    private create_font_extract_state: any;
    private extract_glyph: any;
    private free_font_extract_state: any;

    private fontExtractState: any;

    private canvasWidth: number;
    private canvasHeight: number;
    private glyphPosition: {
        x: number;
        y: number;
    };
    private glyphPixelsArrayLength: number;
    private glyphPixelsDataPtr: any;
    private glyphPixelsArray: Uint8Array;

    private glyphInfoLength: number;
    private glyphInfoPtr: any;

    private font: FontProperties;

    // size is in pt's
    constructor(
        public name: string | undefined,
        public absoluteFilePath: string,
        public relativeFilePath: string,
        public bpp: number,
        public size: number,
        public threshold: number,
        public resolution: number,
        public hinting: number,
        public gamma: number
    ) {}

    load(): boolean {
        // functions from fontExtract that we use
        this.create_font_extract_state = wasmModule.cwrap(
            "create_font_extract_state",
            "number",
            ["string", "number", "number", "number"]
        );

        this.extract_glyph = wasmModule.cwrap("extract_glyph", "number", [
            "number",
            "number",
            "number",
            "number",
            "number",
            "number",
            "number",
            "number"
        ]);

        this.free_font_extract_state = wasmModule.cwrap(
            "free_font_extract_state",
            "number",
            ["number"]
        );

        this.fontExtractState = this.create_font_extract_state(
            this.absoluteFilePath,
            this.resolution,
            this.size,
            this.hinting,
            this.gamma
        );

        if (!this.fontExtractState) {
            return false;
        }

        this.canvasWidth = this.size * 10;
        this.canvasHeight = this.size * 10;
        this.glyphPosition = {
            x: 3 * this.size,
            y: 3 * this.size
        };

        this.glyphPixelsArrayLength = this.canvasWidth * this.canvasHeight * 4;
        this.glyphPixelsDataPtr = wasmModule._malloc(
            this.glyphPixelsArrayLength
        );
        this.glyphPixelsArray = new Uint8Array(
            wasmModule.HEAPU8.buffer,
            this.glyphPixelsDataPtr,
            this.glyphPixelsArrayLength
        );

        this.glyphInfoLength =
            4 + //int x1;
            4 + //int y1;
            4 + //int x2;
            4 + //int y2;
            8; //double advanceX;
        this.glyphInfoPtr = wasmModule._malloc(this.glyphInfoLength);

        const fontExtractStateDataView = new DataView(
            wasmModule.HEAPU8.buffer,
            this.fontExtractState,
            16
        );
        const ascender = fontExtractStateDataView.getFloat64(0, true);
        const descender = fontExtractStateDataView.getFloat64(8, true);

        // 1 pt = 1.333(3) px if resolution is 72
        const scale = ((4 / 3) * this.resolution) / 72;
        const ascent = Math.round(ascender * scale);
        const descent = Math.round(-descender * scale);

        const height = ascent + descent;

        this.font = {
            name: this.name || "",
            renderingEngine: "freetype",
            source: {
                filePath: this.relativeFilePath,
                size: this.size,
                threshold: this.threshold
            },
            bpp: this.bpp,
            threshold: this.threshold,
            height,
            ascent,
            descent,
            glyphs: []
        };

        return true;
    }

    freeResources() {
        if (this.glyphPixelsDataPtr) {
            wasmModule._free(this.glyphPixelsDataPtr);
        }

        if (this.glyphInfoPtr) {
            wasmModule._free(this.glyphInfoPtr);
        }

        if (this.fontExtractState) {
            this.free_font_extract_state(this.fontExtractState);
        }
    }

    addGlyph(encoding: number, createBlankGlyphs: boolean) {
        let glyphProperties: GlyphProperties = <any>{};

        glyphProperties.encoding = encoding;

        glyphProperties.dx = 0;

        glyphProperties.x = 0;
        glyphProperties.y = 0;
        glyphProperties.width = 0;
        glyphProperties.height = 0;

        glyphProperties.glyphBitmap = {
            width: 0,
            height: 0,
            pixelArray: []
        };

        if (!createBlankGlyphs) {
            for (let i = 0; i < this.glyphPixelsArrayLength; ++i) {
                this.glyphPixelsArray[i] = 0;
            }

            const result = this.extract_glyph(
                this.fontExtractState,
                encoding,
                this.glyphPosition.x,
                this.glyphPosition.y,
                this.canvasWidth,
                this.canvasHeight,
                this.glyphPixelsDataPtr,
                this.glyphInfoPtr
            );

            if (result) {
                const glyphInfoDataView = new DataView(
                    wasmModule.HEAPU8.buffer,
                    this.glyphInfoPtr,
                    this.glyphInfoLength
                );

                const glyphInfoX1 = glyphInfoDataView.getInt32(0, true);
                const glyphInfoY1 = glyphInfoDataView.getInt32(4, true);
                const glyphInfoX2 = glyphInfoDataView.getInt32(8, true);
                const glyphInfoY2 = glyphInfoDataView.getInt32(12, true);
                const glyphInfoAdvanceX = glyphInfoDataView.getFloat64(
                    16,
                    true
                );

                glyphProperties.dx = Math.ceil(glyphInfoAdvanceX);

                const glyphWidth = glyphInfoX2 - glyphInfoX1;
                const glyphHeight = glyphInfoY2 - glyphInfoY1;

                const hasPixels =
                    glyphWidth > 0 &&
                    glyphWidth < this.canvasWidth &&
                    glyphHeight > 0 &&
                    glyphHeight < this.canvasHeight;

                // get pixels
                if (hasPixels) {
                    glyphProperties.x = glyphInfoX1;
                    glyphProperties.y = -glyphInfoY2;
                    glyphProperties.width = glyphWidth;
                    glyphProperties.height = glyphHeight;

                    if (this.font.ascent < -glyphInfoY1) {
                        this.font.ascent = -glyphInfoY1;
                    }

                    if (this.font.descent < glyphInfoY2) {
                        this.font.descent = glyphInfoY2;
                    }

                    let pixelArray: Array<number>;

                    if (this.bpp === 8) {
                        pixelArray = new Array<number>(
                            glyphWidth * glyphHeight
                        );
                        let i = 0;
                        for (
                            let y = this.glyphPosition.y + glyphInfoY1;
                            y < this.glyphPosition.y + glyphInfoY2;
                            y++
                        ) {
                            for (
                                let x = this.glyphPosition.x + glyphInfoX1;
                                x < this.glyphPosition.x + glyphInfoX2;
                                x++
                            ) {
                                pixelArray[i++] =
                                    this.glyphPixelsArray[
                                        (y * this.canvasWidth + x) * 4 + 3
                                    ];
                            }
                        }
                    } else {
                        pixelArray = [];

                        let widthInBytes = Math.floor(
                            (glyphProperties.width + 7) / 8
                        );

                        for (
                            let y = this.glyphPosition.y + glyphInfoY1;
                            y < this.glyphPosition.y + glyphInfoY2;
                            y++
                        ) {
                            for (
                                let x = this.glyphPosition.x + glyphInfoX1,
                                    iByte = 0;
                                iByte < widthInBytes &&
                                x < this.glyphPosition.x + glyphInfoX2;
                                iByte++
                            ) {
                                let byteData = 0;

                                for (
                                    let iBit = 0;
                                    iBit < 8 &&
                                    x < this.glyphPosition.x + glyphInfoX2;
                                    iBit++, x++
                                ) {
                                    if (
                                        this.glyphPixelsArray[
                                            (y * this.canvasWidth + x) * 4 + 3
                                        ] > this.threshold
                                    ) {
                                        byteData |= 0x80 >> iBit;
                                    }
                                }

                                pixelArray.push(byteData);
                            }
                        }
                    }

                    glyphProperties.glyphBitmap = {
                        width: glyphWidth,
                        height: glyphHeight,
                        pixelArray: pixelArray
                    };
                }
            }
        }

        this.font.height = this.font.ascent + this.font.descent;

        glyphProperties.source = <any>{
            filePath: this.relativeFilePath,
            size: this.size,
            threshold: this.threshold,
            encoding: encoding
        };

        this.font.glyphs.push(glyphProperties);

        return glyphProperties;
    }

    getFontProperties() {
        return this.font;
    }
}

////////////////////////////////////////////////////////////////////////////////

export async function extractFont(params: Params) {
    // wait until fontExtract module is ready
    while (!wasmModuleReady) {
        await new Promise(resolve => setTimeout(resolve));
    }

    const freeTypeFile = new FreeTypeFile(
        params.name,
        params.absoluteFilePath,
        params.relativeFilePath,
        params.bpp,
        params.size,
        params.threshold,
        RESOLUTION,
        HINTING,
        GAMMA
    );

    try {
        if (!freeTypeFile.load()) {
            throw "failed to load font file";
        }

        if (params.createGlyphs) {
            let encodings: number[];

            if (params.encodings) {
                encodings = [];
                for (const range of params.encodings) {
                    for (
                        let encoding = range.from;
                        encoding <= range.to;
                        encoding++
                    ) {
                        encodings.push(encoding);
                    }
                }
            } else {
                encodings = await getAllGlyphEncodings(params.absoluteFilePath);
            }

            for (let i = 0; i < encodings.length; i++) {
                // give control to JavaScript engine, we don't want to block the main thread
                await new Promise(resolve => setTimeout(resolve));
                freeTypeFile.addGlyph(
                    encodings[i],
                    params.createBlankGlyphs || false
                );
            }
        }

        return freeTypeFile.getFontProperties();
    } finally {
        freeTypeFile.freeResources();
    }
}

export async function rebuildFont(
    font: FontProperties,
    projectFilePath: string
) {
    // wait until fontExtract module is ready
    while (!wasmModuleReady) {
        await new Promise(resolve => setTimeout(resolve));
    }

    const freeTypeFileMap = new Map<string, FreeTypeFile>();

    try {
        const glyphs = [];
        for (let i = 0; i < font.glyphs.length; ++i) {
            const glyph = font.glyphs[i];

            if (
                !glyph.glyphBitmap ||
                glyph.glyphBitmap.pixelArray.length == 0
            ) {
                glyphs.push(glyph);
                continue;
            }

            if (!glyph.source || !glyph.source.filePath || !glyph.source.size) {
                glyphs.push(glyph);
                continue;
            }

            // give control to JavaScript engine, we don't want to block main thread
            await new Promise(resolve => setTimeout(resolve));

            let freeTypeFile = freeTypeFileMap.get(
                glyph.source.filePath + ":" + glyph.source.size
            );
            if (!freeTypeFile) {
                freeTypeFile = new FreeTypeFile(
                    font.name,
                    path.resolve(
                        path.dirname(projectFilePath),
                        glyph.source.filePath.replace(/(\\|\/)/g, path.sep)
                    ),
                    glyph.source.filePath,
                    font.bpp,
                    glyph.source.size,
                    (font.source && font.source.threshold) || 128,
                    RESOLUTION,
                    HINTING,
                    GAMMA
                );

                freeTypeFile.load();

                freeTypeFileMap.set(
                    glyph.source.filePath + ":" + glyph.source.size,
                    freeTypeFile
                );
            }

            const newGlyph = freeTypeFile.addGlyph(
                glyph.source.encoding || glyph.encoding,
                false
            );
            newGlyph.encoding = glyph.encoding;
            glyphs.push(newGlyph);
        }

        return Object.assign({}, font, {
            glyphs
        });
    } finally {
        for (const freeTypeFile of freeTypeFileMap.values()) {
            freeTypeFile.freeResources();
        }
    }
}
