import tinycolor from "tinycolor2";
import { makeObservable, observable } from "mobx";

import {
    ClassInfo,
    EezObject,
    MessageType,
    PropertyInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { getProject } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Message } from "project-editor/store";
import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { PropertyValueHolder } from "project-editor/lvgl/LVGLStylesDefinitionProperty";

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

function makeEnumPropertyInfo(
    name: string,
    displayName: string,
    lvglStylePropCode: LVGLStylePropCode,
    enumItemToCodeOrStringArray: { [key: string]: number } | string[],
    buildPrefix: string
): LVGLPropertyInfo {
    let enumItemToCode: { [key: string]: number };
    if (Array.isArray(enumItemToCodeOrStringArray)) {
        enumItemToCode = {};
        for (let i = 0; i < enumItemToCodeOrStringArray.length; i++) {
            enumItemToCode[enumItemToCodeOrStringArray[i]] = i;
        }
    } else {
        enumItemToCode = enumItemToCodeOrStringArray;
    }

    const codeToEnumItem: { [code: string]: string } = {};

    Object.keys(enumItemToCode).forEach(
        enumItem =>
            (codeToEnumItem[enumItemToCode[enumItem].toString()] = enumItem)
    );

    return {
        name,
        displayName,
        type: PropertyType.Enum,
        enumItems: Object.keys(enumItemToCode).map(id => ({
            id,
            label: id
        })),
        enumDisallowUndefined: true,
        lvglStylePropCode,
        lvglStylePropValueRead: (value: number) =>
            codeToEnumItem[value.toString()],
        lvglStylePropValueToNum: (value: string) =>
            enumItemToCode[value.toString()],
        lvglStylePropValueBuild: (value: string) => buildPrefix + value
    };
}

const BUILT_IN_FONTS = [
    "MONTSERRAT_8",
    "MONTSERRAT_10",
    "MONTSERRAT_12",
    "MONTSERRAT_14",
    "MONTSERRAT_16",
    "MONTSERRAT_18",
    "MONTSERRAT_20",
    "MONTSERRAT_22",
    "MONTSERRAT_24",
    "MONTSERRAT_26",
    "MONTSERRAT_28",
    "MONTSERRAT_30",
    "MONTSERRAT_32",
    "MONTSERRAT_34",
    "MONTSERRAT_36",
    "MONTSERRAT_38",
    "MONTSERRAT_40",
    "MONTSERRAT_42",
    "MONTSERRAT_44",
    "MONTSERRAT_46",
    "MONTSERRAT_48"
];

////////////////////////////////////////////////////////////////////////////////

type LVGLPropertyInfo = PropertyInfo & {
    lvglStylePropCode: LVGLStylePropCode;
    lvglStylePropValueRead?: (value: number) => string;
    lvglStylePropValueToNum?: (value: string) => number;
    lvglStylePropValueBuild?: (value: string) => string;
};

// #region style properties

enum LVGLStylePropCode {
    LV_STYLE_PROP_INV = 0,

    /*Group 0*/
    LV_STYLE_WIDTH = 1,
    LV_STYLE_MIN_WIDTH = 2,
    LV_STYLE_MAX_WIDTH = 3,
    LV_STYLE_HEIGHT = 4,
    LV_STYLE_MIN_HEIGHT = 5,
    LV_STYLE_MAX_HEIGHT = 6,
    LV_STYLE_X = 7,
    LV_STYLE_Y = 8,
    LV_STYLE_ALIGN = 9,
    LV_STYLE_LAYOUT = 10,
    LV_STYLE_RADIUS = 11,

    /*Group 1*/
    LV_STYLE_PAD_TOP = 16,
    LV_STYLE_PAD_BOTTOM = 17,
    LV_STYLE_PAD_LEFT = 18,
    LV_STYLE_PAD_RIGHT = 19,
    LV_STYLE_PAD_ROW = 20,
    LV_STYLE_PAD_COLUMN = 21,
    LV_STYLE_BASE_DIR = 22,
    LV_STYLE_CLIP_CORNER = 23,

    /*Group 2*/
    LV_STYLE_BG_COLOR = 32,
    LV_STYLE_BG_OPA = 33,
    LV_STYLE_BG_GRAD_COLOR = 34,
    LV_STYLE_BG_GRAD_DIR = 35,
    LV_STYLE_BG_MAIN_STOP = 36,
    LV_STYLE_BG_GRAD_STOP = 37,
    LV_STYLE_BG_GRAD = 38,
    LV_STYLE_BG_DITHER_MODE = 39,
    LV_STYLE_BG_IMG_SRC = 40,
    LV_STYLE_BG_IMG_OPA = 41,
    LV_STYLE_BG_IMG_RECOLOR = 42,
    LV_STYLE_BG_IMG_RECOLOR_OPA = 43,
    LV_STYLE_BG_IMG_TILED = 44,

