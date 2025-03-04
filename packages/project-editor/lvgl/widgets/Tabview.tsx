import React from "react";
import { observable, makeObservable } from "mobx";

import {
    PropertyType,
    makeDerivedClassInfo,
    MessageType,
    IMessage
} from "project-editor/core/object";

import { Message } from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import {
    LV_DIR_BOTTOM,
    LV_DIR_LEFT,
    LV_DIR_RIGHT,
    LV_DIR_TOP
} from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget, LVGLTabWidget, LVGLContainerWidget } from "./internal";
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
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true,
            tabviewPosition: "TOP",
            tabviewSize: 32
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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            tabviewPosition: observable,
            tabviewSize: observable
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
    }
}
