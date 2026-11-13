import React from "react";
import { observable, makeObservable, computed } from "mobx";

import QRC from "../qrcodegen";

import { MenuItem } from "@electron/remote";

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
    getProjectStore,
    IContextMenuContext,
    objectToJS,
    replaceObject,
    createObject,
    getSerializationProjectStore
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
    IFlowContext,
    IResizeHandler
} from "project-editor/flow/flow-interfaces";
import { ComponentEnclosure } from "project-editor/flow/editor/render";

import { Style } from "project-editor/features/style/style";
import {
    DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME,
    ValueType
} from "project-editor/features/variable/value-type";
import * as eezGuiDraw from "project-editor/flow/editor/eez-gui-draw";

import {
    Widget,
    makeDataPropertyInfo,
    makeStylePropertyInfo,
    makeTextPropertyInfo,
    migrateStyleProperty,
    makeExpressionProperty,
    getLayoutParent
} from "project-editor/flow/component";

import { Assets, DataBuffer } from "project-editor/build/assets";
import type { Rect } from "eez-studio-shared/geometry";
import { isTimelineEditorActive } from "project-editor/flow/timeline";
import type { PageLayout } from "project-editor/features/page/page";
import {
    getEditorLayoutPropertyValue,
    getLayoutPropertyValue,
    getLayoutsPage,
    getPageLayouts,
    getWidgetStyleInLayout,
    isLayoutPropertyChanged,
    isWidgetShownInLayout
} from "project-editor/features/page/page-layouts";
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
    WIDGET_TYPE_YT_CHART,
    WIDGET_TYPE_CHECKBOX,
    WIDGET_TYPE_RADIO,
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
    geometryGroup,
    indentationGroup,
    specificGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import {
    evalProperty,
    buildWidgetText,
    getAnyValue
} from "project-editor/flow/helper";
import {
    GAUGE_ICON,
    LINE_CHART_ICON,
    QR_CODE_ICON,
    SWITCH_WIDGET_ICON
} from "project-editor/ui-components/icons";
import { getComponentName } from "project-editor/flow/components/components-registry";
import classNames from "classnames";
import { observer } from "mobx-react";
import { Button } from "eez-studio-ui/button";


const BAR_GRAPH_ORIENTATION_LEFT_RIGHT = 1;
const BAR_GRAPH_ORIENTATION_RIGHT_LEFT = 2;
const BAR_GRAPH_ORIENTATION_TOP_BOTTOM = 3;
const BAR_GRAPH_ORIENTATION_BOTTOM_TOP = 4;
const BAR_GRAPH_DO_NOT_DISPLAY_VALUE = 1 << 4;

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

// A style of a widget state in the EEZ-GUI v1/v2 projects (the disabled style
// of the Button, ...). In the EEZ-GUI v3 projects a widget is drawn in the
// states of its style, the style of the state is a state style (the load turns
// these properties of an older project into state styles, see
// convertEezGuiStateLooksJs in features/style/style.tsx).
function makeOldStateStylePropertyInfo(name: string, displayName?: string) {
    return Object.assign(makeStylePropertyInfo(name, displayName), {
        disabled: isV3OrNewerProject,
        isOptional: isOldStateStyleOptional
    });
}

// Optional in the v3 projects. Also asked while an object is loaded, when a
// widget created on its own (palette, paste, previews) has no project yet:
// then the project of the store it is created in.
function isOldStateStyleOptional(object: IEezObject) {
    const project = getProject(object);
    if (project && project.settings) {
        return isV3OrNewerProject(project);
    }
    const storeProject = getSerializationProjectStore()?.project;
    return storeProject ? isV3OrNewerProject(storeProject) : true;
}

// only the v1/v2 projects have the widget state styles
function migrateOldStateStyleProperty(
    jsObject: any,
    propertyName: string,
    project: Project
) {
    if (isV3OrNewerProject(project)) {
        delete jsObject[propertyName];
    } else {
        migrateStyleProperty(jsObject, propertyName);
    }
}

////////////////////////////////////////////////////////////////////////////////