    /*Group 3*/
    LV_STYLE_BORDER_COLOR = 48,
    LV_STYLE_BORDER_OPA = 49,
    LV_STYLE_BORDER_WIDTH = 50,
    LV_STYLE_BORDER_SIDE = 51,
    LV_STYLE_BORDER_POST = 52,
    LV_STYLE_OUTLINE_WIDTH = 53,
    LV_STYLE_OUTLINE_COLOR = 54,
    LV_STYLE_OUTLINE_OPA = 55,
    LV_STYLE_OUTLINE_PAD = 56,

    /*Group 4*/
    LV_STYLE_SHADOW_WIDTH = 64,
    LV_STYLE_SHADOW_OFS_X = 65,
    LV_STYLE_SHADOW_OFS_Y = 66,
    LV_STYLE_SHADOW_SPREAD = 67,
    LV_STYLE_SHADOW_COLOR = 68,
    LV_STYLE_SHADOW_OPA = 69,
    LV_STYLE_IMG_OPA = 70,
    LV_STYLE_IMG_RECOLOR = 71,
    LV_STYLE_IMG_RECOLOR_OPA = 72,
    LV_STYLE_LINE_WIDTH = 73,
    LV_STYLE_LINE_DASH_WIDTH = 74,
    LV_STYLE_LINE_DASH_GAP = 75,
    LV_STYLE_LINE_ROUNDED = 76,
    LV_STYLE_LINE_COLOR = 77,
    LV_STYLE_LINE_OPA = 78,

    /*Group 5*/
    LV_STYLE_ARC_WIDTH = 80,
    LV_STYLE_ARC_ROUNDED = 81,
    LV_STYLE_ARC_COLOR = 82,
    LV_STYLE_ARC_OPA = 83,
    LV_STYLE_ARC_IMG_SRC = 84,
    LV_STYLE_TEXT_COLOR = 85,
    LV_STYLE_TEXT_OPA = 86,
    LV_STYLE_TEXT_FONT = 87,
    LV_STYLE_TEXT_LETTER_SPACE = 88,
    LV_STYLE_TEXT_LINE_SPACE = 89,
    LV_STYLE_TEXT_DECOR = 90,
    LV_STYLE_TEXT_ALIGN = 91,

    /*Group 6*/
    LV_STYLE_OPA = 96,
    LV_STYLE_COLOR_FILTER_DSC = 97,
    LV_STYLE_COLOR_FILTER_OPA = 98,
    LV_STYLE_ANIM = 99,
    LV_STYLE_ANIM_TIME = 100,
    LV_STYLE_ANIM_SPEED = 101,
    LV_STYLE_TRANSITION = 102,
    LV_STYLE_BLEND_MODE = 103,
    LV_STYLE_TRANSFORM_WIDTH = 104,
    LV_STYLE_TRANSFORM_HEIGHT = 105,
    LV_STYLE_TRANSLATE_X = 106,
    LV_STYLE_TRANSLATE_Y = 107,
    LV_STYLE_TRANSFORM_ZOOM = 108,
    LV_STYLE_TRANSFORM_ANGLE = 109,
    LV_STYLE_TRANSFORM_PIVOT_X = 110,
    LV_STYLE_TRANSFORM_PIVOT_Y = 111
}

//
// POSITION AND SIZE
//

