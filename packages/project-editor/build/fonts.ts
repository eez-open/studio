import { computed, IComputedValue } from "mobx";

import type { Font } from "project-editor/features/font/font";
import type { Assets } from "project-editor/build/assets";
import { DataBuffer } from "project-editor/build/data-buffer";
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

// The editor build (see EditorBuild in assets.ts) runs on every change, and the
// fonts are most of its data. A font is built once into its own data buffer and
// copied as it is (offsets in the assets are relative to the field that holds
// them); the computed value builds it again only when the font changes.
const editorFontData = new WeakMap<Font, IComputedValue<Buffer>>();

function getEditorFontData(font: Font, utf8Support: boolean) {
    let fontData = editorFontData.get(font);
    if (!fontData) {
        fontData = computed(
            () => {
                let size = 1024;
                for (const glyph of font.glyphs) {
                    size += 32 + (glyph.pixelArray?.length ?? 0);
                }
                const dataBuffer = new DataBuffer(utf8Support, size);
                buildFontData(font, dataBuffer);
                dataBuffer.finalize();
                return dataBuffer.buffer;
            },
            { keepAlive: true }
        );
        editorFontData.set(font, fontData);
    }
    return fontData.get();
}

export function buildGuiFontsData(assets: Assets, dataBuffer: DataBuffer) {
    const fonts = assets.fonts.filter(font => !!font) as Font[];
    dataBuffer.writeArray(fonts, font => {
        if (assets.editorBuild) {
            dataBuffer.writeUint8Array(
                getEditorFontData(font, assets.utf8Support)
            );
        } else {
            buildFontData(font, dataBuffer);
        }
    });
}
