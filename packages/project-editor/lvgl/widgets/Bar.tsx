import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { BAR_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLBarWidget extends LVGLWidget {
    min: number;
    max: number;
    mode: keyof typeof BAR_MODES;
    value: number | string;
    valueType: LVGLPropertyType;
    valueStart: number | string;
    valueStartType: LVGLPropertyType;
    enableAnimation: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "min",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "max",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(BAR_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "valueStart",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    disabled: (bar: LVGLBarWidget) => bar.mode != "RANGE"
                }
            ),
            {
                name: "enableAnimation",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 10,
            clickableFlag: true,
            min: 0,
            max: 100,
            mode: "NORMAL",
            value: 25,
            valueType: "literal",
            valueStart: 0,
            valueStartType: "literal",
            enableAnimation: false
        },

        icon: (
            <svg viewBox="0 0 32 32" fill="currentColor">
                <path d="M28 21H4a2.0021 2.0021 0 0 1-2-2v-6a2.0021 2.0021 0 0 1 2-2h24a2.0021 2.0021 0 0 1 2 2v6a2.0021 2.0021 0 0 1-2 2ZM4 13v6h24v-6Z" />
                <path d="M6 15h14v2H6z" />
                <path fill="none" d="M0 0h32v32H0z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            oldDefaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            min: observable,
            max: observable,
            mode: observable,
            value: observable,
            valueType: observable,
            valueStart: observable,
            valueStartType: observable,
            enableAnimation: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_bar_create");

        if (this.min != 0 || this.max != 100) {
            code.callObjectFunction("lv_bar_set_range", this.min, this.max);
        }

        if (this.mode != "NORMAL") {
            code.callObjectFunction(
                "lv_bar_set_mode",
                code.constant(`LV_BAR_MODE_${this.mode}`)
            );
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                code.callObjectFunction(
                    "lv_bar_set_value",
                    this.value,
                    this.enableAnimation
                        ? code.constant("LV_ANIM_ON")
                        : code.constant("LV_ANIM_OFF")
                );
            }
        } else {
            code.addToTick("value", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.value as string,
                    "Failed to evaluate Value in Bar widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_bar_get_value"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction(
                        "lv_bar_set_value",
                        new_val,
                        this.enableAnimation
                            ? code.constant("LV_ANIM_ON")
                            : code.constant("LV_ANIM_OFF")
                    );

                    code.tickChangeEnd();
                });
            });
        }

        if (this.mode == "RANGE") {
            if (this.valueStartType == "literal") {
                if (this.valueType == "expression") {
                    code.callObjectFunction(
                        "lv_bar_set_value",
                        this.valueStart,
                        this.enableAnimation
                            ? code.constant("LV_ANIM_ON")
                            : code.constant("LV_ANIM_OFF")
                    );
                }

                code.callObjectFunction(
                    "lv_bar_set_start_value",
                    this.valueStart,
                    this.enableAnimation
                        ? code.constant("LV_ANIM_ON")
                        : code.constant("LV_ANIM_OFF")
                );
            } else {
                code.addToTick("valueStart", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.value as string,
                        "Failed to evaluate Value start in Bar widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_bar_get_start_value"
                    );

                    code.ifIntegerNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();

                        code.callObjectFunction(
                            "lv_bar_set_start_value",
                            new_val,
                            this.enableAnimation
                                ? code.constant("LV_ANIM_ON")
                                : code.constant("LV_ANIM_OFF")
                        );

                        code.tickChangeEnd();
                    });
                });
            }
        }
    }
}
