import React from "react";
import { observable, reaction, makeObservable, runInAction } from "mobx";

import {
    registerClass,
    makeDerivedClassInfo,
    PropertyType,
    RectObject,
    ProjectType,
    EezObject,
    ClassInfo,
    getParent,
    MessageType
} from "project-editor/core/object";

import {
    makeDataPropertyInfo,
    makeExpressionProperty,
    Widget
} from "project-editor/flow/component";
import { IFlowContext, IFlowState } from "project-editor/flow/flow-interfaces";
import { observer } from "mobx-react";

import type * as PlotlyModule from "plotly.js-dist-min";
import classNames from "classnames";
import { specificGroup } from "project-editor/components/PropertyGrid/groups";
import { evalProperty, getNumberValue } from "project-editor/flow/helper";
import { getChildOfObject, Message, Section } from "project-editor/store";
import {
    buildExpression,
    checkExpression,
    evalConstantExpression
} from "project-editor/flow/expression";
import { humanize } from "eez-studio-shared/string";
import { Assets, DataBuffer } from "project-editor/build/assets";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";
import { ValueType } from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

const LineChartElement = observer(
    ({
        widget,
        flowContext,
        width,
        height
    }: {
        widget: LineChartWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }) => {
        const runningState =
            flowContext.flowState?.getComponentRunningState<RunningState>(
                widget
            );

        const ref = React.useRef<HTMLDivElement>(null);
        const [plotly, setPlotly] = React.useState<
            PlotlyModule.PlotlyHTMLElement | undefined
        >();

        function getData(): PlotlyModule.Data[] {
            return widget.lines.map((line, i) => {
                let name;

                if (runningState) {
                    name = runningState.labels[i];
                } else {
                    try {
                        name = evalConstantExpression(
                            flowContext.DocumentStore.project,
                            line.label
                        ).value;
                    } catch (err) {
                        name = undefined;
                    }
                }

                return {
                    x: runningState
                        ? runningState.values.map(
                              inputValue => inputValue.xValue
                          )
                        : flowContext.flowState
                        ? []
                        : [1, 2, 3, 4],
                    y: runningState
                        ? runningState.values.map(
                              inputValue => inputValue.lineValues[i]
                          )
                        : flowContext.flowState
                        ? []
                        : [i + 1, (i + 1) * 2, (i + 1) * 3, (i + 1) * 4],
                    type: "scatter",
                    name,
                    line: {
                        color: line.color
                    }
                };
            });
        }

        function getLayout(): Partial<PlotlyModule.Layout> {
            let range;
            if (widget.yAxisRangeOption == "fixed") {
                const yAxisRangeFrom = getNumberValue(
                    flowContext,
                    widget,
                    "yAxisRangeFrom",
                    0
                );
                const yAxisRangeTo = getNumberValue(
                    flowContext,
                    widget,
                    "yAxisRangeTo",
                    10
                );
                range = [yAxisRangeFrom, yAxisRangeTo];
            }

            return {
                title: widget.title,
                yaxis: {
                    range
                },
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

                        disposeReaction = reaction(
                            () => {
                                let runningState;
                                if (flowContext.flowState) {
                                    runningState =
                                        flowContext.flowState.getComponentRunningState<RunningState>(
                                            widget
                                        );
                                }
                                return runningState
                                    ? runningState.values[
                                          runningState.values.length - 1
                                      ]
                                    : undefined;
                            },
                            inputData => {
                                if (inputData !== undefined) {
                                    updateLineChart(
                                        el,
                                        inputData,
                                        widget.maxPoints
                                    );
                                }
                            }
                        );
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
            widget.yAxisRangeOption,
            widget.yAxisRangeOption == "fixed"
                ? getNumberValue(flowContext, widget, "yAxisRangeFrom", 0)
                : undefined,
            widget.yAxisRangeOption == "fixed"
                ? getNumberValue(flowContext, widget, "yAxisRangeTo", 10)
                : undefined,
            widget.margin.top,
            widget.margin.right,
            widget.margin.bottom,
            widget.margin.left,
            widget.lines
                .map(line => `${line.label},${line.value},${line.color}`)
                .join("/"),
            runningState
        ]);

        return (
            <div
                ref={ref}
                style={{
                    width,
                    height
                }}
                className={classNames("EezStudio_Plotly", {
                    interactive: !!flowContext.DocumentStore.runtime
                })}
            ></div>
        );
    }
);

