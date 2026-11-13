// Drawing of glyphs and of a text in a style into a 2D canvas: the glyphs in
// the font editor and the expression builder, the style preview of the projects
// that the framework WASM doesn't draw (eez-gui-lite, EEZ-GUI v1/v2), and the
// text width of a Text widget that fits its content. The pages of EEZ-GUI v3
// flow projects are drawn by the framework WASM (eez-gui-editor-page.tsx).

import { getColorRGB } from "eez-studio-shared/color";

import { findBitmap, Project } from "project-editor/project/project";
import type { EezObject } from "project-editor/core/object";
import type { Font } from "project-editor/features/font/font";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    FONT_END_CHAR,
    FONT_START_CHAR,
    FONT_TAG_REGEX
} from "project-editor/flow/expression/helper";
import { findFont } from "project-editor/project/assets";
import { getPixelByteIndex } from "project-editor/features/font/utils";
import type { IFontExtract } from "project-editor/features/font/font-extract";
import { measureVectorText } from "project-editor/features/font/vector-font-measure";

////////////////////////////////////////////////////////////////////////////////

type BorderRadiusSpec = {
    topLeftX: number;
    topLeftY: number;
    topRightX: number;
    topRightY: number;
    bottomLeftX: number;
    bottomLeftY: number;
    bottomRightX: number;
    bottomRightY: number;
};

const NO_BORDER_RADIUS: BorderRadiusSpec = {
    topLeftX: 0,
    topLeftY: 0,
    topRightX: 0,
    topRightY: 0,
    bottomLeftX: 0,
    bottomLeftY: 0,
    bottomRightX: 0,
    bottomRightY: 0
};

type RectSpec = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

// The style properties drawText uses: a Style (EEZ-GUI v1/v2 projects) or a
// LiteStyle (eez-gui-lite projects, which have no opacity, border radius and
// background image).
export interface DrawStyle extends EezObject {
    fontObject: Font | undefined;
    alignHorizontalProperty: string;
    alignVerticalProperty: string;
    colorProperty: string;
    backgroundColorProperty: string;
    borderSizeRect: RectSpec;
    borderColorProperty: string;
    paddingRect: RectSpec;
    blinkProperty: number | boolean;
    opacityProperty?: number;
    borderRadiusSpec?: BorderRadiusSpec;
    backgroundImageProperty?: string;
}

////////////////////////////////////////////////////////////////////////////////

let project: Project;
let fgColor: string;
let bgColor: string;

export function setProject(project_: Project) {
    project = project_;
}

export function setColor(color: string) {
    fgColor = project.toColorBpp(color);
}

export function setBackColor(color: string) {
    bgColor = project.toColorBpp(color);
}

function fillRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    ctx.fillStyle = fgColor;
    ctx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
}

function fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lineWidth: number,
    radius: BorderRadiusSpec | number
) {
    const x = x1 + lineWidth / 2;
    const y = y1 + lineWidth / 2;
    const width = x2 - x1 + 1 - lineWidth;
    const height = y2 - y1 + 1 - lineWidth;

    let r: BorderRadiusSpec;
    if (typeof radius == "number") {
        r = {
            topLeftX: radius,
            topLeftY: radius,
            topRightX: radius,
            topRightY: radius,
            bottomLeftX: radius,
            bottomLeftY: radius,
            bottomRightX: radius,
            bottomRightY: radius
        };
    } else {
        r = radius;
    }

    ctx.beginPath();
    ctx.moveTo(x + r.topLeftX, y);
    ctx.lineTo(x + width - r.topRightX, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r.topRightY);
    ctx.lineTo(x + width, y + height - r.bottomRightY);
    ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - r.bottomRightX,
        y + height
    );
    ctx.lineTo(x + r.bottomLeftX, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r.bottomLeftY);
    ctx.lineTo(x, y + r.topLeftY);
    ctx.quadraticCurveTo(x, y, x + r.topLeftX, y);
    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();
    if (lineWidth > 0) {
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

function getGlyph(font: Font, encoding: number) {
    return font && font.glyphsMap.get(encoding);
}

function measureGlyph(encoding: number, font: Font): number {
    let glyph = getGlyph(font, encoding);
    if (!glyph) {
        return 0;
    }

    return glyph.dx || 0;
}

// Fonts referenced by font tags in the text that is currently being drawn,
// font index in the text is (position in this array) + 1. A converted text is
// only used while it is measured or drawn, so the fonts are held weakly and a
// slot of a collected font is reused. Otherwise this array would keep alive
// every project whose fonts were ever used here, e.g. a master project is
// loaded again (as a new copy) into a project that uses it every time it's saved.
const fontTagFonts: WeakRef<Font>[] = [];

function getFontTagIndex(font: Font) {
    let freeIndex = -1;
    for (let i = 0; i < fontTagFonts.length; i++) {
        const fontTagFont = fontTagFonts[i].deref();
        if (fontTagFont === font) {
            return i;
        }
        if (fontTagFont === undefined && freeIndex == -1) {
            freeIndex = i;
        }
    }

    if (freeIndex != -1) {
        fontTagFonts[freeIndex] = new WeakRef(font);
        return freeIndex;
    }

    fontTagFonts.push(new WeakRef(font));
    return fontTagFonts.length - 1;
}

// Converts <font name="..."> and </font> tags in the text to the same format
// that is generated by the build (see convertFontTags in
// flow/expression/build.ts), so that measureStr and drawStr can handle them.
// Tags with unknown font are left as is.
export function convertFontTags(text: string) {
    if (typeof text != "string" || text.indexOf("<") == -1) {
        return text;
    }

    return text.replace(
        FONT_TAG_REGEX,
        (tag: string, doubleQuoted?: string, singleQuoted?: string) => {
            const fontName = doubleQuoted ?? singleQuoted;
            if (fontName == undefined) {
                return FONT_END_CHAR;
            }

            const font = findFont(project, fontName);
            if (!font) {
                return tag;
            }

            return (
                FONT_START_CHAR + String.fromCodePoint(getFontTagIndex(font) + 1)
            );
        }
    );
}

function getFontByIndex(fontIndex: number, defaultFont: Font) {
    return (
        (fontIndex > 0 && fontTagFonts[fontIndex - 1]?.deref()) || defaultFont
    );
}

export function measureStr(
    text: string,
    font: Font,
    maxWidth: number,
    startFontIndex: number = 0
): number {
    let width = 0;

    let currentFont = getFontByIndex(startFontIndex, font);

    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);

        // the characters up to a font tag in a vector font are measured
        // together (kerning, ligatures)
        if (
            currentFont.vector &&
            encoding != FONT_START_CHAR.charCodeAt(0) &&
            encoding != FONT_END_CHAR.charCodeAt(0)
        ) {
            let end = i;
            while (
                end < text.length &&
                text[end] != FONT_START_CHAR &&
                text[end] != FONT_END_CHAR
            ) {
                end++;
            }
            const runWidth = measureVectorText(
                currentFont,
                text.substring(i, end)
            );
            if (maxWidth > 0 && width + runWidth > maxWidth) {
                return maxWidth;
            }
            width += runWidth;
            i = end - 1;
            continue;
        }

        if (encoding == FONT_START_CHAR.charCodeAt(0)) {
            currentFont = getFontByIndex(
                i + 1 < text.length ? text.charCodeAt(++i) : 0,
                font
            );
            continue;
        }
        if (encoding == FONT_END_CHAR.charCodeAt(0)) {
            currentFont = font;
            continue;
        }

        let glyph_width = measureGlyph(encoding, currentFont);
        if (maxWidth > 0 && width + glyph_width > maxWidth) {
            return maxWidth;
        }
        width += glyph_width;
    }

    return width;
}

let MAX_GLYPH_WIDTH = 256;
let MAX_GLYPH_HEIGHT = 256;
let pixelImageData: ImageData;
let pixelData: Uint8ClampedArray;

