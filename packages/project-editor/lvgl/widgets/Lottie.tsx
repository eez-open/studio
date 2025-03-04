import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLLottieWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "9.0"),

        componentPaletteGroupName: "!1Visualiser",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path d="M17 6c-2.8 0-4.4 2.8-5.9 5.5C9.9 13.8 8.7 16 7 16c-.6 0-1 .4-1 1s.4 1 1 1c2.8 0 4.4-2.8 5.9-5.5C14.1 10.2 15.3 8 17 8c.6 0 1-.4 1-1s-.4-1-1-1m2-4H5C3.3 2 2 3.3 2 5v14c0 1.7 1.3 3 3 3h14c1.7 0 3-1.3 3-3V5c0-1.7-1.3-3-3-3m1 17c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1V5c0-.6.4-1 1-1h14c.6 0 1 .4 1 1z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        if (code.isV9 && code.lvglBuild) {
            code.createObject("lv_lottie_create");
        } else {
            code.createObject("lv_obj_create");
        }
    }
}
