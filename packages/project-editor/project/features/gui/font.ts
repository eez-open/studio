import { _minBy, _maxBy } from "eez-studio-shared/algorithm";

import { FontProperties } from "project-editor/project/features/gui/fontMetaData";

////////////////////////////////////////////////////////////////////////////////

export function getData(font: FontProperties) {
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

    const min = _minBy(font.glyphs, g => g.encoding);
    const startEncoding = (min && min.encoding) || 32;
    const max = _maxBy(font.glyphs, g => g.encoding);
    const endEncoding = (max && max.encoding) || 127;

    const data: number[] = [];

    function add(...values: number[]) {
        for (const value of values) {
            if (value < 0) {
                data.push(256 + value);
            } else {
                data.push(value);
            }
        }
    }

    if (startEncoding <= endEncoding) {
        add(font.ascent);
        add(font.descent);
        add(startEncoding);
        add(endEncoding);

        for (let i = startEncoding; i <= endEncoding; i++) {
            if (font.bpp === 8) {
                add(0);
                add(0);
                add(0);
                add(0);
            } else {
                add(0);
                add(0);
            }
        }

        for (let i = startEncoding; i <= endEncoding; i++) {
            const offsetIndex = 4 + (i - startEncoding) * (font.bpp === 8 ? 4 : 2);
            const offset = data.length;
            if (font.bpp === 8) {
                // uint32 LE
                data[offsetIndex + 0] = offset & 0xff;
                data[offsetIndex + 1] = (offset >> 8) & 0xff;
                data[offsetIndex + 2] = (offset >> 16) & 0xff;
                data[offsetIndex + 3] = offset >> 24;
            } else {
                // uint16 BE
                data[offsetIndex + 0] = offset >> 8;
                data[offsetIndex + 1] = offset & 0xff;
            }

            const glyph = font.glyphs[i - 32];

            if (glyph && glyph.pixelArray) {
                add(glyph.dx);
                add(glyph.width);
                add(glyph.height);
                add(glyph.x);
                add(glyph.y);

                add(...glyph.pixelArray);
            } else {
                add(255);
            }
        }
    }

    return data;
}
