import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { SCALE_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import { checkWidgetTypeLvglVersion } from "../widget-common";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLScaleWidget extends LVGLWidget {
    scaleMode: keyof typeof SCALE_MODES;
    minorRange: number;
    majorRange: number;
    totalTickCount: number;
    majorTickEvery: number;
    showLabels: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "9.0"),

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "scaleMode",
                type: PropertyType.Enum,
                enumItems: Object.keys(SCALE_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "minorRange",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "majorRange",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "totalTickCount",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "majorTickEvery",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "showLabels",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 240,
            height: 40,
            clickableFlag: true,
            scaleMode: "HORIZONTAL_BOTTOM",
            localStyles: {
                definition: {
                    ITEMS: {
                        DEFAULT: {
                            length: 5
                        }
                    },
                    INDICATOR: {
                        DEFAULT: {
                            length: 10
                        }
                    }
                }
            },
            minorRange: 10,
            majorRange: 40,
            totalTickCount: 31,
            majorTickEvery: 5,
            showLabels: true
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="2 2 20 18"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
            >
                <path d="M19.875 8C20.496 8 21 8.512 21 9.143v5.714c0 .631-.504 1.143-1.125 1.143H4a1 1 0 0 1-1-1V9.143C3 8.512 3.504 8 4.125 8h15.75zM9 8v2M6 8v3M12 8v3M18 8v3M15 8v2" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "ITEMS", "INDICATOR"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        },

        check: (widget, messages) =>
            checkWidgetTypeLvglVersion(widget, messages, "9.0")
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            scaleMode: observable,
            minorRange: observable,
            majorRange: observable,
            totalTickCount: observable,
            majorTickEvery: observable,
            showLabels: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        if (!code.isV9) {
            // Scale widget doesn't exist in LVGL version 8.x
            code.createObject("lv_obj_create");
            return;
        }

        code.createObject(`lv_scale_create`);

        // scaleMode
        code.callObjectFunction(
            "lv_scale_set_mode",
            code.constant(`LV_SCALE_MODE_${this.scaleMode}`)
        );

        // minorRange and majorRange
        code.callObjectFunction(
            "lv_scale_set_range",
            this.minorRange,
            this.majorRange
        );

        // setTotalTickCount
        code.callObjectFunction(
            "lv_scale_set_total_tick_count",
            this.totalTickCount
        );

        // majorTickEvery
        code.callObjectFunction(
            "lv_scale_set_major_tick_every",
            this.majorTickEvery
        );

        // showLabels
        code.callObjectFunction(
            "lv_scale_set_label_show",
            code.constant(this.showLabels ? "true" : "false")
        );
    }
}
