import tinycolor from "tinycolor2";

export function getColorRGB(color: string) {
    return tinycolor(color).toRgb();
}

export function addAlphaToColor(color: string, alpha: number) {
    return tinycolor(color)
        .setAlpha(alpha)
        .toRgbString();
}

export function blendColor(fgColor: string, bgColor: string, alpha: number) {
    const fg = tinycolor(fgColor).toRgb();
    var added = [fg.r, fg.g, fg.b, alpha];

    const bg = tinycolor(bgColor).toRgb();
    var base = [bg.r, bg.g, bg.b, 1 - alpha];

    var mix = [];

    mix[3] = 1 - (1 - added[3]) * (1 - base[3]); // alpha

    mix[0] = Math.round(
        (added[0] * added[3]) / mix[3] + (base[0] * base[3] * (1 - added[3])) / mix[3]
    ); // red

    mix[1] = Math.round(
        (added[1] * added[3]) / mix[3] + (base[1] * base[3] * (1 - added[3])) / mix[3]
    ); // green

    mix[2] = Math.round(
        (added[2] * added[3]) / mix[3] + (base[2] * base[3] * (1 - added[3])) / mix[3]
    ); // blue

    return "rgba(" + mix.join(",") + ")";
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
    return tinycolor({ r, g, b }).toHexString();
}

export function compareColors(color1: string, color2: string) {
    const color1rgb = tinycolor(color1).toRgb();
    const color2rgb = tinycolor(color2).toRgb();
    return (
        color1rgb.r === color2rgb.r && color1rgb.g === color2rgb.g && color1rgb.b === color2rgb.b
    );
}

export function isDark(color: string) {
    return tinycolor(color).isDark();
}
