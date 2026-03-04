import React from "react";
import { observable, makeObservable } from "mobx";

import { isValid } from "eez-studio-shared/color";

import {
    ClassInfo,
    EezObject,
    IMessage,
    MessageType,
    PropertyInfo,
    PropertyType,
    makeDerivedClassInfo,
    registerClass
} from "project-editor/core/object";

import { findFont, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "project-editor/lvgl/expression-property";
import {
    BUILT_IN_FONTS,
    text_font_property_info
} from "project-editor/lvgl/style-catalog";
import { getThemedColor } from "project-editor/features/style/theme";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";
import { isFlowProperty } from "project-editor/flow/component";
import { checkExpression } from "project-editor/flow/expression";
import {
    getAncestorOfType,
    getChildOfObject,
    getClassInfo,
    Message
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { LVGLWidget } from "./internal";

////////////////////////////////////////////////////////////////////////////////

const SPAN_MODE_CODES: { [key: string]: number } = {
    FIXED: 0,
    EXPAND: 1,
    BREAK: 2
};

const SPAN_OVERFLOW_CODES: { [key: string]: number } = {
    CLIP: 0,
    ELLIPSIS: 1
};

const SPAN_ALIGN_CODES: { [key: string]: number } = {
    AUTO: 0,
    LEFT: 1,
    CENTER: 2,
    RIGHT: 3,
};

const TEXT_DECOR_CODES: { [key: string]: number } = {
    NONE: 0,
    UNDERLINE: 1,
    STRIKETHROUGH: 2
};

////////////////////////////////////////////////////////////////////////////////

export class LVGLSpan extends EezObject {
    text: string;
    textType: LVGLPropertyType;
    textColor: string;
    textFont: string;
    textDecor: keyof typeof TEXT_DECOR_CODES;
    textLetterSpace: number;
    textLineSpace: number;
    textOpa: number;

    static classInfo: ClassInfo = {
        properties: [
            ...makeLvglExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "translated-literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "textColor",
                displayName: "Text color",
                type: PropertyType.ThemedColor,
                isOptional: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "textFont",
                displayName: "Text font",
                type: PropertyType.Enum,
                enumItems: text_font_property_info.enumItems,
                isOptional: true,
                referencedObjectCollectionPath: "fonts",
                propertyGridGroup: specificGroup
            },
            {
                name: "textDecor",
                displayName: "Text decoration",
                type: PropertyType.Enum,
                enumItems: Object.keys(TEXT_DECOR_CODES).map(id => ({
                    id,
                    label: id
                })),
                isOptional: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "textLetterSpace",
                displayName: "Letter spacing",
                type: PropertyType.Number,
                isOptional: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "textLineSpace",
                displayName: "Line spacing",
                type: PropertyType.Number,
                isOptional: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "textOpa",
                displayName: "Text opacity",
                type: PropertyType.Number,
                isOptional: true,
                propertyGridGroup: specificGroup
            }
        ],

        listLabel: (span: LVGLSpan, collapsed: boolean) => {
            if (span.text && span.textType == "literal") {
                return `Span: ${span.text}`;
            }
            return "Span";
        },

        defaultValue: {
            text: "Span",
            textType: "literal"
        },

        check: (span: LVGLSpan, messages: IMessage[]) => {
            if (span.textType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        span,
                        LVGLWidget.classInfo
                    )!;
                    checkExpression(widget, span.text);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(span, "text")
                        )
                    );
                }
            }

            if (span.textColor) {
                const colorValue = getThemedColor(
                    ProjectEditor.getProjectStore(span),
                    span.textColor
                ).colorValue;

                if (!isValid(colorValue)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid color`,
                            getChildOfObject(span, "textColor")
                        )
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            textType: observable,
            textColor: observable,
            textFont: observable,
            textDecor: observable,
            textLetterSpace: observable,
            textLineSpace: observable,
            textOpa: observable
        });
    }

    toLVGLCode(code: LVGLCode, spanIndex: number) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        // Create span
        let newSpanFunc: string;
        if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
            newSpanFunc = "lv_spangroup_new_span";
        } else {
            newSpanFunc = "lv_spangroup_add_span";
        }

        const spanVar = code.callObjectFunctionWithAssignmentToStateVar(
            this.objID,
            "lv_span_t *",
            `span_${spanIndex}`,
            newSpanFunc
        );

        // Set text
        if (this.textType == "literal" && code.lvglBuild) {
            code.callFreeFunction(
                "lv_span_set_text_static",
                spanVar,
                code.stringProperty(this.textType, this.text)
            );
        } else if (
            this.textType == "literal" ||
            this.textType == "translated-literal"
        ) {
            code.callFreeFunction(
                "lv_span_set_text",
                spanVar,
                code.stringProperty(this.textType, this.text)
            );
        }

        // Apply styles
        const hasStyle =
            this.textColor ||
            this.textFont ||
            (this.textDecor && this.textDecor != "NONE") ||
            this.textLetterSpace != undefined ||
            this.textLineSpace != undefined ||
            this.textOpa != undefined;

        if (hasStyle) {
            let stylePtr: any;

            if (code.isLVGLVersion(["8.4.0"])) {
                if (code.lvglBuild) {
                    stylePtr = `&(${spanVar}->style)`
                } else {
                    stylePtr = code.callFreeFunctionWithAssignment(
                        "lv_style_t *",
                        `span_${spanIndex}_style`,
                        "lvglSpanGetStyle",
                        spanVar
                    );
                }
            } else  {
                stylePtr = code.callFreeFunctionWithAssignment(
                    "lv_style_t *",
                    `span_${spanIndex}_style`,
                    "lv_span_get_style",
                    spanVar
                );
            }

            // textColor
            if (this.textColor) {
                code.buildColor(
                    widget,
                    this.textColor,
                    () => stylePtr,
                    (color) => {
                        code.callFreeFunction(
                            "lv_style_set_text_color",
                            stylePtr,
                            code.color(color)
                        );
                    },
                    (color, stylePtr) => {
                        code.callFreeFunction(
                            "lv_style_set_text_color",
                            stylePtr,
                            code.color(color)
                        );
                    }
                );
            }

            // textFont
            if (this.textFont) {
                const fontIndex = BUILT_IN_FONTS.indexOf(this.textFont);
                if (code.lvglBuild) {
                    if (fontIndex != -1) {
                        code.callFreeFunction(
                            "lv_style_set_text_font",
                            stylePtr,
                            `&lv_font_${this.textFont.toLowerCase()}`
                        );
                    } else {
                        const font = findFont(
                            ProjectEditor.getProject(this),
                            this.textFont
                        );
                        if (font) {
                            code.callFreeFunction(
                                "lv_style_set_text_font",
                                stylePtr,
                                code.lvglBuild!.getFontAccessor(font)
                            );
                        }
                    }
                } else if (code.pageRuntime) {
                    const pageRuntime = code.pageRuntime;
                    const fontPtr = pageRuntime.getFontPtrByName(this.textFont);
                    if (fontPtr) {
                        code.callFreeFunction(
                            "lv_style_set_text_font",
                            stylePtr,
                            fontPtr
                        );
                    }
                }
            }

            // textDecor
            if (this.textDecor && this.textDecor != "NONE") {
                code.callFreeFunction(
                    "lv_style_set_text_decor",
                    stylePtr,
                    code.constant(`LV_TEXT_DECOR_${this.textDecor}`)
                );
            }

            // textLetterSpace
            if (this.textLetterSpace != undefined) {
                code.callFreeFunction(
                    "lv_style_set_text_letter_space",
                    stylePtr,
                    this.textLetterSpace
                );
            }

            // textLineSpace
            if (this.textLineSpace != undefined) {
                code.callFreeFunction(
                    "lv_style_set_text_line_space",
                    stylePtr,
                    this.textLineSpace
                );
            }

            // textOpa
            if (this.textOpa != undefined) {
                code.callFreeFunction(
                    "lv_style_set_text_opa",
                    stylePtr,
                    this.textOpa
                );
            }
        }

        // Expression-based text: add to tick for dynamic updates
        if (this.textType == "expression") {
            code.addToTick(`spans[${spanIndex}].text`, () => {
                const new_val = code.evalTextProperty(
                    "const char *",
                    "new_val",
                    this.text,
                    `Failed to evaluate Text in Span widget span[${spanIndex}]`
                );

                code.callFreeFunction("lv_span_set_text", spanVar, new_val);

                // Refresh spangroup after text change
                if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
                    code.callObjectFunction("lv_spangroup_refr_mode");
                } else {
                    code.callObjectFunction("lv_spangroup_refresh");
                }
            });
        }
    }
}

registerClass("LVGLSpan", LVGLSpan);

////////////////////////////////////////////////////////////////////////////////

export class LVGLSpanWidget extends LVGLWidget {
    mode: keyof typeof SPAN_MODE_CODES;
    overflow: keyof typeof SPAN_OVERFLOW_CODES;
    indent: number;
    maxLines: number;
    align: keyof typeof SPAN_ALIGN_CODES;
    spans: LVGLSpan[];

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: (widget: LVGLSpanWidget) => "Spangroup",
        componentPaletteLabel: "Spangroup",

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(SPAN_MODE_CODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup,
                disabled: (widget: LVGLSpanWidget) => {
                    const lvglVersion = ProjectEditor.getProject(widget).settings.general.lvglVersion;
                    return lvglVersion != "8.4.0" && lvglVersion != "9.2.2";
                }
            },
            {
                name: "overflow",
                type: PropertyType.Enum,
                enumItems: Object.keys(SPAN_OVERFLOW_CODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "indent",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "maxLines",
                displayName: "Max lines",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "align",
                type: PropertyType.Enum,
                enumItems: Object.keys(SPAN_ALIGN_CODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup,
                disabled: (widget: LVGLSpanWidget) => {
                    const lvglVersion = ProjectEditor.getProject(widget).settings.general.lvglVersion;
                    return lvglVersion != "8.4.0" && lvglVersion != "9.2.2";
                }
            },
            {
                name: "spans",
                type: PropertyType.Array,
                typeClass: LVGLSpan,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],

        beforeLoadHook: (
            object: LVGLSpanWidget,
            jsObject: Partial<LVGLSpanWidget>
        ) => {
            if (jsObject.mode == undefined) {
                jsObject.mode = "FIXED";
            }
            if (jsObject.overflow == undefined) {
                jsObject.overflow = "CLIP";
            }
            if (jsObject.indent == undefined) {
                jsObject.indent = 0;
            }
            if (jsObject.maxLines == undefined) {
                jsObject.maxLines = -1;
            }
            if (jsObject.align == undefined) {
                jsObject.align = "AUTO";
            }
            if (jsObject.spans == undefined) {
                jsObject.spans = [];
            }
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            widthUnit: "content",
            heightUnit: "content",
            clickableFlag: true,
            mode: "FIXED",
            overflow: "CLIP",
            indent: 0,
            maxLines: -1,
            align: "AUTO",
            spans: [Object.assign({}, LVGLSpan.classInfo.defaultValue)]
        },

        icon: (
            <svg viewBox="0 0 56 56">
                <path
                    d="M2.963 21.923c1.162 0 1.846-.684 1.846-1.869v-5.402c0-2.37 1.254-3.578 3.533-3.578H47.68c2.257 0 3.533 1.208 3.533 3.578v5.402c0 1.185.684 1.869 1.846 1.869 1.185 0 1.823-.684 1.823-1.869V14.47c0-4.695-2.37-7.066-7.157-7.066H8.296c-4.763 0-7.156 2.348-7.156 7.066v5.584c0 1.185.66 1.869 1.823 1.869m25.003 16.342c1.185 0 1.846-.798 1.846-2.051v-14.77h5.652c.89 0 1.527-.592 1.527-1.504 0-.934-.638-1.481-1.527-1.481H20.558c-.866 0-1.527.547-1.527 1.481 0 .912.661 1.504 1.527 1.504h5.607v14.77c0 1.208.638 2.05 1.8 2.05M2.963 30.766c1.641 0 2.963-1.344 2.963-2.985 0-1.619-1.322-2.94-2.963-2.94C1.345 24.84 0 26.161 0 27.78c0 1.64 1.345 2.985 2.963 2.985m50.097 0c1.618 0 2.94-1.344 2.94-2.985a2.947 2.947 0 0 0-2.94-2.94c-1.664 0-2.963 1.299-2.963 2.94 0 1.64 1.3 2.985 2.963 2.985m-44.764 18.6h39.43c4.787 0 7.157-2.37 7.157-7.066v-6.724c0-1.185-.661-1.846-1.823-1.846-1.185 0-1.846.661-1.846 1.846v6.542c0 2.37-1.276 3.578-3.533 3.578H8.341c-2.278 0-3.532-1.208-3.532-3.578v-6.542c0-1.185-.684-1.846-1.846-1.846s-1.823.661-1.823 1.846V42.3c0 4.718 2.393 7.066 7.156 7.066"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        },

        getAdditionalFlowProperties: (widget: LVGLSpanWidget) => {
            const properties: PropertyInfo[] = [];

            for (
                let spanIndex = 0;
                spanIndex < widget.spans.length;
                spanIndex++
            ) {
                const span = widget.spans[spanIndex];
                const classInfo = getClassInfo(span);
                const flowProperties = classInfo.properties.filter(
                    propertyInfo =>
                        isFlowProperty(span, propertyInfo, [
                            "input",
                            "template-literal",
                            "assignable"
                        ])
                );
                flowProperties.forEach(flowProperty =>
                    properties.push(
                        Object.assign({}, flowProperty, {
                            name: `spans[${spanIndex}].${flowProperty.name}`
                        })
                    )
                );
            }

            return properties;
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            mode: observable,
            overflow: observable,
            indent: observable,
            maxLines: observable,
            align: observable,
            spans: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_spangroup_create");

        // mode
        if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
            if (this.mode != "FIXED") {
                code.callObjectFunction(
                    "lv_spangroup_set_mode",
                    code.constant(`LV_SPAN_MODE_${this.mode}`)
                );
            }
        }

        // overflow
        if (this.overflow != "CLIP") {
            code.callObjectFunction(
                "lv_spangroup_set_overflow",
                code.constant(`LV_SPAN_OVERFLOW_${this.overflow}`)
            );
        }

        // indent
        if (this.indent != 0) {
            code.callObjectFunction("lv_spangroup_set_indent", this.indent);
        }

        // align
        if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
            if (this.align != "AUTO") {
                code.callObjectFunction(
                    "lv_spangroup_set_align",
                    code.constant(`LV_TEXT_ALIGN_${this.align}`)
                );
            }
        }

        // maxLines
        if (this.maxLines != -1) {
            if (code.isLVGLVersion(["8.4.0"])) {
                code.callObjectFunction(
                    "lv_spangroup_set_lines",
                    this.maxLines
                );
            } else {
                code.callObjectFunction(
                    "lv_spangroup_set_max_lines",
                    this.maxLines
                );
            }
        }

        // spans
        if (this.spans) {
            for (
                let spanIndex = 0;
                spanIndex < this.spans.length;
                spanIndex++
            ) {
                code.blockStart("{");
                this.spans[spanIndex].toLVGLCode(code, spanIndex);
                code.blockEnd("}");
            }

            // Refresh after adding all spans
            if (this.spans.length > 0) {
                if (code.isLVGLVersion(["8.4.0", "9.2.2"])) {
                    code.callObjectFunction("lv_spangroup_refr_mode");
                } else {
                    code.callObjectFunction("lv_spangroup_refresh");
                }
            }
        }
    }
}
