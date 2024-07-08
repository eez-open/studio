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
    LVGL_DIR_ENUM_NAME
} from "../lvgl-constants";

////////////////////////////////////////////////////////////////////////////////

export {
    LVGLArcWidget,
    LVGLBarWidget,
    LVGLDropdownWidget,
    LVGLImageWidget,
    LVGLLabelWidget,
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
