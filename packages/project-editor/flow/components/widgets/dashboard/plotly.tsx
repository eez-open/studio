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
            }

            if (this.dispose2) {
                this.dispose2();
            }

            if (this.plotlyEl) {
                Plotly().purge(this.plotlyEl);
            }

            this.plotly = await newPlotOrReact(
                el,
                this.data,
                this.layout,
                this.config,
                true
            );
            this.plotlyEl = el;

            this.dispose1 = reaction(
                () => {
                    return {
                        layout: this.layout
                    };
                },
                async params => {
                    this.plotly = await newPlotOrReact(
                        el,
                        this.data,
                        params.layout,
                        this.config,
                        false
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

                    const operations = executionState.operations;
                    executionState.operations = [];

                    const indices = this.props.widget.lines.map((_, i) => i);
                    const maxPoints = executionState.maxPoints;

                    (async () => {
                        let inputDataArray: InputData[] = [];

                        function extend() {
                            if (inputDataArray.length == 0) {
                                return;
                            }

                            const update = {
                                x: widget.lines.map(() =>
                                    inputDataArray.map(
                                        inputData => inputData.xValue
                                    )
                                ),
                                y: widget.lines.map((_, i) =>
                                    inputDataArray.map(
                                        inputData => inputData.lineValues[i]
                                    )
                                )
                            };

                            Plotly().extendTraces(
                                el,
                                update,
                                indices,
                                maxPoints
                            );

                            inputDataArray = [];
                        }

                        for (const operation of operations) {
                            if (operation.cmd == "reset") {
                                inputDataArray = [];
                                this.plotly = await newPlotOrReact(
                                    el,
                                    this.emptyData,
                                    this.layout,
                                    this.config,
                                    false
                                );
                            } else {
                                inputDataArray.push(operation.inputData);
                            }
                        }

                        extend();
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
                if (!this.plotly) {
                    this.createChart(this.ref.current);
                } else {
                    this.plotly = await newPlotOrReact(
                        this.ref.current,
                        this.data,
                        this.layout,
                        this.config,
                        false
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
            }

            if (this.dispose2) {
                this.dispose2();
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

class ExecutionState {
    values: InputData[] = [];
    maxPoints: number;
    labels: string[] = [];

    operations: (
        | {
              cmd: "reset";
          }
        | {
              cmd: "extend";
              inputData: InputData;
          }
    )[] = [];

    constructor() {
        makeObservable(this, {
            values: observable,
            maxPoints: observable,
            labels: observable
        });
    }
}

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

    constructor() {
        super();

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
                    hideInPropertyGrid: (widget: LineChartWidget) =>
                        widget.xAxisRangeOption != "fixed"
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "xAxisRangeTo",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LineChartWidget) =>
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
                    hideInPropertyGrid: (widget: LineChartWidget) =>
                        widget.yAxisRangeOption != "fixed"
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "yAxisRangeTo",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LineChartWidget) =>
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
            makeStylePropertyInfo("markerStyle", "Marker")
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

                executionState!.operations = [{ cmd: "reset" }];

                runInAction(() => {
                    executionState!.values = [];
                });
            } else {
                const maxPoints = context.evalProperty("maxPoints");

                const xValue = context.evalProperty("xValue");
                const lineValues = context.getExpressionListParam(8);

                let values = executionState.values.slice();

                if (values.length == maxPoints) {
                    values.shift();
                }

                const inputData = {
                    xValue,
                    lineValues
                };

                values.push(inputData);

                executionState.operations.push({
                    cmd: "extend",
                    inputData: inputData
                });

                runInAction(() => {
                    executionState!.maxPoints = maxPoints;
                    executionState!.values = values;
                });
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

    constructor() {
        super();

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

    render(
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
                    const plotly = await newPlotOrReact(
                        el,
                        getData(),
                        getLayout(),
                        getConfig(),
                        true
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
                                updateGauge(
                                    el,
                                    inputData.value,
                                    inputData.minRange,
                                    inputData.maxRange,
                                    widget.color
                                );
                            }
                        });
                    } else {
                        removeChart(el);
                    }
                })();
            }

            return () => {
                if (disposeReaction) {
                    disposeReaction();
                }
                if (el) {
                    removeChart(el);
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
                newPlotOrReact(
                    plotly,
                    getData(),
                    getLayout(),
                    getConfig(),
                    false
                );
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

    constructor() {
        super();

        makeObservable(this, {
            title: observable,
            minRange: observable,
            maxRange: observable,
            color: observable,
            margin: observable
        });
    }

    render(
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

////////////////////////////////////////////////////////////////////////////////

interface InputData {
    xValue: number;
    lineValues: number[];
}

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

// Creating plotly charts is slow, so do it one at the time.

const newPlotQueue: {
    root: PlotlyModule.Root;
    data: PlotlyModule.Data[];
    layout?: Partial<PlotlyModule.Layout>;
    config?: Partial<PlotlyModule.Config>;
    resolve: (el: PlotlyModule.PlotlyHTMLElement) => void;
    createNewPlot: boolean;
}[] = [];
let doNewPlotTimeoutId: any = undefined;

export function newPlotOrReact(
    root: PlotlyModule.Root,
    data: PlotlyModule.Data[],
    layout: Partial<PlotlyModule.Layout>,
    config: Partial<PlotlyModule.Config>,
    createNewPlot: boolean
): Promise<PlotlyModule.PlotlyHTMLElement> {
    return new Promise<PlotlyModule.PlotlyHTMLElement>(resolve => {
        newPlotQueue.push({
            root,
            data,
            layout,
            config,
            resolve,
            createNewPlot
        });
        if (!doNewPlotTimeoutId) {
            doNewPlotTimeoutId = setTimeout(doNewPlotOrReact);
        }
    });
}

async function doNewPlotOrReact() {
    const { root, data, layout, config, resolve, createNewPlot } =
        newPlotQueue.shift()!;

    if (createNewPlot) {
        resolve(await Plotly().newPlot(root, data, layout, config));
    } else {
        resolve(await Plotly().react(root, data, layout, config));
    }

    if (newPlotQueue.length > 0) {
        setTimeout(doNewPlotOrReact);
    } else {
        doNewPlotTimeoutId = undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

// Updating plotly charts is slow, so do it one at the time.

interface ILineChart {
    type: "lineChart";
    data: {
        x: number[][];
        y: number[][];
    };
}

interface IGauge {
    type: "gauge";
    value: number;
    minRange: number;
    maxRange: number;
    color: string;
}

type IChart = ILineChart | IGauge;

const charts = new Map<HTMLElement, IChart>();
const updateQueue: HTMLElement[] = [];
let doUpdateChartTimeoutId: any = undefined;

function doUpdateChart() {
    doUpdateChartTimeoutId = undefined;

    const el = updateQueue.shift()!;
    const chart = charts.get(el)!;
    charts.delete(el);
    if (chart.type === "lineChart") {
        Plotly().extendTraces(
            el,
            chart.data,
            chart.data.x.map((_, i) => i)
        );
    } else {
        Plotly().update(
            el,
            {
                value: chart.value,
                gauge: {
                    bar: {
                        color: chart.color
                    },
                    axis: {
                        range: [chart.minRange, chart.maxRange],
                        color: chart.color
                    }
                },
                number: {
                    valueformat: "f"
                }
            },
            {}
        );
    }

    if (updateQueue.length > 0) {
        doUpdateChartTimeoutId = setTimeout(doUpdateChart);
    }
}

function updateGauge(
    el: HTMLElement,
    value: number,
    minRange: number,
    maxRange: number,
    color: string
) {
    let chart = charts.get(el) as IGauge | undefined;
    if (!chart) {
        chart = {
            type: "gauge",
            value,
            minRange,
            maxRange,
            color
        };
        charts.set(el, chart);
        updateQueue.push(el);

        if (!doUpdateChartTimeoutId) {
            doUpdateChartTimeoutId = setTimeout(doUpdateChart);
        }
    } else {
        chart.value = value;
        chart.minRange = minRange;
        chart.maxRange = maxRange;
        chart.color = color;
    }
}

function removeChart(el: HTMLElement) {
    if (charts.get(el)) {
        charts.delete(el);
        updateQueue.splice(updateQueue.indexOf(el), 1);
    }

    Plotly().purge(el);

    if (charts.size === 0) {
        if (doUpdateChartTimeoutId) {
            clearTimeout(doUpdateChartTimeoutId);
            doUpdateChartTimeoutId = undefined;
        }
    }
}