export function drawGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    encoding: number,
    font: Font
): number {
    if (!pixelImageData) {
        pixelImageData = ctx.createImageData(MAX_GLYPH_WIDTH, MAX_GLYPH_HEIGHT);
        pixelData = pixelImageData.data;
        pixelData.fill(255);
    }

    let glyph = getGlyph(font, encoding);
    if (!glyph || !glyph.pixelArray) {
        return 0;
    }

    const glyphBitmap = {
        width: glyph.width,
        height: glyph.height,
        pixelArray: glyph.pixelArray
    };

    let x_glyph = x + glyph.x;
    let y_glyph = y + font.ascent - (glyph.y + glyph.height);

    let width = glyph.width;
    let height = glyph.height;

    if (width > 0 && height > 0) {
        let i = 0;
        const offset = (MAX_GLYPH_WIDTH - width) * 4;
        const fgColorRgb = getColorRGB(fgColor);
        const bgColorRgb = getColorRGB(bgColor);
        const pixelArray = glyphBitmap.pixelArray;
        if (pixelArray) {
            const project = ProjectEditor.getProject(font);
            if (font.bpp === 8 || project.projectTypeTraits.isLVGL) {
                let pixelArrayIndex = 0;
                const pixelArrayOffset = glyph.width - width;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        pixelData[i++] = fgColorRgb.r;
                        pixelData[i++] = fgColorRgb.g;
                        pixelData[i++] = fgColorRgb.b;
                        pixelData[i++] = pixelArray[pixelArrayIndex++];
                    }
                    i += offset;
                    pixelArrayIndex += pixelArrayOffset;
                }
            } else if (font.bpp === 4) {
                const maxAlpha = 15;
                const bytesPerLine = Math.floor(
                    (glyph.width * 4 + 7) / 8
                );
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const byteIndex =
                            y * bytesPerLine + Math.floor(x / 2);
                        const shift = (1 - (x % 2)) * 4;
                        const alpha =
                            ((pixelArray[byteIndex] >> shift) & 0x0f) *
                            255 /
                            maxAlpha;
                        pixelData[i++] =
                            bgColorRgb.r +
                            ((fgColorRgb.r - bgColorRgb.r) * alpha) / 255;
                        pixelData[i++] =
                            bgColorRgb.g +
                            ((fgColorRgb.g - bgColorRgb.g) * alpha) / 255;
                        pixelData[i++] =
                            bgColorRgb.b +
                            ((fgColorRgb.b - bgColorRgb.b) * alpha) / 255;
                        pixelData[i++] = 255;
                    }
                    i += offset;
                }
            } else if (font.bpp === 2) {
                const maxAlpha = 3;
                const bytesPerLine = Math.floor(
                    (glyph.width * 2 + 7) / 8
                );
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const byteIndex =
                            y * bytesPerLine + Math.floor(x / 4);
                        const shift = (3 - (x % 4)) * 2;
                        const alpha =
                            ((pixelArray[byteIndex] >> shift) & 0x03) *
                            255 /
                            maxAlpha;
                        pixelData[i++] =
                            bgColorRgb.r +
                            ((fgColorRgb.r - bgColorRgb.r) * alpha) / 255;
                        pixelData[i++] =
                            bgColorRgb.g +
                            ((fgColorRgb.g - bgColorRgb.g) * alpha) / 255;
                        pixelData[i++] =
                            bgColorRgb.b +
                            ((fgColorRgb.b - bgColorRgb.b) * alpha) / 255;
                        pixelData[i++] = 255;
                    }
                    i += offset;
                }
            } else {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const pixel =
                            pixelArray[getPixelByteIndex(glyphBitmap, x, y)] &
                            (0x80 >> x % 8);
                        if (pixel) {
                            pixelData[i++] = fgColorRgb.r;
                            pixelData[i++] = fgColorRgb.g;
                            pixelData[i++] = fgColorRgb.b;
                        } else {
                            pixelData[i++] = bgColorRgb.r;
                            pixelData[i++] = bgColorRgb.g;
                            pixelData[i++] = bgColorRgb.b;
                        }
                        pixelData[i++] = 255;
                    }
                    i += offset;
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    pixelData[i++] = bgColorRgb.r;
                    pixelData[i++] = bgColorRgb.g;
                    pixelData[i++] = bgColorRgb.b;
                    pixelData[i++] = bgColorRgb.a;
                }
                i += offset;
            }
        }
        ctx.fillStyle = bgColor;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas
            .getContext("2d")!
            .putImageData(pixelImageData, 0, 0, 0, 0, width, height);

        ctx.drawImage(canvas, x_glyph, y_glyph);
    }

    return glyph.dx || 0;
}

