import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    ARC_MODES,
    LV_EVENT_ARC_VALUE_CHANGED
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

export class LVGLArcWidget extends LVGLWidget {
    rangeMin: number;
    rangeMinType: LVGLPropertyType;
    rangeMax: number;
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

    override get hasEventHandler() {
        return super.hasEventHandler || this.valueType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rangeMinExpr = getExpressionPropertyData(
            runtime,
            this,
            "rangeMin"
        );
        const rangeMaxExpr = getExpressionPropertyData(
            runtime,
            this,
            "rangeMax"
        );
        const valueExpr = getExpressionPropertyData(runtime, this, "value");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateArc(
            parentObj,
            runtime.getCreateWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            rangeMinExpr ? 0 : this.rangeMin,
            rangeMaxExpr ? 0 : this.rangeMax,

            valueExpr ? 0 : (this.value as number),
            this.bgStartAngle,
            this.bgEndAngle,
            ARC_MODES[this.mode],
            this.rotation
        );

        if (rangeMinExpr) {
            runtime.wasm._lvglUpdateArcRangeMin(
                obj,
                getFlowStateAddressIndex(runtime),
                rangeMinExpr.componentIndex,
                rangeMinExpr.propertyIndex
            );
        }

        if (rangeMaxExpr) {
            runtime.wasm._lvglUpdateArcRangeMax(
                obj,
                getFlowStateAddressIndex(runtime),
                rangeMaxExpr.componentIndex,
                rangeMaxExpr.propertyIndex
            );
        }

        if (valueExpr) {
            runtime.wasm._lvglUpdateArcValue(
                obj,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
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
                LV_EVENT_ARC_VALUE_CHANGED,
                valueExpr.componentIndex,
                valueExpr.propertyIndex,
                0
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_arc_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.rangeMinType == "literal" && this.rangeMaxType == "literal") {
            if (this.rangeMin != 0 || this.rangeMax != 100) {
                build.line(
                    `lv_arc_set_range(obj, ${this.rangeMin}, ${this.rangeMax});`
                );
            }
        } else if (this.rangeMinType == "literal") {
            build.line(
                `lv_arc_set_range(obj, ${this.rangeMin}, ${this.rangeMin});`
            );
        } else if (this.rangeMaxType == "literal") {
            build.line(
                `lv_arc_set_range(obj, ${this.rangeMax}, ${this.rangeMax});`
            );
        }

        if (this.valueType == "literal") {
            //if (this.value != 0) {
            build.line(`lv_arc_set_value(obj, ${this.value});`);
            //}
        }

        if (this.bgStartAngle != 135) {
            build.line(`lv_arc_set_bg_start_angle(obj, ${this.bgStartAngle});`);
        }

        if (this.bgEndAngle != 45) {
            build.line(`lv_arc_set_bg_end_angle(obj, ${this.bgEndAngle});`);
        }

        if (this.mode != "NORMAL") {
            build.line(`lv_arc_set_mode(obj, LV_ARC_MODE_${this.mode});`);
        }

        if (this.rotation != 0) {
            build.line(`lv_arc_set_rotation(obj, ${this.rotation});`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLArcWidget>(
            build,
            this,
            "rangeMin" as const,
            "lv_arc_get_min_value",
            "lv_arc_set_range",
            undefined,
            "min"
        );

        expressionPropertyBuildTickSpecific<LVGLArcWidget>(
            build,
            this,
            "rangeMax" as const,
            "lv_arc_get_max_value",
            "lv_arc_set_range",
            undefined,
            "max"
        );

        expressionPropertyBuildTickSpecific<LVGLArcWidget>(
            build,
            this,
            "value" as const,
            "lv_arc_get_value",
            "lv_arc_set_value"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLArcWidget>(
            build,
            this,
            "value" as const,
            "lv_arc_get_value"
        );
    }
}
