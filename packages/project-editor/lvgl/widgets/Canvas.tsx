import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";

////////////////////////////////////////////////////////////////////////////////

export class LVGLCanvasWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M3 18h4.382l-1.277 2.553a1 1 0 0 0 1.79.894L9.618 18H11v2a1 1 0 0 0 2 0v-2h1.382l1.723 3.447a1 1 0 1 0 1.79-.894L16.618 18H21a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-8V3a1 1 0 0 0-2 0v1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1M4 6h16v10H4Z"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "ADV_HITTEST|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
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

        const obj = runtime.wasm._lvglCreateCanvas(
            parentObj,
            runtime.getCreateWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_canvas_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {}
}
