import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { Project, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { LV_EVENT_TEXTAREA_TEXT_CHANGED } from "project-editor/lvgl/lvgl-constants";

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

export class LVGLTextareaWidget extends LVGLWidget {
    text: string;
    textType: LVGLPropertyType;
    placeholder: string;
    oneLineMode: boolean;
    passwordMode: boolean;
    acceptedCharacters: string;
    maxTextLength: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

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
                name: "placeholder",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "oneLineMode",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "passwordMode",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "acceptedCharacters",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "maxTextLength",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 70,
            clickableFlag: true,
            text: "",
            textType: "literal",
            placeholder: "",
            oneLineMode: false,
            passwordMode: false,
            acceptedCharacters: "",
            maxTextLength: 128
        },

        icon: (
            <svg
                viewBox="0 0 509.337 509.338"
                stroke="currentColor"
                fill="currentColor"
            >
                <path d="M396.283 310.907c-3.809-1.52-7.143-.853-9.996 1.998l-18.274 18.274c-1.711 1.708-2.573 3.806-2.573 6.276v35.978c0 12.565-4.463 23.314-13.408 32.264-8.952 8.945-19.701 13.418-32.264 13.418H82.224c-12.562 0-23.317-4.473-32.264-13.418-8.947-8.949-13.418-19.698-13.418-32.264V135.895c0-12.563 4.471-23.317 13.418-32.265 8.947-8.945 19.702-13.418 32.264-13.418H319.77c4.186 0 8.47.571 12.847 1.714 3.433 1.141 6.472.381 9.134-2.284l13.986-13.99c2.286-2.281 3.138-5.043 2.57-8.278-.571-3.044-2.286-5.234-5.141-6.565-10.28-4.752-21.412-7.139-33.403-7.139H82.224c-22.648 0-42.017 8.042-58.102 24.126C8.042 93.882 0 113.246 0 135.897V373.44c0 22.647 8.042 42.014 24.123 58.098 16.084 16.088 35.454 24.13 58.102 24.13h237.539c22.647 0 42.014-8.042 58.098-24.13 16.088-16.084 24.13-35.45 24.13-58.098v-54.245c-.001-4.004-1.908-6.761-5.709-8.288z" />
                <path d="M182.721 300.354v82.221h82.229l191.86-191.859-82.228-82.225-191.861 191.863zm70.803 54.815-15.99-.007v-27.401h-27.406v-15.984l33.12-33.12 43.396 43.4-33.12 33.112zm125.337-196.146-99.931 99.928c-3.234 3.241-6.376 3.334-9.421.288-3.043-3.046-2.95-6.186.287-9.419l99.931-99.929c3.233-3.239 6.368-3.333 9.421-.287s2.943 6.185-.287 9.419zm122.485-51.675L457.95 63.952c-5.328-5.33-11.796-7.995-19.413-7.995-7.615 0-14.086 2.665-19.411 7.995l-26.269 26.263 82.228 82.229 26.262-26.268c5.328-5.327 7.991-11.8 7.991-19.414s-2.664-14.084-7.992-19.414z" />
            </svg>
        ),

        lvgl: (widget: LVGLTextareaWidget, project: Project) => {
            return {
                parts: ["MAIN", "SELECTED", "CURSOR"],
                defaultFlags:
                    project.settings.general.lvglVersion == "9.0"
                        ? "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SNAPPABLE"
                        : "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SCROLL_WITH_ARROW|SNAPPABLE",
                states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"],

                oldInitFlags:
                    "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
                oldDefaultFlags:
                    "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
            };
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            textType: observable,
            placeholder: observable,
            oneLineMode: observable,
            passwordMode: observable,
            acceptedCharacters: observable,
            maxTextLength: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const textExpr = getExpressionPropertyData(runtime, this, "text");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateTextarea(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            textExpr || !this.text
                ? 0
                : runtime.wasm.allocateUTF8(
                      this.textType == "expression"
                          ? `{${this.text}}`
                          : unescapeCString(this.text)
                  ),
            !this.placeholder
                ? 0
                : runtime.wasm.allocateUTF8(unescapeCString(this.placeholder)),
            this.oneLineMode,
            this.passwordMode,
            (!runtime.isEditor || this.textType != "expression") &&
                this.acceptedCharacters
                ? runtime.allocateUTF8(this.acceptedCharacters, true)
                : 0,
            this.maxTextLength
        );

        if (textExpr) {
            runtime.wasm._lvglUpdateTextareaText(
                obj,
                getFlowStateAddressIndex(runtime),
                textExpr.componentIndex,
                textExpr.propertyIndex
            );
        }

        return obj;
    }

    override get hasEventHandler() {
        return super.hasEventHandler || this.textType == "expression";
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = getExpressionPropertyData(runtime, this, "text");
        if (valueExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_TEXTAREA_TEXT_CHANGED,
                valueExpr.componentIndex,
                valueExpr.propertyIndex,
                0
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_textarea_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.acceptedCharacters) {
            build.line(
                `lv_textarea_set_accepted_chars(obj, ${escapeCString(
                    this.acceptedCharacters
                )});`
            );
        }

        build.line(
            `lv_textarea_set_max_length(obj, ${this.maxTextLength ?? 128});`
        );

        if (this.text) {
            if (this.textType == "literal") {
                build.line(
                    `lv_textarea_set_text(obj, ${escapeCString(this.text)});`
                );
            } else if (this.textType == "translated-literal") {
                build.line(
                    `lv_textarea_set_text(obj, _(${escapeCString(this.text)}));`
                );
            }
        }

        if (this.placeholder) {
            build.line(
                `lv_textarea_set_placeholder_text(obj, ${escapeCString(
                    this.placeholder
                )});`
            );
        }

        build.line(
            `lv_textarea_set_one_line(obj, ${
                this.oneLineMode ? "true" : "false"
            });`
        );

        build.line(
            `lv_textarea_set_password_mode(obj, ${
                this.passwordMode ? "true" : "false"
            });`
        );
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLTextareaWidget>(
            build,
            this,
            "text" as const,
            "lv_textarea_get_text",
            "lv_textarea_set_text"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLTextareaWidget>(
            build,
            this,
            "text" as const,
            "lv_textarea_get_text"
        );
    }
}
