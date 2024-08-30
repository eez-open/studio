import React from "react";
import { makeObservable, observable } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    makeDerivedClassInfo,
    MessageType,
    PropertyType
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    getChildOfObject,
    Message,
    propertyNotSetMessage
} from "project-editor/store";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { escapeCString, unescapeCString } from "../widget-common";
import { IWasmFlowRuntime } from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

// prettier-ignore
export const MATRIX_BUTTON_CTRL = {
    HIDDEN       : 0x0010, /**< Button hidden*/
    NO_REPEAT    : 0x0020, /**< Do not repeat press this button.*/
    DISABLED     : 0x0040, /**< Disable this button.*/
    CHECKABLE    : 0x0080, /**< The button can be toggled.*/
    CHECKED      : 0x0100, /**< Button is currently toggled (e.g. checked).*/
    CLICK_TRIG   : 0x0200, /**< 1: Send LV_EVENT_VALUE_CHANGE on CLICK, 0: Send LV_EVENT_VALUE_CHANGE on PRESS*/
    POPOVER      : 0x0400, /**< Show a popover when pressing this key*/
    RECOLOR      : 0x0800, /**< Enable text recoloring with `#color`*/
    CUSTOM_1     : 0x4000, /**< Custom free to use flag*/
    CUSTOM_2     : 0x8000, /**< Custom free to use flag*/
};

// 8: LV_BTNMATRIX_CTRL_
// 9: LV_BUTTONMATRIX_CTRL_

class LVGLMatrixButton extends EezObject {
    newLine: boolean;

    text: string;
    width: number;

    ctrlHidden: boolean;
    ctrlNoRepeat: boolean;
    ctrlDisabled: boolean;
    ctrlCheckable: boolean;
    ctrlChecked: boolean;
    ctrlClickTrig: boolean;
    ctrlPopover: boolean;
    ctrlRecolor: boolean;
    ctrlCustom1: boolean;
    ctrlCustom2: boolean;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "newLine",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "text",
                type: PropertyType.String,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "width",
                type: PropertyType.Number,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlHidden",
                displayName: "HIDDEN",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlNoRepeat",
                displayName: "NO_REPEAT",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlDisabled",
                displayName: "DISABLED",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlCheckable",
                displayName: "CHECKABLE",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlChecked",
                displayName: "CHECKED",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlClickTrig",
                displayName: "CLICK_TRIG",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlPopover",
                displayName: "POPOVER",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlRecolor",
                displayName: "RECOLOR",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) =>
                    button.newLine ||
                    ProjectEditor.getProject(button).settings.general
                        .lvglVersion == "9.0"
            },
            {
                name: "ctrlCustom1",
                displayName: "CUSTOM_1",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            },
            {
                name: "ctrlCustom2",
                displayName: "CUSTOM_2",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (button: LVGLMatrixButton) => button.newLine
            }
        ],

        listLabel: (button: LVGLMatrixButton, collapsed: boolean) =>
            collapsed
                ? button.newLine
                    ? "New line"
                    : button.text
                    ? button.text
                    : "Text not set"
                : "",

        defaultValue: {
            text: "Btn",
            width: 1
        },

        check: (button: LVGLMatrixButton, messages: IMessage[]) => {
            if (!button.newLine) {
                if (!button.text) {
                    messages.push(propertyNotSetMessage(button, "text"));
                }

                if (button.width < 1 || button.width > 7) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `The width must be in the range of 1..7`,
                            getChildOfObject(button, "width")
                        )
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            newLine: observable,
            text: observable,
            width: observable,
            ctrlHidden: observable,
            ctrlNoRepeat: observable,
            ctrlDisabled: observable,
            ctrlCheckable: observable,
            ctrlChecked: observable,
            ctrlClickTrig: observable,
            ctrlPopover: observable,
            ctrlRecolor: observable,
            ctrlCustom1: observable,
            ctrlCustom2: observable
        });
    }
}