enum DisplayOption {
    All = 0,
    Integer = 1,
    FractionAndUnit = 2,
    Fraction = 3,
    Unit = 4,
    IntegerAndFraction = 5,
    IntegerUnitAndFraction = 6
}

function findStartOfFraction(text: string) {
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

function findStartOfUnit(text: string) {
    let i;
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

export class DisplayDataWidget extends Widget {
    preview: string;
    focusStyle: Style;
    displayOption: DisplayOption;
    unitAndFractionFont: string;
    refreshRate: string;
    // in a row or column (see Widget.getLayoutFlags)
    fitToContent?: "none" | "width" | "height" | "both";

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

        flowComponentId: WIDGET_TYPE_DISPLAY_DATA,

        properties: [
            makeDataPropertyInfo("data", {}, "any"),
            {
                name: "fitToContent",
                displayName: "Fit to content",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "none", label: "None" },
                    { id: "width", label: "Width" },
                    { id: "height", label: "Height" },
                    { id: "both", label: "Both" }
                ],
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: (widget: DisplayDataWidget) =>
                    !getLayoutParent(widget)
            },
            // shown in the editor instead of the data, not built
            {
                name: "preview",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style"),
            Object.assign(
                makeOldStateStylePropertyInfo("focusStyle", "Focused style"),
                { hideInPropertyGrid: isNotV1Project }
            ),
            {
                name: "displayOption",
                type: PropertyType.Enum,
                enumItems: [
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
                    },
                    {
                        id: DisplayOption.IntegerUnitAndFraction,
                        label: "Integer, unit and fraction"
                    }
                ],
                propertyGridGroup: specificGroup,
                layoutSpecific: true
            },
            {
                name: "unitAndFractionFont",
                displayName: "Unit and fraction font",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "fonts",
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: DisplayDataWidget) =>
                    getEditorLayoutPropertyValue(widget, "displayOption") !=
                    DisplayOption.IntegerUnitAndFraction,
                layoutSpecific: true
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
            migrateOldStateStyleProperty(jsObject, "focusStyle", project);
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

            // The widget's own unit and fraction font is used if the display
            // option is "Integer, unit and fraction". With the page layouts,
            // it is used in the page layouts in which it is not changed.
            const layoutsPage = getLayoutsPage(object);
            if (
                layoutsPage
                    ? getPageLayouts(layoutsPage).some(
                          pageLayout =>
                              isWidgetShownInLayout(object, pageLayout) &&
                              getLayoutPropertyValue(
                                  object,
                                  "displayOption",
                                  pageLayout
                              ) === DisplayOption.IntegerUnitAndFraction &&
                              !isLayoutPropertyChanged(
                                  object,
                                  "unitAndFractionFont",
                                  pageLayout
                              )
                      )
                    : object.displayOption ===
                      DisplayOption.IntegerUnitAndFraction
            ) {
                checkObjectReference(object, "unitAndFractionFont", messages);
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            preview: observable,
            focusStyle: observable,
            displayOption: observable,
            unitAndFractionFont: observable,
            refreshRate: observable,
            fitToContent: observable
        });
    }

    applyDisplayOption(text: string) {
        text = text.toString();

        // display option in the page layout selected in the editor
        const displayOption = getEditorLayoutPropertyValue(
            this,
            "displayOption"
        );

        if (displayOption === DisplayOption.Integer) {
            let i = findStartOfFraction(text);
            text = text.substr(0, i);
        } else if (displayOption === DisplayOption.FractionAndUnit) {
            let i = findStartOfFraction(text);
            text = text.substr(i);
        } else if (displayOption === DisplayOption.Fraction) {
            let i = findStartOfFraction(text);
            let k = findStartOfUnit(text);
            if (i < k) {
                text = text.substring(i, k);
            } else {
                text = ".00";
            }
        } else if (displayOption === DisplayOption.Unit) {
            let i = findStartOfUnit(text);
            text = text.substr(i);
        } else if (displayOption === DisplayOption.IntegerAndFraction) {
            let i = findStartOfUnit(text);
            text = text.substr(0, i);
        }

        if (typeof text === "string") {
            text = text.trim();
        }

        return text;
    }

    // same split as in the firmware, text that is not a number (firmware:
    // value that is not a float) is displayed whole as the integer part
    splitIntegerUnitAndFraction(text: string) {
        let i = findStartOfFraction(text);
        let k = findStartOfUnit(text);

        if (!/[0-9]/.test(text.substring(0, k))) {
            return { integer: text.trim(), unit: "", fraction: "" };
        }

        return {
            integer: text.substring(0, i).trim(),
            unit: text.substring(k).trim(),
            fraction: i < k ? text.substring(i, k).trim() : ".0"
        };
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

        // displayOption, in the page layout which is built
        const displayOption = assets.getPropertyValue(this, "displayOption");
        dataBuffer.writeUint8(displayOption || 0);

        // reserved1
        dataBuffer.writeUint8(0);

        // unitAndFractionFont
        dataBuffer.writeInt16(
            displayOption == DisplayOption.IntegerUnitAndFraction &&
                assets.getPropertyValue(this, "unitAndFractionFont")
                ? assets.getFontIndex(this, "unitAndFractionFont")
                : 0
        );
    }
}

