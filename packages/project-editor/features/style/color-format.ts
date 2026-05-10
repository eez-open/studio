import {
    rgbToHsl,
    hsvToRgb,
    rgbToHsv,
    HTML_COLOR_NAMES,
    parseColorString
} from "eez-studio-shared/color";

import type {Project} from "project-editor/project/project";
import { getThemedColor } from "project-editor/features/style/theme";

////////////////////////////////////////////////////////////////////////////////

export enum ColorFormatType {
    HEX_HASH = "hex_hash", // #RRGGBB
    HEX_0X = "hex_0x", // 0xRRGGBB
    THEME_NAME = "theme_name", // color name from theme
    HTML_NAME = "html_name", // html color name
    DARKEN = "darken", // darken(c, level)
    LIGHTEN = "lighten", // lighten(c, level)
    RGB = "rgb", // rgb(r, g, b)
    RGBA = "rgba", // rgba(r, g, b, a)
    UNKNOWN = "unknown"
}

export type NumberFormat = "decimal" | "percent" | "hex";

////////////////////////////////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////////////////////////////////

// Parse a single color component value: decimal, percentage, or 0x hex
function parseComponentValue(s: string): {
    value: number;
    format: NumberFormat;
} | null {
    s = s.trim();
    if (s.endsWith("%")) {
        const num = parseFloat(s.slice(0, -1));
        if (isNaN(num)) return null;
        return { value: num, format: "percent" };
    }
    if (s.startsWith("0x") || s.startsWith("0X")) {
        const num = parseInt(s.slice(2), 16);
        if (isNaN(num)) return null;
        return { value: num, format: "hex" };
    }
    const num = parseFloat(s);
    if (isNaN(num)) return null;
    return { value: num, format: "decimal" };
}

// Format a level value (0-255 or 0-100%) for darken/lighten
function formatLevel(value: number, format: NumberFormat): string {
    switch (format) {
        case "decimal":
            return String(Math.round(Math.max(0, Math.min(255, value))));
        case "percent":
            return Math.round(Math.max(0, Math.min(100, value))) + "%";
        case "hex":
            return String(Math.round(Math.max(0, Math.min(255, value))));
    }
}

// Normalize a level to 0-1 fraction
function levelToFraction(value: number, format: NumberFormat): number {
    if (format === "percent") {
        return Math.max(0, Math.min(1, value / 100));
    }
    // decimal or hex: 0-255 range
    return Math.max(0, Math.min(1, value / 255));
}

// Split function arguments, handling nested parentheses
function splitFunctionArgs(argsStr: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of argsStr) {
        if (ch === "(") {
            depth++;
            current += ch;
        } else if (ch === ")") {
            depth--;
            current += ch;
        } else if ((ch === "," || ch === " ") && depth === 0) {
            if (current.trim()) {
                args.push(current.trim());
            }
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim()) {
        args.push(current.trim());
    }
    return args;
}

// Detect separator used in function arguments
function detectSeparator(argsStr: string): string {
    let depth = 0;
    for (const ch of argsStr) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === "," && depth === 0) return ", ";
    }
    return " ";
}

////////////////////////////////////////////////////////////////////////////////

export class ColorFormat {
    formatType: ColorFormatType = ColorFormatType.UNKNOWN;

    // Resolved RGB values (0-255)
    r: number = 0;
    g: number = 0;
    b: number = 0;

    // HEX_HASH / HEX_0X: case style
    hexUpperCase: boolean = true;

    // RGB/RGBA format details
    rgbSeparator: string = ", ";
    rFormat: NumberFormat = "decimal";
    gFormat: NumberFormat = "decimal";
    bFormat: NumberFormat = "decimal";
    aFormat: NumberFormat = "decimal";
    a: number = 1;

    // HSL format details
    hslSeparator: string = ", ";

    // THEME_NAME / HTML_NAME
    name: string = "";

    // DARKEN / LIGHTEN
    innerColor: ColorFormat | null = null;
    level: number = 0;
    levelFormat: NumberFormat = "decimal";
    darkenLightenSeparator: string = ", ";

    // The original raw string
    rawInput: string = "";

