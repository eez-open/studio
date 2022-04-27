import path from "path";

import type * as BdfModule from "project-editor/features/font/font-extract/bdf";
import type * as FreeTypeModule from "project-editor/features/font/font-extract/freetype";
import type * as OpenTypeModule from "project-editor/features/font/font-extract/opentype";

export type FontRenderingEngine = "bdf" | "freetype" | "opentype";

export interface FontProperties {
    name: string;
    renderingEngine: FontRenderingEngine;
    source?: FontSourceProperties;
    bpp: number;
    threshold: number;
    height: number;
    ascent: number;
    descent: number;
    glyphs: GlyphProperties[];
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
    relativeFilePath: string;
    renderingEngine: FontRenderingEngine;
    bpp: number;
    size: number;
    threshold: number;
    createGlyphs: boolean;
    encodings?: EncodingRange[];
    createBlankGlyphs?: boolean;
}

export function extractFont(data: Params) {
    if (path.extname(data.relativeFilePath) == ".bdf") {
        const { extractFont } =
            require("project-editor/features/font/font-extract/bdf") as typeof BdfModule;
        return extractFont(data);
    } else if (data.renderingEngine == "freetype") {
        const { extractFont } =
            require("project-editor/features/font/font-extract/freetype") as typeof FreeTypeModule;
        return extractFont(data);
    } else {
        const { extractFont } =
            require("project-editor/features/font/font-extract/opentype") as typeof OpenTypeModule;
        return extractFont(data);
    }
}
