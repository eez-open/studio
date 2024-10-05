import { ProjectType, registerClass } from "project-editor/core/object";

import {
    LVGLAnimationImageWidget,
    LVGLArcWidget,
    LVGLBarWidget,
    LVGLButtonMatrixWidget,
    LVGLButtonWidget,
    LVGLCalendarWidget,
    LVGLCanvasWidget,
    LVGLChartWidget,
    LVGLCheckboxWidget,
    LVGLColorwheelWidget,
    LVGLContainerWidget,
    LVGLDropdownWidget,
    LVGLImageWidget,
    LVGLImgbuttonWidget,
    LVGLKeyboardWidget,
    LVGLLabelWidget,
    LVGLLedWidget,
    LVGLLineWidget,
    LVGLListWidget,
    LVGLLottieWidget,
    LVGLMenuWidget,
    LVGLMessageBoxWidget,
    LVGLMeterWidget,
    LVGLPanelWidget,
    LVGLRollerWidget,
    LVGLScaleWidget,
    LVGLScreenWidget,
    LVGLSliderWidget,
    LVGLSpanWidget,
    LVGLSpinboxWidget,
    LVGLSpinnerWidget,
    LVGLSwitchWidget,
    LVGLTableWidget,
    LVGLTabviewWidget,
    LVGLTabWidget,
    LVGLTextareaWidget,
    LVGLTileViewWidget,
    LVGLUserWidgetWidget,
    LVGLWindowWidget
} from "./internal";

import { registerSystemEnum } from "project-editor/features/variable/value-type";
import {
    LV_DIR_ALL,
    LV_DIR_BOTTOM,
    LV_DIR_HOR,
    LV_DIR_LEFT,
    LV_DIR_NONE,
    LV_DIR_RIGHT,
    LV_DIR_TOP,
    LV_DIR_VER,
    LV_KEY_BACKSPACE,
    LV_KEY_DEL,
    LV_KEY_DOWN,
    LV_KEY_END,
    LV_KEY_ENTER,
    LV_KEY_ESC,
    LV_KEY_HOME,
    LV_KEY_LEFT,
    LV_KEY_NEXT,
    LV_KEY_PREV,
    LV_KEY_RIGHT,
    LV_KEY_UP,
    LV_SCR_LOAD_ANIM_FADE_IN,
    LV_SCR_LOAD_ANIM_FADE_OUT,
    LV_SCR_LOAD_ANIM_MOVE_BOTTOM,
    LV_SCR_LOAD_ANIM_MOVE_LEFT,
    LV_SCR_LOAD_ANIM_MOVE_RIGHT,
    LV_SCR_LOAD_ANIM_MOVE_TOP,
    LV_SCR_LOAD_ANIM_NONE,
    LV_SCR_LOAD_ANIM_OUT_BOTTOM,
    LV_SCR_LOAD_ANIM_OUT_LEFT,
    LV_SCR_LOAD_ANIM_OUT_RIGHT,
    LV_SCR_LOAD_ANIM_OUT_TOP,
    LV_SCR_LOAD_ANIM_OVER_BOTTOM,
    LV_SCR_LOAD_ANIM_OVER_LEFT,
    LV_SCR_LOAD_ANIM_OVER_RIGHT,
    LV_SCR_LOAD_ANIM_OVER_TOP,
    LVGL_DIR_ENUM_NAME,
    LVGL_FLAG_CODES,
    LVGL_FLAG_CODES_90,
    LVGL_KEY_ENUM_NAME,
    LV_OBJ_FLAG_ENUM_NAME,
    LV_SCR_LOAD_ANIM_ENUM_NAME,
    LVGL_STATE_CODES,
    LV_STATE_ENUM_NAME
} from "../lvgl-constants";

////////////////////////////////////////////////////////////////////////////////

export {
    LVGLArcWidget,
    LVGLBarWidget,
    LVGLButtonMatrixWidget,
    LVGLDropdownWidget,
    LVGLImageWidget,
    LVGLLabelWidget,
    LVGLLedWidget,
    LVGLKeyboardWidget,
    LVGLPanelWidget,
    LVGLRollerWidget,
    LVGLScreenWidget,
    LVGLSliderWidget,
    LVGLTabviewWidget,
    LVGLTabWidget,
    LVGLTextareaWidget,
    LVGLUserWidgetWidget,
    LVGLWidget
} from "./internal";

////////////////////////////////////////////////////////////////////////////////

