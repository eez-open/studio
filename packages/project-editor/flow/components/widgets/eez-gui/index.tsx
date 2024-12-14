import React from "react";
import { observable, makeObservable, computed } from "mobx";

import QRC from "../qrcodegen";

import { remap } from "eez-studio-shared/util";
import { roundNumber } from "eez-studio-shared/roundNumber";
import { to16bitsColor } from "eez-studio-shared/color";

import {
    IEezObject,
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    getParent,
    MessageType,
    EezObject,
    ClassInfo,
    RectObject,
    IMessage,
    PropertyProps
} from "project-editor/core/object";
import {
    ProjectStore,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    getChildOfObject,
    propertySetButNotUsedMessage,
    getProjectStore
} from "project-editor/store";
import {
    isProjectWithFlowSupport,
    isNotV1Project,
    isNotProjectWithFlowSupport,
    isV3OrNewerProject,
    hasNotFlowSupport,
    hasFlowSupport
} from "project-editor/project/project-type-traits";

import {
    getProject,
    Project,
    ProjectType,
    findPage,
    findVariable,
    checkObjectReference,
    findBitmap
} from "project-editor/project/project";

import type {
    IDataContext,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import {
    ComponentEnclosure,
    ComponentCanvas
} from "project-editor/flow/editor/render";

import { Style } from "project-editor/features/style/style";
import {
    DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME,
    ValueType
} from "project-editor/features/variable/value-type";
import * as draw from "project-editor/flow/editor/eez-gui-draw";
import { Font } from "project-editor/features/font/font";

import {
    Widget,
    makeDataPropertyInfo,
    makeStylePropertyInfo,
    makeTextPropertyInfo,
    migrateStyleProperty,
    makeExpressionProperty
} from "project-editor/flow/component";

import { Assets, DataBuffer } from "project-editor/build/assets";
import {
    WIDGET_TYPE_DISPLAY_DATA,
    WIDGET_TYPE_MULTILINE_TEXT,
    WIDGET_TYPE_TOGGLE_BUTTON,
    WIDGET_TYPE_BAR_GRAPH,
    WIDGET_TYPE_YT_GRAPH,
    WIDGET_TYPE_UP_DOWN,
    WIDGET_TYPE_LIST_GRAPH,
    WIDGET_TYPE_APP_VIEW,
    WIDGET_TYPE_SCROLL_BAR,
    WIDGET_TYPE_CANVAS,
    WIDGET_TYPE_GAUGE,
    WIDGET_TYPE_INPUT,
    WIDGET_TYPE_ROLLER,
    WIDGET_TYPE_SWITCH,
    WIDGET_TYPE_SLIDER,
    WIDGET_TYPE_LINE_CHART,
    WIDGET_TYPE_BUTTON_GROUP,
    WIDGET_TYPE_QR_CODE,
    WIDGET_TYPE_DROP_DOWN_LIST,
    WIDGET_TYPE_PROGRESS,
    WIDGET_TYPE_BUTTON,
    WIDGET_TYPE_TEXT,
    WIDGET_TYPE_RECTANGLE,
    WIDGET_TYPE_BITMAP
} from "project-editor/flow/components/component-types";
import {
    buildExpression,
    checkExpression,
    evalConstantExpression
} from "project-editor/flow/expression";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    generalGroup,
    indentationGroup,
    specificGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import {
    getBooleanValue,
    evalProperty,
    buildWidgetText,
    getTextValue,
    getNumberValue,
    getAnyValue
} from "project-editor/flow/helper";
import {
    GAUGE_ICON,
    LINE_CHART_ICON,
    SWITCH_WIDGET_ICON
} from "project-editor/ui-components/icons";
import { getComponentName } from "project-editor/flow/components/components-registry";
import classNames from "classnames";
import { observer } from "mobx-react";
import { Button } from "eez-studio-ui/button";

import type * as FileTypeModule from "instrument/connection/file-type";

const BAR_GRAPH_ORIENTATION_LEFT_RIGHT = 1;
const BAR_GRAPH_ORIENTATION_RIGHT_LEFT = 2;
const BAR_GRAPH_ORIENTATION_TOP_BOTTOM = 3;
const BAR_GRAPH_ORIENTATION_BOTTOM_TOP = 4;
const BAR_GRAPH_DO_NOT_DISPLAY_VALUE = 1 << 4;

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

enum DisplayOption {
    All = 0,
    Integer = 1,
    FractionAndUnit = 2,
    Fraction = 3,
    Unit = 4,
    IntegerAndFraction = 5
}

export class DisplayDataWidget extends Widget {
    focusStyle: Style;
    displayOption: DisplayOption;
    refreshRate: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_DISPLAY_DATA,

        properties: [
            makeDataPropertyInfo("data", {}, "any"),
            makeStylePropertyInfo("style", "Default style"),
            Object.assign(
                makeStylePropertyInfo("focusStyle", "Focused style"),
                { hideInPropertyGrid: isNotV1Project },
                {
                    isOptional: true
                }
            ),
            {
                name: "displayOption",
                type: PropertyType.Enum,
                enumItems: (widget: DisplayDataWidget) =>
                    hasFlowSupport(widget)
                        ? [
                              {
                                  id: DisplayOption.All,
                                  label: "All"
                              },
                              {
                                  id: DisplayOption.Integer,
                                  label: "Integer"
                              },
                              {
                                  id: DisplayOption.Fraction,
                                  label: "Fraction"
                              }
                          ]
                        : [
                              {
                                  id: DisplayOption.All,
                                  label: "All"
                              },
                              {
                                  id: DisplayOption.Integer,
                                  label: "Integer"
                              },
                              {
                                  id: DisplayOption.FractionAndUnit,
                                  label: "Fraction and unit"
                              },
                              {
                                  id: DisplayOption.Fraction,
                                  label: "Fraction"
                              },
                              {
                                  id: DisplayOption.Unit,
                                  label: "Unit"
                              },
                              {
                                  id: DisplayOption.IntegerAndFraction,
                                  label: "Integer and fraction"
                              }
                          ],
                propertyGridGroup: specificGroup
            },
            makeDataPropertyInfo("refreshRate", {
                disabled: hasNotFlowSupport
            })
        ],

        beforeLoadHook: (
            object: IEezObject,
            jsObject: any,
            project: Project
        ) => {
            migrateStyleProperty(jsObject, "focusStyle");
            if (jsObject.refreshRate == undefined) {
                if (project.projectTypeTraits.hasFlowSupport) {
                    jsObject.refreshRate = "0";
                }
            }
        },

        defaultValue: {
            data: "data",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            displayOption: 0,
            refreshRate: "0"
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
                <path d="M5 4C2.5 9 2.5 14 5 20M19 4c2.5 5 2.5 10 0 16M9 9h1c1 0 1 1 2.016 3.527C13 15 13 16 14 16h1" />
                <path d="M8 16c1.5 0 3-2 4-3.5S14.5 9 16 9" />
            </svg>
        ),

        check: (object: DisplayDataWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (object.displayOption === undefined) {
                if (
                    getProject(object).settings.general.projectVersion !== "v1"
                ) {
                    messages.push(
                        propertyNotSetMessage(object, "displayOption")
                    );
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            focusStyle: observable,
            displayOption: observable,
            refreshRate: observable
        });
    }

    applyDisplayOption(text: string) {
        text = text.toString();

        function findStartOfFraction() {
            let i;
            for (
                i = 0;
                text[i] &&
                (text[i] == "<" ||
                    text[i] == " " ||
                    text[i] == "-" ||
                    (text[i] >= "0" && text[i] <= "9"));
                i++
            ) {}
            return i;
        }

        function findStartOfUnit(i: number) {
            for (
                i = 0;
                text[i] &&
                (text[i] == "<" ||
                    text[i] == " " ||
                    text[i] == "-" ||
                    (text[i] >= "0" && text[i] <= "9") ||
                    text[i] == ".");
                i++
            ) {}
            return i;
        }

        if (this.displayOption === DisplayOption.Integer) {
            let i = findStartOfFraction();
            text = text.substr(0, i);
        } else if (this.displayOption === DisplayOption.FractionAndUnit) {
            let i = findStartOfFraction();
            text = text.substr(i);
        } else if (this.displayOption === DisplayOption.Fraction) {
            let i = findStartOfFraction();
            let k = findStartOfUnit(i);
            if (i < k) {
                text = text.substring(i, k);
            } else {
                text = ".00";
            }
        } else if (this.displayOption === DisplayOption.Unit) {
            let i = findStartOfUnit(0);
            text = text.substr(i);
        } else if (this.displayOption === DisplayOption.IntegerAndFraction) {
            let i = findStartOfUnit(0);
            text = text.substr(0, i);
        }

        if (typeof text === "string") {
            text = text.trim();
        }

        return text;
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const result = getTextValue(
            flowContext,
            this,
            "data",
            undefined,
            undefined
        );

        let text = this.applyDisplayOption(
            typeof result == "object" ? result.text : result
        );

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawText(
                            ctx,
                            text,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        if (isV3OrNewerProject(this)) {
            // refreshRate
            dataBuffer.writeInt16(
                assets.projectStore.projectTypeTraits.hasFlowSupport
                    ? assets.getWidgetDataItemIndex(this, "refreshRate")
                    : 0
            );
        }

        // displayOption
        dataBuffer.writeUint8(this.displayOption || 0);
    }
}

registerClass("DisplayDataWidget", DisplayDataWidget);

////////////////////////////////////////////////////////////////////////////////

export class TextWidget extends Widget {
    name: string;
    text?: string;
    ignoreLuminocity: boolean;
    focusStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_TEXT,

        label: (widget: TextWidget) => {
            let name = getComponentName(widget.type);

            const project = ProjectEditor.getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (widget.text) {
                    return `${name}: ${widget.text}`;
                }
            }

            if (widget.name) {
                return `${name}: ${widget.name}`;
            }

            if (widget.data) {
                return `${name}: ${widget.data}`;
            }

            return name;
        },

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            makeDataPropertyInfo("data", {
                displayName: (widget: TextWidget) => {
                    const project = ProjectEditor.getProject(widget);
                    if (project.projectTypeTraits.hasFlowSupport) {
                        return "Text";
                    }
                    return "Data";
                }
            }),
            makeTextPropertyInfo("text", {
                displayName: "Static text",
                disabled: isProjectWithFlowSupport
            }),
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                defaultValue: false,
                propertyGridGroup: specificGroup,
                disabled: isV3OrNewerProject
            },
            makeStylePropertyInfo("style", "Default style"),
            Object.assign(
                makeStylePropertyInfo("focusStyle", "Focused style"),
                { enabled: isNotV1Project },
                {
                    isOptional: true
                }
            )
        ],

        beforeLoadHook: (widget: Widget, jsObject: any, project: Project) => {
            if (jsObject.text) {
                if (project.projectTypeTraits.hasFlowSupport) {
                    if (!jsObject.data) {
                        jsObject.data = `"${jsObject.text}"`;
                    }
                    delete jsObject.text;
                }
            }

            migrateStyleProperty(jsObject, "focusStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
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
                <circle cx="17.5" cy="15.5" r="3.5" />
                <path d="M3 19V8.5a3.5 3.5 0 0 1 7 0V19m-7-6h7m11-1v7" />
            </svg>
        ),

        check: (widget: TextWidget, messages: IMessage[]) => {
            const project = ProjectEditor.getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (!widget.text && !widget.data) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            } else {
                if (!widget.data) {
                    messages.push(propertyNotSetMessage(widget, "data"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            text: observable,
            ignoreLuminocity: observable,
            focusStyle: observable
        });
    }

    getClassName(flowContext: IFlowContext) {
        return classNames("eez-widget", this.type);
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        super.styleHook(style, flowContext);

        if (this.style.alignHorizontalProperty == "left") {
            style.textAlign = "left";
        } else if (this.style.alignHorizontalProperty == "center") {
            style.textAlign = "center";
        } else if (this.style.alignHorizontalProperty == "right") {
            style.textAlign = "right";
        }
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const result = getTextValue(
            flowContext,
            this,
            "data",
            this.name,
            this.text
        );
        let text: string;
        if (typeof result == "object") {
            text = result.text;
        } else {
            text = result;
        }

        const style: React.CSSProperties = {};
        this.styleHook(style, flowContext);

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawText(
                            ctx,
                            text,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // text
        buildWidgetText(assets, dataBuffer, this.text);

        // flags
        let flags: number = 0;

        // ignoreLuminocity
        if (this.ignoreLuminocity) {
            flags |= 1 << 0;
        }

        dataBuffer.writeInt8(flags);
    }
}

registerClass("TextWidget", TextWidget);

////////////////////////////////////////////////////////////////////////////////

enum MultilineTextRenderStep {
    MEASURE,
    RENDER
}

class MultilineTextRender {
    constructor(
        private ctx: CanvasRenderingContext2D,
        private text: string,
        private x1: number,
        private y1: number,
        private x2: number,
        private y2: number,
        private style: Style,
        private firstLineIndent: number,
        private hangingIndent: number
    ) {}

    private font: Font;

    private spaceWidth: number;

    private lineHeight: number;
    private textHeight: number;

    private line: string;
    private lineIndent: number;
    private lineWidth: number;

    flushLine(y: number, step: MultilineTextRenderStep) {
        if (this.line != "" && this.lineWidth > 0) {
            if (step == MultilineTextRenderStep.RENDER) {
                let x;

                if (draw.styleIsHorzAlignLeft(this.style)) {
                    x = this.x1;
                } else if (draw.styleIsHorzAlignRight(this.style)) {
                    x = this.x2 + 1 - this.lineWidth;
                } else {
                    x =
                        this.x1 +
                        Math.floor(
                            (this.x2 - this.x1 + 1 - this.lineWidth) / 2
                        );
                }

                draw.setBackColor(this.style.backgroundColorProperty);
                draw.setColor(this.style.colorProperty);

                draw.drawStr(
                    this.ctx,
                    this.line,
                    x + this.lineIndent,
                    y,
                    x + this.lineWidth - 1,
                    y + this.font.height - 1,
                    this.font
                );
            } else {
                this.textHeight = Math.max(
                    this.textHeight,
                    y + this.lineHeight - this.y1
                );
            }

            this.line = "";
            this.lineWidth = this.lineIndent = this.hangingIndent;
        }
    }

    executeStep(step: MultilineTextRenderStep) {
        this.textHeight = 0;

        let y = this.y1;

        this.line = "";
        this.lineWidth = this.lineIndent = this.firstLineIndent;

        let i = 0;

        while (true) {
            let word = "";
            while (
                i < this.text.length &&
                this.text[i] != " " &&
                this.text[i] != "\n"
            ) {
                word += this.text[i++];
            }

            let width = draw.measureStr(word, this.font, 0);

            while (
                this.lineWidth +
                    (this.line != "" ? this.spaceWidth : 0) +
                    width >
                this.x2 - this.x1 + 1
            ) {
                this.flushLine(y, step);

                y += this.lineHeight;
                if (y + this.lineHeight - 1 > this.y2) {
                    break;
                }
            }

            if (y + this.lineHeight - 1 > this.y2) {
                break;
            }

            if (this.line != "") {
                this.line += " ";
                this.lineWidth += this.spaceWidth;
            }
            this.line += word;
            this.lineWidth += width;

            while (this.text[i] == " ") {
                i++;
            }

            if (i == this.text.length || this.text[i] == "\n") {
                this.flushLine(y, step);

                y += this.lineHeight;

                if (i == this.text.length) {
                    break;
                }

                i++;

                let extraHeightBetweenParagraphs = Math.floor(
                    0.2 * this.lineHeight
                );

                y += extraHeightBetweenParagraphs;

                if (y + this.lineHeight - 1 > this.y2) {
                    break;
                }
            }
        }

        this.flushLine(y, step);

        return this.textHeight + this.font.height - this.lineHeight;
    }

    render() {
        let x1 = this.x1;
        let y1 = this.y1;
        let x2 = this.x2;
        let y2 = this.y2;
        ({ x1, y1, x2, y2 } = draw.drawBackground(
            this.ctx,
            x1,
            y1,
            x2,
            y2,
            this.style,
            true
        ));

        const font = draw.styleGetFont(this.style);
        if (!font) {
            return;
        }

        let lineHeight = Math.floor(0.9 * font.height);
        if (lineHeight <= 0) {
            return;
        }

        try {
            this.text = JSON.parse('"' + this.text + '"');
        } catch (e) {}

        this.font = font;
        this.lineHeight = lineHeight;

        this.x1 += this.style.paddingRect.left;
        this.x2 -= this.style.paddingRect.right;
        this.y1 += this.style.paddingRect.top;
        this.y2 -= this.style.paddingRect.bottom;

        const spaceGlyph = font.glyphs.find(glyph => glyph.encoding == 32);
        this.spaceWidth = (spaceGlyph && spaceGlyph.dx) || 0;

        const textHeight = this.executeStep(MultilineTextRenderStep.MEASURE);

        if (draw.styleIsVertAlignTop(this.style)) {
        } else if (draw.styleIsVertAlignBottom(this.style)) {
            this.y1 = this.y2 + 1 - textHeight;
        } else {
            this.y1 += Math.floor((this.y2 - this.y1 + 1 - textHeight) / 2);
        }
        this.y2 = this.y1 + textHeight - 1;

        this.executeStep(MultilineTextRenderStep.RENDER);
    }
}

export class MultilineTextWidget extends Widget {
    name: string;
    text?: string;
    firstLineIndent: number;
    hangingIndent: number;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_MULTILINE_TEXT,

        label: (widget: MultilineTextWidget) => {
            let name = getComponentName(widget.type);

            const project = ProjectEditor.getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (widget.text) {
                    return `${name}: ${widget.text}`;
                }
            }

            if (widget.name) {
                return `${name}: ${widget.name}`;
            }

            if (widget.data) {
                return `${name}: ${widget.data}`;
            }

            return name;
        },

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            makeDataPropertyInfo("data", {
                displayName: (widget: MultilineTextWidget) => {
                    const project = ProjectEditor.getProject(widget);
                    if (project.projectTypeTraits.hasFlowSupport) {
                        return "Text";
                    }
                    return "Data";
                }
            }),
            makeTextPropertyInfo("text", {
                displayName: "Static text",
                disabled: isProjectWithFlowSupport
            }),
            {
                name: "firstLineIndent",
                displayName: "First line",
                type: PropertyType.Number,
                propertyGridGroup: indentationGroup
            },
            {
                name: "hangingIndent",
                displayName: "Hanging",
                type: PropertyType.Number,
                propertyGridGroup: indentationGroup
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        beforeLoadHook: (widget: Widget, jsObject: any, project: Project) => {
            if (jsObject.text) {
                if (project.projectTypeTraits.hasFlowSupport) {
                    if (!jsObject.data) {
                        jsObject.data = `"${jsObject.text}"`;
                    }
                    delete jsObject.text;
                }
            }
        },

        defaultValue: {
            text: "Multiline text",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            firstLineIndent: 0,
            hangingIndent: 0
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
                <path d="M4 6h16M4 12h16M4 18h12" />
            </svg>
        ),

        check: (widget: MultilineTextWidget, messages: IMessage[]) => {
            const project = ProjectEditor.getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (!widget.text && !widget.data) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            } else {
                if (!widget.data) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            text: observable,
            firstLineIndent: observable,
            hangingIndent: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const result = getTextValue(
            flowContext,
            this,
            "data",
            this.name,
            this.text
        );

        let text = typeof result == "object" ? result.text : result;

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        var multilineTextRender = new MultilineTextRender(
                            ctx,
                            text,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            this.firstLineIndent || 0,
                            this.hangingIndent || 0
                        );
                        multilineTextRender.render();
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // text
        buildWidgetText(assets, dataBuffer, this.text);

        // first line
        dataBuffer.writeInt16(this.firstLineIndent || 0);

        // hanging
        dataBuffer.writeInt16(this.hangingIndent || 0);
    }
}

registerClass("MultilineTextWidget", MultilineTextWidget);

////////////////////////////////////////////////////////////////////////////////

export class RectangleWidget extends Widget {
    ignoreLuminocity: boolean;
    invertColors: boolean;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_RECTANGLE,

        properties: [
            {
                name: "invertColors",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                defaultValue: false,
                disabled: isV3OrNewerProject
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                defaultValue: false,
                disabled: isV3OrNewerProject
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="3" y="5" width="18" height="14" rx="2"></rect>
            </svg>
        ),

        check: (object: RectangleWidget, messages: IMessage[]) => {
            if (object.data) {
                messages.push(propertySetButNotUsedMessage(object, "data"));
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            ignoreLuminocity: observable,
            invertColors: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const invertColors = isV3OrNewerProject(this)
            ? true
            : this.invertColors;

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            invertColors
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // flags
        let flags: number = 0;

        // invertColors
        if (isV3OrNewerProject(this) || this.invertColors) {
            flags |= 1 << 0;
        }

        // ignoreLuminocity
        if (this.ignoreLuminocity) {
            flags |= 1 << 1;
        }

        dataBuffer.writeUint8(flags);
    }
}

registerClass("RectangleWidget", RectangleWidget);

////////////////////////////////////////////////////////////////////////////////

const BitmapWidgetPropertyGridUI = observer(
    class BitmapWidgetPropertyGridUI extends React.Component<PropertyProps> {
        get bitmapWidget() {
            return this.props.objects[0] as BitmapWidget;
        }

        resizeToFitBitmap = () => {
            getProjectStore(this.props.objects[0]).updateObject(
                this.props.objects[0],
                {
                    width: this.bitmapWidget.bitmapObject!.imageElement!.width,
                    height: this.bitmapWidget.bitmapObject!.imageElement!.height
                }
            );
        };

        render() {
            if (this.props.readOnly) {
                return null;
            }

            if (this.props.objects.length > 1) {
                return null;
            }

            const bitmapObject = this.bitmapWidget.bitmapObject;
            if (!bitmapObject) {
                return null;
            }

            const imageElement = bitmapObject.imageElement;
            if (!imageElement) {
                return null;
            }

            const widget = this.props.objects[0] as Widget;

            if (
                widget.width == imageElement.width &&
                widget.height == imageElement.height
            ) {
                return null;
            }

            return (
                <Button
                    color="primary"
                    size="small"
                    onClick={this.resizeToFitBitmap}
                >
                    Resize to Fit Bitmap
                </Button>
            );
        }
    }
);

export class BitmapWidget extends Widget {
    bitmap?: string;

    constructor() {
        super();

        makeObservable(this, {
            bitmapObject: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            bitmap: observable
        });
    }

    get label() {
        return this.bitmap ? `${this.type}: ${this.bitmap}` : this.type;
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_BITMAP,

        properties: [
            makeDataPropertyInfo("data", {}, "integer"),
            {
                name: "bitmap",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridRowComponent: BitmapWidgetPropertyGridUI
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
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
                <path d="M15 8h.01" />
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="m4 15 4-4a3 5 0 0 1 3 0l5 5" />
                <path d="m14 14 1-1a3 5 0 0 1 3 0l2 2" />
            </svg>
        ),

        check: (object: BitmapWidget, messages: IMessage[]) => {
            if (!object.data && !object.bitmap) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        "Either Bitmap or Data must be set",
                        object
                    )
                );
            } else {
                if (object.data && object.bitmap) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "Both Bitmap and Data set, only Data is used",
                            object
                        )
                    );
                }

                if (object.bitmap) {
                    let bitmap = findBitmap(getProject(object), object.bitmap);
                    if (!bitmap) {
                        messages.push(
                            propertyNotFoundMessage(object, "bitmap")
                        );
                    }
                }
            }
        }
    });

    get bitmapObject() {
        return this.getBitmapObject(getProjectStore(this).dataContext);
    }

    getBitmapObject(dataContext: IDataContext) {
        return this.bitmap
            ? findBitmap(getProject(this), this.bitmap)
            : this.data
            ? findBitmap(getProject(this), dataContext.get(this.data) as string)
            : undefined;
    }

    getBitmap(flowContext: IFlowContext) {
        if (this.bitmap) {
            return findBitmap(getProject(this), this.bitmap);
        }

        if (this.data) {
            let data;

            if (flowContext.flowState) {
                data = evalProperty(flowContext, this, "data");
            } else {
                data = flowContext.dataContext.get(this.data);
            }

            if (typeof data === "string") {
                if (data.startsWith("data:image/png;base64,")) {
                    return data;
                }

                const bitmap = findBitmap(getProject(this), data as string);
                if (bitmap) {
                    return bitmap;
                }

                return undefined;
            }

            if (data instanceof Uint8Array) {
                const { detectFileType } =
                    require("instrument/connection/file-type") as typeof FileTypeModule;
                const fileType = detectFileType(data);
                return URL.createObjectURL(
                    new Blob([data], { type: fileType.mime } /* (1) */)
                );
            }

            return data;
        }

        return undefined;
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const bitmap = this.getBitmap(flowContext);

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        const w = width;
                        const h = height;
                        const style = this.style;

                        if (bitmap) {
                            const imageElement = bitmap.imageElement;
                            if (!imageElement) {
                                return;
                            }

                            let x1 = 0;
                            let y1 = 0;
                            let x2 = w - 1;
                            let y2 = h - 1;

                            let width = imageElement.width;
                            let height = imageElement.height;

                            let x_offset: number;
                            if (draw.styleIsHorzAlignLeft(style)) {
                                x_offset = x1 + style.paddingRect.left;
                            } else if (draw.styleIsHorzAlignRight(style)) {
                                x_offset = x2 - style.paddingRect.right - width;
                            } else {
                                x_offset = Math.floor(
                                    x1 + (x2 - x1 + 1 - width) / 2
                                );
                            }
                            if (x_offset < x1) {
                                x_offset = x1;
                            }

                            let y_offset: number;
                            if (draw.styleIsVertAlignTop(style)) {
                                y_offset = y1 + style.paddingRect.top;
                            } else if (draw.styleIsVertAlignBottom(style)) {
                                y_offset =
                                    y2 - style.paddingRect.bottom - height;
                            } else {
                                y_offset = Math.floor(
                                    y1 + (y2 - y1 + 1 - height) / 2
                                );
                            }
                            if (y_offset < y1) {
                                y_offset = y1;
                            }

                            if (bitmap.backgroundColor !== "transparent") {
                                ctx.fillStyle = bitmap.backgroundColor;
                                ctx.fillRect(x_offset, y_offset, width, height);
                            } else {
                                ctx.clearRect(0, 0, width, height);
                            }

                            draw.drawBitmap(
                                ctx,
                                imageElement,
                                x_offset,
                                y_offset,
                                width,
                                height
                            );
                        }
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // bitmap
        let bitmap: number = 0;
        if (this.bitmap) {
            bitmap = assets.getBitmapIndex(this, "bitmap");
        }

        dataBuffer.writeInt16(bitmap);
    }
}

