import React from "react";
import {
    observable,
    reaction,
    makeObservable,
    runInAction,
    autorun,
    IReactionDisposer
} from "mobx";

import {
    registerClass,
    makeDerivedClassInfo,
    PropertyType,
    RectObject,
    ProjectType,
    EezObject,
    ClassInfo,
    getParent,
    MessageType,
    IMessage
} from "project-editor/core/object";

import {
    makeDataPropertyInfo,
    makeExpressionProperty,
    makeStylePropertyInfo,
    migrateStyleProperty,
    Widget
} from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { observer } from "mobx-react";

import type * as PlotlyModule from "plotly.js-dist-min";
import classNames from "classnames";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import {
    evalProperty,
    getAnyValue,
    getNumberValue
} from "project-editor/flow/helper";
import { getChildOfObject, Message, Section } from "project-editor/store";
import {
    buildExpression,
    checkExpression,
    evalConstantExpression
} from "project-editor/flow/expression";
import { humanize } from "eez-studio-shared/string";
import { Assets, DataBuffer } from "project-editor/build/assets";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";
import type { IDashboardComponentContext, ValueType } from "eez-studio-types";
import {
    GAUGE_ICON,
    LINE_CHART_ICON
} from "project-editor/ui-components/icons";
import type { Style } from "project-editor/features/style/style";
import { getThemedColor } from "project-editor/features/style/theme";

////////////////////////////////////////////////////////////////////////////////

let plotlyModule: typeof PlotlyModule;