registerClass("LVGLAnimationImageWidget", LVGLAnimationImageWidget);
registerClass("LVGLArcWidget", LVGLArcWidget);
registerClass("LVGLBarWidget", LVGLBarWidget);
registerClass("LVGLButtonWidget", LVGLButtonWidget);
registerClass("LVGLButtonMatrixWidget", LVGLButtonMatrixWidget);
registerClass("LVGLCalendarWidget", LVGLCalendarWidget);
registerClass("LVGLChartWidget", LVGLChartWidget);
registerClass("LVGLCheckboxWidget", LVGLCheckboxWidget);
registerClass("LVGLCanvasWidget", LVGLCanvasWidget);
registerClass("LVGLColorwheelWidget", LVGLColorwheelWidget);
registerClass("LVGLContainerWidget", LVGLContainerWidget);
registerClass("LVGLDropdownWidget", LVGLDropdownWidget);
registerClass("LVGLImageWidget", LVGLImageWidget);
registerClass("LVGLImgbuttonWidget", LVGLImgbuttonWidget);
registerClass("LVGLLabelWidget", LVGLLabelWidget);
registerClass("LVGLLedWidget", LVGLLedWidget);
registerClass("LVGLLineWidget", LVGLLineWidget);
registerClass("LVGLListWidget", LVGLListWidget);
registerClass("LVGLLottieWidget", LVGLLottieWidget);
registerClass("LVGLKeyboardWidget", LVGLKeyboardWidget);
registerClass("LVGLMenuWidget", LVGLMenuWidget);
registerClass("LVGLMessageBoxWidget", LVGLMessageBoxWidget);
registerClass("LVGLMeterWidget", LVGLMeterWidget);
registerClass("LVGLPanelWidget", LVGLPanelWidget);
registerClass("LVGLRollerWidget", LVGLRollerWidget);
registerClass("LVGLScaleWidget", LVGLScaleWidget);
registerClass("LVGLScreenWidget", LVGLScreenWidget);
registerClass("LVGLSpanWidget", LVGLSpanWidget);
registerClass("LVGLSpinboxWidget", LVGLSpinboxWidget);
registerClass("LVGLSliderWidget", LVGLSliderWidget);
registerClass("LVGLSpinnerWidget", LVGLSpinnerWidget);
registerClass("LVGLSwitchWidget", LVGLSwitchWidget);
registerClass("LVGLTableWidget", LVGLTableWidget);
registerClass("LVGLTabviewWidget", LVGLTabviewWidget);
registerClass("LVGLTabWidget", LVGLTabWidget);
registerClass("LVGLTextareaWidget", LVGLTextareaWidget);
registerClass("LVGLTileViewWidget", LVGLTileViewWidget);
registerClass("LVGLUserWidgetWidget", LVGLUserWidgetWidget);
registerClass("LVGLWindowWidget", LVGLWindowWidget);

////////////////////////////////////////////////////////////////////////////////

export function registerLvglEnum(
    enumName: string,
    members: { [key: string]: number },
    lvglVersion?: "8.3" | "9.0"
) {
    registerSystemEnum({
        name: enumName,
        members: Object.keys(members).map(key => ({
            name: key,
            value: members[key]
        })),
        projectTypes: [ProjectType.LVGL],
        lvglVersion
    });
}

registerLvglEnum(LVGL_DIR_ENUM_NAME, {
    None: LV_DIR_NONE,
    Left: LV_DIR_LEFT,
    Right: LV_DIR_RIGHT,
    Top: LV_DIR_TOP,
    Bottom: LV_DIR_BOTTOM,
    Hor: LV_DIR_HOR,
    Ver: LV_DIR_VER,
    All: LV_DIR_ALL
});

registerLvglEnum(LVGL_KEY_ENUM_NAME, {
    Up: LV_KEY_UP,
    Down: LV_KEY_DOWN,
    Right: LV_KEY_RIGHT,
    Left: LV_KEY_LEFT,
    Esc: LV_KEY_ESC,
    Del: LV_KEY_DEL,
    Backspace: LV_KEY_BACKSPACE,
    Enter: LV_KEY_ENTER,
    Next: LV_KEY_NEXT,
    Prev: LV_KEY_PREV,
    Home: LV_KEY_HOME,
    End: LV_KEY_END
});

registerLvglEnum(LV_SCR_LOAD_ANIM_ENUM_NAME, {
    NONE: LV_SCR_LOAD_ANIM_NONE,
    OVER_LEFT: LV_SCR_LOAD_ANIM_OVER_LEFT,
    OVER_RIGHT: LV_SCR_LOAD_ANIM_OVER_RIGHT,
    OVER_TOP: LV_SCR_LOAD_ANIM_OVER_TOP,
    OVER_BOTTOM: LV_SCR_LOAD_ANIM_OVER_BOTTOM,
    MOVE_LEFT: LV_SCR_LOAD_ANIM_MOVE_LEFT,
    MOVE_RIGHT: LV_SCR_LOAD_ANIM_MOVE_RIGHT,
    MOVE_TOP: LV_SCR_LOAD_ANIM_MOVE_TOP,
    MOVE_BOTTOM: LV_SCR_LOAD_ANIM_MOVE_BOTTOM,
    FADE_IN: LV_SCR_LOAD_ANIM_FADE_IN,
    FADE_OUT: LV_SCR_LOAD_ANIM_FADE_OUT,
    OUT_LEFT: LV_SCR_LOAD_ANIM_OUT_LEFT,
    OUT_RIGHT: LV_SCR_LOAD_ANIM_OUT_RIGHT,
    OUT_TOP: LV_SCR_LOAD_ANIM_OUT_TOP,
    OUT_BOTTOM: LV_SCR_LOAD_ANIM_OUT_BOTTOM
});

