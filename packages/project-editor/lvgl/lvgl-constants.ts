import type { WidgetEvents } from "project-editor/core/object";

export type LVGLStylePropCode = {
    "8.4.0": number | undefined;
    "9.2.2": number | undefined;
    "9.3.0": number | undefined;
    "9.4.0": number | undefined;
};

export const LVGL_STYLE_PROP_CODES: {
    [key: string]: LVGLStylePropCode;
} = {
    LV_STYLE_WIDTH: { "8.4.0": 1, "9.2.2": 1, "9.3.0": 1, "9.4.0": 1 },
    LV_STYLE_HEIGHT: { "8.4.0": 4, "9.2.2": 2, "9.3.0": 2, "9.4.0": 2 },
    LV_STYLE_LENGTH: { "8.4.0": undefined, "9.2.2": 3, "9.3.0": 3, "9.4.0": 3 },
    LV_STYLE_MIN_WIDTH: { "8.4.0": 2, "9.2.2": 4, "9.3.0": 4, "9.4.0": 4 },
    LV_STYLE_MAX_WIDTH: { "8.4.0": 3, "9.2.2": 5, "9.3.0": 5, "9.4.0": 5 },
    LV_STYLE_MIN_HEIGHT: { "8.4.0": 5, "9.2.2": 6, "9.3.0": 6, "9.4.0": 6 },
    LV_STYLE_MAX_HEIGHT: { "8.4.0": 6, "9.2.2": 7, "9.3.0": 7, "9.4.0": 7 },
    LV_STYLE_X: { "8.4.0": 7, "9.2.2": 8, "9.3.0": 8, "9.4.0": 8 },
    LV_STYLE_Y: { "8.4.0": 8, "9.2.2": 9, "9.3.0": 9, "9.4.0": 9 },
    LV_STYLE_ALIGN: { "8.4.0": 9, "9.2.2": 10, "9.3.0": 10, "9.4.0": 10 },
    LV_STYLE_RADIUS: { "8.4.0": 11, "9.2.2": 12, "9.3.0": 12, "9.4.0": 12 },
    LV_STYLE_PAD_TOP: { "8.4.0": 16, "9.2.2": 16, "9.3.0": 16, "9.4.0": 16 },
    LV_STYLE_PAD_BOTTOM: { "8.4.0": 17, "9.2.2": 17, "9.3.0": 17, "9.4.0": 17 },
    LV_STYLE_PAD_LEFT: { "8.4.0": 18, "9.2.2": 18, "9.3.0": 18, "9.4.0": 18 },
    LV_STYLE_PAD_RIGHT: { "8.4.0": 19, "9.2.2": 19, "9.3.0": 19, "9.4.0": 19 },
    LV_STYLE_PAD_ROW: { "8.4.0": 20, "9.2.2": 20, "9.3.0": 20, "9.4.0": 20 },
    LV_STYLE_PAD_COLUMN: { "8.4.0": 21, "9.2.2": 21, "9.3.0": 21, "9.4.0": 21 },
    LV_STYLE_LAYOUT: { "8.4.0": 10, "9.2.2": 22, "9.3.0": 22, "9.4.0": 22 },
    LV_STYLE_MARGIN_TOP: { "8.4.0": undefined, "9.2.2": 24, "9.3.0": 24, "9.4.0": 24 },
    LV_STYLE_MARGIN_BOTTOM: { "8.4.0": undefined, "9.2.2": 25, "9.3.0": 25, "9.4.0": 25 },
    LV_STYLE_MARGIN_LEFT: { "8.4.0": undefined, "9.2.2": 26, "9.3.0": 26, "9.4.0": 26 },
    LV_STYLE_MARGIN_RIGHT: { "8.4.0": undefined, "9.2.2": 27, "9.3.0": 27, "9.4.0": 27 },
    LV_STYLE_BG_COLOR: { "8.4.0": 32, "9.2.2": 28, "9.3.0": 28, "9.4.0": 28 },
    LV_STYLE_BG_OPA: { "8.4.0": 33, "9.2.2": 29, "9.3.0": 29, "9.4.0": 29 },
    LV_STYLE_BG_GRAD_DIR: { "8.4.0": 35, "9.2.2": 32, "9.3.0": 32, "9.4.0": 32 },
    LV_STYLE_BG_MAIN_STOP: { "8.4.0": 36, "9.2.2": 33, "9.3.0": 33, "9.4.0": 33 },
    LV_STYLE_BG_GRAD_STOP: { "8.4.0": 37, "9.2.2": 34, "9.3.0": 34, "9.4.0": 34 },
    LV_STYLE_BG_GRAD_COLOR: { "8.4.0": 34, "9.2.2": 35, "9.3.0": 35, "9.4.0": 35 },
    LV_STYLE_BG_MAIN_OPA: { "8.4.0": undefined, "9.2.2": 36, "9.3.0": 36, "9.4.0": 36 },
    LV_STYLE_BG_GRAD_OPA: { "8.4.0": undefined, "9.2.2": 37, "9.3.0": 37, "9.4.0": 37 },
    LV_STYLE_BG_GRAD: { "8.4.0": 38, "9.2.2": 38, "9.3.0": 38, "9.4.0": 38 },
    LV_STYLE_BASE_DIR: { "8.4.0": 22, "9.2.2": 39, "9.3.0": 39, "9.4.0": 39 },
    LV_STYLE_BG_DITHER_MODE: { "8.4.0": 39, "9.2.2": undefined, "9.3.0": undefined, "9.4.0": undefined },
    LV_STYLE_BG_IMG_SRC: { "8.4.0": 40, "9.2.2": 40, "9.3.0": 40, "9.4.0": 40 },
    LV_STYLE_BG_IMG_OPA: { "8.4.0": 41, "9.2.2": 41, "9.3.0": 41, "9.4.0": 41 },
    LV_STYLE_BG_IMG_RECOLOR: { "8.4.0": 42, "9.2.2": 42, "9.3.0": 42, "9.4.0": 42 },
    LV_STYLE_BG_IMG_RECOLOR_OPA: { "8.4.0": 43, "9.2.2": 43, "9.3.0": 43, "9.4.0": 43 },
    LV_STYLE_BG_IMG_TILED: { "8.4.0": 44, "9.2.2": 44, "9.3.0": 44, "9.4.0": 44 },
    LV_STYLE_CLIP_CORNER: { "8.4.0": 23, "9.2.2": 45, "9.3.0": 45, "9.4.0": 45 },
    LV_STYLE_BORDER_WIDTH: { "8.4.0": 50, "9.2.2": 48, "9.3.0": 48, "9.4.0": 48 },
    LV_STYLE_BORDER_COLOR: { "8.4.0": 48, "9.2.2": 49, "9.3.0": 49, "9.4.0": 49 },
    LV_STYLE_BORDER_OPA: { "8.4.0": 49, "9.2.2": 50, "9.3.0": 50, "9.4.0": 50 },
    LV_STYLE_BORDER_SIDE: { "8.4.0": 51, "9.2.2": 52, "9.3.0": 52, "9.4.0": 52 },
    LV_STYLE_BORDER_POST: { "8.4.0": 52, "9.2.2": 53, "9.3.0": 53, "9.4.0": 53 },
    LV_STYLE_OUTLINE_WIDTH: { "8.4.0": 53, "9.2.2": 56, "9.3.0": 56, "9.4.0": 56 },
    LV_STYLE_OUTLINE_COLOR: { "8.4.0": 54, "9.2.2": 57, "9.3.0": 57, "9.4.0": 57 },
    LV_STYLE_OUTLINE_OPA: { "8.4.0": 55, "9.2.2": 58, "9.3.0": 58, "9.4.0": 58 },
    LV_STYLE_OUTLINE_PAD: { "8.4.0": 56, "9.2.2": 59, "9.3.0": 59, "9.4.0": 59 },
    LV_STYLE_SHADOW_WIDTH: { "8.4.0": 64, "9.2.2": 60, "9.3.0": 60, "9.4.0": 60 },
    LV_STYLE_SHADOW_COLOR: { "8.4.0": 68, "9.2.2": 61, "9.3.0": 61, "9.4.0": 61 },
    LV_STYLE_SHADOW_OPA: { "8.4.0": 69, "9.2.2": 62, "9.3.0": 62, "9.4.0": 62 },
    LV_STYLE_SHADOW_OFS_X: { "8.4.0": 65, "9.2.2": 64, "9.3.0": 64, "9.4.0": 64 },
    LV_STYLE_SHADOW_OFS_Y: { "8.4.0": 66, "9.2.2": 65, "9.3.0": 65, "9.4.0": 65 },
    LV_STYLE_SHADOW_SPREAD: { "8.4.0": 67, "9.2.2": 66, "9.3.0": 66, "9.4.0": 66 },
    LV_STYLE_IMG_OPA: { "8.4.0": 70, "9.2.2": 68, "9.3.0": 68, "9.4.0": 68 },
    LV_STYLE_IMG_RECOLOR: { "8.4.0": 71, "9.2.2": 69, "9.3.0": 69, "9.4.0": 69 },
    LV_STYLE_IMG_RECOLOR_OPA: { "8.4.0": 72, "9.2.2": 70, "9.3.0": 70, "9.4.0": 70 },
    LV_STYLE_LINE_WIDTH: { "8.4.0": 73, "9.2.2": 72, "9.3.0": 72, "9.4.0": 72 },
    LV_STYLE_LINE_DASH_WIDTH: { "8.4.0": 74, "9.2.2": 73, "9.3.0": 73, "9.4.0": 73 },
    LV_STYLE_LINE_DASH_GAP: { "8.4.0": 75, "9.2.2": 74, "9.3.0": 74, "9.4.0": 74 },
    LV_STYLE_LINE_ROUNDED: { "8.4.0": 76, "9.2.2": 75, "9.3.0": 75, "9.4.0": 75 },
    LV_STYLE_LINE_COLOR: { "8.4.0": 77, "9.2.2": 76, "9.3.0": 76, "9.4.0": 76 },
    LV_STYLE_LINE_OPA: { "8.4.0": 78, "9.2.2": 77, "9.3.0": 77, "9.4.0": 77 },
    LV_STYLE_ARC_WIDTH: { "8.4.0": 80, "9.2.2": 80, "9.3.0": 80, "9.4.0": 80 },
    LV_STYLE_ARC_ROUNDED: { "8.4.0": 81, "9.2.2": 81, "9.3.0": 81, "9.4.0": 81 },
    LV_STYLE_ARC_COLOR: { "8.4.0": 82, "9.2.2": 82, "9.3.0": 82, "9.4.0": 82 },
    LV_STYLE_ARC_OPA: { "8.4.0": 83, "9.2.2": 83, "9.3.0": 83, "9.4.0": 83 },
    LV_STYLE_ARC_IMG_SRC: { "8.4.0": 84, "9.2.2": 84, "9.3.0": 84, "9.4.0": 84 },
    LV_STYLE_TEXT_COLOR: { "8.4.0": 85, "9.2.2": 88, "9.3.0": 88, "9.4.0": 88 },
    LV_STYLE_TEXT_OPA: { "8.4.0": 86, "9.2.2": 89, "9.3.0": 89, "9.4.0": 89 },
    LV_STYLE_TEXT_FONT: { "8.4.0": 87, "9.2.2": 90, "9.3.0": 90, "9.4.0": 90 },
    LV_STYLE_TEXT_LETTER_SPACE: { "8.4.0": 88, "9.2.2": 91, "9.3.0": 91, "9.4.0": 91 },
    LV_STYLE_TEXT_LINE_SPACE: { "8.4.0": 89, "9.2.2": 92, "9.3.0": 92, "9.4.0": 92 },
    LV_STYLE_TEXT_DECOR: { "8.4.0": 90, "9.2.2": 93, "9.3.0": 93, "9.4.0": 93 },
    LV_STYLE_TEXT_ALIGN: { "8.4.0": 91, "9.2.2": 94, "9.3.0": 94, "9.4.0": 94 },
    LV_STYLE_OPA: { "8.4.0": 96, "9.2.2": 95, "9.3.0": 98, "9.4.0": 98 },
    LV_STYLE_OPA_LAYERED: { "8.4.0": 97, "9.2.2": 96, "9.3.0": 99, "9.4.0": 99 },
    LV_STYLE_COLOR_FILTER_DSC: { "8.4.0": 98, "9.2.2": 97, "9.3.0": 100, "9.4.0": 100 },
    LV_STYLE_COLOR_FILTER_OPA: { "8.4.0": 99, "9.2.2": 98, "9.3.0": 101, "9.4.0": 101 },
    LV_STYLE_ANIM: { "8.4.0": 100, "9.2.2": 99, "9.3.0": 102, "9.4.0": 102 },
    LV_STYLE_ANIM_TIME: { "8.4.0": 101, "9.2.2": undefined, "9.3.0": undefined, "9.4.0": undefined },
    LV_STYLE_ANIM_DURATION: { "8.4.0": undefined, "9.2.2": 100, "9.3.0": 103, "9.4.0": 103 },
    LV_STYLE_ANIM_SPEED: { "8.4.0": 102, "9.2.2": undefined, "9.3.0": undefined, "9.4.0": undefined },
    LV_STYLE_TRANSITION: { "8.4.0": 103, "9.2.2": 102, "9.3.0": 104, "9.4.0": 104 },
    LV_STYLE_BLEND_MODE: { "8.4.0": 104, "9.2.2": 103, "9.3.0": 105, "9.4.0": 105 },
    LV_STYLE_TRANSFORM_WIDTH: { "8.4.0": 105, "9.2.2": 104, "9.3.0": 106, "9.4.0": 106 },
    LV_STYLE_TRANSFORM_HEIGHT: { "8.4.0": 106, "9.2.2": 105, "9.3.0": 107, "9.4.0": 107 },
    LV_STYLE_TRANSLATE_X: { "8.4.0": 107, "9.2.2": 106, "9.3.0": 108, "9.4.0": 108 },
    LV_STYLE_TRANSLATE_Y: { "8.4.0": 108, "9.2.2": 107, "9.3.0": 109, "9.4.0": 109 },
    LV_STYLE_TRANSFORM_ZOOM: { "8.4.0": 109, "9.2.2": undefined, "9.3.0": undefined, "9.4.0": undefined },
    LV_STYLE_TRANSFORM_SCALE_X: { "8.4.0": undefined, "9.2.2": 108, "9.3.0": 110, "9.4.0": 110 },
    LV_STYLE_TRANSFORM_SCALE_Y: { "8.4.0": undefined, "9.2.2": 109, "9.3.0": 111, "9.4.0": 111 },
    LV_STYLE_TRANSFORM_ANGLE: { "8.4.0": 110, "9.2.2": undefined, "9.3.0": undefined, "9.4.0": undefined },
    LV_STYLE_TRANSFORM_ROTATION: { "8.4.0": undefined, "9.2.2": 110, "9.3.0": 112, "9.4.0": 112 },
    LV_STYLE_TRANSFORM_PIVOT_X: { "8.4.0": 111, "9.2.2": 111, "9.3.0": 113, "9.4.0": 113 },
    LV_STYLE_TRANSFORM_PIVOT_Y: { "8.4.0": 112, "9.2.2": 112, "9.3.0": 114, "9.4.0": 114 },
    LV_STYLE_TRANSFORM_SKEW_X: { "8.4.0": undefined, "9.2.2": 113, "9.3.0": 115, "9.4.0": 115 },
    LV_STYLE_TRANSFORM_SKEW_Y: { "8.4.0": undefined, "9.2.2": 114, "9.3.0": 116, "9.4.0": 116 },
    LV_STYLE_FLEX_FLOW: { "8.4.0": 113, "9.2.2": 125, "9.3.0": 122, "9.4.0": 122 },
    LV_STYLE_FLEX_MAIN_PLACE: { "8.4.0": 114, "9.2.2": 126, "9.3.0": 123, "9.4.0": 123 },
    LV_STYLE_FLEX_CROSS_PLACE: { "8.4.0": 115, "9.2.2": 127, "9.3.0": 124, "9.4.0": 124 },
    LV_STYLE_FLEX_TRACK_PLACE: { "8.4.0": 116, "9.2.2": 128, "9.3.0": 125, "9.4.0": 125 },
    LV_STYLE_FLEX_GROW: { "8.4.0": 117, "9.2.2": 129, "9.3.0": 126, "9.4.0": 126 },
    LV_STYLE_GRID_COLUMN_ALIGN: { "8.4.0": 120, "9.2.2": 130, "9.3.0": 127, "9.4.0": 127 },
    LV_STYLE_GRID_ROW_ALIGN: { "8.4.0": 121, "9.2.2": 131, "9.3.0": 128, "9.4.0": 128 },
    LV_STYLE_GRID_ROW_DSC_ARRAY: { "8.4.0": 119, "9.2.2": 132, "9.3.0": 129, "9.4.0": 129 },
    LV_STYLE_GRID_COLUMN_DSC_ARRAY: { "8.4.0": 118, "9.2.2": 133, "9.3.0": 130, "9.4.0": 130 },
    LV_STYLE_GRID_CELL_COLUMN_POS: { "8.4.0": 125, "9.2.2": 134, "9.3.0": 131, "9.4.0": 131 },
    LV_STYLE_GRID_CELL_COLUMN_SPAN: { "8.4.0": 124, "9.2.2": 135, "9.3.0": 132, "9.4.0": 132 },
    LV_STYLE_GRID_CELL_X_ALIGN: { "8.4.0": 126, "9.2.2": 136, "9.3.0": 133, "9.4.0": 133 },
    LV_STYLE_GRID_CELL_ROW_POS: { "8.4.0": 123, "9.2.2": 137, "9.3.0": 134, "9.4.0": 134 },
    LV_STYLE_GRID_CELL_ROW_SPAN: { "8.4.0": 122, "9.2.2": 138, "9.3.0": 135, "9.4.0": 135 },
    LV_STYLE_GRID_CELL_Y_ALIGN: { "8.4.0": 127, "9.2.2": 139, "9.3.0": 136, "9.4.0": 136 },
};

