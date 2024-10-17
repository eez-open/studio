import React from "react";
import { observable, makeObservable } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    MessageType,
    PropertyInfo,
    PropertyType,
    findPropertyByNameInClassInfo,
    getProperty,
    makeDerivedClassInfo,
    registerClass
} from "project-editor/core/object";

import { findBitmap, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { LV_EVENT_METER_TICK_LABEL_EVENT } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import {
    checkWidgetTypeLvglVersion,
    getExpressionPropertyData,
    getFlowStateAddressIndex,
    lvglAddObjectFlowCallback
} from "../widget-common";
import {
    createObject,
    getAncestorOfType,
    getChildOfObject,
    getClassInfo,
    Message,
    ProjectStore,
    propertyNotFoundMessage
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { humanize } from "eez-studio-shared/string";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { checkExpression } from "project-editor/flow/expression";
import {
    isFlowProperty,
    makeExpressionProperty
} from "project-editor/flow/component";
import { getThemedColor } from "project-editor/features/style/theme";
import { isValid } from "eez-studio-shared/color";

////////////////////////////////////////////////////////////////////////////////

const LVGL_METER_INDICATOR_TYPES = {
    NEEDLE_IMG: 0,
    NEEDLE_LINE: 1,
    SCALE_LINES: 2,
    ARC: 3
};

export class LVGLMeterIndicator extends EezObject {
    type: keyof typeof LVGL_METER_INDICATOR_TYPES;

    static classInfo: ClassInfo = {
        getClass: function (
            projectStore: ProjectStore,
            object: LVGLMeterIndicator
        ) {
            if (object.type == "NEEDLE_IMG") return LVGLMeterIndicatorNeedleImg;
            else if (object.type == "NEEDLE_LINE")
                return LVGLMeterIndicatorNeedleLine;
            else if (object.type == "SCALE_LINES")
                return LVGLMeterIndicatorScaleLines;
            return LVGLMeterIndicatorArc;
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: Object.keys(LVGL_METER_INDICATOR_TYPES).map(id => ({
                    id
                })),
                enumDisallowUndefined: true,
                hideInPropertyGrid: true
            }
        ],

        newItem: async (object: LVGLMeterIndicator[]) => {
            const project = ProjectEditor.getProject(object);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New LVGL Action",
                    fields: [
                        {
                            name: "type",
                            displayName: "Indicator type",
                            type: "enum",
                            enumItems: Object.keys(
                                LVGL_METER_INDICATOR_TYPES
                            ).map(id => ({
                                id,
                                label:
                                    id == "NEEDLE_IMG"
                                        ? "Needle image"
                                        : humanize(id)
                            }))
                        }
                    ]
                },
                values: {
                    action: "CHANGE_SCREEN"
                },
                dialogContext: project
            });

            const indicatorTypeProperties = {
                type: result.values.type
            };

            let indicatorTypeObject;

            if (result.values.type == "NEEDLE_IMG") {
                indicatorTypeObject = createObject<LVGLMeterIndicatorNeedleImg>(
                    project._store,
                    Object.assign(
                        indicatorTypeProperties,
                        LVGLMeterIndicatorNeedleImg.classInfo.defaultValue
                    ),
                    LVGLMeterIndicatorNeedleImg
                );
            } else if (result.values.type == "NEEDLE_LINE") {
                indicatorTypeObject =
                    createObject<LVGLMeterIndicatorNeedleLine>(
                        project._store,
                        Object.assign(
                            indicatorTypeProperties,
                            LVGLMeterIndicatorNeedleLine.classInfo.defaultValue
                        ),
                        LVGLMeterIndicatorNeedleLine
                    );
            } else if (result.values.type == "SCALE_LINES") {
                indicatorTypeObject =
                    createObject<LVGLMeterIndicatorScaleLines>(
                        project._store,
                        Object.assign(
                            indicatorTypeProperties,
                            LVGLMeterIndicatorScaleLines.classInfo.defaultValue
                        ),
                        LVGLMeterIndicatorScaleLines
                    );
            } else {
                indicatorTypeObject = createObject<LVGLMeterIndicatorArc>(
                    project._store,
                    Object.assign(
                        indicatorTypeProperties,
                        LVGLMeterIndicatorArc.classInfo.defaultValue
                    ),
                    LVGLMeterIndicatorArc
                );
            }

            return indicatorTypeObject;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable
        });
    }

    lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {}

    lvglBuild(build: LVGLBuild) {}
    lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {}

    expressionPropertyBuildTickSpecific(
        build: LVGLBuild,
        propName: string,
        propFullName: string,
        indicatorIndex: number,
        getProp: string,
        setFunc: string
    ) {
        if (getProperty(this, propName + "Type") == "expression") {
            build.line(`{`);
            build.indent();

            const widget = getAncestorOfType<LVGLWidget>(
                this,
                LVGLWidget.classInfo
            )!;

            const objectAccessor = build.getLvglObjectAccessor(widget);

            build.line(`lv_meter_indicator_t *indicator;`);
            build.line("");
            build.line(
                `lv_ll_t *indicators = &((lv_meter_t *)${objectAccessor})->indicator_ll;`
            );
            build.line(`int index = ${indicatorIndex};`);
            build.line(
                `for (indicator = _lv_ll_get_tail(indicators); index > 0 && indicator != NULL; indicator = _lv_ll_get_prev(indicators, indicator), index--);`
            );
            build.line("");
            build.line("if (indicator) {");
            build.indent();
            {
                if (
                    build.assets.projectStore.projectTypeTraits.hasFlowSupport
                ) {
                    let componentIndex = build.assets.getComponentIndex(widget);
                    const propertyIndex =
                        build.assets.getComponentPropertyIndex(
                            widget,
                            propFullName
                        );

                    build.line(
                        `int32_t new_val = evalIntegerProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evaluate ${humanize(
                            propName
                        )} in ${getComponentName(widget.type)} widget");`
                    );
                } else {
                    build.line(
                        `int32_t new_val = ${build.getVariableGetterFunctionName(
                            getProperty(this, propName)
                        )}();`
                    );
                }

                build.line(`int32_t cur_val = indicator->${getProp};`);

                build.line("if (new_val != cur_val) {");
                build.indent();
                build.line(`tick_value_change_obj = ${objectAccessor};`);
                build.line(
                    `${setFunc}(${objectAccessor}, indicator, new_val);`
                );
                build.line(`tick_value_change_obj = NULL;`);
                build.unindent();
                build.line("}");
            }
            build.unindent();
            build.line("}");

            build.unindent();
            build.line(`}`);
        }
    }
}