class RunningState {
    values: InputData[] = [];
    labels: string[] = [];

    constructor() {
        makeObservable(this, {
            values: observable,
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
        check: (lineChartTrace: LineChartLine) => {
            let messages: Message[] = [];

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

            return messages;
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
            }
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

            if (jsObject.yAxisRangeOption == undefined) {
                jsObject.yAxisRangeOption = "floating";
                jsObject.yAxisRangeFrom = 0;
                jsObject.yAxisRangeTo = 10;
            }
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 320,
            height: 160,
            xValue: "Date.now()",
            lines: [],
            title: "",
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
            customInputs: [
                {
                    name: "value",
                    type: "any"
                }
            ]
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1024.0009765625 1024"
            >
                <path d="M128 896h896v128H0V0h128zm160-64c-53.02 0-96-42.98-96-96s42.98-96 96-96c2.828 0 5.622.148 8.388.386L399.58 468.4c-9.84-15.07-15.58-33.062-15.58-52.402 0-53.02 42.98-96 96-96s96 42.98 96 96c0 19.342-5.74 37.332-15.58 52.402l103.192 171.986A97.727 97.727 0 0 1 672 640c2.136 0 4.248.094 6.35.23l170.357-298.122c-10.536-15.408-16.706-34.036-16.706-54.11 0-53.02 42.98-96 96-96s96 42.98 96 96-42.98 96-96 96c-2.14 0-4.248-.094-6.35-.232L751.294 681.89C761.83 697.296 768 715.926 768 736c0 53.02-42.98 96-96 96s-96-42.98-96-96c0-19.34 5.74-37.332 15.578-52.402l-103.19-171.984c-2.766.238-5.56.386-8.388.386s-5.622-.146-8.388-.386L368.42 683.6C378.26 698.668 384 716.66 384 736c0 53.02-42.98 96-96 96z" />
            </svg>
        ),

        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD
    });

    xValue: string;
    lines: LineChartLine[];
    title: string;
    yAxisRangeOption: "floating" | "fixed";
    yAxisRangeFrom: number;
    yAxisRangeTo: number;
    maxPoints: number;
    margin: RectObject;

