import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    PropertyType,
    getParent,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget, LVGLScaleWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import { checkWidgetTypeLvglVersion } from "../widget-common";
import { filterFloat } from "eez-studio-shared/validation-filters";
import { getChildOfObject, Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLLineWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "points",
                type: PropertyType.String,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLLineWidget) =>
                    widget.isScaleNeedle
            },
            {
                name: "invertY",
                displayName: "Invert Y",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLLineWidget) =>
                    widget.isScaleNeedle
            },
            {
                name: "needleLength",
                displayName: "Needle length",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLLineWidget) =>
                    !widget.isScaleNeedle
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLLineWidget) =>
                        !widget.isScaleNeedle
                }
            ),
            {
                name: "previewValue",
                type: PropertyType.String,
                disabled: (widget: LVGLLineWidget) => {
                    return widget.valueType == "literal";
                },
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLLineWidget) =>
                    !widget.isScaleNeedle
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 200,
            widthUnit: "content",
            height: 50,
            heightUnit: "content",
            points: "0,0 50,50 100,0 150,50 200,0",
            needleLength: 0,
            value: 0,
            valueType: "literal",
            previewValue: 0
        },

        check: (widget: LVGLLineWidget, messages: IMessage[]) => {
            if (widget.isScaleNeedle) {
                checkWidgetTypeLvglVersion(widget, messages, "9.");

                if (
                    widget.needleLength == undefined ||
                    widget.needleLength == null ||
                    !Number.isInteger(widget.needleLength)
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Needle length must be an integer`,
                            getChildOfObject(widget, "needleLength")
                        )
                    );
                }

                if (widget.valueType == "literal") {
                    if (
                        widget.value == undefined ||
                        widget.value == null ||
                        !Number.isInteger(Number(widget.value))
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Value must be an integer`,
                                getChildOfObject(widget, "value")
                            )
                        );
                    }
                }
            } else {
                if (widget.points) {
                    const valueStrs = widget.pointsStrArr;

                    for (let i = 0; i < valueStrs.length; i++) {
                        const value = filterFloat(valueStrs[i]);

                        if (isNaN(value)) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Invalid point value "${
                                        valueStrs[i]
                                    }" at position ${i + 1}`,
                                    getChildOfObject(widget, "points")
                                )
                            );
                        }
                    }

                    if (valueStrs.length % 2 == 1) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `The number of values ​​must be even`,
                                getChildOfObject(widget, "points")
                            )
                        );
                    }
                }
            }
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M3.293 20.707a1 1 0 0 1 0-1.414l16-16a1 1 0 1 1 1.414 1.414l-16 16a1 1 0 0 1-1.414 0"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    points: string;
    invertY: boolean;
    needleLength: number;
    value: number | string;
    valueType: LVGLPropertyType;
    previewValue: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            points: observable,
            invertY: observable,
            needleLength: observable,
            value: observable,
            valueType: observable,
            previewValue: observable
        });
    }

    get isScaleNeedle(): boolean {
        const parentChildren = getParent(this);
        const parentWidget = getParent(parentChildren as any);
        return parentWidget instanceof LVGLScaleWidget;
    }

    get pointsStrArr() {
        return this.points.trim().split(/\s+|,/);
    }

    override toLVGLCode(code: LVGLCode) {
        if (this.isScaleNeedle && !code.isV9) {
            // Scale widget doesn't exist in LVGL version 8.x
            code.createObject("lv_obj_create");
            return;
        }

        if (this.isScaleNeedle) {
            code.createObjectWithoutPosAndSize("lv_line_create");
        } else {
            code.createObject("lv_line_create");
        }

        if (this.isScaleNeedle) {
            // scale needle mode
            if (this.valueType == "literal") {
                code.postWidgetExecute(() => {
                    if (code.lvglBuild) {
                        code.callFreeFunction(
                            "lv_scale_set_line_needle_value",
                            "parent_obj",
                            "obj",
                            this.needleLength,
                            this.value
                        );
                    } else {
                        const parentObj = code.callFreeFunction(
                            "lv_obj_get_parent",
                            code.objectAccessor
                        );
                        code.callFreeFunction(
                            "lv_scale_set_line_needle_value",
                            parentObj,
                            code.objectAccessor,
                            this.needleLength,
                            this.value
                        );
                    }
                });
            }

            if (this.valueType == "expression") {
                if (code.pageRuntime && code.pageRuntime.isEditor) {
                    const previewValue = Number.parseInt(this.previewValue);

                    if (!isNaN(previewValue)) {
                        code.postWidgetExecute(() => {
                            const parentObj = code.callFreeFunction(
                                "lv_obj_get_parent",
                                code.objectAccessor
                            );
                            code.callFreeFunction(
                                "lv_scale_set_line_needle_value",
                                parentObj,
                                code.objectAccessor,
                                this.needleLength,
                                previewValue
                            );
                        });
                    }
                }

                code.addToTick("value", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.value as string,
                        "Failed to evaluate Value in Line widget"
                    );

                    if (code.lvglBuild) {
                        code.callFreeFunction(
                            "lv_scale_set_line_needle_value",
                            `lv_obj_get_parent(${code.objectAccessor})`,
                            code.objectAccessor,
                            this.needleLength,
                            new_val
                        );
                    } else {
                        const parentObj = code.callFreeFunction(
                            "lv_obj_get_parent",
                            code.objectAccessor
                        );
                        code.callFreeFunction(
                            "lv_scale_set_line_needle_value",
                            parentObj,
                            code.objectAccessor,
                            this.needleLength,
                            new_val
                        );
                    }
                });
            }
        } else {
            // points
            if (this.points) {
                const values = this.pointsStrArr.map(valueStr =>
                    filterFloat(valueStr)
                );

                if (
                    values.length % 2 == 0 &&
                    values.findIndex(value => isNaN(value)) == -1
                ) {
                    if (code.lvglBuild) {
                        const build = code.lvglBuild;

                        build.blockStart(
                            `static ${
                                build.isV9
                                    ? "lv_point_precise_t"
                                    : "lv_point_t"
                            } line_points[] = {`
                        );

                        const numPoints = values.length / 2;

                        for (let i = 0; i < numPoints; i++) {
                            if (build.isV9) {
                                build.line(
                                    `{ ${values[2 * i + 0]}, ${
                                        values[2 * i + 1]
                                    } }${i == numPoints - 1 ? "" : ","}`
                                );
                            } else {
                                build.line(
                                    `{ ${Math.floor(
                                        values[2 * i + 0]
                                    )}, ${Math.floor(values[2 * i + 1])} }${
                                        i == numPoints - 1 ? "" : ","
                                    }`
                                );
                            }
                        }

                        build.blockEnd(`};`);

                        code.callObjectFunction(
                            "lv_line_set_points",
                            "line_points",
                            numPoints
                        );
                    } else {
                        const runtime = code.pageRuntime!;

                        const valuesArray = new Float32Array(values.length);
                        for (let i = 0; i < values.length; i++) {
                            valuesArray[i] = values[i];
                        }

                        const valuesBuffer = runtime.wasm._malloc(
                            valuesArray.length * valuesArray.BYTES_PER_ELEMENT
                        );

                        runtime.wasm.HEAPF32.set(
                            valuesArray,
                            valuesBuffer >> 2
                        );

                        code.callObjectFunction(
                            "lvglLineSetPoints",
                            valuesBuffer,
                            values.length / 2
                        );

                        runtime.wasm._free(valuesBuffer);
                    }
                }
            }

            // invertY
            if (this.invertY) {
                code.callObjectFunction(
                    "lv_line_set_y_invert",
                    code.constant("true")
                );
            }
        }
    }
}
