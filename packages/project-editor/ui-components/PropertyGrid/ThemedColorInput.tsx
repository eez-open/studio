import React from "react";
import ReactDOM from "react-dom";
import { observer } from "mobx-react";
import { action, observable, makeObservable, runInAction } from "mobx";

import { closest } from "eez-studio-shared/dom";
import {
    isDark,
    isLight,
    parseColorString,
    rgbToHexString,
    hsvToRgb,
    rgbToHsv,
    rgbToHsl,
    hslToRgb,
    HTML_COLOR_NAMES
} from "eez-studio-shared/color";

function colorStringToHex(color: string): string {
    const parsed = parseColorString(color);
    if (!parsed) return "#000000";
    return rgbToHexString(parsed.r, parsed.g, parsed.b);
}

import { settingsController } from "home/settings";

import { getProperty } from "project-editor/core/object";
import { getEezStudioDataFromDragEvent } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { getThemedColor } from "project-editor/features/style/theme";
import { ColorFormat, ColorFormatType } from "project-editor/features/style/color-format";

////////////////////////////////////////////////////////////////////////////////

type ColorInputMode = "hex" | "rgb" | "hsl" | "name" | "theme";
type AdjustMode = "none" | "lighten" | "darken";
type AdjustFormat = "percent" | "decimal";

const COLOR_PICKER_WIDTH = 230;
const SV_PICKER_HEIGHT = 150;
const HUE_BAR_HEIGHT = 12;
const PICKER_PADDING = 10;

