// The width of a text in a vector font (Font.vector) for the editor, e.g. the
// size of a Text widget that fits its content. The framework measures it again
// at runtime with HarfBuzz; opentype.js gives the same advances and kerning
// pairs, the OpenType features other than ligatures are not applied here.

import fs from "fs";
import { parse, Font as OpenTypeFont } from "opentype.js";

import type { Font } from "project-editor/features/font/font";
import { getProject } from "project-editor/project/project";
import { getVectorFontSize } from "project-editor/build/fonts";

const fontFiles = new Map<
    string,
    { mtimeMs: number; font: OpenTypeFont | undefined }
>();

function getOpenTypeFont(filePath: string) {
    try {
        const stat = fs.statSync(filePath);
        let cached = fontFiles.get(filePath);
        if (!cached || cached.mtimeMs != stat.mtimeMs) {
            let font: OpenTypeFont | undefined;
            try {
                const data = fs.readFileSync(filePath);
                font = parse(
                    data.buffer.slice(
                        data.byteOffset,
                        data.byteOffset + data.byteLength
                    )
                );
            } catch (err) {
                font = undefined;
            }
            cached = { mtimeMs: stat.mtimeMs, font };
            fontFiles.set(filePath, cached);
        }
        return cached.font;
    } catch (err) {
        return undefined;
    }
}

export function measureVectorText(font: Font, text: string) {
    if (!text || !font.source?.filePath) {
        return 0;
    }

    const project = getProject(font);
    const filePath = project._store.getAbsoluteFilePath(
        font.source.filePath,
        project
    );

    const otFont = getOpenTypeFont(filePath);
    if (!otFont) {
        return 0;
    }

    const features = (font.vectorFeatures ?? "")
        .split(",")
        .map(feature => feature.trim());
    const ligatures = !features.includes("-liga");

    const width = otFont.getAdvanceWidth(text, getVectorFontSize(font) / 64, {
        kerning: true,
        features: { liga: ligatures, rlig: true }
    });

    return Math.round(width + (font.vectorLetterSpacing ?? 0) * text.length);
}
