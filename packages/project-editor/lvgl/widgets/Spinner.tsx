import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLSpinnerWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 80
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR"],
            defaultFlags:
                "CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags: "GESTURE_BUBBLE|SNAPPABLE|SCROLL_CHAIN",
            oldDefaultFlags: "GESTURE_BUBBLE|SNAPPABLE|SCROLL_CHAIN"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        const SPIN_TIME = 1000;
        const ARC_LENGTH = 60;

        if (code.isV9) {
            code.createObject(`lv_spinner_create`);
            code.callObjectFunction(
                "lv_spinner_set_anim_params",
                SPIN_TIME,
                ARC_LENGTH
            );
        } else {
            code.createObject(`lv_spinner_create`, SPIN_TIME, ARC_LENGTH);
        }
    }
}