const ColorPicker = observer(
    class ColorPicker extends React.Component<{
        colorFormat: ColorFormat;
        onChange: (colorFormat: ColorFormat) => void;
        themeColors: Array<{name: string, colorValue: string}>;
    }> {
        svCanvasRef = React.createRef<HTMLCanvasElement>();
        hueCanvasRef = React.createRef<HTMLCanvasElement>();
        draggingSV = false;
        draggingHue = false;
        _inputMode: ColorInputMode | undefined;

        // Internal HSV state
        hue = 0;
        sat = 1;
        val = 1;
        hexInputValue = "";
        hexInputFocused = false;

        // Lighten/Darken state
        adjustMode: AdjustMode = "none";
        adjustLevel: number = 25;
        adjustFormat: AdjustFormat = "percent";

        constructor(props: any) {
            super(props);
            makeObservable(this, {
                _inputMode: observable,
                hue: observable,
                sat: observable,
                val: observable,
                hexInputValue: observable,
                hexInputFocused: observable,
                adjustMode: observable,
                adjustLevel: observable,
                adjustFormat: observable
            });
            this.setFromColorFormat(this.props.colorFormat);
        }

        get inputMode() {
            if (this._inputMode == undefined) {
                let formatType = this.props.colorFormat.innerColor
                    ? this.props.colorFormat.innerColor.formatType
                    : this.props.colorFormat.formatType;

                let inputMode: ColorInputMode;

                if (
                    formatType == ColorFormatType.HEX_0X ||
                    formatType == ColorFormatType.HEX_HASH
                ) {
                    inputMode = "hex";
                } else if (formatType == ColorFormatType.HTML_NAME) {
                    inputMode = "name";
                } else if (formatType == ColorFormatType.THEME_NAME) {
                    inputMode = "theme";
                } else {
                    inputMode = "hex";
                }

                return inputMode;
            }

            return this._inputMode;
        }

        set inputMode(value: ColorInputMode) {
            this._inputMode = value;
        }

        componentDidMount() {
            this.drawSV();
            this.drawHue();
        }

        componentDidUpdate() {
            this.drawSV();
            this.drawHue();
        }

        setFromColorFormat(cf: ColorFormat) {
            if (
                cf.formatType === ColorFormatType.DARKEN ||
                cf.formatType === ColorFormatType.LIGHTEN
            ) {
                this.adjustMode =
                    cf.formatType === ColorFormatType.DARKEN
                        ? "darken"
                        : "lighten";
                this.adjustLevel = cf.level;
                this.adjustFormat =
                    cf.levelFormat === "percent" ? "percent" : "decimal";
                // Set HSV from the inner (unwrapped) color
                if (cf.innerColor) {
                    const hsv = cf.innerColor.getHsv();
                    this.hue = hsv.h;
                    this.sat = hsv.s;
                    this.val = hsv.v;
                }
            } else {
                this.adjustMode = "none";
                const hsv = cf.getHsv();
                this.hue = hsv.h;
                this.sat = hsv.s;
                this.val = hsv.v;
            }
        }

        // Returns the base (inner) color hex, ignoring lighten/darken
        getBaseHexColor(): string {
            const rgb = hsvToRgb(this.hue, this.sat, this.val);
            return rgbToHexString(rgb.r, rgb.g, rgb.b);
        }

        // Returns the final color hex, with lighten/darken applied
        getHexColor(): string {
            const rgb = hsvToRgb(this.hue, this.sat, this.val);
            if (this.adjustMode !== "none") {
                const fraction =
                    this.adjustFormat === "percent"
                        ? Math.max(0, Math.min(1, this.adjustLevel / 100))
                        : Math.max(0, Math.min(1, this.adjustLevel / 255));
                let r: number, g: number, b: number;
                if (this.adjustMode === "darken") {
                    r = Math.round(rgb.r * (1 - fraction));
                    g = Math.round(rgb.g * (1 - fraction));
                    b = Math.round(rgb.b * (1 - fraction));
                } else {
                    r = Math.round(rgb.r + (255 - rgb.r) * fraction);
                    g = Math.round(rgb.g + (255 - rgb.g) * fraction);
                    b = Math.round(rgb.b + (255 - rgb.b) * fraction);
                }
                return rgbToHexString(r, g, b);
            }
            return rgbToHexString(rgb.r, rgb.g, rgb.b);
        }

        changeColorFormatType(cf: ColorFormat) {
            if (this.inputMode == "hex" || this.inputMode == "rgb" || this.inputMode == "hsl") {
                if (cf.formatType != ColorFormatType.HEX_0X && cf.formatType != ColorFormatType.HEX_HASH) {
                    cf.formatType = ColorFormatType.HEX_HASH;
                }
            }
        }

        emitChange = () => {
            if (this.adjustMode !== "none") {
                // Build the inner color format from the current HSV
                let innerCf: ColorFormat;
                const origFormat = this.props.colorFormat;
                if (
                    (origFormat.formatType === ColorFormatType.DARKEN ||
                        origFormat.formatType === ColorFormatType.LIGHTEN) &&
                    origFormat.innerColor
                ) {
                    innerCf = origFormat.innerColor.clone();
                } else {
                    innerCf = origFormat.clone();
                }
                innerCf.setFromHsv(this.hue, this.sat, this.val);
                this.changeColorFormatType(innerCf);

                // Create wrapper format
                const cf = new ColorFormat();
                cf.formatType =
                    this.adjustMode === "darken"
                        ? ColorFormatType.DARKEN
                        : ColorFormatType.LIGHTEN;
                cf.innerColor = innerCf;
                cf.level = this.adjustLevel;
                cf.levelFormat =
                    this.adjustFormat === "percent" ? "percent" : "decimal";
                cf.darkenLightenSeparator = ", ";

                // Compute resolved RGB
                const fraction =
                    this.adjustFormat === "percent"
                        ? Math.max(0, Math.min(1, this.adjustLevel / 100))
                        : Math.max(0, Math.min(1, this.adjustLevel / 255));
                const innerRgb = innerCf.getRgb();
                if (this.adjustMode === "darken") {
                    cf.r = Math.round(innerRgb.r * (1 - fraction));
                    cf.g = Math.round(innerRgb.g * (1 - fraction));
                    cf.b = Math.round(innerRgb.b * (1 - fraction));
                } else {
                    cf.r = Math.round(
                        innerRgb.r + (255 - innerRgb.r) * fraction
                    );
                    cf.g = Math.round(
                        innerRgb.g + (255 - innerRgb.g) * fraction
                    );
                    cf.b = Math.round(
                        innerRgb.b + (255 - innerRgb.b) * fraction
                    );
                }

                this.props.onChange(cf);
            } else {
                const cf = this.props.colorFormat.clone();
                // If the original was darken/lighten but user turned it off,
                // unwrap to a plain color
                if (
                    cf.formatType === ColorFormatType.DARKEN ||
                    cf.formatType === ColorFormatType.LIGHTEN
                ) {
                    if (cf.innerColor) {
                        const unwrapped = cf.innerColor.clone();
                        unwrapped.setFromHsv(this.hue, this.sat, this.val);
                        this.changeColorFormatType(unwrapped);
                        this.props.onChange(unwrapped);
                        return;
                    }
                }
                cf.setFromHsv(this.hue, this.sat, this.val);
                this.changeColorFormatType(cf);
                this.props.onChange(cf);
            }
        };

        drawSV() {
            const canvas = this.svCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d")!;
            const w = canvas.width;
            const h = canvas.height;

            ctx.fillStyle = `hsl(${this.hue}, 100%, 50%)`;
            ctx.fillRect(0, 0, w, h);

            const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
            whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
            whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = whiteGrad;
            ctx.fillRect(0, 0, w, h);

            const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
            blackGrad.addColorStop(0, "rgba(0,0,0,0)");
            blackGrad.addColorStop(1, "rgba(0,0,0,1)");
            ctx.fillStyle = blackGrad;
            ctx.fillRect(0, 0, w, h);
        }

        drawHue() {
            const canvas = this.hueCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d")!;
            const w = canvas.width;
            const h = canvas.height;

            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, "#ff0000");
            grad.addColorStop(1 / 6, "#ffff00");
            grad.addColorStop(2 / 6, "#00ff00");
            grad.addColorStop(3 / 6, "#00ffff");
            grad.addColorStop(4 / 6, "#0000ff");
            grad.addColorStop(5 / 6, "#ff00ff");
            grad.addColorStop(1, "#ff0000");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        // SV picking
        onSVPointerDown = (e: React.PointerEvent) => {
            this.draggingSV = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            this.updateSV(e);
        };

        onSVPointerMove = (e: React.PointerEvent) => {
            if (!this.draggingSV) return;
            this.updateSV(e);
        };

        onSVPointerUp = (_e: React.PointerEvent) => {
            this.draggingSV = false;
        };

        updateSV = action((e: React.PointerEvent) => {
            const canvas = this.svCanvasRef.current!;
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            this.sat = x / rect.width;
            this.val = 1 - y / rect.height;
            if (this.inputMode == "name" || this.inputMode == "theme") {
                this.inputMode = "hex";
            }
            this.emitChange();
        });

        // Hue picking
        onHuePointerDown = (e: React.PointerEvent) => {
            this.draggingHue = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            this.updateHue(e);
        };

        onHuePointerMove = (e: React.PointerEvent) => {
            if (!this.draggingHue) return;
            this.updateHue(e);
        };

        onHuePointerUp = (_e: React.PointerEvent) => {
            this.draggingHue = false;
        };

        updateHue = action((e: React.PointerEvent) => {
            const canvas = this.hueCanvasRef.current!;
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            this.hue = (x / rect.width) * 360;
            if (this.inputMode == "name" || this.inputMode == "theme") {
                this.inputMode = "hex";
            }
            this.emitChange();
        });

        onEyeDropper = async () => {
            try {
                const eyeDropper = new (window as any).EyeDropper();
                const result = await eyeDropper.open();
                if (result && result.sRGBHex) {
                    runInAction(() => {
                        const parsed = parseColorString(result.sRGBHex);
                        if (parsed) {
                            const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
                            this.hue = hsv.h;
                            this.sat = hsv.s;
                            this.val = hsv.v;
                            if (this.inputMode == "name" || this.inputMode == "theme") {
                                this.inputMode = "hex";
                            }
                            this.emitChange();
                        }
                    });
                }
            } catch {
                // User cancelled or API not available
            }
        };

        onHexChange = action((e: React.ChangeEvent<HTMLInputElement>) => {
            this.hexInputValue = e.target.value;
            const parsed = parseColorString(this.hexInputValue);
            if (parsed) {
                const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
                this.hue = hsv.h;
                this.sat = hsv.s;
                this.val = hsv.v;
                this.emitChange();
            }
        });

        onHexFocus = action(() => {
            this.hexInputValue = this.getBaseHexColor();
            this.hexInputFocused = true;
        });

        onHexBlur = action(() => {
            this.hexInputFocused = false;
        });

        onRGBChange = action((channel: "r" | "g" | "b", value: string) => {
            const rgb = hsvToRgb(this.hue, this.sat, this.val);
            const num = parseInt(value, 10);
            if (isNaN(num)) return;
            rgb[channel] = Math.max(0, Math.min(255, num));
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            this.hue = hsv.h;
            this.sat = hsv.s;
            this.val = hsv.v;
            this.emitChange();
        });

        onHSLChange = action((channel: "h" | "s" | "l", value: string) => {
            const rgb = hsvToRgb(this.hue, this.sat, this.val);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const num = parseFloat(value);
            if (isNaN(num)) return;
            if (channel === "h") {
                hsl.h = Math.max(0, Math.min(360, num));
            } else if (channel === "s") {
                hsl.s = Math.max(0, Math.min(100, num)) / 100;
            } else {
                hsl.l = Math.max(0, Math.min(100, num)) / 100;
            }
            const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
            const hsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
            this.hue = hsv.h;
            this.sat = hsv.s;
            this.val = hsv.v;
            this.emitChange();
        });

        cycleMode = action(() => {
            const hasThemeColors = this.props.themeColors.length > 0;
            if (this.inputMode === "hex") this.inputMode = "rgb";
            else if (this.inputMode === "rgb") this.inputMode = "hsl";
            else if (this.inputMode === "hsl") this.inputMode = "name";
            else if (this.inputMode === "name") {
                this.inputMode = hasThemeColors ? "theme" : "hex";
            } else {
                this.inputMode = "hex";
            }
        });

        setAdjustMode = action((mode: AdjustMode) => {
            this.adjustMode = mode;
            this.emitChange();
        });

        onAdjustLevelChange = action((value: string) => {
            const num = parseFloat(value);
            if (isNaN(num)) return;
            const max = this.adjustFormat === "percent" ? 100 : 255;
            this.adjustLevel = Math.max(0, Math.min(max, num));
            this.emitChange();
        });

        toggleAdjustFormat = action(() => {
            if (this.adjustFormat === "percent") {
                // Convert percentage to 0-255
                this.adjustFormat = "decimal";
                this.adjustLevel = Math.round((this.adjustLevel / 100) * 255);
            } else {
                // Convert 0-255 to percentage
                this.adjustFormat = "percent";
                this.adjustLevel = Math.round((this.adjustLevel / 255) * 100);
            }
            this.emitChange();
        });

        selectColorName = action((name: string, type: "html" | "theme") => {
            const innerCf = new ColorFormat();
            if (type === "html") {
                innerCf.formatType = ColorFormatType.HTML_NAME;
                innerCf.name = name;
                const htmlRgb = HTML_COLOR_NAMES[name.toLowerCase()];
                if (htmlRgb) {
                    innerCf.r = htmlRgb[0];
                    innerCf.g = htmlRgb[1];
                    innerCf.b = htmlRgb[2];
                }
            } else {
                innerCf.formatType = ColorFormatType.THEME_NAME;
                innerCf.name = name;
                const tc = this.props.themeColors.find(c => c.name === name);
                if (tc) {
                    const parsed = parseColorString(tc.colorValue);
                    if (parsed) {
                        innerCf.r = parsed.r;
                        innerCf.g = parsed.g;
                        innerCf.b = parsed.b;
                    }
                }

            }
            const hsv = innerCf.getHsv();
            this.hue = hsv.h;
            this.sat = hsv.s;
            this.val = hsv.v;

            if (this.adjustMode !== "none") {
                // Wrap the selected name in lighten/darken
                const cf = new ColorFormat();
                cf.formatType =
                    this.adjustMode === "darken"
                        ? ColorFormatType.DARKEN
                        : ColorFormatType.LIGHTEN;
                cf.innerColor = innerCf;
                cf.level = this.adjustLevel;
                cf.levelFormat =
                    this.adjustFormat === "percent" ? "percent" : "decimal";
                cf.darkenLightenSeparator = ", ";

                const fraction =
                    this.adjustFormat === "percent"
                        ? Math.max(0, Math.min(1, this.adjustLevel / 100))
                        : Math.max(0, Math.min(1, this.adjustLevel / 255));
                const innerRgb = innerCf.getRgb();
                if (this.adjustMode === "darken") {
                    cf.r = Math.round(innerRgb.r * (1 - fraction));
                    cf.g = Math.round(innerRgb.g * (1 - fraction));
                    cf.b = Math.round(innerRgb.b * (1 - fraction));
                } else {
                    cf.r = Math.round(
                        innerRgb.r + (255 - innerRgb.r) * fraction
                    );
                    cf.g = Math.round(
                        innerRgb.g + (255 - innerRgb.g) * fraction
                    );
                    cf.b = Math.round(
                        innerRgb.b + (255 - innerRgb.b) * fraction
                    );
                }
                this.props.onChange(cf);
            } else {
                this.props.onChange(innerCf);
            }
        });

        renderInputFields() {
            const hex = this.getBaseHexColor();
            const rgb = hsvToRgb(this.hue, this.sat, this.val);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

            const inputStyle: React.CSSProperties = {
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #ddd",
                borderRadius: 3,
                textAlign: "center",
                fontSize: 11,
                padding: "3px 4px",
                outline: "none",
                color: "#333",
                backgroundColor: "#fff"
            };

            const labelStyle: React.CSSProperties = {
                fontSize: 11,
                color: "#999",
                textAlign: "center",
                marginTop: 2,
                userSelect: "none"
            };

            const fieldContainerStyle: React.CSSProperties = {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flex: 1,
                minWidth: 0
            };

            if (this.inputMode === "hex") {
                return (
                    <div
                        style={{
                            display: "flex",
                            gap: 4,
                            alignItems: "flex-start"
                        }}
                    >
                        <div style={fieldContainerStyle}>
                            <input
                                style={inputStyle}
                                value={
                                    this.hexInputFocused
                                        ? this.hexInputValue
                                        : hex
                                }
                                onChange={this.onHexChange}
                                onFocus={this.onHexFocus}
                                onBlur={this.onHexBlur}
                                spellCheck={false}
                            />
                            <div style={labelStyle}>HEX</div>
                        </div>
                    </div>
                );
            }

            if (this.inputMode === "rgb") {
                return (
                    <div
                        style={{
                            display: "flex",
                            gap: 4,
                            alignItems: "flex-start"
                        }}
                    >
                        {(["r", "g", "b"] as const).map(ch => (
                            <div key={ch} style={fieldContainerStyle}>
                                <input
                                    style={inputStyle}
                                    value={rgb[ch]}
                                    onChange={e =>
                                        this.onRGBChange(ch, e.target.value)
                                    }
                                />
                                <div style={labelStyle}>{ch.toUpperCase()}</div>
                            </div>
                        ))}
                    </div>
                );
            }

            if (this.inputMode === "hsl") {
                return (
                    <div
                        style={{
                            display: "flex",
                            gap: 4,
                            alignItems: "flex-start"
                        }}
                    >
                        <div style={fieldContainerStyle}>
                            <input
                                style={inputStyle}
                                value={Math.round(hsl.h)}
                                onChange={e =>
                                    this.onHSLChange("h", e.target.value)
                                }
                            />
                            <div style={labelStyle}>H</div>
                        </div>
                        <div style={fieldContainerStyle}>
                            <input
                                style={inputStyle}
                                value={Math.round(hsl.s * 100)}
                                onChange={e =>
                                    this.onHSLChange("s", e.target.value)
                                }
                            />
                            <div style={labelStyle}>S</div>
                        </div>
                        <div style={fieldContainerStyle}>
                            <input
                                style={inputStyle}
                                value={Math.round(hsl.l * 100)}
                                onChange={e =>
                                    this.onHSLChange("l", e.target.value)
                                }
                            />
                            <div style={labelStyle}>L</div>
                        </div>
                    </div>
                );
            }

            // Name or Theme mode
            const isThemeMode = this.inputMode === "theme";
            const colorNames = isThemeMode
                ? this.props.themeColors.map(c => c.name)
                : Object.keys(HTML_COLOR_NAMES);

            // Determine currently selected name from the color format
            const cf = this.props.colorFormat;
            const innerCf =
                (cf.formatType === ColorFormatType.DARKEN ||
                    cf.formatType === ColorFormatType.LIGHTEN) &&
                cf.innerColor
                    ? cf.innerColor
                    : cf;
            const selectedName =
                (isThemeMode &&
                    innerCf.formatType === ColorFormatType.THEME_NAME) ||
                (!isThemeMode &&
                    innerCf.formatType === ColorFormatType.HTML_NAME)
                    ? innerCf.name
                    : "";

            return (
                <div style={fieldContainerStyle}>
                    <select
                        style={{
                            ...inputStyle,
                            textAlign: "left",
                            cursor: "pointer"
                        }}
                        value={selectedName}
                        onChange={e =>
                            this.selectColorName(
                                e.target.value,
                                isThemeMode ? "theme" : "html"
                            )
                        }
                    >
                        {!selectedName && (
                            <option value="" disabled>
                                {isThemeMode
                                    ? "Select theme color..."
                                    : "Select color name..."}
                            </option>
                        )}
                        {colorNames.map(name => {
                            let optionBg: string | undefined;
                            let optionFg = "#000";

                            if (isThemeMode) {
                                const tc = this.props.themeColors.find(c => c.name === name);
                                if (tc) {
                                    const parsed = parseColorString(tc.colorValue);
                                    if (parsed) {
                                        optionBg = rgbToHexString(parsed.r, parsed.g, parsed.b);
                                        optionFg = (parsed.r * 299 + parsed.g * 587 + parsed.b * 114) / 1000 < 128 ? "#fff" : "#000";
                                    }
                                }
                            } else {
                                const htmlRgb = HTML_COLOR_NAMES[name];
                                if (htmlRgb) {
                                    optionBg = rgbToHexString(htmlRgb[0], htmlRgb[1], htmlRgb[2]);
                                    optionFg = (htmlRgb[0] * 299 + htmlRgb[1] * 587 + htmlRgb[2] * 114) / 1000 < 128 ? "#fff" : "#000";
                                }
                            }

                            return (
                                <option
                                    key={name}
                                    value={name}
                                    style={
                                        optionBg
                                            ? {
                                                  backgroundColor: optionBg,
                                                  color: optionFg
                                              }
                                            : undefined
                                    }
                                >
                                    {name}
                                </option>
                            );
                        })}
                    </select>
                    <div style={labelStyle}>
                        {isThemeMode ? "THEME COLOR" : "COLOR BY NAME"}
                    </div>
                </div>
            );
        }

        render() {
            const svWidth = COLOR_PICKER_WIDTH;
            const hueWidth = COLOR_PICKER_WIDTH - PICKER_PADDING * 2;
            const hex = this.getHexColor();

            // SV cursor position
            const svCursorX = this.sat * svWidth;
            const svCursorY = (1 - this.val) * SV_PICKER_HEIGHT;

            const hasEyeDropper =
                typeof (window as any).EyeDropper === "function";

            return (
                <div
                    style={{
                        width: COLOR_PICKER_WIDTH,
                        background: "#fff",
                        borderRadius: 4,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                        overflow: "hidden",
                        userSelect: "none"
                    }}
                >
                    {/* Saturation/Value area */}
                    <div
                        style={{
                            position: "relative",
                            cursor: "crosshair"
                        }}
                        onPointerDown={this.onSVPointerDown}
                        onPointerMove={this.onSVPointerMove}
                        onPointerUp={this.onSVPointerUp}
                    >
                        <canvas
                            ref={this.svCanvasRef}
                            width={COLOR_PICKER_WIDTH}
                            height={SV_PICKER_HEIGHT}
                            style={{
                                display: "block",
                                width: COLOR_PICKER_WIDTH,
                                height: SV_PICKER_HEIGHT
                            }}
                        />
                        {/* SV cursor */}
                        <div
                            style={{
                                position: "absolute",
                                left: svCursorX - 6,
                                top: svCursorY - 6,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                border: "2px solid #fff",
                                boxShadow:
                                    "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.3)",
                                pointerEvents: "none"
                            }}
                        />
                    </div>

                    <div style={{ padding: PICKER_PADDING }}>
                        {/* Color preview + hue bar row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 10
                            }}
                        >
                            {/* Eyedropper button */}
                            {hasEyeDropper && (
                                <button
                                    onClick={this.onEyeDropper}
                                    style={{
                                        width: 24,
                                        height: 24,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#fff",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: 0,
                                        fontSize: 14
                                    }}
                                    title="Pick color from screen"
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#333"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M2 22l1-1h3l9-9" />
                                        <path d="M3 21v-3l9-9" />
                                        <path d="M14.5 5.5l4 4" />
                                        <path d="M18.5 1.5a2.121 2.121 0 0 1 3 3L16 10l-4-4 5.5-5.5z" />
                                    </svg>
                                </button>
                            )}

                            {/* Color preview circle */}
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    backgroundColor: hex,
                                    border: "1px solid rgba(0,0,0,0.15)",
                                    flexShrink: 0
                                }}
                            />

                            {/* Hue bar */}
                            <div
                                style={{
                                    flex: 1,
                                    position: "relative",
                                    cursor: "pointer"
                                }}
                                onPointerDown={this.onHuePointerDown}
                                onPointerMove={this.onHuePointerMove}
                                onPointerUp={this.onHuePointerUp}
                            >
                                <canvas
                                    ref={this.hueCanvasRef}
                                    width={hueWidth}
                                    height={HUE_BAR_HEIGHT}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        height: HUE_BAR_HEIGHT,
                                        borderRadius: HUE_BAR_HEIGHT / 2
                                    }}
                                />
                                {/* Hue cursor */}
                                <div
                                    style={{
                                        position: "absolute",
                                        left: `calc(${(this.hue / 360) * 100}% - 6px)`,
                                        top: -2,
                                        width: 12,
                                        height: HUE_BAR_HEIGHT + 4,
                                        borderRadius: 3,
                                        border: "2px solid #fff",
                                        boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                                        pointerEvents: "none",
                                        backgroundColor: `hsl(${this.hue}, 100%, 50%)`
                                    }}
                                />
                            </div>
                        </div>

                        {/* Input fields + mode toggle */}
                        <div
                            style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "flex-start"
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                {this.renderInputFields()}
                            </div>
                            <button
                                onClick={this.cycleMode}
                                style={{
                                    width: 24,
                                    height: 24,
                                    border: "1px solid #ddd",
                                    borderRadius: 4,
                                    background: "#fff",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 0,
                                    fontSize: 10,
                                    color: "#666",
                                    flexShrink: 0,
                                    marginTop: 0
                                }}
                                title="Switch input mode"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#666"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="17 1 21 5 17 9" />
                                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                    <polyline points="7 23 3 19 7 15" />
                                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                </svg>
                            </button>
                        </div>

                        {/* Lighten / Darken controls */}
                        <div
                            style={{
                                marginTop: 8,
                                borderTop: "1px solid #eee",
                                paddingTop: 8
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    gap: 4,
                                    marginBottom:
                                        this.adjustMode !== "none" ? 6 : 0
                                }}
                            >
                                <button
                                    onClick={() =>
                                        this.setAdjustMode(
                                            this.adjustMode === "lighten"
                                                ? "none"
                                                : "lighten"
                                        )
                                    }
                                    style={{
                                        flex: 1,
                                        height: 22,
                                        border: "1px solid #ddd",
                                        borderRadius: 3,
                                        background:
                                            this.adjustMode === "lighten"
                                                ? "#e8f0fe"
                                                : "#fff",
                                        cursor: "pointer",
                                        fontSize: 10,
                                        color:
                                            this.adjustMode === "lighten"
                                                ? "#1a73e8"
                                                : "#666",
                                        fontWeight:
                                            this.adjustMode === "lighten"
                                                ? 600
                                                : 400,
                                        padding: 0
                                    }}
                                    title="Lighten color"
                                >
                                    Lighten
                                </button>
                                <button
                                    onClick={() =>
                                        this.setAdjustMode(
                                            this.adjustMode === "darken"
                                                ? "none"
                                                : "darken"
                                        )
                                    }
                                    style={{
                                        flex: 1,
                                        height: 22,
                                        border: "1px solid #ddd",
                                        borderRadius: 3,
                                        background:
                                            this.adjustMode === "darken"
                                                ? "#e8f0fe"
                                                : "#fff",
                                        cursor: "pointer",
                                        fontSize: 10,
                                        color:
                                            this.adjustMode === "darken"
                                                ? "#1a73e8"
                                                : "#666",
                                        fontWeight:
                                            this.adjustMode === "darken"
                                                ? 600
                                                : 400,
                                        padding: 0
                                    }}
                                    title="Darken color"
                                >
                                    Darken
                                </button>
                            </div>

                            {this.adjustMode !== "none" && (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 4,
                                        alignItems: "center"
                                    }}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={
                                            this.adjustFormat === "percent"
                                                ? 100
                                                : 255
                                        }
                                        value={this.adjustLevel}
                                        onChange={e =>
                                            this.onAdjustLevelChange(
                                                e.target.value
                                            )
                                        }
                                        style={{
                                            flex: 1,
                                            height: 4,
                                            cursor: "pointer"
                                        }}
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        max={
                                            this.adjustFormat === "percent"
                                                ? 100
                                                : 255
                                        }
                                        value={this.adjustLevel}
                                        onChange={e =>
                                            this.onAdjustLevelChange(
                                                e.target.value
                                            )
                                        }
                                        style={{
                                            width: 42,
                                            border: "1px solid #ddd",
                                            borderRadius: 3,
                                            textAlign: "center",
                                            fontSize: 11,
                                            padding: "2px 2px",
                                            outline: "none",
                                            color: "#333",
                                            backgroundColor: "#fff"
                                        }}
                                    />
                                    <button
                                        onClick={this.toggleAdjustFormat}
                                        style={{
                                            width: 24,
                                            height: 22,
                                            border: "1px solid #ddd",
                                            borderRadius: 3,
                                            background: "#fff",
                                            cursor: "pointer",
                                            fontSize: 10,
                                            color: "#666",
                                            padding: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0
                                        }}
                                        title={
                                            this.adjustFormat === "percent"
                                                ? "Switch to 0-255 value"
                                                : "Switch to percentage"
                                        }
                                    >
                                        {this.adjustFormat === "percent"
                                            ? "%"
                                            : "#"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ThemedColorInput = observer(
    class ThemedColorInput extends React.Component<{
        inputRef?: (ref: any) => void;
        value: any;
        onChange: (newValue: any) => void;
        readOnly: boolean;
        onClick?: (event: React.MouseEvent) => void;
        simpleMode?: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        buttonRef = React.createRef<HTMLButtonElement>();
        buttonRefInSimpleMode = React.createRef<HTMLInputElement>();
        dropDownRef = React.createRef<HTMLDivElement>();
        dropDownOpen: boolean | undefined = undefined;
        dropDownLeft = 0;
        dropDownTop = 0;

        // Parsed format of the current value, used to preserve format on picker changes
        currentColorFormat: ColorFormat | null = null;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                dropDownOpen: observable,
                dropDownLeft: observable,
                dropDownTop: observable,
                setDropDownOpen: action
            });
        }

        onDragOver = (event: React.DragEvent) => {
            event.preventDefault();
            event.stopPropagation();

            var data = getEezStudioDataFromDragEvent(this.context, event);
            if (data && data.objectClassName === "Color" && data.object) {
                event.dataTransfer.dropEffect = "copy";
            }
        };

        onDrop = (event: React.DragEvent) => {
            event.stopPropagation();
            event.preventDefault();

            if (this.props.onClick) {
                this.props.onClick(event as any);
            }

            var data = getEezStudioDataFromDragEvent(this.context, event);
            if (data && data.objectClassName === "Color" && data.object) {
                let value = getProperty(data.object, "name");
                setTimeout(() => {
                    this.props.onChange(value);
                });
            }
        };

        onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const color = event.target.value;
            this.props.onChange(color);
        };

        onPickerChange = (colorFormat: ColorFormat) => {
            this.currentColorFormat = colorFormat;
            this.props.onChange(colorFormat.toString());
        };

        get buttonEl() {
            return this.props.simpleMode ? this.buttonRefInSimpleMode.current : this.buttonRef.current;
        }

        updateDropDownPosition = action(() => {
            if (!this.buttonEl) return;
            const rectButton = this.buttonEl.getBoundingClientRect();

            const DROP_DOWN_WIDTH = COLOR_PICKER_WIDTH;
            const DROP_DOWN_HEIGHT = SV_PICKER_HEIGHT + 280;

            this.dropDownLeft = this.props.simpleMode ? rectButton.left : rectButton.right - DROP_DOWN_WIDTH;

            this.dropDownTop = rectButton.bottom - 1;
            if (this.dropDownTop + DROP_DOWN_HEIGHT > window.innerHeight) {
                this.dropDownTop = window.innerHeight - DROP_DOWN_HEIGHT;
            }
        });

        onScroll = () => {
            if (this.dropDownOpen) {
                this.updateDropDownPosition();
            }
        };

        setDropDownOpen(open: boolean) {
            if (this.dropDownOpen === false) {
                document.removeEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
                document.removeEventListener("keydown", this.onKeyDown, true);
                document.removeEventListener("scroll", this.onScroll, true);
            }

            this.dropDownOpen = open;

            if (this.dropDownOpen) {
                document.addEventListener(
                    "pointerdown",
                    this.onDocumentPointerDown,
                    true
                );
                document.addEventListener("keydown", this.onKeyDown, true);
                document.addEventListener("scroll", this.onScroll, true);
            }
        }

        openDropdown = action(() => {
            if (!this.buttonEl) {
                return;
            }

            const dropDownEl = this.dropDownRef.current;
            if (!dropDownEl) {
                return;
            }

            this.setDropDownOpen(!this.dropDownOpen);

            if (this.dropDownOpen) {
                this.context.undoManager.setCombineCommands(true);

                // Parse the current value to establish the format
                this.currentColorFormat = ColorFormat.parse(
                    this.props.value,
                    this.context.project
                );
            } else {
                this.context.undoManager.setCombineCommands(false);
            }

            if (this.dropDownOpen) {
                this.updateDropDownPosition();
            }
        });

        onDocumentPointerDown = action((event: MouseEvent) => {
            if (this.dropDownOpen) {
                if (
                    !closest(
                        event.target,
                        el =>
                            this.buttonEl == el ||
                            this.dropDownRef.current == el
                    )
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setDropDownOpen(false);
                }
            }
        });

        onKeyDown = action((event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (this.context.undoManager.commands.length > 0) {
                    this.context.undoManager.undo();
                }
                this.setDropDownOpen(false);
            } else if (event.key == "Enter") {
                this.setDropDownOpen(false);
            }
        });

        render() {
            const { value, readOnly } = this.props;

            let colorValue: string;
            if (!value) {
                colorValue = "#00000000";
            } else {
                colorValue =
                    value == "transparent"
                        ? settingsController.isDarkTheme
                            ? "0x00000000"
                            : "0xffffffff"
                        : value;
            }

            const colorFormat =
                this.currentColorFormat
                    ? ColorFormat.parse(this.currentColorFormat.toString(), this.context.project)
                    : ColorFormat.parse(colorValue, this.context.project);

            let portal;
            if (!readOnly) {
                portal = ReactDOM.createPortal(
                    <div
                        ref={this.dropDownRef}
                        className="dropdown-menu dropdown-menu-end EezStudio_ThemedColorInput_DropdownContent"
                        style={{
                            display: this.dropDownOpen ? "block" : "none",
                            left: this.dropDownLeft,
                            top: this.dropDownTop
                        }}
                    >
                        {this.dropDownOpen && (
                            <ColorPicker
                                colorFormat={colorFormat}
                                onChange={this.onPickerChange}
                                themeColors={this.context.project.colors.map(
                                    (c: any) => ({
                                        name: c.name as string,
                                        colorValue: getThemedColor(this.context, c.name).colorValue
                                    })
                                )}
                            />
                        )}
                    </div>,
                    document.body
                );
            }

            let color;
            if (colorFormat.isValid()) {
                color = colorFormat.getHexString();
            } else {
                color = settingsController.isDarkTheme
                    ? "0x00000000"
                    : "0xffffffff";
            }

            const inputColor = settingsController.isDarkTheme
                ? isLight(colorStringToHex(color))
                    ? "#000"
                    : undefined
                : isDark(colorStringToHex(color))
                  ? "#fff"
                  : undefined;

            const inputBackgroundColor = !value
                ? "transparent"
                : colorStringToHex(color);

            return (
                <div className="input-group">
                    {this.props.simpleMode === true ? (
                        <input
                            ref={
                                this.buttonRefInSimpleMode
                            }
                            className="form-control"
                            style={{
                                color: inputColor,
                                backgroundColor: inputBackgroundColor
                            }}
                            type="text"
                            value={""}
                            readOnly={true}
                            onClick={this.openDropdown}
                        />
                    ) : (
                        <input
                            ref={this.props.inputRef}
                            className="form-control"
                            style={{
                                color: inputColor,
                                backgroundColor: inputBackgroundColor
                            }}
                            type="text"
                            value={value}
                            onChange={this.onChange}
                            readOnly={readOnly}
                            onDrop={this.onDrop}
                            onDragOver={this.onDragOver}
                            onClick={this.props.onClick}
                        />
                    )}
                    {!readOnly && (
                        <>
                            {this.props.simpleMode !== true && (
                                <button
                                    ref={this.buttonRef}
                                    className="btn btn-secondary dropdown-toggle EezStudio_ThemedColorInput_DropdownButton"
                                    type="button"
                                    onClick={this.openDropdown}
                                />
                            )}
                            {portal}
                        </>
                    )}
                </div>
            );
        }
    }
);
