import React from "react";
import { makeObservable, observable } from "mobx";

import { makeDerivedClassInfo, PropertyType } from "project-editor/core/object";

import { type Project, ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    expressionPropertyBuildEventHandlerSpecific,
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import {
    getExpressionPropertyData,
    getFlowStateAddressIndex,
    lvglAddObjectFlowCallback
} from "../widget-common";
import {
    LV_EVENT_SPINBOX_STEP_CHANGED,
    LV_EVENT_SPINBOX_VALUE_CHANGED
} from "../lvgl-constants";

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

    override get hasEventHandler() {
        return (
            super.hasEventHandler ||
            this.valueType == "expression" ||
            this.stepType == "expression"
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const stepExpr = getExpressionPropertyData(runtime, this, "step");
        const valueExpr = getExpressionPropertyData(runtime, this, "value");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateSpinbox(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            this.digitCount,
            this.separatorPosition,
            this.min,
            this.max,
            this.rollover,

            stepExpr
                ? 0
                : this.stepType == "expression"
                ? 0
                : (this.step as number),

            valueExpr
                ? 0
                : this.valueType == "expression"
                ? 0
                : (this.value as number)
        );

        if (stepExpr) {
            runtime.wasm._lvglUpdateSpinboxStep(
                obj,
                getFlowStateAddressIndex(runtime),
                stepExpr.componentIndex,
                stepExpr.propertyIndex
            );
        }

        if (valueExpr) {
            runtime.wasm._lvglUpdateSpinboxValue(
                obj,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const stepExpr = getExpressionPropertyData(runtime, this, "step");
        if (stepExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_SPINBOX_STEP_CHANGED,
                stepExpr.componentIndex,
                stepExpr.propertyIndex,
                0
            );
        }

        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        if (valueExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_SPINBOX_VALUE_CHANGED,
                valueExpr.componentIndex,
                valueExpr.propertyIndex,
                0
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_spinbox_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line(
            `lv_spinbox_set_digit_format(obj, ${this.digitCount}, ${this.separatorPosition});`
        );

        build.line(`lv_spinbox_set_range(obj, ${this.min}, ${this.max});`);

        build.line(
            `lv_spinbox_set_rollover(obj, ${this.rollover ? "true" : "false"});`
        );

        if (this.stepType == "literal") {
            if (this.step != 0) {
                build.line(`lv_spinbox_set_step(obj, ${this.step});`);
            }
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                build.line(`lv_spinbox_set_value(obj, ${this.value});`);
            }
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLSpinboxWidget>(
            build,
            this,
            "step" as const,
            "lv_spinbox_get_step",
            "lv_spinbox_set_step"
        );

        expressionPropertyBuildTickSpecific<LVGLSpinboxWidget>(
            build,
            this,
            "value" as const,
            "lv_spinbox_get_value",
            "lv_spinbox_set_value"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLSpinboxWidget>(
            build,
            this,
            "step" as const,
            "lv_spinbox_get_step"
        );

        expressionPropertyBuildEventHandlerSpecific<LVGLSpinboxWidget>(
            build,
            this,
            "value" as const,
            "lv_spinbox_get_value"
        );
    }
}