    ////////////////////////////////////////////////////////////////////////////
    // Parse
    ////////////////////////////////////////////////////////////////////////////

    static parse(input: string, project: Project, getThemedColorCallback?: (name: string) => string | undefined): ColorFormat {
        const cf = new ColorFormat();
        cf.rawInput = input;

        if (!input || typeof input !== "string") {
            cf.formatType = ColorFormatType.UNKNOWN;
            return cf;
        }

        input = input.trim();

        // 1) #RRGGBB or #RGB
        if (/^#?[0-9a-fA-F]{3,6}$/.test(input)) {
            cf.formatType = ColorFormatType.HEX_HASH;
            const hexPart = input.startsWith("#") ? input.slice(1) : input;
            cf.hexUpperCase = hexPart === hexPart.toUpperCase();
            const parsed = parseColorString(input)!;
            if (parsed) {
                cf.r = parsed.r;
                cf.g = parsed.g;
                cf.b = parsed.b;
            }
            return cf;
        }

        // 2) 0xRRGGBB
        if (/^0[xX][0-9a-fA-F]{6}$/.test(input)) {
            cf.formatType = ColorFormatType.HEX_0X;
            const hexPart = input.slice(2);
            cf.hexUpperCase = hexPart === hexPart.toUpperCase();
            const parsed = parseColorString(input)!;
            if (parsed) {
                cf.r = parsed.r;
                cf.g = parsed.g;
                cf.b = parsed.b;
            }
            return cf;
        }

        // 2.5) rgb(r, g, b) and rgba(r, g, b, a) for firmware mode
        if (project.projectTypeTraits?.isFirmware) {
            const rgbMatch = input.match(/^rgb\s*\(\s*(.*?)\s*\)$/i);
            if (rgbMatch) {
                return cf.parseRgb(rgbMatch[1], false);
            }

            const rgbaMatch = input.match(/^rgba\s*\(\s*(.*?)\s*\)$/i);
            if (rgbaMatch) {
                return cf.parseRgb(rgbaMatch[1], true);
            }
        }

        // 3) darken(c, level)
        const darkenMatch = input.match(/^darken\s*\(\s*(.*?)\s*\)$/i);
        if (darkenMatch) {
            return cf.parseDarkenLighten(
                "darken",
                darkenMatch[1],
                project,
                getThemedColorCallback
            );
        }

        // 4) lighten(c, level)
        const lightenMatch = input.match(/^lighten\s*\(\s*(.*?)\s*\)$/i);
        if (lightenMatch) {
            return cf.parseDarkenLighten(
                "lighten",
                lightenMatch[1],
                project,
                getThemedColorCallback
            );
        }

        // 5) Theme color name
        if (project.colors.find(color => color.name == input)) {
            cf.formatType = ColorFormatType.THEME_NAME;
            cf.name = input;
            
            let color;
            
            if (getThemedColorCallback) {
                color = getThemedColorCallback(input);
            } else {
                const themed = getThemedColor(
                    project._store,
                    input
                );
                if (themed.isFromTheme) {
                    color = themed.colorValue;
                }
            }

            if (color) {
                const parsed = parseColorString(color);
                if (parsed) {
                    cf.r = parsed.r;
                    cf.g = parsed.g;
                    cf.b = parsed.b;
                }
            }
            
            return cf;
        }

        // 6) HTML color name
        const htmlRgb = HTML_COLOR_NAMES[input.toLowerCase()];
        if (htmlRgb) {
            cf.formatType = ColorFormatType.HTML_NAME;
            cf.name = input;
            cf.r = htmlRgb[0];
            cf.g = htmlRgb[1];
            cf.b = htmlRgb[2];
            return cf;
        }

        cf.formatType = ColorFormatType.UNKNOWN;
        return cf;
    }