registerClass("BitmapWidget", BitmapWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonWidget extends Widget {
    text?: string;
    enabled?: string;
    disabledStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_BUTTON,

        properties: [
            makeDataPropertyInfo("data", {
                displayName: (widget: ButtonWidget) => {
                    const project = ProjectEditor.getProject(widget);
                    if (project.projectTypeTraits.hasFlowSupport) {
                        return "Label";
                    }
                    return "Data";
                }
            }),
            makeTextPropertyInfo("text", {
                disabled: isProjectWithFlowSupport
            }),
            makeDataPropertyInfo("enabled"),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("disabledStyle")
        ],

        beforeLoadHook: (
            widget: IEezObject,
            jsObject: any,
            project: Project
        ) => {
            if (jsObject.text) {
                if (project.projectTypeTraits.hasFlowSupport) {
                    if (!jsObject.data) {
                        jsObject.data = `"${jsObject.text}"`;
                    }
                    delete jsObject.text;
                }
            }

            migrateStyleProperty(jsObject, "disabledStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 40,
            data: `"Button"`,
            eventHandlers: [
                {
                    eventName: "CLICKED",
                    handlerType: "flow"
                }
            ]
        },

        componentDefaultValue: (projectStore: ProjectStore) => {
            return projectStore.projectTypeTraits.isFirmwareModule ||
                projectStore.projectTypeTraits.isApplet ||
                projectStore.projectTypeTraits.isResource
                ? {
                      style: {
                          useStyle: "button_M"
                      },
                      disabledStyle: {
                          useStyle: "button_M_disabled"
                      }
                  }
                : projectStore.projectTypeTraits.isFirmware
                ? {
                      style: {
                          useStyle: "button"
                      },
                      disabledStyle: {
                          useStyle: "button_disabled"
                      }
                  }
                : {};
        },

        icon: (
            <svg viewBox="0 0 16 16">
                <path
                    fill="currentColor"
                    d="m15.7 5.3-1-1c-.2-.2-.4-.3-.7-.3H1c-.6 0-1 .4-1 1v5c0 .3.1.6.3.7l1 1c.2.2.4.3.7.3h13c.6 0 1-.4 1-1V6c0-.3-.1-.5-.3-.7zM14 10H1V5h13v5z"
                />
            </svg>
        ),

        check: (widget: ButtonWidget, messages: IMessage[]) => {
            const project = ProjectEditor.getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (
                    !widget.text &&
                    !widget.data &&
                    !widget.isInputProperty("data")
                ) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }

                checkObjectReference(widget, "enabled", messages, true);
            } else {
                if (!widget.data) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            enabled: observable,
            disabledStyle: observable
        });
    }

    getClassName(flowContext: IFlowContext) {
        return classNames("eez-widget", this.type);
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const result = getTextValue(
            flowContext,
            this,
            "data",
            undefined,
            this.text
        );
        let text: string;
        if (typeof result == "object") {
            text = result.text;
        } else {
            text = result;
        }

        let buttonEnabled = getBooleanValue(
            flowContext,
            this,
            "enabled",
            flowContext.flowState ? !this.enabled : true
        );

        let buttonStyle = buttonEnabled ? this.style : this.disabledStyle;

        const style: React.CSSProperties = {};
        this.styleHook(style, flowContext);

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawText(
                            ctx,
                            text,
                            0,
                            0,
                            width,
                            height,
                            buttonStyle,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // text
        buildWidgetText(assets, dataBuffer, this.text);

        // enabled
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "enabled"));

        // disabledStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "disabledStyle"));
    }
}