// const width_property_info: LVGLPropertyInfo = {
//     name: "width",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_WIDTH
// };
const min_width_property_info: LVGLPropertyInfo = {
    name: "min_width",
    displayName: "Min. width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_MIN_WIDTH
};
const max_width_property_info: LVGLPropertyInfo = {
    name: "max_width",
    displayName: "Max. width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_MAX_WIDTH
};
// const height_property_info: LVGLPropertyInfo = {
//     name: "height",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_HEIGHT
// };
const min_height_property_info: LVGLPropertyInfo = {
    name: "min_height",
    displayName: "Min. height",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_MIN_HEIGHT
};
const max_height_property_info: LVGLPropertyInfo = {
    name: "max_height",
    displayName: "Max. height",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_MAX_HEIGHT
};
// const x_property_info: LVGLPropertyInfo = {
//     name: "x",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_X
// };
// const y_property_info: LVGLPropertyInfo = {
//     name: "y",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_Y
// };
const align_property_info = makeEnumPropertyInfo(
    "align",
    "Align",
    LVGLStylePropCode.LV_STYLE_ALIGN,
    [
        "DEFAULT",
        "TOP_LEFT",
        "TOP_MID",
        "TOP_RIGHT",
        "BOTTOM_LEFT",
        "BOTTOM_MID",
        "BOTTOM_RIGHT",
        "LEFT_MID",
        "RIGHT_MID",
        "CENTER",

        "OUT_TOP_LEFT",
        "OUT_TOP_MID",
        "OUT_TOP_RIGHT",
        "OUT_BOTTOM_LEFT",
        "OUT_BOTTOM_MID",
        "OUT_BOTTOM_RIGHT",
        "OUT_LEFT_TOP",
        "OUT_LEFT_MID",
        "OUT_LEFT_BOTTOM",
        "OUT_RIGHT_TOP",
        "OUT_RIGHT_MID",
        "OUT_RIGHT_BOTTOM"
    ],
    "LV_ALIGN_"
);
const transform_width_property_info: LVGLPropertyInfo = {
    name: "transform_width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSFORM_WIDTH
};
const transform_height_property_info: LVGLPropertyInfo = {
    name: "transform_height",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSFORM_HEIGHT
};
const translate_x_property_info: LVGLPropertyInfo = {
    name: "translate_x",
    displayName: "Translate X",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSLATE_X
};
const translate_y_property_info: LVGLPropertyInfo = {
    name: "translate_y",
    displayName: "Translate Y",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSLATE_Y
};
const transform_zoom_property_info: LVGLPropertyInfo = {
    name: "transform_zoom",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSFORM_ZOOM
};
const transform_angle_property_info: LVGLPropertyInfo = {
    name: "transform_angle",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSFORM_ANGLE
};
const transform_pivot_x_property_info: LVGLPropertyInfo = {
    name: "transform_pivot_x",
    displayName: "Transform pivot X",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSFORM_PIVOT_X
};
const transform_pivot_y_property_info: LVGLPropertyInfo = {
    name: "transform_pivot_y",
    displayName: "Transform pivot Y",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSFORM_PIVOT_Y
};

//
// PADDING
//

const pad_top_property_info: LVGLPropertyInfo = {
    name: "pad_top",
    displayName: "Top",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_PAD_TOP
};
const pad_bottom_property_info: LVGLPropertyInfo = {
    name: "pad_bottom",
    displayName: "Bottom",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_PAD_BOTTOM
};
const pad_left_property_info: LVGLPropertyInfo = {
    name: "pad_left",
    displayName: "Left",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_PAD_LEFT
};
const pad_right_property_info: LVGLPropertyInfo = {
    name: "pad_right",
    displayName: "Right",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_PAD_RIGHT
};
const pad_row_property_info: LVGLPropertyInfo = {
    name: "pad_row",
    displayName: "Row",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_PAD_ROW
};
const pad_column_property_info: LVGLPropertyInfo = {
    name: "pad_column",
    displayName: "Column",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_PAD_COLUMN
};

//
// BACKGROUND
//

const bg_color_property_info: LVGLPropertyInfo = {
    name: "bg_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_COLOR
};
const bg_opa_property_info: LVGLPropertyInfo = {
    name: "bg_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_OPA
};
const bg_grad_color_property_info: LVGLPropertyInfo = {
    name: "bg_grad_color",
    displayName: "Grad. color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_GRAD_COLOR
};
const bg_grad_dir_property_info = makeEnumPropertyInfo(
    "bg_grad_dir",
    "Grad. direction",
    LVGLStylePropCode.LV_STYLE_BG_GRAD_DIR,
    [
        "NONE", // No gradient (the `grad_color` property is ignored)
        "VER", // Vertical (top to bottom) gradient
        "HOR" // Horizontal (left to right) gradient
    ],
    "LV_GRAD_DIR_"
);
const bg_main_stop_property_info: LVGLPropertyInfo = {
    name: "bg_main_stop",
    displayName: "Main stop",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_MAIN_STOP
};
const bg_grad_stop_property_info: LVGLPropertyInfo = {
    name: "bg_grad_stop",
    displayName: "Gradient stop",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_GRAD_STOP
};
/*
const bg_grad_property_info: LVGLPropertyInfo = {
    name: "bg_grad",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_GRAD
};
*/
const bg_dither_mode_property_info = makeEnumPropertyInfo(
    "bg_dither_mode",
    "Dither mode",
    LVGLStylePropCode.LV_STYLE_BG_DITHER_MODE,
    [
        "NONE", // No dithering, colors are just quantized to the output resolution
        "ORDERED", // Ordered dithering. Faster to compute and use less memory but lower quality
        "ERR_DIFF" // Error diffusion mode. Slower to compute and use more memory but give highest dither quality
    ],
    "LV_DITHER_"
);
const bg_img_src_property_info: LVGLPropertyInfo = {
    name: "bg_img_src",
    displayName: "Image source",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "bitmaps",
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_IMG_SRC
};
const bg_img_opa_property_info: LVGLPropertyInfo = {
    name: "bg_img_opa",
    displayName: "Image opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_IMG_OPA
};
const bg_img_recolor_property_info: LVGLPropertyInfo = {
    name: "bg_img_recolor",
    displayName: "Image recolor",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_IMG_RECOLOR
};
const bg_img_recolor_opa_property_info: LVGLPropertyInfo = {
    name: "bg_img_recolor_opa",
    displayName: "Image recolor opa.",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_IMG_RECOLOR_OPA
};
const bg_img_tiled_property_info: LVGLPropertyInfo = {
    name: "bg_img_tiled",
    displayName: "Image tiled",
    type: PropertyType.Boolean,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BG_IMG_TILED
};

