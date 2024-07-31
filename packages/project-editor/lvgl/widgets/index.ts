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
    LVGL_DIR_ENUM_NAME,
    LVGL_KEY_ENUM_NAME
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

registerSystemEnum({
    name: LVGL_DIR_ENUM_NAME,
    members: [
        {
            name: "None",
            value: LV_DIR_NONE
        },
        {
            name: "Left",
            value: LV_DIR_LEFT
        },
        {
            name: "Right",
            value: LV_DIR_RIGHT
        },
        {
            name: "Top",
            value: LV_DIR_TOP
        },
        {
            name: "Bottom",
            value: LV_DIR_BOTTOM
        },
        {
            name: "Hor",
            value: LV_DIR_HOR
        },
        {
            name: "Ver",
            value: LV_DIR_VER
        },
        {
            name: "All",
            value: LV_DIR_ALL
        }
    ],
    projectTypes: [ProjectType.LVGL]
});

registerSystemEnum({
    name: LVGL_KEY_ENUM_NAME,
    members: [
        {
            name: "Up",
            value: LV_KEY_UP
        },
        {
            name: "Down",
            value: LV_KEY_DOWN
        },
        {
            name: "Right",
            value: LV_KEY_RIGHT
        },
        {
            name: "Left",
            value: LV_KEY_LEFT
        },
        {
            name: "Esc",
            value: LV_KEY_ESC
        },
        {
            name: "Del",
            value: LV_KEY_DEL
        },
        {
            name: "Backspace",
            value: LV_KEY_BACKSPACE
        },
        {
            name: "Enter",
            value: LV_KEY_ENTER
        },
        {
            name: "Next",
            value: LV_KEY_NEXT
        },
        {
            name: "Prev",
            value: LV_KEY_PREV
        },
        {
            name: "Home",
            value: LV_KEY_HOME
        },
        {
            name: "End",
            value: LV_KEY_END
        }
    ],
    projectTypes: [ProjectType.LVGL]
});