////////////////////////////////////////////////////////////////////////////////

const _LV_FLEX_COLUMN = 1 << 0;
const _LV_FLEX_WRAP = 1 << 2;
const _LV_FLEX_REVERSE = 1 << 3;

export const LV_LAYOUT_NONE = 0;
export const LV_LAYOUT_FLEX = 1;
export const LV_LAYOUT_GRID = 2;

export const LV_FLEX_FLOW_ROW = 0x00;
export const LV_FLEX_FLOW_COLUMN = _LV_FLEX_COLUMN;
export const LV_FLEX_FLOW_ROW_WRAP = LV_FLEX_FLOW_ROW | _LV_FLEX_WRAP;
export const LV_FLEX_FLOW_ROW_REVERSE = LV_FLEX_FLOW_ROW | _LV_FLEX_REVERSE;
export const LV_FLEX_FLOW_ROW_WRAP_REVERSE =
    LV_FLEX_FLOW_ROW | _LV_FLEX_WRAP | _LV_FLEX_REVERSE;
export const LV_FLEX_FLOW_COLUMN_WRAP = LV_FLEX_FLOW_COLUMN | _LV_FLEX_WRAP;
export const LV_FLEX_FLOW_COLUMN_REVERSE =
    LV_FLEX_FLOW_COLUMN | _LV_FLEX_REVERSE;
