import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";

////////////////////////////////////////////////////////////////////////////////

export class LVGLButtonMatrixWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 240,
            height: 240,
            clickableFlag: true
        },

        icon: (
            <svg viewBox="0 0 522.753 522.752">
                <path d="M151.891 58.183c0-13.072-10.595-23.677-23.677-23.677h-80.87C21.2 34.506 0 53.937 0 77.901c0 23.973 21.2 43.404 47.344 43.404h80.87c13.072 0 23.677-10.595 23.677-23.677zm185.426 0c0-13.072-10.596-23.677-23.677-23.677H209.104c-13.072 0-23.677 10.595-23.677 23.677v39.455c0 13.072 10.595 23.677 23.677 23.677H313.65c13.071 0 23.677-10.595 23.677-23.677V58.183zm138.092-23.667h-80.87c-13.071 0-23.677 10.595-23.677 23.677v39.455c0 13.072 10.596 23.677 23.677 23.677h80.87c26.145 0 47.344-19.431 47.344-43.404s-21.2-43.405-47.344-43.405M151.891 180.497c0-13.072-10.595-23.677-23.677-23.677h-80.87C21.2 156.82 0 176.251 0 200.215c0 23.973 21.2 43.395 47.344 43.395h80.87c13.072 0 23.677-10.595 23.677-23.677zm185.426 0c0-13.072-10.596-23.677-23.677-23.677H209.104c-13.072 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.595 23.677 23.677 23.677H313.65c13.071 0 23.677-10.596 23.677-23.677v-39.445zm138.092-23.667h-80.87c-13.071 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.596 23.677 23.677 23.677h80.87c26.145 0 47.344-19.421 47.344-43.395s-21.2-43.404-47.344-43.404M151.891 302.801c0-13.072-10.595-23.677-23.677-23.677h-80.87C21.2 279.125 0 298.545 0 322.51c0 23.973 21.2 43.404 47.344 43.404h80.87c13.072 0 23.677-10.596 23.677-23.678zm185.426 0c0-13.072-10.596-23.677-23.677-23.677H209.104c-13.072 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.595 23.678 23.677 23.678H313.65c13.071 0 23.677-10.596 23.677-23.678v-39.445zm138.092-23.667h-80.87c-13.071 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.596 23.676 23.677 23.676h80.87c26.145 0 47.344-19.43 47.344-43.404 0-23.973-21.2-43.394-47.344-43.394M128.214 401.438h-80.87C21.2 401.438 0 420.87 0 444.833c0 23.975 21.2 43.404 47.344 43.404h80.87c13.072 0 23.677-10.604 23.677-23.676v-39.455c0-13.072-10.605-23.668-23.677-23.668m185.436 0H209.104c-13.072 0-23.677 10.596-23.677 23.678v39.455c0 13.062 10.595 23.676 23.677 23.676H313.65c13.071 0 23.677-10.605 23.677-23.676v-39.455c-.01-13.082-10.605-23.678-23.677-23.678m161.759 0h-80.87c-13.071 0-23.677 10.596-23.677 23.678v39.455c0 13.062 10.596 23.676 23.677 23.676h80.87c26.145 0 47.344-19.432 47.344-43.404s-21.2-43.405-47.344-43.405" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "ITEMS"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
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

        const obj = runtime.wasm._lvglCreateButtonMatrix(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        if (build.project.settings.general.lvglVersion == "9.0") {
            build.line(`lv_obj_t *obj = lv_buttonmatrix_create(parent_obj);`);
        } else {
            build.line(`lv_obj_t *obj = lv_btnmatrix_create(parent_obj);`);
        }
    }

    override lvglBuildSpecific(build: LVGLBuild) {}
}
