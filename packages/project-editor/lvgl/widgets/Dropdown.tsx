import React from "react";
import { observable, makeObservable } from "mobx";

import { makeDerivedClassInfo, PropertyType } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    LV_DIR_TOP,
    LV_DIR_LEFT,
    LV_DIR_BOTTOM,
    LV_DIR_RIGHT,
    LV_EVENT_DROPDOWN_SELECTED_CHANGED
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

export const LVGL_DROPDOWN_DIRECTION: { [key: string]: number } = {
    top: LV_DIR_TOP,
    left: LV_DIR_LEFT,
    bottom: LV_DIR_BOTTOM,
    right: LV_DIR_RIGHT
};

export class LVGLDropdownWidget extends LVGLWidget {
    options: string;
    optionsType: LVGLPropertyType;

    selected: number | string;
    selectedType: LVGLPropertyType;

    direction: string;

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
                name: "direction",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "top",
                        label: "TOP"
                    },
                    {
                        id: "left",
                        label: "LEFT"
                    },
                    {
                        id: "bottom",
                        label: "BOTTOM"
                    },
                    {
                        id: "right",
                        label: "RIGHT"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 32,
            heightUnit: "content",
            clickableFlag: true,
            options: "Option 1\nOption 2\nOption 3",
            optionsType: "literal",
            selected: 0,
            selectedType: "literal",
            direction: "bottom"
        },

        beforeLoadHook: (
            object: LVGLDropdownWidget,
            jsObject: Partial<LVGLDropdownWidget>
        ) => {
            if (jsObject.optionsType == undefined) {
                jsObject.optionsType = "literal";
            }

            if (jsObject.selected == undefined) {
                jsObject.selected = 0;
                jsObject.selectedType = "literal";
            }

            if (jsObject.direction == undefined) {
                jsObject.direction = "bottom";
            }
        },

        icon: (
            <svg viewBox="0 0 1000 1000" fill="currentColor">
                <path d="M258.8 402.9v157.4H990V402.9H258.8zm685.5 111.7H304.5v-66h639.8v66zM258.8 743.1H990V585.7H258.8v157.4zm45.7-111.7h639.8v66H304.5v-66zm-45.7 293.2H990V767.2H258.8v157.4zm45.7-111.7h639.8v66H304.5v-66zm436.7-463.3h198V75.4H10v274.2h731.2zm0-228.5h152.3v182.8H741.2V121.1zM55.7 303.9V121.1h639.8v182.8H55.7zm714.7-113.5h100.1l-50 63.6-50.1-63.6z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SELECTED"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SCROLL_WITH_ARROW|SNAPPABLE",

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
            direction: observable
        });
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

        const obj = runtime.wasm._lvglCreateDropdown(
            parentObj,
            runtime.getCreateWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            runtime.wasm.allocateUTF8(
                optionsExpr ? "" : unescapeCString(this.options)
            ),
            selectedExpr ? 0 : (this.selected as number),

            LVGL_DROPDOWN_DIRECTION[this.direction]
        );

        if (optionsExpr) {
            runtime.wasm._lvglUpdateDropdownOptions(
                obj,
                getFlowStateAddressIndex(runtime),
                optionsExpr.componentIndex,
                optionsExpr.propertyIndex
            );
        }

        if (selectedExpr) {
            runtime.wasm._lvglUpdateDropdownSelected(
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
                LV_EVENT_DROPDOWN_SELECTED_CHANGED,
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex,
                0
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_dropdown_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.optionsType == "literal") {
            build.line(
                `lv_dropdown_set_options(obj, ${escapeCString(
                    this.options ?? ""
                )});`
            );
        } else if (this.optionsType == "translated-literal") {
            build.line(
                `lv_dropdown_set_options(obj, _(${escapeCString(
                    this.options ?? ""
                )}));`
            );
        } else {
            build.line(`lv_dropdown_set_options(obj, "");`);
        }

        if (this.direction != "bottom") {
            build.line(
                `lv_dropdown_set_dir(obj, LV_DIR_${this.direction.toUpperCase()});`
            );
        }

        if (this.selectedType == "literal") {
            if (this.selected != 0) {
                build.line(`lv_dropdown_set_selected(obj, ${this.selected});`);
            }
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLDropdownWidget>(
            build,
            this,
            "options" as const,
            "lv_dropdown_get_options",
            "lv_dropdown_set_options"
        );

        expressionPropertyBuildTickSpecific<LVGLDropdownWidget>(
            build,
            this,
            "selected" as const,
            "lv_dropdown_get_selected",
            "lv_dropdown_set_selected",
            undefined,
            undefined,
            true
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLDropdownWidget>(
            build,
            this,
            "selected" as const,
            "lv_dropdown_get_selected"
        );
    }
}
