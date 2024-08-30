import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { Project, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    LV_EVENT_SLIDER_VALUE_CHANGED,
    LV_EVENT_SLIDER_VALUE_LEFT_CHANGED,
    SLIDER_MODES
} from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
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

    override get hasEventHandler() {
        return (
            super.hasEventHandler ||
            this.valueType == "expression" ||
            (this.mode == "RANGE" && this.valueLeftType == "expression")
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        const valueLeftExpr =
            this.mode == "RANGE"
                ? getExpressionPropertyData(runtime, this, "valueLeft")
                : undefined;

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateSlider(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            this.min,
            this.max,
            SLIDER_MODES[this.mode],
            valueExpr
                ? !valueLeftExpr
                    ? (this.valueLeft as number)
                    : 0
                : this.valueType == "expression"
                ? 66
                : (this.value as number),
            valueLeftExpr
                ? 0
                : this.valueLeftType == "expression"
                ? 0
                : (this.valueLeft as number)
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateSliderValue(
                obj,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex,
                this.enableAnimation
            );
        }

        if (valueLeftExpr) {
            runtime.wasm._lvglUpdateSliderValueLeft(
                obj,
                getFlowStateAddressIndex(runtime),
                valueLeftExpr.componentIndex,
                valueLeftExpr.propertyIndex,
                this.enableAnimation
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        if (valueExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_SLIDER_VALUE_CHANGED,
                valueExpr.componentIndex,
                valueExpr.propertyIndex,
                0
            );
        }

        const valueLeftExpr =
            this.mode == "RANGE"
                ? getExpressionPropertyData(runtime, this, "valueLeft")
                : undefined;
        if (valueLeftExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_SLIDER_VALUE_LEFT_CHANGED,
                valueLeftExpr.componentIndex,
                valueLeftExpr.propertyIndex,
                0
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_slider_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.min != 0 || this.max != 100) {
            build.line(`lv_slider_set_range(obj, ${this.min}, ${this.max});`);
        }

        if (this.mode != "NORMAL") {
            build.line(`lv_slider_set_mode(obj, LV_SLIDER_MODE_${this.mode});`);
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                build.line(
                    `lv_slider_set_value(obj, ${this.value}, ${
                        this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                    });`
                );
            }
        }

        if (this.mode == "RANGE" && this.valueLeftType == "literal") {
            if (this.valueType == "expression") {
                build.line(
                    `lv_slider_set_value(obj, ${this.valueLeft}, ${
                        this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                    });`
                );
            }

            build.line(
                `lv_slider_set_left_value(obj, ${this.valueLeft}, ${
                    this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                });`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLSliderWidget>(
            build,
            this,
            "value" as const,
            "lv_slider_get_value",
            "lv_slider_set_value",
            this.enableAnimation ? ", LV_ANIM_ON" : ", LV_ANIM_OFF"
        );

        if (this.mode == "RANGE") {
            expressionPropertyBuildTickSpecific<LVGLSliderWidget>(
                build,
                this,
                "valueLeft" as const,
                "lv_slider_get_left_value",
                "lv_slider_set_left_value",
                this.enableAnimation ? ", LV_ANIM_ON" : ", LV_ANIM_OFF"
            );
        }
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLSliderWidget>(
            build,
            this,
            "value" as const,
            "lv_slider_get_value"
        );

        if (this.mode == "RANGE") {
            expressionPropertyBuildEventHandlerSpecific<LVGLSliderWidget>(
                build,
                this,
                "valueLeft" as const,
                "lv_slider_get_left_value"
            );
        }
    }
}
