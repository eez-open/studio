import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { Project, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { SLIDER_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";

import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLSliderWidget extends LVGLWidget {
    min: number;
    max: number;
    mode: keyof typeof SLIDER_MODES;
    value: number | string;
    valueType: LVGLPropertyType;
    valueLeft: number | string;
    valueLeftType: LVGLPropertyType;
    enableAnimation: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

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
                enumItems: Object.keys(SLIDER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "valueLeft",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    disabled: (slider: LVGLSliderWidget) =>
                        slider.mode != "RANGE"
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
            valueLeft: 0,
            valueLeftType: "literal",
            enableAnimation: false
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <circle cx="14" cy="6" r="2"></circle>
                <line x1="4" y1="6" x2="12" y2="6"></line>
                <line x1="16" y1="6" x2="20" y2="6"></line>
                <circle cx="8" cy="12" r="2"></circle>
                <line x1="4" y1="12" x2="6" y2="12"></line>
                <line x1="10" y1="12" x2="20" y2="12"></line>
                <circle cx="17" cy="18" r="2"></circle>
                <line x1="4" y1="18" x2="15" y2="18"></line>
                <line x1="19" y1="18" x2="20" y2="18"></line>
            </svg>
        ),

        lvgl: (widget: LVGLSliderWidget, project: Project) => {
            return {
                parts: ["MAIN", "INDICATOR", "KNOB"],
                defaultFlags:
                    project.settings.general.lvglVersion == "9.0"
                        ? "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SCROLL_WITH_ARROW|SNAPPABLE"
                        : "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",
                states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"],

                oldInitFlags:
                    "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
                oldDefaultFlags:
                    "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
            };
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
            valueLeft: observable,
            valueLeftType: observable,
            enableAnimation: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        const PREFIX = code.isV9 ? "" : "v8_";

        code.createObject(`lv_slider_create`);

        // min and max
        if (this.min != 0 || this.max != 100) {
            code.callObjectFunction(
                PREFIX + "lv_slider_set_range",
                this.min,
                this.max
            );
        }

        // mode
        if (this.mode != "NORMAL") {
            code.callObjectFunction(
                PREFIX + "lv_slider_set_mode",
                code.constant(`LV_SLIDER_MODE_${this.mode}`)
            );
        }

        // value
        if (this.valueType == "literal") {
            if (this.value != 0) {
                code.callObjectFunction(
                    PREFIX + "lv_slider_set_value",
                    this.value,
                    code.constant(
                        this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                    )
                );
            }
        } else {
            code.addToTick("value", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.value as string,
                    "Failed to evaluate Value in Slider widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    PREFIX + "lv_slider_get_value"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction(
                        PREFIX + "lv_slider_set_value",
                        new_val,
                        code.constant(
                            this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                        )
                    );

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
                            PREFIX + "lv_slider_get_value",
                            ta
                        );

                        code.assignIntegerProperty(
                            "value",
                            this.value as string,
                            value,
                            "Failed to assign Value in Slider widget"
                        );
                    });
                }
            );
        }

        // valueLeft
        if (this.mode == "RANGE") {
            if (this.valueLeftType == "literal") {
                if (this.valueType == "expression") {
                    code.callObjectFunction(
                        PREFIX + "lv_slider_set_value",
                        this.valueLeft,
                        code.constant(
                            this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                        )
                    );
                }

                code.callObjectFunction(
                    PREFIX + "lv_slider_set_left_value",
                    this.valueLeft,
                    code.constant(
                        this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                    )
                );
            } else {
                code.addToTick("valueLeft", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.valueLeft as string,
                        "Failed to evaluate Value left in Slider widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        PREFIX + "lv_slider_get_left_value"
                    );

                    code.ifIntegerNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();

                        code.callObjectFunction(
                            PREFIX + "lv_slider_set_left_value",
                            new_val,
                            code.constant(
                                this.enableAnimation
                                    ? "LV_ANIM_ON"
                                    : "LV_ANIM_OFF"
                            )
                        );

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

                        code.ifIntegerNotEqual(
                            tick_value_change_obj,
                            ta,
                            () => {
                                const value =
                                    code.callFreeFunctionWithAssignment(
                                        "int32_t",
                                        "value",
                                        PREFIX + "lv_slider_get_left_value",
                                        ta
                                    );

                                code.assignIntegerProperty(
                                    "valueLeft",
                                    this.value as string,
                                    value,
                                    "Failed to assign Value left in Slider widget"
                                );
                            }
                        );
                    }
                );
            }
        }
    }
}