registerClass("ButtonWidget", ButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ToggleButtonWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_TOGGLE_BUTTON,

        properties: [
            makeDataPropertyInfo("data", {}, "boolean"),
            {
                name: "text1",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "text2",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("checkedStyle")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 32,
            height: 32
        },

        icon: (
            <svg fill="none" viewBox="0 0 24 24">
                <path
                    d="M15 9c-.5523 0-1 .4477-1 1v4c0 .5523.4477 1 1 1h4c.5523 0 1-.4477 1-1v-4c0-.5523-.4477-1-1-1h-4Z"
                    fill="currentColor"
                />
                <path
                    clipRule="evenodd"
                    d="M0 7c0-1.1046.8954-2 2-2h20c1.1046 0 2 .8954 2 2v10c0 1.1046-.8954 2-2 2H2c-1.1046 0-2-.8954-2-2V7Zm2 0h20v10H2V7Z"
                    fill="currentColor"
                    fillRule="evenodd"
                />
            </svg>
        ),

        check: (object: ToggleButtonWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (!object.text1) {
                messages.push(propertyNotSetMessage(object, "text1"));
            }

            if (!object.text2) {
                messages.push(propertyNotSetMessage(object, "text2"));
            }
        }
    });

    text1?: string;
    text2?: string;
    checkedStyle: Style;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text1: observable,
            text2: observable,
            checkedStyle: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawText(
                            ctx,
                            this.text1 || "",
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // text 1
        buildWidgetText(assets, dataBuffer, this.text1);

        // text 2
        buildWidgetText(assets, dataBuffer, this.text2);

        // checkedStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "checkedStyle"));
    }
}

registerClass("ToggleButtonWidget", ToggleButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonGroupWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_BUTTON_GROUP,

        properties: [
            makeDataPropertyInfo("data", {
                displayName: (widget: ButtonGroupWidget) => {
                    const project = ProjectEditor.getProject(widget);
                    if (
                        project.projectTypeTraits.hasFlowSupport &&
                        project.settings.general.projectVersion == "v3"
                    ) {
                        return "Button labels";
                    }
                    return "Data";
                }
            }),
            makeDataPropertyInfo("selectedButton", {
                disabled: (widget: ButtonGroupWidget) => {
                    const project = ProjectEditor.getProject(widget);
                    return !(
                        project.projectTypeTraits.hasFlowSupport &&
                        project.settings.general.projectVersion == "v3"
                    );
                }
            }),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("selectedStyle")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "selectedStyle");
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="7" y="3" width="14" height="14" rx="2"></rect>
                <path d="M17 17v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path>
            </svg>
        ),

        check: (object: ButtonGroupWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }
        }
    });

    selectedStyle: Style;
    selectedButton: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            selectedStyle: observable,
            selectedButton: observable
        });
    }

    getButtonLabels(flowContext: IFlowContext): string[] {
        if (
            flowContext.projectStore.project.projectTypeTraits.hasFlowSupport &&
            flowContext.projectStore.project.settings.general.projectVersion ==
                "v3"
        ) {
            const buttonLabels = getAnyValue(flowContext, this, "data", []);
            if (isArray(buttonLabels)) {
                return buttonLabels.map(label => label.toString());
            }
            return [];
        }

        return (
            (this.data && flowContext.dataContext.getValueList(this.data)) || []
        );
    }

    getSelectedButton(flowContext: IFlowContext): number {
        if (
            flowContext.projectStore.project.projectTypeTraits.hasFlowSupport &&
            flowContext.projectStore.project.settings.general.projectVersion ==
                "v3"
        ) {
            return 0;
        }

        return (this.data && flowContext.dataContext.get(this.data)) || 0;
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let buttonLabels = this.getButtonLabels(flowContext);
                        let selectedButton =
                            this.getSelectedButton(flowContext);

                        let x = 0;
                        let y = 0;
                        let w = width;
                        let h = height;

                        if (w > h) {
                            // horizontal orientation
                            let buttonWidth = Math.floor(
                                w / buttonLabels.length
                            );
                            let buttonHeight = h;
                            for (let i = 0; i < buttonLabels.length; i++) {
                                if (i < buttonLabels.length - 1) {
                                    draw.drawText(
                                        ctx,
                                        buttonLabels[i],
                                        x,
                                        y,
                                        buttonWidth,
                                        buttonHeight,
                                        i == selectedButton
                                            ? this.selectedStyle
                                            : this.style,
                                        false
                                    );
                                    x += buttonWidth;
                                } else {
                                    draw.drawText(
                                        ctx,
                                        buttonLabels[i],
                                        x,
                                        y,
                                        width - x,
                                        buttonHeight,
                                        i == selectedButton
                                            ? this.selectedStyle
                                            : this.style,
                                        false
                                    );
                                }
                            }
                        } else {
                            // vertical orientation
                            let buttonWidth = w;
                            let buttonHeight = Math.floor(
                                h / buttonLabels.length
                            );

                            y += Math.floor(
                                (h - buttonHeight * buttonLabels.length) / 2
                            );

                            let labelHeight = Math.min(
                                buttonWidth,
                                buttonHeight
                            );
                            let yOffset = Math.floor(
                                (buttonHeight - labelHeight) / 2
                            );

                            y += yOffset;

                            for (let i = 0; i < buttonLabels.length; i++) {
                                if (i == selectedButton) {
                                    draw.drawText(
                                        ctx,
                                        buttonLabels[i],
                                        x,
                                        y,
                                        buttonWidth,
                                        labelHeight,
                                        this.selectedStyle,
                                        false
                                    );
                                } else {
                                    draw.drawText(
                                        ctx,
                                        buttonLabels[i],
                                        x,
                                        y,
                                        buttonWidth,
                                        labelHeight,
                                        this.style,
                                        false
                                    );
                                }
                                y += buttonHeight;
                            }
                        }
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // selectedStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "selectedStyle"));

        // selectedButton
        let selectedButton =
            assets.projectStore.project.projectTypeTraits.hasFlowSupport &&
            assets.projectStore.project.settings.general.projectVersion == "v3"
                ? assets.getWidgetDataItemIndex(this, "selectedButton")
                : 0;
        dataBuffer.writeInt16(selectedButton);
    }
}

registerClass("ButtonGroupWidget", ButtonGroupWidget);

////////////////////////////////////////////////////////////////////////////////

export class BarGraphWidget extends Widget {
    orientation?: string;
    displayValue: boolean;
    textStyle: Style;
    line1Data?: string;
    line1Style: Style;
    line2Data?: string;
    line2Style: Style;
    min: string;
    max: string;
    refreshRate: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_BAR_GRAPH,

        properties: [
            {
                name: "orientation",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "left-right"
                    },
                    {
                        id: "right-left"
                    },
                    {
                        id: "top-bottom"
                    },
                    {
                        id: "bottom-top"
                    }
                ]
            },
            {
                name: "displayValue",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            makeDataPropertyInfo("data"),
            makeDataPropertyInfo("line1Data", { displayName: "Threshold1" }),
            makeDataPropertyInfo("line2Data", { displayName: "Threshold2" }),
            makeDataPropertyInfo("min", {
                disabled: hasNotFlowSupport
            }),
            makeDataPropertyInfo("max", {
                disabled: hasNotFlowSupport
            }),
            makeDataPropertyInfo("refreshRate", {
                disabled: hasNotFlowSupport
            }),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("textStyle"),
            makeStylePropertyInfo("line1Style", "Threshold1 style"),
            makeStylePropertyInfo("line2Style", "Threshold2 style")
        ],

        beforeLoadHook: (
            object: IEezObject,
            jsObject: any,
            project: Project
        ) => {
            migrateStyleProperty(jsObject, "textStyle");
            migrateStyleProperty(jsObject, "line1Style");
            migrateStyleProperty(jsObject, "line2Style");

            if (jsObject.refreshRate == undefined) {
                if (project.projectTypeTraits.hasFlowSupport) {
                    jsObject.refreshRate = "0";
                }
            }
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            refreshRate: "0",
            orientation: "left-right"
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="3" y="12" width="6" height="8" rx="1"></rect>
                <rect x="9" y="8" width="6" height="12" rx="1"></rect>
                <rect x="15" y="4" width="6" height="16" rx="1"></rect>
                <line x1="4" y1="20" x2="18" y2="20"></line>
            </svg>
        ),

        check: (object: BarGraphWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (hasFlowSupport(object)) {
                if (!object.min) {
                    messages.push(propertyNotSetMessage(object, "min"));
                }

                if (!object.max) {
                    messages.push(propertyNotSetMessage(object, "max"));
                }

                if (!object.refreshRate) {
                    messages.push(propertyNotSetMessage(object, "refreshRate"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            orientation: observable,
            displayValue: observable,
            textStyle: observable,
            line1Data: observable,
            line1Style: observable,
            line2Data: observable,
            line2Style: observable,
            min: observable,
            max: observable,
            refreshRate: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let barGraphWidget = this;
                        let style = barGraphWidget.style;

                        let valueText =
                            (barGraphWidget.data &&
                                flowContext.dataContext.get(
                                    barGraphWidget.data
                                )) ||
                            "0";
                        let value = parseFloat(valueText);
                        if (isNaN(value)) {
                            value = 0;
                        }
                        let horizontal =
                            barGraphWidget.orientation == "left-right" ||
                            barGraphWidget.orientation == "right-left";

                        let d = horizontal ? width : height;

                        function calcPos(value: number) {
                            let pos = Math.round(d / 3);
                            if (pos < 0) {
                                pos = 0;
                            }
                            if (pos > d) {
                                pos = d;
                            }
                            return pos;
                        }

                        let pos = calcPos(value);

                        if (barGraphWidget.orientation == "left-right") {
                            draw.setColor(style.colorProperty);
                            draw.fillRect(ctx, 0, 0, pos - 1, height - 1);
                            draw.setColor(style.backgroundColorProperty);
                            draw.fillRect(ctx, pos, 0, width - 1, height - 1);
                        } else if (barGraphWidget.orientation == "right-left") {
                            draw.setColor(style.backgroundColorProperty);
                            draw.fillRect(
                                ctx,
                                0,
                                0,
                                width - pos - 1,
                                height - 1
                            );
                            draw.setColor(style.colorProperty);
                            draw.fillRect(
                                ctx,
                                width - pos,
                                0,
                                width - 1,
                                height - 1
                            );
                        } else if (barGraphWidget.orientation == "top-bottom") {
                            draw.setColor(style.colorProperty);
                            draw.fillRect(ctx, 0, 0, width - 1, pos - 1);
                            draw.setColor(style.backgroundColorProperty);
                            draw.fillRect(ctx, 0, pos, width - 1, height - 1);
                        } else {
                            draw.setColor(style.backgroundColorProperty);
                            draw.fillRect(
                                ctx,
                                0,
                                0,
                                width - 1,
                                height - pos - 1
                            );
                            draw.setColor(style.colorProperty);
                            draw.fillRect(
                                ctx,
                                0,
                                height - pos,
                                width - 1,
                                height - 1
                            );
                        }

                        if (this.displayValue) {
                            if (horizontal) {
                                let textStyle = barGraphWidget.textStyle;
                                const font = draw.styleGetFont(textStyle);
                                if (font) {
                                    let w = draw.measureStr(
                                        valueText,
                                        font,
                                        width
                                    );
                                    w += style.paddingRect.left;

                                    if (w > 0 && height > 0) {
                                        let backgroundColor: string;
                                        let x: number;

                                        if (pos + w <= width) {
                                            backgroundColor =
                                                style.backgroundColorProperty;
                                            x = pos;
                                        } else {
                                            backgroundColor =
                                                style.colorProperty;
                                            x =
                                                pos -
                                                w -
                                                style.paddingRect.right;
                                        }

                                        draw.drawText(
                                            ctx,
                                            valueText,
                                            x,
                                            0,
                                            w,
                                            height,
                                            textStyle,
                                            false,
                                            backgroundColor
                                        );
                                    }
                                }
                            }
                        }

                        function drawLine(
                            lineData: string | undefined,
                            lineStyle: Style
                        ) {
                            let value =
                                (lineData &&
                                    parseFloat(
                                        flowContext.dataContext.get(lineData)
                                    )) ||
                                0;
                            if (isNaN(value)) {
                                value = 0;
                            }
                            let pos = calcPos(value);
                            if (pos == d) {
                                pos = d - 1;
                            }
                            draw.setColor(lineStyle.colorProperty);
                            if (barGraphWidget.orientation == "left-right") {
                                draw.drawVLine(ctx, pos, 0, height - 1);
                            } else if (
                                barGraphWidget.orientation == "right-left"
                            ) {
                                draw.drawVLine(ctx, width - pos, 0, height - 1);
                            } else if (
                                barGraphWidget.orientation == "top-bottom"
                            ) {
                                draw.drawHLine(ctx, 0, pos, width - 1);
                            } else {
                                draw.drawHLine(ctx, 0, height - pos, width - 1);
                            }
                        }

                        drawLine(
                            barGraphWidget.line1Data,
                            barGraphWidget.line1Style
                        );
                        drawLine(
                            barGraphWidget.line2Data,
                            barGraphWidget.line2Style
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // textStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "textStyle"));

        // line1Data
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "line1Data"));

        // line1Style
        dataBuffer.writeInt16(assets.getStyleIndex(this, "line1Style"));

        // line2Data
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "line2Data"));

        // line2Style
        dataBuffer.writeInt16(assets.getStyleIndex(this, "line2Style"));

        if (isV3OrNewerProject(this)) {
            // min
            dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));

            // max
            dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));

            // refreshRate
            dataBuffer.writeInt16(
                assets.projectStore.projectTypeTraits.hasFlowSupport
                    ? assets.getWidgetDataItemIndex(this, "refreshRate")
                    : 0
            );
        }

        // orientation
        let orientation: number;
        switch (this.orientation) {
            case "left-right":
                orientation = BAR_GRAPH_ORIENTATION_LEFT_RIGHT;
                break;
            case "right-left":
                orientation = BAR_GRAPH_ORIENTATION_RIGHT_LEFT;
                break;
            case "top-bottom":
                orientation = BAR_GRAPH_ORIENTATION_TOP_BOTTOM;
                break;
            default:
                orientation = BAR_GRAPH_ORIENTATION_BOTTOM_TOP;
        }

        if (!this.displayValue) {
            orientation |= BAR_GRAPH_DO_NOT_DISPLAY_VALUE;
        }

        dataBuffer.writeUint8(orientation);
    }
}

