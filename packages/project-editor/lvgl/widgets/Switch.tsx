import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import { SWITCH_WIDGET_ICON } from "project-editor/ui-components/icons";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLSwitchWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 50,
            height: 25,
            clickableFlag: true
        },

        icon: SWITCH_WIDGET_ICON,

        lvgl: {
            parts: ["MAIN", "INDICATOR", "KNOB"],
            defaultFlags:
                "CHECKABLE|CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject(`lv_switch_create`);
    }
}
