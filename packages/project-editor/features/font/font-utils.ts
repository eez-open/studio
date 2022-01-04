import { Rect } from "eez-studio-shared/geometry";

export interface EditorImageHitTestResult {
    x: number;
    y: number;
    rect: Rect;
}

export interface IGlyphBitmap {
    width: number;
    height: number;
    pixelArray: number[];
}

export function serializePixelArray(pixelArrayAsNumberArray: number[]) {
    return pixelArrayAsNumberArray
        .map(pixel => pixel.toString(16).padStart(2, "0"))
        .join("");
}

export function deserializePixelArray(pixelArray: string | number[]) {
    if (typeof pixelArray != "string") {
        return pixelArray;
    }
    if (pixelArray.length == 0) {
        return [];
    }
    const pixelArrayAsNumberArray = new Array(pixelArray.length / 2);
    for (let i = 0; i < pixelArrayAsNumberArray.length; i++) {
        pixelArrayAsNumberArray[i] = parseInt(pixelArray.substr(2 * i, 2), 16);
    }
    return pixelArrayAsNumberArray;
}

export function getPixel(
    glyphBitmap: IGlyphBitmap | undefined,
    x: number,
    y: number,
    bpp: number
): number {
    if (glyphBitmap && x < glyphBitmap.width && y < glyphBitmap.height) {
        if (bpp === 8) {
            return glyphBitmap.pixelArray[y * glyphBitmap.width + x];
        } else {
            return (
                glyphBitmap.pixelArray[getPixelByteIndex(glyphBitmap, x, y)] &
                (0x80 >> x % 8)
            );
        }
    } else {
        return 0;
    }
}

function setPixelInplace(
    glyphBitmap: IGlyphBitmap,
    x: number,
    y: number,
    color: number,
    bpp: number
) {
    if (bpp === 8) {
        glyphBitmap.pixelArray[y * glyphBitmap.width + x] = color;
    } else {
        let byteIndex = getPixelByteIndex(glyphBitmap, x, y);
        if (glyphBitmap.pixelArray[byteIndex] === undefined) {
            glyphBitmap.pixelArray[byteIndex] = 0;
        }
        glyphBitmap.pixelArray[byteIndex] |= 0x80 >> x % 8;
        if (color) {
            glyphBitmap.pixelArray[byteIndex] |= 0x80 >> x % 8;
        } else {
            glyphBitmap.pixelArray[byteIndex] &= ~(0x80 >> x % 8) & 0xff;
        }
    }
}

export function setPixel(
    glyphBitmap: IGlyphBitmap,
    x: number,
    y: number,
    color: number,
    bpp: number
) {
    let result = resizeGlyphBitmap(
        glyphBitmap,
        Math.max((glyphBitmap && glyphBitmap.width) || 0, x + 1),
        Math.max((glyphBitmap && glyphBitmap.height) || 0, y + 1),
        bpp
    );
    setPixelInplace(result, x, y, color, bpp);
    return result;
}

export function resizeGlyphBitmap(
    glyphBitmap: IGlyphBitmap,
    width: number,
    height: number,
    bpp: number
) {
    let result = {
        width: width,
        height: height,
        pixelArray: []
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            setPixelInplace(
                result,
                x,
                y,
                getPixel(glyphBitmap, x, y, bpp),
                bpp
            );
        }
    }

    return result;
}

export function getPixelByteIndex(
    glyphBitmap: IGlyphBitmap,
    x: number,
    y: number
): number {
    return y * Math.floor((glyphBitmap.width + 7) / 8) + Math.floor(x / 8);
}