function Plotly() {
    if (!plotlyModule) {
        plotlyModule =
            require("plotly.js-dist-min/plotly.min.js") as typeof PlotlyModule;
    }
    return plotlyModule;
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// LineChart Widget

interface InputData {
    xValue: number;
    lineValues: number[];
}

class ExecutionState {
    valuesMap: Map<number, number[]>;
    values: InputData[] = [];
    maxPoints: number = 0;
    labels: string[] = [];

    constructor() {
        makeObservable(this, {
            values: observable,
            maxPoints: observable,
            labels: observable
        });
    }
}

const LineChartElement = observer(
    class LineChartElement extends React.Component<{
        widget: LineChartWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        ref = React.createRef<HTMLDivElement>();

        plotly: PlotlyModule.PlotlyHTMLElement | undefined;
        plotlyEl: HTMLDivElement | undefined;
        plotlyWidth: number;
        plotlyHeight: number;

        dispose1: IReactionDisposer | undefined;
        dispose2: IReactionDisposer | undefined;

        get data(): PlotlyModule.Data[] {
            const { widget, flowContext } = this.props;

            const executionState =
                flowContext.flowState?.getComponentExecutionState<ExecutionState>(
                    widget
                );

            return widget.lines.map((line, i) => {
                let name;

                if (executionState) {
                    name = executionState.labels[i];
                } else {
                    try {
                        name = evalConstantExpression(
                            flowContext.projectStore.project,
                            line.label
                        ).value;
                    } catch (err) {
                        name = undefined;
                    }
                }

                return {
                    x: executionState
                        ? executionState.values.map(
                              inputValue => inputValue.xValue
                          )
                        : flowContext.flowState
                        ? []
                        : [1, 2, 3, 4],
                    y: executionState
                        ? executionState.values.map(
                              inputValue => inputValue.lineValues[i]
                          )
                        : flowContext.flowState
                        ? []
                        : [i + 1, (i + 1) * 2, (i + 1) * 3, (i + 1) * 4],
                    type: "scatter",
                    name,
                    showlegend: widget.showLegend,
                    line: {
                        color: line.color
                    }
                };
            });
        }

        get emptyData(): PlotlyModule.Data[] {
            const { widget, flowContext } = this.props;

            const executionState =
                flowContext.flowState?.getComponentExecutionState<ExecutionState>(
                    widget
                );

            return widget.lines.map((line, i) => {
                let name;

                if (executionState) {
                    name = executionState.labels[i];
                } else {
                    try {
                        name = evalConstantExpression(
                            flowContext.projectStore.project,
                            line.label
                        ).value;
                    } catch (err) {
                        name = undefined;
                    }
                }

                return {
                    x: [],
                    y: [],
                    type: "scatter",
                    name,
                    showlegend: widget.showLegend,
                    line: {
                        color: line.color
                    }
                };
            });
        }

        get layout(): Partial<PlotlyModule.Layout> {
            const { widget, flowContext } = this.props;

            let xRange;
            if (this.props.widget.xAxisRangeOption == "fixed") {
                // this is calculated from expression
                const xAxisRangeFrom = getNumberValue(
                    flowContext,
                    widget,
                    "xAxisRangeFrom",
                    0
                );

                // this is calculated from expression
                const xAxisRangeTo = getNumberValue(
                    flowContext,
                    widget,
                    "xAxisRangeTo",
                    4
                );

                xRange = [xAxisRangeFrom, xAxisRangeTo];
            }

            let yRange;
            if (this.props.widget.yAxisRangeOption == "fixed") {
                // this is calculated from expression
                const yAxisRangeFrom = getNumberValue(
                    flowContext,
                    widget,
                    "yAxisRangeFrom",
                    0
                );

                // this is calculated from expression
                const yAxisRangeTo = getNumberValue(
                    flowContext,
                    widget,
                    "yAxisRangeTo",
                    10
                );

                yRange = [yAxisRangeFrom, yAxisRangeTo];
            }

            let shapes: Array<Partial<PlotlyModule.Shape>> | undefined;
            if (this.props.widget.marker) {
                // this is calculated from expression
                let marker = getAnyValue(flowContext, widget, "marker", null);

                if (marker != null) {
                    const color =
                        (widget.markerStyle &&
                            widget.markerStyle.borderColor &&
                            getThemedColor(
                                flowContext.projectStore,
                                widget.markerStyle.borderColor
                            )) ||
                        "black";

                    const width =
                        ((widget.markerStyle &&
                            widget.markerStyle.borderSize) as any as number) ||
                        1;

                    const dash: PlotlyModule.Dash =
                        ((widget.markerStyle &&
                            widget.markerStyle
                                .borderStyle) as PlotlyModule.Dash) || "solid";

                    shapes = [
                        {
                            type: "line",
                            x0: marker,
                            y0: 0,
                            x1: marker,
                            yref: "paper",
                            y1: 100,
                            line: {
                                color,
                                width,
                                dash
                            }
                        }
                    ];
                }
            }

            const bgcolor = widget.style.backgroundColor
                ? getThemedColor(
                      flowContext.projectStore,
                      widget.style.backgroundColor
                  )
                : "white";

            return {
                title: widget.title,
                xaxis: {
                    visible: widget.showXAxis,
                    showgrid: widget.showGrid,
                    zeroline: widget.showZeroLines,
                    range: xRange
                },
                yaxis: {
                    visible: widget.showYAxis,
                    showgrid: widget.showGrid,
                    zeroline: widget.showZeroLines,
                    range: yRange
                },
                shapes,
                margin: {
                    t: widget.margin.top,
                    r: widget.margin.right,
                    b: widget.margin.bottom,
                    l: widget.margin.left
                },
                plot_bgcolor: bgcolor,
                paper_bgcolor: bgcolor
            };
        }

        get config(): Partial<PlotlyModule.Config> {
            return {
                autosizable: false,
                displayModeBar:
                    this.props.widget.displayModebar == "hover"
                        ? "hover"
                        : this.props.widget.displayModebar == "always"
                        ? true
                        : false
            };
        }

        async createChart(el: HTMLDivElement) {
            if (this.dispose1) {
                this.dispose1();
                this.dispose1 = undefined;
            }

            if (this.dispose2) {
                this.dispose2();
                this.dispose2 = undefined;
            }

            if (this.plotlyEl) {
                Plotly().purge(this.plotlyEl);
            }

            this.plotly = await Plotly().newPlot(
                el,
                this.data,
                this.layout,
                this.config
            );
            this.plotlyEl = el;
            this.plotlyWidth = this.props.width;
            this.plotlyHeight = this.props.height;

            this.dispose1 = reaction(
                () => {
                    return {
                        layout: this.layout
                    };
                },
                async params => {
                    this.plotly = await Plotly().react(
                        el,
                        this.data,
                        params.layout,
                        this.config
                    );
                }
            );

            this.dispose2 = autorun(
                () => {
                    const { widget, flowContext } = this.props;

                    const executionState =
                        flowContext.flowState?.getComponentExecutionState<ExecutionState>(
                            widget
                        );
                    if (!executionState) {
                        return;
                    }

                    executionState.values;

                    (async () => {
                        this.plotly = await Plotly().react(
                            el,
                            this.data,
                            this.layout,
                            this.config
                        );
                    })();
                },
                { delay: 16 }
            );
        }

        componentDidMount() {
            if (this.ref.current) {
                this.createChart(this.ref.current);
            }
        }

        async componentDidUpdate() {
            if (this.ref.current) {
                if (
                    !this.plotly ||
                    !this.props.flowContext.flowState ||
                    this.props.width != this.plotlyWidth ||
                    this.props.height != this.plotlyHeight
                ) {
                    this.createChart(this.ref.current);
                } else {
                    this.plotly = await Plotly().react(
                        this.ref.current,
                        this.data,
                        this.layout,
                        this.config
                    );
                }
            }
        }

        componentWillUnmount(): void {
            if (this.plotlyEl) {
                Plotly().purge(this.plotlyEl);
            }

            if (this.dispose1) {
                this.dispose1();
                this.dispose1 = undefined;
            }

            if (this.dispose2) {
                this.dispose2();
                this.dispose2 = undefined;
            }
        }

        render() {
            const { width, height, flowContext } = this.props;

            return (
                <div
                    ref={this.ref}
                    style={{
                        width,
                        height
                    }}
                    className={classNames("EezStudio_Plotly", {
                        interactive: !!flowContext.projectStore.runtime
                    })}
                ></div>
            );
        }
    }
);

class LineChartLine extends EezObject {
    label: string;
    color: string;
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
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText
                },
                "double"
            )
        ],
        check: (lineChartTrace: LineChartLine, messages: IMessage[]) => {
            try {
                checkExpression(
                    getParent(getParent(lineChartTrace)!)! as LineChartWidget,
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
                    getParent(getParent(lineChartTrace)!)! as LineChartWidget,
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
            color: "#333333"
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            label: observable,
            color: observable,
            value: observable
        });
    }
}

