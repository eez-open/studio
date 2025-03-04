import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { COLORWHEEL_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import { checkWidgetTypeLvglVersion } from "../widget-common";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLColorwheelWidget extends LVGLWidget {
    mode: keyof typeof COLORWHEEL_MODES;
    fixedMode: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "8.3"),

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(COLORWHEEL_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "fixedMode",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 150,
            clickableFlag: true,
            mode: "HUE",
            fixedMode: false
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <path d="M12 21a9 9 0 1 1 0-18 9 8 0 0 1 9 8 4.5 4 0 0 1-4.5 4H14a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 21" />
                <circle cx="7.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="12" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="16.5" cy="10.5" r=".5" fill="currentColor" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "KNOB"],
            defaultFlags:
                "ADV_HITTEST|CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        },

        check: (widget, messages) =>
            checkWidgetTypeLvglVersion(widget, messages, "8.3")
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            mode: observable,
            fixedMode: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        if (code.isV9) {
            code.createObject("lv_obj_create");
            return;
        }

        code.createObject("lv_colorwheel_create", code.constant("false"));

        if (this.mode != "HUE") {
            code.callObjectFunction(
                "lv_colorwheel_set_mode",
                code.constant(`LV_COLORWHEEL_MODE_${this.mode}`)
            );
        }

        if (this.fixedMode) {
            code.callObjectFunction(
                "lv_colorwheel_set_mode_fixed",
                code.constant("true")
            );
        }
    }
}