registerLvglEnum(
    LV_OBJ_FLAG_ENUM_NAME,
    {
        HIDDEN: LVGL_FLAG_CODES.HIDDEN,
        CLICKABLE: LVGL_FLAG_CODES.CLICKABLE,
        CLICK_FOCUSABLE: LVGL_FLAG_CODES.CLICK_FOCUSABLE,
        CHECKABLE: LVGL_FLAG_CODES.CHECKABLE,
        SCROLLABLE: LVGL_FLAG_CODES.SCROLLABLE,
        SCROLL_ELASTIC: LVGL_FLAG_CODES.SCROLL_ELASTIC,
        SCROLL_MOMENTUM: LVGL_FLAG_CODES.SCROLL_MOMENTUM,
        SCROLL_ONE: LVGL_FLAG_CODES.SCROLL_ONE,
        SCROLL_CHAIN_HOR: LVGL_FLAG_CODES.SCROLL_CHAIN_HOR,
        SCROLL_CHAIN_VER: LVGL_FLAG_CODES.SCROLL_CHAIN_VER,
        SCROLL_ON_FOCUS: LVGL_FLAG_CODES.SCROLL_ON_FOCUS,
        SCROLL_WITH_ARROW: LVGL_FLAG_CODES.SCROLL_WITH_ARROW,
        SNAPPABLE: LVGL_FLAG_CODES.SNAPPABLE,
        PRESS_LOCK: LVGL_FLAG_CODES.PRESS_LOCK,
        EVENT_BUBBLE: LVGL_FLAG_CODES.EVENT_BUBBLE,
        GESTURE_BUBBLE: LVGL_FLAG_CODES.GESTURE_BUBBLE,
        ADV_HITTEST: LVGL_FLAG_CODES.ADV_HITTEST,
        IGNORE_LAYOUT: LVGL_FLAG_CODES.IGNORE_LAYOUT,
        FLOATING: LVGL_FLAG_CODES.FLOATING,
        OVERFLOW_VISIBLE: LVGL_FLAG_CODES.OVERFLOW_VISIBLE
    },
    "8.3"
);

registerLvglEnum(
    LV_OBJ_FLAG_ENUM_NAME,
    {
        HIDDEN: LVGL_FLAG_CODES_90.HIDDEN,
        CLICKABLE: LVGL_FLAG_CODES_90.CLICKABLE,
        CLICK_FOCUSABLE: LVGL_FLAG_CODES_90.CLICK_FOCUSABLE,
        CHECKABLE: LVGL_FLAG_CODES_90.CHECKABLE,
        SCROLLABLE: LVGL_FLAG_CODES_90.SCROLLABLE,
        SCROLL_ELASTIC: LVGL_FLAG_CODES_90.SCROLL_ELASTIC,
        SCROLL_MOMENTUM: LVGL_FLAG_CODES_90.SCROLL_MOMENTUM,
        SCROLL_ONE: LVGL_FLAG_CODES_90.SCROLL_ONE,
        SCROLL_CHAIN_HOR: LVGL_FLAG_CODES_90.SCROLL_CHAIN_HOR,
        SCROLL_CHAIN_VER: LVGL_FLAG_CODES_90.SCROLL_CHAIN_VER,
        SCROLL_ON_FOCUS: LVGL_FLAG_CODES_90.SCROLL_ON_FOCUS,
        SCROLL_WITH_ARROW: LVGL_FLAG_CODES_90.SCROLL_WITH_ARROW,
        SNAPPABLE: LVGL_FLAG_CODES_90.SNAPPABLE,
        PRESS_LOCK: LVGL_FLAG_CODES_90.PRESS_LOCK,
        EVENT_BUBBLE: LVGL_FLAG_CODES_90.EVENT_BUBBLE,
        GESTURE_BUBBLE: LVGL_FLAG_CODES_90.GESTURE_BUBBLE,
        ADV_HITTEST: LVGL_FLAG_CODES_90.ADV_HITTEST,
        IGNORE_LAYOUT: LVGL_FLAG_CODES_90.IGNORE_LAYOUT,
        FLOATING: LVGL_FLAG_CODES_90.FLOATING,
        OVERFLOW_VISIBLE: LVGL_FLAG_CODES_90.OVERFLOW_VISIBLE
    },
    "9.0"
);

registerLvglEnum(LV_STATE_ENUM_NAME, {
    CHECKED: LVGL_STATE_CODES.CHECKED,
    DISABLED: LVGL_STATE_CODES.DISABLED,
    FOCUSED: LVGL_STATE_CODES.FOCUSED,
    FOCUS_KEY: LVGL_STATE_CODES.FOCUS_KEY,
    PRESSED: LVGL_STATE_CODES.PRESSED
});
