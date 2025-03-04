import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LONG_MODE_CODES } from "project-editor/lvgl/lvgl-constants";

import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "project-editor/lvgl/expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";
import { getComponentName } from "project-editor/flow/components/components-registry";

import { LVGLWidget } from "./internal";

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
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
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

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_label_create");

        // longMode
        if (this.longMode != "WRAP") {
            code.callObjectFunction(
                "lv_label_set_long_mode",
                code.constant(`LV_LABEL_LONG_${this.longMode}`)
            );
        }

        // recolor
        if (this.recolor && !code.isV9) {
            code.callObjectFunction(
                "lv_label_set_recolor",
                code.constant("true")
            );
        }

        // text
        code.callObjectFunction(
            "lv_label_set_text",
            code.stringProperty(this.textType, this.text, this.previewValue)
        );
        if (this.textType == "expression") {
            code.addToTick("text", () => {
                const new_val = code.evalTextProperty(
                    "const char *",
                    "new_val",
                    this.text,
                    "Failed to evaluate Text in Label widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "const char *",
                    "cur_val",
                    "lv_label_get_text"
                );

                code.ifStringNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();
                    code.callObjectFunction("lv_label_set_text", new_val);
                    code.tickChangeEnd();
                });
            });
        }
    }
}