export class LineChartWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

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
            {
                name: "title",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "displayModebar",
                displayName: "Display mode bar",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "hover", label: "Hover" },
                    { id: "always", label: "Always" },
                    { id: "never", label: "Never" }
                ],
                propertyGridGroup: specificGroup
            },
            {
                name: "showLegend",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "showXAxis",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "showYAxis",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "showGrid",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "showZeroLines",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "xAxisRangeOption",
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
            makeExpressionProperty(
                {
                    name: "xAxisRangeFrom",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: LineChartWidget) =>
                        widget.xAxisRangeOption != "fixed"
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "xAxisRangeTo",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: LineChartWidget) =>
                        widget.xAxisRangeOption != "fixed"
                },
                "double"
            ),
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
            makeExpressionProperty(
                {
                    name: "yAxisRangeFrom",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: LineChartWidget) =>
                        widget.yAxisRangeOption != "fixed"
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "yAxisRangeTo",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (widget: LineChartWidget) =>
                        widget.yAxisRangeOption != "fixed"
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "maxPoints",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            {
                name: "margin",
                type: PropertyType.Object,
                typeClass: RectObject,
                propertyGridGroup: specificGroup,
                enumerable: false
            },
            makeExpressionProperty(
                {
                    name: "marker",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            makeStylePropertyInfo("style", "Default style"),
            makeStylePropertyInfo("markerStyle", "Marker style")
        ],

        beforeLoadHook: (object: LineChartWidget, jsObject: any) => {
            if (jsObject.xValue == undefined) {
                jsObject.xValue = "Date.now()";
            }

            if (jsObject.lines == undefined) {
                jsObject.lines = [
                    {
                        label: `"${humanize(jsObject.data)}"`,
                        value: jsObject.data
                    }
                ];
                delete jsObject.data;
            }

            if (jsObject.xAxisRangeOption == undefined) {
                jsObject.xAxisRangeOption = "floating";
                jsObject.xAxisRangeFrom = 0;
                jsObject.xAxisRangeTo = 10;
            }

            if (jsObject.yAxisRangeOption == undefined) {
                jsObject.yAxisRangeOption = "floating";
                jsObject.yAxisRangeFrom = 0;
                jsObject.yAxisRangeTo = 10;
            }

            if (jsObject.showLegend == undefined) {
                jsObject.showLegend = true;
            }

            if (jsObject.displayModebar == undefined) {
                jsObject.displayModebar = "hover";
            }

            if (typeof jsObject.maxPoints == "number") {
                jsObject.maxPoints = jsObject.maxPoints.toString();
            }

            if (jsObject.showXAxis == undefined) {
                jsObject.showXAxis = true;
            }

            if (jsObject.showYAxis == undefined) {
                jsObject.showYAxis = true;
            }

            if (jsObject.showGrid == undefined) {
                jsObject.showGrid = true;
            }

            if (jsObject.showZeroLines == undefined) {
                jsObject.showZeroLines = true;
            }

            migrateStyleProperty(jsObject, "markerStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 320,
            height: 160,
            xValue: "Date.now()",
            lines: [],
            title: "",
            showLegend: true,
            displayModebar: "hover",
            showXAxis: true,
            showYAxis: true,
            showGrid: true,
            showZeroLines: true,
            xAxisRangeOption: "floating",
            xAxisRangeFrom: 0,
            xAxisRangeTo: 10,
            yAxisRangeOption: "floating",
            yAxisRangeFrom: 0,
            yAxisRangeTo: 10,
            maxPoints: "40",
            minRange: 0,
            maxRange: 1,
            margin: {
                top: 50,
                right: 0,
                bottom: 50,
                left: 50
            },
            marker: "",
            customInputs: [
                {
                    name: "value",
                    type: "any"
                }
            ]
        },

        icon: LINE_CHART_ICON,

        showTreeCollapseIcon: "never",

        execute: (context: IDashboardComponentContext) => {
            const resetInputValue = context.getInputValue("reset");

            const labels = context.getExpressionListParam(0);

            let executionState =
                context.getComponentExecutionState<ExecutionState>();

            if (!executionState) {
                executionState = new ExecutionState();
                context.setComponentExecutionState(executionState);
            }

            runInAction(() => {
                executionState!.labels = labels;
            });

            if (resetInputValue !== undefined) {
                context.clearInputValue("reset");

                if (executionState.valuesMap) {
                    executionState.valuesMap.clear();
                }

                runInAction(() => {
                    executionState!.values = [];
                });
            } else {
                const maxPoints = context.evalProperty("maxPoints");

                const xValue = context.evalProperty("xValue");
                if (xValue != undefined) {
                    const lineValues = context.getExpressionListParam(8);

                    if (!executionState.valuesMap) {
                        executionState!.valuesMap = new Map();
                    }
                    executionState.valuesMap.set(xValue, lineValues);

                    let xValues = [...executionState.valuesMap.keys()];
                    xValues.sort((a, b) => a - b);
                    while (
                        xValues.length > 0 &&
                        xValues.length > executionState.maxPoints
                    ) {
                        executionState.valuesMap.delete(xValues.shift()!);
                    }

                    let values = xValues.map(xValue => ({
                        xValue,
                        lineValues: executionState!.valuesMap.get(xValue)!
                    }));

                    runInAction(() => {
                        executionState!.maxPoints = maxPoints;
                        executionState!.values = values;
                    });
                }
            }
        }
    });

    xValue: string;
    lines: LineChartLine[];
    title: string;
    displayModebar: "hover" | "always" | "never";
    showLegend: boolean;
    showXAxis: boolean;
    showYAxis: boolean;
    showGrid: boolean;
    showZeroLines: boolean;
    xAxisRangeOption: "floating" | "fixed";
    xAxisRangeFrom: number;
    xAxisRangeTo: number;
    yAxisRangeOption: "floating" | "fixed";
    yAxisRangeFrom: number;
    yAxisRangeTo: number;
    maxPoints: string;
    margin: RectObject;
    marker: string;
    markerStyle: Style;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            xValue: observable,
            lines: observable,
            title: observable,
            displayModebar: observable,
            showLegend: observable,
            showXAxis: observable,
            showYAxis: observable,
            showGrid: observable,
            showZeroLines: observable,
            xAxisRangeOption: observable,
            xAxisRangeFrom: observable,
            xAxisRangeTo: observable,
            yAxisRangeOption: observable,
            yAxisRangeFrom: observable,
            yAxisRangeTo: observable,
            maxPoints: observable,
            margin: observable,
            marker: observable,
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

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <LineChartElement
                    widget={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.lines, line => {
            try {
                // as property
                buildExpression(assets, dataBuffer, this, line.label);
            } catch (err) {
                assets.projectStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(this, "label")
                );

                dataBuffer.writeUint16NonAligned(makeEndInstruction());
            }
        });

        dataBuffer.writeArray(this.lines, line => {
            try {
                // as property
                buildExpression(assets, dataBuffer, this, line.value);
            } catch (err) {
                assets.projectStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(this, "value")
                );

                dataBuffer.writeUint16NonAligned(makeEndInstruction());
            }
        });
    }
}