//
// BORDER
//

const border_color_property_info: LVGLPropertyInfo = {
    name: "border_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BORDER_COLOR
};
const border_opa_property_info: LVGLPropertyInfo = {
    name: "border_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BORDER_OPA
};
const border_width_property_info: LVGLPropertyInfo = {
    name: "border_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BORDER_WIDTH
};
const border_side_property_info = makeEnumPropertyInfo(
    "border_side",
    "Side",
    LVGLStylePropCode.LV_STYLE_BORDER_SIDE,
    {
        NONE: 0x00,
        BOTTOM: 0x01,
        TOP: 0x02,
        LEFT: 0x04,
        RIGHT: 0x08,
        FULL: 0x0f,
        INTERNAL: 0x10 // FOR matrix-like objects (e.g. Button matrix)
    },
    "LV_BORDER_SIDE_"
);
const border_post_property_info: LVGLPropertyInfo = {
    name: "border_post",
    displayName: "Post",
    type: PropertyType.Boolean,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_BORDER_POST
};

//
// OUTLINE
//

const outline_width_property_info: LVGLPropertyInfo = {
    name: "outline_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_OUTLINE_WIDTH
};
const outline_color_property_info: LVGLPropertyInfo = {
    name: "outline_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_OUTLINE_COLOR
};
const outline_opa_property_info: LVGLPropertyInfo = {
    name: "outline_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_OUTLINE_OPA
};
const outline_pad_property_info: LVGLPropertyInfo = {
    name: "outline_pad",
    displayName: "Padding",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_OUTLINE_PAD
};

//
// SHADOW
//

const shadow_width_property_info: LVGLPropertyInfo = {
    name: "shadow_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_SHADOW_WIDTH
};
const shadow_ofs_x_property_info: LVGLPropertyInfo = {
    name: "shadow_ofs_x",
    displayName: "X offset",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_SHADOW_OFS_X
};
const shadow_ofs_y_property_info: LVGLPropertyInfo = {
    name: "shadow_ofs_y",
    displayName: "Y offset",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_SHADOW_OFS_Y
};
const shadow_spread_property_info: LVGLPropertyInfo = {
    name: "shadow_spread",
    displayName: "Spread",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_SHADOW_SPREAD
};
const shadow_color_property_info: LVGLPropertyInfo = {
    name: "shadow_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_SHADOW_COLOR
};
const shadow_opa_property_info: LVGLPropertyInfo = {
    name: "shadow_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_SHADOW_OPA
};

//
// IMAGE
//

const img_opa_property_info: LVGLPropertyInfo = {
    name: "img_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_IMG_OPA
};
const img_recolor_property_info: LVGLPropertyInfo = {
    name: "img_recolor",
    displayName: "Recolor",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_IMG_RECOLOR
};
const img_recolor_opa_property_info: LVGLPropertyInfo = {
    name: "img_recolor_opa",
    displayName: "Recolor opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_IMG_RECOLOR_OPA
};

//
// LINE
//

const line_width_property_info: LVGLPropertyInfo = {
    name: "line_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LINE_WIDTH
};
const line_dash_width_property_info: LVGLPropertyInfo = {
    name: "line_dash_width",
    displayName: "Dash width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LINE_DASH_WIDTH
};
const line_dash_gap_property_info: LVGLPropertyInfo = {
    name: "line_dash_gap",
    displayName: "Dash gap",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LINE_DASH_GAP
};
const line_rounded_property_info: LVGLPropertyInfo = {
    name: "line_rounded",
    displayName: "Rounded",
    type: PropertyType.Boolean,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LINE_ROUNDED
};
const line_color_property_info: LVGLPropertyInfo = {
    name: "line_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LINE_COLOR
};
const line_opa_property_info: LVGLPropertyInfo = {
    name: "line_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LINE_OPA
};

