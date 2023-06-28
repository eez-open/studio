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
    return `${formatNumber(encoding, 10, 4)}/0x${formatNumber(
        encoding,
        16,
        4
    )} (${String.fromCharCode(encoding)})`;
}
