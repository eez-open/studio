import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { BAR_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import {
    getExpressionPropertyData,
    getFlowStateAddressIndex
} from "../widget-common";

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

    override get hasEventHandler() {
        return (
            super.hasEventHandler ||
            this.valueType == "expression" ||
            (this.mode == "RANGE" && this.valueStartType == "expression")
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        const valueStartExpr =
            this.mode == "RANGE"
                ? getExpressionPropertyData(runtime, this, "valueStart")
                : undefined;

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateBar(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            this.min,
            this.max,
            BAR_MODES[this.mode],
            valueExpr
                ? !valueStartExpr
                    ? (this.valueStart as number)
                    : 0
                : (this.value as number),
            valueStartExpr ? 0 : (this.valueStart as number)
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateBarValue(
                obj,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex,
                this.enableAnimation
            );
        }

        if (valueStartExpr) {
            runtime.wasm._lvglUpdateBarValueStart(
                obj,
                getFlowStateAddressIndex(runtime),
                valueStartExpr.componentIndex,
                valueStartExpr.propertyIndex,
                this.enableAnimation
            );
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_bar_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.min != 0 || this.max != 100) {
            build.line(`lv_bar_set_range(obj, ${this.min}, ${this.max});`);
        }

        if (this.mode != "NORMAL") {
            build.line(`lv_bar_set_mode(obj, LV_BAR_MODE_${this.mode});`);
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                build.line(
                    `lv_bar_set_value(obj, ${this.value}, ${
                        this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                    });`
                );
            }
        }

        if (this.mode == "RANGE" && this.valueStartType == "literal") {
            if (this.valueType == "expression") {
                build.line(
                    `lv_bar_set_value(obj, ${this.valueStart}, ${
                        this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                    });`
                );
            }

            build.line(
                `lv_bar_set_start_value(obj, ${this.valueStart}, ${
                    this.enableAnimation ? "LV_ANIM_ON" : "LV_ANIM_OFF"
                });`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLBarWidget>(
            build,
            this,
            "value" as const,
            "lv_bar_get_value",
            "lv_bar_set_value",
            this.enableAnimation ? ", LV_ANIM_ON" : ", LV_ANIM_OFF"
        );

        if (this.mode == "RANGE") {
            expressionPropertyBuildTickSpecific<LVGLBarWidget>(
                build,
                this,
                "valueStart" as const,
                "lv_bar_get_start_value",
                "lv_bar_set_start_value",
                this.enableAnimation ? ", LV_ANIM_ON" : ", LV_ANIM_OFF"
            );
        }
    }
}