export class LVGLMeterIndicatorNeedleImg extends LVGLMeterIndicator {
    image: string;
    pivotX: number;
    pivotY: number;
    value: number | string;
    valueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            image: observable,
            pivotX: observable,
            pivotY: observable,
            value: observable,
            valueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "pivotX",
                type: PropertyType.Number
            },
            {
                name: "pivotY",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (
            indicator: LVGLMeterIndicatorNeedleImg,
            collapsed: boolean
        ) => "Needle image",

        defaultValue: {
            pivotX: 0,
            pivotY: 0,
            value: 30,
            valueType: "literal"
        },

        check: (
            indicator: LVGLMeterIndicatorNeedleImg,
            messages: IMessage[]
        ) => {
            if (indicator.image) {
                const bitmap = findBitmap(
                    ProjectEditor.getProject(indicator),
                    indicator.image
                );

                if (!bitmap) {
                    messages.push(propertyNotFoundMessage(indicator, "image"));
                }
            }

            if (indicator.valueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.value as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "value")
                        )
                    );
                }
            }
        }
    });

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const valueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`
        );

        const bitmap = findBitmap(ProjectEditor.getProject(this), this.image);

        const pivotX = this.pivotX;
        const pivotY = this.pivotY;
        const value = this.value;

        if (bitmap && bitmap.image) {
            const bitmapPtr = runtime.getBitmapPtr(bitmap);
            if (bitmapPtr) {
                const indicator = runtime.wasm._lvglMeterAddIndicatorNeedleImg(
                    obj,
                    scale,
                    bitmapPtr,
                    pivotX,
                    pivotY,
                    valueExpr ? 0 : (value as number)
                );

                if (valueExpr) {
                    runtime.wasm._lvglUpdateMeterIndicatorValue(
                        obj,
                        indicator,
                        getFlowStateAddressIndex(runtime),
                        valueExpr.componentIndex,
                        valueExpr.propertyIndex
                    );
                }
            }
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.line(
            `lv_meter_indicator_t *indicator = lv_meter_add_needle_img(obj, scale, ${
                this.image ? `&${build.getImageVariableName(this.image)}` : 0
            }, ${this.pivotX}, ${this.pivotY});`
        );

        if (this.valueType == "literal") {
            build.line(
                `lv_meter_set_indicator_value(obj, indicator, ${this.value});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "value",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_value"
        );
    }
}