registerClass("DisplayDataWidget", DisplayDataWidget);

////////////////////////////////////////////////////////////////////////////////

type TextWidgetFitToContent = "none" | "width" | "height" | "both";

export class TextWidget extends Widget {
    name: string;
    text?: string;
    preview: string;
    ignoreLuminocity: boolean;
    focusStyle: Style;
    fitToContent: TextWidgetFitToContent;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            // shown in the editor instead of the data, not built
            {
                name: "preview",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                defaultValue: false,
                propertyGridGroup: specificGroup,
                disabled: isV3OrNewerProject
            },
            {
                name: "fitToContent",
                displayName: "Fit to content",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "none", label: "None" },
                    { id: "width", label: "Width" },
                    { id: "height", label: "Height" },
                    { id: "both", label: "Both" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: geometryGroup
            },
            makeStylePropertyInfo("style", "Default style"),
            Object.assign(
                makeOldStateStylePropertyInfo("focusStyle", "Focused style"),
                { enabled: isNotV1Project }
            )
        ],

        setRect: (widget: TextWidget, value: Partial<Rect>) => {
            const projectStore = getProjectStore(widget);

            const props: Partial<Rect> = {};

            const { left, top } = widget.fromRelativePosition(
                value.left ?? widget.rect.left,
                value.top ?? widget.rect.top
            );

            // compare with the values in the page layout selected in the editor
            if (left !== getEditorLayoutPropertyValue(widget, "left")) {
                props.left = left;
            }

            if (top !== getEditorLayoutPropertyValue(widget, "top")) {
                props.top = top;
            }

            if (!widget.isFitToContentWidth) {
                const width = value.width ?? widget.rect.width;
                if (width !== getEditorLayoutPropertyValue(widget, "width")) {
                    props.width = width;
                }
            }

            if (!widget.isFitToContentHeight) {
                const height = value.height ?? widget.rect.height;
                if (
                    height !== getEditorLayoutPropertyValue(widget, "height")
                ) {
                    props.height = height;
                }
            }

            projectStore.updateObject(widget, props);
        },

        updateObjectValueHook: (widget: TextWidget, values: any) => {
            if (
                values.fitToContent == undefined ||
                values.fitToContent == widget.fitToContent
            ) {
                return;
            }

            // Set width/height to the content size for the dimensions that
            // are fitted before or after the change, so the widget doesn't
            // change its size when "Fit to content" is turned off.
            const isFitWidth = (fitToContent: TextWidgetFitToContent) =>
                fitToContent == "width" || fitToContent == "both";
            const isFitHeight = (fitToContent: TextWidgetFitToContent) =>
                fitToContent == "height" || fitToContent == "both";

            // content size and size in the page layout selected in the editor
            const contentSize = widget.contentSize;

            if (
                (isFitWidth(widget.fitToContent) ||
                    isFitWidth(values.fitToContent)) &&
                values.width == undefined &&
                getEditorLayoutPropertyValue(widget, "width") !=
                    contentSize.width
            ) {
                values.width = contentSize.width;
            }

            if (
                (isFitHeight(widget.fitToContent) ||
                    isFitHeight(values.fitToContent)) &&
                values.height == undefined &&
                getEditorLayoutPropertyValue(widget, "height") !=
                    contentSize.height
            ) {
                values.height = contentSize.height;
            }
        },

        beforeLoadHook: (widget: Widget, jsObject: any, project: Project) => {
            if (jsObject.text) {
                if (project.projectTypeTraits.hasFlowSupport) {
                    if (!jsObject.data) {
                        jsObject.data = `"${jsObject.text}"`;
                    }
                    delete jsObject.text;
                }
            }

            migrateOldStateStyleProperty(jsObject, "focusStyle", project);

            if (jsObject.fitToContent == undefined) {
                jsObject.fitToContent = "none";
            }
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            fitToContent: "none"
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

        extendContextMenu: (
            thisObject: Widget,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[],
            editable: boolean
        ): void => {
            TextWidget.classInfo.parentClassInfo!.extendContextMenu!(
                thisObject,
                context,
                objects,
                menuItems,
                editable
            );

            if (editable && objects.length === 1) {
                const object = objects[0];
                if (object instanceof TextWidget) {
                    menuItems.push(
                        new MenuItem({
                            type: "separator"
                        }),
                        new MenuItem({
                            label: "Convert to MultilineText",
                            click: () => {
                                const widget = object.convertToMultilineText();
                                if (widget) {
                                    context.selectObject(widget);
                                }
                            }
                        })
                    );
                }
            }
        },

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
            preview: observable,
            ignoreLuminocity: observable,
            focusStyle: observable,
            fitToContent: observable,
            contentSize: computed
        });
    }

    get isFitToContentWidth() {
        return this.fitToContent == "width" || this.fitToContent == "both";
    }

    get isFitToContentHeight() {
        return this.fitToContent == "height" || this.fitToContent == "both";
    }

    // text displayed in the editor when there is no runtime,
    // must be kept in sync with getTextValue (and the preview in render)
    get editorText(): string {
        if (this.preview) {
            return this.preview;
        }

        const project = ProjectEditor.getProject(this);

        if (project.projectTypeTraits.hasFlowSupport) {
            if (this.data) {
                if (this.name) {
                    return this.name;
                }

                try {
                    const result = evalConstantExpression(project, this.data);
                    if (typeof result.value === "string") {
                        return result.value;
                    }
                } catch (err) {}

                return `{${this.data}}`;
            }

            return this.name || "<no text>";
        }

        if (this.text) {
            return this.text;
        }

        if (this.name) {
            return this.name;
        }

        if (this.data) {
            const result = getProjectStore(this).dataContext.get(this.data);
            return result != undefined ? result.toString() : this.data;
        }

        return "<no text>";
    }

    // in the page layout selected in the editor
    get contentSize() {
        return this.getContentSize(this.layoutStyle);
    }

    // must be kept in sync with TextWidget_autoSize in eez-framework
    getContentSize(style: Style) {
        const border = style.borderSizeRect;
        const padding = style.paddingRect;
        const font = eezGuiDraw.styleGetFont(style);

        let textWidth = 0;
        if (font) {
            eezGuiDraw.setProject(ProjectEditor.getProject(this));

            let text = eezGuiDraw.convertFontTags(this.editorText);
            try {
                text = JSON.parse('"' + text + '"');
            } catch (e) {}

            textWidth = eezGuiDraw.measureStr(text, font, 0);
        }

        return {
            width:
                border.left +
                padding.left +
                textWidth +
                padding.right +
                border.right,
            height:
                border.top +
                padding.top +
                (font ? font.height : 0) +
                padding.bottom +
                border.bottom
        };
    }

    override get componentWidth() {
        if (this.isFitToContentWidth) {
            return this.contentSize.width;
        }
        return super.componentWidth;
    }

    override get componentHeight() {
        if (this.isFitToContentHeight) {
            return this.contentSize.height;
        }
        return super.componentHeight;
    }

    override getRectInPageLayout(pageLayout: PageLayout | undefined): Rect {
        const rect = super.getRectInPageLayout(pageLayout);

        if (this.isFitToContentWidth || this.isFitToContentHeight) {
            const contentSize = this.getContentSize(
                getWidgetStyleInLayout(this, "style", pageLayout)
            );
            if (this.isFitToContentWidth) {
                rect.width = contentSize.width;
            }
            if (this.isFitToContentHeight) {
                rect.height = contentSize.height;
            }
        }

        return rect;
    }

    override getResizeHandlers(): IResizeHandler[] | undefined | false {
        if (isTimelineEditorActive(this)) {
            return [];
        }

        if (this.isFitToContentWidth && this.isFitToContentHeight) {
            return [];
        }

        if (this.isFitToContentWidth) {
            return [
                { x: 50, y: 0, type: "n-resize" },
                { x: 50, y: 100, type: "s-resize" }
            ];
        }

        if (this.isFitToContentHeight) {
            return [
                { x: 0, y: 50, type: "w-resize" },
                { x: 100, y: 50, type: "e-resize" }
            ];
        }

        return super.getResizeHandlers();
    }

    convertToMultilineText() {
        const jsObject = objectToJS(this);

        jsObject.type = "MultilineTextWidget";
        delete jsObject.preview;
        delete jsObject.ignoreLuminocity;
        delete jsObject.focusStyle;
        delete jsObject.fitToContent;

        return replaceObject(
            this,
            createObject<MultilineTextWidget>(
                getProjectStore(this),
                jsObject,
                MultilineTextWidget
            )
        );
    }

    getClassName(flowContext: IFlowContext) {
        return classNames("eez-widget", this.type);
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        super.styleHook(style, flowContext);

        if (this.layoutStyle.alignHorizontalProperty == "left") {
            style.textAlign = "left";
        } else if (this.layoutStyle.alignHorizontalProperty == "center") {
            style.textAlign = "center";
        } else if (this.layoutStyle.alignHorizontalProperty == "right") {
            style.textAlign = "right";
        }
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

        // fitToContent
        if (this.isFitToContentWidth) {
            flags |= 1 << 1;
        }
        if (this.isFitToContentHeight) {
            flags |= 1 << 2;
        }

        dataBuffer.writeInt8(flags);
    }
}

