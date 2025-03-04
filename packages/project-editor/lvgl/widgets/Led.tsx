import React from "react";
import { makeObservable, observable } from "mobx";

import { makeDerivedClassInfo, MessageType } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getThemedColor } from "project-editor/features/style/theme";
import { isValid } from "eez-studio-shared/color";
import { getChildOfObject, Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLLedWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            ...makeLvglExpressionProperty(
                "color",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    colorEditorForLiteral: true
                }
            ),
            ...makeLvglExpressionProperty(
                "brightness",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    formText:
                        "The brightness should be between 0 (darkest) and 255 (lightest)."
                }
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 32,
            height: 32,
            clickableFlag: true,

            color: "#0000FF",
            colorType: "literal",

            brightness: 255,
            brightnessType: "literal"
        },

        check(object: LVGLLedWidget, messages) {
            if (object.colorType == "literal") {
                const colorValue = getThemedColor(
                    ProjectEditor.getProjectStore(object),
                    object.color
                ).colorValue;

                if (!isValid(colorValue)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `invalid color`,
                            getChildOfObject(object, "color")
                        )
                    );
                }
            }
        },

        icon: (
            <svg viewBox="0 0 512 512">
                <path
                    d="M256 20.5c-45.5 0-74.137 18.276-92.676 44.23C144.784 90.685 137 125 137 155.5v151h238v-151c0-30.5-7.785-64.815-26.324-90.77S301.5 20.5 256 20.5m8.756 11.885q1.926.002 3.812.047A184 235.5 0 0 0 145.91 160.336c1.113-28.645 9.045-59.746 26.17-83.72 18.54-25.955 47.176-44.23 92.676-44.23zM105 324.5v46h302v-46zm78 64v39h-7v32h7v32h18v-32h7v-32h-7v-39zm128 0v39h-7v32h7v32h18v-32h7v-32h-7v-39z"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    color: string;
    colorType: LVGLPropertyType;
    brightness: number | string;
    brightnessType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            color: observable,
            colorType: observable,
            brightness: observable,
            brightnessType: observable
        });
    }

    get brightnessValue() {
        if (typeof this.brightness == "string") {
            return this.brightness;
        }

        if (this.brightness < 0) {
            return 0;
        }
        if (this.brightness > 255) {
            return 255;
        }
        return this.brightness;
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_led_create");

        // color
        if (this.colorType == "literal") {
            code.buildColor(
                this,
                this.color,
                () => code.objectAccessor,
                color => {
                    code.callObjectFunction(
                        "lv_led_set_color",
                        code.color(color)
                    );
                },
                (color, obj) => {
                    if (code.lvglBuild && code.screensLifetimeSupport) {
                        const build = code.lvglBuild;
                        build.line(
                            `if (${obj}) lv_led_set_color(${obj}, ${code.color(
                                color
                            )});`
                        );
                    } else {
                        code.callObjectFunction(
                            "lv_led_set_color",
                            code.color(color)
                        );
                    }
                }
            );
        } else {
            code.addToTick("color", () => {
                const new_val = code.evalUnsignedIntegerProperty(
                    "uint32_t",
                    "new_val",
                    this.color as string,
                    "Failed to evaluate Color in Led widget"
                );

                let cur_val;

                if (code.lvglBuild) {
                    const build = code.lvglBuild;
                    if (code.isV9) {
                        build.line(
                            `uint32_t cur_val = lv_color_to_u32(((lv_led_t *)${code.objectAccessor})->color);`
                        );
                    } else {
                        build.line(
                            `uint32_t cur_val = lv_color_to32(((lv_led_t *)${code.objectAccessor})->color);`
                        );
                    }
                    cur_val = "cur_val";
                } else {
                    cur_val = code.callObjectFunction("lvglLedGetColor");
                }

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    console.log(new_val, cur_val);

                    code.callObjectFunction(
                        "lv_led_set_color",
                        code.color(new_val)
                    );

                    code.tickChangeEnd();
                });
            });
        }

        // brightness
        if (this.brightnessType == "literal") {
            code.callObjectFunction(
                "lv_led_set_brightness",
                this.brightnessValue
            );
        } else {
            code.addToTick("brightness", () => {
                let new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.brightness as string,
                    "Failed to evaluate Brightness in Led widget"
                );

                if (code.lvglBuild) {
                    const build = code.lvglBuild;
                    build.line(`if (new_val < 0) new_val = 0;`);
                    build.line(`else if (new_val > 255) new_val = 255;`);
                } else {
                    if (new_val < 0) {
                        new_val = 0;
                    } else if (new_val > 255) {
                        new_val = 255;
                    }
                }

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_led_get_brightness"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction("lv_led_set_brightness", new_val);

                    code.tickChangeEnd();
                });
            });
        }
    }
}