registerClass("LVGLMeterIndicatorNeedleImg", LVGLMeterIndicatorNeedleImg);

export class LVGLMeterIndicatorNeedleLine extends LVGLMeterIndicator {
    width: number;
    color: string;
    radiusModifier: number;
    value: number | string;
    valueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            width: observable,
            color: observable,
            radiusModifier: observable,
            value: observable,
            valueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "color",
                type: PropertyType.ThemedColor
            },
            {
                name: "radiusModifier",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (
            indicator: LVGLMeterIndicatorNeedleLine,
            collapsed: boolean
        ) => "Needle line",

        defaultValue: {
            width: 3,
            color: "#0000FF",
            radiusModifier: -28,
            value: 30,
            valueType: "literal"
        },

        check: (
            indicator: LVGLMeterIndicatorNeedleLine,
            messages: IMessage[]
        ) => {
            if (indicator.valueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.value as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "value")
                        )
                    );
                }
            }

            const colorValue = getThemedColor(
                ProjectEditor.getProjectStore(indicator),
                indicator.color
            ).colorValue;

            if (!isValid(colorValue)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `invalid color`,
                        getChildOfObject(indicator, "color")
                    )
                );
            }
        }
    });

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const valueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`
        );

        const indicator = runtime.wasm._lvglMeterAddIndicatorNeedleLine(
            obj,
            scale,
            this.width,
            runtime.getColorNum(this.color),
            this.radiusModifier,
            valueExpr ? 0 : (this.value as number)
        );

        runtime.lvglUpdateColor(this.color, (wasm, colorNum) =>
            wasm._lvglMeterIndicatorNeedleLineSetColor(obj, indicator, colorNum)
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.buildColor(
            this.color,
            () =>
                build.genFileStaticVar(
                    this.objID,
                    "lv_meter_indicator_t *",
                    "indicator"
                ),
            (color, indicatorVar) => {
                build.line(
                    `lv_meter_indicator_t *indicator = lv_meter_add_needle_line(obj, scale, ${this.width}, lv_color_hex(${color}), ${this.radiusModifier});`
                );
                build.assingToFileStaticVar(indicatorVar, "indicator");
            },
            (color, indicatorVar) => {
                build.line(
                    `${indicatorVar}->type_data.needle_line.color = lv_color_hex(${color});`
                );
            }
        );

        if (this.valueType == "literal") {
            build.line(
                `lv_meter_set_indicator_value(obj, indicator, ${this.value});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "value",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_value"
        );
    }
}

registerClass("LVGLMeterIndicatorNeedleLine", LVGLMeterIndicatorNeedleLine);

export class LVGLMeterIndicatorScaleLines extends LVGLMeterIndicator {
    colorStart: string;
    colorEnd: string;
    local: boolean;
    widthModifier: number;

    startValue: number | string;
    startValueType: LVGLPropertyType;