registerClass("LineChartWidget", LineChartWidget);

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Gauge Widget

const GaugeElement = observer(
    ({
        widget,
        flowContext,
        width,
        height
    }: {
        widget: GaugeWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }) => {
        const ref = React.useRef<HTMLDivElement>(null);
        const [plotly, setPlotly] = React.useState<
            PlotlyModule.PlotlyHTMLElement | undefined
        >();

        function getData(): PlotlyModule.Data[] {
            const minRange = 0;
            const maxRange = 1;

            return [
                {
                    domain: { x: [0, 1], y: [0, 1] },
                    value: flowContext.flowState
                        ? 0
                        : (minRange + maxRange) / 2,
                    title: { text: widget.title },
                    type: "indicator",
                    mode: "gauge+number",
                    gauge: {
                        bar: {
                            color: widget.color
                        },
                        axis: {
                            range: [minRange, maxRange],
                            color: widget.color
                        }
                    },
                    number: {
                        valueformat: "f"
                    }
                }
            ];
        }

        function getLayout(): Partial<PlotlyModule.Layout> {
            return {
                margin: {
                    t: widget.margin.top,
                    r: widget.margin.right,
                    b: widget.margin.bottom,
                    l: widget.margin.left
                }
            };
        }

        function getConfig(): Partial<PlotlyModule.Config> {
            return {
                displayModeBar: false,
                autosizable: false
            };
        }

        React.useEffect(() => {
            let disposed = false;
            let disposeReaction: any;

            const el = ref.current;
            if (el) {
                (async () => {
                    const plotly = await Plotly().newPlot(
                        el,
                        getData(),
                        getLayout(),
                        getConfig()
                    );

                    if (!disposed) {
                        setPlotly(plotly);

                        disposeReaction = autorun(() => {
                            const inputData = flowContext.flowState
                                ? {
                                      value: evalProperty(
                                          flowContext,
                                          widget,
                                          "data"
                                      ),
                                      minRange: evalProperty(
                                          flowContext,
                                          widget,
                                          "minRange"
                                      ),
                                      maxRange: evalProperty(
                                          flowContext,
                                          widget,
                                          "maxRange"
                                      )
                                  }
                                : undefined;

                            if (inputData != undefined) {
                                Plotly().update(
                                    el,
                                    {
                                        value: inputData.value,
                                        gauge: {
                                            bar: {
                                                color: widget.color
                                            },
                                            axis: {
                                                range: [
                                                    inputData.minRange,
                                                    inputData.maxRange
                                                ],
                                                color: widget.color
                                            }
                                        },
                                        number: {
                                            valueformat: "f"
                                        }
                                    },
                                    {}
                                );
                            }
                        });
                    } else {
                        Plotly().purge(el);
                    }
                })();
            }

            return () => {
                if (disposeReaction) {
                    disposeReaction();
                }
                if (el) {
                    Plotly().purge(el);
                }
                disposed = true;
            };
        }, [ref.current]);

        React.useEffect(() => {
            if (plotly) {
                Plotly().Plots.resize(ref.current!);
            }
        }, [plotly, width, height]);

        React.useEffect(() => {
            if (plotly) {
                Plotly().react(plotly, getData(), getLayout(), getConfig());
            }
        }, [
            plotly,
            widget.title,
            widget.color,
            widget.minRange,
            widget.maxRange,
            widget.margin.top,
            widget.margin.right,
            widget.margin.bottom,
            widget.margin.left
        ]);

        return (
            <div
                ref={ref}
                style={{
                    width,
                    height
                }}
                className={classNames("EezStudio_Plotly", {
                    interactive: !!flowContext.projectStore.runtime
                })}
            ></div>
        );
    }
);

