import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    LV_EVENT_ROLLER_SELECTED_CHANGED,
    ROLLER_MODES
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
    lvglAddObjectFlowCallback,
    escapeCString,
    unescapeCString
} from "../widget-common";

////////////////////////////////////////////////////////////////////////////////

export class LVGLRollerWidget extends LVGLWidget {
    options: string;
    optionsType: LVGLPropertyType;

    selected: number | string;
    selectedType: LVGLPropertyType;

    mode: keyof typeof ROLLER_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            ...makeLvglExpressionProperty(
                "options",
                "array:string",
                "input",
                ["literal", "translated-literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "selected",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ROLLER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 100,
            clickableFlag: true,
            options: "Option 1\nOption 2\nOption 3",
            optionsType: "literal",
            selected: 0,
            selectedType: "literal",
            mode: "NORMAL"
        },

        beforeLoadHook: (
            object: LVGLRollerWidget,
            jsObject: Partial<LVGLRollerWidget>
        ) => {
            if (jsObject.optionsType == undefined) {
                jsObject.optionsType = "literal";
            }

            if (jsObject.selected == undefined) {
                jsObject.selected = 0;
                jsObject.selectedType = "literal";
            }
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
                <path d="M11 6h9"></path>
                <path d="M11 12h9"></path>
                <path d="M12 18h8"></path>
                <path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"></path>
                <path d="M6 10v-6l-2 2"></path>
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SELECTED"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_CHAIN_HOR|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"],

            oldInitFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            options: observable,
            optionsType: observable,
            selected: observable,
            selectedType: observable,
            mode: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        return this.optionsType == "expression";
    }

    override get hasEventHandler() {
        return super.hasEventHandler || this.selectedType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const optionsExpr = getExpressionPropertyData(runtime, this, "options");

        const selectedExpr = getExpressionPropertyData(
            runtime,
            this,
            "selected"
        );

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateRoller(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            runtime.wasm.allocateUTF8(
                optionsExpr
                    ? ""
                    : unescapeCString(
                          this.optionsType == "expression"
                              ? `${this.options}\n${this.options}\n${this.options}`
                              : this.options
                      )
            ),
            selectedExpr ? 0 : (this.selected as number),
            ROLLER_MODES[this.mode]
        );

        if (optionsExpr) {
            runtime.wasm._lvglUpdateRollerOptions(
                obj,
                getFlowStateAddressIndex(runtime),
                optionsExpr.componentIndex,
                optionsExpr.propertyIndex,
                ROLLER_MODES[this.mode]
            );
        }

        if (selectedExpr) {
            runtime.wasm._lvglUpdateRollerSelected(
                obj,
                getFlowStateAddressIndex(runtime),
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const selectedExpr = getExpressionPropertyData(
            runtime,
            this,
            "selected"
        );
        if (selectedExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_ROLLER_SELECTED_CHANGED,
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex,
                0
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_roller_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.optionsType == "literal") {
            build.line(
                `lv_roller_set_options(obj, ${escapeCString(
                    this.options ?? ""
                )}, LV_ROLLER_MODE_${this.mode});`
            );
        } else if (this.optionsType == "translated-literal") {
            build.line(
                `lv_roller_set_options(obj, _(${escapeCString(
                    this.options ?? ""
                )}), LV_ROLLER_MODE_${this.mode});`
            );
        } else {
            build.line(
                `lv_roller_set_options(obj, "", LV_ROLLER_MODE_${this.mode});`
            );
        }

        if (this.selectedType == "literal") {
            if (this.selected != 0) {
                build.line(
                    `lv_roller_set_selected(obj, ${this.selected}, LV_ANIM_OFF);`
                );
            }
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLRollerWidget>(
            build,
            this,
            "options" as const,
            "lv_roller_get_options",
            "lv_roller_set_options",
            `, LV_ROLLER_MODE_${this.mode}`
        );

        expressionPropertyBuildTickSpecific<LVGLRollerWidget>(
            build,
            this,
            "selected" as const,
            "lv_roller_get_selected",
            "lv_roller_set_selected",
            ", LV_ANIM_OFF",
            undefined,
            true
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLRollerWidget>(
            build,
            this,
            "selected" as const,
            "lv_roller_get_selected"
        );
    }
}