export const LV_FLEX_FLOW_COLUMN_WRAP_REVERSE =
    LV_FLEX_FLOW_COLUMN | _LV_FLEX_WRAP | _LV_FLEX_REVERSE;

export const LV_FLEX_ALIGN_START = 0;
export const LV_FLEX_ALIGN_END = 1;
export const LV_FLEX_ALIGN_CENTER = 2;
export const LV_FLEX_ALIGN_SPACE_EVENLY = 3;
export const LV_FLEX_ALIGN_SPACE_AROUND = 4;
export const LV_FLEX_ALIGN_SPACE_BETWEEN = 5;

export const LV_GRID_ALIGN_START = 0;
export const LV_GRID_ALIGN_CENTER = 1;
export const LV_GRID_ALIGN_END = 2;
export const LV_GRID_ALIGN_STRETCH = 3;
export const LV_GRID_ALIGN_SPACE_EVENLY = 4;
export const LV_GRID_ALIGN_SPACE_AROUND = 5;
export const LV_GRID_ALIGN_SPACE_BETWEEN = 6;

const LV_SCROLLBAR_MODE_OFF = 0;
const LV_SCROLLBAR_MODE_ON = 1;
const LV_SCROLLBAR_MODE_ACTIVE = 2;
const LV_SCROLLBAR_MODE_AUTO = 3;

export const LVGL_SCROLL_BAR_MODES: { [key: string]: number } = {
    off: LV_SCROLLBAR_MODE_OFF,
    on: LV_SCROLLBAR_MODE_ON,
    active: LV_SCROLLBAR_MODE_ACTIVE,
    auto: LV_SCROLLBAR_MODE_AUTO
};

////////////////////////////////////////////////////////////////////////////////

