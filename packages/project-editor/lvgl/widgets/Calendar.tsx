import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget } from "./internal";
import { getChildOfObject, Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

const CALENDAR_HEADER_TYPES = {
    None: 0,
    Arrow: 1,
    Dropdown: 2
};

export class LVGLCalendarWidget extends LVGLWidget {
    todayYear: number;
    todayMonth: number;
    todayDay: number;
    header: keyof typeof CALENDAR_HEADER_TYPES;
    chineseMode: boolean;
    monthNames: string;
    monthNamesTranslate: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
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
            },
            {
                name: "header",
                type: PropertyType.Enum,
                enumItems: Object.keys(CALENDAR_HEADER_TYPES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "chineseMode",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup,
                disabled: (widget: LVGLCalendarWidget) => {
                    const lvglVersion =
                        ProjectEditor.getProject(widget).settings.general
                            .lvglVersion;
                    return lvglVersion == "8.4.0";
                }
            },
            {
                name: "monthNames",
                displayName: "Month names",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLCalendarWidget) =>
                    widget.header != "Arrow"
            },
            {
                name: "monthNamesTranslate",
                displayName: "Translate month names",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLCalendarWidget) =>
                    widget.header != "Arrow"
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
            todayDay: 1,
            header: "Arrow",
            chineseMode: false,
            monthNames: "",
            monthNamesTranslate: false
        },

        beforeLoadHook: (object: LVGLCalendarWidget, jsObject: any) => {
            if (jsObject.header == undefined) {
                jsObject.header = "Arrow";
            }
            if (jsObject.chineseMode == undefined) {
                jsObject.chineseMode = false;
            }
            if (jsObject.monthNames == undefined) {
                jsObject.monthNames = "";
            }
            if (jsObject.monthNamesTranslate == undefined) {
                jsObject.monthNamesTranslate = false;
            }
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

            if (widget.monthNames.trim() != "") {
                const names = widget.monthNames
                    .split("\n")
                    .map(name => name.trim());
                if (names.length != 12 || names.some(name => name == "")) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Month names must contain exactly 12 non-empty lines, one per month`,
                            getChildOfObject(widget, "monthNames")
                        )
                    );
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
            todayDay: observable,
            header: observable,
            chineseMode: observable,
            monthNames: observable,
            monthNamesTranslate: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_calendar_create");

        if (this.header === "Arrow") {
            if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
                code.callObjectFunction(
                    "lv_calendar_header_arrow_create"
                );
            } else {
                code.callObjectFunction(
                    "lv_calendar_add_header_arrow"
                );
            }
        } else if (this.header === "Dropdown") {
            if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
                code.callObjectFunction(
                    "lv_calendar_header_dropdown_create"
                );
            } else {
                code.callObjectFunction(
                    "lv_calendar_add_header_dropdown"
                );
            }
        }

        code.callObjectFunction(
            "lv_calendar_set_today_date",
            this.todayYear,
            this.todayMonth,
            this.todayDay
        );

        if (code.isLVGLVersion(["8.", "9.2"])) {
            code.callObjectFunction(
                "lv_calendar_set_showed_date",
                this.todayYear,
                this.todayMonth
            );
        } else {
            code.callObjectFunction(
                "lv_calendar_set_month_shown",
                this.todayYear,
                this.todayMonth
            );
        }

        if (this.chineseMode && code.isLVGLVersion(["9."])) {
            code.callObjectFunction(
                "lv_calendar_set_chinese_mode",
                code.constant("true")
            );
        }

        if (
            this.header === "Arrow" &&
            !code.isLVGLVersion(["8.4.0", "9.2.2"]) &&
            this.monthNames.trim() != ""
        ) {
            this.buildMonthNamesOverride(code);
        }
    }

    // LVGL's Arrow header (lv_calendar_add_header_arrow) keeps the displayed
    // "<year> <month name>" text fully to itself: it recomputes and
    // overwrites that label's text, using its own hardcoded English month
    // names, every time the shown month changes (on arrow click, and
    // whenever lv_calendar_set_month_shown() is called for any reason).
    // There is no public LVGL API to customize those names.
    //
    // To let this be customized/translated anyway, we add our own tick
    // handler that runs after LVGL's own logic on every frame and
    // overwrites the label again, this time with our own names. It reads
    // the currently shown month directly from the calendar (as a plain
    // integer), rather than trying to hook into LVGL's own update path, so
    // it works no matter what triggered the change.
    buildMonthNamesOverride(code: LVGLCode) {
        const names = this.monthNames
            .split("\n")
            .map(name => name.trim())
            .filter(name => name != "");

        // Defensive: check() requires exactly 12, but don't ever generate
        // code that reads out of bounds if that's somehow not the case.
        while (names.length < 12) {
            names.push(names[names.length - 1] ?? "");
        }
        names.length = 12;

        // For the C build, the (possibly translated) literals are plain
        // source text emitted once, so it's safe to resolve them here, up
        // front, and reuse the same 12 values on every tick.
        const nameValues = code.lvglBuild
            ? names.map(name =>
                  code.stringProperty(
                      this.monthNamesTranslate
                          ? "translated-literal"
                          : "literal",
                      name
                  )
              )
            : undefined;

        code.addToTickAlways(() => {
            const dateVar = code.callFreeFunctionWithAssignment(
                "const lv_calendar_date_t *",
                "date",
                "lv_calendar_get_showed_date",
                code.objectAccessor
            );

            const headerVar = code.callFreeFunctionWithAssignment(
                "lv_obj_t *",
                "header",
                "lv_obj_get_child",
                code.objectAccessor,
                0
            );

            const labelVar = code.callFreeFunctionWithAssignment(
                "lv_obj_t *",
                "label",
                "lv_obj_get_child",
                headerVar,
                1
            );

            if (code.lvglBuild) {
                const setLabel = (nameValue: any) => {
                    code.callFreeFunction(
                        "lv_label_set_text_fmt",
                        labelVar,
                        `"%d %s"`,
                        `${dateVar}->year`,
                        nameValue
                    );
                };

                const buildChain = (month: number) => {
                    if (month == 12) {
                        setLabel(nameValues![11]);
                        return;
                    }
                    code.if(
                        `${dateVar}->month == ${month}`,
                        () => setLabel(nameValues![month - 1]),
                        () => buildChain(month + 1)
                    );
                };

                buildChain(1);
            } else {
                // The editor's live preview doesn't simulate the
                // translation hook for any widget, so just use the literal
                // text here regardless of monthNamesTranslate (matching how
                // other translated-literal properties behave in preview).
                // Calling a variadic C function (lv_label_set_text_fmt)
                // through the WASM export ABI isn't supported either, so
                // format the text in JS and set it as a plain string. The
                // formatted string is a short-lived allocation, freed right
                // after use, unlike `names` which are never copied into
                // Wasm memory at all.
                const wasm = code.pageRuntime!.wasm as any;
                const year = wasm.HEAPU16[dateVar >> 1];
                const month = wasm.HEAPU8[dateVar + 2];
                const name = names[Math.min(Math.max(month, 1), 12) - 1];

                const textPtr = wasm.stringToNewUTF8(`${year} ${name}`);
                code.callFreeFunction("lv_label_set_text", labelVar, textPtr);
                wasm._free(textPtr);
            }
        });
    }
}
