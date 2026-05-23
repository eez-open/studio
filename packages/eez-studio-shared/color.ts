function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
}

function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

export function hslToRgb(
    h: number,
    s: number,
    l: number
): { r: number; g: number; b: number } {
    // h: 0-360, s: 0-1, l: 0-1
    h = ((h % 360) + 360) % 360;
    h /= 360;
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);

    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    };
}

export function rgbToHsl(
    r: number,
    g: number,
    b: number
): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) {
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        } else if (max === g) {
            h = ((b - r) / d + 2) / 6;
        } else {
            h = ((r - g) / d + 4) / 6;
        }
    }

    return { h: h * 360, s, l };
}

export function hsvToRgb(
    h: number,
    s: number,
    v: number
): { r: number; g: number; b: number } {
    // h: 0-360, s: 0-1, v: 0-1
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    v = clamp(v, 0, 1);

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r1: number, g1: number, b1: number;
    if (h < 60) {
        r1 = c; g1 = x; b1 = 0;
    } else if (h < 120) {
        r1 = x; g1 = c; b1 = 0;
    } else if (h < 180) {
        r1 = 0; g1 = c; b1 = x;
    } else if (h < 240) {
        r1 = 0; g1 = x; b1 = c;
    } else if (h < 300) {
        r1 = x; g1 = 0; b1 = c;
    } else {
        r1 = c; g1 = 0; b1 = x;
    }

    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

export function rgbToHsv(
    r: number,
    g: number,
    b: number
): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const v = max;
    const s = max === 0 ? 0 : d / max;
    let h = 0;

    if (max !== min) {
        if (max === r) {
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        } else if (max === g) {
            h = ((b - r) / d + 2) / 6;
        } else {
            h = ((r - g) / d + 4) / 6;
        }
    }

    return { h: h * 360, s, v };
}

////////////////////////////////////////////////////////////////////////////////

