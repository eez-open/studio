import { Rect } from "eez-studio-shared/geometry";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Font } from "project-editor/features/font/font";
import type {
    EncodingRange,
    GlyphBitmap
} from "project-editor/features/font/font-extract";
import { formatNumber } from "eez-studio-shared/util";

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
    try {
        const pixelArrayAsNumberArray = new Array(pixelArray.length / 2);
        for (let i = 0; i < pixelArrayAsNumberArray.length; i++) {
            pixelArrayAsNumberArray[i] = parseInt(
                pixelArray.substr(2 * i, 2),
                16
            );
        }
        return pixelArrayAsNumberArray;
    } catch (e) {
        return [];
    }
}

export function getPixel(
    glyphBitmap: IGlyphBitmap | undefined,
    x: number,
    y: number,
    bpp: number
): number {
    if (glyphBitmap && x < glyphBitmap.width && y < glyphBitmap.height) {
        if (bpp === 8) {
            const index = y * glyphBitmap.width + x;
            if (index >= glyphBitmap.pixelArray.length) return 0;
            return glyphBitmap.pixelArray[index];
        } else if (bpp === 4) {
            const bytesPerLine = Math.floor(
                (glyphBitmap.width * 4 + 7) / 8
            );
            const byteIndex = y * bytesPerLine + Math.floor(x / 2);
            if (byteIndex >= glyphBitmap.pixelArray.length) return 0;
            const shift = (1 - (x % 2)) * 4;
            return (glyphBitmap.pixelArray[byteIndex] >> shift) & 0x0f;
        } else if (bpp === 2) {
            const bytesPerLine = Math.floor(
                (glyphBitmap.width * 2 + 7) / 8
            );
            const byteIndex = y * bytesPerLine + Math.floor(x / 4);
            if (byteIndex >= glyphBitmap.pixelArray.length) return 0;
            const shift = (3 - (x % 4)) * 2;
            return (glyphBitmap.pixelArray[byteIndex] >> shift) & 0x03;
        } else {
            const byteIndex = getPixelByteIndex(glyphBitmap, x, y);
            if (byteIndex >= glyphBitmap.pixelArray.length) return 0;
            return glyphBitmap.pixelArray[byteIndex] & (0x80 >> x % 8);
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
    } else if (bpp === 4) {
        const bytesPerLine = Math.floor((glyphBitmap.width * 4 + 7) / 8);
        const byteIndex = y * bytesPerLine + Math.floor(x / 2);
        if (glyphBitmap.pixelArray[byteIndex] === undefined) {
            glyphBitmap.pixelArray[byteIndex] = 0;
        }
        const shift = (1 - (x % 2)) * 4;
        const mask = 0x0f << shift;
        glyphBitmap.pixelArray[byteIndex] =
            (glyphBitmap.pixelArray[byteIndex] & ~mask) |
            ((color & 0x0f) << shift);
    } else if (bpp === 2) {
        const bytesPerLine = Math.floor((glyphBitmap.width * 2 + 7) / 8);
        const byteIndex = y * bytesPerLine + Math.floor(x / 4);
        if (glyphBitmap.pixelArray[byteIndex] === undefined) {
            glyphBitmap.pixelArray[byteIndex] = 0;
        }
        const shift = (3 - (x % 4)) * 2;
        const mask = 0x03 << shift;
        glyphBitmap.pixelArray[byteIndex] =
            (glyphBitmap.pixelArray[byteIndex] & ~mask) |
            ((color & 0x03) << shift);
    } else {
        let byteIndex = getPixelByteIndex(glyphBitmap, x, y);
        if (glyphBitmap.pixelArray[byteIndex] === undefined) {
            glyphBitmap.pixelArray[byteIndex] = 0;
        }
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

// Convert a pixel value from one bpp to a normalized 0-255 alpha value
function pixelToAlpha(value: number, bpp: number): number {
    if (bpp === 8) return value;
    if (bpp === 1) return value ? 255 : 0;
    const maxVal = (1 << bpp) - 1;
    return Math.round((value * 255) / maxVal);
}

// Convert a 0-255 alpha value to a pixel value for the target bpp
function alphaToPixel(alpha: number, bpp: number): number {
    if (bpp === 8) return alpha;
    if (bpp === 1) return alpha > 127 ? 1 : 0;
    const maxVal = (1 << bpp) - 1;
    return Math.round((alpha * maxVal) / 255);
}

export function convertGlyphBitmap(
    glyphBitmap: IGlyphBitmap,
    oldBpp: number,
    newBpp: number
): IGlyphBitmap {
    const width = glyphBitmap.width;
    const height = glyphBitmap.height;

    const result: IGlyphBitmap = {
        width,
        height,
        pixelArray: []
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const oldValue = getPixel(glyphBitmap, x, y, oldBpp);
            const alpha = pixelToAlpha(oldValue, oldBpp);
            const newValue = alphaToPixel(alpha, newBpp);
            setPixelInplace(result, x, y, newValue, newBpp);
        }
    }

    return result;
}

export function from1to8bpp(glyphBitmap: GlyphBitmap) {
    const newPixelArray = Array<number>(glyphBitmap.width * glyphBitmap.height);

    for (let y = 0; y < glyphBitmap.height; ++y) {
        for (let x = 0; x < glyphBitmap.width; ++x) {
            newPixelArray[y * glyphBitmap.width + x] = getPixel(
                glyphBitmap,
                x,
                y,
                1
            );
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

export function getEncodingRangesFromEncodingsSet(
    encodingsSet: Set<number>
): EncodingRange[] {
    const encodingsArray = [...encodingsSet.values()].sort((a, b) => a - b);

    const encodingRanges: EncodingRange[] = [];

    let i = 0;
    while (i < encodingsArray.length) {
        const from = encodingsArray[i++];

        while (
            i < encodingsArray.length &&
            encodingsArray[i] === encodingsArray[i - 1] + 1
        ) {
            i++;
        }

        const to = encodingsArray[i - 1];

        encodingRanges.push({
            from,
            to
        });
    }

    return encodingRanges;
}

export function getEncodingArrayFromEncodingRanges(
    encodingsRange: EncodingRange[]
): number[] {
    const encodingsArray = [];

    for (const encodingRange of encodingsRange) {
        for (let i = encodingRange.from; i <= encodingRange.to; i++) {
            encodingsArray.push(i);
        }
    }

    return encodingsArray;
}

export function getMissingEncodings(font: Font): EncodingRange[] {
    const project = ProjectEditor.getProject(font);
    if (!project.texts) {
        return [];
    }

    const existingEncodings = new Set<number>();
    font.glyphs.forEach(glyph => existingEncodings.add(glyph.encoding));

    const encodingsSet = new Set<number>();

    for (const textResource of project.texts.resources) {
        for (const translation of textResource.translations) {
            for (const ch of translation.text) {
                const codePoint = ch.codePointAt(0);
                if (
                    codePoint != undefined &&
                    !existingEncodings.has(codePoint)
                ) {
                    encodingsSet.add(codePoint);
                }
            }
        }
    }

    return getEncodingRangesFromEncodingsSet(encodingsSet);
}

export function isEncodingInAnyGroup(
    encoding: number,
    encodings: EncodingRange[]
) {
    for (const range of encodings) {
        if (encoding >= range.from && encoding <= range.to) {
            return true;
        }
    }
    return false;
}

export function formatEncoding(encoding: number) {
    return `${formatNumber(encoding, 10, 6)}/0x${formatNumber(
        encoding,
        16,
        4
    )} (${String.fromCharCode(encoding)})`;
}
