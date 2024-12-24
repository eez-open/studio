import React from "react";
import {
    observable,
    reaction,
    makeObservable,
    runInAction,
    autorun,
    IReactionDisposer,
    toJS
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
    LINE_CHART_ICON,
    PLOTLY_ICON
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

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Plotly Widget

export class PlotlyExecutionState {
    getInstrumentItemData?: () => {
        itemType: string;
        message: {
            data: any;
            layout: any;
            config: any;
        };
    };
}

const PlotlyElement = observer(
    class PlotlyeElement extends React.Component<{
        widget: PlotlyWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        ref = React.createRef<HTMLDivElement>();

        plotly: PlotlyModule.PlotlyHTMLElement | undefined;
        plotlyEl: HTMLDivElement | undefined;
        plotlyWidth: number;
        plotlyHeight: number;

        updateClientSizeTimeoutId: any;
        clientWidth = 0;
        clientHeight = 0;

        createChartState: "idle" | "create" | "cancel" | "stop" = "idle";

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                clientWidth: observable,
                clientHeight: observable
            });
        }

        get data() {
            let data = evalProperty(
                this.props.flowContext,
                this.props.widget,
                "plotlyData"
            );

            if (!data) {
                return undefined;
            }

            data = toJS(data);

            return data;
        }

        get layout() {
            let layout = evalProperty(
                this.props.flowContext,
                this.props.widget,
                "layout"
            );

            if (!layout) {
                return undefined;
            }

            layout = toJS(layout);

            layout.width = this.clientWidth;
            layout.height = this.clientHeight;

            return layout;
        }

        get config() {
            let config = evalProperty(
                this.props.flowContext,
                this.props.widget,
                "config"
            );

            if (!config) {
                return undefined;
            }

            config = toJS(config);

            return config;
        }

        async createChart(el: HTMLDivElement) {
            if (!this.data) {
                return;
            }

            if (this.createChartState != "idle") {
                if (this.createChartState == "create") {
                    this.createChartState = "cancel";
                }
                return;
            }
            this.createChartState = "create";

            if (this.plotlyEl) {
                Plotly().purge(this.plotlyEl);
            }

            this.plotly = await Plotly().newPlot(
                el,
                this.data,
                this.layout,
                this.config
            );

            if (this.createChartState != "create") {
                if (this.createChartState == "cancel") {
                    this.createChartState = "idle";
                    this.createChart(el);
                }
                return;
            }

            this.createChartState = "idle";

            this.plotlyEl = el;
            this.plotlyWidth = this.clientWidth;
            this.plotlyHeight = this.clientHeight;

            const executionState =
                this.props.flowContext.flowState?.getComponentExecutionState<PlotlyLineChartExecutionState>(
                    this.props.widget
                );
            if (executionState) {
                executionState.getInstrumentItemData = () => {
                    return {
                        itemType: "instrument/plotly",
                        message: {
                            data: this.data,
                            layout: this.layout,
                            config: this.config
                        }
                    };
                };
            }
        }

        updateClientSize = () => {
            if (this.ref.current) {
                const parentElement = this.ref.current.parentElement;
                if (parentElement) {
                    const clientWidth = parentElement.clientWidth;
                    const clientHeight = parentElement.clientHeight;

                    if (clientWidth == 0 && clientHeight == 0) {
                        this.updateClientSizeTimeoutId = setTimeout(() => {
                            this.updateClientSizeTimeoutId = undefined;
                            this.updateClientSize();
                        }, 16);
                    }

                    if (
                        clientWidth != this.clientWidth ||
                        clientHeight != this.clientHeight
                    ) {
                        runInAction(() => {
                            this.clientWidth = clientWidth;
                            this.clientHeight = clientHeight;
                        });
                    }
                }
            }
        };

        componentDidMount() {
            if (this.ref.current) {
                this.updateClientSize();

                this.createChart(this.ref.current);
            }
        }

        async componentDidUpdate() {
            if (this.ref.current) {
                this.updateClientSize();

                if (
                    !this.plotly ||
                    !this.props.flowContext.flowState ||
                    this.clientWidth != this.plotlyWidth ||
                    this.clientHeight != this.plotlyHeight
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
            if (this.updateClientSizeTimeoutId) {
                clearTimeout(this.updateClientSizeTimeoutId);
                this.updateClientSizeTimeoutId = undefined;
            }

            this.createChartState = "stop";

            if (this.plotlyEl) {
                Plotly().purge(this.plotlyEl);
            }
        }

        render() {
            const { flowContext } = this.props;

            this.data;
            this.layout;
            this.config;
            this.clientWidth;
            this.clientHeight;

            return (
                <div
                    ref={this.ref}
                    style={{
                        width: this.clientWidth,
                        height: this.clientHeight
                    }}
                    className={classNames("EezStudio_Plotly", {
                        interactive: !!flowContext.projectStore.runtime
                    })}
                ></div>
            );
        }
    }
);