registerClass("BarGraphWidget", BarGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class YTGraphWidget extends Widget {
    y1Style: Style;
    y2Data?: string;
    y2Style: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_YT_GRAPH,

        properties: [
            Object.assign(makeStylePropertyInfo("y1Style"), {
                hideInPropertyGrid: isNotV1Project
            }),
            Object.assign(makeStylePropertyInfo("y2Style"), {
                hideInPropertyGrid: isNotV1Project
            }),
            Object.assign(makeDataPropertyInfo("y2Data"), {
                hideInPropertyGrid: isNotV1Project
            })
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "y1Style");
            migrateStyleProperty(jsObject, "y2Style");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <line x1="4" y1="19" x2="20" y2="19"></line>
                <polyline points="4 15 8 9 12 11 16 6 20 10"></polyline>
            </svg>
        ),

        check: (object: YTGraphWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            const project = getProject(object);

            if (project.settings.general.projectVersion === "v1") {
                if (object.y2Data) {
                    if (!findVariable(project, object.y2Data)) {
                        messages.push(
                            propertyNotFoundMessage(object, "y2Data")
                        );
                    }
                } else {
                    messages.push(propertyNotSetMessage(object, "y2Data"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            y1Style: observable,
            y2Data: observable,
            y2Style: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            true
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

registerClass("YTGraphWidget", YTGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class UpDownWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_UP_DOWN,

        properties: [
            makeDataPropertyInfo("data", {}, "integer"),
            makeTextPropertyInfo("downButtonText"),
            makeTextPropertyInfo("upButtonText"),
            makeDataPropertyInfo("min", {
                disabled: isNotProjectWithFlowSupport
            }),
            makeDataPropertyInfo("max", {
                disabled: isNotProjectWithFlowSupport
            }),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("buttonsStyle")
        ],

        beforeLoadHook: (
            widget: UpDownWidget,
            jsWidget: Partial<UpDownWidget>,
            project: Project
        ) => {
            if (project.projectTypeTraits.hasFlowSupport) {
                if (widget.min == undefined) {
                    widget.min = "0";
                }
                if (widget.max == undefined) {
                    widget.max = "100";
                }
            }

            migrateStyleProperty(jsWidget, "buttonsStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            upButtonText: ">",
            downButtonText: "<"
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                fillRule="evenodd"
                clipRule="evenodd"
                strokeLinejoin="round"
                strokeMiterlimit="2"
                fill="currentColor"
            >
                <path d="M16.25 18.689V6.5c0-.414.336-.75.75-.75s.75.336.75.75v12.189l2.72-2.719c.292-.293.768-.293 1.06 0 .293.292.293.768 0 1.06 0 0-2.144 2.145-3.293 3.293-.328.328-.773.513-1.237.513-.464 0-.909-.185-1.237-.513a9524.146 9524.146 0 0 1-3.293-3.293c-.293-.292-.293-.768 0-1.06.292-.293.768-.293 1.06 0l2.72 2.719Zm-10-12.378L3.53 9.03c-.292.293-.768.293-1.06 0-.293-.292-.293-.768 0-1.06 0 0 2.144-2.145 3.293-3.293.328-.328.773-.513 1.237-.513.464 0 .909.185 1.237.513C9.386 5.825 11.53 7.97 11.53 7.97c.293.292.293.768 0 1.06-.292.293-.768.293-1.06 0L7.75 6.311V18.5c0 .414-.336.75-.75.75s-.75-.336-.75-.75V6.311Z" />
            </svg>
        ),

        check: (object: UpDownWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (!object.downButtonText) {
                messages.push(propertyNotSetMessage(object, "downButtonText"));
            }

            if (!object.upButtonText) {
                messages.push(propertyNotSetMessage(object, "upButtonText"));
            }
        }
    });

    buttonsStyle: Style;
    downButtonText?: string;
    upButtonText?: string;
    min: string;
    max: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            buttonsStyle: observable,
            downButtonText: observable,
            upButtonText: observable,
            min: observable,
            max: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        let text = this.data
            ? (flowContext.dataContext.get(this.data) as string)
            : "";

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let upDownWidget = this;
                        let style = upDownWidget.style;
                        let buttonsStyle = upDownWidget.buttonsStyle;

                        const buttonsFont = draw.styleGetFont(buttonsStyle);
                        if (!buttonsFont) {
                            return;
                        }

                        const buttonWidth =
                            buttonsStyle.paddingRect.left +
                            buttonsFont.height +
                            buttonsStyle.paddingRect.right;

                        draw.drawText(
                            ctx,
                            upDownWidget.downButtonText || "<",
                            0,
                            0,
                            buttonWidth,
                            height,
                            buttonsStyle,
                            false
                        );

                        draw.drawText(
                            ctx,
                            text,
                            buttonWidth,
                            0,
                            width - 2 * buttonWidth,
                            height,
                            style,
                            false
                        );

                        draw.drawText(
                            ctx,
                            upDownWidget.upButtonText || ">",
                            width - buttonWidth,
                            0,
                            buttonWidth,
                            height,
                            buttonsStyle,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // down button text
        buildWidgetText(assets, dataBuffer, this.downButtonText, "<");

        // up button text
        buildWidgetText(assets, dataBuffer, this.upButtonText, ">");

        // buttonStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "buttonsStyle"));

        if (isV3OrNewerProject(this)) {
            // min
            dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));

            // max
            dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));
        }
    }
}

registerClass("UpDownWidget", UpDownWidget);

////////////////////////////////////////////////////////////////////////////////

export class ListGraphWidget extends Widget {
    dwellData?: string;
    y1Data?: string;
    y1Style: Style;
    y2Data?: string;
    y2Style: Style;
    cursorData?: string;
    cursorStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",
        flowComponentId: WIDGET_TYPE_LIST_GRAPH,

        properties: [
            makeDataPropertyInfo("dwellData"),
            makeDataPropertyInfo("y1Data"),
            makeStylePropertyInfo("y1Style"),
            makeStylePropertyInfo("y2Style"),
            makeStylePropertyInfo("cursorStyle"),
            makeDataPropertyInfo("y2Data"),
            makeDataPropertyInfo("cursorData")
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "y1Style");
            migrateStyleProperty(jsObject, "y2Style");
            migrateStyleProperty(jsObject, "cursorStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M4 18h4v-4h4v-4h4v-4h4"></path>
            </svg>
        ),

        check: (object: ListGraphWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            const project = getProject(object);

            if (object.dwellData) {
                if (!findVariable(project, object.dwellData)) {
                    messages.push(propertyNotFoundMessage(object, "dwellData"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "dwellData"));
            }

            if (object.y1Data) {
                if (!findVariable(project, object.y1Data)) {
                    messages.push(propertyNotFoundMessage(object, "y1Data"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "y1Data"));
            }

            if (object.y2Data) {
                if (!findVariable(project, object.y2Data)) {
                    messages.push(propertyNotFoundMessage(object, "y2Data"));
                }
            } else {
                messages.push(propertyNotSetMessage(object, "y2Data"));
            }

            if (object.cursorData) {
                if (!findVariable(project, object.cursorData)) {
                    messages.push(
                        propertyNotFoundMessage(object, "cursorData")
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "cursorData"));
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            dwellData: observable,
            y1Data: observable,
            y1Style: observable,
            y2Data: observable,
            y2Style: observable,
            cursorData: observable,
            cursorStyle: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            true
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // dwellData
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "dwellData"));
        // y1Data
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "y1Data"));
        // y1Style
        dataBuffer.writeInt16(assets.getStyleIndex(this, "y1Style"));
        // y2Data
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "y2Data"));
        // y2Style
        dataBuffer.writeInt16(assets.getStyleIndex(this, "y2Style"));
        // cursorData
        dataBuffer.writeInt16(
            assets.getWidgetDataItemIndex(this, "cursorData")
        );
        // cursorStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "cursorStyle"));
    }
}

registerClass("ListGraphWidget", ListGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class ProgressWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_PROGRESS,

        properties: [
            makeDataPropertyInfo("data", {}, "integer"),
            makeDataPropertyInfo("min", {
                disabled: isNotProjectWithFlowSupport
            }),
            makeDataPropertyInfo("max", {
                disabled: isNotProjectWithFlowSupport
            }),
            {
                name: "orientation",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "horizontal"
                    },
                    {
                        id: "vertical"
                    }
                ]
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        beforeLoadHook: (
            progressWidget: ProgressWidget,
            jsProgressWidget: Partial<ProgressWidget>,
            project: Project
        ) => {
            if (project.projectTypeTraits.hasFlowSupport) {
                if (jsProgressWidget.min == undefined) {
                    jsProgressWidget.min = "0";
                }
                if (jsProgressWidget.max == undefined) {
                    jsProgressWidget.max = "100";
                }
            }

            if (jsProgressWidget.orientation == undefined) {
                jsProgressWidget.orientation =
                    jsProgressWidget.width! > jsProgressWidget.height!
                        ? "horizontal"
                        : "vertical";
            }
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 128,
            height: 32
        },

        icon: (
            <svg viewBox="0 0 32 32" fill="currentColor">
                <path d="M28 21H4a2.0021 2.0021 0 0 1-2-2v-6a2.0021 2.0021 0 0 1 2-2h24a2.0021 2.0021 0 0 1 2 2v6a2.0021 2.0021 0 0 1-2 2ZM4 13v6h24v-6Z" />
                <path d="M6 15h14v2H6z" />
                <path fill="none" d="M0 0h32v32H0z" />
            </svg>
        )
    });

    min: string;
    max: string;
    orientation: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            min: observable,
            max: observable,
            orientation: observable
        });
    }

    getPercent(flowContext: IFlowContext) {
        if (flowContext.projectStore.projectTypeTraits.hasFlowSupport) {
            if (flowContext.flowState) {
                try {
                    const min = evalProperty(flowContext, this, "min");
                    const max = evalProperty(flowContext, this, "max");
                    let value = evalProperty(flowContext, this, "data");

                    value = ((value - min) * 100) / (max - min);

                    if (value != null && value != undefined) {
                        return value;
                    }
                } catch (err) {
                    //console.error(err);
                }

                return 0;
            }

            return 25;
        }

        if (this.data) {
            const result = flowContext.dataContext.get(this.data);
            if (result != undefined) {
                return result;
            }
        }

        return 25;
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const percent = this.getPercent(flowContext);
        let isHorizontal = this.orientation == "horizontal";

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            true
                        );

                        // draw thumb
                        draw.setColor(this.style.colorProperty);
                        if (isHorizontal) {
                            draw.drawBackground(
                                ctx,
                                0,
                                0,
                                (percent * width) / 100 - 1,
                                height - 1,
                                this.style,
                                false
                            );
                        } else {
                            draw.drawBackground(
                                ctx,
                                0,
                                height - (percent * height) / 100,
                                width - 1,
                                height - 1,
                                this.style,
                                false
                            );
                        }
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // min
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));

        // max
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));

        // direction
        const PROGRESS_WIDGET_ORIENTATION_HORIZONTAL = 0;
        const PROGRESS_WIDGET_ORIENTATION_VERTICAL = 1;
        dataBuffer.writeUint8(
            this.orientation == "horizontal"
                ? PROGRESS_WIDGET_ORIENTATION_HORIZONTAL
                : PROGRESS_WIDGET_ORIENTATION_VERTICAL
        );

        // reserved1
        dataBuffer.writeUint8(0);
    }
}

registerClass("ProgressWidget", ProgressWidget);

////////////////////////////////////////////////////////////////////////////////

export class AppViewWidget extends Widget {
    page: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_APP_VIEW,

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
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
                <path d="M6 8h.01M9 8h.01" />
            </svg>
        ),

        check: (object: AppViewWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            page: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        let element;

        if (this.data) {
            const pageName = flowContext.dataContext.get(this.data);
            if (pageName) {
                const page = findPage(getProject(this), pageName);
                if (page) {
                    element = (
                        <ComponentEnclosure
                            component={page}
                            flowContext={
                                flowContext.flowState
                                    ? flowContext.overrideFlowState(this)
                                    : flowContext
                            }
                            width={width}
                            height={height}
                        />
                    );
                }
            }
        }
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            true
                        );
                    }}
                />
                {element}
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

registerClass("AppViewWidget", AppViewWidget);

////////////////////////////////////////////////////////////////////////////////

export class ScrollBarWidget extends Widget {
    thumbStyle: Style;
    buttonsStyle: Style;
    leftButtonText?: string;
    rightButtonText?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        flowComponentId: WIDGET_TYPE_SCROLL_BAR,

        properties: [
            makeDataPropertyInfo("data", {}, "struct:$ScrollbarState"),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("thumbStyle"),
            makeStylePropertyInfo("buttonsStyle"),
            makeTextPropertyInfo("leftButtonText"),
            makeTextPropertyInfo("rightButtonText")
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "thumbStyle");
            migrateStyleProperty(jsObject, "buttonsStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 128,
            height: 32,
            leftButtonText: "<",
            rightButtonText: ">"
        },

        icon: (
            <svg viewBox="0 0 14 14" fill="currentColor">
                <path d="M1.2338 8.6533C1.0218 8.5507 1 8.3965 1 7.0017c0-1.415.0204-1.5505.2495-1.6548.185-.084 11.316-.084 11.501 0 .229.1043.2495.2398.2495 1.6548 0 1.4149-.0204 1.5504-.2495 1.6548-.1769.081-11.35.078-11.5167 0zm1.7912-.6445c.045-.045.0643-.3408.0643-.9872 0-.7676-.0142-.9371-.0842-1.0072-.0463-.046-.1145-.084-.1515-.084-.0748 0-1.2623.8754-1.3282.979-.0876.1379-.0252.2099.5862.6767.6194.473.786.55.9134.4228zm8.8283-.3737c.6232-.4672.6625-.505.6637-.6403.0008-.079-1.1217-.9723-1.3146-1.0463-.0433-.017-.1146-.0006-.1584.036-.0652.054-.0797.2436-.0797 1.0417 0 .5366.016.9917.0357 1.0113.1003.1004.3227 0 .8533-.4023zM10 7.0017v-.8572H4v1.7142h6v-.857z" />
            </svg>
        ),

        check: (object: ScrollBarWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }

            if (!object.leftButtonText) {
                messages.push(propertyNotSetMessage(object, "leftButtonText"));
            }

