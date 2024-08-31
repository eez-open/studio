import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import {
    LVGLNonActivePageViewerRuntime,
    LVGLPageRuntime,
    LVGLPageViewerRuntime
} from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { KEYBOARD_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLTextareaWidget, LVGLWidget } from "./internal";
import {
    getAncestorOfType,
    propertyNotFoundMessage
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Page } from "project-editor/features/page/page";

////////////////////////////////////////////////////////////////////////////////

export class LVGLKeyboardWidget extends LVGLWidget {
    textarea: string;
    mode: keyof typeof KEYBOARD_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "textarea",
                type: PropertyType.Enum,
                enumItems: (widget: LVGLKeyboardWidget) => {
                    const page = getAncestorOfType(
                        widget,
                        ProjectEditor.PageClass.classInfo
                    ) as Page;
                    return page._lvglWidgets
                        .filter(
                            lvglWidget =>
                                lvglWidget instanceof LVGLTextareaWidget &&
                                lvglWidget.identifier
                        )
                        .map(lvglWidget => ({
                            id: lvglWidget.identifier,
                            label: lvglWidget.identifier
                        }));
                },
                propertyGridGroup: specificGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(KEYBOARD_MODES).map(id => ({
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
            width: 300,
            height: 120,
            localStyles: {
                definition: {
                    MAIN: {
                        DEFAULT: {
                            align: "DEFAULT"
                        }
                    }
                }
                // definition: {
                //     MAIN: {
                //         DEFAULT: {
                //             align: "DEFAULT",
                //             pad_top: 0,
                //             pad_bottom: 0,
                //             pad_left: 0,
                //             pad_right: 0,
                //             pad_row: 3,
                //             pad_column: 3
                //         }
                //     },
                //     ITEMS: {
                //         DEFAULT: {
                //             radius: 6
                //         }
                //     }
                // }
            },
            clickableFlag: true,
            mode: "TEXT_LOWER"
        },

        beforeLoadHook: (object: LVGLKeyboardWidget, jsObject: any) => {
            if (jsObject.mode == "USER1") {
                jsObject.mode = "USER_1";
            } else if (jsObject.mode == "USER2") {
                jsObject.mode = "USER_2";
            } else if (jsObject.mode == "USER3") {
                jsObject.mode = "USER_3";
            } else if (jsObject.mode == "USER4") {
                jsObject.mode = "USER_4";
            }
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <line x1="6" y1="10" x2="6" y2="10"></line>
                <line x1="10" y1="10" x2="10" y2="10"></line>
                <line x1="14" y1="10" x2="14" y2="10"></line>
                <line x1="18" y1="10" x2="18" y2="10"></line>
                <line x1="6" y1="14" x2="6" y2="14.01"></line>
                <line x1="18" y1="14" x2="18" y2="14.01"></line>
                <line x1="10" y1="14" x2="14" y2="14"></line>
            </svg>
        ),

        check: (widget: LVGLKeyboardWidget, messages: IMessage[]) => {
            if (widget.textarea) {
                if (
                    !ProjectEditor.getProjectStore(
                        widget
                    ).lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(widget),
                        widget.textarea
                    )
                ) {
                    messages.push(propertyNotFoundMessage(widget, "textarea"));
                }
            }
        },

        lvgl: {
            parts: ["MAIN", "ITEMS"],
            defaultFlags:
                "CLICKABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            textarea: observable,
            mode: observable
        });
    }

    getIsAccessibleFromSourceCode() {
        return true;
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateKeyboard(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            KEYBOARD_MODES[this.mode]
        );

        return obj;
    }

    override lvglPostCreate(runtime: LVGLPageRuntime) {
        if (this.textarea) {
            const lvglIdentifier = ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.textarea
            );

            if (lvglIdentifier) {
                const textareaWidget = lvglIdentifier.object;

                if (
                    textareaWidget instanceof LVGLTextareaWidget &&
                    (runtime instanceof LVGLPageViewerRuntime ||
                        runtime instanceof LVGLNonActivePageViewerRuntime)
                ) {
                    setTimeout(() => {
                        if (
                            this._lvglObj &&
                            textareaWidget._lvglObj &&
                            runtime.isMounted
                        ) {
                            runtime.wasm._lvglSetKeyboardTextarea(
                                this._lvglObj,
                                textareaWidget._lvglObj
                            );
                        }
                    });
                }
            }
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_keyboard_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild): void {
        if (this.mode != "TEXT_LOWER") {
            build.line(
                `lv_keyboard_set_mode(obj, LV_KEYBOARD_MODE_${this.mode});`
            );
        }
    }

    override lvglPostBuild(build: LVGLBuild) {
        if (this.textarea) {
            const lvglIdentifier = ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.textarea
            );
            if (lvglIdentifier != undefined) {
                const textareaWidget = lvglIdentifier.object;
                build.line(
                    `lv_keyboard_set_textarea(${build.getLvglObjectAccessor(
                        this
                    )}, ${build.getLvglObjectAccessor(textareaWidget)});`
                );
            }
        }
    }
}
