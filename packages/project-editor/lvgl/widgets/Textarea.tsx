import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { Project, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";

import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

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

    override toLVGLCode(code: LVGLCode) {
        code.createObject(`lv_textarea_create`);

        // acceptedCharacters
        if (this.acceptedCharacters) {
            code.callObjectFunction(
                "lv_textarea_set_accepted_chars",
                code.stringProperty("literal", this.acceptedCharacters)
            );
        }

        // maxTextLength
        code.callObjectFunction(
            "lv_textarea_set_max_length",
            this.maxTextLength ?? 128
        );

        // text
        if (this.text) {
            if (
                this.textType == "literal" ||
                this.textType == "translated-literal"
            ) {
                code.callObjectFunction(
                    "lv_textarea_set_text",
                    code.stringProperty(this.textType, this.text)
                );
            } else {
                code.addToTick("text", () => {
                    const new_val = code.evalTextProperty(
                        "const char *",
                        "new_val",
                        this.text,
                        "Failed to evaluate Text in Textarea widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "const char *",
                        "cur_val",
                        "lv_textarea_get_text"
                    );

                    code.ifStringNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();
                        code.callObjectFunction(
                            "lv_textarea_set_text",
                            new_val
                        );
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

                        code.ifIntegerNotEqual(
                            tick_value_change_obj,
                            ta,
                            () => {
                                const value =
                                    code.callFreeFunctionWithAssignment(
                                        "const char *",
                                        "value",
                                        "lv_textarea_get_text",
                                        ta
                                    );

                                code.assignStringProperty(
                                    "text",
                                    this.text as string,
                                    value,
                                    "Failed to assign Text in Textarea widget"
                                );
                            }
                        );
                    }
                );
            }
        }

        // placeholder
        if (this.placeholder) {
            code.callObjectFunction(
                "lv_textarea_set_placeholder_text",
                code.stringProperty("literal", this.placeholder)
            );
        }

        // oneLineMode
        code.callObjectFunction(
            "lv_textarea_set_one_line",
            code.constant(this.oneLineMode ? "true" : "false")
        );

        // passwordMode
        code.callObjectFunction(
            "lv_textarea_set_password_mode",
            code.constant(this.passwordMode ? "true" : "false")
        );
    }
}