            if (!object.rightButtonText) {
                messages.push(propertyNotSetMessage(object, "rightButtonText"));
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            thumbStyle: observable,
            buttonsStyle: observable,
            leftButtonText: observable,
            rightButtonText: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let widget = this;

                        const buttonsFont = draw.styleGetFont(
                            widget.buttonsStyle
                        );
                        if (!buttonsFont) {
                            return;
                        }

                        let isHorizontal = width > height;

                        let buttonSize = isHorizontal ? height : width;

                        // draw left button
                        draw.drawText(
                            ctx,
                            widget.leftButtonText || "<",
                            0,
                            0,
                            isHorizontal ? buttonSize : width,
                            isHorizontal ? height : buttonSize,
                            widget.buttonsStyle,
                            false
                        );

                        // draw track
                        let x;
                        let y;
                        let w;
                        let h;

                        if (isHorizontal) {
                            x = buttonSize;
                            y = 0;
                            w = width - 2 * buttonSize;
                            h = height;
                        } else {
                            x = 0;
                            y = buttonSize;
                            w = width;
                            h = height - 2 * buttonSize;
                        }

                        draw.setColor(this.style.colorProperty);
                        draw.fillRect(ctx, x, y, x + w - 1, y + h - 1);

                        // draw thumb
                        let data = (widget.data &&
                            flowContext.dataContext.get(widget.data)) || [
                            100, 25, 20
                        ];

                        if (!isArray(data)) {
                            data = [
                                data.numItems,
                                data.position,
                                data.itemsPerPage
                            ];
                        }

                        const [size, position, pageSize] = data;

                        let xThumb;
                        let widthThumb;
                        let yThumb;
                        let heightThumb;

                        if (isHorizontal) {
                            xThumb = Math.floor((position * w) / size);
                            widthThumb = Math.max(
                                Math.floor((pageSize * w) / size),
                                buttonSize
                            );
                            yThumb = y;
                            heightThumb = h;
                        } else {
                            xThumb = x;
                            widthThumb = w;
                            yThumb = Math.floor((position * h) / size);
                            heightThumb = Math.max(
                                Math.floor((pageSize * h) / size),
                                buttonSize
                            );
                        }

                        draw.setColor(this.thumbStyle.colorProperty);
                        draw.fillRect(
                            ctx,
                            xThumb,
                            yThumb,
                            xThumb + widthThumb - 1,
                            yThumb + heightThumb - 1
                        );

                        // draw right button
                        draw.drawText(
                            ctx,
                            widget.rightButtonText || ">",
                            isHorizontal ? width - buttonSize : 0,
                            isHorizontal ? 0 : height - buttonSize,
                            isHorizontal ? buttonSize : width,
                            isHorizontal ? height : buttonSize,
                            widget.buttonsStyle,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // thumbStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "thumbStyle"));

        // buttonStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "buttonsStyle"));

        // down button text
        buildWidgetText(assets, dataBuffer, this.leftButtonText, "<");

        // up button text
        buildWidgetText(assets, dataBuffer, this.rightButtonText, ">");
    }
}

registerClass("ScrollBarWidget", ScrollBarWidget);

////////////////////////////////////////////////////////////////////////////////

export class CanvasWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_CANVAS,

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="8" y="8" width="8" height="8" rx="1"></rect>
                <line x1="3" y1="8" x2="4" y2="8"></line>
                <line x1="3" y1="16" x2="4" y2="16"></line>
                <line x1="8" y1="3" x2="8" y2="4"></line>
                <line x1="16" y1="3" x2="16" y2="4"></line>
                <line x1="20" y1="8" x2="21" y2="8"></line>
                <line x1="20" y1="16" x2="21" y2="16"></line>
                <line x1="8" y1="20" x2="8" y2="21"></line>
                <line x1="16" y1="20" x2="16" y2="21"></line>
            </svg>
        ),

        check: (object: CanvasWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }
        }
    });

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.setColor(this.style.backgroundColorProperty);
                        draw.fillRect(ctx, 0, 0, width - 1, height - 1);
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

registerClass("CanvasWidget", CanvasWidget);

////////////////////////////////////////////////////////////////////////////////

class LineChartLine extends EezObject {
    label: string;
    color: string;
    width: number;
    value: string;

    static classInfo: ClassInfo = {
        properties: [
            makeExpressionProperty(
                {
                    name: "label",
                    type: PropertyType.MultilineText
                },
                "string"
            ),
            {
                name: "color",
                type: PropertyType.Color,
                propertyGridGroup: specificGroup
            },
            {
                name: "width",
                displayName: "Line width",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText
                },
                "double"
            )
        ],
        beforeLoadHook: (
            object: LineChartLine,
            jsObject: Partial<LineChartLine>
        ) => {
            if (jsObject.width == undefined) {
                jsObject.width = 1.5;
            }
        },
        check: (lineChartTrace: LineChartLine, messages: IMessage[]) => {
            try {
                checkExpression(
                    getParent(
                        getParent(lineChartTrace)!
                    )! as LineChartEmbeddedWidget,
                    lineChartTrace.label
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid expression: ${err}`,
                        getChildOfObject(lineChartTrace, "label")
                    )
                );
            }

            try {
                checkExpression(
                    getParent(
                        getParent(lineChartTrace)!
                    )! as LineChartEmbeddedWidget,
                    lineChartTrace.value
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid expression: ${err}`,
                        getChildOfObject(lineChartTrace, "value")
                    )
                );
            }
        },
        defaultValue: {
            color: "#333333",
            lineWidth: 1.5
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            label: observable,
            color: observable,
            width: observable,
            value: observable
        });
    }
}