registerClass("TextWidget", TextWidget);

////////////////////////////////////////////////////////////////////////////////

export class MultilineTextWidget extends Widget {
    name: string;
    text?: string;
    firstLineIndent: number;
    hangingIndent: number;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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

            return data;
        }

        return undefined;
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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            makeOldStateStylePropertyInfo("disabledStyle")
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

            migrateOldStateStyleProperty(jsObject, "disabledStyle", project);
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
                      }
                  }
                : projectStore.projectTypeTraits.isFirmware
                ? {
                      style: {
                          useStyle: "button"
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


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // text
        buildWidgetText(assets, dataBuffer, this.text);

        // enabled
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "enabled"));
    }
}

registerClass("ButtonWidget", ButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ToggleButtonWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            makeOldStateStylePropertyInfo("checkedStyle")
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


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // text 1
        buildWidgetText(assets, dataBuffer, this.text1);

        // text 2
        buildWidgetText(assets, dataBuffer, this.text2);
    }
}

registerClass("ToggleButtonWidget", ToggleButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonGroupWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            makeOldStateStylePropertyInfo("selectedStyle")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        beforeLoadHook: (object: IEezObject, jsObject: any, project: Project) => {
            migrateOldStateStyleProperty(jsObject, "selectedStyle", project);
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


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
                ],
                layoutSpecific: true
            },
            {
                name: "displayValue",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                layoutSpecific: true
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

        // orientation, in the page layout which is built
        let orientation: number;
        switch (assets.getPropertyValue(this, "orientation")) {
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

        // displayValue, in the page layout which is built
        if (!assets.getPropertyValue(this, "displayValue")) {
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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

registerClass("YTGraphWidget", YTGraphWidget);

////////////////////////////////////////////////////////////////////////////////

// sampled BB3 module fields of the module project (the fields with a YT history)
function getSampledBB3ModuleFields(object: IEezObject) {
    const bb3ModuleMetadata = ProjectEditor.getProject(object).bb3ModuleMetadata;
    if (!bb3ModuleMetadata) {
        return [];
    }
    return bb3ModuleMetadata.bb3ModuleFields.filter(
        variable =>
            (variable.type == "float" || variable.type == "integer") &&
            variable.bb3ModuleFieldMaxSampleRate != undefined &&
            variable.bb3ModuleFieldMaxSampleRate > 0
    );
}

// bit of a bit field (integer module field) drawn as a digital trace, its YT
// history value is the AND of the samples in bits 0..7 and the OR in bits
// 8..15, so only bits 0..7
const YT_CHART_MAX_BIT = 7;

// YTChartTrace.type, the values are the YT_CHART_TRACE_TYPE_... of the
// framework (yt_chart_widget.h)
const YT_CHART_TRACE_TYPES = [
    // the YT history of the field
    { id: "field", label: "Sampled field", value: 0 },
    // the product of the YT histories of field and field2 (e.g. P = U * I)
    { id: "product", label: "Product of two sampled fields", value: 1 }
];

function isProductTrace(trace: YTChartTrace) {
    return trace.type == "product";
}

function isBitTrace(trace: YTChartTrace) {
    return !isProductTrace(trace) && trace.bit != undefined;
}

class YTChartTrace extends EezObject {
    type: string;
    field: string;
    field2: string;
    bit: number | undefined;
    color: string;
    min: string;
    max: string;
    visible: string;

    static classInfo: ClassInfo = {
        beforeLoadHook: (trace: YTChartTrace, jsObject: any) => {
            // the traces from before the trace types
            if (jsObject.type == undefined) {
                jsObject.type = "field";
            }
        },
        listLabel: (trace: YTChartTrace) =>
            isProductTrace(trace)
                ? `${trace.field || ""} \u00d7 ${trace.field2 || ""}`
                : (trace.field || "") +
                  (isBitTrace(trace) ? ` bit ${trace.bit}` : ""),
        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: YT_CHART_TRACE_TYPES.map(type => ({
                    id: type.id,
                    label: type.label
                }))
            },
            {
                name: "field",
                displayName: "BB3 module field",
                type: PropertyType.Enum,
                enumItems: (trace: YTChartTrace) =>
                    getSampledBB3ModuleFields(trace).map(variable => ({
                        id: variable.name
                    }))
            },
            {
                name: "field2",
                displayName: "Second BB3 module field",
                type: PropertyType.Enum,
                enumItems: (trace: YTChartTrace) =>
                    getSampledBB3ModuleFields(trace).map(variable => ({
                        id: variable.name
                    })),
                disabled: (trace: YTChartTrace) => !isProductTrace(trace)
            },
            {
                name: "bit",
                displayName: `Bit (0 - ${YT_CHART_MAX_BIT}, a digital trace in its own lane)`,
                type: PropertyType.Number,
                isOptional: true,
                disabled: isProductTrace
            },
            {
                name: "color",
                type: PropertyType.Color,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "min",
                    type: PropertyType.MultilineText,
                    disabled: isBitTrace
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "max",
                    type: PropertyType.MultilineText,
                    disabled: isBitTrace
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "visible",
                    type: PropertyType.MultilineText
                },
                "boolean"
            )
        ],
        check: (trace: YTChartTrace, messages: IMessage[]) => {
            if (
                !YT_CHART_TRACE_TYPES.find(type => type.id == trace.type)
            ) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Unknown trace type "${trace.type}"`,
                        getChildOfObject(trace, "type")
                    )
                );
            }

            for (const propertyName of isProductTrace(trace)
                ? ["field", "field2"]
                : ["field"]) {
                const field = (trace as any)[propertyName] as string;
                if (!field) {
                    messages.push(propertyNotSetMessage(trace, propertyName));
                } else if (
                    !getSampledBB3ModuleFields(trace).find(
                        variable => variable.name == field
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `"${field}" is not a sampled BB3 module field (set "Module field max sample rate" of the variable)`,
                            getChildOfObject(trace, propertyName)
                        )
                    );
                }
            }

            if (isBitTrace(trace)) {
                const variable = getSampledBB3ModuleFields(trace).find(
                    variable => variable.name == trace.field
                );
                if (
                    !Number.isInteger(trace.bit) ||
                    trace.bit! < 0 ||
                    trace.bit! > YT_CHART_MAX_BIT
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Bit must be 0 - ${YT_CHART_MAX_BIT}`,
                            getChildOfObject(trace, "bit")
                        )
                    );
                } else if (variable && variable.type != "integer") {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `A bit trace needs an integer BB3 module field (a bit field)`,
                            getChildOfObject(trace, "bit")
                        )
                    );
                }
            }

            const widget = getParent(getParent(trace)!)! as YTChartWidget;
            for (const propertyName of isBitTrace(trace)
                ? ["visible"]
                : ["min", "max", "visible"]) {
                try {
                    checkExpression(widget, (trace as any)[propertyName]);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(trace, propertyName)
                        )
                    );
                }
            }
        },
        defaultValue: {
            type: "field",
            color: "#ffff00",
            min: "0",
            max: "1",
            visible: "true"
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            field: observable,
            field2: observable,
            bit: observable,
            color: observable,
            min: observable,
            max: observable,
            visible: observable
        });
    }
}

