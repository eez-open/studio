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

import { LVGLPageViewerRuntime } from "project-editor/lvgl/page-runtime";
import { KEYBOARD_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLTextareaWidget, LVGLWidget } from "./internal";
import {
    getChildOfObject,
    Message,
    propertyNotFoundMessage
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

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
                    let lvglIdentifiers = ProjectEditor.getProjectStore(
                        widget
                    ).lvglIdentifiers.getIdentifiersVisibleFromFlow(
                        ProjectEditor.getFlow(widget)
                    );

                    lvglIdentifiers = lvglIdentifiers.filter(lvglIdentifier => {
                        if (lvglIdentifier.widgets.length > 1) {
                            return false;
                        }

                        const widget = lvglIdentifier.widgets[0];

                        return widget instanceof LVGLTextareaWidget;
                    });

                    lvglIdentifiers.sort((a, b) =>
                        a.identifier.localeCompare(b.identifier)
                    );

                    return lvglIdentifiers.map(lvglIdentifier => ({
                        id: lvglIdentifier.identifier,
                        label: lvglIdentifier.identifier
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
                const lvglIdentifier = ProjectEditor.getProjectStore(
                    widget
                ).lvglIdentifiers.getIdentifierByName(
                    ProjectEditor.getFlow(widget),
                    widget.textarea
                );
                if (!lvglIdentifier) {
                    messages.push(propertyNotFoundMessage(widget, "textarea"));
                } else if (lvglIdentifier.widgets.length > 1) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Multiple widgets with the same name`,
                            getChildOfObject(widget, "textarea")
                        )
                    );
                } else if (
                    !(lvglIdentifier.widgets[0] instanceof LVGLTextareaWidget)
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Widget "${widget.textarea}" is not a Textarea`,
                            getChildOfObject(widget, "textarea")
                        )
                    );
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

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_keyboard_create");

        if (this.mode != "TEXT_LOWER") {
            code.callObjectFunction(
                "lv_keyboard_set_mode",
                code.constant(`LV_KEYBOARD_MODE_${this.mode}`)
            );
        }

        const textarea = this.textarea;
        if (textarea) {
            const lvglIdentifier = ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                textarea
            );
            if (
                lvglIdentifier != undefined &&
                lvglIdentifier.widgets.length == 1
            ) {
                const textareaWidget = lvglIdentifier.widgets[0];

                if (textareaWidget instanceof LVGLTextareaWidget) {
                    if (
                        code.pageRuntime &&
                        !(code.pageRuntime instanceof LVGLPageViewerRuntime)
                    ) {
                        return;
                    }

                    code.postExecute(() => {
                        let keyboardAccessor;
                        let textareaAccessor;

                        if (code.lvglBuild) {
                            const build = code.lvglBuild;

                            keyboardAccessor =
                                build.getLvglObjectAccessor(this);
                            textareaAccessor =
                                build.getLvglObjectAccessor(textareaWidget);

                            if (
                                textareaAccessor.indexOf(
                                    "startWidgetIndex +"
                                ) != -1
                            ) {
                                let index = build.getWidgetObjectIndexByName(
                                    this,
                                    textarea
                                );

                                if (
                                    keyboardAccessor.indexOf(
                                        "startWidgetIndex +"
                                    ) != -1
                                ) {
                                    textareaAccessor = `((lv_obj_t **)&objects)[startWidgetIndex + ${index}]`;
                                } else {
                                    textareaAccessor = `((lv_obj_t **)&objects)[${index}]`;
                                }
                            }
                        } else {
                            const runtime =
                                code.pageRuntime as LVGLPageViewerRuntime;

                            keyboardAccessor = code.callFreeFunction(
                                "getLvglObjectFromIndex",
                                runtime.getWidgetIndex(this)
                            );

                            textareaAccessor = code.callFreeFunction(
                                "getLvglObjectFromIndex",
                                runtime.getLvglObjectByName(
                                    textarea,
                                    runtime.userWidgetsStack
                                )
                            );
                        }

                        code.callFreeFunction(
                            "lv_keyboard_set_textarea",
                            keyboardAccessor,
                            textareaAccessor
                        );
                    });
                }
            }
        }
    }
}