    endValue: number | string;
    endValueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            colorStart: observable,
            colorEnd: observable,
            local: observable,
            widthModifier: observable,
            startValue: observable,
            startValueType: observable,
            endValue: observable,
            endValueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "colorStart",
                type: PropertyType.ThemedColor
            },
            {
                name: "colorEnd",
                type: PropertyType.ThemedColor
            },
            {
                name: "local",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "widthModifier",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "startValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            ),
            ...makeLvglExpressionProperty(
                "endValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (
            indicator: LVGLMeterIndicatorScaleLines,
            collapsed: boolean
        ) => "Scale lines",

        defaultValue: {
            colorStart: "#000000",
            colorEnd: "#a0a0a0",
            local: false,
            widthModifier: 0,
            startValue: 0,
            startValueType: "literal",
            endValue: 30,
            endValueType: "literal"
        },

        check: (
            indicator: LVGLMeterIndicatorScaleLines,
            messages: IMessage[]
        ) => {
            if (indicator.startValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.startValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "startValue")
                        )
                    );
                }
            }

            if (indicator.endValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.endValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "endValue")
                        )
                    );
                }
            }

            const colorStartValue = getThemedColor(
                ProjectEditor.getProjectStore(indicator),
                indicator.colorStart
            ).colorValue;
            if (!isValid(colorStartValue)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `invalid color`,
                        getChildOfObject(indicator, "colorStart")
                    )
                );
            }

            const colorEndValue = getThemedColor(
                ProjectEditor.getProjectStore(indicator),
                indicator.colorEnd
            ).colorValue;

            if (!isValid(colorEndValue)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `invalid color`,
                        getChildOfObject(indicator, "colorEnd")
                    )
                );
            }
        }
    });

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const startValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`
        );

        const endValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`
        );

        const indicator = runtime.wasm._lvglMeterAddIndicatorScaleLines(
            obj,
            scale,
            runtime.getColorNum(this.colorStart),
            runtime.getColorNum(this.colorEnd),
            this.local,
            this.widthModifier,
            startValueExpr ? 0 : (this.startValue as number),
            endValueExpr ? 0 : (this.endValue as number)
        );

        runtime.lvglUpdateColor(this.colorStart, (wasm, colorNum) =>
            wasm._lvglMeterIndicatorScaleLinesSetColorStart(
                obj,
                indicator,
                colorNum
            )
        );

        runtime.lvglUpdateColor(this.colorEnd, (wasm, colorNum) =>
            wasm._lvglMeterIndicatorScaleLinesSetColorEnd(
                obj,
                indicator,
                colorNum
            )
        );

        if (startValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorStartValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                startValueExpr.componentIndex,
                startValueExpr.propertyIndex
            );
        }

        if (endValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorEndValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                endValueExpr.componentIndex,
                endValueExpr.propertyIndex
            );
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.buildColor2(
            this.colorStart,
            this.colorEnd,
            () =>
                build.genFileStaticVar(
                    this.objID,
                    "lv_meter_indicator_t *",
                    "indicator"
                ),
            (colorStart, colorEnd, indicatorVar) => {
                build.line(
                    `lv_meter_indicator_t *indicator = lv_meter_add_scale_lines(obj, scale, lv_color_hex(${colorStart}), lv_color_hex(${colorEnd}), ${this.local}, ${this.widthModifier});`
                );
                build.assingToFileStaticVar(indicatorVar, "indicator");
            },
            (colorStart, colorEnd, indicatorVar) => {
                build.line(
                    `${indicatorVar}->type_data.scale_lines.color_start = lv_color_hex(${colorStart});`
                );
                build.line(
                    `${indicatorVar}->type_data.scale_lines.color_end = lv_color_hex(${colorEnd});`
                );
            }
        );

        if (this.startValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_start_value(obj, indicator, ${this.startValue});`
            );
        }

        if (this.endValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_end_value(obj, indicator, ${this.endValue});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "startValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_start_value"
        );

        this.expressionPropertyBuildTickSpecific(
            build,
            "endValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`,
            indicatorIndex,
            "end_value",
            "lv_meter_set_indicator_end_value"
        );
    }
}

registerClass("LVGLMeterIndicatorScaleLines", LVGLMeterIndicatorScaleLines);