export function drawGlyph2(encoding: number, fontExtract: IFontExtract) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const glyph = fontExtract.getGlyph && fontExtract.getGlyph(encoding);
    if (glyph) {
        const font = fontExtract.fontProperties;

        let width = glyph.width;
        let height = glyph.height;

        if (glyph.glyphBitmap && width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;

            let ctx = canvas.getContext("2d")!;

            const pixelImageData = ctx.createImageData(width, height);
            const pixelData = pixelImageData.data;

            let i = 0;
            const fgColorRgb = getColorRGB(fgColor);
            const bgColorRgb = getColorRGB(bgColor);
            const pixelArray = glyph.glyphBitmap.pixelArray;
            if (pixelArray) {
                if (font.bpp === 8) {
                    let pixelArrayIndex = 0;
                    const pixelArrayOffset = glyph.glyphBitmap.width - width;
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            pixelData[i++] = fgColorRgb.r;
                            pixelData[i++] = fgColorRgb.g;
                            pixelData[i++] = fgColorRgb.b;
                            pixelData[i++] = pixelArray[pixelArrayIndex++];
                        }
                        pixelArrayIndex += pixelArrayOffset;
                    }
                } else if (font.bpp === 4) {
                    const maxAlpha = 15;
                    const bytesPerLine = Math.floor(
                        (glyph.glyphBitmap.width * 4 + 7) / 8
                    );
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const byteIndex =
                                y * bytesPerLine + Math.floor(x / 2);
                            const shift = (1 - (x % 2)) * 4;
                            const alpha =
                                ((pixelArray[byteIndex] >> shift) & 0x0f) *
                                255 /
                                maxAlpha;
                            pixelData[i++] =
                                bgColorRgb.r +
                                ((fgColorRgb.r - bgColorRgb.r) * alpha) / 255;
                            pixelData[i++] =
                                bgColorRgb.g +
                                ((fgColorRgb.g - bgColorRgb.g) * alpha) / 255;
                            pixelData[i++] =
                                bgColorRgb.b +
                                ((fgColorRgb.b - bgColorRgb.b) * alpha) / 255;
                            pixelData[i++] = 255;
                        }
                    }
                } else if (font.bpp === 2) {
                    const maxAlpha = 3;
                    const bytesPerLine = Math.floor(
                        (glyph.glyphBitmap.width * 2 + 7) / 8
                    );
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const byteIndex =
                                y * bytesPerLine + Math.floor(x / 4);
                            const shift = (3 - (x % 4)) * 2;
                            const alpha =
                                ((pixelArray[byteIndex] >> shift) & 0x03) *
                                255 /
                                maxAlpha;
                            pixelData[i++] =
                                bgColorRgb.r +
                                ((fgColorRgb.r - bgColorRgb.r) * alpha) / 255;
                            pixelData[i++] =
                                bgColorRgb.g +
                                ((fgColorRgb.g - bgColorRgb.g) * alpha) / 255;
                            pixelData[i++] =
                                bgColorRgb.b +
                                ((fgColorRgb.b - bgColorRgb.b) * alpha) / 255;
                            pixelData[i++] = 255;
                        }
                    }
                } else {
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const pixel =
                                pixelArray[
                                    getPixelByteIndex(glyph.glyphBitmap, x, y)
                                ] &
                                (0x80 >> x % 8);
                            if (pixel) {
                                pixelData[i++] = fgColorRgb.r;
                                pixelData[i++] = fgColorRgb.g;
                                pixelData[i++] = fgColorRgb.b;
                            } else {
                                pixelData[i++] = bgColorRgb.r;
                                pixelData[i++] = bgColorRgb.g;
                                pixelData[i++] = bgColorRgb.b;
                            }
                            i++;
                        }
                    }
                }
            } else {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        pixelData[i++] = bgColorRgb.r;
                        pixelData[i++] = bgColorRgb.g;
                        pixelData[i++] = bgColorRgb.b;
                        pixelData[i++] = bgColorRgb.a;
                    }
                }
            }

            ctx.putImageData(pixelImageData, 0, 0);
        }
    }

    return canvas;
}

