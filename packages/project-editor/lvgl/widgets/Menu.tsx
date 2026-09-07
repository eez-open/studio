import React from "react";
import { makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLMenuPageWidget, LVGLWidget } from "./internal";
import { Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLMenuWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1m0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1m0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1"
                    fill="currentcolor"
                />
            </svg>
        ),

        check: (widget: LVGLMenuWidget, messages: IMessage[]) => {
            for (const childWidget of widget.children) {
                if (!(childWidget instanceof LVGLMenuPageWidget)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Menu child is not a Menu page widget`,
                            childWidget
                        )
                    );
                }
            }
        },

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_menu_create");

        // show the first page once everything is created
        const firstPage = this.children.find(
            childWidget => childWidget instanceof LVGLMenuPageWidget
        );
        if (firstPage) {
            code.postPageExecute(() => {
                if (code.lvglBuild) {
                    const build = code.lvglBuild;
                    build.line(
                        `lv_menu_set_page(${build.getLvglObjectAccessor(
                            this
                        )}, ${build.getLvglObjectAccessor(firstPage)});`
                    );
                } else {
                    const pageObj = (firstPage as any)._lvglObj;
                    if (pageObj != undefined) {
                        code.callFreeFunction(
                            "lv_menu_set_page",
                            code.objectAccessor,
                            pageObj
                        );
                    }
                }
            });
        }
    }
}