//
// ARC
//

const arc_width_property_info: LVGLPropertyInfo = {
    name: "arc_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ARC_WIDTH
};
const arc_rounded_property_info: LVGLPropertyInfo = {
    name: "arc_rounded",
    displayName: "Rounded",
    type: PropertyType.Boolean,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ARC_ROUNDED
};
const arc_color_property_info: LVGLPropertyInfo = {
    name: "arc_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ARC_COLOR
};
const arc_opa_property_info: LVGLPropertyInfo = {
    name: "arc_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ARC_OPA
};
const arc_img_src_property_info: LVGLPropertyInfo = {
    name: "arc_img_src",
    displayName: "Image source",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "bitmaps",
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ARC_IMG_SRC
};

//
// TEXT
//

const text_color_property_info: LVGLPropertyInfo = {
    name: "text_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TEXT_COLOR
};
const text_opa_property_info: LVGLPropertyInfo = {
    name: "text_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TEXT_OPA
};
const text_font_property_info: LVGLPropertyInfo = {
    name: "text_font",
    displayName: "Font",
    type: PropertyType.Enum,
    enumItems: (propertyValueHolder: PropertyValueHolder) => {
        return [...BUILT_IN_FONTS.map(id => ({ id }))];
    },
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TEXT_FONT
};
const text_letter_space_property_info: LVGLPropertyInfo = {
    name: "text_letter_space",
    displayName: "Letter space",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TEXT_LETTER_SPACE
};
const text_line_space_property_info: LVGLPropertyInfo = {
    name: "text_line_space",
    displayName: "Line space",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TEXT_LINE_SPACE
};
const text_decor_property_info = makeEnumPropertyInfo(
    "text_decor",
    "Decoration",
    LVGLStylePropCode.LV_STYLE_TEXT_DECOR,
    ["NONE", "UNDERLINE", "STRIKETHROUGH"],
    "LV_TEXT_DECOR_"
);
const text_align_property_info = makeEnumPropertyInfo(
    "text_align",
    "Align",
    LVGLStylePropCode.LV_STYLE_TEXT_ALIGN,
    ["AUTO", "LEFT", "CENTER", "RIGHT"],
    "LV_TEXT_ALIGN_"
);

//
// MISCELLANEOUS
//

const radius_property_info: LVGLPropertyInfo = {
    name: "radius",
    displayName: "Radius",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_RADIUS
};
const clip_corner_property_info: LVGLPropertyInfo = {
    name: "clip_corner",
    displayName: "Clip corner",
    type: PropertyType.Boolean,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_CLIP_CORNER
};
const opa_property_info: LVGLPropertyInfo = {
    name: "opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStylePropCode: LVGLStylePropCode.LV_STYLE_OPA
};
// const color_filter_dsc_property_info: LVGLPropertyInfo = {
//     name: "color_filter_dsc",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_COLOR_FILTER_DSC
// };
// const color_filter_opa_property_info: LVGLPropertyInfo = {
//     name: "color_filter_opa",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_COLOR_FILTER_OPA
// };
// const anim_property_info: LVGLPropertyInfo = {
//     name: "anim",
//     type: PropertyType.Any,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ANIM
// };
// const anim_time_property_info: LVGLPropertyInfo = {
//     name: "anim_time",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ANIM_TIME
// };
// const anim_speed_property_info: LVGLPropertyInfo = {
//     name: "anim_speed",
//     type: PropertyType.Number,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_ANIM_SPEED
// };
// const transition_property_info: LVGLPropertyInfo = {
//     name: "transition",
//     type: PropertyType.Any,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_TRANSITION
// };
const blend_mode_property_info = makeEnumPropertyInfo(
    "blend_mode",
    "Blend mode",
    LVGLStylePropCode.LV_STYLE_BLEND_MODE,
    [
        "NORMAL", // Simply mix according to the opacity value
        "ADDITIVE", // Add the respective color channels
        "SUBTRACTIVE", // Subtract the foreground from the background
        "MULTIPLY", // Multiply the foreground and background
        "REPLACE" // Replace background with foreground in the area
    ],
    "LV_BLEND_MODE_"
);
// const layout_property_info: LVGLPropertyInfo = {
//     name: "layout",
//     type: PropertyType.Any,
//     lvglStylePropCode: LVGLStylePropCode.LV_STYLE_LAYOUT
// };
const base_dir_property_info = makeEnumPropertyInfo(
    "base_dir",
    "Base direction",
    LVGLStylePropCode.LV_STYLE_BASE_DIR,
    ["LTR", "RTL", "AUTO"],
    "LV_BASE_DIR_"
);