function drawStr(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    font: Font,
    startFontIndex: number = 0
) {
    let currentFont = getFontByIndex(startFontIndex, font);

    for (let i = 0; i < text.length; i++) {
        let encoding = text.charCodeAt(i);

        if (encoding == FONT_START_CHAR.charCodeAt(0)) {
            currentFont = getFontByIndex(
                i + 1 < text.length ? text.charCodeAt(++i) : 0,
                font
            );
            continue;
        }
        if (encoding == FONT_END_CHAR.charCodeAt(0)) {
            currentFont = font;
            continue;
        }

        x += drawGlyph(ctx, x, y, encoding, currentFont);
    }
}

function drawBitmap(
    ctx: CanvasRenderingContext2D,
    bitmap: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) {
    ctx.drawImage(bitmap, x, y, width, height);
}

////////////////////////////////////////////////////////////////////////////////

function styleIsHorzAlignLeft(style: DrawStyle) {
    return style.alignHorizontalProperty == "left";
}

function styleIsHorzAlignRight(style: DrawStyle) {
    return style.alignHorizontalProperty == "right";
}

function styleIsVertAlignTop(style: DrawStyle) {
    return style.alignVerticalProperty == "top";
}

function styleIsVertAlignBottom(style: DrawStyle) {
    return style.alignVerticalProperty == "bottom";
}

export function styleGetFont(style: DrawStyle) {
    return style.fontObject;
}

////////////////////////////////////////////////////////////////////////////////

function drawBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    style: DrawStyle,
    inverse: boolean,
    color?: string
) {
    let x1 = x;
    let y1 = y;
    let x2 = x + width - 1;
    let y2 = y + height - 1;

    if (width > 0 && height > 0) {
        const savedGlobalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = (style.opacityProperty ?? 255) / 255;

        if (color == undefined) {
            color = inverse
                ? style.backgroundColorProperty
                : style.colorProperty;
        }

        const borderSize = style.borderSizeRect;
        if (
            borderSize.top > 0 ||
            borderSize.right > 0 ||
            borderSize.bottom > 0 ||
            borderSize.left > 0
        ) {
            setColor(style.borderColorProperty);

            let borderRadius = style.borderRadiusSpec ?? NO_BORDER_RADIUS;
            if (
                borderRadius.topLeftX > 0 ||
                borderRadius.topLeftY > 0 ||
                borderRadius.topRightX > 0 ||
                borderRadius.topRightY > 0 ||
                borderRadius.bottomLeftX > 0 ||
                borderRadius.bottomLeftY > 0 ||
                borderRadius.bottomRightX > 0 ||
                borderRadius.bottomRightY > 0
            ) {
                setBackColor(color);

                let lineWidth = borderSize.top;
                if (lineWidth < borderSize.right) {
                    lineWidth = borderSize.right;
                }
                if (lineWidth < borderSize.bottom) {
                    lineWidth = borderSize.bottom;
                }
                if (lineWidth < borderSize.left) {
                    lineWidth = borderSize.left;
                }

                fillRoundedRect(ctx, x1, y1, x2, y2, lineWidth, borderRadius);

                ctx.globalAlpha = savedGlobalAlpha;

                return {
                    x1: x1 + lineWidth,
                    y1: y1 + lineWidth,
                    x2: x2 - lineWidth,
                    y2: y2 - lineWidth
                };
            }

            if (borderSize.left > 0) {
                fillRect(ctx, x1, y1, x1 + borderSize.left - 1, y2);
            }
            if (borderSize.top > 0) {
                fillRect(ctx, x1, y1, x2, y1 + borderSize.top - 1);
            }
            if (borderSize.right > 0) {
                fillRect(ctx, x2 - (borderSize.right - 1), y1, x2, y2);
            }
            if (borderSize.bottom > 0) {
                fillRect(ctx, x1, y2 - (borderSize.bottom - 1), x2, y2);
            }

            x1 += borderSize.left;
            y1 += borderSize.top;
            x2 -= borderSize.right;
            y2 -= borderSize.bottom;
        } else {
            let borderRadius = style.borderRadiusSpec ?? NO_BORDER_RADIUS;
            if (
                borderRadius.topLeftX > 0 ||
                borderRadius.topLeftY > 0 ||
                borderRadius.topRightX > 0 ||
                borderRadius.topRightY > 0 ||
                borderRadius.bottomLeftX > 0 ||
                borderRadius.bottomLeftY > 0 ||
                borderRadius.bottomRightX > 0 ||
                borderRadius.bottomRightY > 0
            ) {
                setBackColor(color);

                fillRoundedRect(ctx, x1, y1, x2, y2, 0, borderRadius);

                ctx.globalAlpha = savedGlobalAlpha;

                return {
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2
                };
            }
        }

        setColor(color);
        fillRect(ctx, x1, y1, x2, y2);

        if (style.backgroundImageProperty) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(style),
                style.backgroundImageProperty
            );
            const imageElement = bitmap?.imageElement;
            if (imageElement) {
                drawBitmap(ctx, imageElement, 0, 0, width, height);
            }
        }

        ctx.globalAlpha = savedGlobalAlpha;
    }

    return { x1, y1, x2, y2 };
}

