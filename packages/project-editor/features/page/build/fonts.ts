import { Font } from "project-editor/features/font/font";
import { DataBuffer } from "project-editor/features/page/build/pack";
import { Assets } from "project-editor/features/page/build/assets";
import * as projectBuild from "project-editor/project/build";

export function getFontData(font: Font, dataBuffer: DataBuffer) {
    /*
    Font header:

    offset
    0           ascent              uint8
    1           descent             uint8
    2           encoding start      uint8
    3           encoding end        uint8
    4           1st encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    6           2nd encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    ...
    */

    /*
    Glyph header:

    offset
    0             DWIDTH                    int8
    1             BBX width                 uint8
    2             BBX height                uint8
    3             BBX xoffset               int8
    4             BBX yoffset               int8

    Note: byte 0 == 255 indicates empty glyph
    */

    const min = Math.min(...font.glyphs.map(g => g.encoding));
    const startEncoding = Number.isFinite(min) ? min : 32;
    const max = Math.max(...font.glyphs.map(g => g.encoding));
    const endEncoding = Number.isFinite(max) ? max : 127;

    const offsetAtStart = dataBuffer.offset;

    if (startEncoding <= endEncoding) {
        dataBuffer.packInt8(font.ascent);
        dataBuffer.packInt8(font.descent);
        dataBuffer.packInt8(startEncoding);
        dataBuffer.packInt8(endEncoding);

        for (let i = startEncoding; i <= endEncoding; i++) {
            if (font.bpp === 8) {
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
            } else {
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
            }
        }

        for (let i = startEncoding; i <= endEncoding; i++) {
            const offsetIndex =
                4 + (i - startEncoding) * (font.bpp === 8 ? 4 : 2);
            const offset = dataBuffer.offset - offsetAtStart;
            if (font.bpp === 8) {
                // uint32 LE
                dataBuffer.packUInt32AtOffset(
                    offsetAtStart + offsetIndex,
                    offset
                );
            } else {
                // uint16 BE
                dataBuffer.packUInt8AtOffset(
                    offsetAtStart + offsetIndex + 0,
                    offset >> 8
                );
                dataBuffer.packUInt8AtOffset(
                    offsetAtStart + offsetIndex + 1,
                    offset & 0xff
                );
            }

            let glyph = font.glyphs.find(glyph => glyph.encoding == i);

            if (glyph && glyph.glyphBitmap && glyph.glyphBitmap.pixelArray) {
                dataBuffer.packInt8(glyph.dx);
                dataBuffer.packInt8(glyph.width);
                dataBuffer.packInt8(glyph.height);
                dataBuffer.packInt8(glyph.x);
                dataBuffer.packInt8(glyph.y);

                dataBuffer.packArray(glyph.glyphBitmap.pixelArray);
            } else {
                dataBuffer.packInt8(255);
            }
        }
    }
}

export function buildGuiFontsEnum(assets: Assets) {
    let fonts = assets.fonts.map(
        (font, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "FONT_ID_",
                font,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    // TODO what if font name is none!?
    fonts.unshift(`${projectBuild.TAB}FONT_ID_NONE = 0`);

    return `enum FontsEnum {\n${fonts.join(",\n")}\n};`;
}

export async function buildGuiFontsData(
    assets: Assets,
    dataBuffer: DataBuffer
) {
    if (!assets.DocumentStore.masterProject) {
        await dataBuffer.packRegions(assets.fonts.length, async (i: number) => {
            getFontData(assets.fonts[i], dataBuffer);
        });
    }
}