export class LVGLButtonMatrixWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "buttons",
                type: PropertyType.Array,
                typeClass: LVGLMatrixButton,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            {
                name: "oneCheck",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 240,
            height: 240,
            clickableFlag: true,
            buttons: [],
            oneCheck: false
        },

        icon: (
            <svg viewBox="0 0 522.753 522.752">
                <path
                    d="M151.891 58.183c0-13.072-10.595-23.677-23.677-23.677h-80.87C21.2 34.506 0 53.937 0 77.901c0 23.973 21.2 43.404 47.344 43.404h80.87c13.072 0 23.677-10.595 23.677-23.677zm185.426 0c0-13.072-10.596-23.677-23.677-23.677H209.104c-13.072 0-23.677 10.595-23.677 23.677v39.455c0 13.072 10.595 23.677 23.677 23.677H313.65c13.071 0 23.677-10.595 23.677-23.677V58.183zm138.092-23.667h-80.87c-13.071 0-23.677 10.595-23.677 23.677v39.455c0 13.072 10.596 23.677 23.677 23.677h80.87c26.145 0 47.344-19.431 47.344-43.404s-21.2-43.405-47.344-43.405M151.891 180.497c0-13.072-10.595-23.677-23.677-23.677h-80.87C21.2 156.82 0 176.251 0 200.215c0 23.973 21.2 43.395 47.344 43.395h80.87c13.072 0 23.677-10.595 23.677-23.677zm185.426 0c0-13.072-10.596-23.677-23.677-23.677H209.104c-13.072 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.595 23.677 23.677 23.677H313.65c13.071 0 23.677-10.596 23.677-23.677v-39.445zm138.092-23.667h-80.87c-13.071 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.596 23.677 23.677 23.677h80.87c26.145 0 47.344-19.421 47.344-43.395s-21.2-43.404-47.344-43.404M151.891 302.801c0-13.072-10.595-23.677-23.677-23.677h-80.87C21.2 279.125 0 298.545 0 322.51c0 23.973 21.2 43.404 47.344 43.404h80.87c13.072 0 23.677-10.596 23.677-23.678zm185.426 0c0-13.072-10.596-23.677-23.677-23.677H209.104c-13.072 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.595 23.678 23.677 23.678H313.65c13.071 0 23.677-10.596 23.677-23.678v-39.445zm138.092-23.667h-80.87c-13.071 0-23.677 10.595-23.677 23.677v39.445c0 13.072 10.596 23.676 23.677 23.676h80.87c26.145 0 47.344-19.43 47.344-43.404 0-23.973-21.2-43.394-47.344-43.394M128.214 401.438h-80.87C21.2 401.438 0 420.87 0 444.833c0 23.975 21.2 43.404 47.344 43.404h80.87c13.072 0 23.677-10.604 23.677-23.676v-39.455c0-13.072-10.605-23.668-23.677-23.668m185.436 0H209.104c-13.072 0-23.677 10.596-23.677 23.678v39.455c0 13.062 10.595 23.676 23.677 23.676H313.65c13.071 0 23.677-10.605 23.677-23.676v-39.455c-.01-13.082-10.605-23.678-23.677-23.678m161.759 0h-80.87c-13.071 0-23.677 10.596-23.677 23.678v39.455c0 13.062 10.596 23.676 23.677 23.676h80.87c26.145 0 47.344-19.432 47.344-43.404s-21.2-43.405-47.344-43.405"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "ITEMS"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        },

        overrideEventParamExpressionType: (
            widget: LVGLButtonMatrixWidget,
            eventName: string
        ) => {
            // if (eventName == "VALUE_CHANGED") {
            //     return "integer";
            // }
            return undefined;
        }
    });

    buttons: LVGLMatrixButton[];
    oneCheck: boolean;

    _mapBuffer: number;
    _mapArray: Uint32Array;
    _ctrlMapBuffer: number;
    _buffersWasm: IWasmFlowRuntime;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            buttons: observable,
            oneCheck: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const buttons = this.buttons ?? [];

        // buttons map
        const mapArray = new Uint32Array(buttons.length + 1);
        for (let i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            mapArray[i] = runtime.wasm.allocateUTF8(
                unescapeCString(
                    button.newLine ? "\n" : button.text ? button.text : " "
                )
            );
        }
        mapArray[buttons.length] = 0;

        const mapBuffer = runtime.wasm._malloc(
            mapArray.length * mapArray.BYTES_PER_ELEMENT
        );

        runtime.wasm.HEAPU32.set(mapArray, mapBuffer >> 2);

        // buttons ctrl_map
        const textButtons = buttons.filter(button => !button.newLine);
        let ctrlMapBuffer;
        if (textButtons.length > 0) {
            const ctrlMapArray = runtime.isV9
                ? new Uint32Array(textButtons.length)
                : new Uint16Array(textButtons.length);
            for (let i = 0; i < textButtons.length; i++) {
                const button = textButtons[i];

                let ctrl = button.width;
                if (ctrl < 1) {
                    ctrl = 1;
                }
                if (ctrl > 7) {
                    ctrl = 7;
                }

                if (button.ctrlHidden) {
                    ctrl |= MATRIX_BUTTON_CTRL.HIDDEN;
                }

                if (button.ctrlNoRepeat) {
                    ctrl |= MATRIX_BUTTON_CTRL.NO_REPEAT;
                }

                if (button.ctrlDisabled) {
                    ctrl |= MATRIX_BUTTON_CTRL.DISABLED;
                }

                if (button.ctrlCheckable) {
                    ctrl |= MATRIX_BUTTON_CTRL.CHECKABLE;
                }

                if (button.ctrlChecked) {
                    ctrl |= MATRIX_BUTTON_CTRL.CHECKED;
                }

                if (button.ctrlClickTrig) {
                    ctrl |= MATRIX_BUTTON_CTRL.CLICK_TRIG;
                }

                if (button.ctrlPopover) {
                    ctrl |= MATRIX_BUTTON_CTRL.POPOVER;
                }

                if (!runtime.isV9) {
                    if (button.ctrlRecolor) {
                        ctrl |= MATRIX_BUTTON_CTRL.RECOLOR;
                    }
                }

                if (button.ctrlCustom1) {
                    ctrl |= MATRIX_BUTTON_CTRL.CUSTOM_1;
                }

                if (button.ctrlCustom2) {
                    ctrl |= MATRIX_BUTTON_CTRL.CUSTOM_2;
                }

                ctrlMapArray[i] = ctrl;
            }

            ctrlMapBuffer = runtime.wasm._malloc(
                ctrlMapArray.length * ctrlMapArray.BYTES_PER_ELEMENT
            );

            if (runtime.isV9) {
                runtime.wasm.HEAPU32.set(ctrlMapArray, ctrlMapBuffer >> 2);
            } else {
                runtime.wasm.HEAPU16.set(ctrlMapArray, ctrlMapBuffer >> 1);
            }
        } else {
            ctrlMapBuffer = 0;
        }

        const obj = runtime.wasm._lvglCreateButtonMatrix(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            mapBuffer,
            ctrlMapBuffer,

            this.oneCheck
        );

        if (this._mapBuffer && this._buffersWasm == runtime.wasm) {
            this._mapArray
                .slice(0, -1)
                .forEach(value => runtime.wasm._free(value));
            runtime.wasm._free(this._mapBuffer);
            if (this._ctrlMapBuffer) {
                runtime.wasm._free(this._ctrlMapBuffer);
            }
        }

        this._mapBuffer = mapBuffer;
        this._mapArray = mapArray;
        this._ctrlMapBuffer = ctrlMapBuffer;
        this._buffersWasm = runtime.wasm;

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        if (build.isV9) {
            build.line(`lv_obj_t *obj = lv_buttonmatrix_create(parent_obj);`);
        } else {
            build.line(`lv_obj_t *obj = lv_btnmatrix_create(parent_obj);`);
        }
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        const buttons = this.buttons ?? [];

        build.line(`static const char *map[${buttons.length + 1}] = {`);
        build.indent();
        buttons.forEach(button => {
            build.line(
                `${escapeCString(
                    button.newLine ? "\n" : button.text ? button.text : " "
                )},`
            );
        });
        build.line(`NULL,`);
        build.unindent();
        build.line(`};`);

        let ctrlMap = false;
        const textButtons = buttons.filter(button => !button.newLine);
        if (
            textButtons.length > 0 &&
            textButtons.find(
                button =>
                    button.width != 1 ||
                    button.ctrlHidden ||
                    button.ctrlNoRepeat ||
                    button.ctrlDisabled ||
                    button.ctrlCheckable ||
                    button.ctrlChecked ||
                    button.ctrlClickTrig ||
                    button.ctrlPopover ||
                    (build.isV9 ? false : button.ctrlRecolor) ||
                    button.ctrlCustom1 ||
                    button.ctrlCustom2
            )
        ) {
            build.line(
                `static ${
                    build.isV9
                        ? "lv_buttonmatrix_ctrl_t "
                        : "lv_btnmatrix_ctrl_t "
                }ctrl_map[${textButtons.length}] = {`
            );
            build.indent();
            const prefix = build.isV9
                ? " | LV_BUTTONMATRIX_CTRL_"
                : " | LV_BTNMATRIX_CTRL_";
            textButtons.forEach(button => {
                build.line(
                    `${
                        button.width < 1
                            ? 1
                            : button.width > 7
                            ? 7
                            : button.width
                    }${button.ctrlHidden ? prefix + "HIDDEN" : ""}${
                        button.ctrlNoRepeat ? prefix + "NO_REPEAT" : ""
                    }${button.ctrlDisabled ? prefix + "DISABLED" : ""}${
                        button.ctrlCheckable ? prefix + "CHECKABLE" : ""
                    }${button.ctrlChecked ? prefix + "CHECKED" : ""}${
                        button.ctrlClickTrig ? prefix + "CLICK_TRIG" : ""
                    }${button.ctrlPopover ? prefix + "POPOVER" : ""}${
                        !build.isV9 && button.ctrlRecolor
                            ? prefix + "RECOLOR"
                            : ""
                    }${button.ctrlCustom1 ? prefix + "CUSTOM_1" : ""}${
                        button.ctrlCustom2 ? prefix + "CUSTOM_2" : ""
                    },`
                );
            });
            build.unindent();
            build.line(`};`);

            ctrlMap = true;
        }

        if (build.isV9) {
            build.line(`lv_buttonmatrix_set_map(obj, map);`);
            if (ctrlMap) {
                build.line(`lv_buttonmatrix_set_ctrl_map(obj, ctrl_map);`);
            }
            if (this.oneCheck) {
                build.line(`lv_buttonmatrix_set_one_checked(obj, true);`);
            }
        } else {
            build.line(`lv_btnmatrix_set_map(obj, map);`);
            if (ctrlMap) {
                build.line(`lv_btnmatrix_set_ctrl_map(obj, ctrl_map);`);
            }
            if (this.oneCheck) {
                build.line(`lv_btnmatrix_set_one_checked(obj, true);`);
            }
        }
    }
}
