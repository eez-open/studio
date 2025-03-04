import React from "react";
import { makeObservable } from "mobx";

import { makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLMessageBoxWidget extends LVGLWidget {
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
            clickableFlag: true,
            localStyles: {
                definition: {
                    MAIN: {
                        DEFAULT: {
                            align: "DEFAULT"
                        }
                    }
                }
                // definition: {
                //     MAIN: {
                //         DEFAULT: {
                //             align: "DEFAULT",
                //             pad_top: 0,
                //             pad_bottom: 0,
                //             pad_left: 0,
                //             pad_right: 0,
                //             pad_row: 3,
                //             pad_column: 3
                //         }
                //     },
                //     ITEMS: {
                //         DEFAULT: {
                //             radius: 6
                //         }
                //     }
                // }
            }
        },

        icon: (
            <svg viewBox="-2 -2.5 24 24" preserveAspectRatio="xMinYMin">
                <path
                    d="M3.656 17.979A1 1 0 0 1 2 17.243V15a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.003zm.844-3.093a.54.54 0 0 0 .26-.069l2.355-1.638A1 1 0 0 1 7.686 13H12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5c0 .54.429.982 1 1 .41.016.707.083.844.226.128.134.135.36.156.79.003.063.003.177 0 .37a.5.5 0 0 0 .5.5m11.5-4.87a7 7 0 0 0 0 .37zc.02-.43.028-.656.156-.79.137-.143.434-.21.844-.226.571-.018 1-.46 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1H5V2a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2v2.243a1 1 0 0 1-1.656.736L16 13.743z"
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
        if (code.isV9) {
            code.createObject("lv_msgbox_create");
        } else {
            code.createObject(
                "lv_msgbox_create",
                code.stringLiteral(""),
                code.stringLiteral(""),
                0,
                code.constant("true")
            );
        }
    }
}
