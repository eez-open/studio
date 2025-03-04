import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLTableWidget extends LVGLWidget {
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
                    fill="currentcolor"
                    d="M0 1v15h16V1zm5 14H1v-2h4zm0-3H1v-2h4zm0-3H1V7h4zm0-3H1V4h4zm5 9H6v-2h4zm0-3H6v-2h4zm0-3H6V7h4zm0-3H6V4h4zm5 9h-4v-2h4zm0-3h-4v-2h4zm0-3h-4V7h4zm0-3h-4V4h4z"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "ITEMS", "SCROLLBAR"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_table_create");
    }
}