export class LVGLMeterIndicatorArc extends LVGLMeterIndicator {
    width: number;
    color: string;
    radiusModifier: number;

    startValue: number | string;
    startValueType: LVGLPropertyType;

    endValue: number | string;
    endValueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            width: observable,
            color: observable,
            radiusModifier: observable,
            startValue: observable,
            startValueType: observable,
            endValue: observable,
            endValueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "color",
                type: PropertyType.ThemedColor
            },
            {
                name: "radiusModifier",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "startValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            ),
            ...makeLvglExpressionProperty(
                "endValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (indicator: LVGLMeterIndicatorArc, collapsed: boolean) =>
            "Arc",

        defaultValue: {
            width: 2,
            color: "#000000",
            radiusModifier: 0,
            startValue: 0,
            startValueType: "literal",
            endValue: 30,
            endValueType: "literal"
        },

        check: (indicator: LVGLMeterIndicatorArc, messages: IMessage[]) => {
            if (indicator.startValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.startValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "startValue")
                        )
                    );
                }
            }

            if (indicator.endValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.endValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "endValue")
                        )
                    );
                }
            }

            const colorValue = getThemedColor(
                ProjectEditor.getProjectStore(indicator),
                indicator.color
            ).colorValue;
            if (!isValid(colorValue)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `invalid color`,
                        getChildOfObject(indicator, "color")
                    )
                );
            }
        }
    });

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const startValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`
        );

        const endValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`
        );

        const indicator = runtime.wasm._lvglMeterAddIndicatorArc(
            obj,
            scale,
            this.width,
            runtime.getColorNum(this.color),
            this.radiusModifier,
            startValueExpr ? 0 : (this.startValue as number),
            endValueExpr ? 0 : (this.endValue as number)
        );

        runtime.lvglUpdateColor(this.color, (wasm, colorNum) =>
            wasm._lvglMeterIndicatorArcSetColor(obj, indicator, colorNum)
        );

        if (startValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorStartValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                startValueExpr.componentIndex,
                startValueExpr.propertyIndex
            );
        }

        if (endValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorEndValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                endValueExpr.componentIndex,
                endValueExpr.propertyIndex
            );
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.buildColor(
            this.color,
            () =>
                build.genFileStaticVar(
                    this.objID,
                    "lv_meter_indicator_t *",
                    "indicator"
                ),
            (color, indicatorVar) => {
                build.line(
                    `lv_meter_indicator_t *indicator = lv_meter_add_arc(obj, scale, ${this.width}, lv_color_hex(${color}), ${this.radiusModifier});`
                );
                build.assingToFileStaticVar(indicatorVar, "indicator");
            },
            (color, indicatorVar) => {
                build.line(
                    `${indicatorVar}->type_data.arc.color = lv_color_hex(${color});`
                );
            }
        );

        if (this.startValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_start_value(obj, indicator, ${this.startValue});`
            );
        }

        if (this.endValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_end_value(obj, indicator, ${this.endValue});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "startValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_start_value"
        );

        this.expressionPropertyBuildTickSpecific(
            build,
            "endValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`,
            indicatorIndex,
            "end_value",
            "lv_meter_set_indicator_end_value"
        );
    }
}

registerClass("LVGLMeterIndicatorArc", LVGLMeterIndicatorArc);

class LVGLMeterScale extends EezObject {
    minorTickCount: number;
    minorTickLineWidth: number;
    minorTickLength: number;
    minorTickColor: string;

    nthMajor: number;
    majorTickWidth: number;
    majorTickLength: number;
    majorTickColor: string;

    label: string;
    labelGap: number;

    scaleMin: number;
    scaleMax: number;
    scaleAngleRange: number;
    scaleRotation: number;

    indicators: LVGLMeterIndicator[];

