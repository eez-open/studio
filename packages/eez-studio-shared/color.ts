import tinycolor from "tinycolor2";

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
