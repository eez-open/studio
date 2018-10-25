import { GlyphBitmap } from "font-services/interfaces";

export function getPixelByteIndex(glyphBitmap: GlyphBitmap, x: number, y: number): number {
    return y * Math.floor((glyphBitmap.width + 7) / 8) + Math.floor(x / 8);
}

export function getPixel(glyphBitmap: GlyphBitmap, x: number, y: number, bpp: number): number {
    if (glyphBitmap && x < glyphBitmap.width && y < glyphBitmap.height) {
        if (bpp === 8) {
            return glyphBitmap.pixelArray[y * glyphBitmap.width + x];
        } else {
            return glyphBitmap.pixelArray[getPixelByteIndex(glyphBitmap, x, y)] & (0x80 >> x % 8);
        }
    } else {
        return 0;
    }
}

export function from1to8bpp(glyphBitmap: GlyphBitmap) {
    const newPixelArray = Array<number>(glyphBitmap.width * glyphBitmap.height);

    for (let y = 0; y < glyphBitmap.height; ++y) {
        for (let x = 0; x < glyphBitmap.width; ++x) {
            newPixelArray[y * glyphBitmap.width + x] = getPixel(glyphBitmap, x, y, 1);
        }
    }

    return {
        width: glyphBitmap.width,
        height: glyphBitmap.height,
        pixelArray: newPixelArray
    };
}

export function toArrayBuffer(buffer: any) {
    let ab = new ArrayBuffer(buffer.length);
    let view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; i++) {
        view[i] = buffer[i];
    }
    return ab;
}
