import { Font } from "project-editor/features/font/font";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import * as projectBuild from "project-editor/project/build";

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

function buildFontData(font: Font, dataBuffer: DataBuffer) {
    /*
    Font:

    offset
    ------
    0           ascent              uint8
    1           descent             uint8
    2           encoding start      uint8
    3           encoding end        uint8
    4           1st encoding offset uint32 LE
    8           2nd encoding offset uint32 LE
    12          ...
    */

    /*
    Glyph:

    offset
    ------
    0             DWIDTH                    int8
    1             BBX width                 uint8
    2             BBX height                uint8
    3             BBX xoffset               int8
    4             BBX yoffset               int8
    5             reserved                  uint8
    6             reserved                  uint8
    7             reserved                  uint8
    8             pixels                    uint8[]

    Note: byte 0 == 255 indicates empty glyph
    */

    const min = Math.min(...font.glyphs.map(g => g.encoding));
    const startEncoding = Number.isFinite(min) ? min : 32;
    const max = Math.max(...font.glyphs.map(g => g.encoding));
    const endEncoding = Number.isFinite(max) ? max : 127;

    dataBuffer.writeUint8(font.ascent);
    dataBuffer.writeUint8(font.descent);
    dataBuffer.writeUint8(startEncoding);
    dataBuffer.writeUint8(endEncoding);

    if (startEncoding < 0 || endEncoding > 255 || startEncoding > endEncoding) {
        throw "Invalid font";
    }

    for (let i = startEncoding; i <= endEncoding; i++) {
        dataBuffer.writeObjectOffset(() => {
            let glyph = font.glyphs.find(glyph => glyph.encoding == i);

            if (glyph && glyph.glyphBitmap && glyph.glyphBitmap.pixelArray) {
                dataBuffer.writeInt8(glyph.dx);
                dataBuffer.writeUint8(glyph.width);
                dataBuffer.writeUint8(glyph.height);
                dataBuffer.writeInt8(glyph.x);
                dataBuffer.writeInt8(glyph.y);
                dataBuffer.writeUint8(0); // reserved
                dataBuffer.writeUint8(0); // reserved
                dataBuffer.writeUint8(0); // reserved

                dataBuffer.writeUint8Array(glyph.glyphBitmap.pixelArray);
            } else {
                dataBuffer.writeInt8(-128); // empty glyph
            }
        });
    }
}

export function buildGuiFontsData(assets: Assets, dataBuffer: DataBuffer) {
    dataBuffer.writeArray(assets.fonts, font =>
        buildFontData(font, dataBuffer)
    );
}