export const LV_DIR_NONE = 0x00;
export const LV_DIR_LEFT = 1 << 0;
export const LV_DIR_RIGHT = 1 << 1;
export const LV_DIR_TOP = 1 << 2;
export const LV_DIR_BOTTOM = 1 << 3;
export const LV_DIR_HOR = LV_DIR_LEFT | LV_DIR_RIGHT;
export const LV_DIR_VER = LV_DIR_TOP | LV_DIR_BOTTOM;
export const LV_DIR_ALL = LV_DIR_HOR | LV_DIR_VER;

export const LVGL_DIR_ENUM_NAME = "$LVGLDir";

////////////////////////////////////////////////////////////////////////////////

export const LV_KEY_UP = 17;
export const LV_KEY_DOWN = 18;
export const LV_KEY_RIGHT = 19;
export const LV_KEY_LEFT = 20;
export const LV_KEY_ESC = 27;
export const LV_KEY_DEL = 127;
export const LV_KEY_BACKSPACE = 8;
export const LV_KEY_ENTER = 10;
export const LV_KEY_NEXT = 9;
export const LV_KEY_PREV = 11;
export const LV_KEY_HOME = 2;
export const LV_KEY_END = 3;

export const LVGL_KEY_ENUM_NAME = "$LVGLKey";

////////////////////////////////////////////////////////////////////////////////

export const LVGL_SCROLL_DIRECTION: { [key: string]: number } = {
    none: LV_DIR_NONE,
    left: LV_DIR_LEFT,
    right: LV_DIR_RIGHT,
    top: LV_DIR_TOP,
    bottom: LV_DIR_BOTTOM,
    hor: LV_DIR_HOR,
    ver: LV_DIR_VER,
    all: LV_DIR_ALL
};

export const LV_ANIM_OFF = 0;
export const LV_ANIM_ON = 1;

////////////////////////////////////////////////////////////////////////////////

const LV_SCROLL_SNAP_NONE = 0;
const LV_SCROLL_SNAP_START = 1;
const LV_SCROLL_SNAP_END = 2;
const LV_SCROLL_SNAP_CENTER = 3;

export const LVGL_SCROLL_SNAP: { [key: string]: number } = {
    none: LV_SCROLL_SNAP_NONE,
    start: LV_SCROLL_SNAP_START,
    end: LV_SCROLL_SNAP_END,
    center: LV_SCROLL_SNAP_CENTER
};

////////////////////////////////////////////////////////////////////////////////

export const LVGL_FLAG_CODES = {
    HIDDEN: 1 << 0, // Make the object hidden. (Like it wasn't there at all)
    CLICKABLE: 1 << 1, // Make the object clickable by the input devices
    CLICK_FOCUSABLE: 1 << 2, // Add focused state to the object when clicked
    CHECKABLE: 1 << 3, // Toggle checked state when the object is clicked
    SCROLLABLE: 1 << 4, // Make the object scrollable
    SCROLL_ELASTIC: 1 << 5, // Allow scrolling inside but with slower speed
    SCROLL_MOMENTUM: 1 << 6, // Make the object scroll further when "thrown"
    SCROLL_ONE: 1 << 7, // Allow scrolling only one snappable children
    SCROLL_CHAIN_HOR: 1 << 8, // Allow propagating the horizontal scroll to a parent
    SCROLL_CHAIN_VER: 1 << 9, // Allow propagating the vertical scroll to a parent
    SCROLL_ON_FOCUS: 1 << 10, // Automatically scroll object to make it visible when focused
    SCROLL_WITH_ARROW: 1 << 11, // Allow scrolling the focused object with arrow keys
    SNAPPABLE: 1 << 12, // If scroll snap is enabled on the parent it can snap to this object
    PRESS_LOCK: 1 << 13, // Keep the object pressed even if the press slid from the object
    EVENT_BUBBLE: 1 << 14, // Propagate the events to the parent too
    GESTURE_BUBBLE: 1 << 15, // Propagate the gestures to the parent
    ADV_HITTEST: 1 << 16, // Allow performing more accurate hit (click) test. E.g. consider rounded corners.
    IGNORE_LAYOUT: 1 << 17, // Make the object position-able by the layouts
    FLOATING: 1 << 18, // Do not scroll the object when the parent scrolls and ignore layout
    OVERFLOW_VISIBLE: 1 << 19 // Do not clip the children's content to the parent's boundary*/
};

export const LVGL_FLAG_CODES_90 = {
    HIDDEN: 1 << 0, // Make the object hidden. (Like it wasn't there at all)
    CLICKABLE: 1 << 1, // Make the object clickable by the input devices
    CLICK_FOCUSABLE: 1 << 2, // Add focused state to the object when clicked
    CHECKABLE: 1 << 3, // Toggle checked state when the object is clicked
    SCROLLABLE: 1 << 4, // Make the object scrollable
    SCROLL_ELASTIC: 1 << 5, // Allow scrolling inside but with slower speed
    SCROLL_MOMENTUM: 1 << 6, // Make the object scroll further when "thrown"
    SCROLL_ONE: 1 << 7, // Allow scrolling only one snappable children
    SCROLL_CHAIN_HOR: 1 << 8, // Allow propagating the horizontal scroll to a parent
    SCROLL_CHAIN_VER: 1 << 9, // Allow propagating the vertical scroll to a parent
    SCROLL_ON_FOCUS: 1 << 10, // Automatically scroll object to make it visible when focused
    SCROLL_WITH_ARROW: 1 << 11, // Allow scrolling the focused object with arrow keys
    SNAPPABLE: 1 << 12, // If scroll snap is enabled on the parent it can snap to this object
    PRESS_LOCK: 1 << 13, // Keep the object pressed even if the press slid from the object
    EVENT_BUBBLE: 1 << 14, // Propagate the events to the parent too
    GESTURE_BUBBLE: 1 << 15, // Propagate the gestures to the parent
    ADV_HITTEST: 1 << 16, // Allow performing more accurate hit (click) test. E.g. consider rounded corners.
    IGNORE_LAYOUT: 1 << 17, // Make the object position-able by the layouts
    FLOATING: 1 << 18, // Do not scroll the object when the parent scrolls and ignore layout
    OVERFLOW_VISIBLE: 1 << 20 // Do not clip the children's content to the parent's boundary*/
};

export const LV_OBJ_FLAG_ENUM_NAME = "LV_OBJ_FLAG";

////////////////////////////////////////////////////////////////////////////////

export const LVGL_REACTIVE_FLAGS: (keyof typeof LVGL_FLAG_CODES)[] = [
    "HIDDEN",
    "CLICKABLE"
];

export const LVGL_STATE_CODES = {
    CHECKED: 0x0001,
    DISABLED: 0x0080,
    FOCUSED: 0x0002,
    FOCUS_KEY: 0x0004,
    PRESSED: 0x0020
};

export const LVGL_REACTIVE_STATES: (keyof typeof LVGL_STATE_CODES)[] = [
    "CHECKED",
    "DISABLED"
];

export const LVGL_STYLE_STATES = [
    "DEFAULT",
    "CHECKED",
    "PRESSED",
    "CHECKED|PRESSED",
    "DISABLED",
    "FOCUSED",
    "FOCUS_KEY",
    "EDITED",
    "SCROLLED"
];

