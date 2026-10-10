import React from "react";
import { makeObservable, observable } from "mobx";
import {
    ClassInfo,
    EezObject,
    getParent,
    IMessage,
    MessageType,
    PropertyInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    getAncestorOfType,
    getChildOfObject,
    Message,
    propertyNotSetMessage
} from "project-editor/store";
import type { Component } from "project-editor/flow/component";
import { checkExpression } from "project-editor/flow/expression";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "./expression-property";
import { LV_BUTTONMATRIX_CTRL } from "./lvgl-constants";
import { escapeCString, unescapeCString } from "./widget-common";

export class LVGLMatrixButton extends EezObject {
    newLine: boolean;

    text: string;
    textType: LVGLPropertyType;
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
            ...makeLvglExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "expression"],
                {
                    hideInPropertyGrid: (button: LVGLMatrixButton) =>
                        button.newLine
                }
            ),
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
                    ProjectEditor.getProject(
                        button
                    ).settings.general.lvglVersion.startsWith("9.")
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

        listLabel: (button: LVGLMatrixButton, collapsed: boolean) => {
            if (button.newLine) {
                if (collapsed) {
                    return "New line";
                } else {
                    return "";
                }
            }

            let buttonId = 0;

            const buttons = getParent(button) as LVGLMatrixButton[];
            for (const otherButton of buttons) {
                if (otherButton == button) {
                    break;
                }
                if (!otherButton.newLine) {
                    buttonId++;
                }
            }

            if (collapsed) {
                return (
                    <>
                        <span style={{ fontWeight: "bold", marginRight: 10 }}>
                            #{buttonId}
                        </span>
                        <span>{button.text}</span>
                    </>
                );
            }

            return <span style={{ fontWeight: "bold" }}>#{buttonId}</span>;
        },

        beforeLoadHook: (
            _button: LVGLMatrixButton,
            jsButton: Partial<LVGLMatrixButton>
        ) => {
            if (jsButton.textType == undefined) jsButton.textType = "literal";
        },

        defaultValue: {
            text: "Btn",
            textType: "literal",
            width: 1
        },

        check: (button: LVGLMatrixButton, messages: IMessage[]) => {
            if (!button.newLine) {
                if (!button.text) {
                    messages.push(propertyNotSetMessage(button, "text"));
                }

                if (button.textType == "expression") {
                    const component = getAncestorOfType<Component>(
                        button,
                        ProjectEditor.ComponentClass.classInfo
                    )!;
                    try {
                        checkExpression(component, button.text);
                    } catch (err) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid expression: ${err}`,
                                getChildOfObject(button, "text")
                            )
                        );
                    }
                } else if (
                    unescapeCString(button.text || "").includes("\0") ||
                    unescapeCString(button.text || "") == "\n"
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "Use New line for row boundaries; button text must not contain a NUL character",
                            getChildOfObject(button, "text")
                        )
                    );
                }

                if (
                    !Number.isInteger(button.width) ||
                    button.width < 1 ||
                    button.width > 7
                ) {
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
            textType: observable,
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

registerClass("LVGLMatrixButton", LVGLMatrixButton);

// The widget and Set Map action use the exact same array editor and child model.
export const buttonMatrixButtonsProperty: PropertyInfo = {
    name: "buttons",
    type: PropertyType.Array,
    typeClass: LVGLMatrixButton,
    propertyGridGroup: specificGroup,
    partOfNavigation: false,
    enumerable: false,
    defaultValue: [],
    showArrayCollapsedByDefaultInPropertyGrid: true,
    hideElementIndexInPropertyGrid: true
};

export function getButtonMatrixControl(
    button: LVGLMatrixButton,
    isV9: boolean
) {
    let ctrl = Math.max(1, Math.min(7, button.width || 1));
    const flags = [
        [button.ctrlHidden, LV_BUTTONMATRIX_CTRL.HIDDEN],
        [button.ctrlNoRepeat, LV_BUTTONMATRIX_CTRL.NO_REPEAT],
        [button.ctrlDisabled, LV_BUTTONMATRIX_CTRL.DISABLED],
        [button.ctrlCheckable, LV_BUTTONMATRIX_CTRL.CHECKABLE],
        [button.ctrlChecked, LV_BUTTONMATRIX_CTRL.CHECKED],
        [button.ctrlClickTrig, LV_BUTTONMATRIX_CTRL.CLICK_TRIG],
        [button.ctrlPopover, LV_BUTTONMATRIX_CTRL.POPOVER],
        [!isV9 && button.ctrlRecolor, LV_BUTTONMATRIX_CTRL.RECOLOR],
        [button.ctrlCustom1, LV_BUTTONMATRIX_CTRL.CUSTOM_1],
        [button.ctrlCustom2, LV_BUTTONMATRIX_CTRL.CUSTOM_2]
    ];
    for (const [enabled, flag] of flags) {
        if (enabled) ctrl |= flag as number;
    }
    return ctrl;
}

export function getButtonMatrixTextExpression(button: LVGLMatrixButton) {
    if (button.newLine) return escapeCString("\n");
    if (button.textType == "expression") return button.text;
    return escapeCString(unescapeCString(button.text || " "));
}
