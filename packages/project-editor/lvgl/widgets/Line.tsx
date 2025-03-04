import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget } from "./internal";
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
                propertyGridGroup: specificGroup
            },
            {
                name: "invertY",
                displayName: "Invert Y",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 200,
            widthUnit: "content",
            height: 50,
            heightUnit: "content",
            points: "0,0 50,50 100,0 150,50 200,0"
        },

        check: (widget: LVGLLineWidget, messages: IMessage[]) => {
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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            points: observable,
            invertY: observable
        });
    }

    get pointsStrArr() {
        return this.points.trim().split(/\s+|,/);
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_line_create");

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
                            build.isV9 ? "lv_point_precise_t" : "lv_point_t"
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

                    runtime.wasm.HEAPF32.set(valuesArray, valuesBuffer >> 2);

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