export class LineChartEmbeddedWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_LINE_CHART,

        properties: [
            Object.assign(makeDataPropertyInfo("data"), {
                hideInPropertyGrid: true
            }),
            makeExpressionProperty(
                {
                    name: "xValue",
                    displayName: "X value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            ),
            {
                name: "lines",
                type: PropertyType.Array,
                typeClass: LineChartLine,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            makeDataPropertyInfo("showTitle", {}, "boolean"),
            makeDataPropertyInfo("showLegend", {}, "boolean"),
            makeDataPropertyInfo(
                "showXAxis",
                { displayName: "Show X axis" },
                "boolean"
            ),
            makeDataPropertyInfo(
                "showYAxis",
                { displayName: "Show Y axis" },
                "boolean"
            ),
            makeDataPropertyInfo("showYAxis", {}, "boolean"),
            makeDataPropertyInfo("showGrid", {}, "boolean"),
            makeDataPropertyInfo("title", {}, "string"),
            {
                name: "yAxisRangeOption",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "floating",
                        label: "Floating"
                    },
                    {
                        id: "fixed",
                        label: "Fixed"
                    }
                ],
                propertyGridGroup: specificGroup
            },
            makeDataPropertyInfo(
                "yAxisRangeFrom",
                {
                    disabled: (widget: LineChartEmbeddedWidget) =>
                        widget.yAxisRangeOption != "fixed"
                },
                "double"
            ),
            makeDataPropertyInfo(
                "yAxisRangeTo",
                {
                    disabled: (widget: LineChartEmbeddedWidget) =>
                        widget.yAxisRangeOption != "fixed"
                },
                "double"
            ),
            {
                name: "maxPoints",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "margin",
                type: PropertyType.Object,
                typeClass: RectObject,
                propertyGridGroup: specificGroup,
                enumerable: false
            },
            makeDataPropertyInfo("marker", {}, "float"),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("titleStyle"),
            makeStylePropertyInfo("legendStyle"),
            makeStylePropertyInfo("xAxisStyle"),
            makeStylePropertyInfo("yAxisStyle"),
            makeStylePropertyInfo("markerStyle")
        ],

        beforeLoadHook: (
            widget: LineChartEmbeddedWidget,
            jsWidget: Partial<LineChartEmbeddedWidget>
        ) => {
            if (jsWidget.showTitle == undefined) {
                jsWidget.showTitle = "true";
            }
            if (jsWidget.showXAxis == undefined) {
                jsWidget.showXAxis = "true";
            }
            if (jsWidget.showYAxis == undefined) {
                jsWidget.showYAxis = "true";
            }
            if (jsWidget.showGrid == undefined) {
                jsWidget.showGrid = "true";
            }
            if (jsWidget.marker == undefined) {
                jsWidget.marker = "null";
            }
            if (jsWidget.markerStyle == undefined) {
                (jsWidget as any).markerStyle = {
                    useStyle: "default"
                };
            }

            migrateStyleProperty(jsWidget, "titleStyle");
            migrateStyleProperty(jsWidget, "legendStyle");
            migrateStyleProperty(jsWidget, "xAxisStyle");
            migrateStyleProperty(jsWidget, "yAxisStyle");
            migrateStyleProperty(jsWidget, "markerStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 320,
            height: 160,
            xValue: "Date.now()",
            lines: [],
            title: "",
            showTitle: "true",
            showLegend: "true",
            showXAxis: "true",
            showYAxis: "true",
            showGrid: "true",
            yAxisRangeOption: "floating",
            yAxisRangeFrom: 0,
            yAxisRangeTo: 10,
            maxPoints: 40,
            minRange: 0,
            maxRange: 1,
            margin: {
                top: 50,
                right: 0,
                bottom: 50,
                left: 50
            },
            marker: "null",
            customInputs: [
                {
                    name: "value",
                    type: "any"
                }
            ],
            titleStyle: {
                useStyle: "default"
            },
            legendStyle: {
                useStyle: "default"
            },
            xAxisStyle: {
                useStyle: "default"
            },
            yAxisStyle: {
                useStyle: "default",
                alignHorizontal: "right"
            },
            markerStyle: {
                useStyle: "default"
            }
        },

        icon: LINE_CHART_ICON
    });

    xValue: string;
    lines: LineChartLine[];
    title: string;
    showTitle: string;
    showLegend: string;
    showXAxis: string;
    showYAxis: string;
    showGrid: string;
    yAxisRangeOption: "floating" | "fixed";
    yAxisRangeFrom: string;
    yAxisRangeTo: string;
    maxPoints: number;
    margin: RectObject;
    marker: string;

    titleStyle: Style;
    legendStyle: Style;
    xAxisStyle: Style;
    yAxisStyle: Style;
    markerStyle: Style;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            xValue: observable,
            lines: observable,
            title: observable,
            showTitle: observable,
            showLegend: observable,
            showXAxis: observable,
            showYAxis: observable,
            showGrid: observable,
            yAxisRangeOption: observable,
            yAxisRangeFrom: observable,
            yAxisRangeTo: observable,
            maxPoints: observable,
            margin: observable,
            marker: observable,
            titleStyle: observable,
            legendStyle: observable,
            xAxisStyle: observable,
            yAxisStyle: observable,
            markerStyle: observable
        });
    }

    getInputs() {
        return [
            {
                name: "reset",
                type: "any" as ValueType,
                isSequenceInput: false,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getTitle(flowContext: IFlowContext) {
        if (!this.title) {
            return undefined;
        }

        if (flowContext.projectStore.projectTypeTraits.hasFlowSupport) {
            return evalProperty(flowContext, this, "title");
        }

        return this.title;
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    width={width}
                    height={height}
                    component={this}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        interface Axis {
                            position: "x" | "y";
                            type: "date" | "number";

                            rect: {
                                x: number;
                                y: number;
                                w: number;
                                h: number;
                            };

                            min: number;
                            max: number;

                            offset: number;
                            scale: number;

                            ticksDelta: number;
                        }

                        function calcAutoTicks(axis: Axis, maxTicks: number) {
                            const pxStart =
                                axis.position == "x"
                                    ? axis.rect.x
                                    : axis.rect.y + axis.rect.h;
                            const pxRange =
                                axis.position == "x"
                                    ? axis.rect.w
                                    : -axis.rect.h;

                            let range = axis.max - axis.min;

                            const min = axis.min - 0.05 * range;
                            const max = axis.max + 0.05 * range;

                            range = max - min;

                            axis.scale = pxRange / range;
                            axis.offset = pxStart - min * axis.scale;

                            const x = range / maxTicks;
                            const exp = Math.floor(Math.log10(x));
                            const nx = x * Math.pow(10, -exp);
                            const ndelta = nx < 2 ? 2 : nx < 5 ? 5 : 10;
                            const delta = ndelta * Math.pow(10, exp);
                            axis.ticksDelta = delta;
                        }

                        const drawTitle = (
                            x: number,
                            y: number,
                            w: number,
                            h: number
                        ) => {
                            const title = this.getTitle(flowContext);
                            if (title) {
                                draw.drawText(
                                    ctx,
                                    title,
                                    x,
                                    y,
                                    w,
                                    h,
                                    this.titleStyle,
                                    false
                                );
                            }
                        };

                        const LEGEND_ICON_WIDTH = 32;

                        const measLegendWidth = () => {
                            if (!showLegend) {
                                return { legendWidth: 0, legendLineHeight: 0 };
                            }

                            const legendFont = draw.styleGetFont(
                                this.legendStyle
                            );
                            if (!legendFont) {
                                return { legendWidth: 0, legendLineHeight: 0 };
                            }

                            let maxWidth = 0;

                            for (let i = 0; i < this.lines.length; i++) {
                                chart.legendLabels.push(`Trace ${i}`);

                                const width = draw.measureStr(
                                    chart.legendLabels[i],
                                    legendFont,
                                    widgetRect.w - LEGEND_ICON_WIDTH
                                );
                                if (width > maxWidth) {
                                    maxWidth = width;
                                }
                            }

                            return {
                                legendWidth: LEGEND_ICON_WIDTH + maxWidth,
                                legendLineHeight: legendFont.height
                            };
                        };

                        const drawLegend = (
                            x: number,
                            y: number,
                            w: number,
                            h: number
                        ) => {
                            const legendFont = draw.styleGetFont(
                                this.legendStyle
                            );
                            if (!legendFont) {
                                return;
                            }

                            y += 0.5;
                            x = x + w - legendWidth;

                            for (let i = 0; i < this.lines.length; i++) {
                                const line = this.lines[i];

                                if (
                                    y + legendLineHeight >
                                    gridRect.y + gridRect.h
                                ) {
                                    break;
                                }

                                draw.setColor(line.color);

                                draw.fillRect(
                                    ctx,
                                    x,
                                    y + (legendLineHeight - 2) / 2,
                                    x + LEGEND_ICON_WIDTH - 4,
                                    y + (legendLineHeight - 2) / 2 + 2
                                );

                                draw.fillCircle(
                                    ctx,
                                    x + (LEGEND_ICON_WIDTH - 4) / 2,
                                    y + legendLineHeight / 2,
                                    3
                                );

                                draw.drawText(
                                    ctx,
                                    chart.legendLabels[i],
                                    x + LEGEND_ICON_WIDTH,
                                    y,
                                    legendWidth - LEGEND_ICON_WIDTH,
                                    legendLineHeight,
                                    this.legendStyle,
                                    false
                                );

                                y += legendLineHeight;
                            }
                        };

                        const drawXAxis = (axis: Axis) => {
                            const from =
                                Math.ceil(axis.min / axis.ticksDelta) *
                                axis.ticksDelta;
                            const to =
                                Math.floor(axis.max / axis.ticksDelta) *
                                axis.ticksDelta;

                            const w = axis.ticksDelta * axis.scale;

                            for (let i = 0; i < 100; i++) {
                                const tick = from + i * axis.ticksDelta;
                                if (tick > to) break;

                                const x = axis.offset + tick * axis.scale;

                                draw.drawText(
                                    ctx,
                                    tick.toString(),
                                    x - w / 2,
                                    axis.rect.y,
                                    w,
                                    axis.rect.h,
                                    this.xAxisStyle,
                                    false
                                );
                            }
                        };

                        const drawYAxis = (axis: Axis) => {
                            const from =
                                Math.ceil(axis.min / axis.ticksDelta) *
                                axis.ticksDelta;
                            const to =
                                Math.floor(axis.max / axis.ticksDelta) *
                                axis.ticksDelta;

                            const h = Math.abs(axis.ticksDelta * axis.scale);

                            for (let i = 0; i < 100; i++) {
                                const tick = from + i * axis.ticksDelta;
                                if (tick > to) break;

                                const y = axis.offset + tick * axis.scale;

                                draw.drawText(
                                    ctx,
                                    tick.toString(),
                                    axis.rect.x,
                                    y - h / 2,
                                    axis.rect.w,
                                    h,
                                    this.yAxisStyle,
                                    false
                                );
                            }
                        };

                        const drawGrid = () => {
                            const drawVerticalGrid = (
                                y: number,
                                h: number,
                                axis: Axis
                            ) => {
                                const from =
                                    Math.ceil(axis.min / axis.ticksDelta) *
                                    axis.ticksDelta;
                                const to =
                                    Math.floor(axis.max / axis.ticksDelta) *
                                    axis.ticksDelta;

                                for (let i = 0; i < 100; i++) {
                                    const tick = from + i * axis.ticksDelta;
                                    if (tick > to) break;

                                    const x = axis.offset + tick * axis.scale;

                                    draw.drawVLine(ctx, x, y, h);
                                }
                            };

                            const drawHorizontalGrid = (
                                x: number,
                                w: number,
                                axis: Axis
                            ) => {
                                const from =
                                    Math.ceil(axis.min / axis.ticksDelta) *
                                    axis.ticksDelta;
                                const to =
                                    Math.floor(axis.max / axis.ticksDelta) *
                                    axis.ticksDelta;

                                for (let i = 0; i < 100; i++) {
                                    const tick = from + i * axis.ticksDelta;
                                    if (tick > to) break;

                                    const y = axis.offset + tick * axis.scale;

                                    draw.drawHLine(ctx, x, y, w);
                                }
                            };

                            draw.setColor(this.style.borderColorProperty);

                            drawVerticalGrid(
                                gridRect.y,
                                gridRect.h,
                                chart.xAxis
                            );

                            drawHorizontalGrid(
                                gridRect.x,
                                gridRect.w,
                                chart.yAxis
                            );
                        };

                        const drawLines = () => {
                            ctx.beginPath();
                            ctx.rect(
                                gridRect.x,
                                gridRect.y,
                                gridRect.w,
                                gridRect.h
                            );
                            ctx.clip();

                            for (
                                let lineIndex = 0;
                                lineIndex < this.lines.length;
                                lineIndex++
                            ) {
                                const line = this.lines[lineIndex];

                                ctx.beginPath();
                                ctx.moveTo(
                                    chart.xAxis.offset +
                                        chart.x[0] * chart.xAxis.scale,
                                    chart.yAxis.offset +
                                        chart.lines[lineIndex].y[0] *
                                            chart.yAxis.scale
                                );

                                for (
                                    let pointIndex = 1;
                                    pointIndex < this.xValue.length - 1;
                                    pointIndex++
                                ) {
                                    ctx.lineTo(
                                        chart.xAxis.offset +
                                            chart.x[pointIndex] *
                                                chart.xAxis.scale,
                                        chart.yAxis.offset +
                                            chart.lines[lineIndex].y[
                                                pointIndex
                                            ] *
                                                chart.yAxis.scale
                                    );
                                }

                                ctx.strokeStyle = line.color;
                                ctx.lineWidth = line.width;
                                ctx.stroke();
                            }
                        };

                        const chart: {
                            legendLabels: string[];
                            xAxis: Axis;
                            yAxis: Axis;
                            x: number[];
                            lines: {
                                y: number[];
                            }[];
                        } = {
                            legendLabels: [],
                            xAxis: {
                                position: "x",
                                type: "number",
                                rect: { x: 0, y: 0, w: 0, h: 0 },
                                min: 0,
                                max: 0,
                                offset: 0,
                                scale: 1.0,
                                ticksDelta: 0
                            },
                            yAxis: {
                                position: "y",
                                type: "number",
                                rect: { x: 0, y: 0, w: 0, h: 0 },
                                min: 0,
                                max: 0,
                                offset: 0,
                                scale: 1.0,
                                ticksDelta: 0
                            },
                            x: [1, 2, 3, 4],
                            lines: this.lines.map((line, i) => ({
                                y: [
                                    i + 1,
                                    (i + 1) * 2,
                                    (i + 1) * 3,
                                    (i + 1) * 4
                                ]
                            }))
                        };

                        chart.xAxis.min = Math.min(...chart.x);
                        chart.xAxis.max = Math.max(...chart.x);
                        if (chart.xAxis.min >= chart.xAxis.max) {
                            chart.xAxis.min = 0;
                            chart.xAxis.max = 1;
                        }

                        if (this.yAxisRangeOption == "fixed") {
                            try {
                                const result = evalConstantExpression(
                                    ProjectEditor.getProject(this),
                                    this.yAxisRangeFrom
                                );
                                chart.yAxis.min =
                                    typeof result.value == "number"
                                        ? result.value
                                        : 0;
                            } catch (err) {
                                chart.yAxis.min = 0;
                            }
                        } else {
                            chart.yAxis.min = Math.min(
                                ...chart.lines.map(line => Math.min(...line.y))
                            );
                        }

                        if (this.yAxisRangeOption == "fixed") {
                            try {
                                const result = evalConstantExpression(
                                    ProjectEditor.getProject(this),
                                    this.yAxisRangeTo
                                );
                                chart.yAxis.max =
                                    typeof result.value == "number"
                                        ? result.value
                                        : 10;
                            } catch {
                                chart.yAxis.max = 10;
                            }
                        } else {
                            chart.yAxis.max = Math.max(
                                ...chart.lines.map(line => Math.max(...line.y))
                            );
                        }

                        if (chart.yAxis.min >= chart.yAxis.max) {
                            chart.yAxis.min = 0;
                            chart.yAxis.max = 1;
                        }

                        const widgetRect = {
                            x: 0,
                            y: 0,
                            w: width,
                            h: height
                        };

                        let showTitle: boolean;
                        try {
                            const result = evalConstantExpression(
                                ProjectEditor.getProject(this),
                                this.showTitle
                            );
                            showTitle = result.value ? true : false;
                        } catch (err) {
                            showTitle = false;
                        }

                        let showLegend: boolean;
                        try {
                            const result = evalConstantExpression(
                                ProjectEditor.getProject(this),
                                this.showLegend
                            );
                            showLegend = result.value ? true : false;
                        } catch (err) {
                            showLegend = false;
                        }

                        let showXAxis: boolean;
                        try {
                            const result = evalConstantExpression(
                                ProjectEditor.getProject(this),
                                this.showXAxis
                            );
                            showXAxis = result.value ? true : false;
                        } catch (err) {
                            showXAxis = false;
                        }

                        let showYAxis: boolean;
                        try {
                            const result = evalConstantExpression(
                                ProjectEditor.getProject(this),
                                this.showYAxis
                            );
                            showYAxis = result.value ? true : false;
                        } catch (err) {
                            showYAxis = false;
                        }

                        let showGrid: boolean;
                        try {
                            const result = evalConstantExpression(
                                ProjectEditor.getProject(this),
                                this.showGrid
                            );
                            showGrid = result.value ? true : false;
                        } catch (err) {
                            showGrid = false;
                        }

                        const { legendWidth, legendLineHeight } =
                            measLegendWidth();

                        const marginLeft =
                            this.margin.left +
                            this.style.borderSizeRect.left +
                            Math.max(
                                this.style.borderRadiusSpec.topLeftX,
                                this.style.borderRadiusSpec.bottomLeftX
                            );
                        const marginTop =
                            this.margin.top +
                            this.style.borderSizeRect.top +
                            Math.max(
                                this.style.borderRadiusSpec.topLeftY,
                                this.style.borderRadiusSpec.topRightY
                            );
                        const marginRight =
                            Math.max(this.margin.right, legendWidth) +
                            this.style.borderSizeRect.right +
                            Math.max(
                                this.style.borderRadiusSpec.topRightX,
                                this.style.borderRadiusSpec.bottomRightX
                            );
                        const marginBottom =
                            this.margin.bottom +
                            this.style.borderSizeRect.bottom +
                            Math.max(
                                this.style.borderRadiusSpec.bottomLeftY,
                                this.style.borderRadiusSpec.bottomRightY
                            );

                        let gridRect = {
                            x: widgetRect.x + marginLeft,
                            y: widgetRect.y + marginTop,
                            w: widgetRect.w - (marginLeft + marginRight),
                            h: widgetRect.h - (marginTop + marginBottom)
                        };

                        chart.xAxis.rect.x = gridRect.x;
                        chart.xAxis.rect.y = gridRect.y + gridRect.h;
                        chart.xAxis.rect.w = gridRect.w;
                        chart.xAxis.rect.h = this.margin.bottom;

                        chart.yAxis.rect.x =
                            widgetRect.x + marginLeft - this.margin.left;
                        chart.yAxis.rect.y = gridRect.y;
                        chart.yAxis.rect.w = this.margin.left;
                        chart.yAxis.rect.h = gridRect.h;

                        const xAxisFont = draw.styleGetFont(this.xAxisStyle);
                        let xAxisLabelWidth;
                        if (xAxisFont) {
                            xAxisLabelWidth = draw.measureStr(
                                "12345",
                                xAxisFont,
                                gridRect.w
                            );
                        } else {
                            xAxisLabelWidth = 50;
                        }
                        calcAutoTicks(
                            chart.xAxis,
                            Math.round(gridRect.w / xAxisLabelWidth)
                        );

                        const yAxisFont = draw.styleGetFont(this.yAxisStyle);
                        let yAxisLabelHeight;
                        if (yAxisFont) {
                            yAxisLabelHeight = Math.round(
                                yAxisFont.height * 1.25
                            );
                        } else {
                            yAxisLabelHeight = 25;
                        }
                        calcAutoTicks(
                            chart.yAxis,
                            Math.round(gridRect.h / yAxisLabelHeight)
                        );

                        draw.drawBackground(
                            ctx,
                            widgetRect.x,
                            widgetRect.y,
                            widgetRect.w,
                            widgetRect.h,
                            this.style,
                            true
                        );

                        if (showTitle) {
                            drawTitle(
                                widgetRect.x,
                                widgetRect.y,
                                widgetRect.w,
                                marginTop
                            );
                        }

                        if (showLegend) {
                            drawLegend(
                                gridRect.x + gridRect.w,
                                gridRect.y,
                                marginRight,
                                gridRect.h
                            );
                        }

                        if (showXAxis) {
                            drawXAxis(chart.xAxis);
                        }

                        if (showYAxis) {
                            drawYAxis(chart.yAxis);
                        }

                        if (showGrid) {
                            drawGrid();
                        }

                        drawLines();
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // title
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "title"));

        // showTitle
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "showTitle"));

        // showLegend
        dataBuffer.writeInt16(
            assets.getWidgetDataItemIndex(this, "showLegend")
        );

        // showXAxis
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "showXAxis"));

        // showYAxis
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "showYAxis"));

        // showGrid
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "showGrid"));

        // yAxisRangeFrom
        dataBuffer.writeInt16(this.yAxisRangeOption == "fixed" ? 0 : 1);

        // yAxisRangeFrom
        dataBuffer.writeInt16(
            assets.getWidgetDataItemIndex(this, "yAxisRangeFrom")
        );

        // yAxisRangeTo
        dataBuffer.writeInt16(
            assets.getWidgetDataItemIndex(this, "yAxisRangeTo")
        );

        // margin
        dataBuffer.writeInt16(this.margin.left);
        dataBuffer.writeInt16(this.margin.top);
        dataBuffer.writeInt16(this.margin.right);
        dataBuffer.writeInt16(this.margin.bottom);

        // marker
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "marker"));

        // titleStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "titleStyle"));

        // legendStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "legendStyle"));

        // xAxisStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "xAxisStyle"));

        // yAxisStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "yAxisStyle"));

        // markerStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "markerStyle"));

        // component index
        dataBuffer.writeUint16(assets.getComponentIndex(this));
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // maxPoints
        dataBuffer.writeUint32(this.maxPoints);

        // xValue
        dataBuffer.writeObjectOffset(() =>
            buildExpression(assets, dataBuffer, this, this.xValue)
        );

        // lines
        dataBuffer.writeArray(this.lines, line => {
            dataBuffer.writeObjectOffset(() =>
                buildExpression(assets, dataBuffer, this, line.label)
            );

            let color = assets.getColorIndexFromColorValue(line.color);
            if (isNaN(color)) {
                color = 0;
            }
            dataBuffer.writeUint16(color);
            dataBuffer.writeUint16(0);

            dataBuffer.writeFloat(line.width);

            dataBuffer.writeObjectOffset(() =>
                buildExpression(assets, dataBuffer, this, line.value)
            );
        });
    }
}

registerClass("LineChartEmbeddedWidget", LineChartEmbeddedWidget);

////////////////////////////////////////////////////////////////////////////////

export class GaugeEmbeddedWidget extends Widget {
    min: string;
    max: string;
    threshold: string;
    unit: string;
    barStyle: Style;
    valueStyle: Style;
    ticksStyle: Style;
    thresholdStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_GAUGE,

        properties: [
            makeDataPropertyInfo("data"),
            makeDataPropertyInfo("min"),
            makeDataPropertyInfo("max"),
            makeDataPropertyInfo("threshold"),
            makeDataPropertyInfo("unit"),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("barStyle"),
            makeStylePropertyInfo("valueStyle"),
            makeStylePropertyInfo("ticksStyle"),
            makeStylePropertyInfo("thresholdStyle")
        ],

