import { _minBy, _maxBy } from "shared/algorithm";

import { FontProperties } from "project-editor/project/features/gui/fontMetaData";

////////////////////////////////////////////////////////////////////////////////

export function getData(font: FontProperties) {
    /*
    Font header:

    offset
    0           ascent              unsigned
    1           descent             unsigned
    2           encoding start      unsigned
    3           encoding end        unsigned
    4           1st encoding offset unsigned word
    6           2nd encoding offset unsigned word
    ...
    */

    /*
    Glyph header:

    offset
    0             DWIDTH                    signed
    1             BBX width                 unsigned
    2             BBX height                unsigned
    3             BBX xoffset               signed
    4             BBX yoffset               signed

    Note: byte 0 == 255 indicates empty glyph
    */

    let min = _minBy(font.glyphs, g => g.encoding);
    let startEncoding = (min && min.encoding) || 32;
    let max = _maxBy(font.glyphs, g => g.encoding);
    let endEncoding = (max && max.encoding) || 127;

    let data: number[] = [];

    function add(...values: number[]) {
        for (let i = 0; i < values.length; i++) {
            if (values[i] < 0) {
                data.push(256 + values[i]);
            } else {
                data.push(values[i]);
            }
        }
    }

    if (startEncoding <= endEncoding) {
        add(font.ascent);
        add(font.descent);
        add(startEncoding);
        add(endEncoding);

        for (let i = startEncoding; i <= endEncoding; i++) {
            add(0);
            add(0);
        }

        for (let i = startEncoding; i <= endEncoding; i++) {
            let offsetIndex = 4 + (i - startEncoding) * 2;
            let offset = data.length;
            data[offsetIndex] = offset >> 8;
            data[offsetIndex + 1] = offset & 0xff;

            let glyph = font.glyphs[i - 32];

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
