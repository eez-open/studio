import tinycolor from "tinycolor2";

import { PropertyType } from "project-editor/core/object";

import {
    BUILT_IN_FONTS,
    lvglPropertiesMap,
    LVGLPropertyInfo,
    text_font_property_info
} from "project-editor/lvgl/style-catalog";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";

////////////////////////////////////////////////////////////////////////////////

const lvglStates = {
    DEFAULT: 0x0000, // LV_STATE_DEFAULT
    CHECKED: 0x0001, // LV_STATE_CHECKED
    FOCUSED: 0x0002, // LV_STATE_FOCUSED,
    FOCUS_KEY: 0x0004, // LV_STATE_FOCUS_KEY
    EDITED: 0x0008, // LV_STATE_EDITED,
    HOVERED: 0x0010, // LV_STATE_HOVERED
    PRESSED: 0x0020, // LV_STATE_PRESSED
    SCROLLEd: 0x0040, // LV_STATE_SCROLLED
    DISABLED: 0x0080, // LV_STATE_DISABLED

    USER_1: 0x1000, // LV_STATE_USER_1,
    USER_2: 0x2000, // LV_STATE_USER_1,
    USER_3: 0x4000, // LV_STATE_USER_1,
    USER_4: 0x8000, // LV_STATE_USER_1,

    ANY: 0xffff // Special value can be used in some functions to target all states
};

////////////////////////////////////////////////////////////////////////////////

const lvglParts = {
    MAIN: 0x000000, // LV_PART_MAIN         A background like rectangle
    SCROLLBAR: 0x010000, // LV_PART_SCROLLBAR    The scrollbar(s)
    INDICATOR: 0x020000, // LV_PART_INDICATOR    Indicator, e.g. for slider, bar, switch, or the tick box of the checkbox
    KNOB: 0x030000, // LV_PART_KNOB         Like handle to grab to adjust the value
    SELECTED: 0x040000, // LV_PART_SELECTED     Indicate the currently selected option or section
    ITEMS: 0x050000, // LV_PART_ITEMS        Used if the widget has multiple similar elements (e.g. table cells)
    TICKS: 0x060000, // LV_PART_TICKS        Ticks on scale e.g. for a chart or meter
    CURSOR: 0x070000, // LV_PART_CURSOR       Mark a specific place e.g. for text area's cursor or on a chart

    CUSTOM1: 0x080000, // LV_PART_CUSTOM_FIRST Extension point for custom widgets

    ANY: 0x0f0000 // LV_PART_ANY          Special value can be used in some functions to target all parts
};

export type LVGLParts = keyof typeof lvglParts;

////////////////////////////////////////////////////////////////////////////////

export function getPartCode(part: string) {
    if (part.startsWith("custom")) {
        const partIndex = Number.parseInt(part.substring("custom".length));
        const custom1Code = lvglParts.CUSTOM1;
        return custom1Code + (partIndex - 1);
    } else {
        const partCode = (lvglParts as any)[part];
        if (partCode == undefined) {
            console.error("UNEXPECTED!");
            return 0;
        }
        return partCode;
    }
}

export function getPartBuildCode(part: string) {
    return "LV_PART_" + part;
}

export function getStateCode(state: string) {
    const stateCode = (lvglStates as any)[state];
    if (stateCode == undefined) {
        console.error("UNEXPECTED!");
        return 0;
    }
    return stateCode;
}

export function getStateBuildCode(state: string) {
    return "LV_STATE_" + state;
}

export function getSelectorCode(partStr: string, statesStr: string) {
    const partCode = getPartCode(partStr);

    const statesCode = statesStr
        .split("|")
        .reduce((previousCode: number, currentStateStr: string) => {
            return previousCode | getStateCode(currentStateStr);
        }, 0);

    return partCode | statesCode;
}

export function getSelectorBuildCode(partStr: string, statesStr: string) {
    const partCode = getPartBuildCode(partStr);

    const statesCode = statesStr
        .split("|")
        .map(state => getStateBuildCode(state))
        .join(" | ");

    return `${partCode} | ${statesCode}`;
}

export function getPropertyInfo(propertyName: string) {
    return lvglPropertiesMap.get(propertyName);
}

export function colorNumToRgb(color: number): string {
    // signed to unsigned
    color = color >>> 0;

    // color is in BGR format
    const b = (color >> 0) & 0xff;
    const g = (color >> 8) & 0xff;
    const r = (color >> 16) & 0xff;

    let result = (r << 16) | (g << 8) | (b << 0);

    // signed to unsigned
    result = result >>> 0;

    return "#" + result.toString(16).padStart(6, "0");
}

export function colorRgbToNum(color: string): number {
    const rgb = tinycolor(color).toRgb();

    // result is in BGR format
    let result = (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);

    // signed to unsigned
    result = result >>> 0;

    return result;
}

export function colorRgbToHexNumStr(color: string) {
    return "0x" + colorRgbToNum(color).toString(16).padStart(8, "0");
}

export function getStylePropDefaultValue(
    runtime: LVGLPageRuntime | undefined,
    lvglObj: number | undefined,
    part: keyof typeof lvglParts,
    propertyInfo: LVGLPropertyInfo
) {
    if (runtime && lvglObj) {
        if (propertyInfo.type == PropertyType.ThemedColor) {
            let colorNum = runtime.wasm._lvglObjGetStylePropColor(
                lvglObj,
                getPartCode(part),
                propertyInfo.lvglStyleProp.code
            );
            return colorNumToRgb(colorNum);
        } else if (
            propertyInfo.type == PropertyType.Number ||
            propertyInfo.type == PropertyType.Enum
        ) {
            if (propertyInfo == text_font_property_info) {
                let fontIndex = runtime.wasm._lvglObjGetStylePropBuiltInFont(
                    lvglObj,
                    getPartCode(part),
                    propertyInfo.lvglStyleProp.code
                );

                if (fontIndex != -1) {
                    return BUILT_IN_FONTS[fontIndex];
                } else {
                    let fontAddr = runtime.wasm._lvglObjGetStylePropFontAddr(
                        lvglObj,
                        getPartCode(part),
                        propertyInfo.lvglStyleProp.code
                    );
                    const font = runtime.fontAddressToFont.get(fontAddr);
                    if (font) {
                        return font.name;
                    }
                }
            } else {
                let num = runtime.wasm._lvglObjGetStylePropNum(
                    lvglObj,
                    getPartCode(part),
                    propertyInfo.lvglStyleProp.code
                );
                return propertyInfo.lvglStyleProp.valueRead
                    ? propertyInfo.lvglStyleProp.valueRead(num)
                    : num;
            }
        } else if (propertyInfo.type == PropertyType.Boolean) {
            let num = runtime.wasm._lvglObjGetStylePropNum(
                lvglObj,
                getPartCode(part),
                propertyInfo.lvglStyleProp.code
            );
            return num ? true : false;
        }
    }

    return 0;
}
