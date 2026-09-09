import React from "react";
import { makeObservable, observable } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    MessageType,
    PropertyType,
    getParent,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget } from "./internal";
import { EventHandler } from "project-editor/flow/component";
import { lvglSymbols } from "project-editor/flow/expression/operations";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import { getChildOfObject, Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLListEntry extends EezObject {
    entryType: string;
    text: string;
    textType: LVGLPropertyType;
    icon: string;
    iconType: string;
    symbol: string;
    iconExpression: string;
    iconExpressionType: LVGLPropertyType;
    eventHandlers: EventHandler[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "entryType",
                displayName: "Entry type",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "button", label: "Button" },
                    { id: "text", label: "Text" }
                ],
                enumDisallowUndefined: true,
                defaultValue: "button",
                formText:
                    "Text entries are added with lv_list_add_text (section headers), button entries with lv_list_add_button."
            },
            {
                name: "text",
                type: PropertyType.String
            },
            {
                name: "iconType",
                displayName: "Icon type",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "none", label: "None" },
                    { id: "bitmap", label: "Bitmap" },
                    { id: "symbol", label: "Symbol" },
                    { id: "expression", label: "Expression" }
                ],
                enumDisallowUndefined: true,
                defaultValue: "none",
                formText:
                    "Symbol uses a built-in LVGL font glyph (LV_SYMBOL_*). Expression is resolved at runtime, e.g. LVGL.LV_SYMBOL_AUDIO when EEZ Flow is enabled.",
                hideInPropertyGrid: (entry: LVGLListEntry) =>
                    (entry.entryType ?? "button") == "text"
            },
            {
                name: "icon",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                isOptional: true,
                hideInPropertyGrid: (entry: LVGLListEntry) =>
                    (entry.iconType ?? (entry.icon ? "bitmap" : "none")) !=
                    "bitmap"
            },
            {
                name: "symbol",
                type: PropertyType.Enum,
                enumItems: lvglSymbols.map(symbol => ({
                    id: symbol.id
                })),
                isOptional: true,
                hideInPropertyGrid: (entry: LVGLListEntry) =>
                    (entry.iconType ?? (entry.icon ? "bitmap" : "none")) !=
                    "symbol"
            },
            ...makeLvglExpressionProperty(
                "iconExpression",
                "string",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Icon expression",
                    hideInPropertyGrid: (entry: LVGLListEntry) =>
                        (entry.iconType ?? (entry.icon ? "bitmap" : "none")) !=
                    "expression"
                }
            ),
            {
                name: "eventHandlers",
                type: PropertyType.Array,
                typeClass: EventHandler,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                formText:
                    "Event handlers invoked on this button (flow handlers are not supported on List entries yet).",
                hideInPropertyGrid: (entry: LVGLListEntry) =>
                    (entry.entryType ?? "button") == "text"
            }
        ],

        listLabel: (entry: LVGLListEntry, collapsed: boolean) => {
            const entryIndex = (getParent(entry) as LVGLListEntry[]).indexOf(
                entry
            );

            if (collapsed) {
                return (
                    <>
                        <span style={{ fontWeight: "bold", marginRight: 10 }}>
                            #{entryIndex}
                        </span>
                        <span>
                            {(entry.entryType ?? "button") == "text"
                                ? "T "
                                : ""}
                            {entry.text ?? ""}
                        </span>
                    </>
                );
            }

            return <span style={{ fontWeight: "bold" }}>#{entryIndex}</span>;
        },

        defaultValue: {
            entryType: "button",
            text: "Item",
            textType: "literal",
            iconType: "none"
        },

        check: (entry: LVGLListEntry, messages: IMessage[]) => {
            if (!entry.text) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Text is empty`,
                        getChildOfObject(entry, "text")
                    )
                );
            }

            const iconType =
                entry.iconType ?? (entry.icon ? "bitmap" : "none");

            if (iconType == "bitmap" && !entry.icon) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Icon is not set`,
                        getChildOfObject(entry, "icon")
                    )
                );
            }

            if (iconType == "symbol" && !entry.symbol) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Symbol is not set`,
                        getChildOfObject(entry, "symbol")
                    )
                );
            }

            if (iconType == "expression" && !entry.iconExpression) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Icon expression is not set`,
                        getChildOfObject(entry, "iconExpression")
                    )
                );
            }

            for (const eventHandler of entry.eventHandlers ?? []) {
                if (eventHandler.handlerType == "flow") {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Flow event handlers are not supported on List entries yet`,
                            eventHandler
                        )
                    );
                } else if (!eventHandler.action) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Action is not set`,
                            eventHandler
                        )
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            entryType: observable,
            text: observable,
            textType: observable,
            icon: observable,
            iconType: observable,
            symbol: observable,
            iconExpression: observable,
            iconExpressionType: observable,
            eventHandlers: observable
        });
    }
}