    static classInfo: ClassInfo = {
        properties: [
            { name: "scaleMin", type: PropertyType.Number },
            { name: "scaleMax", type: PropertyType.Number },
            { name: "scaleAngleRange", type: PropertyType.Number },
            { name: "scaleRotation", type: PropertyType.Number },

            { name: "minorTickCount", type: PropertyType.Number },
            { name: "minorTickLineWidth", type: PropertyType.Number },
            { name: "minorTickLength", type: PropertyType.Number },
            { name: "minorTickColor", type: PropertyType.ThemedColor },

            {
                name: "nthMajor",
                displayName: "Major tick distance",
                type: PropertyType.Number
            },
            {
                name: "majorTickWidth",
                displayName: "Major tick line width",
                type: PropertyType.Number
            },
            { name: "majorTickLength", type: PropertyType.Number },
            { name: "majorTickColor", type: PropertyType.ThemedColor },

            makeExpressionProperty(
                {
                    name: "label",
                    displayName: "Major tick label",
                    type: PropertyType.MultilineText,
                    disabled: object =>
                        !ProjectEditor.getProject(object).projectTypeTraits
                            .hasFlowSupport
                },
                "string"
            ),
            {
                name: "labelGap",
                displayName: "Major Tick label gap",
                type: PropertyType.Number
            },

            {
                name: "indicators",
                type: PropertyType.Array,
                typeClass: LVGLMeterIndicator,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],

        listLabel: (scale: LVGLMeterScale, collapsed: boolean) => "Scale",

        defaultValue: {
            minorTickCount: 41,
            minorTickLineWidth: 1,
            minorTickLength: 5,
            minorTickColor: "#a0a0a0",

            nthMajor: 8,
            majorTickWidth: 3,
            majorTickLength: 10,
            majorTickColor: "#000000",

            labelGap: 10,

            scaleMin: 0,
            scaleMax: 100,
            scaleAngleRange: 300,
            scaleRotation: 120,

            indicators: [
                Object.assign(
                    {},
                    { type: "NEEDLE_LINE" },
                    LVGLMeterIndicatorNeedleLine.classInfo.defaultValue
                )
            ]
        },

        check: (scale: LVGLMeterScale, messages: IMessage[]) => {
            if (
                ProjectEditor.getProject(scale).projectTypeTraits
                    .hasFlowSupport &&
                scale.label
            ) {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        scale,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, scale.label);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(scale, "label")
                        )
                    );
                }
            }

            const minorTickColorValue = getThemedColor(
                ProjectEditor.getProjectStore(scale),
                scale.minorTickColor
            ).colorValue;
            if (!isValid(minorTickColorValue)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `invalid color`,
                        getChildOfObject(scale, "minorTickColor")
                    )
                );
            }

            const majorTickColorValue = getThemedColor(
                ProjectEditor.getProjectStore(scale),
                scale.majorTickColor
            ).colorValue;
            if (!isValid(majorTickColorValue)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `invalid color`,
                        getChildOfObject(scale, "majorTickColor")
                    )
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            minorTickCount: observable,
            minorTickLineWidth: observable,
            minorTickLength: observable,
            minorTickColor: observable,

            nthMajor: observable,
            majorTickWidth: observable,
            majorTickLength: observable,
            majorTickColor: observable,

            label: observable,
            labelGap: observable,

            scaleMin: observable,
            scaleMax: observable,
            scaleAngleRange: observable,
            scaleRotation: observable
        });
    }
}

