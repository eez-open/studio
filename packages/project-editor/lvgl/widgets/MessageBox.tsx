import React from "react";
import { observable, makeObservable } from "mobx";

import {
    ClassInfo,
    IMessage,
    MessageType,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLMessageBoxButtonWidget, LVGLWidget } from "./internal";
import { Message } from "project-editor/store";
import { escapeCString, unescapeCString } from "../widget-common";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLMessageBoxWidget extends LVGLWidget {
    title: string;
    titleType: LVGLPropertyType;
    titleWrapper: string;
    text: string;
    textType: LVGLPropertyType;
    textWrapper: string;

    // Built lazily so that the LVGLMessageBoxButtonWidget class reference
    // in the buttons (children) array property is resolved after all widget
    // modules are loaded (circular import through ./internal).
    static _classInfo: ClassInfo | undefined;
    static get classInfo(): ClassInfo {
        if (!this._classInfo) {
            this._classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
                enabledInComponentPalette: (projectType: ProjectType) =>
                    projectType === ProjectType.LVGL,

                componentPaletteGroupName: "!1Basic",

                properties: [
                    ...makeLvglExpressionProperty(
                        "title",
                        "string",
                        "input",
                        ["literal", "translated-literal"],
                        {
                            propertyGridGroup: specificGroup
                        }
                    ),
                    ...makeLvglExpressionProperty(
                        "text",
                        "string",
                        "input",
                        ["literal", "translated-literal"],
                        {
                            propertyGridGroup: specificGroup
                        }
                    ),
                    {
                        name: "children",
                        displayName: "Buttons",
                        type: PropertyType.Array,
                        typeClass: LVGLMessageBoxButtonWidget,
                        propertyGridGroup: specificGroup,
                        // keep the inline array editor compact; the full
                        // editor (flags, styles, ...) is available when the
                        // button is selected in the structure tree
                        elementVisibleProperties: [
                            "text",
                            "closeButton",
                            "eventHandlers"
                        ]
                    }
                ],

                defaultValue: {
                    left: 0,
                    top: 0,
                    width: 200,
                    height: 130,
                    clickableFlag: true,
                    title: "Message",
                    titleType: "literal",
                    text: "Hello world!",
                    textType: "literal",
                    children: [
                        {
                            type: "LVGLMessageBoxButtonWidget",
                            left: 0,
                            top: 0,
                            width: 80,
                            height: 40,
                            widgetFlags:
                                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_ON_FOCUS|SCROLL_WITH_ARROW|SNAPPABLE",
                            text: "Ok",
                            closeButton: false
                        }
                    ],
                    localStyles: {
                        definition: {
                            MAIN: {
                                DEFAULT: {
                                    align: "DEFAULT"
                                }
                            }
                        }
                    }
                },

                beforeLoadHook: (
                    object: LVGLMessageBoxWidget,
                    jsObject: Partial<LVGLMessageBoxWidget>
                ) => {
                    if (jsObject.titleType == undefined) {
                        jsObject.titleType = "literal";
                    }
                    if (jsObject.textType == undefined) {
                        jsObject.textType = "literal";
                    }
                },

                icon: (
                    <svg viewBox="-2 -2.5 24 24" preserveAspectRatio="xMinYMin">
                        <path
                            d="M3.656 17.979A1 1 0 0 1 2 17.243V15a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.003zm.844-3.093a.54.54 0 0 0 .26-.069l2.355-1.638A1 1 0 0 1 7.686 13H12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v5c0 .54.429.982 1 1 .41.016.707.083.844.226.128.134.135.36.156.79.003.063.003.177 0 .37a.5.5 0 0 0 .5.5m11.5-4.87a7 7 0 0 0 0 .37zc.02-.43.028-.656.156-.79.137-.143.434-.21.844-.226.571-.018 1-.46 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1H5V2a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2v2.243a1 1 0 0 1-1.656.736L16 13.743z"
                            fill="currentcolor"
                        />
                    </svg>
                ),

                check: (widget: LVGLMessageBoxWidget, messages: IMessage[]) => {
                    for (const childWidget of widget.children) {
                        if (!(childWidget instanceof LVGLMessageBoxButtonWidget)) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    `MessageBox child is not a MessageBox button widget`,
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
        }
        return this._classInfo;
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            titleWrapper: observable,
            textWrapper: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        if (code.isV9) {
            code.createObject("lv_msgbox_create");

            if (this.title) {
                code.callObjectFunction(
                    "lv_msgbox_add_title",
                    code.stringProperty(
                        this.titleType,
                        this.title,
                        this.titleWrapper
                    )
                );
            }

            if (this.text) {
                code.callObjectFunction(
                    "lv_msgbox_add_text",
                    code.stringProperty(
                        this.textType,
                        this.text,
                        this.textWrapper
                    )
                );
            }

            // buttons are created by the MessageBox button child widgets
            // (lv_msgbox_add_footer_button / lv_msgbox_add_close_button),
            // which also carry their event handlers
        } else {
            // LVGL 8.4: one-shot create with a NULL-terminated btns array
            // collected from the MessageBox button child widgets, kept
            // alive for the page lifetime (ButtonMatrix map style)
            const buttonWidgets = this.children.filter(
                childWidget =>
                    childWidget instanceof LVGLMessageBoxButtonWidget &&
                    !childWidget.closeButton
            ) as LVGLMessageBoxButtonWidget[];

            let btnsArg;
            if (buttonWidgets.length > 0) {
                if (code.lvglBuild) {
                    const build = code.lvglBuild;

                    build.blockStart(
                        `static const char *btns[${buttonWidgets.length + 1}] = {`
                    );
                    for (const buttonWidget of buttonWidgets) {
                        build.line(
                            `${escapeCString(
                                buttonWidget.text ? buttonWidget.text : " "
                            )},`
                        );
                    }
                    build.line(`NULL,`);
                    build.blockEnd(`};`);

                    btnsArg = "btns";
                } else {
                    const runtime = code.pageRuntime!;

                    const btnsArray = new Uint32Array(buttonWidgets.length + 1);
                    for (let i = 0; i < buttonWidgets.length; i++) {
                        btnsArray[i] = runtime.wasm.stringToNewUTF8(
                            unescapeCString(
                                buttonWidgets[i].text
                                    ? buttonWidgets[i].text
                                    : " "
                            )
                        );
                    }
                    btnsArray[buttonWidgets.length] = 0;

                    const btnsBuffer = runtime.wasm._malloc(
                        btnsArray.length * btnsArray.BYTES_PER_ELEMENT
                    );

                    runtime.wasm.HEAPU32.set(btnsArray, btnsBuffer >> 2);

                    runtime.addMsgboxBuffers(btnsBuffer, btnsArray);

                    btnsArg = btnsBuffer;
                }
            } else {
                btnsArg = code.constant("NULL");
            }

            const closeArg = this.children.find(
                childWidget =>
                    childWidget instanceof LVGLMessageBoxButtonWidget &&
                    childWidget.closeButton
            )
                ? code.constant("true")
                : code.constant("false");

            code.createObject(
                "lv_msgbox_create",
                this.title
                    ? code.stringProperty(
                          this.titleType,
                          this.title,
                          this.titleWrapper
                      )
                    : code.constant("NULL"),
                this.text
                    ? code.stringProperty(
                          this.textType,
                          this.text,
                          this.textWrapper
                      )
                    : code.constant("NULL"),
                btnsArg,
                closeArg
            );
        }
    }
}