        beforeLoadHook: (
            widget: GaugeEmbeddedWidget,
            jsWidget: Partial<GaugeEmbeddedWidget>
        ) => {
            migrateStyleProperty(jsWidget, "barStyle");
            migrateStyleProperty(jsWidget, "valueStyle");
            migrateStyleProperty(jsWidget, "ticksStyle");
            migrateStyleProperty(jsWidget, "thresholdStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 128,
            height: 128
        },

        icon: GAUGE_ICON,

        check: (object: CanvasWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            min: observable,
            max: observable,
            threshold: observable,
            unit: observable,
            barStyle: observable,
            valueStyle: observable,
            ticksStyle: observable,
            thresholdStyle: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        let widget = this;
        let style = widget.style;

        // draw border
        function arcBorder(
            ctx: CanvasRenderingContext2D,
            xCenter: number,
            yCenter: number,
            radOuter: number,
            radInner: number
        ) {
            if (radOuter < 0 || radInner < 0) {
                return;
            }

            ctx.moveTo(xCenter - radOuter, yCenter);

            ctx.arcTo(
                xCenter - radOuter,
                yCenter - radOuter,
                xCenter + radOuter,
                yCenter - radOuter,
                radOuter
            );

            ctx.arcTo(
                xCenter + radOuter,
                yCenter - radOuter,
                xCenter + radOuter,
                yCenter,
                radOuter
            );

            ctx.lineTo(xCenter + radInner, yCenter);

            ctx.arcTo(
                xCenter + radInner,
                yCenter - radInner,
                xCenter - radInner,
                yCenter - radInner,
                radInner
            );

            ctx.arcTo(
                xCenter - radInner,
                yCenter - radInner,
                xCenter - radInner,
                yCenter,
                radInner
            );

            ctx.lineTo(xCenter - radOuter, yCenter);
        }

        // draw bar
        function arcBar(
            ctx: CanvasRenderingContext2D,
            xCenter: number,
            yCenter: number,
            rad: number
        ) {
            if (rad < 0) {
                return;
            }

            ctx.moveTo(xCenter - rad, yCenter);

            ctx.arcTo(
                xCenter - rad,
                yCenter - rad,

                xCenter + rad,
                yCenter - rad,

                rad
            );

            ctx.arcTo(
                xCenter + rad,
                yCenter - rad,

                xCenter + rad,
                yCenter,

                rad
            );
        }

        function firstTick(n: number) {
            const p = Math.pow(10, Math.floor(Math.log10(n / 6)));
            let f = n / 6 / p;
            let i;
            if (f > 5) {
                i = 10;
            } else if (f > 2) {
                i = 5;
            } else {
                i = 2;
            }
            return i * p;
        }

        const drawGauge = (
            ctx: CanvasRenderingContext2D,
            width: number,
            height: number
        ) => {
            // min
            let min;
            let max;
            let value;
            let threshold;
            let unit;

            try {
                min = evalProperty(flowContext, this, "min");
                max = evalProperty(flowContext, this, "max");
                value = evalProperty(flowContext, this, "data");
                threshold = evalProperty(flowContext, this, "threshold");
                unit = evalProperty(flowContext, this, "unit");
            } catch (err) {
                //console.error(err);
            }

            if (
                !(typeof min == "number") ||
                isNaN(min) ||
                !isFinite(min) ||
                !(typeof max == "number") ||
                isNaN(max) ||
                !isFinite(max) ||
                !(typeof value == "number") ||
                isNaN(value) ||
                !isFinite(value) ||
                min >= max
            ) {
                min = 0;
                max = 1.0;
                value = 0;
            } else {
                if (value < min) {
                    value = min;
                } else if (value > max) {
                    value = max;
                }
            }

            let valueStyle = widget.valueStyle;
            let barStyle = widget.barStyle;
            let ticksStyle = widget.ticksStyle;
            let thresholdStyle = widget.thresholdStyle;

            let w = width;
            let h = height;

            draw.drawBackground(ctx, 0, 0, width, height, this.style, true);

            const PADDING_HORZ = 56;
            const TICK_LINE_LENGTH = 5;
            const TICK_LINE_WIDTH = 1;
            const TICK_TEXT_GAP = 1;
            const THRESHOLD_LINE_WIDTH = 2;

            const xCenter = w / 2;
            const yCenter = h - 8;

            // draw border
            const radBorderOuter = (w - PADDING_HORZ) / 2;

            const BORDER_WIDTH = Math.round(radBorderOuter / 3);
            const BAR_WIDTH = BORDER_WIDTH / 2;

            const radBorderInner = radBorderOuter - BORDER_WIDTH;
            ctx.beginPath();
            ctx.strokeStyle = style.colorProperty;
            ctx.lineWidth = 1.5;
            arcBorder(ctx, xCenter, yCenter, radBorderOuter, radBorderInner);
            ctx.stroke();

            // draw bar
            const radBar = (w - PADDING_HORZ) / 2 - BORDER_WIDTH / 2;
            const angle = remap(value, min, 0.0, max, 180.0);
            ctx.beginPath();
            ctx.strokeStyle = barStyle.colorProperty;
            ctx.lineWidth = BAR_WIDTH;
            ctx.save();
            ctx.setLineDash([
                (radBar * angle * Math.PI) / 180,
                radBar * Math.PI
            ]);
            arcBar(ctx, xCenter, yCenter, radBar);
            ctx.stroke();
            ctx.restore();

            // draw threshold
            const thresholdAngleDeg = remap(threshold, min, 180.0, max, 0);
            if (thresholdAngleDeg >= 0 && thresholdAngleDeg <= 180.0) {
                const tickAngle = (thresholdAngleDeg * Math.PI) / 180;
                const x1 =
                    xCenter + (radBar - BAR_WIDTH / 2) * Math.cos(tickAngle);
                const y1 =
                    yCenter - (radBar - BAR_WIDTH / 2) * Math.sin(tickAngle);

                const x2 =
                    xCenter + (radBar + BAR_WIDTH / 2) * Math.cos(tickAngle);
                const y2 =
                    yCenter - (radBar + BAR_WIDTH / 2) * Math.sin(tickAngle);

                ctx.beginPath();
                ctx.strokeStyle = thresholdStyle.colorProperty;
                ctx.lineWidth = THRESHOLD_LINE_WIDTH;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }

            // draw ticks
            const ticksfont = draw.styleGetFont(ticksStyle);
            const ft = firstTick(max - min);
            const ticksRad = radBorderOuter + 1;
            for (let tickValueIndex = 0; ; tickValueIndex++) {
                const tickValue = roundNumber(min + tickValueIndex * ft, 9);
                if (tickValue > max) {
                    break;
                }
                const tickAngleDeg = remap(tickValue, min, 180.0, max, 0.0);
                if (tickAngleDeg <= 180.0) {
                    const tickAngle = (tickAngleDeg * Math.PI) / 180;
                    const x1 = xCenter + ticksRad * Math.cos(tickAngle);
                    const y1 = yCenter - ticksRad * Math.sin(tickAngle);

                    const x2 =
                        xCenter +
                        (ticksRad + TICK_LINE_LENGTH) * Math.cos(tickAngle);
                    const y2 =
                        yCenter -
                        (ticksRad + TICK_LINE_LENGTH) * Math.sin(tickAngle);

                    ctx.beginPath();
                    ctx.strokeStyle = ticksStyle.colorProperty;
                    ctx.lineWidth = TICK_LINE_WIDTH;
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();

                    if (ticksfont) {
                        const tickText = unit
                            ? `${tickValue} ${unit}`
                            : tickValue.toString();

                        const tickTextWidth = draw.measureStr(
                            tickText,
                            ticksfont,
                            -1
                        );
                        if (tickAngleDeg == 180.0) {
                            draw.drawText(
                                ctx,
                                tickText,
                                xCenter -
                                    radBorderOuter -
                                    TICK_TEXT_GAP -
                                    tickTextWidth,
                                y2 - TICK_TEXT_GAP - ticksfont.ascent,
                                tickTextWidth,
                                ticksfont.ascent,
                                ticksStyle,
                                false
                            );
                        } else if (tickAngleDeg > 90.0) {
                            draw.drawText(
                                ctx,
                                tickText,
                                x2 - TICK_TEXT_GAP - tickTextWidth,
                                y2 - TICK_TEXT_GAP - ticksfont.ascent,
                                tickTextWidth,
                                ticksfont.ascent,
                                ticksStyle,
                                false
                            );
                        } else if (tickAngleDeg == 90.0) {
                            draw.drawText(
                                ctx,
                                tickText,
                                x2 - tickTextWidth / 2,
                                y2 - TICK_TEXT_GAP - ticksfont.ascent,
                                tickTextWidth,
                                ticksfont.ascent,
                                ticksStyle,
                                false
                            );
                        } else if (tickAngleDeg > 0) {
                            draw.drawText(
                                ctx,
                                tickText,
                                x2 + TICK_TEXT_GAP,
                                y2 - TICK_TEXT_GAP - ticksfont.ascent,
                                tickTextWidth,
                                ticksfont.ascent,
                                ticksStyle,
                                false
                            );
                        } else {
                            draw.drawText(
                                ctx,
                                tickText,
                                xCenter + radBorderOuter + TICK_TEXT_GAP,
                                y2 - TICK_TEXT_GAP - ticksfont.ascent,
                                tickTextWidth,
                                ticksfont.ascent,
                                ticksStyle,
                                false
                            );
                        }
                    }
                }
            }

            // draw value
            const font = draw.styleGetFont(valueStyle);
            if (font) {
                const valueText = unit ? `${value} ${unit}` : value.toString();
                const valueTextWidth = draw.measureStr(valueText, font, -1);
                draw.drawText(
                    ctx,
                    valueText,
                    xCenter - valueTextWidth / 2,
                    yCenter - font.height,
                    valueTextWidth,
                    font.height,
                    valueStyle,
                    false
                );
            }
        };

        return (
            <>
                <ComponentCanvas
                    width={width}
                    height={height}
                    component={this}
                    draw={(ctx: CanvasRenderingContext2D) =>
                        drawGauge(ctx, width, height)
                    }
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // min
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));

        // max
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));

        // threshold
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "threshold"));

        // unit
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "unit"));

        // barStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "barStyle"));

        // valueStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "valueStyle"));

        // ticksStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "ticksStyle"));

        // thresholdStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "thresholdStyle"));
    }
}

registerClass("GaugeEmbeddedWidget", GaugeEmbeddedWidget);

////////////////////////////////////////////////////////////////////////////////

export class InputEmbeddedWidget extends Widget {
    inputType: "text" | "number";

    password: boolean;

    min: string;
    max: string;

    precision: string;
    unit: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_INPUT,

        properties: [
            makeDataPropertyInfo("data", {}, "any"),
            {
                name: "inputType",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "number"
                    },
                    {
                        id: "text"
                    }
                ]
            },
            {
                ...makeDataPropertyInfo("min"),
                displayName: (widget: InputEmbeddedWidget) =>
                    widget.inputType === "text" ? "Min (chars)" : "Min"
            },
            {
                ...makeDataPropertyInfo("max"),
                displayName: (widget: InputEmbeddedWidget) =>
                    widget.inputType === "text" ? "Max (chars)" : "Max"
            },
            {
                ...makeDataPropertyInfo("precision"),
                disabled: (widget: InputEmbeddedWidget) =>
                    widget.inputType != "number"
            },
            {
                ...makeDataPropertyInfo("unit"),
                disabled: (widget: InputEmbeddedWidget) =>
                    widget.inputType != "number"
            },
            {
                name: "password",
                type: PropertyType.Boolean,
                disabled: (widget: InputEmbeddedWidget) =>
                    widget.inputType != "text",
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 120,
            height: 40,
            inputType: "number"
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
                <path d="M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3"></path>
                <path d="M6 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3"></path>
                <path d="M13 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-7"></path>
                <path d="M5 7h-1a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h1"></path>
                <path d="M17 12h.01"></path>
                <path d="M13 12h.01"></path>
            </svg>
        ),

        check: (widget: InputEmbeddedWidget, messages: IMessage[]) => {
            if (!widget.data) {
                messages.push(propertyNotSetMessage(widget, "data"));
            }

            if (!widget.min) {
                messages.push(propertyNotSetMessage(widget, "min"));
            }

            if (!widget.max) {
                messages.push(propertyNotSetMessage(widget, "min"));
            }

            if (widget.type === "number") {
                if (!widget.precision) {
                    messages.push(propertyNotSetMessage(widget, "precision"));
                }
            }

            if (widget.type === "number") {
                if (!widget.unit) {
                    messages.push(propertyNotSetMessage(widget, "unit"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            inputType: observable,
            password: observable,
            min: observable,
            max: observable,
            precision: observable,
            unit: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let text;

                        if (flowContext.flowState) {
                            if (this.data) {
                                try {
                                    text = evalProperty(
                                        flowContext,
                                        this,
                                        "data"
                                    );
                                } catch (err) {
                                    //console.error(err);
                                    text = "";
                                }
                            } else {
                                text = "";
                            }
                        } else {
                            text = `{${this.data}}`;
                        }

                        let unit;

                        if (flowContext.flowState) {
                            if (this.unit) {
                                try {
                                    unit = evalProperty(
                                        flowContext,
                                        this,
                                        "unit"
                                    );
                                } catch (err) {
                                    //console.error(err);
                                    unit = "";
                                }
                            } else {
                                unit = "";
                            }
                        } else {
                            unit = "";
                        }

                        draw.drawText(
                            ctx,
                            text + (unit ? " " + unit : ""),
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            false
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // flags
        let flags = 0;

        const INPUT_WIDGET_TYPE_TEXT = 0x0001;
        const INPUT_WIDGET_TYPE_NUMBER = 0x0002;
        const INPUT_WIDGET_PASSWORD_FLAG = 0x0100;

        if (this.inputType === "text") {
            flags |= INPUT_WIDGET_TYPE_TEXT;
            if (this.password) {
                flags |= INPUT_WIDGET_PASSWORD_FLAG;
            }
        } else if (this.inputType === "number") {
            flags |= INPUT_WIDGET_TYPE_NUMBER;
        }

        dataBuffer.writeUint16(flags);

        // min
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));

        // max
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));

        // precision
        dataBuffer.writeInt16(
            this.inputType === "text"
                ? 0
                : assets.getWidgetDataItemIndex(this, "precision")
        );

        // unit
        dataBuffer.writeInt16(
            this.inputType === "text"
                ? 0
                : assets.getWidgetDataItemIndex(this, "unit")
        );

        // component index
        dataBuffer.writeUint16(assets.getComponentIndex(this));
    }
}

registerClass("InputEmbeddedWidget", InputEmbeddedWidget);

////////////////////////////////////////////////////////////////////////////////

export class RollerWidget extends Widget {
    min: string;
    max: string;
    text: string;
    selectedValueStyle: Style;
    unselectedValueStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_ROLLER,

        properties: [
            makeDataPropertyInfo("data", {}, "integer"),
            makeDataPropertyInfo("min"),
            makeDataPropertyInfo("max"),
            makeDataPropertyInfo("text"),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("selectedValueStyle"),
            makeStylePropertyInfo("unselectedValueStyle")
        ],

