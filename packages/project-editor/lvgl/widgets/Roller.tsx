import React from "react";
import { observable, makeObservable } from "mobx";

import { PropertyType, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { lvglStates, ROLLER_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLRollerWidget extends LVGLWidget {
    options: string;
    optionsType: LVGLPropertyType;

    selected: number | string;
    selectedType: LVGLPropertyType;

    mode: keyof typeof ROLLER_MODES;

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
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ROLLER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 100,
            clickableFlag: true,
            options: "Option 1\nOption 2\nOption 3",
            optionsType: "literal",
            selected: 0,
            selectedType: "literal",
            mode: "NORMAL"
        },

        beforeLoadHook: (
            object: LVGLRollerWidget,
            jsObject: Partial<LVGLRollerWidget>
        ) => {
            if (jsObject.optionsType == undefined) {
                jsObject.optionsType = "literal";
            }

            if (jsObject.selected == undefined) {
                jsObject.selected = 0;
                jsObject.selectedType = "literal";
            }
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M11 6h9"></path>
                <path d="M11 12h9"></path>
                <path d="M12 18h8"></path>
                <path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"></path>
                <path d="M6 10v-6l-2 2"></path>
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SELECTED"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_CHAIN_HOR|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

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
            mode: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject(`lv_roller_create`);

        // options
        code.callObjectFunction(
            "lv_roller_set_options",
            code.stringProperty(this.optionsType, this.options),
            code.constant(`LV_ROLLER_MODE_${this.mode}`)
        );

        if (this.optionsType == "expression") {
            code.addToTick("options", () => {
                const new_val = code.evalStringArrayPropertyAndJoin(
                    "const char *",
                    "new_val",
                    this.options,
                    "Failed to evaluate Options in Roller widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "const char *",
                    "cur_val",
                    "lv_roller_get_options"
                );

                if (code.lvglBuild) {
                    const build = code.lvglBuild;
                    build.blockStart(
                        `if (compareRollerOptions((lv_roller_t *)${code.objectAccessor}, new_val, cur_val, LV_ROLLER_MODE_${this.mode}) != 0) {`
                    );

                    code.tickChangeStart();
                    code.callObjectFunction(
                        "lv_roller_set_options",
                        new_val,
                        code.constant(`LV_ROLLER_MODE_${this.mode}`)
                    );
                    code.tickChangeEnd();

                    build.blockEnd(`}`);
                } else {
                    if (
                        code.callObjectFunction(
                            "compareRollerOptions",
                            new_val,
                            cur_val,
                            code.constant(`LV_ROLLER_MODE_${this.mode}`)
                        )
                    ) {
                        code.tickChangeStart();
                        code.callObjectFunction(
                            "lv_roller_set_options",
                            new_val,
                            code.constant(`LV_ROLLER_MODE_${this.mode}`)
                        );
                        code.tickChangeEnd();
                    }
                }
            });
        }

        // selected
        if (this.selectedType == "literal") {
            if (this.selected != 0) {
                code.callObjectFunction(
                    "lv_roller_set_selected",
                    this.selected,
                    code.constant("LV_ANIM_OFF")
                );
            }
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
                    "Failed to evaluate Selected in Roller widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_roller_get_selected"
                );

                code.ifIntegerNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction(
                        "lv_roller_set_selected",
                        new_val,
                        code.constant("LV_ANIM_OFF")
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
                            "lv_roller_get_selected",
                            ta
                        );

                        code.assignIntegerProperty(
                            "selected",
                            this.selected as string,
                            value,
                            "Failed to assign Selected in Roller widget"
                        );
                    });
                }
            );
        }
    }
}