export function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    style: DrawStyle,
    inverse: boolean,
    overrideBackgroundColor?: string,
    boolSkipBackground: boolean = false
) {
    const styleColor = style.colorProperty;
    const styleBackgroundColor =
        overrideBackgroundColor !== undefined
            ? overrideBackgroundColor
            : style.backgroundColorProperty;

    let { x1, y1, x2, y2 } = boolSkipBackground
        ? { x1: x, y1: y, x2: x + w - 1, y2: y + h - 1 }
        : drawBackground(
              ctx,
              x,
              y,
              w,
              h,
              style,
              false,
              inverse ? styleColor : styleBackgroundColor
          );

    const font = styleGetFont(style);
    if (!font) {
        return;
    }

    text = unescapeText(text);

    let width = measureStr(text, font, 0);
    let height = font.height;

    if (width > 0 && height > 0) {
        let x_offset: number;
        if (styleIsHorzAlignLeft(style)) {
            x_offset = x1 + style.paddingRect.left;
        } else if (styleIsHorzAlignRight(style)) {
            x_offset = x2 - style.paddingRect.right - width;
        } else {
            x_offset = Math.floor(x1 + (x2 - x1 + 1 - width) / 2);
            if (x_offset < x1) {
                x_offset = x1;
            }
        }

        let y_offset: number;
        if (styleIsVertAlignTop(style)) {
            y_offset = y1 + style.paddingRect.top;
        } else if (styleIsVertAlignBottom(style)) {
            y_offset = y2 - style.paddingRect.bottom - height;
        } else {
            y_offset = Math.floor(y1 + (y2 - y1 + 1 - height) / 2);
        }

        if (inverse) {
            setBackColor(styleColor);
            setColor(styleBackgroundColor);
        } else {
            setBackColor(styleBackgroundColor);
            setColor(styleColor);
        }
        drawStr(ctx, text, x_offset, y_offset, width, height, font);
    }
}

////////////////////////////////////////////////////////////////////////////////

// Checkbox (rounded square, check mark if checked) or radio button (circle,
// filled circle if checked) with the label right of it after a space, the same
// as drawCheckboxOrRadio in eez-framework gui/draw.cpp. The box is 3/4 of the
// style font height, as big as an icon glyph of the font. The box and the label
// are aligned as a text in drawText and drawn with the style color on the style
// background.

function unescapeText(text: string) {
    try {
        return JSON.parse('"' + text + '"');
    } catch (e) {
        return text;
    }
}

////////////////////////////////////////////////////////////////////////////////

