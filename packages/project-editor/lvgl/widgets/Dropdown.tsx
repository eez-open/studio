import React from "react";
import { observable, makeObservable } from "mobx";

import { makeDerivedClassInfo, PropertyType } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import {
    LV_DIR_TOP,
    LV_DIR_LEFT,
    LV_DIR_BOTTOM,
    LV_DIR_RIGHT,
    lvglStates
} from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";

import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

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

    override toLVGLCode(code: LVGLCode) {
        code.createObject(`lv_dropdown_create`);

        // options
        code.callObjectFunction(
            "lv_dropdown_set_options",
            code.stringProperty(this.optionsType, this.options)
        );

        if (this.optionsType == "expression") {
            code.addToTick("options", () => {
                const new_val = code.evalStringArrayPropertyAndJoin(
                    "const char *",
                    "new_val",
                    this.options,
                    "Failed to evaluate Options in Dropdown widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "const char *",
                    "cur_val",
                    "lv_dropdown_get_options"
                );

                code.ifStringNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();
                    code.callObjectFunction("lv_dropdown_set_options", new_val);
                    code.tickChangeEnd();
                });
            });
        }

        // direction
        if (this.direction != "bottom") {
            code.callObjectFunction(
                "lv_dropdown_set_dir",
                code.constant(`LV_DIR_${this.direction.toUpperCase()}`)
            );
        }

        // selected
        if (this.selectedType == "literal") {
            code.callObjectFunction("lv_dropdown_set_selected", this.selected);
        } else {
            code.addToTick("selected", () => {
                if (code.lvglBuild) {
                    code.blockStart(
                        `if (!(lv_obj_get_state(${code.objectAccessor}) & LV_STATE_EDITED)) {`
                    );
                } else {
                    if (
                        code.callObjectFunction("lv_obj_get_state") &
                        lvglStates.EDITED
                    ) {
                        return;
                    }
                }

                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.selected as string,
                    "Failed to evaluate Selected in Dropdown widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_dropdown_get_selected"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction(
                        "lv_dropdown_set_selected",
                        new_val
                    );

                    code.tickChangeEnd();
                });

                if (code.lvglBuild) {
                    code.blockEnd("}");
                }
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

                    code.ifIntegerNotEqual(tick_value_change_obj, ta, () => {
                        const value = code.callFreeFunctionWithAssignment(
                            "int32_t",
                            "value",
                            "lv_dropdown_get_selected",
                            ta
                        );

                        code.assignIntegerProperty(
                            "selected",
                            this.selected as string,
                            value,
                            "Failed to assign Selected in Dropdown widget"
                        );
                    });
                }
            );
        }
    }
}
