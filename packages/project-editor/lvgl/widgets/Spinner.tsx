import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";

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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        return runtime.wasm._lvglCreateSpinner(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        const SPIN_TIME = 1000;
        const ARC_LENGTH = 60;
        if (build.isV9) {
            build.line(`lv_obj_t *obj = lv_spinner_create(parent_obj);`);
            build.line(
                `lv_spinner_set_anim_params(obj, ${SPIN_TIME}, ${ARC_LENGTH});`
            );
        } else {
            build.line(
                `lv_obj_t *obj = lv_spinner_create(parent_obj, ${SPIN_TIME}, ${ARC_LENGTH});`
            );
        }
    }
}