// YT graph of any number of sampled BB3 module fields of the module, one value of
// the field YT history (recorded by BB3+ at the slot YT rate) per pixel
// column, in the scroll or the scan mode.
export class YTChartWidget extends Widget {
    traces: YTChartTrace[];
    mode: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (
            projectType: ProjectType,
            projectStore?: ProjectStore
        ) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE &&
            !!projectStore?.project.bb3ModuleMetadata,

        componentPaletteGroupName: "!1Visualiser",

        flowComponentId: WIDGET_TYPE_YT_CHART,

        properties: [
            Object.assign(makeDataPropertyInfo("data"), {
                hideInPropertyGrid: true
            }),
            {
                name: "traces",
                type: PropertyType.Array,
                typeClass: YTChartTrace,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            makeDataPropertyInfo(
                "mode",
                { displayName: "Mode (0 - scroll, 1 - scan)" },
                "integer"
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 320,
            height: 160,
            traces: [],
            mode: "0"
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
                <polyline points="4 12 8 14 12 9 16 13 20 12"></polyline>
            </svg>
        ),

        check: (object: YTChartWidget, messages: IMessage[]) => {
            if (!getProject(object).bb3ModuleMetadata) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        "YTChart widget is supported only in the module projects",
                        object
                    )
                );
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            traces: observable,
            mode: observable
        });
    }


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // mode
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "mode"));

        // component index
        dataBuffer.writeUint16(assets.getComponentIndex(this));
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const bb3ModuleMetadata = assets.projectStore.project.bb3ModuleMetadata;

        const getFieldIndex = (field: string) => {
            const fieldIndex = bb3ModuleMetadata
                ? bb3ModuleMetadata.getBB3ModuleFieldIndex(field)
                : -1;
            return fieldIndex != -1 ? fieldIndex : 0;
        };

        // traces
        dataBuffer.writeArray(this.traces, trace => {
            // fieldIndex
            dataBuffer.writeUint16(getFieldIndex(trace.field));

            // color
            let color = assets.getColorIndexFromColorValue(trace.color);
            if (isNaN(color)) {
                color = 0;
            }
            dataBuffer.writeUint16(color);

            // bit, -1 for a value trace
            dataBuffer.writeInt8(isBitTrace(trace) ? trace.bit! : -1);

            // type
            const type = YT_CHART_TRACE_TYPES.find(
                type => type.id == (trace.type ?? "field")
            );
            dataBuffer.writeUint8(type ? type.value : 0);

            // field2Index
            dataBuffer.writeUint16(
                isProductTrace(trace) ? getFieldIndex(trace.field2) : 0
            );

            // min
            dataBuffer.writeObjectOffset(() =>
                buildExpression(assets, dataBuffer, this, trace.min)
            );

            // max
            dataBuffer.writeObjectOffset(() =>
                buildExpression(assets, dataBuffer, this, trace.max)
            );

            // visible
            dataBuffer.writeObjectOffset(() =>
                buildExpression(assets, dataBuffer, this, trace.visible)
            );
        });
    }
}