export const LV_STATE_ENUM_NAME = "LV_STATE";

////////////////////////////////////////////////////////////////////////////////

export const lvglStates = {
    DEFAULT: 0x0000, // LV_STATE_DEFAULT
    CHECKED: 0x0001, // LV_STATE_CHECKED
    FOCUSED: 0x0002, // LV_STATE_FOCUSED,
    FOCUS_KEY: 0x0004, // LV_STATE_FOCUS_KEY
    EDITED: 0x0008, // LV_STATE_EDITED,
    HOVERED: 0x0010, // LV_STATE_HOVERED
    PRESSED: 0x0020, // LV_STATE_PRESSED
    SCROLLED: 0x0040, // LV_STATE_SCROLLED
    DISABLED: 0x0080, // LV_STATE_DISABLED

    USER_1: 0x1000, // LV_STATE_USER_1,
    USER_2: 0x2000, // LV_STATE_USER_1,
    USER_3: 0x4000, // LV_STATE_USER_1,
    USER_4: 0x8000, // LV_STATE_USER_1,

    ANY: 0xffff // Special value can be used in some functions to target all states
};

////////////////////////////////////////////////////////////////////////////////

export const LVGL_PARTS_8: { [key: string]: number } = {
    MAIN: 0x000000, // LV_PART_MAIN         A background like rectangle
    SCROLLBAR: 0x010000, // LV_PART_SCROLLBAR    The scrollbar(s)
    INDICATOR: 0x020000, // LV_PART_INDICATOR    Indicator, e.g. for slider, bar, switch, or the tick box of the checkbox
    KNOB: 0x030000, // LV_PART_KNOB         Like handle to grab to adjust the value
    SELECTED: 0x040000, // LV_PART_SELECTED     Indicate the currently selected option or section
    ITEMS: 0x050000, // LV_PART_ITEMS        Used if the widget has multiple similar elements (e.g. table cells)
    TICKS: 0x060000, // LV_PART_TICKS        Ticks on scale e.g. for a chart or meter
    CURSOR: 0x070000, // LV_PART_CURSOR       Mark a specific place e.g. for text area's cursor or on a chart

    CUSTOM1: 0x080000, // LV_PART_CUSTOM_FIRST Extension point for custom widgets
    TEXTAREA_PLACEHOLDER: 0x080000,

    ANY: 0x0f0000 // LV_PART_ANY          Special value can be used in some functions to target all parts
};

export const LVGL_PARTS_9: { [key: string]: number } = {
    MAIN: 0x000000, // LV_PART_MAIN         A background like rectangle
    SCROLLBAR: 0x010000, // LV_PART_SCROLLBAR    The scrollbar(s)
    INDICATOR: 0x020000, // LV_PART_INDICATOR    Indicator, e.g. for slider, bar, switch, or the tick box of the checkbox
    KNOB: 0x030000, // LV_PART_KNOB         Like handle to grab to adjust the value
    SELECTED: 0x040000, // LV_PART_SELECTED     Indicate the currently selected option or section
    ITEMS: 0x050000, // LV_PART_ITEMS        Used if the widget has multiple similar elements (e.g. table cells)
    CURSOR: 0x060000, // LV_PART_CURSOR       Mark a specific place e.g. for text area's cursor or on a chart

    CUSTOM1: 0x080000, // LV_PART_CUSTOM_FIRST Extension point for custom widgets
    TEXTAREA_PLACEHOLDER: 0x080000,

    ANY: 0x0f0000 // LV_PART_ANY          Special value can be used in some functions to target all parts
};

////////////////////////////////////////////////////////////////////////////////

export const LV_EVENT_CHECKED = 0x7e;
export const LV_EVENT_UNCHECKED = 0x7f;

export const LVGL_EVENTS_V8 = {
    PRESSED: { code: 1, paramExpressionType: "event" },
    PRESSING: { code: 2, paramExpressionType: "event" },
    PRESS_LOST: { code: 3, paramExpressionType: "event" },
    SHORT_CLICKED: { code: 4, paramExpressionType: "event" },
    LONG_PRESSED: { code: 5, paramExpressionType: "event" },
    LONG_PRESSED_REPEAT: { code: 6, paramExpressionType: "event" },
    CLICKED: { code: 7, paramExpressionType: "event" },
    RELEASED: { code: 8, paramExpressionType: "event" },
    SCROLL_BEGIN: { code: 9, paramExpressionType: "event" },
    SCROLL_END: { code: 10, paramExpressionType: "event" },
    SCROLL: { code: 11, paramExpressionType: "event" },
    GESTURE: { code: 12, paramExpressionType: "event" },
    KEY: { code: 13, paramExpressionType: "event" },
    FOCUSED: { code: 14, paramExpressionType: "event" },
    DEFOCUSED: { code: 15, paramExpressionType: "event" },
    LEAVE: { code: 16, paramExpressionType: "event" },
    HIT_TEST: { code: 17, paramExpressionType: "event" },

    COVER_CHECK: { code: 18, paramExpressionType: "event" },
    REFR_EXT_DRAW_SIZE: { code: 19, paramExpressionType: "event" },
    DRAW_MAIN_BEGIN: { code: 20, paramExpressionType: "event" },
    DRAW_MAIN: { code: 21, paramExpressionType: "event" },
    DRAW_MAIN_END: { code: 22, paramExpressionType: "event" },
    DRAW_POST_BEGIN: { code: 23, paramExpressionType: "event" },
    DRAW_POST: { code: 24, paramExpressionType: "event" },
    DRAW_POST_END: { code: 25, paramExpressionType: "event" },
    DRAW_PART_BEGIN: { code: 26, paramExpressionType: "event" },
    DRAW_PART_END: { code: 27, paramExpressionType: "event" },

    VALUE_CHANGED: { code: 28, paramExpressionType: "event" },
    INSERT: { code: 29, paramExpressionType: "event" },
    REFRESH: { code: 30, paramExpressionType: "event" },
    READY: { code: 31, paramExpressionType: "event" },
    CANCEL: { code: 32, paramExpressionType: "event" },

    DELETE: { code: 33, paramExpressionType: "event" },
    CHILD_CHANGED: { code: 34, paramExpressionType: "event" },
    CHILD_CREATED: { code: 35, paramExpressionType: "event" },
    CHILD_DELETED: { code: 36, paramExpressionType: "event" },

    SCREEN_UNLOAD_START: { code: 37, paramExpressionType: "event" },
    SCREEN_LOAD_START: { code: 38, paramExpressionType: "event" },
    SCREEN_LOADED: { code: 39, paramExpressionType: "event" },
    SCREEN_UNLOADED: { code: 40, paramExpressionType: "event" },

    SIZE_CHANGED: { code: 41, paramExpressionType: "event" },
    STYLE_CHANGED: { code: 42, paramExpressionType: "event" },
    LAYOUT_CHANGED: { code: 43, paramExpressionType: "event" },
    GET_SELF_SIZE: { code: 44, paramExpressionType: "event" },

    CHECKED: { code: LV_EVENT_CHECKED, paramExpressionType: "event" },
    UNCHECKED: { code: LV_EVENT_UNCHECKED, paramExpressionType: "event" }
} as WidgetEvents;

