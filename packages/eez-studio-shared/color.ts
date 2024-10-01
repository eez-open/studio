import tinycolor from "tinycolor2";

export function getColorRGB(color: string) {
    return tinycolor(color).toRgb();
}

export function addAlphaToColor(color: string, alpha: number) {
    return tinycolor(color).setAlpha(alpha).toRgbString();
}

export function blendColor(
    fgColor: { r: number; g: number; b: number },
    bgColor: { r: number; g: number; b: number },
    alpha: number,
    mixedColor: { r: number; g: number; b: number }
) {
    if (alpha == 0) {
        return bgColor;
    }

    if (alpha == 1) {
        return fgColor;
    }

    var alphaAdded = alpha;
    var alphaBase = 1 - alpha;

    alpha = 1 - (1 - alpha) * alpha;

    var a = alphaAdded / alpha;
    var b = (alphaBase * (1 - alphaAdded)) / alpha;

    mixedColor.r = Math.round(fgColor.r * a + bgColor.r * b);
    mixedColor.g = Math.round(fgColor.g * a + bgColor.g * b);
    mixedColor.b = Math.round(fgColor.b * a + bgColor.b * b);

    return mixedColor;
}

export function strToColor16(colorStr: string) {
    const rgb = tinycolor(colorStr).toRgb();
    // rrrrrggggggbbbbb
    let color16 = ((rgb.r >> 3) << 11) | ((rgb.g >> 2) << 5) | (rgb.b >> 3);
    return color16;
}

export function to16bitsColor(colorStr: string) {
    const rgb = tinycolor(colorStr).toRgb();
    const r = rgb.r & 0b11111000;
    const g = rgb.g & 0b11111100;
    const b = rgb.b & 0b11111000;
    const a = rgb.a;
    if (rgb.a == 255) {
        return tinycolor({ r, g, b }).toHexString();
    } else {
        return tinycolor({ r, g, b, a }).toRgbString();
    }
}

export function compareColors(color1: string, color2: string) {
    const color1rgb = tinycolor(color1).toRgb();
    const color2rgb = tinycolor(color2).toRgb();
    return (
        color1rgb.r === color2rgb.r &&
        color1rgb.g === color2rgb.g &&
        color1rgb.b === color2rgb.b &&
        color1rgb.a === color2rgb.a
    );
}

export function isDark(color: string) {
    return tinycolor(color).isDark();
}

export function isLight(color: string) {
    return tinycolor(color).isLight();
}

export function isValid(color: string) {
    return tinycolor(color).isValid();
}

export function darken(color: string) {
    return tinycolor(color).darken().toRgb();
}

export function lighten(color: string) {
    return tinycolor(color).lighten().toRgbString();
}