export class PlotlyWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            }),

            makeExpressionProperty(
                {
                    name: "plotlyData",
                    displayName: "Chart data",
                    formText: () => (
                        <span>
                            Plotly chart data is set via JSON value, check{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openLink(
                                        "https://plotly.com/javascript/reference/index/"
                                    );
                                }}
                            >
                                Plotly documentation
                            </a>{" "}
                            for available options.
                        </span>
                    ),
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "json"
            ),

            makeExpressionProperty(
                {
                    name: "layout",
                    displayName: "Layout options",
                    formText: () => (
                        <span>
                            Plotly layout options are set via JSON value, check{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openLink(
                                        "https://plotly.com/javascript/reference/layout/"
                                    );
                                }}
                            >
                                Plotly documentation
                            </a>{" "}
                            for available options.
                        </span>
                    ),
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "json"
            ),
            makeExpressionProperty(
                {
                    name: "config",
                    displayName: "Configuration options",
                    formText: () => (
                        <span>
                            Plotly configuration options are set via JSON value,
                            check{" "}
                            <a
                                href="#"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openLink(
                                        "https://plotly.com/javascript/configuration-options/"
                                    );
                                }}
                            >
                                Plotly documentation
                            </a>{" "}
                            for available options.
                        </span>
                    ),
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "json"
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 320,
            height: 160
        },

        icon: PLOTLY_ICON,

        showTreeCollapseIcon: "never",

        execute: (context: IDashboardComponentContext) => {
            Widget.classInfo.execute!(context);

            let executionState =
                context.getComponentExecutionState<PlotlyExecutionState>();
            if (!executionState) {
                context.setComponentExecutionState(new PlotlyExecutionState());
            }
        }
    });

    plotlyData: string;
    layout: string;
    config: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            plotlyData: observable,
            layout: observable,
            config: observable
        });
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <PlotlyElement
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

registerClass("PlotlyWidget", PlotlyWidget);

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// LineChart Widget

interface InputData {
    xValue: number;
    lineValues: number[];
}

export class PlotlyLineChartExecutionState {
    updated: number = 0;
    values: InputData[] = [];
    maxPoints: number = 0;
    labels: string[] = [];
    visible: boolean[] = [];

    debounceTimerId: any;

    getInstrumentItemData?: () => {
        itemType: string;
        message: {
            data: any;
            layout: any;
            config: any;
        };
    };

    constructor() {
        makeObservable(this, {
            updated: observable
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

        updateClientSizeTimeoutId: any;
        clientWidth = 0;
        clientHeight = 0;

        createChartState: "idle" | "create" | "cancel" | "stop" = "idle";

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                clientWidth: observable,
                clientHeight: observable
            });
        }

