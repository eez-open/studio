export type FontRenderingEngine = "freetype" | "opentype" | "LVGL";

export interface FontProperties {
    name: string;
    renderingEngine: FontRenderingEngine;
    source?: FontSourceProperties;
    embeddedFontFile?: string;
    bpp: number;
    threshold: number;
    height: number;
    ascent: number;
    descent: number;
    glyphs: GlyphProperties[];
    lvglGlyphs?: {
        encodings: EncodingRange[];
        symbols: string;
    };
    lvglBinFile?: string;
    lvglSourceFile?: string;
}

export interface FontSourceProperties {
    filePath: string;
    size?: number;
    threshold?: number;
}

export interface GlyphProperties {
    encoding: number;
    x: number;
    y: number;
    width: number;
    height: number;
    dx: number;
    glyphBitmap?: GlyphBitmap;
    source?: GlyphSourceProperties;
}

export class GlyphSourceProperties {
    filePath?: string;
    size?: number;
    encoding?: number;
}

export interface GlyphBitmap {
    width: number;
    height: number;
    pixelArray: number[];
}

export interface EncodingRange {
    from: number;
    to: number;
}

export interface Params {
    name?: string;
    absoluteFilePath: string;
    embeddedFontFile?: string;
    relativeFilePath: string;
    renderingEngine: FontRenderingEngine;
    bpp: number;
    size: number;
    threshold: number;
    createGlyphs: boolean;
    encodings?: EncodingRange[];
    symbols?: string;
    createBlankGlyphs?: boolean;
    doNotAddGlyphIfNotFound: boolean;
    getAllGlyphs?: boolean;
    lvglVersion?: string;
    lvglInclude?: string;
    opts_string?: string;
    lv_fallback?: string;
}

export interface IFontExtract {
    start(): Promise<void>;
    getAllGlyphs?(): GlyphProperties[];
    getGlyph?(encoding: number): GlyphProperties | undefined;
    freeResources(): void;
    fontProperties: FontProperties;
    allEncodings: number[];
}

export async function createFontExtract(params: Params): Promise<IFontExtract> {
    let renderingEngineModule;

    if (params.renderingEngine == "freetype") {
        renderingEngineModule = await import(
            "project-editor/features/font/font-extract/freetype"
        );
    } else if (params.renderingEngine == "opentype") {
        renderingEngineModule = await import(
            "project-editor/features/font/font-extract/opentype"
        );
    } else {
        renderingEngineModule = await import(
            "project-editor/features/font/font-extract/lvgl"
        );
    }

    return new renderingEngineModule.ExtractFont(params);
}

export async function extractFont(params: Params) {
    const extractFont = await createFontExtract(params);
    try {
        await extractFont.start();

        if (params.createGlyphs) {
            const { getEncodingArrayFromEncodingRanges } = await import(
                "project-editor/features/font/utils"
            );

            if (extractFont.getGlyph) {
                let encodings = params.encodings
                    ? getEncodingArrayFromEncodingRanges(params.encodings)
                    : extractFont.allEncodings;

                for (const encoding of encodings) {
                    const glyphProperties = extractFont.getGlyph(encoding);
                    if (glyphProperties) {
                        extractFont.fontProperties.glyphs.push(glyphProperties);
                    }
                }
            } else if (extractFont.getAllGlyphs && params.getAllGlyphs) {
                extractFont.fontProperties.glyphs = extractFont.getAllGlyphs();
            }
        }

        return extractFont.fontProperties;
    } finally {
        extractFont.freeResources();
    }
}
