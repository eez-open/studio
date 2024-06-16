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

const LV_DIR_NONE = 0x00;
const LV_DIR_LEFT = 1 << 0;
const LV_DIR_RIGHT = 1 << 1;
const LV_DIR_TOP = 1 << 2;
const LV_DIR_BOTTOM = 1 << 3;
const LV_DIR_HOR = LV_DIR_LEFT | LV_DIR_RIGHT;
const LV_DIR_VER = LV_DIR_TOP | LV_DIR_BOTTOM;
const LV_DIR_ALL = LV_DIR_HOR | LV_DIR_VER;

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