export const LVGL_EVENTS_V9_2_2 = {
    PRESSED: { code: 1, paramExpressionType: "event" },
    PRESSING: { code: 2, paramExpressionType: "event" },
    PRESS_LOST: { code: 3, paramExpressionType: "event" },
    SHORT_CLICKED: { code: 4, paramExpressionType: "event" },
    LONG_PRESSED: { code: 5, paramExpressionType: "event" },
    LONG_PRESSED_REPEAT: { code: 6, paramExpressionType: "event" },
    CLICKED: { code: 7, paramExpressionType: "event" },
    RELEASED: { code: 8, paramExpressionType: "event" },
    SCROLL_BEGIN: { code: 9, paramExpressionType: "event" },
    SCROLL_THROW_BEGIN: { code: 10, paramExpressionType: "event" },
    SCROLL_END: { code: 11, paramExpressionType: "event" },
    SCROLL: { code: 12, paramExpressionType: "event" },
    GESTURE: { code: 13, paramExpressionType: "event" },
    KEY: { code: 14, paramExpressionType: "event" },
    ROTARY: { code: 15, paramExpressionType: "event" },
    FOCUSED: { code: 16, paramExpressionType: "event" },
    DEFOCUSED: { code: 17, paramExpressionType: "event" },
    LEAVE: { code: 18, paramExpressionType: "event" },
    HIT_TEST: { code: 19, paramExpressionType: "event" },

    INDEV_RESET: { code: 20, paramExpressionType: "event" },
    HOVER_OVER: { code: 21, paramExpressionType: "event" },
    HOVER_LEAVE: { code: 22, paramExpressionType: "event" },

    COVER_CHECK: { code: 23, paramExpressionType: "event" },
    REFR_EXT_DRAW_SIZE: { code: 24, paramExpressionType: "event" },
    DRAW_MAIN_BEGIN: { code: 25, paramExpressionType: "event" },
    DRAW_MAIN: { code: 26, paramExpressionType: "event" },
    DRAW_MAIN_END: { code: 27, paramExpressionType: "event" },
    DRAW_POST_BEGIN: { code: 28, paramExpressionType: "event" },
    DRAW_POST: { code: 29, paramExpressionType: "event" },
    DRAW_POST_END: { code: 30, paramExpressionType: "event" },
    DRAW_TASK_ADDED: { code: 31, paramExpressionType: "event" },

    VALUE_CHANGED: { code: 32, paramExpressionType: "event" },
    INSERT: { code: 33, paramExpressionType: "event" },
    REFRESH: { code: 34, paramExpressionType: "event" },
    READY: { code: 35, paramExpressionType: "event" },
    CANCEL: { code: 36, paramExpressionType: "event" },

    CREATE: { code: 37, paramExpressionType: "event" },
    DELETE: { code: 38, paramExpressionType: "event" },
    CHILD_CHANGED: { code: 39, paramExpressionType: "event" },
    CHILD_CREATED: { code: 40, paramExpressionType: "event" },
    CHILD_DELETED: { code: 41, paramExpressionType: "event" },

    SCREEN_UNLOAD_START: { code: 42, paramExpressionType: "event" },
    SCREEN_LOAD_START: { code: 43, paramExpressionType: "event" },
    SCREEN_LOADED: { code: 44, paramExpressionType: "event" },
    SCREEN_UNLOADED: { code: 45, paramExpressionType: "event" },

    SIZE_CHANGED: { code: 46, paramExpressionType: "event" },
    STYLE_CHANGED: { code: 47, paramExpressionType: "event" },
    LAYOUT_CHANGED: { code: 48, paramExpressionType: "event" },
    GET_SELF_SIZE: { code: 49, paramExpressionType: "event" },

    INVALIDATE_AREA: { code: 50, paramExpressionType: "event" },
    RESOLUTION_CHANGED: { code: 51, paramExpressionType: "event" },
    COLOR_FORMAT_CHANGED: { code: 52, paramExpressionType: "event" },
    REFR_REQUEST: { code: 53, paramExpressionType: "event" },
    REFR_START: { code: 54, paramExpressionType: "event" },
    REFR_READY: { code: 55, paramExpressionType: "event" },
    RENDER_START: { code: 56, paramExpressionType: "event" },
    RENDER_READY: { code: 57, paramExpressionType: "event" },
    FLUSH_START: { code: 58, paramExpressionType: "event" },
    FLUSH_FINISH: { code: 59, paramExpressionType: "event" },
    FLUSH_WAIT_START: { code: 60, paramExpressionType: "event" },
    FLUSH_WAIT_FINISH: { code: 61, paramExpressionType: "event" },

    VSYNC: { code: 62, paramExpressionType: "event" },

    CHECKED: { code: LV_EVENT_CHECKED, paramExpressionType: "event" },
    UNCHECKED: { code: LV_EVENT_UNCHECKED, paramExpressionType: "event" }
} as WidgetEvents;