export interface PropertiesGroup {
    groupName: string;
    properties: LVGLPropertyInfo[];
}

export const lvglProperties: PropertiesGroup[] = [
    {
        groupName: "POSITION AND SIZE",
        properties: [
            align_property_info,
            //width_property_info,
            min_width_property_info,
            max_width_property_info,
            //height_property_info,
            min_height_property_info,
            max_height_property_info,
            //x_property_info,
            //y_property_info,
            transform_width_property_info,
            transform_height_property_info,
            translate_x_property_info,
            translate_y_property_info,
            transform_zoom_property_info,
            transform_angle_property_info,
            transform_pivot_x_property_info,
            transform_pivot_y_property_info
        ]
    },

    {
        groupName: "PADDING",
        properties: [
            pad_top_property_info,
            pad_bottom_property_info,
            pad_left_property_info,
            pad_right_property_info,
            pad_row_property_info,
            pad_column_property_info
        ]
    },

    {
        groupName: "BACKGROUND",
        properties: [
            bg_color_property_info,
            bg_opa_property_info,
            bg_grad_color_property_info,
            bg_grad_dir_property_info,
            bg_main_stop_property_info,
            bg_grad_stop_property_info,
            //bg_grad_property_info,
            bg_dither_mode_property_info,
            bg_img_src_property_info,
            bg_img_opa_property_info,
            bg_img_recolor_property_info,
            bg_img_recolor_opa_property_info,
            bg_img_tiled_property_info
        ]
    },

    {
        groupName: "BORDER",
        properties: [
            border_color_property_info,
            border_opa_property_info,
            border_width_property_info,
            border_side_property_info,
            border_post_property_info
        ]
    },

    {
        groupName: "OUTLINE",
        properties: [
            outline_width_property_info,
            outline_color_property_info,
            outline_opa_property_info,
            outline_pad_property_info
        ]
    },

    {
        groupName: "SHADOW",
        properties: [
            shadow_width_property_info,
            shadow_ofs_x_property_info,
            shadow_ofs_y_property_info,
            shadow_spread_property_info,
            shadow_color_property_info,
            shadow_opa_property_info
        ]
    },

    {
        groupName: "IMAGE",
        properties: [
            img_opa_property_info,
            img_recolor_property_info,
            img_recolor_opa_property_info
        ]
    },

    {
        groupName: "LINE",
        properties: [
            line_width_property_info,
            line_dash_width_property_info,
            line_dash_gap_property_info,
            line_rounded_property_info,
            line_color_property_info,
            line_opa_property_info
        ]
    },

    {
        groupName: "ARC",
        properties: [
            arc_width_property_info,
            arc_rounded_property_info,
            arc_color_property_info,
            arc_opa_property_info,
            arc_img_src_property_info
        ]
    },

    {
        groupName: "TEXT",
        properties: [
            text_color_property_info,
            text_opa_property_info,
            text_font_property_info,
            text_letter_space_property_info,
            text_line_space_property_info,
            text_decor_property_info,
            text_align_property_info
        ]
    },

    {
        groupName: "MISCELLANEOUS",
        properties: [
            radius_property_info,
            clip_corner_property_info,
            opa_property_info,
            //color_filter_dsc_property_info,
            //color_filter_opa_property_info,
            //anim_property_info,
            //anim_time_property_info,
            //anim_speed_property_info,
            //transition_property_info,
            blend_mode_property_info,
            //layout_property_info,
            base_dir_property_info
        ]
    }
];

const lvglPropertiesMap = new Map<string, LVGLPropertyInfo>();
lvglProperties.forEach(propertyGroup =>
    propertyGroup.properties.forEach(property => {
        if (lvglPropertiesMap.get(property.name)) {
            console.error("UNEXPECTED!", property.name);
        }
        lvglPropertiesMap.set(property.name, property);
    })
);

// #endregion

////////////////////////////////////////////////////////////////////////////////

