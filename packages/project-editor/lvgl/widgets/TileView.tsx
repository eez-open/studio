import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLTileViewWidget extends LVGLWidget {
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
            <svg viewBox="0 0 14 14">
                <path
                    style={{
                        fillRule: "evenodd"
                    }}
                    d="M1 1h5.4v5.4H1zm1.2 1.2h3v3h-3zM1 7.6h5.4V13H1zm1.2 1.2h3v3h-3zM7.6 1H13v5.4H7.6zm1.2 1.2h3v3h-3zM7.6 7.6H13V13H7.6zm1.2 1.2h3v3h-3z"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ONE|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_tileview_create");
    }
}
