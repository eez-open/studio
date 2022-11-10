import type { Font } from "project-editor/features/font/font";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";

export function buildGuiFontsEnum(assets: Assets) {
    let fonts = assets.fonts.map(
        (font, i) =>
            `${TAB}${getName(
                "FONT_ID_",
                font,
                NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    // TODO what if font name is none!?
    fonts.unshift(`${TAB}FONT_ID_NONE = 0`);

    return `enum FontsEnum {\n${fonts.join(",\n")}\n};`;
}

function buildFontData(font: Font, dataBuffer: DataBuffer) {
    const glyphs = font.glyphs.slice().sort((a, b) => a.encoding - b.encoding);

    const groups: {
        encoding: number;
        glyphIndex: number;
        length: number;
    }[] = [];

    let i = 0;
    while (i < glyphs.length) {
        const start = i++;

        while (
            i < glyphs.length &&
            glyphs[i].encoding === glyphs[i - 1].encoding + 1
        ) {
            i++;
        }

        groups.push({
            encoding: glyphs[start].encoding,
            glyphIndex: start,
            length: i - start
        });
    }

    let startEncoding;
    let endEncoding;
    if (groups.length > 0) {
        startEncoding = groups[0].encoding;
        endEncoding = groups[0].encoding + groups[0].length - 1;
    } else {
        startEncoding = 0;
        endEncoding = 0;
    }

    dataBuffer.writeUint8(font.ascent);
    dataBuffer.writeUint8(font.descent);
    dataBuffer.writeUint8(0); // reserved1
    dataBuffer.writeUint8(0); // reserved2
    dataBuffer.writeUint32(startEncoding);
    dataBuffer.writeUint32(endEncoding);

    dataBuffer.writeArray(groups, group => {
        dataBuffer.writeUint32(group.encoding);
        dataBuffer.writeUint32(group.glyphIndex);
        dataBuffer.writeUint32(group.length);
    });

    dataBuffer.writeArray(glyphs, glyph => {
        if (glyph && glyph.pixelArray) {
            dataBuffer.writeInt8(glyph.dx);
            dataBuffer.writeUint8(glyph.width);
            dataBuffer.writeUint8(glyph.height);
            dataBuffer.writeInt8(glyph.x);
            dataBuffer.writeInt8(glyph.y);
            dataBuffer.writeUint8(0); // reserved
            dataBuffer.writeUint8(0); // reserved
            dataBuffer.writeUint8(0); // reserved

            dataBuffer.writeUint8Array(glyph.pixelArray);
        } else {
            dataBuffer.writeInt8(-128); // empty glyph
        }
    });
}

export function buildGuiFontsData(assets: Assets, dataBuffer: DataBuffer) {
    const fonts = assets.fonts.filter(font => !!font) as Font[];
    dataBuffer.writeArray(fonts, font => buildFontData(font, dataBuffer));
}
