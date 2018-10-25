export interface FontProperties {
    name: string;
    source?: FontSourceProperties;
    bpp: number;
    height: number;
    ascent: number;
    descent: number;
    screenOrientation?: string;
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