        get data(): PlotlyModule.Data[] {
            const { widget, flowContext } = this.props;

            const executionState =
                flowContext.flowState?.getComponentExecutionState<PlotlyLineChartExecutionState>(
                    widget
                );

            if (!executionState) {
                return widget.lines.map((line, i) => {
                    let name: string;

                    try {
                        name = evalConstantExpression(
                            flowContext.projectStore.project,
                            line.label
                        ).value;
                    } catch (err) {
                        name = "";
                    }

                    return {
                        x: flowContext.flowState ? [] : [1, 2, 3, 4],
                        y: flowContext.flowState
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

            const data: (PlotlyModule.Data | undefined)[] = widget.lines.map(
                (line, i) => {
                    let name: string;

                    if (!executionState.visible[i]) {
                        return undefined;
                    }

                    name = executionState.labels[i];

                    return {
                        x: executionState.values.map(
                            inputValue => inputValue.xValue
                        ),
                        y: executionState.values.map(
                            inputValue => inputValue.lineValues[i]
                        ),
                        type: "scatter",
                        name,
                        showlegend: widget.showLegend,
                        line: {
                            color: line.color
                        }
                    };
                }
            );

            return data.filter(
                line => line != undefined
            ) as PlotlyModule.Data[];
        }

        get emptyData(): PlotlyModule.Data[] {
            const { widget, flowContext } = this.props;

            const executionState =
                flowContext.flowState?.getComponentExecutionState<PlotlyLineChartExecutionState>(
                    widget
                );

            const lines = widget.lines.filter((line, i) => {
                if (executionState) {
                    return executionState.visible[i];
                } else {
                    return true;
                }
            });

            return lines.map((line, i) => {
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
                            ).colorValue) ||
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
                  ).colorValue
                : "white";

            return {
                title: widget.title,
                xaxis: {
                    visible: widget.showXAxis,
                    showgrid: widget.showGrid,
                    zeroline: widget.showZeroLines,
                    range: xRange,
                    ticksuffix: widget.xAxisTickSuffix
                },
                yaxis: {
                    visible: widget.showYAxis,
                    showgrid: widget.showGrid,
                    zeroline: widget.showZeroLines,
                    range: yRange,
                    ticksuffix: widget.yAxisTickSuffix
                },
                shapes,
                margin: {
                    t: widget.margin.top,
                    r: widget.margin.right,
                    b: widget.margin.bottom,
                    l: widget.margin.left
                },
                plot_bgcolor: bgcolor,
                paper_bgcolor: bgcolor,
                width: this.clientWidth,
                height: this.clientHeight
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
            if (this.createChartState != "idle") {
                if (this.createChartState == "create") {
                    this.createChartState = "cancel";
                }
                return;
            }
            this.createChartState = "create";

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

            if (this.createChartState != "create") {
                if (this.createChartState == "cancel") {
                    this.createChartState = "idle";
                    this.createChart(el);
                }
                return;
            }

            this.createChartState = "idle";

            this.plotlyEl = el;
            this.plotlyWidth = this.clientWidth;
            this.plotlyHeight = this.clientHeight;

            const executionState =
                this.props.flowContext.flowState?.getComponentExecutionState<PlotlyLineChartExecutionState>(
                    this.props.widget
                );
            if (executionState) {
                executionState.getInstrumentItemData = () => {
                    return {
                        itemType: "instrument/plotly",
                        message: {
                            data: this.data,
                            layout: this.layout,
                            config: this.config
                        }
                    };
                };
            }

            this.dispose1 = reaction(
                () => {
                    return {
                        layout: this.layout
                    };
                },
                async params => {
                    try {
                        this.plotly = await Plotly().react(
                            el,
                            this.data,
                            params.layout,
                            this.config
                        );
                    } catch (err) {
                        console.error(err);
                    }
                },
                {
                    delay: 16
                }
            );

            this.dispose2 = autorun(
                () => {
                    const { widget, flowContext } = this.props;

                    const executionState =
                        flowContext.flowState?.getComponentExecutionState<PlotlyLineChartExecutionState>(
                            widget
                        );
                    if (!executionState) {
                        return;
                    }

                    executionState.updated;

                    (async () => {
                        this.plotly = await Plotly().react(
                            el,
                            this.data,
                            this.layout,
                            this.config
                        );
                    })();
                },
                {
                    delay: 16
                }
            );
        }

        updateClientSize = () => {
            if (this.ref.current) {
                const parentElement = this.ref.current.parentElement;
                if (parentElement) {
                    const clientWidth = parentElement.clientWidth;
                    const clientHeight = parentElement.clientHeight;

                    if (clientWidth == 0 && clientHeight == 0) {
                        this.updateClientSizeTimeoutId = setTimeout(() => {
                            this.updateClientSizeTimeoutId = undefined;
                            this.updateClientSize();
                        }, 16);
                    }

                    if (
                        clientWidth != this.clientWidth ||
                        clientHeight != this.clientHeight
                    ) {
                        runInAction(() => {
                            this.clientWidth = clientWidth;
                            this.clientHeight = clientHeight;
                        });
                    }
                }
            }
        };

        componentDidMount() {
            if (this.ref.current) {
                this.updateClientSize();

                this.createChart(this.ref.current);
            }
        }

        async componentDidUpdate() {
            if (this.ref.current) {
                this.updateClientSize();

                if (
                    !this.plotly ||
                    !this.props.flowContext.flowState ||
                    this.clientWidth != this.plotlyWidth ||
                    this.clientHeight != this.plotlyHeight
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
            if (this.updateClientSizeTimeoutId) {
                clearTimeout(this.updateClientSizeTimeoutId);
                this.updateClientSizeTimeoutId = undefined;
            }

            this.createChartState = "stop";

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
            const { flowContext } = this.props;

            return (
                <div
                    ref={this.ref}
                    style={{
                        width: this.clientWidth,
                        height: this.clientHeight
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
    visible: string;

    static classInfo: ClassInfo = {
        listLabel: (object: LineChartLine) => "",
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
            ),
            makeExpressionProperty(
                {
                    name: "visible",
                    type: PropertyType.MultilineText
                },
                "boolean"
            )
        ],
        beforeLoadHook: (object: LineChartLine, jsObject: any) => {
            if (jsObject.visible == undefined) {
                jsObject.visible = "true";
            }
        },
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

            try {
                checkExpression(
                    getParent(getParent(lineChartTrace)!)! as LineChartWidget,
                    lineChartTrace.visible
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid expression: ${err}`,
                        getChildOfObject(lineChartTrace, "visible")
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
            value: observable,
            visible: observable
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
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            {
                name: "showGrid",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            {
                name: "showZeroLines",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            {
                name: "showXAxis",
                displayName: "Show X axis",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            {
                name: "xAxisTickSuffix",
                type: PropertyType.String,
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
                name: "showYAxis",
                displayName: "Show Y axis",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            {
                name: "yAxisTickSuffix",
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
            Widget.classInfo.execute!(context);

            let executionState =
                context.getComponentExecutionState<PlotlyLineChartExecutionState>();
            if (!executionState) {
                executionState = new PlotlyLineChartExecutionState();
                context.setComponentExecutionState(executionState);
                return;
            }

            const resetInputValue = context.getInputValue("reset");

            const labels = context.getExpressionListParam(0);

            const visible = context.getExpressionListParam(16);

            executionState!.labels = labels;
            executionState!.visible = visible;

            if (resetInputValue !== undefined) {
                context.clearInputValue("reset");
                executionState!.values = [];
            } else {
                let maxPoints = context.evalProperty("maxPoints");

                const xValue = context.evalProperty("xValue");
                if (xValue != undefined) {
                    const lineValues = context.getExpressionListParam(8);

                    if (!executionState.values) {
                        executionState.values = [];
                    }

                    let inserted = false;

                    for (let i = 0; i < executionState.values.length; i++) {
                        if (xValue < executionState.values[i].xValue) {
                            executionState.values.splice(i, 0, {
                                xValue,
                                lineValues
                            });
                            inserted = true;
                            break;
                        }

                        if (xValue == executionState.values[i].xValue) {
                            if (i < executionState.values.length - 1) {
                                executionState.values[i].lineValues =
                                    lineValues;
                                inserted = true;
                            }
                            break;
                        }
                    }

                    if (!inserted) {
                        executionState.values.push({
                            xValue,
                            lineValues
                        });
                    }

                    while (executionState.values.length > maxPoints) {
                        executionState.values.splice(0, 1);
                    }

                    executionState!.maxPoints = maxPoints;
                }
            }

            if (executionState.debounceTimerId) {
                clearTimeout(executionState.debounceTimerId);
            }
            executionState.debounceTimerId = setTimeout(() => {
                runInAction(() => {
                    executionState!.updated++;
                });
            }, 16);
        }
    });

    xValue: string;
    lines: LineChartLine[];
    title: string;
    displayModebar: "hover" | "always" | "never";
    showLegend: boolean;
    showGrid: boolean;
    showZeroLines: boolean;
    showXAxis: boolean;
    xAxisTickSuffix: string;
    xAxisRangeOption: "floating" | "fixed";
    xAxisRangeFrom: number;
    xAxisRangeTo: number;
    showYAxis: boolean;
    yAxisTickSuffix: string;
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
            xAxisTickSuffix: observable,
            xAxisRangeOption: observable,
            xAxisRangeFrom: observable,
            xAxisRangeTo: observable,
            yAxisTickSuffix: observable,
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

        dataBuffer.writeArray(this.lines, line => {
            try {
                // as property
                buildExpression(assets, dataBuffer, this, line.visible);
            } catch (err) {
                assets.projectStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(this, "visible")
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
    class GaugeElement extends React.Component<{
        widget: GaugeWidget;
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

        updateClientSizeTimeoutId: any;
        clientWidth = 0;
        clientHeight = 0;

        createChartState: "idle" | "create" | "cancel" | "stop" = "idle";

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                clientWidth: observable,
                clientHeight: observable
            });
        }

        get data(): PlotlyModule.Data[] {
            const minRange = 0;
            const maxRange = 1;

            return [
                {
                    domain: { x: [0, 1], y: [0, 1] },
                    value: this.props.flowContext.flowState
                        ? 0
                        : (minRange + maxRange) / 2,
                    title: { text: this.props.widget.title },
                    type: "indicator",
                    mode: "gauge+number",
                    gauge: {
                        bar: {
                            color: this.props.widget.color
                        },
                        axis: {
                            range: [minRange, maxRange],
                            color: this.props.widget.color
                        }
                    },
                    number: {
                        valueformat: "f"
                    }
                }
            ];
        }

        get layout(): Partial<PlotlyModule.Layout> {
            return {
                margin: {
                    t: this.props.widget.margin.top,
                    r: this.props.widget.margin.right,
                    b: this.props.widget.margin.bottom,
                    l: this.props.widget.margin.left
                }
            };
        }

        get config(): Partial<PlotlyModule.Config> {
            return {
                displayModeBar: false,
                autosizable: false
            };
        }

        async createChart(el: HTMLDivElement) {
            if (this.createChartState != "idle") {
                if (this.createChartState == "create") {
                    this.createChartState = "cancel";
                }
                return;
            }
            this.createChartState = "create";

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

            if (this.createChartState != "create") {
                if (this.createChartState == "cancel") {
                    this.createChartState = "idle";
                    this.createChart(el);
                }
                return;
            }

            this.createChartState = "idle";

            this.plotlyEl = el;
            this.plotlyWidth = this.clientWidth;
            this.plotlyHeight = this.clientHeight;

            this.dispose1 = reaction(
                () => {
                    return {
                        layout: this.layout
                    };
                },
                async params => {
                    try {
                        this.plotly = await Plotly().react(
                            el,
                            this.data,
                            params.layout,
                            this.config
                        );
                    } catch (err) {
                        console.error(err);
                    }
                },
                {
                    delay: 16
                }
            );

            this.dispose2 = autorun(
                () => {
                    const inputData = this.props.flowContext.flowState
                        ? {
                              value: evalProperty(
                                  this.props.flowContext,
                                  this.props.widget,
                                  "data"
                              ),
                              minRange: evalProperty(
                                  this.props.flowContext,
                                  this.props.widget,
                                  "minRange"
                              ),
                              maxRange: evalProperty(
                                  this.props.flowContext,
                                  this.props.widget,
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
                                        color: this.props.widget.color
                                    },
                                    axis: {
                                        range: [
                                            inputData.minRange,
                                            inputData.maxRange
                                        ],
                                        color: this.props.widget.color
                                    }
                                },
                                number: {
                                    valueformat: "f"
                                }
                            },
                            {}
                        );
                    }
                },
                {
                    delay: 16
                }
            );
        }

        updateClientSize = () => {
            if (this.ref.current) {
                const parentElement = this.ref.current.parentElement;
                if (parentElement) {
                    const clientWidth = parentElement.clientWidth;
                    const clientHeight = parentElement.clientHeight;

                    if (clientWidth == 0 && clientHeight == 0) {
                        this.updateClientSizeTimeoutId = setTimeout(() => {
                            this.updateClientSizeTimeoutId = undefined;
                            this.updateClientSize();
                        }, 16);
                    }

                    if (
                        clientWidth != this.clientWidth ||
                        clientHeight != this.clientHeight
                    ) {
                        runInAction(() => {
                            this.clientWidth = clientWidth;
                            this.clientHeight = clientHeight;
                        });
                    }
                }
            }
        };

        componentDidMount() {
            if (this.ref.current) {
                this.updateClientSize();

                this.createChart(this.ref.current);
            }
        }

        componentDidUpdate() {
            if (this.ref.current) {
                this.updateClientSize();

                this.createChart(this.ref.current);
            }
        }

        componentWillUnmount(): void {
            if (this.updateClientSizeTimeoutId) {
                clearTimeout(this.updateClientSizeTimeoutId);
                this.updateClientSizeTimeoutId = undefined;
            }

            this.createChartState = "stop";

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
            const { flowContext } = this.props;

            return (
                <div
                    ref={this.ref}
                    style={{
                        width: this.clientWidth,
                        height: this.clientHeight
                    }}
                    className={classNames("EezStudio_Plotly", {
                        interactive: !!flowContext.projectStore.runtime
                    })}
                ></div>
            );
        }
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
        }
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