        beforeLoadHook: (
            widget: RollerWidget,
            jsWidget: Partial<RollerWidget>
        ) => {
            migrateStyleProperty(jsWidget, "selectedValueStyle");
            migrateStyleProperty(jsWidget, "unselectedValueStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 40,
            height: 120
        },

        componentDefaultValue: (projectStore: ProjectStore) => {
            return projectStore.projectTypeTraits.isFirmwareModule ||
                projectStore.projectTypeTraits.isApplet ||
                projectStore.projectTypeTraits.isResource
                ? {
                      style: {
                          useStyle: "default"
                      },
                      selectedValueStyle: {
                          useStyle: "default"
                      },
                      unselectedValueStyle: {
                          useStyle: "default"
                      }
                  }
                : projectStore.projectTypeTraits.isFirmware
                ? {
                      style: {
                          useStyle: "roller"
                      },
                      selectedValueStyle: {
                          useStyle: "roller_selected_value"
                      },
                      unselectedValueStyle: {
                          useStyle: "roller_unselected_value"
                      }
                  }
                : {};
        },

        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M11 6h9"></path>
                <path d="M11 12h9"></path>
                <path d="M12 18h8"></path>
                <path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"></path>
                <path d="M6 10v-6l-2 2"></path>
            </svg>
        )
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            min: observable,
            max: observable,
            text: observable,
            selectedValueStyle: observable,
            unselectedValueStyle: observable
        });
    }

    getInputs() {
        return [
            {
                name: "clear",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            true
                        );

                        const font = draw.styleGetFont(this.selectedValueStyle);
                        if (!font) {
                            return;
                        }

                        const selectedValueHeight =
                            this.selectedValueStyle.borderSizeRect.top +
                            this.selectedValueStyle.paddingRect.top +
                            font.height +
                            this.selectedValueStyle.paddingRect.bottom +
                            this.selectedValueStyle.borderSizeRect.bottom;

                        draw.drawBackground(
                            ctx,
                            0,
                            (height - selectedValueHeight) / 2,
                            width,
                            selectedValueHeight,
                            this.selectedValueStyle,
                            true
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));

        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "text"));

        dataBuffer.writeInt16(assets.getStyleIndex(this, "selectedValueStyle"));
        dataBuffer.writeInt16(
            assets.getStyleIndex(this, "unselectedValueStyle")
        );

        // component index
        dataBuffer.writeUint16(assets.getComponentIndex(this));
    }
}

registerClass("RollerWidget", RollerWidget);

////////////////////////////////////////////////////////////////////////////////

export class SwitchWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_SWITCH,

        properties: [
            makeDataPropertyInfo("data", {}, "boolean"),
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        componentDefaultValue: (projectStore: ProjectStore) => {
            return projectStore.projectTypeTraits.isFirmwareModule ||
                projectStore.projectTypeTraits.isApplet ||
                projectStore.projectTypeTraits.isResource
                ? {
                      style: {
                          useStyle: "default"
                      }
                  }
                : projectStore.projectTypeTraits.isFirmware
                ? {
                      style: {
                          useStyle: "switch"
                      }
                  }
                : {};
        },

        icon: SWITCH_WIDGET_ICON
    });

    override render(flowContext: IFlowContext, width: number, height: number) {
        const enabled = getBooleanValue(flowContext, this, "data", false);

        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let x = this.style.paddingRect.left;
                        let y = this.style.paddingRect.top;
                        let w =
                            width -
                            this.style.paddingRect.left -
                            this.style.paddingRect.right;
                        let h =
                            height -
                            this.style.paddingRect.top -
                            this.style.paddingRect.bottom;

                        draw.setColor(this.style.borderColorProperty);
                        draw.setBackColor(
                            enabled
                                ? this.style.activeBackgroundColorProperty
                                : this.style.backgroundColorProperty
                        );
                        draw.fillRoundedRect(
                            ctx,
                            x,
                            y,
                            x + w - 1,
                            y + h - 1,
                            this.style.borderSizeRect.left,
                            h / 2
                        );

                        h -= 2 * (2 + this.style.borderSizeRect.left);
                        y += 2 + this.style.borderSizeRect.left;

                        if (enabled) {
                            x += w - h - (1 + this.style.borderSizeRect.left);
                        } else {
                            x += 1 + this.style.borderSizeRect.left;
                        }
                        w = h;

                        draw.setBackColor(this.style.colorProperty);
                        draw.fillRoundedRect(
                            ctx,
                            x,
                            y,
                            x + w - 1,
                            y + h - 1,
                            1,
                            h / 2 + 2
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("SwitchWidget", SwitchWidget);

////////////////////////////////////////////////////////////////////////////////

export class SliderWidget extends Widget {
    min: string;
    max: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_SLIDER,

        properties: [
            makeDataPropertyInfo("data", {}, "integer"),
            makeDataPropertyInfo("min"),
            makeDataPropertyInfo("max"),
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 120,
            height: 32
        },

        componentDefaultValue: (projectStore: ProjectStore) => {
            return projectStore.projectTypeTraits.isFirmwareModule ||
                projectStore.projectTypeTraits.isApplet ||
                projectStore.projectTypeTraits.isResource
                ? {
                      style: {
                          useStyle: "default"
                      }
                  }
                : projectStore.projectTypeTraits.isFirmware
                ? {
                      style: {
                          useStyle: "slider"
                      }
                  }
                : {};
        },

        icon: (
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <circle cx="14" cy="6" r="2"></circle>
                <line x1="4" y1="6" x2="12" y2="6"></line>
                <line x1="16" y1="6" x2="20" y2="6"></line>
                <circle cx="8" cy="12" r="2"></circle>
                <line x1="4" y1="12" x2="6" y2="12"></line>
                <line x1="10" y1="12" x2="20" y2="12"></line>
                <circle cx="17" cy="18" r="2"></circle>
                <line x1="4" y1="18" x2="15" y2="18"></line>
                <line x1="19" y1="18" x2="20" y2="18"></line>
            </svg>
        )
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            min: observable,
            max: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        let x = this.style.paddingRect.left;
                        let y = this.style.paddingRect.top;
                        let w =
                            width -
                            this.style.paddingRect.left -
                            this.style.paddingRect.right;
                        let h =
                            height -
                            this.style.paddingRect.top -
                            this.style.paddingRect.bottom;

                        const barX = x + h / 2.0;
                        const barW = w - h;
                        const barH = (h * 8.0) / 20.0;
                        const barY = y + (h - barH) / 2;
                        const barBorderRadius = barH / 2.0;

                        let value = getNumberValue(
                            flowContext,
                            this,
                            "data",
                            0.5
                        );
                        let min = getNumberValue(flowContext, this, "min", 0);
                        let max = getNumberValue(flowContext, this, "max", 1.0);

                        let knobRelativePosition = (value - min) / (max - min);
                        if (knobRelativePosition < 0) knobRelativePosition = 0;
                        if (knobRelativePosition > 1.0)
                            knobRelativePosition = 1.0;

                        const knobPosition =
                            barX + knobRelativePosition * (barW - 1);

                        const knobRadius = h / 2;
                        const knobX = knobPosition;
                        const knobY = y;
                        const knobW = h;
                        const knobH = h;

                        draw.setBackColor(this.style.backgroundColorProperty);
                        draw.fillRoundedRect(
                            ctx,
                            barX - barBorderRadius,
                            barY,
                            barX + barW + barBorderRadius - 1,
                            barY + barH - 1,
                            0,
                            barBorderRadius
                        );

                        draw.setBackColor(this.style.colorProperty);
                        draw.fillRoundedRect(
                            ctx,
                            knobX - knobRadius,
                            knobY,
                            knobX - knobRadius + knobW - 1,
                            knobY + knobH - 1,
                            0,
                            knobRadius
                        );
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "min"));
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "max"));
    }
}

registerClass("SliderWidget", SliderWidget);

////////////////////////////////////////////////////////////////////////////////

export class DropDownListWidget extends Widget {
    options: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        componentPaletteLabel: "Dropdown",

        flowComponentId: WIDGET_TYPE_DROP_DOWN_LIST,

        properties: [
            makeDataPropertyInfo("data", {}, "integer"),
            makeDataPropertyInfo("options"),
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 120,
            height: 32
        },

        componentDefaultValue: (projectStore: ProjectStore) => {
            return projectStore.projectTypeTraits.isFirmwareModule ||
                projectStore.projectTypeTraits.isApplet ||
                projectStore.projectTypeTraits.isResource
                ? {
                      style: {
                          useStyle: "default"
                      }
                  }
                : projectStore.projectTypeTraits.isFirmware
                ? {
                      style: {
                          useStyle: "drop_down_list"
                      }
                  }
                : {};
        },

        icon: (
            <svg viewBox="0 0 1000 1000" fill="currentColor">
                <path d="M258.8 402.9v157.4H990V402.9H258.8zm685.5 111.7H304.5v-66h639.8v66zM258.8 743.1H990V585.7H258.8v157.4zm45.7-111.7h639.8v66H304.5v-66zm-45.7 293.2H990V767.2H258.8v157.4zm45.7-111.7h639.8v66H304.5v-66zm436.7-463.3h198V75.4H10v274.2h731.2zm0-228.5h152.3v182.8H741.2V121.1zM55.7 303.9V121.1h639.8v182.8H55.7zm714.7-113.5h100.1l-50 63.6-50.1-63.6z" />
            </svg>
        ),

        widgetEvents: {
            ON_CHANGE: {
                code: 1,
                paramExpressionType: `struct:${DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME}`,
                oldName: "action"
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            options: observable
        });
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentCanvas
                    component={this}
                    width={width}
                    height={height}
                    draw={(ctx: CanvasRenderingContext2D) => {
                        const { x1, y1, x2, y2 } = draw.drawBackground(
                            ctx,
                            0,
                            0,
                            width,
                            height,
                            this.style,
                            true
                        );

                        const options = getAnyValue(
                            flowContext,
                            this,
                            "options",
                            []
                        );

                        let x = x1;
                        let y = y1;
                        let w = x2 - x1 + 1;
                        let h = y2 - y1 + 1;

                        draw.drawText(
                            ctx,
                            options.length > 0 && typeof options[0] == "string"
                                ? options[0]
                                : "<no options>",
                            x,
                            y,
                            w - h + (2 * h) / 6,
                            h,
                            this.style,
                            false,
                            undefined,
                            true
                        );

                        x += w - h;
                        w = h;

                        x += (2 * h) / 6;
                        y += (4 * h) / 10;
                        w -= (2 * h) / 3;
                        h -= (4 * h) / 5;

                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + w / 2, y + h);
                        ctx.lineTo(x + w, y);
                        ctx.strokeStyle = this.style.colorProperty;
                        ctx.lineWidth = h / 3;
                        ctx.stroke();
                    }}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "options"));
    }
}

registerClass("DropDownListWidget", DropDownListWidget);

////////////////////////////////////////////////////////////////////////////////

export class QRCodeWidget extends Widget {
    errorCorrection: any;

    constructor() {
        super();

        makeObservable(this, {
            errorCorrectionValue: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            errorCorrection: observable
        });
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_QR_CODE,

        properties: [
            makeDataPropertyInfo("data", {
                displayName: "Text"
            }),
            {
                name: "errorCorrection",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "low"
                    },
                    {
                        id: "medium"
                    },
                    {
                        id: "quartile"
                    },
                    {
                        id: "high"
                    }
                ],
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 128,
            height: 128,
            errorCorrection: "medium"
        },

        icon: (
            <svg viewBox="0 0 16 16">
                <path fill="currentColor" d="M6 0H0v6h6V0zM5 5H1V1h4v4z" />
                <path
                    fill="currentColor"
                    d="M2 2h2v2H2V2zM0 16h6v-6H0v6zm1-5h4v4H1v-4z"
                />
                <path
                    fill="currentColor"
                    d="M2 12h2v2H2v-2zm8-12v6h6V0h-6zm5 5h-4V1h4v4z"
                />
                <path
                    fill="currentColor"
                    d="M12 2h2v2h-2V2zM2 7H0v2h3V8H2zm5 2h2v2H7V9zM3 7h2v1H3V7zm6 5H7v1h1v1h1v-1zM6 7v1H5v1h2V7zm2-3h1v2H8V4zm1 4v1h2V7H8v1zM7 6h1v1H7V6zm2 8h2v2H9v-2zm-2 0h1v2H7v-2zm2-3h1v1H9v-1zm0-8V1H8V0H7v4h1V3zm3 11h1v2h-1v-2zm0-2h2v1h-2v-1zm-1 1h1v1h-1v-1zm-1-1h1v1h-1v-1zm4-2v1h1v1h1v-2h-1zm1 3h-1v3h2v-2h-1zm-5-3v1h3V9h-2v1zm2-3v1h2v1h2V7h-2z"
                />
            </svg>
        )
    });

    getText(flowContext: IFlowContext) {
        if (!this.data) {
            return undefined;
        }

        if (flowContext.projectStore.projectTypeTraits.hasFlowSupport) {
            return evalProperty(flowContext, this, "data");
        }

        return this.data;
    }

    get errorCorrectionValue() {
        if (this.errorCorrection == "low") return QRC.Ecc.LOW;
        if (this.errorCorrection == "medium") return QRC.Ecc.MEDIUM;
        if (this.errorCorrection == "quartile") return QRC.Ecc.QUARTILE;
        return QRC.Ecc.HIGH;
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        super.styleHook(style, flowContext);

        style.backgroundColor = to16bitsColor(
            this.style.backgroundColorProperty
        );
    }

    static toSvgString(
        qr: any,
        border: number,
        lightColor: string,
        darkColor: string
    ) {
        let parts: Array<string> = [];
        for (let y = 0; y < qr.size; y++) {
            for (let x = 0; x < qr.size; x++) {
                if (qr.getModule(x, y))
                    parts.push(`M${x + border},${y + border}h1v1h-1z`);
            }
        }
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                viewBox={`0 0 ${qr.size + border * 2} ${qr.size + border * 2}`}
                stroke="none"
                style={{ objectFit: "contain", width: "100%", height: "100%" }}
            >
                <rect width="100%" height="100%" fill={`${lightColor}`} />
                <path d={`${parts.join(" ")}`} fill={`${darkColor}`} />
            </svg>
        );
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const text = this.getText(flowContext) || "";

        const qr0 = QRC.encodeText(text, this.errorCorrectionValue);
        const svg = QRCodeWidget.toSvgString(
            qr0,
            1,
            to16bitsColor(this.style.backgroundColorProperty),
            to16bitsColor(this.style.colorProperty)
        );

        return (
            <>
                {svg}
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        let errorCorrection;
        if (this.errorCorrection == "low") return (errorCorrection = 0);
        if (this.errorCorrection == "medium") return (errorCorrection = 1);
        if (this.errorCorrection == "quartile") return (errorCorrection = 2);
        return 3;
        dataBuffer.writeUint8(errorCorrection);
    }
}

registerClass("QRCodeWidget", QRCodeWidget);