export class LVGLListWidget extends LVGLWidget {
    entries: LVGLListEntry[];

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "entries",
                type: PropertyType.Array,
                typeClass: LVGLListEntry,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: [],
                showArrayCollapsedByDefaultInPropertyGrid: true,
                hideElementIndexInPropertyGrid: true
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            clickableFlag: true,
            entries: [
                Object.assign({}, LVGLListEntry.classInfo.defaultValue, {
                    text: "Item 1"
                }),
                Object.assign({}, LVGLListEntry.classInfo.defaultValue, {
                    text: "Item 2"
                })
            ]
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M4 7a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h9a1 1 0 1 1 0 2h-9a1 1 0 0 1-1-1zm-5 5a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h9a1 1 0 1 1 0 2h-9a1 1 0 0 1-1-1zm-5 5a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h9a1 1 0 1 1 0 2h-9a1 1 0 0 1-1-1z"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SCROLLBAR"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            entries: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_list_create");

        const addEntryFunctionName = code.isV9
            ? "lv_list_add_button"
            : "lv_list_add_btn";

        (this.entries ?? []).forEach((entry, entryIndex) => {
            if (!entry.text) {
                return;
            }

            const textArg = code.stringProperty(
                entry.textType ?? "literal",
                entry.text
            );

            if ((entry.entryType ?? "button") == "text") {
                code.callObjectFunction("lv_list_add_text", textArg);
                return;
            }

            const iconType =
                entry.iconType ?? (entry.icon ? "bitmap" : "none");

            let iconArg;
            if (iconType == "bitmap") {
                iconArg = entry.icon
                    ? code.image(entry.icon)
                    : code.constant("NULL");
            } else if (iconType == "symbol") {
                if (code.lvglBuild) {
                    iconArg = `LV_SYMBOL_${entry.symbol}`;
                } else {
                    const symbolValue = lvglSymbols.find(
                        symbol => symbol.id == entry.symbol
                    )?.value;
                    iconArg = code.stringLiteral(symbolValue ?? "");
                }
            } else if (iconType == "expression") {
                iconArg = code.stringProperty(
                    entry.iconExpressionType ?? "literal",
                    entry.iconExpression ?? ""
                );
            } else {
                iconArg = code.constant("NULL");
            }

            const buildEventHandlers = (entry.eventHandlers ?? []).filter(
                eventHandler =>
                    eventHandler.handlerType != "flow" &&
                    eventHandler.action &&
                    code.lvglBuild
            );

            if (buildEventHandlers.length > 0) {
                const buttonObj = code.callObjectFunctionWithAssignment(
                    "lv_obj_t *",
                    `btn${entryIndex}`,
                    addEntryFunctionName,
                    iconArg,
                    textArg
                );

                for (const eventHandler of buildEventHandlers) {
                    code.callFreeFunction(
                        "lv_obj_add_event_cb",
                        buttonObj,
                        `action_${eventHandler.action}`,
                        code.constant(`LV_EVENT_${eventHandler.eventName}`),
                        "(void *)0"
                    );
                }
            } else {
                code.callObjectFunction(addEntryFunctionName, iconArg, textArg);
            }
        });
    }
}