registerClass("YTChartWidget", YTChartWidget);

////////////////////////////////////////////////////////////////////////////////

export class UpDownWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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

    defaultValue: string;

    precision: string;
    unit: string;

    info: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
                ...makeDataPropertyInfo("defaultValue"),
                disabled: (widget: InputEmbeddedWidget) =>
                    widget.inputType != "number"
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
                ...makeDataPropertyInfo("info"),
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
                messages.push(propertyNotSetMessage(widget, "max"));
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
            defaultValue: observable,
            precision: observable,
            unit: observable,
            info: observable
        });
    }


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // flags
        let flags = 0;

        const INPUT_WIDGET_TYPE_TEXT = 0x0001;
        const INPUT_WIDGET_TYPE_NUMBER = 0x0002;
        const INPUT_WIDGET_PASSWORD_FLAG = 0x0100;

        // the editor build gives a data that isn't a constant the editor text
        // ({expression}), which only a text input shows as it is
        let isEditorText = false;
        if (assets.editorBuild && this.data) {
            try {
                evalConstantExpression(getProject(this), this.data);
            } catch (err) {
                isEditorText = true;
            }
        }

        if (this.inputType === "text" || isEditorText) {
            flags |= INPUT_WIDGET_TYPE_TEXT;
            if (this.password && !isEditorText) {
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

        // info
        dataBuffer.writeInt16(
            this.inputType === "text"
                ? 0
                : assets.getWidgetDataItemIndex(this, "info"));

        // defaultValue
        dataBuffer.writeInt16(
            this.inputType === "text"
                ? 0
                : assets.getWidgetDataItemIndex(this, "defaultValue"));
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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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

}

registerClass("SwitchWidget", SwitchWidget);

////////////////////////////////////////////////////////////////////////////////

export class CheckboxWidget extends Widget {
    text: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_CHECKBOX,

        properties: [
            makeDataPropertyInfo("data", {}, "boolean"),
            makeDataPropertyInfo("text", {}, "string"),
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 160,
            height: 40
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
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                <path d="M9 12l2 2l4 -4"></path>
            </svg>
        )
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable
        });
    }


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "text"));
    }
}