    constructor() {
        super();

        makeObservable(this, {
            xValue: observable,
            lines: observable,
            title: observable,
            yAxisRangeOption: observable,
            yAxisRangeFrom: observable,
            yAxisRangeTo: observable,
            maxPoints: observable,
            margin: observable
        });
    }

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "reset",
                type: "any" as ValueType,
                isSequenceInput: false,
                isOptionalInput: true
            }
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
            buildExpression(assets, dataBuffer, this, line.label);

            try {
                // as property
                buildExpression(assets, dataBuffer, this, line.label);
            } catch (err) {
                assets.DocumentStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(this, "label")
                );

                dataBuffer.writeUint16NonAligned(makeEndInstruction());
            }
        });

        dataBuffer.writeArray(this.lines, line => {
            buildExpression(assets, dataBuffer, this, line.value);

            try {
                // as property
                buildExpression(assets, dataBuffer, this, line.value);
            } catch (err) {
                assets.DocumentStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(this, "value")
                );

                dataBuffer.writeUint16NonAligned(makeEndInstruction());
            }
        });
    }

    onWasmWorkerMessage(flowState: IFlowState, message: any) {
        runInAction(() => {
            let runningState =
                flowState.getComponentRunningState<RunningState>(this);

            if (!runningState) {
                runningState = new RunningState();
                flowState.setComponentRunningState(this, runningState);
            }

            if (message.reset) {
                const newRunningState = new RunningState();
                newRunningState.labels = runningState.labels;
                flowState.setComponentRunningState(this, newRunningState);
            } else {
                const { xValue, labels, values } = message;

                runningState.labels = labels;

                runningState.values.push({
                    xValue,
                    lineValues: values
                });

                if (runningState.values.length == this.maxPoints) {
                    runningState.values.shift();
                }
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
            return [
                {
                    domain: { x: [0, 1], y: [0, 1] },
                    value: flowContext.flowState
                        ? 0
                        : (widget.minRange + widget.maxRange) / 2,
                    title: { text: widget.title },
                    type: "indicator",
                    mode: "gauge+number",
                    gauge: {
                        bar: {
                            color: widget.color
                        },
                        axis: {
                            range: [widget.minRange, widget.maxRange],
                            color: widget.color
                        }
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

                        disposeReaction = reaction(
                            () => {
                                return flowContext.flowState
                                    ? evalProperty(flowContext, widget, "data")
                                    : undefined;
                            },
                            inputData => {
                                updateGauge(el, inputData);
                            }
                        );
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
                    interactive: !!flowContext.DocumentStore.runtime
                })}
            ></div>
        );
    }
);

export class GaugeWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "title",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "minRange",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "maxRange",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
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
            }
        ],
        defaultValue: {
            left: 0,
            top: 0,
            width: 160,
            height: 160,
            title: "",
            minRange: 0,
            maxRange: 1,
            margin: {
                top: 50,
                right: 0,
                bottom: 0,
                left: 0
            }
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1000 678.666015625"
            >
                <path d="M406 509.333c22.667-37.333 94-132 214-284S804.667 0 814 5.333c8 4-24 96.667-96 278s-118 290-138 326c-33.333 57.333-78.667 69.333-136 36s-70-78.667-38-136m94-380c-112 0-206.667 42.333-284 127s-116 188.333-116 311c0 20 .667 35.333 2 46 1.333 14.667-2.667 27-12 37s-20.667 15.667-34 17c-13.333 1.333-25.333-2.667-36-12-10.667-9.333-16.667-20.667-18-34 0-5.333-.333-14-1-26s-1-21.333-1-28c0-150.667 48.333-278 145-382s215-156 355-156c48 0 92.667 6 134 18l-70 86c-26.667-2.667-48-4-64-4m362 62c92 102.667 138 228 138 376 0 25.333-.667 44-2 56-1.333 13.333-6.667 24.333-16 33-9.333 8.667-20.667 13-34 13h-4c-14.667-2.667-26.333-9.333-35-20-8.667-10.667-12.333-22.667-11-36 1.333-9.333 2-24.667 2-46 0-100-26.667-189.333-80-268 4-9.333 10.667-26.333 20-51s16.667-43.667 22-57" />
            </svg>
        ),

        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD
    });

    title: string;
    minRange: number;
    maxRange: number;
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
    lineValues: any[];
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
    maxPoints: number;
}

interface IGauge {
    type: "gauge";
    value: number;
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
            chart.data.x.map((_, i) => i),
            chart.maxPoints
        );
    } else {
        Plotly().update(el, { value: chart.value }, {});
    }

    if (updateQueue.length > 0) {
        doUpdateChartTimeoutId = setTimeout(doUpdateChart);
    }
}

function updateLineChart(
    el: HTMLElement,
    inputValue: InputData,
    maxPoints: number
) {
    let chart = charts.get(el) as ILineChart | undefined;
    if (!chart) {
        chart = {
            type: "lineChart",
            data: {
                x: inputValue.lineValues.map(() => [inputValue.xValue]),
                y: inputValue.lineValues.map(value => [value])
            },
            maxPoints
        };
        charts.set(el, chart);
        updateQueue.push(el);

        if (!doUpdateChartTimeoutId) {
            doUpdateChartTimeoutId = setTimeout(doUpdateChart);
        }
    } else {
        for (let i = 0; i < inputValue.lineValues.length; i++) {
            chart.data.x[i].push(inputValue.xValue);
            chart.data.y[i].push(inputValue.lineValues[i]);
        }
    }
}

function updateGauge(el: HTMLElement, value: number) {
    let chart = charts.get(el) as IGauge | undefined;
    if (!chart) {
        chart = {
            type: "gauge",
            value
        };
        charts.set(el, chart);
        updateQueue.push(el);

        if (!doUpdateChartTimeoutId) {
            doUpdateChartTimeoutId = setTimeout(doUpdateChart);
        }
    } else {
        chart.value = value;
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
