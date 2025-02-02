import React from "react";
import { makeObservable, observable } from "mobx";

import { makeDerivedClassInfo, MessageType } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";
import {
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    getExpressionPropertyData,
    getFlowStateAddressIndex
} from "../widget-common";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getThemedColor } from "project-editor/features/style/theme";
import { isValid } from "eez-studio-shared/color";
import { getChildOfObject, Message } from "project-editor/store";

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
    brightness: number;
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
        if (this.brightness < 0) {
            return 0;
        }
        if (this.brightness > 255) {
            return 255;
        }
        return this.brightness;
    }

    override get hasEventHandler() {
        return (
            super.hasEventHandler ||
            this.colorType == "expression" ||
            this.brightnessType == "expression"
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const colorExpr = getExpressionPropertyData(runtime, this, "color");
        const brightnessExpr = getExpressionPropertyData(
            runtime,
            this,
            "brightness"
        );

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateLed(
            parentObj,
            runtime.getCreateWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            colorExpr ? 0 : runtime.getColorNum(this.color),
            brightnessExpr ? 0 : this.brightnessValue
        );

        if (colorExpr) {
            runtime.wasm._lvglUpdateLedColor(
                obj,
                getFlowStateAddressIndex(runtime),
                colorExpr.componentIndex,
                colorExpr.propertyIndex
            );
        } else {
            runtime.lvglUpdateColor(this.color, (wasm, colorNum) =>
                wasm._lvglLedSetColor(obj, colorNum)
            );
        }

        if (brightnessExpr) {
            runtime.wasm._lvglUpdateLedBrightness(
                obj,
                getFlowStateAddressIndex(runtime),
                brightnessExpr.componentIndex,
                brightnessExpr.propertyIndex
            );
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_led_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.colorType == "literal") {
            build.buildColor(
                this,
                this.color,
                () => {
                    return build.getLvglObjectAccessor(this);
                },
                color => {
                    build.line(
                        `lv_led_set_color(obj, lv_color_hex(${color}));`
                    );
                },
                (color, obj) => {
                    if (build.project.settings.build.screensLifetimeSupport) {
                        build.line(
                            `if (${obj}) lv_led_set_color(${obj}, lv_color_hex(${color}));`
                        );
                    } else {
                        build.line(
                            `lv_led_set_color(${obj}, lv_color_hex(${color}));`
                        );
                    }
                }
            );
        }

        if (this.brightnessType == "literal") {
            build.line(`lv_led_set_brightness(obj, ${this.brightnessValue});`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLLedWidget>(
            build,
            this,
            "color" as const,
            "lv_led_get_color",
            "lv_led_set_color"
        );

        expressionPropertyBuildTickSpecific<LVGLLedWidget>(
            build,
            this,
            "brightness" as const,
            "lv_led_get_brightness",
            "lv_led_set_brightness"
        );
    }
}