export class LVGLStylesDefinition extends EezObject {
    definition: {
        [part: string]: {
            [state: string]: {
                [prop: string]: any;
            };
        };
    };

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "definition",
                type: PropertyType.Any
            }
        ],
        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            definition: observable
        });
    }

    getPropertyValue(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string
    ) {
        if (!this.definition) {
            return undefined;
        }

        const partStyles = this.definition[part];
        if (!partStyles) {
            return undefined;
        }

        const stateStyles = partStyles[state];
        if (!stateStyles) {
            return undefined;
        }

        return stateStyles[propertyInfo.name];
    }

    addPropertyToDefinition(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string,
        value: any
    ) {
        let def = this.definition;
        return {
            ...(def || {}),
            [part]: {
                ...(def || {})[part],
                [state]: {
                    ...((def || {})[part] || {})[state],
                    [propertyInfo.name]: value
                }
            }
        };
    }

    removePropertyFromDefinition(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string
    ) {
        let def = this.definition;
        let copy = {
            ...(def || {}),
            [part]: {
                ...(def || {})[part],
                [state]: {
                    ...((def || {})[part] || {})[state]
                }
            }
        };

        delete copy[part][state][propertyInfo.name];

        if (Object.keys(copy[part][state]).length == 0) {
            delete copy[part][state];
        }

        if (Object.keys(copy[part]).length == 0) {
            delete copy[part];
        }

        if (Object.keys(copy).length == 0) {
            return undefined;
        }

        return copy;
    }

    check() {
        let messages: Message[] = [];

        if (this.definition) {
            Object.keys(this.definition).forEach(part => {
                Object.keys(this.definition[part]).forEach(state => {
                    Object.keys(this.definition[part][state]).forEach(
                        propertyName => {
                            const propertyInfo =
                                lvglPropertiesMap.get(propertyName);
                            if (!propertyInfo) {
                                return;
                            }

                            if (
                                propertyInfo.type ==
                                    PropertyType.ObjectReference &&
                                propertyInfo.referencedObjectCollectionPath ==
                                    "bitmaps"
                            ) {
                                const value =
                                    this.definition[part][state][propertyName];

                                const bitmap = ProjectEditor.findBitmap(
                                    getProject(this),
                                    value
                                );

                                if (!bitmap) {
                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Bitmap not found for style property ${part} - ${state} - ${propertyInfo.name}`,
                                            this
                                        )
                                    );
                                }
                            }
                        }
                    );
                });
            });
        }

        return messages;
    }

    lvglCreate(runtime: LVGLPageRuntime, obj: number) {
        if (!this.definition) {
            return;
        }

        Object.keys(this.definition).forEach(part => {
            Object.keys(this.definition[part]).forEach(state => {
                const selectorCode = getSelectorCode(part, state);
                Object.keys(this.definition[part][state]).forEach(
                    propertyName => {
                        const propertyInfo =
                            lvglPropertiesMap.get(propertyName);
                        if (!propertyInfo) {
                            return;
                        }

                        const value =
                            this.definition[part][state][propertyName];

                        if (propertyInfo.type == PropertyType.ThemedColor) {
                            const colorValue = colorRgbToNum(value);

                            runtime.wasm._lvglObjSetLocalStylePropColor(
                                obj,
                                propertyInfo.lvglStylePropCode,
                                colorValue,
                                selectorCode
                            );
                        } else if (
                            propertyInfo.type == PropertyType.Number ||
                            propertyInfo.type == PropertyType.Enum
                        ) {
                            if (propertyInfo == text_font_property_info) {
                                const index = BUILT_IN_FONTS.indexOf(value);
                                if (index != -1) {
                                    runtime.wasm._lvglObjSetLocalStylePropBuiltInFont(
                                        obj,
                                        propertyInfo.lvglStylePropCode,
                                        index,
                                        selectorCode
                                    );
                                }
                            } else {
                                const numValue =
                                    propertyInfo.lvglStylePropValueToNum
                                        ? propertyInfo.lvglStylePropValueToNum(
                                              value
                                          )
                                        : value;

                                runtime.wasm._lvglObjSetLocalStylePropNum(
                                    obj,
                                    propertyInfo.lvglStylePropCode,
                                    numValue,
                                    selectorCode
                                );
                            }
                        } else if (propertyInfo.type == PropertyType.Boolean) {
                            const numValue = value ? 1 : 0;

                            runtime.wasm._lvglObjSetLocalStylePropNum(
                                obj,
                                propertyInfo.lvglStylePropCode,
                                numValue,
                                selectorCode
                            );
                        } else if (
                            propertyInfo.type == PropertyType.ObjectReference &&
                            propertyInfo.referencedObjectCollectionPath ==
                                "bitmaps"
                        ) {
                            (async () => {
                                const bitmapPtr = await runtime.loadBitmap(
                                    value
                                );
                                if (bitmapPtr) {
                                    runtime.wasm._lvglObjSetLocalStylePropPtr(
                                        obj,
                                        propertyInfo.lvglStylePropCode,
                                        bitmapPtr,
                                        selectorCode
                                    );
                                }
                            })();
                        }
                    }
                );
            });
        });
    }

    lvglBuild() {
        if (!this.definition) {
            return "";
        }

        let result = "";

        Object.keys(this.definition).forEach(part => {
            Object.keys(this.definition[part]).forEach(state => {
                const selectorCode = getSelectorBuildCode(part, state);
                Object.keys(this.definition[part][state]).forEach(
                    propertyName => {
                        const propertyInfo =
                            lvglPropertiesMap.get(propertyName);
                        if (!propertyInfo) {
                            return;
                        }

                        const value =
                            this.definition[part][state][propertyName];

                        if (propertyInfo.type == PropertyType.ThemedColor) {
                            const colorValue =
                                "0x" +
                                colorRgbToNum(
                                    this.definition[part][state][propertyName]
                                )
                                    .toString(16)
                                    .padStart(8, "0");

                            result += `
lv_obj_set_style_${propertyInfo.name}(obj, lv_color_hex(${colorValue}), ${selectorCode});`;
                        } else if (
                            propertyInfo.type == PropertyType.Number ||
                            propertyInfo.type == PropertyType.Enum
                        ) {
                            if (propertyInfo == text_font_property_info) {
                                const index = BUILT_IN_FONTS.indexOf(value);
                                if (index != -1) {
                                    result += `
lv_obj_set_style_${propertyInfo.name}(obj, &lv_font_${(
                                        value as string
                                    ).toLowerCase()}, ${selectorCode});`;
                                }
                            } else {
                                const numValue =
                                    propertyInfo.lvglStylePropValueBuild
                                        ? propertyInfo.lvglStylePropValueBuild(
                                              value
                                          )
                                        : value;

                                result += `
lv_obj_set_style_${propertyInfo.name}(obj, ${numValue}, ${selectorCode});`;
                            }
                        } else if (propertyInfo.type == PropertyType.Boolean) {
                            const numValue = value ? "true" : "false";

                            result += `
lv_obj_set_style_${propertyInfo.name}(obj, ${numValue}, ${selectorCode});`;
                        } else if (
                            propertyInfo.type == PropertyType.ObjectReference &&
                            propertyInfo.referencedObjectCollectionPath ==
                                "bitmaps"
                        ) {
                            result += `
lv_obj_set_style_${propertyInfo.name}(obj, &img_${value}, ${selectorCode});`;
                        }
                    }
                );
            });
        });

        return result;
    }
}

registerClass("LVGLStylesDefinition", LVGLStylesDefinition);

////////////////////////////////////////////////////////////////////////////////

function getPartCode(part: string) {
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

function getPartBuildCode(part: string) {
    return "LV_PART_" + part;
}

function getStateCode(state: string) {
    const stateCode = (lvglStates as any)[state];
    if (stateCode == undefined) {
        console.error("UNEXPECTED!");
        return 0;
    }
    return stateCode;
}

function getStateBuildCode(state: string) {
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

function colorNumToRgb(color: number): string {
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

function colorRgbToNum(color: string): number {
    const rgb = tinycolor(color).toRgb();

    // result is in BGR format
    let result = (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);

    // signed to unsigned
    result = result >>> 0;

    return result;
}

export function getStylePropDefaultValue(
    runtime: LVGLPageRuntime | undefined,
    widget: LVGLWidget,
    part: keyof typeof lvglParts,
    propertyInfo: LVGLPropertyInfo
) {
    if (runtime && widget._lvglObj) {
        if (propertyInfo.type == PropertyType.ThemedColor) {
            let colorNum = runtime.wasm._lvglObjGetStylePropColor(
                widget._lvglObj,
                getPartCode(part),
                propertyInfo.lvglStylePropCode
            );
            return colorNumToRgb(colorNum);
        } else if (
            propertyInfo.type == PropertyType.Number ||
            propertyInfo.type == PropertyType.Enum
        ) {
            let num = runtime.wasm._lvglObjGetStylePropNum(
                widget._lvglObj,
                getPartCode(part),
                propertyInfo.lvglStylePropCode
            );
            return propertyInfo.lvglStylePropValueRead
                ? propertyInfo.lvglStylePropValueRead(num)
                : num;
        } else if (propertyInfo.type == PropertyType.Boolean) {
            let num = runtime.wasm._lvglObjGetStylePropNum(
                widget._lvglObj,
                getPartCode(part),
                propertyInfo.lvglStylePropCode
            );
            return num ? true : false;
        }
    }

    return 0;
}
