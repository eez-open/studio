import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLSpanWidget extends LVGLWidget {
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
            <svg viewBox="0 0 56 56">
                <path
                    d="M2.963 21.923c1.162 0 1.846-.684 1.846-1.869v-5.402c0-2.37 1.254-3.578 3.533-3.578H47.68c2.257 0 3.533 1.208 3.533 3.578v5.402c0 1.185.684 1.869 1.846 1.869 1.185 0 1.823-.684 1.823-1.869V14.47c0-4.695-2.37-7.066-7.157-7.066H8.296c-4.763 0-7.156 2.348-7.156 7.066v5.584c0 1.185.66 1.869 1.823 1.869m25.003 16.342c1.185 0 1.846-.798 1.846-2.051v-14.77h5.652c.89 0 1.527-.592 1.527-1.504 0-.934-.638-1.481-1.527-1.481H20.558c-.866 0-1.527.547-1.527 1.481 0 .912.661 1.504 1.527 1.504h5.607v14.77c0 1.208.638 2.05 1.8 2.05M2.963 30.766c1.641 0 2.963-1.344 2.963-2.985 0-1.619-1.322-2.94-2.963-2.94C1.345 24.84 0 26.161 0 27.78c0 1.64 1.345 2.985 2.963 2.985m50.097 0c1.618 0 2.94-1.344 2.94-2.985a2.947 2.947 0 0 0-2.94-2.94c-1.664 0-2.963 1.299-2.963 2.94 0 1.64 1.3 2.985 2.963 2.985m-44.764 18.6h39.43c4.787 0 7.157-2.37 7.157-7.066v-6.724c0-1.185-.661-1.846-1.823-1.846-1.185 0-1.846.661-1.846 1.846v6.542c0 2.37-1.276 3.578-3.533 3.578H8.341c-2.278 0-3.532-1.208-3.532-3.578v-6.542c0-1.185-.684-1.846-1.846-1.846s-1.823.661-1.823 1.846V42.3c0 4.718 2.393 7.066 7.156 7.066"
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
        code.createObject("lv_spangroup_create");
    }
}