export const HTML_COLOR_NAMES: Record<string, [number, number, number]> = {
    aliceblue: [240, 248, 255],
    antiquewhite: [250, 235, 215],
    aqua: [0, 255, 255],
    aquamarine: [127, 255, 212],
    azure: [240, 255, 255],
    beige: [245, 245, 220],
    bisque: [255, 228, 196],
    black: [0, 0, 0],
    blanchedalmond: [255, 235, 205],
    blue: [0, 0, 255],
    blueviolet: [138, 43, 226],
    brown: [165, 42, 42],
    burlywood: [222, 184, 135],
    cadetblue: [95, 158, 160],
    chartreuse: [127, 255, 0],
    chocolate: [210, 105, 30],
    coral: [255, 127, 80],
    cornflowerblue: [100, 149, 237],
    cornsilk: [255, 248, 220],
    crimson: [220, 20, 60],
    cyan: [0, 255, 255],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkgoldenrod: [184, 134, 11],
    darkgray: [169, 169, 169],
    darkgreen: [0, 100, 0],
    darkgrey: [169, 169, 169],
    darkkhaki: [189, 183, 107],
    darkmagenta: [139, 0, 139],
    darkolivegreen: [85, 107, 47],
    darkorange: [255, 140, 0],
    darkorchid: [153, 50, 204],
    darkred: [139, 0, 0],
    darksalmon: [233, 150, 122],
    darkseagreen: [143, 188, 143],
    darkslateblue: [72, 61, 139],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    darkturquoise: [0, 206, 209],
    darkviolet: [148, 0, 211],
    deeppink: [255, 20, 147],
    deepskyblue: [0, 191, 255],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    dodgerblue: [30, 144, 255],
    firebrick: [178, 34, 34],
    floralwhite: [255, 250, 240],
    forestgreen: [34, 139, 34],
    fuchsia: [255, 0, 255],
    gainsboro: [220, 220, 220],
    ghostwhite: [248, 248, 255],
    gold: [255, 215, 0],
    goldenrod: [218, 165, 32],
    gray: [128, 128, 128],
    green: [0, 128, 0],
    greenyellow: [173, 255, 47],
    grey: [128, 128, 128],
    honeydew: [240, 255, 240],
    hotpink: [255, 105, 180],
    indianred: [205, 92, 92],
    indigo: [75, 0, 130],
    ivory: [255, 255, 240],
    khaki: [240, 230, 140],
    lavender: [230, 230, 250],
    lavenderblush: [255, 240, 245],
    lawngreen: [124, 252, 0],
    lemonchiffon: [255, 250, 205],
    lightblue: [173, 216, 230],
    lightcoral: [240, 128, 128],
    lightcyan: [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray: [211, 211, 211],
    lightgreen: [144, 238, 144],
    lightgrey: [211, 211, 211],
    lightpink: [255, 182, 193],
    lightsalmon: [255, 160, 122],
    lightseagreen: [32, 178, 170],
    lightskyblue: [135, 206, 250],
    lightslategray: [119, 136, 153],
    lightslategrey: [119, 136, 153],
    lightsteelblue: [176, 196, 222],
    lightyellow: [255, 255, 224],
    lime: [0, 255, 0],
    limegreen: [50, 205, 50],
    linen: [250, 240, 230],
    magenta: [255, 0, 255],
    maroon: [128, 0, 0],
    mediumaquamarine: [102, 205, 170],
    mediumblue: [0, 0, 205],
    mediumorchid: [186, 85, 211],
    mediumpurple: [147, 112, 219],
    mediumseagreen: [60, 179, 113],
    mediumslateblue: [123, 104, 238],
    mediumspringgreen: [0, 250, 154],
    mediumturquoise: [72, 209, 204],
    mediumvioletred: [199, 21, 133],
    midnightblue: [25, 25, 112],
    mintcream: [245, 255, 250],
    mistyrose: [255, 228, 225],
    moccasin: [255, 228, 181],
    navajowhite: [255, 222, 173],
    navy: [0, 0, 128],
    oldlace: [253, 245, 230],
    olive: [128, 128, 0],
    olivedrab: [107, 142, 35],
    orange: [255, 165, 0],
    orangered: [255, 69, 0],
    orchid: [218, 112, 214],
    palegoldenrod: [238, 232, 170],
    palegreen: [152, 251, 152],
    paleturquoise: [175, 238, 238],
    palevioletred: [219, 112, 147],
    papayawhip: [255, 239, 213],
    peachpuff: [255, 218, 185],
    peru: [205, 133, 63],
    pink: [255, 192, 203],
    plum: [221, 160, 221],
    powderblue: [176, 224, 230],
    purple: [128, 0, 128],
    rebeccapurple: [102, 51, 153],
    red: [255, 0, 0],
    rosybrown: [188, 143, 143],
    royalblue: [65, 105, 225],
    saddlebrown: [139, 69, 19],
    salmon: [250, 128, 114],
    sandybrown: [244, 164, 96],
    seagreen: [46, 139, 87],
    seashell: [255, 245, 238],
    sienna: [160, 82, 45],
    silver: [192, 192, 192],
    skyblue: [135, 206, 235],
    slateblue: [106, 90, 205],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
    snow: [255, 250, 250],
    springgreen: [0, 255, 127],
    steelblue: [70, 130, 180],
    tan: [210, 180, 140],
    teal: [0, 128, 128],
    thistle: [216, 191, 216],
    tomato: [255, 99, 71],
    transparent: [0, 0, 0],
    turquoise: [64, 224, 208],
    violet: [238, 130, 238],
    wheat: [245, 222, 179],
    white: [255, 255, 255],
    whitesmoke: [245, 245, 245],
    yellow: [255, 255, 0],
    yellowgreen: [154, 205, 50]
};

////////////////////////////////////////////////////////////////////////////////

export function parseColorString(
    color: string
): { r: number; g: number; b: number; a: number } | null {
    if (!color || typeof color !== "string") return null;
    color = color.trim();

    // #RRGGBB or #RGB
    if (/^#?[0-9a-fA-F]{6}$/.test(color)) {
        const v = parseInt(color.startsWith("#") ? color.slice(1) : color, 16);
        return {
            r: (v >> 16) & 0xff,
            g: (v >> 8) & 0xff,
            b: v & 0xff,
            a: 1
        };
    }
    if (/^#?[0-9a-fA-F]{3}$/.test(color)) {
        const hex = color.startsWith("#") ? color.slice(1) : color;
        const expanded =
            hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const v = parseInt(expanded, 16);
        return {
            r: (v >> 16) & 0xff,
            g: (v >> 8) & 0xff,
            b: v & 0xff,
            a: 1
        };
    }

    // #RRGGBBAA or #RGBA
    if (/^#?[0-9a-fA-F]{8}$/.test(color)) {
        const v = parseInt(color.startsWith("#") ? color.slice(1) : color, 16);
        return {
            r: (v >> 24) & 0xff,
            g: (v >> 16) & 0xff,
            b: (v >> 8) & 0xff,
            a: ((v & 0xff) / 255)
        };
    }
    if (/^#?[0-9a-fA-F]{4}$/.test(color)) {
        const hex = color.startsWith("#") ? color.slice(1) : color;
        const expanded =
            hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        const v = parseInt(expanded, 16);
        return {
            r: (v >> 24) & 0xff,
            g: (v >> 16) & 0xff,
            b: (v >> 8) & 0xff,
            a: ((v & 0xff) / 255)
        };
    }

    // 0xRRGGBB
    if (/^0[xX][0-9a-fA-F]{6}$/.test(color)) {
        const v = parseInt(color.slice(2), 16);
        return {
            r: (v >> 16) & 0xff,
            g: (v >> 8) & 0xff,
            b: v & 0xff,
            a: 1
        };
    }

    // 0xRRGGBBAA
    if (/^0[xX][0-9a-fA-F]{8}$/.test(color)) {
        const v = parseInt(color.slice(2), 16);
        return {
            r: (v >> 24) & 0xff,
            g: (v >> 16) & 0xff,
            b: (v >> 8) & 0xff,
            a: ((v & 0xff) / 255)
        };
    }

    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = color.match(
        /^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
    );
    if (rgbMatch) {
        return {
            r: clamp(parseInt(rgbMatch[1], 10), 0, 255),
            g: clamp(parseInt(rgbMatch[2], 10), 0, 255),
            b: clamp(parseInt(rgbMatch[3], 10), 0, 255),
            a: rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1
        };
    }

    // hsl(h, s%, l%) or hsla(h, s%, l%, a)
    const hslMatch = color.match(
        /^hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i
    );
    if (hslMatch) {
        const rgb = hslToRgb(
            parseFloat(hslMatch[1]),
            parseFloat(hslMatch[2]) / 100,
            parseFloat(hslMatch[3]) / 100
        );
        return {
            ...rgb,
            a: hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1
        };
    }

    // Named colors
    const named = HTML_COLOR_NAMES[color.toLowerCase()];
    if (named) {
        return {
            r: named[0],
            g: named[1],
            b: named[2],
            a: color.toLowerCase() === "transparent" ? 0 : 1
        };
    }

    return null;
}

////////////////////////////////////////////////////////////////////////////////

export function rgbToHexString(r: number, g: number, b: number): string {
    return (
        "#" +
        r.toString(16).padStart(2, "0") +
        g.toString(16).padStart(2, "0") +
        b.toString(16).padStart(2, "0")
    );
}

export function rgbaToRgbString(
    r: number,
    g: number,
    b: number,
    a?: number
): string {
    if (a !== undefined && a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
}

////////////////////////////////////////////////////////////////////////////////

export function getColorRGB(color: string) {
    const parsed = parseColorString(color);
    if (!parsed) return { r: 0, g: 0, b: 0, a: 1 };
    return parsed;
}

export function addAlphaToColor(color: string, alpha: number) {
    const parsed = parseColorString(color);
    if (!parsed) return `rgba(0, 0, 0, ${alpha})`;
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
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
    const rgb = getColorRGB(colorStr);
    // rrrrrggggggbbbbb
    let color16 = ((rgb.r >> 3) << 11) | ((rgb.g >> 2) << 5) | (rgb.b >> 3);
    return color16;
}

export function strToColor32(colorStr: string) {
    const rgb = getColorRGB(colorStr);
    let color32 = (rgb.r | (rgb.g << 8) | (rgb.b << 16) | (Math.round(rgb.a * 255) << 24)) >>> 0;
    return color32;
}

export function to16bitsColor(colorStr: string) {
    const parsed = getColorRGB(colorStr);
    const r = parsed.r & 0b11111000;
    const g = parsed.g & 0b11111100;
    const b = parsed.b & 0b11111000;
    const a = parsed.a;
    if (a >= 1) {
        return rgbToHexString(r, g, b);
    } else {
        return rgbaToRgbString(r, g, b, a);
    }
}

export function compareColors(color1: string, color2: string) {
    const c1 = getColorRGB(color1);
    const c2 = getColorRGB(color2);
    return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
}

export function isDark(color: string) {
    const rgb = getColorRGB(color);
    // YIQ formula (same as tinycolor)
    const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return yiq < 128;
}

export function isLight(color: string) {
    return !isDark(color);
}

export function isValid(color: string) {
    return parseColorString(color) !== null;
}

export function darken(color: string) {
    const rgb = getColorRGB(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.max(0, hsl.l - 0.1);
    return hslToRgb(hsl.h, hsl.s, hsl.l);
}

export function lighten(color: string) {
    const rgb = getColorRGB(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(1, hsl.l + 0.1);
    const result = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbaToRgbString(result.r, result.g, result.b);
}

// Relative luminance per WCAG 2.0
function relativeLuminance(r: number, g: number, b: number): number {
    const rs = r / 255;
    const gs = g / 255;
    const bs = b / 255;
    const rL = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    const gL = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    const bL = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
}

function contrastRatio(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
    const l1 = relativeLuminance(color1.r, color1.g, color1.b);
    const l2 = relativeLuminance(color2.r, color2.g, color2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

export function mostReadable(bgColor: string, colorList: string[]): string {
    const bg = getColorRGB(bgColor);
    let bestColor = colorList[0] || "#000000";
    let bestRatio = 0;
    for (const c of colorList) {
        const rgb = getColorRGB(c);
        const ratio = contrastRatio(bg, rgb);
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestColor = c;
        }
    }
    // Return as hex string
    const rgb = getColorRGB(bestColor);
    return rgbToHexString(rgb.r, rgb.g, rgb.b);
}
