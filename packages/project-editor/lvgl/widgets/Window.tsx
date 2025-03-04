import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLWindowWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true
        },

        icon: (
            <svg viewBox="0 0 16 16">
                <path
                    d="M14.5 2h-13l-.5.5v11l.5.5h13l.5-.5v-11zM14 13H2V6h12zm0-8H2V3h12z"
                    fill="currentcolor"
                />
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
        code.createObject("lv_win_create");
    }
}