registerClass("CheckboxWidget", CheckboxWidget);

////////////////////////////////////////////////////////////////////////////////

export class RadioWidget extends Widget {
    value: string;
    text: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_RADIO,

        properties: [
            makeDataPropertyInfo("data"),
            makeDataPropertyInfo("value"),
            makeDataPropertyInfo("text", {}, "string"),
            makeStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 160,
            height: 40
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
                <circle cx="12" cy="12" r="8"></circle>
                <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
            </svg>
        )
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            value: observable,
            text: observable
        });
    }


    buildFlowWidgetSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "value"));
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(this, "text"));
    }
}

registerClass("RadioWidget", RadioWidget);

////////////////////////////////////////////////////////////////////////////////

export class SliderWidget extends Widget {
    min: string;
    max: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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
            projectType !== ProjectType.DASHBOARD &&
            projectType !== ProjectType.EEZ_GUI_LITE,

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

        icon: QR_CODE_ICON
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

        style.backgroundColor = ProjectEditor.getProject(this).toColorBpp(
            this.layoutStyle.backgroundColorProperty
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
            flowContext.projectStore.project.toColorBpp(this.layoutStyle.backgroundColorProperty),
            flowContext.projectStore.project.toColorBpp(this.layoutStyle.colorProperty)
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


