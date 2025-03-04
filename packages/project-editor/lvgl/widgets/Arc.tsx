import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { ARC_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLArcWidget extends LVGLWidget {
    rangeMin: number | string;
    rangeMinType: LVGLPropertyType;
    rangeMax: number | string;
    rangeMaxType: LVGLPropertyType;
    value: number | string;
    valueType: LVGLPropertyType;
    bgStartAngle: number;
    bgEndAngle: number;
    mode: keyof typeof ARC_MODES;
    rotation: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [
            ...makeLvglExpressionProperty(
                "rangeMin",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "rangeMax",
                "integer",
                "input",
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
            ),
            {
                name: "bgStartAngle",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "bgEndAngle",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ARC_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "rotation",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 150,
            clickableFlag: true,
            rangeMin: 0,
            rangeMinType: "literal",
            rangeMax: 100,
            rangeMaxType: "literal",
            value: 25,
            valueType: "literal",
            bgStartAngle: 135,
            bgEndAngle: 45,
            mode: "NORMAL",
            rotation: 0
        },

        beforeLoadHook: (
            object: LVGLArcWidget,
            jsObject: Partial<LVGLArcWidget>
        ) => {
            if (jsObject.rangeMinType == undefined) {
                jsObject.rangeMinType = "literal";
            }

            if (jsObject.rangeMaxType == undefined) {
                jsObject.rangeMaxType = "literal";
            }
        },

        icon: (
            <svg
                viewBox="0 0 100 100"
                stroke="currentColor"
                fill="currentColor"
            >
                <path
                    transform="matrix(0.284019, 0.365203, -0.365202, 0.284019, 52.485165, -170.485977)"
                    d="M 428.885 388.909 A 98.905 98.905 0 1 1 449.648 246.739 L 429.979 262.257 A 73.851 73.851 0 1 0 414.475 368.413 Z"
                ></path>
                <path
                    d="M 65.922 86.406 C 58.202 78.686 58.202 66.17 65.922 58.449 C 73.642 50.73 86.158 50.73 93.878 58.449 C 101.598 66.17 101.598 78.686 93.878 86.406 C 86.158 94.125 73.642 94.125 65.922 86.406 Z M 86.957 79.485 C 90.855 75.585 90.855 69.268 86.957 65.37 C 83.06 61.471 76.74 61.471 72.843 65.37 C 68.945 69.268 68.945 75.585 72.843 79.485 C 76.74 83.382 83.06 83.382 86.957 79.485 Z"
                    style={{ strokeWidth: 1.98 }}
                    transform="matrix(0.613904, 0.789381, -0.789381, 0.613904, 88.021956, -35.107547)"
                ></path>
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR", "KNOB"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            rangeMin: observable,
            rangeMinType: observable,
            rangeMax: observable,
            rangeMaxType: observable,
            value: observable,
            valueType: observable,
            bgStartAngle: observable,
            bgEndAngle: observable,
            mode: observable,
            rotation: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_arc_create");

        if (this.rangeMinType == "literal" && this.rangeMaxType == "literal") {
            if (this.rangeMin != 0 || this.rangeMax != 100) {
                code.callObjectFunction(
                    "lv_arc_set_range",
                    this.rangeMin,
                    this.rangeMax
                );
            }
        } else if (this.rangeMinType == "literal") {
            code.callObjectFunction(
                "lv_arc_set_range",
                this.rangeMin,
                this.rangeMin
            );
        } else if (this.rangeMaxType == "literal") {
            code.callObjectFunction(
                "lv_arc_set_range",
                this.rangeMax,
                this.rangeMax
            );
        }

        if (this.rangeMinType == "expression") {
            code.addToTick("rangeMin", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.rangeMin as string,
                    "Failed to evaluate Range min in Arc widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_arc_get_min_value"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    const min = code.assign("int16_t", "min", "new_val");

                    const max = code.callObjectFunctionWithAssignment(
                        "int16_t",
                        "max",
                        "lv_arc_get_max_value"
                    );

                    code.ifIntegerLess(min, max, () => {
                        code.callObjectFunction("lv_arc_set_range", min, max);
                    });

                    code.tickChangeEnd();
                });
            });
        }

        if (this.rangeMaxType == "expression") {
            code.addToTick("rangeMax", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.rangeMax as string,
                    "Failed to evaluate Range max in Arc widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_arc_get_max_value"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    const min = code.callObjectFunctionWithAssignment(
                        "int16_t",
                        "min",
                        "lv_arc_get_min_value"
                    );

                    const max = code.assign("int16_t", "max", "new_val");

                    code.ifIntegerLess(min, max, () => {
                        code.callObjectFunction("lv_arc_set_range", min, max);
                    });

                    code.tickChangeEnd();
                });
            });
        }

        if (this.valueType == "literal") {
            code.callObjectFunction("lv_arc_set_value", this.value);
        } else {
            code.addToTick("value", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.value as string,
                    "Failed to evaluate Value in Arc widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_arc_get_value"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction("lv_arc_set_value", new_val);

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
                            "lv_arc_get_value",
                            ta
                        );

                        code.assignIntegerProperty(
                            "value",
                            this.value as string,
                            value,
                            "Failed to assign Value in Arc widget"
                        );
                    });
                }
            );
        }

        if (this.bgStartAngle != 135) {
            code.callObjectFunction(
                "lv_arc_set_bg_start_angle",
                this.bgStartAngle
            );
        }

        if (this.bgEndAngle != 45) {
            code.callObjectFunction("lv_arc_set_bg_end_angle", this.bgEndAngle);
        }

        if (this.mode != "NORMAL") {
            code.callObjectFunction(
                "lv_arc_set_mode",
                code.constant(`LV_ARC_MODE_${this.mode}`)
            );
        }

        if (this.rotation != 0) {
            code.callObjectFunction("lv_arc_set_rotation", this.rotation);
        }
    }
}
