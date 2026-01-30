import React from "react";
import { observable, makeObservable } from "mobx";

import {
    PropertyType,
    makeDerivedClassInfo,
    MessageType,
    IMessage
} from "project-editor/core/object";

import { getChildOfObject, Message } from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import {
    LV_DIR_BOTTOM,
    LV_DIR_LEFT,
    LV_DIR_RIGHT,
    LV_DIR_TOP
} from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget, LVGLTabWidget, LVGLContainerWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

const TABVIEW_POSITION = {
    LEFT: LV_DIR_LEFT,
    RIGHT: LV_DIR_RIGHT,
    TOP: LV_DIR_TOP,
    BOTTOM: LV_DIR_BOTTOM
};

export class LVGLTabviewWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "tabviewPosition",
                displayName: "Position",
                type: PropertyType.Enum,
                enumItems: Object.keys(TABVIEW_POSITION).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "tabviewSize",
                displayName: "Size",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "selectedTab",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    displayName: "Active tab"
                }
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true,
            tabviewPosition: "TOP",
            tabviewSize: 32,
            selectedTab: 0,
            selectedTabType: "literal"
        },

        beforeLoadHook: (
            object: LVGLTabviewWidget,
            jsObject: Partial<LVGLTabviewWidget>
        ) => {
            if (jsObject.selectedTabType == undefined) {
                jsObject.selectedTabType = "literal";
            }
        },
        
        check: (widget: LVGLTabviewWidget, messages: IMessage[]) => {
            let tabBar = false;
            let tabContent = false;

            for (let i = 0; i < widget.children.length; i++) {
                const childWidget = widget.children[i];
                if (childWidget instanceof LVGLContainerWidget) {
                    if (i == 0) {
                        tabBar = true;
                    } else if (i == 1) {
                        tabContent = true;
                    } else {
                        if (tabBar && tabContent) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Redundant Container widget`,
                                    childWidget
                                )
                            );
                        } else {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `Invalid Container widget position`,
                                    childWidget
                                )
                            );
                        }
                    }
                } else if (childWidget instanceof LVGLTabWidget) {
                    if (tabContent) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Tab should be child of Content container`,
                                childWidget
                            )
                        );
                    }
                } else {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Tabview child is neither Tab or Container widget`,
                            childWidget
                        )
                    );
                }
            }

        if (widget.selectedTabType == "literal") {
                if (
                    widget.selectedTab == undefined ||
                    widget.selectedTab == null ||
                    !Number.isInteger(Number(widget.selectedTab))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Min value must be an integer`,
                            getChildOfObject(widget, "selectedTab")
                        )
                    );
                }
            }            
        },

        icon: (
            <svg viewBox="0 0 24 24" strokeWidth={1.5} fill="none">
                <path
                    d="M22 8h-6.5M9 4v4h6.5m0 0V4"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M2 17.714V6.286C2 5.023 2.995 4 4.222 4h15.556C21.005 4 22 5.023 22 6.286v11.428C22 18.977 21.005 20 19.778 20H4.222C2.995 20 2 18.977 2 17.714Z"
                    stroke="currentColor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        }
    });

    tabviewPosition: keyof typeof TABVIEW_POSITION;
    tabviewSize: number;
    selectedTab: number | string;
    selectedTabType: LVGLPropertyType;

    _selectedTabIndex: number = 0;

    get selectedTabIndex() {
        let numTabs = 0;
        for (const child of this.children) {
            if (child instanceof LVGLTabWidget) {
                numTabs++;
            } else {
                for (const child2 of child.children) {
                    if (child2 instanceof LVGLTabWidget) {
                        numTabs++;
                    }
                }
            }
        }

        if (this._selectedTabIndex < numTabs) {
            return this._selectedTabIndex;
        }

        if (this._selectedTabIndex - 1 > 0) {
            return this._selectedTabIndex - 1;
        }

        return 0;
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            tabviewPosition: observable,
            tabviewSize: observable,
            selectedTab: observable,
            selectedTabType: observable,
            _selectedTabIndex: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        const position = this.tabviewPosition ?? "TOP";
        const size = this.tabviewSize ?? 32;

        if (code.isV9) {
            code.createObject("lv_tabview_create");
            code.callObjectFunction(
                "lv_tabview_set_tab_bar_position",
                code.constant(`LV_DIR_${position}`)
            );
            code.callObjectFunction("lv_tabview_set_tab_bar_size", size);
        } else {
            code.createObject(
                "lv_tabview_create",
                code.constant(`LV_DIR_${position}`),
                size
            );
        }

        if (code.pageRuntime && code.pageRuntime.isEditor) {
            const selectedTabIndex = this.selectedTabIndex;

            code.postPageExecute(() => {
                if (code.isV9) {
                    code.callObjectFunction(
                        "lv_tabview_set_active",
                        selectedTabIndex,
                        code.constant("LV_ANIM_OFF")
                    );
                } else {
                    code.callObjectFunction(
                        "lv_tabview_set_act",
                        selectedTabIndex,
                        code.constant("LV_ANIM_OFF")
                    );
                }
            });
        } else {
            if (this.selectedTabType == "literal") {
                if (this.selectedTab != 0) {
                    if (code.isV9) {
                        code.callObjectFunction(
                            "lv_tabview_set_active",
                            this.selectedTab,
                            code.constant("LV_ANIM_OFF")
                        );
                    } else {
                        code.callObjectFunction(
                            "lv_tabview_set_act",
                            this.selectedTab,
                            code.constant("LV_ANIM_OFF")
                        );
                    }
                }
            } else {
                code.addToTick("selectedTab", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.selectedTab as string,
                        "Failed to evaluate Active tab in Tabview widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        code.isV9
                            ? "lv_tabview_get_tab_active"
                            : "lv_tabview_get_tab_act"
                    );

                    code.ifIntegerNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();

                        if (code.isV9) {
                            code.callObjectFunction(
                                "lv_tabview_set_active",
                                new_val,
                                code.constant("LV_ANIM_OFF")
                            );
                        } else {
                            code.callObjectFunction(
                                "lv_tabview_set_act",
                                new_val,
                                code.constant("LV_ANIM_OFF")
                            );
                        }

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

                        code.ifIntegerNotEqual(tick_value_change_obj, ta, () => {
                            const value = code.callFreeFunctionWithAssignment(
                                "int32_t",
                                "value",
                                code.isV9
                                    ? "lv_tabview_get_tab_active"
                                    : "lv_tabview_get_tab_act",
                                ta
                            );

                            code.assignIntegerProperty(
                                "selectedTab",
                                this.selectedTab as string,
                                value,
                                "Failed to assign Active tab in Tabview widget"
                            );
                        });
                    }
                );
            }
        }
    }
}