export class GaugeWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            makeDataPropertyInfo("data"),
            {
                name: "title",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "minRange",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "maxRange",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            {
                name: "color",
                type: PropertyType.Color,
                propertyGridGroup: specificGroup
            },
            {
                name: "margin",
                type: PropertyType.Object,
                typeClass: RectObject,
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style")
        ],
        defaultValue: {
            left: 0,
            top: 0,
            width: 160,
            height: 160,
            title: "",
            minRange: "0",
            maxRange: "1",
            color: "#008000",
            margin: {
                top: 50,
                right: 0,
                bottom: 0,
                left: 0
            }
        },

        icon: GAUGE_ICON,

        showTreeCollapseIcon: "never",

        beforeLoadHook: (object: GaugeWidget, jsObject: any) => {
            if (typeof jsObject.minRange == "number") {
                jsObject.minRange = jsObject.minRange.toString();
            }
            if (typeof jsObject.maxRange == "number") {
                jsObject.maxRange = jsObject.maxRange.toString();
            }
        },

        execute: (context: IDashboardComponentContext) => {}
    });

    title: string;
    minRange: string;
    maxRange: string;
    color: string;
    margin: RectObject;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            title: observable,
            minRange: observable,
            maxRange: observable,
            color: observable,
            margin: observable
        });
    }

    override render(
        flowContext: IFlowContext,

        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <GaugeElement
                    widget={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("GaugeWidget", GaugeWidget);
