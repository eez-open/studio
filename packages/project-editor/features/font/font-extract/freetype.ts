import type {
    Params,
    FontProperties,
    GlyphProperties,
    IFontExtract
} from "project-editor/features/font/font-extract";

const RESOLUTION = 100;
const HINTING = 1;
const GAMMA = 1.0;

let wasmModule: any;
let wasmModuleReady = false;

export class ExtractFont implements IFontExtract {
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

    allEncodings: number[];

    fontProperties: FontProperties;

    // size is in pt's
    constructor(private params: Params) {}

    async start() {
        if (!wasmModule) {
            wasmModule = {};

            wasmModule["onRuntimeInitialized"] = () => {
                wasmModuleReady = true;
            };

            (window as any).FreeTypeWasmModule = wasmModule;
            require("../../../../../libs/freetype-tools-wasm/freetype-tools");
        }

        // wait until fontExtract module is ready
        while (!wasmModuleReady) {
            await new Promise(resolve => setTimeout(resolve));
        }

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
            this.params.absoluteFilePath,
            RESOLUTION,
            this.params.size,
            HINTING,
            GAMMA
        );

        if (!this.fontExtractState) {
            throw "Font is not supported!";
        }

        this.canvasWidth = this.params.size * 10;
        this.canvasHeight = this.params.size * 10;
        this.glyphPosition = {
            x: 3 * this.params.size,
            y: 3 * this.params.size
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
        const scale = ((4 / 3) * RESOLUTION) / 72;
        const ascent = Math.round(ascender * scale);
        const descent = Math.round(-descender * scale);

        const height = ascent + descent;

        this.fontProperties = {
            name: this.params.name || "",
            renderingEngine: "freetype",
            source: {
                filePath: this.params.relativeFilePath,
                size: this.params.size,
                threshold: this.params.threshold
            },
            bpp: this.params.bpp,
            threshold: this.params.threshold,
            height,
            ascent,
            descent,
            glyphs: []
        };

        const { getAllGlyphEncodings } = await import(
            "project-editor/features/font/font-extract/opentype"
        );

        this.allEncodings = await getAllGlyphEncodings(
            this.params.absoluteFilePath
        );
    }

    getGlyph(encoding: number) {
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

        if (!this.params.createBlankGlyphs) {
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

                    if (this.fontProperties.ascent < -glyphInfoY1) {
                        this.fontProperties.ascent = -glyphInfoY1;
                    }

                    if (this.fontProperties.descent < glyphInfoY2) {
                        this.fontProperties.descent = glyphInfoY2;
                    }

                    let pixelArray: Array<number>;

                    if (this.params.bpp === 8) {
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
                                        ] > this.params.threshold
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
            } else {
                if (this.params.doNotAddGlyphIfNotFound) {
                    return undefined;
                }
            }
        }

        this.fontProperties.height =
            this.fontProperties.ascent + this.fontProperties.descent;

        glyphProperties.source = <any>{
            filePath: this.params.relativeFilePath,
            size: this.params.size,
            threshold: this.params.threshold,
            encoding: encoding
        };

        return glyphProperties;
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
}
