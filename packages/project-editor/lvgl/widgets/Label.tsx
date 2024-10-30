import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { LONG_MODE_CODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import {
    getExpressionPropertyData,
    getExpressionPropertyInitalValue,
    getFlowStateAddressIndex,
    escapeCString,
    unescapeCString
} from "../widget-common";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { lvglHasLabelRecolorSupport } from "../lvgl-versions";

////////////////////////////////////////////////////////////////////////////////

export class LVGLLabelWidget extends LVGLWidget {
    text: string;
    previewValue: string;
    textType: LVGLPropertyType;
    longMode: keyof typeof LONG_MODE_CODES;
    recolor: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        label: (widget: LVGLLabelWidget) => {
            let name = getComponentName(widget.type);

            if (widget.identifier) {
                name = `${name} [${widget.identifier}]`;
            }

            if (widget.text && widget.textType == "literal") {
                return `${name}: ${widget.text}`;
            }

            return name;
        },

        properties: [
            ...makeLvglExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "translated-literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "previewValue",
                type: PropertyType.String,
                disabled: (widget: LVGLLabelWidget) => {
                    return (
                        widget.textType == "literal" ||
                        widget.textType == "translated-literal"
                    );
                },
                propertyGridGroup: specificGroup
            },
            {
                name: "longMode",
                type: PropertyType.Enum,
                enumItems: Object.keys(LONG_MODE_CODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "recolor",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            }
        ],

        beforeLoadHook: (
            object: LVGLLabelWidget,
            jsObject: Partial<LVGLLabelWidget>
        ) => {
            if (!jsObject.textType) {
                jsObject.textType = "literal";
            }
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 32,
            widthUnit: "content",
            heightUnit: "content",
            text: "Text",
            textType: "literal",
            longMode: "WRAP",
            recolor: false,
            localStyles: {}
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <circle cx="17.5" cy="15.5" r="3.5" />
                <path d="M3 19V8.5a3.5 3.5 0 0 1 7 0V19m-7-6h7m11-1v7" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            textType: observable,
            longMode: observable,
            recolor: observable,
            previewValue: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const textExpr = getExpressionPropertyData(runtime, this, "text");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateLabel(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            textExpr
                ? 0
                : runtime.wasm.allocateUTF8(
                      this.textType == "expression"
                          ? this.previewValue
                              ? unescapeCString(this.previewValue)
                              : getExpressionPropertyInitalValue(
                                    runtime,
                                    this,
                                    "text"
                                )
                          : unescapeCString(this.text)
                  ),
            LONG_MODE_CODES[this.longMode],
            this.recolor ? 1 : 0
        );

        if (textExpr) {
            runtime.wasm._lvglUpdateLabelText(
                obj,
                getFlowStateAddressIndex(runtime),
                textExpr.componentIndex,
                textExpr.propertyIndex
            );
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_label_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.longMode != "WRAP") {
            build.line(
                `lv_label_set_long_mode(obj, LV_LABEL_LONG_${this.longMode});`
            );
        }

        if (this.recolor) {
            if (lvglHasLabelRecolorSupport(this)) {
                build.line(`lv_label_set_recolor(obj, true);`);
            }
        }

        if (this.textType == "literal") {
            build.line(
                `lv_label_set_text(obj, ${escapeCString(this.text ?? "")});`
            );
        } else if (this.textType == "translated-literal") {
            build.line(
                `lv_label_set_text(obj, _(${escapeCString(this.text ?? "")}));`
            );
        } else {
            build.line(`lv_label_set_text(obj, "");`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLLabelWidget>(
            build,
            this,
            "text" as const,
            "lv_label_get_text",
            "lv_label_set_text"
        );
    }
}