export const LVGL_EVENTS_V9_3_0 = {
    PRESSED: { code: 1, paramExpressionType: "event" },
    PRESSING: { code: 2, paramExpressionType: "event" },
    PRESS_LOST: { code: 3, paramExpressionType: "event" },
    SHORT_CLICKED: { code: 4, paramExpressionType: "event" },
    SINGLE_CLICKED: { code: 5, paramExpressionType: "event" },
    DOUBLE_CLICKED: { code: 6, paramExpressionType: "event" },
    TRIPLE_CLICKED: { code: 7, paramExpressionType: "event" },
    LONG_PRESSED: { code: 8, paramExpressionType: "event" },
    LONG_PRESSED_REPEAT: { code: 9, paramExpressionType: "event" },
    CLICKED: { code: 10, paramExpressionType: "event" },
    RELEASED: { code: 11, paramExpressionType: "event" },
    SCROLL_BEGIN: { code: 12, paramExpressionType: "event" },
    SCROLL_THROW_BEGIN: { code: 13, paramExpressionType: "event" },
    SCROLL_END: { code: 14, paramExpressionType: "event" },
    SCROLL: { code: 15, paramExpressionType: "event" },
    GESTURE: { code: 16, paramExpressionType: "event" },
    KEY: { code: 17, paramExpressionType: "event" },
    ROTARY: { code: 18, paramExpressionType: "event" },
    FOCUSED: { code: 19, paramExpressionType: "event" },
    DEFOCUSED: { code: 20, paramExpressionType: "event" },
    LEAVE: { code: 21, paramExpressionType: "event" },
    HIT_TEST: { code: 22, paramExpressionType: "event" },
    INDEV_RESET: { code: 23, paramExpressionType: "event" },
    HOVER_OVER: { code: 24, paramExpressionType: "event" },
    HOVER_LEAVE: { code: 25, paramExpressionType: "event" },

    COVER_CHECK: { code: 26, paramExpressionType: "event" },
    REFR_EXT_DRAW_SIZE: { code: 27, paramExpressionType: "event" },
    DRAW_MAIN_BEGIN: { code: 28, paramExpressionType: "event" },
    DRAW_MAIN: { code: 29, paramExpressionType: "event" },
    DRAW_MAIN_END: { code: 30, paramExpressionType: "event" },
    DRAW_POST_BEGIN: { code: 31, paramExpressionType: "event" },
    DRAW_POST: { code: 32, paramExpressionType: "event" },
    DRAW_POST_END: { code: 33, paramExpressionType: "event" },
    DRAW_TASK_ADDED: { code: 34, paramExpressionType: "event" },

    VALUE_CHANGED: { code: 35, paramExpressionType: "event" },
    INSERT: { code: 36, paramExpressionType: "event" },
    REFRESH: { code: 37, paramExpressionType: "event" },
    READY: { code: 38, paramExpressionType: "event" },
    CANCEL: { code: 39, paramExpressionType: "event" },

    CREATE: { code: 40, paramExpressionType: "event" },
    DELETE: { code: 41, paramExpressionType: "event" },
    CHILD_CHANGED: { code: 42, paramExpressionType: "event" },
    CHILD_CREATED: { code: 43, paramExpressionType: "event" },
    CHILD_DELETED: { code: 44, paramExpressionType: "event" },
    SCREEN_UNLOAD_START: { code: 45, paramExpressionType: "event" },
    SCREEN_LOAD_START: { code: 46, paramExpressionType: "event" },
    SCREEN_LOADED: { code: 47, paramExpressionType: "event" },
    SCREEN_UNLOADED: { code: 48, paramExpressionType: "event" },
    SIZE_CHANGED: { code: 49, paramExpressionType: "event" },
    STYLE_CHANGED: { code: 50, paramExpressionType: "event" },
    LAYOUT_CHANGED: { code: 51, paramExpressionType: "event" },
    GET_SELF_SIZE: { code: 52, paramExpressionType: "event" },

    INVALIDATE_AREA: { code: 53, paramExpressionType: "event" },
    RESOLUTION_CHANGED: { code: 54, paramExpressionType: "event" },
    COLOR_FORMAT_CHANGED: { code: 55, paramExpressionType: "event" },
    REFR_REQUEST: { code: 56, paramExpressionType: "event" },
    REFR_START: { code: 57, paramExpressionType: "event" },
    REFR_READY: { code: 58, paramExpressionType: "event" },
    RENDER_START: { code: 59, paramExpressionType: "event" },
    RENDER_READY: { code: 60, paramExpressionType: "event" },
    FLUSH_START: { code: 61, paramExpressionType: "event" },
    FLUSH_FINISH: { code: 62, paramExpressionType: "event" },
    FLUSH_WAIT_START: { code: 63, paramExpressionType: "event" },
    FLUSH_WAIT_FINISH: { code: 64, paramExpressionType: "event" },

    VSYNC: { code: 65, paramExpressionType: "event" },

    CHECKED: { code: LV_EVENT_CHECKED, paramExpressionType: "event" },
    UNCHECKED: { code: LV_EVENT_UNCHECKED, paramExpressionType: "event" }
} as WidgetEvents;

export const LV_EVENT_METER_TICK_LABEL_EVENT = 0x74;
export const LV_EVENT_DROPDOWN_SELECTED_CHANGED = 0x75;
export const LV_EVENT_ROLLER_SELECTED_CHANGED = 0x76;
export const LV_EVENT_TEXTAREA_TEXT_CHANGED = 0x77;
export const LV_EVENT_CHECKED_STATE_CHANGED = 0x78;
export const LV_EVENT_ARC_VALUE_CHANGED = 0x79;
export const LV_EVENT_SLIDER_VALUE_CHANGED = 0x7a;
export const LV_EVENT_SLIDER_VALUE_LEFT_CHANGED = 0x7b;
export const LV_EVENT_SPINBOX_VALUE_CHANGED = 0x7c;
export const LV_EVENT_SPINBOX_STEP_CHANGED = 0x7d;

////////////////////////////////////////////////////////////////////////////////

export const CF_ALPHA_1_BIT = 1;
export const CF_ALPHA_2_BIT = 2;
export const CF_ALPHA_4_BIT = 3;
export const CF_ALPHA_8_BIT = 4;

export const CF_L8 = 0x06;

export const CF_RGB565 = 15;
export const CF_RGB565A8 = 16;

export const CF_TRUE_COLOR = 24;
export const CF_TRUE_COLOR_ALPHA = 32;
export const CF_TRUE_COLOR_CHROMA = 33;

export const CF_INDEXED_1_BIT = 41;
export const CF_INDEXED_2_BIT = 42;
export const CF_INDEXED_4_BIT = 43;
export const CF_INDEXED_8_BIT = 44;

export const CF_RAW = 51;
export const CF_RAW_CHROMA = 52;
export const CF_RAW_ALPHA = 53;

////////////////////////////////////////////////////////////////////////////////

// _lv_label_long_mode_t
export const LONG_MODE_CODES = {
    WRAP: 0,
    DOT: 1,
    SCROLL: 2,
    SCROLL_CIRCULAR: 3,
    CLIP: 4
};

// lv_slider_mode_t
export const SLIDER_MODES = {
    NORMAL: 0,
    SYMMETRICAL: 1,
    RANGE: 2
};

// lv_roller_mode_t
export const ROLLER_MODES = {
    NORMAL: 0,
    INFINITE: 1
};

// lv_bar_mode_t
export const BAR_MODES = {
    NORMAL: 0,
    SYMMETRICAL: 1,
    RANGE: 2
};

// _lv_arc_mode_t
export const ARC_MODES = {
    NORMAL: 0,
    SYMMETRICAL: 1,
    REVERSE: 2
};

// lv_colorwheel_mode_t
export const COLORWHEEL_MODES = {
    HUE: 0,
    SATURATION: 1,
    VALUE: 2
};

// lv_imgbtn_state_t
export const enum ImgbuttonStates {
    LV_IMGBTN_STATE_RELEASED,
    LV_IMGBTN_STATE_PRESSED,
    LV_IMGBTN_STATE_DISABLED,
    LV_IMGBTN_STATE_CHECKED_RELEASED,
    LV_IMGBTN_STATE_CHECKED_PRESSED,
    LV_IMGBTN_STATE_CHECKED_DISABLED
}

// lv_keyboard_mode_t
export const KEYBOARD_MODES = {
    TEXT_LOWER: 0,
    TEXT_UPPER: 1,
    SPECIAL: 2,
    NUMBER: 3,
    USER_1: 4,
    USER_2: 5,
    USER_3: 6,
    USER_4: 7
};

// lv_scale_mode_t, LV_SCALE_MODE_
export const SCALE_MODES = {
    HORIZONTAL_TOP: 0x00,
    HORIZONTAL_BOTTOM: 0x01,
    VERTICAL_LEFT: 0x02,
    VERTICAL_RIGHT: 0x04,
    ROUND_INNER: 0x08,
    ROUND_OUTER: 0x10
};

// _lv_image_align_t
export const LV_IMAGE_ALIGN = {
    DEFAULT: 0,
    TOP_LEFT: 1,
    TOP_MID: 2,
    TOP_RIGHT: 3,
    BOTTOM_LEFT: 4,
    BOTTOM_MID: 5,
    BOTTOM_RIGHT: 6,
    LEFT_MID: 7,
    RIGHT_MID: 8,
    CENTER: 9,
    STRETCH: 11,
    TILE: 12
};

