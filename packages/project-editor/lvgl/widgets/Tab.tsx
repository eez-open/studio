import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    getParent,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLTabviewWidget, LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import { AutoSize } from "project-editor/flow/component";
import { Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export const TAB_SIZE = 32;

export class LVGLTabWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: (widget: LVGLTabWidget) => {
            return widget.tabNameType == "expression"
                ? `{${widget.tabName}}`
                : widget.tabName;
        },

        componentPaletteGroupName: "!1Basic",

        properties: [
            ...makeLvglExpressionProperty(
                "tabName",
                "string",
                "input",
                ["literal", "translated-literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true,
            tabName: "Tab",
            tabNameType: "literal"
        },

        icon: (
            <svg viewBox="0 0 1024 1024">
                <path
                    d="M931.8 501.8V317.4c0-56.3-46.1-102.4-102.4-102.4h-601C172 215 126 261.1 126 317.4v184.3H30.7v163.8h981V501.8zm30.8 117.7H81.9V553h92.2l1-209.9c1-61.4 11.3-81.9 90.1-81.9h526.3c62.5 0 90.1 8.2 90.1 81.9V553h80.9v66.5z"
                    fill="currentcolor"
                />
            </svg>
        ),

        check: (widget: LVGLTabWidget, messages: IMessage[]) => {
            if (!widget.tabview) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid position of Tab widget inside Widgets Structure`,
                        widget
                    )
                );
            }
        },

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

    tabName: string;
    tabNameType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            tabName: observable,
            tabNameType: observable
        });
    }

    get parentWidget() {
        return getParent(getParent(this)) as LVGLWidget;
    }

    get tabview() {
        let parent = this.parentWidget;
        if (parent instanceof LVGLTabviewWidget) {
            // Tab is direct child of Tabview widget
            return parent;
        }

        parent = getParent(getParent(parent)) as LVGLWidget;
        if (parent instanceof LVGLTabviewWidget) {
            // Tab is child of Tabview content widget
            return parent;
        }

        // Neither, invalid position of Tab widget.
        return undefined;
    }

    get tabIndex() {
        return (getParent(this) as LVGLWidget[]).indexOf(this);
    }

    override get autoSize(): AutoSize {
        return "both";
    }

    override get relativePosition() {
        const relativePosition = super.relativePosition;

        if (this.parentWidget == this.tabview) {
            // adjust top position if Tab is immediate child of Tabview
            if (this.tabview.tabviewPosition == "TOP") {
                relativePosition.top += this.tabview.tabviewSize;
            } else if (this.tabview.tabviewPosition == "LEFT") {
                relativePosition.left += this.tabview.tabviewSize;
            }
        }

        return relativePosition;
    }

    override toLVGLCode(code: LVGLCode) {
        const tabview = this.tabview;
        const tabIndex = this.tabIndex;
        if (tabview && tabIndex != -1) {
            if (!(this.parentWidget instanceof LVGLTabviewWidget)) {
                code.getParentObject(
                    "lv_tabview_add_tab",
                    code.stringProperty(
                        this.tabNameType,
                        this.tabName,
                        undefined,
                        true
                    )
                );
            } else {
                code.getObject(
                    "lv_tabview_add_tab",
                    code.stringProperty(
                        this.tabNameType,
                        this.tabName,
                        undefined,
                        true
                    )
                );
            }

            if (this.tabNameType == "expression") {
                code.addToTick("tabName", () => {
                    const new_val = code.evalTextProperty(
                        "const char *",
                        "new_val",
                        this.tabName,
                        "Failed to evaluate Tab name in Tab widget"
                    );

                    let tabview = code.callFreeFunctionWithAssignment(
                        "lv_obj_t *",
                        "tabview",
                        "lv_obj_get_parent",
                        code.callObjectFunctionInline("lv_obj_get_parent")
                    );

                    let cur_val;
                    if (code.lvglBuild) {
                        const build = code.lvglBuild;

                        if (build.isV9) {
                            build.line(
                                `lv_obj_t *tab_bar = lv_tabview_get_tab_bar(tabview);`
                            );
                            build.line(
                                `lv_obj_t *button = lv_obj_get_child_by_type(tab_bar, ${tabIndex}, &lv_button_class);`
                            );
                            build.line(
                                `lv_obj_t *label = lv_obj_get_child_by_type(button, 0, &lv_label_class);`
                            );
                            build.line(
                                `const char *cur_val = lv_label_get_text(label);`
                            );
                        } else {
                            if (
                                tabview.tabviewPosition == "LEFT" ||
                                tabview.tabviewPosition == "RIGHT"
                            ) {
                                build.line(
                                    `const char *cur_val = ((lv_tabview_t *)tabview)->map[${tabIndex} * 2];`
                                );
                            } else {
                                build.line(
                                    `const char *cur_val = ((lv_tabview_t *)tabview)->map[${tabIndex}];`
                                );
                            }
                        }

                        cur_val = "cur_val";
                    } else {
                        cur_val = code.callFreeFunction(
                            "lvglGetTabName",
                            tabview,
                            tabIndex,
                            code.constant(`LV_DIR_${tabview.tabviewPosition}`)
                        );
                    }

                    code.ifStringNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();
                        code.callFreeFunction(
                            "lv_tabview_rename_tab",
                            tabview,
                            tabIndex,
                            new_val
                        );
                        code.tickChangeEnd();
                    });
                });
            }
        } else {
            code.createObject("lv_obj_create");
        }
    }
}
