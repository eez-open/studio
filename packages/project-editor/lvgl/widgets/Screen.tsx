import React from "react";
import { makeObservable } from "mobx";

import { IEezObject, makeDerivedClassInfo } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import { getAncestorOfType } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Page } from "project-editor/features/page/page";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

// This widget is not available from palette. It is used as a root widget for the Page/Screen.

export class LVGLScreenWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) => false,

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 50,
            clickableFlag: true
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
                <rect x="3" y="5" width="18" height="14" rx="2" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SCROLLBAR"],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        },

        isSelectable: (object: IEezObject) => false,
        isMoveable: (object: IEezObject) => false
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override toLVGLCode(code: LVGLCode) {
        const page = getAncestorOfType(
            this,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        if (code.lvglBuild) {
            if (page.isUsedAsUserWidget) {
                code.createObject("lv_obj_create");
            } else {
                if (code.hasFlowSupport) {
                    const build = code.lvglBuild;
                    let flowIndex = build.assets.getFlowIndex(page);
                    build.line(
                        `void *flowState = getFlowState(0, ${flowIndex});`
                    );
                }

                code.createScreen();
            }
        } else {
            code.createScreen();
        }

        if (code.lvglBuild) {
            const allGroups = ProjectEditor.getProject(this).lvglGroups.groups;
            if (allGroups.length > 0) {
                code.addEventHandler("SCREEN_LOAD_START", event => {
                    for (const group of allGroups) {
                        const build = code.lvglBuild!;

                        build.line(`// group: ${group.name}`);

                        const groupVariableName =
                            build.getGroupVariableName(group);

                        build.line(
                            `lv_group_remove_all_objs(${groupVariableName});`
                        );

                        const widgets = page.getLvglGroupWidgets(group.name);

                        widgets.forEach(widgetPath => {
                            build.line(
                                `lv_group_add_obj(${groupVariableName}, ${build.getLvglWidgetAccessorInEventHandler(
                                    widgetPath
                                )});`
                            );
                        });
                    }
                });
            }
        }
    }
}