////////////////////////////////////////////////////////////////////////////////

export const LV_SCR_LOAD_ANIM_NONE = 0;
export const LV_SCR_LOAD_ANIM_OVER_LEFT = 1;
export const LV_SCR_LOAD_ANIM_OVER_RIGHT = 2;
export const LV_SCR_LOAD_ANIM_OVER_TOP = 3;
export const LV_SCR_LOAD_ANIM_OVER_BOTTOM = 4;
export const LV_SCR_LOAD_ANIM_MOVE_LEFT = 5;
export const LV_SCR_LOAD_ANIM_MOVE_RIGHT = 6;
export const LV_SCR_LOAD_ANIM_MOVE_TOP = 7;
export const LV_SCR_LOAD_ANIM_MOVE_BOTTOM = 8;
export const LV_SCR_LOAD_ANIM_FADE_IN = 9;
export const LV_SCR_LOAD_ANIM_FADE_OUT = 10;
export const LV_SCR_LOAD_ANIM_OUT_LEFT = 11;
export const LV_SCR_LOAD_ANIM_OUT_RIGHT = 12;
export const LV_SCR_LOAD_ANIM_OUT_TOP = 13;
export const LV_SCR_LOAD_ANIM_OUT_BOTTOM = 14;

export const LV_SCR_LOAD_ANIM_ENUM_NAME = "LV_SCR_LOAD_ANIM";

////////////////////////////////////////////////////////////////////////////////

export const LV_BUTTONMATRIX_CTRL = {
    HIDDEN: 0x0010 /**< Button hidden*/,
    NO_REPEAT: 0x0020 /**< Do not repeat press this button.*/,
    DISABLED: 0x0040 /**< Disable this button.*/,
    CHECKABLE: 0x0080 /**< The button can be toggled.*/,
    CHECKED: 0x0100 /**< Button is currently toggled (e.g. checked).*/,
    CLICK_TRIG: 0x0200 /**< 1: Send LV_EVENT_VALUE_CHANGE on CLICK, 0: Send LV_EVENT_VALUE_CHANGE on PRESS*/,
    POPOVER: 0x0400 /**< Show a popover when pressing this key*/,
    RECOLOR: 0x0800 /**< Enable text recoloring with `#color`*/,
    CUSTOM_1: 0x4000 /**< Custom free to use flag*/,
    CUSTOM_2: 0x8000 /**< Custom free to use flag*/
};

export const LV_BUTTONMATRIX_CTRL_ENUM_NAME = "LV_BUTTONMATRIX_CTRL";

////////////////////////////////////////////////////////////////////////////////

export const LVGL_CONSTANTS_ALL = {
    NULL: 0,

    false: 0,
    true: 1,

    LV_ANIM_OFF: 0,
    LV_ANIM_ON: 1,
    LV_ANIM_REPEAT_INFINITE: 0xffff,

    LV_LABEL_LONG_WRAP: 0,
    LV_LABEL_LONG_DOT: 1,
    LV_LABEL_LONG_SCROLL: 2,
    LV_LABEL_LONG_SCROLL_CIRCULAR: 3,
    LV_LABEL_LONG_CLIP: 4,

    LV_ARC_MODE_NORMAL: 0,
    LV_ARC_MODE_SYMMETRICAL: 1,
    LV_ARC_MODE_REVERSE: 2,

    LV_BAR_MODE_NORMAL: 0,
    LV_BAR_MODE_SYMMETRICAL: 1,
    LV_BAR_MODE_RANGE: 2,

    LV_COLORWHEEL_MODE_HUE: 0,
    LV_COLORWHEEL_MODE_SATURATION: 1,
    LV_COLORWHEEL_MODE_VALUE: 2,

    LV_DIR_NONE,
    LV_DIR_LEFT,
    LV_DIR_RIGHT,
    LV_DIR_TOP,
    LV_DIR_BOTTOM,
    LV_DIR_HOR,
    LV_DIR_VER,
    LV_DIR_ALL,

    LV_IMAGE_ALIGN_DEFAULT: 0,
    LV_IMAGE_ALIGN_TOP_LEFT: 1,
    LV_IMAGE_ALIGN_TOP_MID: 2,
    LV_IMAGE_ALIGN_TOP_RIGHT: 3,
    LV_IMAGE_ALIGN_BOTTOM_LEFT: 4,
    LV_IMAGE_ALIGN_BOTTOM_MID: 5,
    LV_IMAGE_ALIGN_BOTTOM_RIGHT: 6,
    LV_IMAGE_ALIGN_LEFT_MID: 7,
    LV_IMAGE_ALIGN_RIGHT_MID: 8,
    LV_IMAGE_ALIGN_CENTER: 9,
    LV_IMAGE_ALIGN_AUTO_TRANSFORM: 10,
    LV_IMAGE_ALIGN_STRETCH: 11,
    LV_IMAGE_ALIGN_TILE: 12,

    LV_IMAGEBUTTON_STATE_RELEASED: 0,
    LV_IMAGEBUTTON_STATE_PRESSED: 1,
    LV_IMAGEBUTTON_STATE_DISABLED: 2,
    LV_IMAGEBUTTON_STATE_CHECKED_RELEASED: 3,
    LV_IMAGEBUTTON_STATE_CHECKED_PRESSED: 4,
    LV_IMAGEBUTTON_STATE_CHECKED_DISABLED: 5,

    LV_IMGBTN_STATE_RELEASED: 0,
    LV_IMGBTN_STATE_PRESSED: 1,
    LV_IMGBTN_STATE_DISABLED: 2,
    LV_IMGBTN_STATE_CHECKED_RELEASED: 3,
    LV_IMGBTN_STATE_CHECKED_PRESSED: 4,
    LV_IMGBTN_STATE_CHECKED_DISABLED: 5,

    LV_KEYBOARD_MODE_TEXT_LOWER: 0,
    LV_KEYBOARD_MODE_TEXT_UPPER: 1,
    LV_KEYBOARD_MODE_SPECIAL: 2,
    LV_KEYBOARD_MODE_NUMBER: 3,
    LV_KEYBOARD_MODE_USER_1: 4,
    LV_KEYBOARD_MODE_USER_2: 5,
    LV_KEYBOARD_MODE_USER_3: 6,
    LV_KEYBOARD_MODE_USER_4: 7,

    LV_ROLLER_MODE_NORMAL: 0,
    LV_ROLLER_MODE_INFINITE: 1,

    LV_SCALE_MODE_HORIZONTAL_TOP: 0,
    LV_SCALE_MODE_HORIZONTAL_BOTTOM: 1,
    LV_SCALE_MODE_VERTICAL_LEFT: 2,
    LV_SCALE_MODE_VERTICAL_RIGHT: 4,
    LV_SCALE_MODE_ROUND_INNER: 8,
    LV_SCALE_MODE_ROUND_OUTER: 16,

    LV_SLIDER_MODE_NORMAL: 0,
    LV_SLIDER_MODE_SYMMETRICAL: 1,
    LV_SLIDER_MODE_RANGE: 2
};
