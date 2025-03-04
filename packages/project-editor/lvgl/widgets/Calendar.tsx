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
import { getChildOfObject, Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLCalendarWidget extends LVGLWidget {
    todayYear: number;
    todayMonth: number;
    todayDay: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "todayYear",
                displayName: "Year",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "todayMonth",
                displayName: "Month",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "todayDay",
                displayName: "Day",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 230,
            height: 240,
            clickableFlag: true,
            todayYear: 2022,
            todayMonth: 11,
            todayDay: 1
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="5" width="16" height="16" rx="2" />
                <path d="M16 3v4M8 3v4m-4 4h16m-9 4h1m0 0v3" />
            </svg>
        ),

        check: (widget: LVGLCalendarWidget, messages: IMessage[]) => {
            function dateIsValid(date: any) {
                return date instanceof Date && !isNaN(date as any);
            }

            if (!dateIsValid(new Date(`${widget.todayYear}-1-1`))) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid year`,
                        getChildOfObject(widget, "todayYear")
                    )
                );
            } else {
                if (
                    !dateIsValid(
                        new Date(`${widget.todayYear}-${widget.todayMonth}-1`)
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid month`,
                            getChildOfObject(widget, "todayMonth")
                        )
                    );
                } else {
                    if (
                        !dateIsValid(
                            new Date(
                                `${widget.todayYear}-${widget.todayMonth}-${widget.todayDay}`
                            )
                        )
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid day`,
                                getChildOfObject(widget, "todayDay")
                            )
                        );
                    }
                }
            }
        },

        lvgl: {
            parts: ["MAIN", "ITEMS"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            todayYear: observable,
            todayMonth: observable,
            todayDay: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_calendar_create");

        code.callObjectFunction("lv_calendar_header_arrow_create");
        code.callObjectFunction(
            "lv_calendar_set_today_date",
            this.todayYear,
            this.todayMonth,
            this.todayDay
        );
        code.callObjectFunction(
            "lv_calendar_set_showed_date",
            this.todayYear,
            this.todayMonth
        );
    }
}