    static isValid(input: string, project: Project, getThemedColorCallback?: (name: string) => string | undefined) {
        const cf = ColorFormat.parse(input, project, getThemedColorCallback);
        return cf.isValid();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Internal helpers
    ////////////////////////////////////////////////////////////////////////////

    private parseDarkenLighten(
        type: "darken" | "lighten",
        argsStr: string,
        project: Project,
        getThemedColorCallback?: (name: string) => string | undefined
    ): ColorFormat {
        this.formatType =
            type === "darken"
                ? ColorFormatType.DARKEN
                : ColorFormatType.LIGHTEN;
        this.darkenLightenSeparator = detectSeparator(argsStr);

        // Split into color and level - the level is the last argument
        const args = splitFunctionArgs(argsStr);
        if (args.length < 2) {
            this.formatType = ColorFormatType.UNKNOWN;
            return this;
        }

        const levelStr = args[args.length - 1];
        const colorStr = args.slice(0, -1).join(" ");

        // Parse the level
        const levelParsed = parseComponentValue(levelStr);
        if (!levelParsed) {
            this.formatType = ColorFormatType.UNKNOWN;
            return this;
        }
        this.level = levelParsed.value;
        this.levelFormat = levelParsed.format;

        // Parse the inner color recursively
        this.innerColor = ColorFormat.parse(colorStr, project, getThemedColorCallback);

        // Compute the resolved RGB by applying darken/lighten
        const fraction = levelToFraction(this.level, this.levelFormat);
        const innerRgb = this.innerColor.getRgb();

        if (type === "darken") {
            this.r = Math.round(innerRgb.r * (1 - fraction));
            this.g = Math.round(innerRgb.g * (1 - fraction));
            this.b = Math.round(innerRgb.b * (1 - fraction));
        } else {
            this.r = Math.round(
                innerRgb.r + (255 - innerRgb.r) * fraction
            );
            this.g = Math.round(
                innerRgb.g + (255 - innerRgb.g) * fraction
            );
            this.b = Math.round(
                innerRgb.b + (255 - innerRgb.b) * fraction
            );
        }

        return this;
    }

    private parseRgb(argsStr: string, isRgba: boolean): ColorFormat {
        this.formatType = isRgba ? ColorFormatType.RGBA : ColorFormatType.RGB;
        this.rgbSeparator = detectSeparator(argsStr);

        const args = splitFunctionArgs(argsStr);
        const expectedArgs = isRgba ? 4 : 3;
        if (args.length !== expectedArgs) {
            this.formatType = ColorFormatType.UNKNOWN;
            return this;
        }

        // Parse r, g, b
        const rParsed = parseComponentValue(args[0]);
        const gParsed = parseComponentValue(args[1]);
        const bParsed = parseComponentValue(args[2]);

        if (!rParsed || !gParsed || !bParsed) {
            this.formatType = ColorFormatType.UNKNOWN;
            return this;
        }

        this.rFormat = rParsed.format;
        this.gFormat = gParsed.format;
        this.bFormat = bParsed.format;

        // Normalize to 0-255 range
        const rNormalized = this.rFormat === "percent" ? (rParsed.value / 100) * 255 : rParsed.value;
        const gNormalized = this.gFormat === "percent" ? (gParsed.value / 100) * 255 : gParsed.value;
        const bNormalized = this.bFormat === "percent" ? (bParsed.value / 100) * 255 : bParsed.value;

        if (isRgba) {
            // Parse alpha
            const aParsed = parseComponentValue(args[3]);
            if (!aParsed) {
                this.formatType = ColorFormatType.UNKNOWN;
                return this;
            }

            this.aFormat = aParsed.format;
            // Normalize alpha to 0-1 range
            const aNormalized = this.aFormat === "percent" ? aParsed.value / 100 : aParsed.value;
            this.a = Math.max(0, Math.min(1, aNormalized));

            // Convert rgba to rgb by blending with black (0, 0, 0)
            // result = foreground * alpha + background * (1 - alpha)
            // Since background is black (0, 0, 0): result = foreground * alpha
            this.r = Math.round(rNormalized * this.a);
            this.g = Math.round(gNormalized * this.a);
            this.b = Math.round(bNormalized * this.a);
        } else {
            this.a = 1;
            this.r = Math.round(Math.max(0, Math.min(255, rNormalized)));
            this.g = Math.round(Math.max(0, Math.min(255, gNormalized)));
            this.b = Math.round(Math.max(0, Math.min(255, bNormalized)));
        }

        return this;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Getters
    ////////////////////////////////////////////////////////////////////////////

    getRgb(): { r: number; g: number; b: number } {
        return { r: this.r, g: this.g, b: this.b };
    }

    getHexString(): string {
        const hex = [
            this.r.toString(16).padStart(2, "0"),
            this.g.toString(16).padStart(2, "0"),
            this.b.toString(16).padStart(2, "0")
        ].join("");
        return "#" + hex.toLowerCase();
    }

    getHexNumString(): string {
        const hex = [
            this.r.toString(16).padStart(2, "0"),
            this.g.toString(16).padStart(2, "0"),
            this.b.toString(16).padStart(2, "0")
        ].join("");
        return "0x" + hex.toLowerCase();
    }

    getHsl(): { h: number; s: number; l: number } {
        return rgbToHsl(this.r, this.g, this.b);
    }

    getHsv(): { h: number; s: number; v: number } {
        return rgbToHsv(this.r, this.g, this.b);
    }

    isValid(): boolean {
        return this.formatType !== ColorFormatType.UNKNOWN;
    }

    get isUsingThemeColor(): boolean {
        if (this.formatType == ColorFormatType.THEME_NAME) {
            return true;
        }

        if (this.innerColor) {
            return this.innerColor.isUsingThemeColor;
        }

        return false;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Setters
    ////////////////////////////////////////////////////////////////////////////

    setRgb(r: number, g: number, b: number): void {
        r = Math.round(Math.max(0, Math.min(255, r)));
        g = Math.round(Math.max(0, Math.min(255, g)));
        b = Math.round(Math.max(0, Math.min(255, b)));

        if (
            this.formatType === ColorFormatType.DARKEN ||
            this.formatType === ColorFormatType.LIGHTEN
        ) {
            if (this.innerColor) {
                const fraction = levelToFraction(
                    this.level,
                    this.levelFormat
                );
                let ir: number, ig: number, ib: number;

                if (this.formatType === ColorFormatType.DARKEN) {
                    const divisor = 1 - fraction;
                    if (divisor <= 0) {
                        ir = ig = ib = 0;
                    } else {
                        ir = Math.min(255, Math.round(r / divisor));
                        ig = Math.min(255, Math.round(g / divisor));
                        ib = Math.min(255, Math.round(b / divisor));
                    }
                } else {
                    const divisor = 1 - fraction;
                    if (divisor <= 0) {
                        ir = ig = ib = 255;
                    } else {
                        ir = Math.max(
                            0,
                            Math.min(
                                255,
                                Math.round(
                                    (r - 255 * fraction) / divisor
                                )
                            )
                        );
                        ig = Math.max(
                            0,
                            Math.min(
                                255,
                                Math.round(
                                    (g - 255 * fraction) / divisor
                                )
                            )
                        );
                        ib = Math.max(
                            0,
                            Math.min(
                                255,
                                Math.round(
                                    (b - 255 * fraction) / divisor
                                )
                            )
                        );
                    }
                }
                this.innerColor.setRgb(ir, ig, ib);

                // Recompute the actual resolved color after inner update
                const innerRgb = this.innerColor.getRgb();
                if (this.formatType === ColorFormatType.DARKEN) {
                    this.r = Math.round(innerRgb.r * (1 - fraction));
                    this.g = Math.round(innerRgb.g * (1 - fraction));
                    this.b = Math.round(innerRgb.b * (1 - fraction));
                } else {
                    this.r = Math.round(
                        innerRgb.r + (255 - innerRgb.r) * fraction
                    );
                    this.g = Math.round(
                        innerRgb.g + (255 - innerRgb.g) * fraction
                    );
                    this.b = Math.round(
                        innerRgb.b + (255 - innerRgb.b) * fraction
                    );
                }
            }
        } else {
            this.r = r;
            this.g = g;
            this.b = b;
        }
    }

    setFromHsv(h: number, s: number, v: number): void {
        const rgb = hsvToRgb(h, s, v);
        this.setRgb(rgb.r, rgb.g, rgb.b);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Serialization
    ////////////////////////////////////////////////////////////////////////////

    toString(): string {
        switch (this.formatType) {
            case ColorFormatType.HEX_HASH:
                return this.toHexHash();

            case ColorFormatType.HEX_0X:
                return this.toHex0x();

            case ColorFormatType.THEME_NAME:
                return this.name;

            case ColorFormatType.HTML_NAME:
                return this.name;

            case ColorFormatType.DARKEN:
                return this.toDarkenLightenString("darken");

            case ColorFormatType.LIGHTEN:
                return this.toDarkenLightenString("lighten");

            case ColorFormatType.RGB:
                return this.toRgbString();

            case ColorFormatType.RGBA:
                return this.toRgbaString();

            default:
                return this.toHexHash();
        }
    }

    private toHexHash(): string {
        const hex = [
            this.r.toString(16).padStart(2, "0"),
            this.g.toString(16).padStart(2, "0"),
            this.b.toString(16).padStart(2, "0")
        ].join("");
        return (
            "#" +
            (this.hexUpperCase ? hex.toUpperCase() : hex.toLowerCase())
        );
    }

    private toHex0x(): string {
        const hex = [
            this.r.toString(16).padStart(2, "0"),
            this.g.toString(16).padStart(2, "0"),
            this.b.toString(16).padStart(2, "0")
        ].join("");
        return (
            "0x" +
            (this.hexUpperCase ? hex.toUpperCase() : hex.toLowerCase())
        );
    }

    private toDarkenLightenString(fn: "darken" | "lighten"): string {
        if (!this.innerColor) {
            return this.toHexHash();
        }
        const colorStr = this.innerColor.toString();
        const levelStr = formatLevel(this.level, this.levelFormat);
        return `${fn}(${colorStr}${this.darkenLightenSeparator}${levelStr})`;
    }

    private toRgbString(): string {
        const rStr = this.formatComponentValue(this.r, this.rFormat);
        const gStr = this.formatComponentValue(this.g, this.gFormat);
        const bStr = this.formatComponentValue(this.b, this.bFormat);
        return `rgb(${rStr}${this.rgbSeparator}${gStr}${this.rgbSeparator}${bStr})`;
    }

    private toRgbaString(): string {
        const rStr = this.formatComponentValue(this.r, this.rFormat);
        const gStr = this.formatComponentValue(this.g, this.gFormat);
        const bStr = this.formatComponentValue(this.b, this.bFormat);
        const aStr = this.formatAlphaValue(this.a, this.aFormat);
        return `rgba(${rStr}${this.rgbSeparator}${gStr}${this.rgbSeparator}${bStr}${this.rgbSeparator}${aStr})`;
    }

    private formatComponentValue(value: number, format: NumberFormat): string {
        switch (format) {
            case "percent":
                return Math.round((value / 255) * 100) + "%";
            case "hex":
                return "0x" + value.toString(16).padStart(2, "0");
            case "decimal":
            default:
                return String(Math.round(value));
        }
    }

    private formatAlphaValue(alpha: number, format: NumberFormat): string {
        switch (format) {
            case "percent":
                return Math.round(alpha * 100) + "%";
            case "hex":
                return "0x" + Math.round(alpha * 255).toString(16).padStart(2, "0");
            case "decimal":
            default:
                return alpha.toFixed(2);
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Clone
    ////////////////////////////////////////////////////////////////////////////

    clone(): ColorFormat {
        const cf = new ColorFormat();
        cf.formatType = this.formatType;
        cf.r = this.r;
        cf.g = this.g;
        cf.b = this.b;
        cf.hexUpperCase = this.hexUpperCase;
        cf.rgbSeparator = this.rgbSeparator;
        cf.rFormat = this.rFormat;
        cf.gFormat = this.gFormat;
        cf.bFormat = this.bFormat;
        cf.aFormat = this.aFormat;
        cf.a = this.a;
        cf.hslSeparator = this.hslSeparator;
        cf.name = this.name;
        cf.innerColor = this.innerColor ? this.innerColor.clone() : null;
        cf.level = this.level;
        cf.levelFormat = this.levelFormat;
        cf.darkenLightenSeparator = this.darkenLightenSeparator;
        cf.rawInput = this.rawInput;
        return cf;
    }
}
