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

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLTabviewWidget, LVGLWidget } from "./internal";
import {
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import {
    getExpressionPropertyData,
    getExpressionPropertyInitalValue,
    getFlowStateAddressIndex,
    escapeCString,
    unescapeCString
} from "../widget-common";
import { AutoSize } from "project-editor/flow/component";
import { Message } from "project-editor/store";

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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        if (this.tabview) {
            const tabIndex = this.tabIndex;
            if (tabIndex != -1) {
                const tabNameExpr = getExpressionPropertyData(
                    runtime,
                    this,
                    "tabName"
                );

                const obj = runtime.wasm._lvglTabviewAddTab(
                    parentObj,
                    runtime.getCreateWidgetIndex(this),

                    runtime.wasm.allocateUTF8(
                        tabNameExpr
                            ? " " // can't be empty in LVGL version 8.3
                            : this.tabNameType == "expression"
                            ? getExpressionPropertyInitalValue(
                                  runtime,
                                  this,
                                  "tabName"
                              )
                            : unescapeCString(this.tabName || "")
                    )
                );

                if (tabNameExpr) {
                    runtime.wasm._lvglUpdateTabName(
                        obj,
                        getFlowStateAddressIndex(runtime),
                        tabNameExpr.componentIndex,
                        tabNameExpr.propertyIndex,
                        tabIndex
                    );
                }

                return obj;
            }
        }

        // Tab widget outside of Tabview, just create dummy widget
        const rect = this.getLvglCreateRect();
        const obj = runtime.wasm._lvglCreateContainer(
            parentObj,
            runtime.getCreateWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );
        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        if (this.tabview) {
            const tabIndex = this.tabIndex;
            if (tabIndex != -1) {
                let parentObj = "parent_obj";

                if (!(this.parentWidget instanceof LVGLTabviewWidget)) {
                    parentObj = "lv_obj_get_parent(parent_obj)";
                }

                if (this.tabNameType == "literal") {
                    build.line(
                        `lv_obj_t *obj = lv_tabview_add_tab(${parentObj}, ${escapeCString(
                            this.tabName ?? ""
                        )});`
                    );
                } else if (this.tabNameType == "translated-literal") {
                    build.line(
                        `lv_obj_t *obj = lv_tabview_add_tab(${parentObj}, _(${escapeCString(
                            this.tabName ?? ""
                        )}));`
                    );
                } else {
                    build.line(
                        `lv_obj_t *obj = lv_tabview_add_tab(${parentObj}, " ");`
                    );
                }
                return;
            }
        } else {
            // Tab widget outside of Tabview, create "generic" widget
            build.line(`lv_obj_t *obj = lv_obj_create(parent_obj);`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLTabWidget>(
            build,
            this,
            "tabName" as const,
            "",
            ""
        );
    }
}