export class LVGLMeterWidget extends LVGLWidget {
    scales: LVGLMeterScale[];

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "8.3"),

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "scales",
                type: PropertyType.Array,
                typeClass: LVGLMeterScale,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 180,
            clickableFlag: true,
            scales: [Object.assign({}, LVGLMeterScale.classInfo.defaultValue)]
        },

        icon: (
            <svg viewBox="0 0 32 32" fill="currentColor">
                <path d="M26 16a9.9283 9.9283 0 0 0-1.1392-4.6182l-1.4961 1.4961A7.9483 7.9483 0 0 1 24 16Zm-2.5859-6L22 8.5859l-4.7147 4.7147A2.9659 2.9659 0 0 0 16 13a3 3 0 1 0 3 3 2.9659 2.9659 0 0 0-.3006-1.2853ZM16 17a1 1 0 1 1 1-1 1.0013 1.0013 0 0 1-1 1Zm0-9a7.9515 7.9515 0 0 1 3.1223.6353l1.4961-1.4961A9.9864 9.9864 0 0 0 6 16h2a8.0092 8.0092 0 0 1 8-8Z" />
                <path d="M16 30a14 14 0 1 1 14-14 14.0158 14.0158 0 0 1-14 14Zm0-26a12 12 0 1 0 12 12A12.0137 12.0137 0 0 0 16 4Z" />
                <path
                    data-name="&lt;Transparent Rectangle&gt;"
                    fill="none"
                    d="M0 0h32v32H0z"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "TICKS", "INDICATOR", "ITEMS"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        },

        getAdditionalFlowProperties: (widget: LVGLMeterWidget) => {
            const properties: PropertyInfo[] = [];
            for (
                let scaleIndex = 0;
                scaleIndex < widget.scales.length;
                scaleIndex++
            ) {
                const scale = widget.scales[scaleIndex];

                if (
                    ProjectEditor.getProject(widget).projectTypeTraits
                        .hasFlowSupport &&
                    scale.label
                ) {
                    properties.push(
                        Object.assign(
                            {},
                            findPropertyByNameInClassInfo(
                                LVGLMeterScale.classInfo,
                                "label"
                            ),
                            {
                                name: `scales[${scaleIndex}].label`
                            }
                        )
                    );
                }

                for (
                    let indicatorIndex = 0;
                    indicatorIndex < scale.indicators.length;
                    indicatorIndex++
                ) {
                    const indicator = scale.indicators[indicatorIndex];
                    const classInfo = getClassInfo(indicator);
                    const flowProperties = classInfo.properties.filter(
                        propertyInfo =>
                            isFlowProperty(indicator, propertyInfo, [
                                "input",
                                "template-literal",
                                "assignable"
                            ])
                    );
                    flowProperties.forEach(flowProperty =>
                        properties.push(
                            Object.assign({}, flowProperty, {
                                name: `scales[${scaleIndex}].indicators[${indicatorIndex}].${flowProperty.name}`
                            })
                        )
                    );
                }
            }
            return properties;
        },

        check: (widget, messages) =>
            checkWidgetTypeLvglVersion(widget, messages, "8.3")
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            scales: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateMeter(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );

        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            const scaleObj = runtime.wasm._lvglMeterAddScale(
                obj,

                Math.max(scale.minorTickCount, 2),
                scale.minorTickLineWidth,
                scale.minorTickLength,
                runtime.getColorNum(scale.minorTickColor),

                scale.nthMajor,
                scale.majorTickWidth,
                scale.majorTickLength,
                runtime.getColorNum(scale.majorTickColor),

                scale.labelGap,

                scale.scaleMin,
                scale.scaleMax,
                scale.scaleAngleRange,
                scale.scaleRotation
            );

            runtime.lvglUpdateColor(scale.minorTickColor, (wasm, colorNum) =>
                wasm._lvglMeterScaleSetMinorTickColor(obj, scaleObj, colorNum)
            );

            runtime.lvglUpdateColor(scale.majorTickColor, (wasm, colorNum) =>
                wasm._lvglMeterScaleSetMajorTickColor(obj, scaleObj, colorNum)
            );

            for (
                let indicatorIndex = 0;
                indicatorIndex < scale.indicators.length;
                indicatorIndex++
            ) {
                const indicator = scale.indicators[indicatorIndex];

                indicator.lvglCreateObj(
                    runtime,
                    obj,
                    scaleObj,
                    scaleIndex,
                    indicatorIndex
                );
            }
        }

        return obj;
    }

    override get hasEventHandler() {
        if (super.hasEventHandler) {
            return true;
        }

        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];
            if (
                ProjectEditor.getProject(this).projectTypeTraits
                    .hasFlowSupport &&
                scale.label
            ) {
                return true;
            }
        }

        return false;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            if (
                ProjectEditor.getProject(this).projectTypeTraits
                    .hasFlowSupport &&
                scale.label
            ) {
                const labelExpr = getExpressionPropertyData(
                    runtime,
                    this,
                    `scales[${scaleIndex}].label`
                );

                if (labelExpr) {
                    lvglAddObjectFlowCallback(
                        runtime,
                        obj,
                        LV_EVENT_METER_TICK_LABEL_EVENT,
                        labelExpr.componentIndex,
                        labelExpr.propertyIndex,
                        0
                    );
                }
            }
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_meter_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            build.line("{");
            build.indent();

            build.line(`lv_meter_scale_t *scale = lv_meter_add_scale(obj);`);

            build.buildColor2(
                scale.minorTickColor,
                scale.majorTickColor,
                () =>
                    build.genFileStaticVar(
                        scale.objID,
                        "lv_meter_scale_t *",
                        "scale"
                    ),
                (minorTickColor, majorTickColor, scaleVar) => {
                    build.assingToFileStaticVar(scaleVar, "scale");

                    build.line(
                        `lv_meter_set_scale_ticks(obj, scale, ${Math.max(
                            scale.minorTickCount,
                            2
                        )}, ${scale.minorTickLineWidth}, ${
                            scale.minorTickLength
                        }, lv_color_hex(${minorTickColor}));`
                    );

                    build.line(
                        `lv_meter_set_scale_major_ticks(obj, scale, ${scale.nthMajor}, ${scale.majorTickWidth}, ${scale.majorTickLength}, lv_color_hex(${majorTickColor}), ${scale.labelGap});`
                    );
                },
                (minorTickColor, majorTickColor, scaleVar) => {
                    build.line(
                        `${scaleVar}->tick_color = lv_color_hex(${minorTickColor});`
                    );
                    build.line(
                        `${scaleVar}->tick_major_color = lv_color_hex(${majorTickColor});`
                    );
                }
            );

            build.line(
                `lv_meter_set_scale_range(obj, scale, ${scale.scaleMin}, ${scale.scaleMax}, ${scale.scaleAngleRange}, ${scale.scaleRotation});`
            );

            for (
                let indicatorIndex = 0;
                indicatorIndex < scale.indicators.length;
                indicatorIndex++
            ) {
                const indicator = scale.indicators[indicatorIndex];

                build.line("{");
                build.indent();

                indicator.lvglBuild(build);

                build.unindent();
                build.line("}");
            }

            build.unindent();
            build.line("}");
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];
            for (
                let indicatorIndex = 0;
                indicatorIndex < scale.indicators.length;
                indicatorIndex++
            ) {
                const indicator = scale.indicators[indicatorIndex];
                indicator.lvglBuildTickSpecific(
                    build,
                    scaleIndex,
                    indicatorIndex
                );
            }
        }
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            if (build.project.projectTypeTraits.hasFlowSupport && scale.label) {
                build.line("if (event == LV_EVENT_DRAW_PART_BEGIN) {");
                build.indent();

                build.line(
                    `lv_obj_draw_part_dsc_t *draw_part_dsc = lv_event_get_draw_part_dsc(e);`
                );
                build.line(
                    `if (draw_part_dsc->class_p != &lv_meter_class) return;`
                );
                build.line(
                    `if (draw_part_dsc->type != LV_METER_DRAW_PART_TICK) return;`
                );

                build.line(`const char *temp;`);
                build.line(`g_eezFlowLvlgMeterTickIndex = draw_part_dsc->id;`);

                const componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    `scales[${scaleIndex}].label`
                );

                build.line(
                    `temp = evalTextProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evalute scale label in Meter widget");`
                );

                build.line(`if (temp) {`);
                build.indent();
                build.line(`static char label[32];`);
                build.line(`strncpy(label, temp, sizeof(label));`);
                build.line(`label[sizeof(label) - 1] = 0;`);
                build.line(`draw_part_dsc->text = label;`);
                build.line(`draw_part_dsc->text_length = sizeof(label);`);
                build.unindent();
                build.line("}");

                build.unindent();
                build.line("}");
            }
        }
    }
}
