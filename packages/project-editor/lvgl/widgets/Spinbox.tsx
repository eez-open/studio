import React from "react";
import { makeObservable, observable } from "mobx";

import { makeDerivedClassInfo, PropertyType } from "project-editor/core/object";

import { type Project, ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";

import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLSpinboxWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "digitCount",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "separatorPosition",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
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
                name: "rollover",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            ...makeLvglExpressionProperty(
                "step",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true,
            digitCount: 5,
            separatorPosition: 0,
            min: -99999,
            max: 99999,
            rollover: false,
            step: 1,
            stepType: "literal",
            value: 0,
            valueType: "literal"
        },

        beforeLoadHook(
            object: LVGLSpinboxWidget,
            jsObject: Partial<LVGLSpinboxWidget>
        ) {
            if (jsObject.digitCount == undefined) {
                jsObject.digitCount = 5;
            }
            if (jsObject.separatorPosition == undefined) {
                jsObject.separatorPosition = 0;
            }
            if (jsObject.min == undefined) {
                jsObject.min = -99999;
            }
            if (jsObject.max == undefined) {
                jsObject.max = 99999;
            }
            if (jsObject.rollover == undefined) {
                jsObject.rollover = false;
            }
            if (jsObject.step == undefined) {
                jsObject.step = 1;
            }
            if (jsObject.stepType == undefined) {
                jsObject.stepType = "literal";
            }
            if (jsObject.value == undefined) {
                jsObject.value = 0;
            }
            if (jsObject.valueType == undefined) {
                jsObject.valueType = "literal";
            }
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.47 4.72a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06L12 6.31 8.78 9.53a.75.75 0 0 1-1.06-1.06zm-3.75 9.75a.75.75 0 0 1 1.06 0L12 17.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06"
                    fill="#0F172A"
                />
            </svg>
        ),

        lvgl: (widget: LVGLSpinboxWidget, project: Project) => {
            return {
                parts: ["MAIN", "SELECTED", "CURSOR"],
                defaultFlags:
                    project.settings.general.lvglVersion == "9.0"
                        ? "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SNAPPABLE"
                        : "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SCROLL_WITH_ARROW|SNAPPABLE",
                states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
            };
        }
    });

    digitCount: number;
    separatorPosition: number;
    min: number;
    max: number;
    rollover: boolean;
    step: number | string;
    stepType: LVGLPropertyType;
    value: number | string;
    valueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            digitCount: observable,
            separatorPosition: observable,
            min: observable,
            max: observable,
            rollover: observable,
            step: observable,
            stepType: observable,
            value: observable,
            valueType: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject(`lv_spinbox_create`);

        // digitCount and separatorPosition
        code.callObjectFunction(
            "lv_spinbox_set_digit_format",
            this.digitCount,
            this.separatorPosition
        );

        // min and max
        code.callObjectFunction("lv_spinbox_set_range", this.min, this.max);

        // rollover
        code.callObjectFunction(
            "lv_spinbox_set_rollover",
            code.constant(this.rollover ? "true" : "false")
        );

        // step
        if (this.stepType == "literal") {
            code.callObjectFunction("lv_spinbox_set_step", this.step);
        } else {
            code.addToTick("step", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.step as string,
                    "Failed to evaluate Step in Spinbox widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_spinbox_get_step"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction("lv_spinbox_set_step", new_val);

                    code.tickChangeEnd();
                });
            });

            code.addEventHandler(
                "VALUE_CHANGED",
                (event, tick_value_change_obj) => {
                    const ta = code.callFreeFunctionWithAssignment(
                        "lv_obj_t *",
                        "ta",
                        "lv_event_get_target",
                        event
                    );

                    code.ifIntegerNotEqual(tick_value_change_obj, ta, () => {
                        const value = code.callFreeFunctionWithAssignment(
                            "int32_t",
                            "value",
                            "lv_spinbox_get_step",
                            ta
                        );

                        code.assignIntegerProperty(
                            "step",
                            this.step as string,
                            value,
                            "Failed to assign Step in Spinbox widget"
                        );
                    });
                }
            );
        }

        // value
        if (this.valueType == "literal") {
            code.callObjectFunction("lv_spinbox_set_value", this.value);
        } else {
            code.addToTick("value", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.value as string,
                    "Failed to evaluate Value in Spinbox widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_spinbox_get_value"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction("lv_spinbox_set_value", new_val);

                    code.tickChangeEnd();
                });
            });

            code.addEventHandler(
                "VALUE_CHANGED",
                (event, tick_value_change_obj) => {
                    const ta = code.callFreeFunctionWithAssignment(
                        "lv_obj_t *",
                        "ta",
                        "lv_event_get_target",
                        event
                    );

                    code.ifIntegerNotEqual(tick_value_change_obj, ta, () => {
                        const value = code.callFreeFunctionWithAssignment(
                            "int32_t",
                            "value",
                            "lv_spinbox_get_value",
                            ta
                        );

                        code.assignIntegerProperty(
                            "value",
                            this.value as string,
                            value,
                            "Failed to assign Value in Spinbox widget"
                        );
                    });
                }
            );
        }
    }
}
