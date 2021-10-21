import tinycolor from "tinycolor2";
import { clipboard, SaveDialogOptions } from "electron";
import bootstrap from "bootstrap";
import React from "react";
import ReactDOM from "react-dom";
import {
    action,
    computed,
    autorun,
    observable,
    reaction,
    runInAction,
    toJS
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { cssTransition } from "react-toastify";

import { getLocale } from "eez-studio-shared/i10n";
import { extensions } from "eez-studio-shared/extensions/extensions";
import { IUnit, UNITS, UNKNOWN_UNIT } from "eez-studio-shared/units";
import { Point, pointDistance } from "eez-studio-shared/geometry";
import { guid } from "eez-studio-shared/guid";
import { capitalize, stringCompare } from "eez-studio-shared/string";
import { writeBinaryData } from "eez-studio-shared/util-electron";
import { closestByClass, scrollIntoViewIfNeeded } from "eez-studio-shared/dom";
import {
    _difference,
    _map,
    _range,
    _uniqWith
} from "eez-studio-shared/algorithm";

import { SvgLabel } from "eez-studio-ui/svg-label";
import * as notification from "eez-studio-ui/notification";
import { Draggable } from "eez-studio-ui/draggable";
import { DockablePanels, SideDock } from "eez-studio-ui/side-dock";
import { Splitter } from "eez-studio-ui/splitter";
import {
    FieldComponent,
    GenericDialog,
    IFieldProperties
} from "eez-studio-ui/generic-dialog";
import { IconAction } from "eez-studio-ui/action";
import { Checkbox, Radio } from "eez-studio-ui/properties";

import type {
    IChart,
    IMeasurementFunction,
    IMeasureTask
} from "eez-studio-shared/extensions/extension";

////////////////////////////////////////////////////////////////////////////////

export const CONF_CURSOR_RADIUS = 8;

const SCROLL_BAR_SIZE = 16;

const CONF_LABEL_TICK_GAP_HORZ = 10;
const CONF_LABEL_TICK_GAP_VERT = 10;
const CONF_ZOOM_STEP = 1.5;
const CONF_PAN_STEP = 0.05;

const ZOOM_ICON_SIZE = 32;
const ZOOM_ICON_PADDING = 4;
const CONF_SCALE_ZOOM_FACTOR_ANIMATION_DURATION = 250;
const CONF_AXIS_MIN_TICK_DISTANCE = 4;
const CONF_AXIS_MAX_TICK_DISTANCE = 400;
const CONF_X_AXIS_MIN_TICK_LABEL_WIDTH = 100;
const CONF_Y_AXIS_MIN_TICK_LABEL_WIDTH = 20;

const CONF_MIN_Y_SCALE_LABELS_WIDTH = 70;

const CONF_MIN_X_AXIS_BAND_HEIGHT = 20;
const CONF_DYNAMIC_AXIS_LINE_MIN_COLOR_OPACITY = 0.1;
const CONF_DYNAMIC_AXIS_LINE_MAX_COLOR_OPACITY = 0.9;
const CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND = "192, 192, 192";
const CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND = "164, 164, 164";
const CONF_DYNAMIC_AXIS_LINE_MIN_TEXT_COLOR_OPACITY = 0.8;
const CONF_DYNAMIC_AXIS_LINE_MAX_TEXT_COLOR_OPACITY = 1.0;
const CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND = "255, 255, 255";
const CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND = "0, 0, 0";
const CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_WHITE_BACKGROUND = "#ccc";
const CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_WHITE_BACKGROUND = "#f0f0f0";
const CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_BLACK_BACKGROUND = "#444";
const CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_BLACK_BACKGROUND = "#222";
const CONF_FIXED_AXIS_MAJOR_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND = "#666";
const CONF_FIXED_AXIS_MINOR_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND = "#999";
const CONF_FIXED_AXIS_MAJOR_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND = "#eee";
const CONF_FIXED_AXIS_MINOR_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND = "#ddd";

const CONF_MAX_NUM_SAMPLES_TO_SHOW_CALCULATING_MESSAGE = 1000000;

////////////////////////////////////////////////////////////////////////////////

export enum DataType {
    DATA_TYPE_BIT,
    DATA_TYPE_INT8,
    DATA_TYPE_UINT8,
    DATA_TYPE_INT16,
    DATA_TYPE_INT16_BE,
    DATA_TYPE_UINT16,
    DATA_TYPE_UINT16_BE,
    DATA_TYPE_INT24,
    DATA_TYPE_INT24_BE,
    DATA_TYPE_UINT24,
    DATA_TYPE_UINT24_BE,
    DATA_TYPE_INT32,
    DATA_TYPE_INT32_BE,
    DATA_TYPE_UINT32,
    DATA_TYPE_UINT32_BE,
    DATA_TYPE_INT64,
    DATA_TYPE_INT64_BE,
    DATA_TYPE_UINT64,
    DATA_TYPE_UINT64_BE,
    DATA_TYPE_FLOAT,
    DATA_TYPE_FLOAT_BE,
    DATA_TYPE_DOUBLE,
    DATA_TYPE_DOUBLE_BE
}

export type ZoomMode = "default" | "all" | "custom";

export interface IAxisModel {
    unit: IUnit;

    defaultFrom: number;
    defaultTo: number;

    minValue: number;
    maxValue: number;

    minScale?: number;
    maxScale?: number;

    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    };

    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    };
    defaultSubdivisionOffset: number | undefined;
    defaultSubdivisionScale: number | undefined;

    label: string;
    color: string;
    colorInverse: string;

    logarithmic?: boolean;

    semiLogarithmic?: {
        a: number;
        b: number;
    };
}

interface ITick {
    px: number;
    value: number;
    label: string;
    color: string;
    textColor: string;
    isMajorLine?: boolean;
    allowSnapTo: boolean;
    step?: number;
}

////////////////////////////////////////////////////////////////////////////////

export interface ILineController {
    id: string;

    xAxisController: AxisController;
    xMin: number;
    xMax: number;

    yAxisController: AxisController;
    yMin: number;
    yMax: number;

    label: string;

    getWaveformModel(): WaveformModel | null;

    getNearestValuePoint(point: Point): Point;

    updateCursor(cursor: ICursor, point: Point, event: PointerEvent): void;
    addPoint(chartView: ChartView, cursor: ICursor): MouseHandler | undefined;
    onDragStart(
        chartView: ChartView,
        event: PointerEvent
    ): MouseHandler | undefined;
    render(clipId: string): JSX.Element;
    // find closest point on line to the given point
    closestPoint(point: Point): Point | undefined;
}

export abstract class LineController implements ILineController {
    constructor(public id: string, yAxisController: AxisController) {
        this._yAxisController = yAxisController;
    }

    get xAxisController() {
        return this.yAxisController.chartsController.xAxisController;
    }

    @computed
    get xMin(): number {
        return this.xAxisController.axisModel.minValue;
    }

    @computed
    get xMax(): number {
        return this.xAxisController.axisModel.maxValue;
    }

    private _yAxisController: AxisController;

    get yAxisController() {
        return this._yAxisController;
    }

    abstract get yMin(): number;
    abstract get yMax(): number;

    get label() {
        return this.yAxisController.axisModel.label;
    }

    abstract getWaveformModel(): WaveformModel | null;

    abstract getNearestValuePoint(point: Point): Point;

    updateCursor(
        cursor: ICursor | undefined,
        point: Point,
        event: PointerEvent
    ): void {
        if (cursor) {
            const { x, y } = this.getNearestValuePoint(point);
            if (!isNaN(x) && !isNaN(y)) {
                cursor.visible = true;
                cursor.lineController = this;
                cursor.time = x;
                cursor.value = y;
                cursor.fillColor = "rgba(192, 192, 192, 0.5)";
                cursor.strokeColor = "rgb(192, 192, 192)";
            }
        }
    }

    addPoint(chartView: ChartView, cursor: ICursor): MouseHandler | undefined {
        return undefined;
    }

    onDragStart(
        chartView: ChartView,
        event: PointerEvent
    ): MouseHandler | undefined {
        return undefined;
    }

    abstract render(clipId: string): JSX.Element;

    closestPoint(point: Point): Point | undefined {
        const { x, y } = this.getNearestValuePoint(point);
        return {
            x: this.xAxisController.valueToPx(x),
            y: this.yAxisController.valueToPx(y)
        };
    }
}

/////////////////////////////////////////////////////////

export class ChartController {
    constructor(public chartsController: ChartsController, public id: string) {}

    get xAxisController() {
        return this.chartsController.xAxisController;
    }

    get chartIndex() {
        return this.chartsController.chartControllers.indexOf(this);
    }

    yAxisController: AxisController;

    createYAxisController(model: IAxisModel) {
        if (this.chartsController.viewOptions.axesLines.type === "dynamic") {
            this.yAxisController = new DynamicAxisController(
                "y",
                this.chartsController,
                this,
                model
            );
        } else {
            this.yAxisController = new FixedAxisController(
                "y",
                this.chartsController,
                this,
                model
            );
        }
    }

    yAxisControllerOnRightSide?: AxisController;

    createYAxisControllerOnRightSide(model: IAxisModel) {
        if (this.chartsController.viewOptions.axesLines.type === "dynamic") {
            this.yAxisControllerOnRightSide = new DynamicAxisController(
                "yRight",
                this.chartsController,
                this,
                model
            );
        } else {
            this.yAxisControllerOnRightSide = new FixedAxisController(
                "yRight",
                this.chartsController,
                this,
                model
            );
        }
    }

    lineControllers: ILineController[] = [];

    chartViews: ChartView[] = [];

    get chartView(): ChartView | undefined {
        for (let i = 0; i < this.chartViews.length; i++) {
            const svg = this.chartViews[i].svg;
            if (svg) {
                const chartViewRect = svg.getBoundingClientRect();
                if (chartViewRect.width > 0 && chartViewRect.height > 0) {
                    return this.chartViews[i];
                }
            }
        }

        if (this.chartViews.length > 0) {
            return this.chartViews[0];
        }

        return undefined;
    }

    @computed
    get axes() {
        const axes = [this.xAxisController, this.yAxisController];
        if (this.yAxisControllerOnRightSide) {
            axes.push(this.yAxisControllerOnRightSide);
        }
        return axes;
    }

    onDragStart(
        chartView: ChartView,
        event: PointerEvent
    ): MouseHandler | undefined {
        if (this.chartsController.rulersController) {
            const mouseHandler =
                this.chartsController.rulersController.onDragStart(
                    chartView,
                    event
                );
            if (mouseHandler) {
                return mouseHandler;
            }
        }

        for (let i = 0; i < this.lineControllers.length; i++) {
            const mouseHandler = this.lineControllers[i].onDragStart(
                chartView,
                event
            );
            if (mouseHandler) {
                return mouseHandler;
            }
        }

        if (this.chartsController.mode === "interactive") {
            return new ZoomToRectMouseHandler(this);
        }

        return undefined;
    }

    @computed
    get minValue() {
        return {
            x:
                this.lineControllers.length > 0
                    ? Math.min(
                          ...this.lineControllers.map(
                              lineController => lineController.xMin
                          )
                      )
                    : 0,

            y:
                this.lineControllers.length > 0
                    ? Math.min(
                          ...this.lineControllers
                              .filter(
                                  lineController =>
                                      lineController.yAxisController ===
                                      this.yAxisController
                              )
                              .map(lineController => lineController.yMin)
                      )
                    : 0,

            yRight:
                this.lineControllers.length > 0
                    ? Math.min(
                          ...this.lineControllers
                              .filter(
                                  lineController =>
                                      lineController.yAxisController ===
                                      this.yAxisControllerOnRightSide
                              )
                              .map(lineController => lineController.yMin)
                      )
                    : 0
        };
    }

    @computed
    get maxValue() {
        return {
            x:
                this.lineControllers.length > 0
                    ? Math.max(
                          ...this.lineControllers.map(
                              lineController => lineController.xMax
                          )
                      )
                    : 1,

            y:
                this.lineControllers.length > 0
                    ? Math.max(
                          ...this.lineControllers
                              .filter(
                                  lineController =>
                                      lineController.yAxisController ===
                                      this.yAxisController
                              )
                              .map(lineController => lineController.yMax)
                      )
                    : 1,

            yRight:
                this.lineControllers.length > 0
                    ? Math.max(
                          ...this.lineControllers
                              .filter(
                                  lineController =>
                                      lineController.yAxisController ===
                                      this.yAxisControllerOnRightSide
                              )
                              .map(lineController => lineController.yMax)
                      )
                    : 1
        };
    }

    @action
    zoomAll() {
        this.yAxisController.zoomAll();

        if (this.yAxisControllerOnRightSide) {
            this.yAxisControllerOnRightSide.zoomAll();
        }
    }

    @action
    zoomDefault() {
        this.yAxisController.zoomDefault();

        if (this.yAxisControllerOnRightSide) {
            this.yAxisControllerOnRightSide.zoomDefault();
        }
    }

    customRender(): JSX.Element | null {
        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

export type IViewOptionsAxesLinesType = "dynamic" | "fixed";

export interface IViewOptionsAxesLines {
    type: IViewOptionsAxesLinesType;
    steps: {
        x: number[];
        y: number[][];
    };
    majorSubdivision: {
        horizontal: number;
        vertical: number;
    };
    minorSubdivision: {
        horizontal: number;
        vertical: number;
    };
    snapToGrid: boolean;
    defaultZoomMode: "default" | "all";
}

export interface IViewOptions {
    axesLines: IViewOptionsAxesLines;

    setAxesLinesType(type: IViewOptionsAxesLinesType): void;

    setAxesLinesMajorSubdivisionHorizontal(value: number): void;
    setAxesLinesMajorSubdivisionVertical(value: number): void;
    setAxesLinesMinorSubdivisionHorizontal(value: number): void;
    setAxesLinesMinorSubdivisionVertical(value: number): void;

    setAxesLinesStepsX(steps: number[]): void;
    setAxesLinesStepsY(index: number, steps: number[]): void;

    setAxesLinesSnapToGrid(value: boolean): void;

    showAxisLabels: boolean;
    setShowAxisLabels(value: boolean): void;

    showZoomButtons: boolean;
    setShowZoomButtons(value: boolean): void;
}

////////////////////////////////////////////////////////////////////////////////

interface ChartBookmark {
    value: number;
    text: string;
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ChartBorder extends React.Component<
    { chartsController: ChartsController },
    {}
> {
    render() {
        const chartsController = this.props.chartsController;

        return (
            <rect
                x={chartsController.chartLeft}
                y={chartsController.chartTop}
                width={chartsController.chartWidth}
                height={chartsController.chartHeight}
                strokeWidth="1"
                stroke={globalViewOptions.blackBackground ? "#666" : "#333"}
                fillOpacity="0"
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class AxisLines extends React.Component<
    { axisController: AxisController },
    {}
> {
    line = (tick: ITick, i: number) => {
        const { axisController } = this.props;
        const chartsController = this.props.axisController.chartsController;

        let x1;
        let x2;
        let y1;
        let y2;

        if (axisController.position === "x") {
            x1 = chartsController.chartLeft + tick.px;
            x2 = chartsController.chartLeft + tick.px;
            y1 = chartsController.chartTop;
            y2 = chartsController.chartTop + chartsController.chartHeight;
        } else {
            x1 = chartsController.chartLeft;
            x2 = chartsController.chartLeft + chartsController.chartWidth;
            y1 = chartsController.chartBottom - tick.px;
            y2 = chartsController.chartBottom - tick.px;
        }

        return (
            <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth="1"
                stroke={tick.color}
            />
        );
    };

    render() {
        const { axisController } = this.props;

        const minorLines = axisController.ticks
            .filter(tick => tick.isMajorLine !== true)
            .map(this.line);
        const majorLines = axisController.ticks
            .filter(tick => tick.isMajorLine === true)
            .map(this.line);

        return (
            <g>
                {minorLines}
                {majorLines}
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

// https://leungwensen.github.io/svg-icon/

interface SvgIcon {
    path: string;
    viewBox: string;
}

const SVG_ICON_ZOOM_OUT: SvgIcon = {
    path: `M7.999 5.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 1 .5.5zm4.52 7.868a.653.653 0 0 1-.918-.104L8.747 9.932A5.465 5.465 0 0 1 5.5 11 5.5 5.5 0 1 1 11 5.5a5.475 5.475 0 0 1-1.31 3.558l2.901 3.387a.654.654 0 0 1-.072.923zM5.499 10c2.481 0 4.5-2.019 4.5-4.5S7.98 1 5.499 1s-4.5 2.019-4.5 4.5 2.019 4.5 4.5 4.5z`,
    viewBox: `0 0 12.759932518005371 13.592938423156738`
};

const SVG_ICON_ZOOM_IN: SvgIcon = {
    path: `M7.999 5.5a.5.5 0 0 1-.5.5h-1.5v1.5a.5.5 0 0 1-1 0V6h-1.5a.5.5 0 0 1 0-1h1.5V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 .5.5zm4.52 7.868a.653.653 0 0 1-.918-.104L8.747 9.932A5.465 5.465 0 0 1 5.5 11 5.5 5.5 0 1 1 11 5.5a5.475 5.475 0 0 1-1.31 3.558l2.901 3.387a.654.654 0 0 1-.072.923zM5.499 10c2.481 0 4.5-2.019 4.5-4.5S7.98 1 5.499 1s-4.5 2.019-4.5 4.5 2.019 4.5 4.5 4.5z`,
    viewBox: "0 0 12.759932518005371 13.592938423156738"
};

@observer
class SvgButton extends React.Component<
    {
        icon: SvgIcon;
        x: number;
        y: number;
        width: number;
        height: number;
        padding: number;
        onClick: () => void;
    },
    {}
> {
    render() {
        const { icon, x, y, width, height, padding, onClick } = this.props;

        const viewBoxComponents = this.props.icon.viewBox
            .split(" ")
            .map(viewBoxComponent => parseFloat(viewBoxComponent));
        const viewBox = {
            x: viewBoxComponents[0],
            y: viewBoxComponents[1],
            width: viewBoxComponents[2],
            height: viewBoxComponents[3]
        };

        const tx = x + padding - viewBox.x;
        const ty = y + padding - viewBox.y;
        const sx = (width - 2 * padding) / viewBox.width;
        const sy = (height - 2 * padding) / viewBox.height;

        return (
            <g transform={`translate(${tx}, ${ty}) scale(${sx}, ${sy})`}>
                <g className="EezStudio_SvgButtonGroup" onClick={onClick}>
                    <rect
                        x={viewBox.x}
                        y={viewBox.y}
                        width={viewBox.width}
                        height={viewBox.height}
                        fillOpacity="0"
                    />
                    <path d={icon.path} />
                </g>
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class AxisLabels extends React.Component<
    { axisController: AxisController },
    {}
> {
    ref = React.createRef<SVGGElement>();

    componentDidMount() {
        const g = this.ref.current;
        if (g) {
            runInAction(() => {
                const rect = g.getBBox();
                this.props.axisController.labelTextsWidth = rect.width;
                this.props.axisController.labelTextsHeight = rect.height;
            });
        }
    }

    render() {
        const { axisController } = this.props;

        const chartsController = axisController.chartsController;

        const labels = axisController.ticks
            .filter(tick => !!tick.label)
            .map((tick, i) => {
                let xText;
                let yText;
                let textAnchor: any;
                let alignmentBaseline: any;

                if (axisController.position === "x") {
                    xText = chartsController.chartLeft + tick.px;
                    yText = 0;
                    textAnchor = "middle";
                    alignmentBaseline = "hanging";
                } else if (axisController.position === "y") {
                    xText =
                        chartsController.chartLeft - CONF_LABEL_TICK_GAP_HORZ;
                    yText = chartsController.chartBottom - tick.px;
                    textAnchor = "end";
                    alignmentBaseline = "middle";
                } else {
                    xText =
                        chartsController.chartRight + CONF_LABEL_TICK_GAP_HORZ;
                    yText = chartsController.chartBottom - tick.px;
                    textAnchor = "start";
                    alignmentBaseline = "middle";
                }

                return (
                    <text
                        key={i}
                        x={Math.round(xText) + 0.5}
                        y={Math.round(yText) + 0.5}
                        textAnchor={textAnchor}
                        alignmentBaseline={alignmentBaseline}
                        fill={tick.textColor}
                    >
                        {tick.label}
                    </text>
                );
            });

        return (
            <g ref={this.ref} className="EezStudio_ChartView_Labels">
                {labels}
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class AxisScrollBar extends React.Component<
    { axisController: AxisController },
    {}
> {
    div: HTMLDivElement | null = null;

    get from() {
        return Math.min(
            this.props.axisController.minValue,
            this.props.axisController.from
        );
    }

    get to() {
        return Math.max(
            this.props.axisController.maxValue,
            this.props.axisController.to
        );
    }

    get range() {
        return this.to - this.from;
    }

    @action.bound
    onScroll() {
        if (this.div) {
            const { axisController } = this.props;

            if (axisController.position === "x") {
                const newScrollPosition = this.div.scrollLeft;
                const oldScrollPosition =
                    (axisController.from - this.from) * axisController.scale;

                if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                    axisController.panTo(
                        this.from + newScrollPosition / axisController.scale
                    );
                }
            } else {
                const newScrollPosition = this.div.scrollTop;
                const oldScrollPosition =
                    this.div.scrollHeight -
                    (axisController.from - this.from) * axisController.scale -
                    this.div.clientHeight;

                if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                    axisController.panTo(
                        this.from +
                            (this.div.scrollHeight -
                                this.div.clientHeight -
                                newScrollPosition) /
                                axisController.scale
                    );
                }
            }
        }
    }

    updateScrollPosition() {
        if (this.div) {
            const { axisController } = this.props;

            if (axisController.position === "x") {
                const newScrollPosition =
                    (axisController.from - this.from) * axisController.scale;
                const oldScrollPosition = this.div.scrollLeft;
                if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                    this.div.scrollLeft = newScrollPosition;
                }
            } else {
                const newScrollPosition =
                    this.div.scrollHeight -
                    (axisController.from - this.from) * axisController.scale -
                    this.div.clientHeight;
                const oldScrollPosition = this.div.scrollTop;
                if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                    this.div.scrollTop = newScrollPosition;
                }
            }
        }
    }

    componentDidMount() {
        this.updateScrollPosition();
    }

    componentDidUpdate() {
        this.updateScrollPosition();
    }

    render() {
        const { axisController } = this.props;

        if (!axisController.isScrollBarEnabled) {
            return null;
        }

        const chartsController = axisController.chartsController;

        let track = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };

        let divStyle: React.CSSProperties;
        let innerDivStyle: React.CSSProperties;

        let rangePx = this.range * axisController.scale;

        if (axisController.position === "x") {
            track.x = chartsController.chartLeft;
            track.y = chartsController.xAxisHeight - SCROLL_BAR_SIZE;
            track.width = chartsController.chartWidth;
            track.height = SCROLL_BAR_SIZE;

            divStyle = {
                width: track.width,
                height: track.height,
                overflowY: "hidden",
                overflowX: "auto"
            };

            innerDivStyle = {
                width: rangePx,
                height: track.height
            };
        } else {
            track.x =
                axisController.position === "y"
                    ? chartsController.chartLeft -
                      chartsController.minLeftMargin
                    : chartsController.chartRight +
                      chartsController.minRightMargin -
                      SCROLL_BAR_SIZE;
            track.y = chartsController.chartTop;
            track.width = SCROLL_BAR_SIZE;
            track.height = chartsController.chartHeight;

            divStyle = {
                width: track.width,
                height: track.height,
                overflowX: "hidden",
                overflowY: "auto"
            };

            innerDivStyle = {
                width: track.width,
                height: rangePx
            };
        }

        return (
            <foreignObject
                x={track.x}
                y={track.y}
                width={track.width}
                height={track.height}
            >
                <div
                    ref={ref => (this.div = ref)}
                    style={divStyle}
                    onScroll={this.onScroll}
                >
                    <div style={innerDivStyle} />
                </div>
            </foreignObject>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class AxisView extends React.Component<
    {
        axisController: AxisController;
    },
    {}
> {
    render() {
        const { axisController } = this.props;
        const chartsController = axisController.chartsController;

        let x1;
        let y1;

        if (axisController.position === "x") {
            x1 = chartsController.chartLeft + ZOOM_ICON_SIZE / 2;
            y1 =
                chartsController.xAxisHeight - SCROLL_BAR_SIZE - ZOOM_ICON_SIZE;
        } else if (axisController.position === "y") {
            x1 =
                chartsController.chartLeft -
                chartsController.minLeftMargin +
                SCROLL_BAR_SIZE;
            y1 = chartsController.chartBottom - (3 * ZOOM_ICON_SIZE) / 2;
        } else {
            x1 =
                chartsController.chartRight +
                chartsController.minRightMargin -
                ZOOM_ICON_SIZE -
                SCROLL_BAR_SIZE;
            y1 = chartsController.chartBottom - (3 * ZOOM_ICON_SIZE) / 2;
        }

        let x2;
        let y2;

        if (axisController.position === "x") {
            x2 = chartsController.chartRight - (3 * ZOOM_ICON_SIZE) / 2;
            y2 = y1;
        } else if (axisController.position === "y") {
            x2 = x1;
            y2 =
                chartsController.chartBottom -
                (chartsController.chartHeight - ZOOM_ICON_SIZE / 2);
        } else {
            x2 = x1;
            y2 =
                chartsController.chartBottom -
                (chartsController.chartHeight - ZOOM_ICON_SIZE / 2);
        }

        return (
            <g>
                {axisController.position !== "x" && (
                    <AxisLines axisController={axisController} />
                )}
                {chartsController.viewOptions.showAxisLabels &&
                    (chartsController.viewOptions.axesLines.type ===
                        "dynamic" ||
                        !axisController.isAnimationActive) &&
                    !axisController.isDigital && (
                        <AxisLabels axisController={axisController} />
                    )}

                {chartsController.areZoomButtonsVisible &&
                    !axisController.isDigital &&
                    axisController.zoomOutEnabled && (
                        <SvgButton
                            icon={SVG_ICON_ZOOM_OUT}
                            x={Math.round(x1) + 0.5}
                            y={Math.round(y1) + 0.5}
                            width={ZOOM_ICON_SIZE}
                            height={ZOOM_ICON_SIZE}
                            padding={ZOOM_ICON_PADDING}
                            onClick={this.props.axisController.zoomOut}
                        />
                    )}

                {chartsController.areZoomButtonsVisible &&
                    !axisController.isDigital &&
                    axisController.zoomInEnabled && (
                        <SvgButton
                            icon={SVG_ICON_ZOOM_IN}
                            x={Math.round(x2) + 0.5}
                            y={Math.round(y2) + 0.5}
                            width={ZOOM_ICON_SIZE}
                            height={ZOOM_ICON_SIZE}
                            padding={ZOOM_ICON_PADDING}
                            onClick={this.props.axisController.zoomIn}
                        />
                    )}

                {!axisController.isDigital && (
                    <AxisScrollBar axisController={axisController} />
                )}
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Bookmark extends React.Component<
    {
        chartController: ChartController;
        index: number;
        x: number;
        y1: number;
        y2: number;
    },
    {}
> {
    @observable
    mouseOver = false;

    onMouseEnter = action(() => (this.mouseOver = true));

    onMouseLeave = action(() => (this.mouseOver = false));

    onClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        this.props.chartController.chartsController.selectBookmark(
            this.props.index
        );
    };

    render() {
        const { chartController, index, x, y1, y2 } = this.props;
        const chartsController = chartController.chartsController;
        return (
            <g
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
                onMouseDown={this.onClick}
            >
                <line
                    x1={x}
                    y1={y1}
                    x2={x}
                    y2={y2}
                    strokeWidth={10}
                    stroke={"transparent"}
                />
                <line
                    x1={x}
                    y1={y1}
                    x2={x}
                    y2={y2}
                    strokeWidth={
                        index == chartsController.selectedBookmark ||
                        this.mouseOver
                            ? 3
                            : 1
                    }
                    stroke={"blue"}
                />
            </g>
        );
    }
}

@observer
class Bookmarks extends React.Component<
    {
        chartController: ChartController;
    },
    {}
> {
    render() {
        const { chartController } = this.props;
        const chartsController = chartController.chartsController;
        const axisController = chartController.xAxisController;

        if (!chartsController.bookmarks) {
            return null;
        }

        const x1 = chartsController.chartLeft;
        const x2 = chartsController.chartLeft + chartsController.chartWidth;
        const y1 = chartsController.chartTop;
        const y2 = chartsController.chartTop + chartsController.chartHeight;

        const visibleBookmarks = chartsController.bookmarks
            .map((bookmark, i) => ({
                index: i,
                x:
                    chartsController.chartLeft +
                    axisController.valueToPx(bookmark.value)
            }))
            .filter(bookmark => bookmark.x >= x1 && bookmark.x <= x2);

        if (visibleBookmarks.length == 0) {
            return 0;
        }

        return (
            <>
                {visibleBookmarks.map(bookmark => (
                    <Bookmark
                        key={bookmark.index}
                        chartController={chartController}
                        index={bookmark.index}
                        x={bookmark.x}
                        y1={y1}
                        y2={y2}
                    />
                ))}
            </>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface MouseHandler {
    cursor: string;
    down(point: SVGPoint, event: PointerEvent): void;
    move(point: SVGPoint, event: PointerEvent): void;
    up(
        point: SVGPoint | undefined,
        event: PointerEvent | undefined,
        cancel: boolean
    ): void;
    updateCursor(event: PointerEvent | undefined, cursor: ICursor): void;
    render(): JSX.Element | null;
}

export function getSnapToValue(
    event: PointerEvent | undefined,
    value: number,
    axisController: AxisController
): number {
    let snapValue: number | undefined = undefined;

    if (
        !(event && event.shiftKey) &&
        axisController.chartsController.viewOptions.axesLines.snapToGrid
    ) {
        axisController.ticks.forEach(tick => {
            if (
                tick.allowSnapTo &&
                (snapValue === undefined ||
                    Math.abs(value - tick.value) < Math.abs(value - snapValue))
            ) {
                snapValue = tick.value;
            }
        });
    }

    return snapValue !== undefined ? snapValue : value;
}

class PanMouseHandler implements MouseHandler {
    constructor(private axes: AxisController[]) {}

    lastPoint: Point = { x: 0, y: 0 };

    cursor = "default";

    down(point: SVGPoint, event: PointerEvent) {
        this.lastPoint = point;
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        for (let i = 0; i < this.axes.length; i++) {
            let d;
            if (this.axes[i].position === "x") {
                d = this.lastPoint.x - point.x;
            } else {
                d = this.lastPoint.y - point.y;
            }
            this.axes[i].panByDistanceInPx(d);
        }

        this.lastPoint = point;
    }

    up(
        point: SVGPoint | undefined,
        event: PointerEvent | undefined,
        cancel: boolean
    ) {}

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = false;
    }

    render() {
        return null;
    }
}

class ZoomToRectMouseHandler implements MouseHandler {
    static MIN_SIZE = 5;

    constructor(private chartController: ChartController) {}

    @observable startPoint: Point = { x: 0, y: 0 };
    @observable endPoint: Point = { x: 0, y: 0 };
    @observable orientation: "x" | "y" | "both" | undefined = undefined;

    cursor = "default";

    clamp(point: SVGPoint) {
        return {
            x: clamp(
                point.x,
                0,
                this.chartController.xAxisController.distancePx
            ),
            y: clamp(
                point.y,
                0,
                this.chartController.yAxisController.distancePx
            )
        };
    }

    @action
    down(point: SVGPoint, event: PointerEvent) {
        this.startPoint = this.clamp(point);
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        this.endPoint = this.clamp(point);

        const width = Math.abs(this.startPoint.x - this.endPoint.x);
        const height = Math.abs(this.startPoint.y - this.endPoint.y);

        if (width / height > 4) {
            this.orientation = "x";
        } else if (height / width > 4) {
            this.orientation = "y";
        } else {
            this.orientation = "both";
        }
    }

    up(
        point: SVGPoint | undefined,
        event: PointerEvent | undefined,
        cancel: boolean
    ) {
        if (cancel) {
            return;
        }

        const chartsController = this.chartController.chartsController;

        if (this.orientation === "x" || this.orientation === "both") {
            const xAxisController = chartsController.xAxisController;
            let fromPx = Math.min(this.startPoint.x, this.endPoint.x);
            let toPx = Math.max(this.startPoint.x, this.endPoint.x);
            if (toPx - fromPx >= ZoomToRectMouseHandler.MIN_SIZE) {
                xAxisController.zoom(
                    xAxisController.pxToLinearValue(fromPx),
                    xAxisController.pxToLinearValue(toPx)
                );
            }
        }

        if (this.orientation === "y" || this.orientation === "both") {
            const yAxisController = this.chartController.yAxisController;
            let fromPx = Math.min(this.startPoint.y, this.endPoint.y);
            let toPx = Math.max(this.startPoint.y, this.endPoint.y);
            if (toPx - fromPx >= ZoomToRectMouseHandler.MIN_SIZE) {
                yAxisController.zoom(
                    yAxisController.pxToLinearValue(fromPx),
                    yAxisController.pxToLinearValue(toPx)
                );
            }
        }
    }

    @computed
    get xLabel() {
        let label;

        if (this.orientation === "x" || this.orientation === "both") {
            const xAxisController =
                this.chartController.chartsController.xAxisController;
            let fromPx = Math.min(this.startPoint.x, this.endPoint.x);
            let toPx = Math.max(this.startPoint.x, this.endPoint.x);
            let from = xAxisController.pxToLinearValue(fromPx);
            let to = xAxisController.pxToLinearValue(toPx);
            label = `X1 = ${xAxisController.unit.formatValue(
                from,
                3
            )}, X2 = ${xAxisController.unit.formatValue(
                to,
                3
            )}, ΔX = ${xAxisController.unit.formatValue(to - from, 3)}`;
        }

        return label;
    }

    @computed
    get yLabel() {
        let label;

        if (this.orientation === "y" || this.orientation === "both") {
            const yAxisController = this.chartController.yAxisController;
            let fromPx = Math.min(this.startPoint.y, this.endPoint.y);
            let toPx = Math.max(this.startPoint.y, this.endPoint.y);
            let from = yAxisController.pxToLinearValue(fromPx);
            let to = yAxisController.pxToLinearValue(toPx);
            label = `Y1 = ${yAxisController.unit.formatValue(
                from,
                3
            )}, Y2 = ${yAxisController.unit.formatValue(
                to,
                3
            )}, ΔY = ${yAxisController.unit.formatValue(to - from, 3)}`;
        }

        return label;
    }

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = false;
    }

    render() {
        if (!this.startPoint || !this.endPoint || !this.orientation) {
            return null;
        }

        const chartsController = this.chartController.chartsController;

        let x = Math.min(this.startPoint.x, this.endPoint.x);
        let y = Math.max(this.startPoint.y, this.endPoint.y);
        let width = Math.abs(this.startPoint.x - this.endPoint.x);
        let height = Math.abs(this.startPoint.y - this.endPoint.y);

        if (this.orientation === "x") {
            y = chartsController.chartHeight;
            height = chartsController.chartHeight;
            if (height < ZoomToRectMouseHandler.MIN_SIZE) {
                return null;
            }
        } else if (this.orientation === "y") {
            x = 0;
            width = chartsController.chartWidth;
            if (width < ZoomToRectMouseHandler.MIN_SIZE) {
                return null;
            }
        } else {
            if (
                width < ZoomToRectMouseHandler.MIN_SIZE ||
                height < ZoomToRectMouseHandler.MIN_SIZE
            ) {
                return null;
            }
        }

        return (
            <>
                <rect
                    className="EezStudio_ZoomRectangle"
                    x={chartsController.chartLeft + x}
                    y={chartsController.chartBottom - y}
                    width={width}
                    height={height}
                />
                {this.xLabel && !this.yLabel && (
                    <SvgLabel
                        text={this.xLabel}
                        x={chartsController.chartLeft + x + width / 2}
                        y={chartsController.chartBottom - y + height / 2}
                        horizontalAlignement="center"
                        verticalAlignment="center"
                    ></SvgLabel>
                )}
                {!this.xLabel && this.yLabel && (
                    <SvgLabel
                        text={this.yLabel}
                        x={chartsController.chartLeft + x + width / 2}
                        y={chartsController.chartBottom - y + height / 2}
                        horizontalAlignement="center"
                        verticalAlignment="center"
                    ></SvgLabel>
                )}
                {this.xLabel && this.yLabel && (
                    <>
                        <SvgLabel
                            text={this.xLabel}
                            x={chartsController.chartLeft + x + width / 2}
                            y={
                                chartsController.chartBottom -
                                y +
                                height / 2 -
                                2
                            }
                            horizontalAlignement="center"
                            verticalAlignment="bottom"
                        ></SvgLabel>
                        <SvgLabel
                            text={this.yLabel}
                            x={chartsController.chartLeft + x + width / 2}
                            y={
                                chartsController.chartBottom -
                                y +
                                height / 2 +
                                2
                            }
                            horizontalAlignement="center"
                            verticalAlignment="top"
                        ></SvgLabel>
                    </>
                )}
            </>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface ICursor {
    visible: boolean;
    lineController: ILineController;
    time: number;
    value: number;
    valueIndex: number;
    addPoint: boolean;
    error?: string;
    fillColor?: string;
    strokeColor?: string;
}

@observer
class CursorPopover extends React.Component<{ cursor: ICursor }, {}> {
    render() {
        const { cursor } = this.props;

        const yAxisController = cursor.lineController.yAxisController;
        const xAxisController =
            yAxisController.chartsController.xAxisController;

        const time = xAxisController.unit.formatValue(
            xAxisController.axisModel.semiLogarithmic
                ? Math.pow(
                      10,
                      cursor.time + xAxisController.axisModel.semiLogarithmic.a
                  ) + xAxisController.axisModel.semiLogarithmic.b
                : cursor.time,
            4
        );
        const value = cursor.lineController.yAxisController.unit.formatValue(
            yAxisController.axisModel.semiLogarithmic
                ? Math.pow(
                      10,
                      cursor.value + yAxisController.axisModel.semiLogarithmic.a
                  ) + yAxisController.axisModel.semiLogarithmic.b
                : cursor.value,
            5
        );

        return (
            <React.Fragment>
                <div>{`(${time}, ${value})`}</div>
                <div className="text-danger">{cursor.error}</div>
            </React.Fragment>
        );
    }
}

class Cursor implements ICursor {
    @observable visible: boolean = false;
    @observable lineController: ILineController;
    @observable time: number = 0;
    @observable value: number = 0;
    @observable valueIndex: number = 0;
    @observable addPoint: boolean = false;
    @observable error: string | undefined = undefined;
    cursorElement: SVGElement | null = null;
    cursorPopover: any = undefined;

    @observable fillColor: string | undefined;
    @observable strokeColor: string | undefined;

    constructor(private chartView: ChartView) {}

    get xAxisController() {
        return this.chartView.props.chartController.xAxisController;
    }

    get yAxisController() {
        return this.lineController.yAxisController;
    }

    updateCursor(point: Point | undefined, event: PointerEvent | undefined) {
        this.visible = false;

        const { chartWidth, chartHeight } =
            this.chartView.props.chartController.chartsController;
        if (
            !point ||
            !event ||
            point.x < 0 ||
            point.x > chartWidth ||
            point.y < 0 ||
            point.y > chartHeight
        ) {
            return;
        }

        const cursors =
            this.chartView.props.chartController.lineControllers.map(
                lineController => {
                    const cursor: ICursor = {
                        visible: false,
                        lineController,
                        time: 0,
                        value: 0,
                        valueIndex: -1,
                        addPoint: false
                    };
                    lineController.updateCursor(cursor, point, event);
                    return cursor;
                }
            );

        let minDistance = Number.MAX_SAFE_INTEGER;
        let minDistanceIndex: number = -1;
        cursors.forEach((cursor, i) => {
            if (cursor.visible) {
                const lineController =
                    this.chartView.props.chartController.lineControllers[i];
                const closestPoint = lineController.closestPoint(point);
                if (closestPoint) {
                    let distance = pointDistance(closestPoint, point);
                    if (minDistanceIndex === -1 || distance < minDistance) {
                        minDistanceIndex = i;
                        minDistance = distance;
                    }
                }
            }
        });

        if (minDistanceIndex != -1) {
            this.visible = true;
            this.lineController = cursors[minDistanceIndex].lineController;
            this.time = cursors[minDistanceIndex].time;
            this.value = cursors[minDistanceIndex].value;
            this.valueIndex = cursors[minDistanceIndex].valueIndex;
            this.addPoint = cursors[minDistanceIndex].addPoint;
            this.error = cursors[minDistanceIndex].error;
            this.fillColor = cursors[minDistanceIndex].fillColor;
            this.strokeColor = cursors[minDistanceIndex].strokeColor;
        }

        if (!this.visible) {
            this.hidePopover();
        }
    }

    @action
    onMouseEvent(
        event: PointerEvent | undefined,
        mouseHandler: MouseHandler | undefined
    ) {
        if (mouseHandler) {
            mouseHandler.updateCursor(event, this);
        } else {
            let point;
            if (event) {
                point = this.chartView.transformEventPoint(event);
            }
            this.updateCursor(point, event);
        }
    }

    onPointerMove = (event: PointerEvent) => {
        if (
            event.target instanceof Element &&
            this.chartView.svg &&
            !$.contains(this.chartView.svg, event.target) &&
            event.target != this.chartView.svg &&
            this.cursorPopover
        ) {
            this.hidePopover();
        }
    };

    showPopover() {
        if (this.cursorElement) {
            let content = document.createElement("div");
            ReactDOM.render(<CursorPopover cursor={this} />, content);
            this.cursorPopover = new bootstrap.Popover(this.cursorElement, {
                content,
                html: true,
                placement: "top",
                delay: {
                    show: 0,
                    hide: 0
                },
                trigger: "manual"
            });
            this.cursorPopover.show();
            this.cursorElement.style.pointerEvents = "none";
            window.addEventListener("pointermove", this.onPointerMove, true);
        }
    }

    @action
    hidePopover() {
        this.visible = false;
        if (this.cursorPopover) {
            window.removeEventListener("pointermove", this.onPointerMove, true);
            this.cursorPopover.dispose();
            this.cursorPopover = undefined;
        }
    }

    update() {
        if (this.cursorElement) {
            if (this.cursorPopover) {
                this.cursorPopover.update();
            } else {
                this.showPopover();
            }
        } else {
            this.hidePopover();
        }
    }

    render() {
        if (!this.visible || !this.lineController) {
            return null;
        }

        let point = {
            x:
                Math.round(
                    this.lineController.yAxisController.chartsController
                        .chartLeft + this.xAxisController.valueToPx(this.time)
                ) + 0.5,
            y:
                Math.round(
                    this.lineController.yAxisController.chartsController
                        .chartBottom -
                        this.yAxisController.valueToPx(this.value)
                ) + 0.5
        };

        const className = classNames("EezStudio_ChartView_Cursor", {
            EezStudio_ChartView_Cursor_AddPoint: this.addPoint,
            error: !!this.error
        });

        return (
            <g className={className}>
                <circle
                    ref={ref => (this.cursorElement = ref)}
                    cx={point.x}
                    cy={point.y}
                    r={CONF_CURSOR_RADIUS}
                    fill={
                        this.fillColor || this.yAxisController.axisModel.color
                    }
                    stroke={
                        this.strokeColor || this.yAxisController.axisModel.color
                    }
                />
                {this.addPoint && (
                    <React.Fragment>
                        <rect
                            x={point.x - CONF_CURSOR_RADIUS / 8}
                            y={point.y - (CONF_CURSOR_RADIUS * 2) / 3}
                            width={CONF_CURSOR_RADIUS / 4}
                            height={(CONF_CURSOR_RADIUS * 4) / 3}
                            fill={
                                this.fillColor ||
                                this.yAxisController.axisModel.color
                            }
                        />
                        <rect
                            x={point.x - (CONF_CURSOR_RADIUS * 2) / 3}
                            y={point.y - CONF_CURSOR_RADIUS / 8}
                            width={(CONF_CURSOR_RADIUS * 4) / 3}
                            height={CONF_CURSOR_RADIUS / 4}
                            fill={
                                this.fillColor ||
                                this.yAxisController.axisModel.color
                            }
                        />
                    </React.Fragment>
                )}
            </g>
        );
    }

    unmount() {
        this.hidePopover();
    }
}

////////////////////////////////////////////////////////////////////////////////

export type ChartMode = "preview" | "interactive" | "editable";

@observer
export class ChartView extends React.Component<
    {
        chartController: ChartController;
        mode: ChartMode;
    },
    {}
> {
    svg: SVGSVGElement | null = null;
    deltaY: number = 0;
    cursor = new Cursor(this);
    @observable mouseHandler: MouseHandler | undefined;
    clipId = "c_" + guid();
    draggable = new Draggable(this);

    transformEventPoint(event: { clientX: number; clientY: number }) {
        let point = this.svg!.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        point = point.matrixTransform(this.svg!.getScreenCTM()!.inverse());
        point.x -= this.props.chartController.chartsController.chartLeft;
        point.y =
            this.props.chartController.chartsController.chartBottom - point.y;
        return point;
    }

    handleMouseWheelPanAndZoom(
        event: React.WheelEvent<SVGSVGElement>,
        pivotPx: number,
        axisController: AxisController
    ) {
        this.deltaY += event.deltaY;
        if (Math.abs(this.deltaY) > 10) {
            if (event.ctrlKey) {
                axisController.zoomAroundPivotPoint(pivotPx, this.deltaY < 0);
            } else {
                runInAction(() => {
                    axisController.panByDirection(this.deltaY < 0 ? 1 : -1);
                });
            }

            this.deltaY = 0;
        }
    }

    onWheelEnclosure = (event: WheelEvent) => {
        event.preventDefault();
    };

    @action.bound
    onWheel(event: React.WheelEvent<SVGSVGElement>) {
        if (this.props.mode === "preview") {
            return;
        }

        event.stopPropagation();

        this.cursor.visible = false;

        let point = this.transformEventPoint(event);
        if (point.x < 0) {
            this.handleMouseWheelPanAndZoom(
                event,
                point.y,
                this.props.chartController.yAxisController
            );
        } else if (
            point.x > this.props.chartController.chartsController.chartWidth &&
            this.props.chartController.yAxisControllerOnRightSide
        ) {
            this.handleMouseWheelPanAndZoom(
                event,
                point.y,
                this.props.chartController.yAxisControllerOnRightSide
            );
        } else {
            if (event.shiftKey) {
                if (
                    !this.props.chartController.yAxisControllerOnRightSide ||
                    point.x <
                        this.props.chartController.chartsController.chartWidth /
                            2
                ) {
                    this.handleMouseWheelPanAndZoom(
                        event,
                        point.y,
                        this.props.chartController.yAxisController
                    );
                } else {
                    this.handleMouseWheelPanAndZoom(
                        event,
                        point.y,
                        this.props.chartController.yAxisControllerOnRightSide
                    );
                }
            } else {
                this.handleMouseWheelPanAndZoom(
                    event,
                    point.x,
                    this.props.chartController.chartsController.xAxisController
                );
            }
        }
    }

    @action.bound
    onDragStart(event: PointerEvent) {
        if (this.mouseHandler) {
            this.mouseHandler.up(undefined, undefined, true);
            this.mouseHandler = undefined;
        }

        let point = this.transformEventPoint(event);

        /*if (point.x < 0) {
            this.mouseHandler = new PanMouseHandler([this.props.chartController.yAxisController]);
        } else if (point.y < 0) {
            this.mouseHandler = new PanMouseHandler([this.props.chartController.xAxisController]);
        } else */ if (event.buttons === 1) {
            if (this.cursor && this.cursor.visible && this.cursor.addPoint) {
                this.mouseHandler = this.cursor.lineController.addPoint(
                    this,
                    this.cursor
                );
            } else {
                this.mouseHandler = this.props.chartController.onDragStart(
                    this,
                    event
                );
            }
        } else {
            this.mouseHandler = new PanMouseHandler(
                this.props.chartController.axes
            );
        }

        if (this.mouseHandler) {
            this.mouseHandler.down(point, event);
        }

        this.cursor.onMouseEvent(event, this.mouseHandler);
    }

    onDragMove = (event: PointerEvent) => {
        if (this.mouseHandler) {
            if (event.buttons) {
                let point = this.transformEventPoint(event);
                this.mouseHandler.move(point, event);
            } else {
                this.mouseHandler.up(undefined, undefined, true);
                this.mouseHandler = undefined;
            }
        }

        this.cursor.onMouseEvent(event, this.mouseHandler);
    };

    onMove = (event: PointerEvent) => {
        this.cursor.onMouseEvent(event, this.mouseHandler);
    };

    @action.bound
    onDragEnd(event: PointerEvent, cancel: boolean) {
        let point = event && this.transformEventPoint(event);
        if (this.mouseHandler) {
            this.mouseHandler.up(point, event, cancel);
            this.mouseHandler = undefined;
        }

        this.cursor.onMouseEvent(event, this.mouseHandler);
    }

    componentDidMount() {
        this.draggable.element!.addEventListener(
            "wheel",
            this.onWheelEnclosure,
            { passive: false }
        );
    }

    componentDidUpdate() {
        this.cursor.update();
    }

    componentWillUnmount() {
        this.draggable.element!.removeEventListener(
            "mousewheel",
            this.onWheelEnclosure
        );

        if (this.mouseHandler) {
            this.mouseHandler.up(undefined, undefined, true);
        }
        this.cursor.unmount();
        this.draggable.attach(null);
    }

    render() {
        const { chartController } = this.props;
        const chartsController = chartController.chartsController;

        let color = globalViewOptions.blackBackground
            ? chartController.xAxisController.axisModel.color
            : chartController.xAxisController.axisModel.colorInverse;

        let isNonEmpty = chartsController.xAxisController.range > 0;

        let chartXAxisTitle;
        let chartTitle;
        if (isNonEmpty) {
            chartXAxisTitle = chartController.xAxisController.axisModel
                .label && (
                <div
                    className="EezStudio_Chart_Title"
                    style={{
                        color: color,
                        right: `calc(100% - ${chartsController.chartRight}px)`,
                        bottom: `calc(100% - ${chartsController.chartBottom}px)`,
                        borderColor: color
                    }}
                >
                    {chartController.xAxisController.axisModel.label}
                </div>
            );

            color = globalViewOptions.blackBackground
                ? chartController.yAxisController.axisModel.color
                : chartController.yAxisController.axisModel.colorInverse;

            chartTitle = chartController.yAxisController.axisModel.label && (
                <div
                    className="EezStudio_Chart_Title"
                    style={{
                        color: color,
                        left: chartsController.chartLeft,
                        top: chartsController.chartTop,
                        borderColor: color
                    }}
                >
                    {chartController.yAxisController.axisModel.label}
                </div>
            );

            if (chartController.yAxisControllerOnRightSide) {
                const color = globalViewOptions.blackBackground
                    ? chartController.yAxisControllerOnRightSide.axisModel.color
                    : chartController.yAxisControllerOnRightSide.axisModel
                          .colorInverse;

                chartTitle = (
                    <React.Fragment>
                        {chartTitle}
                        <div
                            className="EezStudio_Chart_Title"
                            style={{
                                color: color,
                                right:
                                    (chartsController.chartViewWidth || 0) -
                                    chartsController.chartRight,
                                top: chartsController.chartTop,
                                borderColor: color
                            }}
                        >
                            {
                                chartController.yAxisControllerOnRightSide
                                    .axisModel.label
                            }
                        </div>
                    </React.Fragment>
                );
            }
        }

        return (
            <div
                className="EezStudio_ChartContainer"
                ref={ref => this.draggable.attach(ref)}
            >
                <svg
                    className="EezStudio_Chart"
                    ref={ref => (this.svg = ref!)}
                    onWheel={this.onWheel}
                >
                    {chartController.customRender()}

                    {isNonEmpty && (
                        <AxisLines
                            axisController={chartController.xAxisController}
                        />
                    )}
                    {isNonEmpty && (
                        <AxisView
                            axisController={chartController.yAxisController}
                        />
                    )}
                    {isNonEmpty &&
                        chartController.yAxisControllerOnRightSide && (
                            <AxisView
                                axisController={
                                    chartController.yAxisControllerOnRightSide
                                }
                            />
                        )}

                    <ChartBorder
                        chartsController={chartController.chartsController}
                    />

                    <defs>
                        <clipPath id={this.clipId}>
                            <rect
                                x={chartsController.chartLeft}
                                y={chartsController.chartTop}
                                width={chartsController.chartWidth}
                                height={chartsController.chartHeight}
                            />
                        </clipPath>
                    </defs>

                    <g
                        cursor={
                            (this.mouseHandler && this.mouseHandler.cursor) ||
                            (this.cursor &&
                                this.cursor.visible &&
                                this.cursor.addPoint &&
                                "copy") ||
                            "default"
                        }
                    >
                        {/* This is required to catch pointer events inside chart */}
                        <rect
                            x={chartsController.chartLeft}
                            y={chartsController.chartTop}
                            width={chartsController.chartWidth}
                            height={chartsController.chartHeight}
                            fillOpacity={0}
                        />

                        {chartsController.chartViewWidth &&
                            chartController.lineControllers.map(
                                lineController =>
                                    lineController.render(this.clipId)
                            )}

                        {this.cursor.render()}

                        {this.props.mode !== "preview" &&
                            chartsController.rulersController &&
                            chartsController.rulersController.render(this)}

                        {this.mouseHandler && this.mouseHandler.render()}
                    </g>
                    {isNonEmpty &&
                        chartController.chartsController.bookmarks && (
                            <Bookmarks chartController={chartController} />
                        )}
                </svg>
                {chartTitle}
                {chartXAxisTitle}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

function Arrow() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="arrow"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            strokeWidth="1"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <line x1="5" y1="12" x2="19" y2="12" />
            <line x1="15" y1="16" x2="19" y2="12" />
            <line x1="15" y1="8" x2="19" y2="12" />
        </svg>
    );
}

function HelpView(props: any) {
    return (
        <div className="EezStudio_HelpView">
            <table>
                <tbody>
                    <tr>
                        <td>
                            <img
                                width="46"
                                height="64"
                                src="../eez-studio-ui/_images/mouse_middle_button.png"
                            ></img>
                            <span className="text">or</span>
                            <img
                                width="46"
                                height="64"
                                src="../eez-studio-ui/_images/mouse_right_button.png"
                            ></img>
                        </td>
                        <td>
                            <Arrow />
                        </td>
                        <td>
                            <span className="text">Drag chart</span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <img
                                width="46"
                                height="64"
                                src="../eez-studio-ui/_images/mouse_wheel.png"
                            ></img>
                        </td>
                        <td>
                            <Arrow />
                        </td>
                        <td>
                            <span className="text">X-Axis Offset</span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span className="key">CTRL</span>
                            <span className="text">+</span>
                            <img
                                width="46"
                                height="64"
                                src="../eez-studio-ui/_images/mouse_wheel.png"
                            ></img>
                        </td>
                        <td>
                            <Arrow />
                        </td>
                        <td>
                            <span className="text">X-Axis Zoom</span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span className="key">SHIFT</span>
                            <span className="text">+</span>
                            <img
                                width="46"
                                height="64"
                                src="../eez-studio-ui/_images/mouse_wheel.png"
                            ></img>
                        </td>
                        <td>
                            <Arrow />
                        </td>
                        <td>
                            <span className="text">Y-Axis Offset</span>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <span className="key">SHIFT</span>
                            <span className="text" style={{ marginRight: 12 }}>
                                +
                            </span>
                            <span className="key">CTRL</span>
                            <span className="text">+</span>
                            <img
                                width="46"
                                height="64"
                                src="../eez-studio-ui/_images/mouse_wheel.png"
                            ></img>
                        </td>
                        <td>
                            <Arrow />
                        </td>
                        <td>
                            <span className="text">Y-Axis Zoom</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

interface IAnimation {
    step(t: number): void;
}

class AnimationController {
    animationState:
        | {
              duration: number;
              animation: IAnimation;
              startTime: number;
          }
        | undefined;

    animate(duration: number, animation: IAnimation) {
        this.finish();

        this.animationState = {
            duration,
            animation,
            startTime: new Date().getTime()
        };
    }

    finish() {
        if (this.animationState) {
            this.animationState.animation.step(1);
            this.animationState = undefined;
        }
    }

    frameAnimation() {
        if (this.animationState) {
            let t = clamp(
                (new Date().getTime() - this.animationState.startTime) /
                    this.animationState.duration,
                0,
                1
            );
            this.animationState.animation.step(t);
            if (t === 1) {
                this.animationState = undefined;
            }
        }
    }
}

function getAxisController(chartsController: ChartsController) {
    if (chartsController.viewOptions.axesLines.type === "dynamic") {
        return new DynamicAxisController(
            "x",
            chartsController,
            undefined,
            chartsController.xAxisModel
        );
    } else {
        return new FixedAxisController(
            "x",
            chartsController,
            undefined,
            chartsController.xAxisModel
        );
    }
}

export abstract class AxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: ChartsController,
        public chartController: ChartController | undefined,
        public axisModel: IAxisModel
    ) {}

    get unit() {
        return this.axisModel.unit;
    }

    @observable labelTextsWidth: number = 0;
    @observable labelTextsHeight: number = 0;

    @observable isAnimationActive: boolean = false;
    animationController = new AnimationController();

    isDigital = false;

    get logarithmic() {
        return this.axisModel.logarithmic;
    }

    abstract get from(): number;
    abstract get to(): number;

    @computed
    get isScrollBarEnabled() {
        return (
            (this.from > this.minValue || this.to < this.maxValue) &&
            this.range != 0
        );
    }

    get _minValue() {
        return this.position === "x"
            ? this.chartsController.minValue
            : this.chartController!.minValue[this.position];
    }

    @computed
    get minValue() {
        return this._minValue;
    }

    get _maxValue() {
        return this.position === "x"
            ? this.chartsController.maxValue
            : this.chartController!.maxValue[this.position];
    }

    @computed
    get maxValue() {
        return this._maxValue;
    }

    @computed
    get range() {
        return this.maxValue - this.minValue;
    }

    @computed
    get distancePx() {
        return this.position === "x"
            ? this.chartsController.chartWidth
            : this.chartsController.chartHeight;
    }

    @computed
    get distance() {
        return this.to - this.from || 1;
    }

    @computed
    get scale() {
        return this.distancePx / this.distance;
    }

    @computed
    get minScale() {
        return 1e-15;
    }

    @computed
    get maxScale() {
        return 1e15;
    }

    toLogScale(value: number) {
        value = Math.pow(
            10,
            (value * Math.log10(this.maxValue)) / this.maxValue
        );
        if (value < this.minValue) {
            value = this.minValue;
        } else if (value > this.maxValue) {
            value = this.maxValue;
        }
        return value;
    }

    fromLogScale(value: number) {
        value = (Math.log10(value) * this.maxValue) / Math.log10(this.maxValue);
        if (value < this.minValue) {
            value = this.minValue;
        } else if (value > this.maxValue) {
            value = this.maxValue;
        }
        return value;
    }

    pxToLinearValue(px: number) {
        return this.from + px / this.scale;
    }

    pxToValue(px: number) {
        if (this.axisModel.logarithmic) {
            return this.toLogScale(this.pxToLinearValue(px));
        } else {
            return this.pxToLinearValue(px);
        }
    }

    linearValueToPx(value: number) {
        return (value - this.from) * this.scale;
    }

    valueToPx(value: number) {
        if (this.axisModel.logarithmic) {
            return this.linearValueToPx(this.fromLogScale(value));
        } else {
            return this.linearValueToPx(value);
        }
    }

    abstract get ticks(): ITick[];

    panByDistanceInPx(distanceInPx: number) {
        return this.panByDistance(distanceInPx / this.scale);
    }

    panByDistance(distance: number) {
        this.panTo(this.from + distance);
    }

    abstract panByDirection(direction: number): void;

    abstract panTo(to: number): void;

    valueToPoint(timeValue: { time: number; value: number }) {
        return {
            x: this.chartsController.xAxisController.valueToPx(timeValue.time),
            y: this.valueToPx(timeValue.value)
        };
    }

    pointToValue(point: Point) {
        return {
            time: this.chartsController.xAxisController.pxToValue(point.x),
            value: this.pxToValue(point.y)
        };
    }

    abstract zoomAll(): void;

    abstract zoomDefault(): void;

    @computed
    get zoomInEnabled() {
        return this.scale < this.maxScale;
    }

    abstract zoomIn(): void;

    @computed
    get zoomOutEnabled() {
        return this.scale > this.minScale;
    }

    abstract zoomOut(): void;

    abstract zoom(from: number, to: number): void;

    abstract zoomAroundPivotPoint(pivotPx: number, zoomIn: boolean): void;

    pageUp() {
        this.panTo(this.from + this.distance / 2);
    }

    pageDown() {
        this.panTo(this.from - this.distance / 2);
    }

    home() {
        this.panTo(this.minValue);
    }

    end() {
        this.panTo(this.maxValue - this.distance);
    }

    get numSamples() {
        let numSamples = 0;
        for (let i = 0; i < this.chartsController.lineControllers.length; ++i) {
            let waveformModel =
                this.chartsController.lineControllers[i].getWaveformModel();
            if (waveformModel && waveformModel.length > numSamples) {
                numSamples = waveformModel.length;
            }
        }
        return numSamples;
    }
}

export abstract class ChartsController {
    constructor(
        public mode: ChartMode,
        public xAxisModel: IAxisModel,
        public viewOptions: IViewOptions
    ) {}

    chartControllers: ChartController[] = [];

    @computed
    get xAxisController() {
        return getAxisController(this);
    }

    @computed
    get yAxisOnRightSideExists() {
        return this.chartControllers.find(
            chartController => !!chartController.yAxisControllerOnRightSide
        );
    }

    @observable chartViewWidth: number | undefined;
    @observable chartViewHeight: number | undefined;

    @computed
    get xAxisLabelTextsHeight() {
        return Math.max(
            CONF_MIN_X_AXIS_BAND_HEIGHT,
            this.xAxisController.labelTextsHeight
        );
    }

    @computed
    get yAxisLabelTextsWidth() {
        let maxLabelTextsWidth = 0;
        for (let i = 0; i < this.chartControllers.length; i++) {
            const chartController = this.chartControllers[i];
            if (
                chartController.yAxisController.labelTextsWidth >
                maxLabelTextsWidth
            ) {
                maxLabelTextsWidth =
                    chartController.yAxisController.labelTextsWidth;
            }
            if (
                chartController.yAxisControllerOnRightSide &&
                chartController.yAxisControllerOnRightSide.labelTextsWidth >
                    maxLabelTextsWidth
            ) {
                maxLabelTextsWidth =
                    chartController.yAxisControllerOnRightSide.labelTextsWidth;
            }
        }

        if (this.mode === "preview") {
            return maxLabelTextsWidth;
        }

        return Math.max(
            CONF_MIN_Y_SCALE_LABELS_WIDTH,
            maxLabelTextsWidth + CONF_LABEL_TICK_GAP_HORZ
        );
    }

    @computed
    get xAxisHeight() {
        let xAxisHeight = SCROLL_BAR_SIZE;
        if (
            this.viewOptions.showZoomButtons &&
            this.viewOptions.showAxisLabels
        ) {
            xAxisHeight += Math.max(ZOOM_ICON_SIZE, this.xAxisLabelTextsHeight);
        } else if (this.viewOptions.showZoomButtons) {
            xAxisHeight += ZOOM_ICON_SIZE;
        } else if (this.viewOptions.showAxisLabels) {
            xAxisHeight += this.xAxisLabelTextsHeight;
        }
        return xAxisHeight;
    }

    @computed
    get minLeftMargin() {
        let margin = SCROLL_BAR_SIZE;

        if (
            this.viewOptions.showZoomButtons &&
            this.viewOptions.showAxisLabels
        ) {
            margin += Math.max(ZOOM_ICON_SIZE, this.yAxisLabelTextsWidth);
        } else if (this.viewOptions.showZoomButtons) {
            margin += ZOOM_ICON_SIZE;
        } else if (this.viewOptions.showAxisLabels) {
            margin += this.yAxisLabelTextsWidth;
        }

        return margin;
    }

    @computed
    get minRightMargin() {
        let margin = SCROLL_BAR_SIZE;

        if (this.yAxisOnRightSideExists) {
            if (
                this.viewOptions.showZoomButtons &&
                this.viewOptions.showAxisLabels
            ) {
                margin += Math.max(ZOOM_ICON_SIZE, this.yAxisLabelTextsWidth);
            } else if (this.viewOptions.showZoomButtons) {
                margin += ZOOM_ICON_SIZE;
            } else if (this.viewOptions.showAxisLabels) {
                margin += this.yAxisLabelTextsWidth;
            }
        }

        return margin + 1;
    }

    @computed
    get minTopMargin() {
        return CONF_LABEL_TICK_GAP_VERT;
    }

    @computed
    get minBottomMargin() {
        return CONF_LABEL_TICK_GAP_VERT;
    }

    @computed
    get maxChartWidth() {
        return this.chartViewWidth
            ? Math.max(
                  this.chartViewWidth -
                      this.minLeftMargin -
                      this.minRightMargin,
                  1
              )
            : 1;
    }
    @computed
    get maxChartHeight() {
        return this.chartViewHeight
            ? Math.max(
                  this.chartViewHeight -
                      this.minTopMargin -
                      this.minBottomMargin,
                  1
              )
            : 1;
    }

    @computed
    get chartWidth() {
        if (this.viewOptions.axesLines.type === "dynamic") {
            return this.maxChartWidth;
        }

        if (
            this.maxChartWidth /
                this.viewOptions.axesLines.majorSubdivision.horizontal <
            this.maxChartHeight /
                this.viewOptions.axesLines.majorSubdivision.vertical
        ) {
            return this.maxChartWidth;
        }

        return (
            (this.viewOptions.axesLines.majorSubdivision.horizontal *
                this.maxChartHeight) /
            this.viewOptions.axesLines.majorSubdivision.vertical
        );
    }

    @computed
    get chartHeight() {
        if (this.viewOptions.axesLines.type === "dynamic") {
            return this.maxChartHeight;
        }

        if (
            this.maxChartWidth /
                this.viewOptions.axesLines.majorSubdivision.horizontal <
            this.maxChartHeight /
                this.viewOptions.axesLines.majorSubdivision.vertical
        ) {
            return (
                (this.viewOptions.axesLines.majorSubdivision.vertical *
                    this.maxChartWidth) /
                this.viewOptions.axesLines.majorSubdivision.horizontal
            );
        }

        return this.maxChartHeight;
    }

    @computed
    get leftMargin() {
        if (this.chartWidth === this.maxChartWidth) {
            return this.minLeftMargin;
        }
        return (
            this.minLeftMargin +
            Math.round((this.maxChartWidth - this.chartWidth) / 2)
        );
    }

    @computed
    get rightMargin() {
        if (this.chartWidth === this.maxChartWidth) {
            return this.minRightMargin;
        }
        return (
            this.minRightMargin +
            (this.maxChartWidth - this.chartWidth) -
            Math.round((this.maxChartWidth - this.chartWidth) / 2)
        );
    }

    @computed
    get topMargin() {
        if (this.chartHeight === this.maxChartHeight) {
            return this.minTopMargin;
        }
        return (
            this.minTopMargin +
            Math.round((this.maxChartHeight - this.chartHeight) / 2)
        );
    }

    @computed
    get bottomMargin() {
        if (this.chartHeight === this.maxChartHeight) {
            return this.minBottomMargin;
        }
        return (
            this.minBottomMargin +
            (this.maxChartHeight - this.chartHeight) -
            Math.round((this.maxChartHeight - this.chartHeight) / 2)
        );
    }

    @computed
    get chartLeft() {
        return this.leftMargin + 0.5;
    }

    @computed
    get chartTop() {
        return this.topMargin + 0.5;
    }

    @computed
    get chartRight() {
        return this.chartLeft + this.chartWidth;
    }

    @computed
    get chartBottom() {
        return this.chartTop + this.chartHeight;
    }

    @computed
    get minValue() {
        return this.chartControllers.length > 0
            ? Math.min(
                  ...this.chartControllers.map(
                      chartController => chartController.minValue.x
                  )
              )
            : 0;
    }

    @computed
    get maxValue() {
        return this.chartControllers.length > 0
            ? Math.max(
                  ...this.chartControllers.map(
                      chartController => chartController.maxValue.x
                  )
              )
            : 1;
    }

    @computed
    get isZoomAllEnabled() {
        return (
            this.xAxisController.from != this.minValue ||
            this.xAxisController.to != this.maxValue ||
            this.chartControllers.find(chartController => {
                return (
                    chartController.yAxisController.from !=
                        chartController.yAxisController.minValue ||
                    chartController.yAxisController.to !=
                        chartController.yAxisController.maxValue ||
                    (chartController.yAxisControllerOnRightSide &&
                        (chartController.yAxisController.from !=
                            chartController.yAxisController.minValue ||
                            chartController.yAxisController.to !=
                                chartController.yAxisController.maxValue))
                );
            })
        );
    }

    get areZoomButtonsVisible() {
        return this.mode !== "preview" && this.viewOptions.showZoomButtons;
    }

    @action.bound
    zoomAll() {
        this.xAxisController.zoomAll();
        this.chartControllers.forEach(chartController =>
            chartController.zoomAll()
        );
    }

    @action.bound
    zoomDefault() {
        this.xAxisController.zoomDefault();
        this.chartControllers.forEach(chartController =>
            chartController.zoomDefault()
        );
    }

    abstract get chartViewOptionsProps(): ChartViewOptionsProps;

    get supportRulers() {
        return false;
    }

    get bookmarks(): ChartBookmark[] | undefined {
        return undefined;
    }

    @computed get lineControllers() {
        const lineControllers: ILineController[] = [];

        this.chartControllers.forEach(chartController => {
            chartController.lineControllers.forEach(lineController =>
                lineControllers.push(lineController)
            );
        });

        return lineControllers;
    }

    rulersController: RulersController;
    measurementsController: MeasurementsController | undefined = undefined;

    createRulersController(rulersModel: RulersModel) {
        if (this.supportRulers && this.mode !== "preview") {
            this.rulersController = new RulersController(this, rulersModel);
        }
    }

    createMeasurementsController(measurementsModel: MeasurementsModel) {
        if (this.supportRulers && this.mode !== "preview") {
            if (this.measurementsController) {
                this.measurementsController.destroy();
            }
            this.measurementsController = new MeasurementsController(
                this,
                measurementsModel
            );
        }
    }

    destroy() {
        if (this.measurementsController) {
            this.measurementsController.destroy();
        }
    }

    @observable selectedBookmark = -1;

    @action
    selectBookmark(index: number) {
        this.selectedBookmark = index;

        if (
            this.bookmarks &&
            this.selectedBookmark >= 0 &&
            this.selectedBookmark < this.bookmarks.length
        ) {
            const value = this.bookmarks[this.selectedBookmark].value;
            let from = this.xAxisController.from;
            let to = this.xAxisController.to;
            if (!(value >= from && value < to)) {
                from = value - this.xAxisController.distance / 2;
                to = from + this.xAxisController.distance;
                this.xAxisController.zoom(from, to);
            }
        }
    }

    isMultiWaveformChartsController = false;
}

////////////////////////////////////////////////////////////////////////////////

let calculatingToastId: any;

const Fade = cssTransition({
    enter: "fadeIn",
    exit: "fadeOut"
});

function showCalculating() {
    if (!calculatingToastId) {
        calculatingToastId = notification.info("Calculating...", {
            transition: Fade,
            closeButton: false,
            position: "top-center"
        });
    }
}

function hideCalculating() {
    if (calculatingToastId) {
        notification.dismiss(calculatingToastId);
        calculatingToastId = undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class MeasurementsController {
    dispose1: any;
    dispose2: any;
    dispose3: any;

    constructor(
        public chartsController: ChartsController,
        public measurementsModel: MeasurementsModel
    ) {
        this.dispose1 = reaction(
            () => toJS(this.measurementsModel.measurements),
            () => {
                const measurements = this.measurementsModel.measurements.map(
                    measurementDefinition => {
                        // reuse existing Measurement object if exists
                        const measurement = this.measurements.find(
                            measurement =>
                                measurementDefinition.measurementId ===
                                measurement.measurementId
                        );
                        if (measurement) {
                            return measurement;
                        }

                        // create a new Measurement object
                        return new Measurement(
                            this,
                            measurementDefinition,
                            measurementFunctions
                                .get()
                                .get(
                                    measurementDefinition.measurementFunctionId
                                )
                        );
                    }
                );

                this.measurements = measurements;
            }
        );

        this.measurements = this.measurementsModel.measurements.map(
            measurementDefinition =>
                new Measurement(
                    this,
                    measurementDefinition,
                    measurementFunctions
                        .get()
                        .get(measurementDefinition.measurementFunctionId)
                )
        );

        //////////
        this.dispose2 = autorun(() => {
            let newChartPanelsViewState: string | undefined;

            if (this.chartMeasurements.length > 0) {
                let content;
                try {
                    content = JSON.parse(
                        this.measurementsModel.chartPanelsViewState!
                    );
                } catch (err) {
                    content = undefined;
                }

                if (content) {
                    const goldenLayout: any = new GoldenLayout(
                        { content },
                        document.createElement("div")
                    );
                    goldenLayout.registerComponent(
                        "MeasurementValue",
                        function () {}
                    );
                    goldenLayout.init();

                    const existingChartMeasurementIds = goldenLayout.root
                        .getItemsByType("component")
                        .map((contentItem: any) => contentItem.config.id);

                    const chartMeasurementIds = this.chartMeasurements.map(
                        measurement => measurement.measurementId
                    );

                    const removed = _difference(
                        existingChartMeasurementIds,
                        chartMeasurementIds
                    );
                    const added = _difference(
                        chartMeasurementIds,
                        existingChartMeasurementIds
                    );

                    removed.forEach(id => {
                        const item = goldenLayout.root.getItemsById(id)[0];
                        if (item.parent.type === "stack") {
                            item.parent.setActiveContentItem(item);
                        }
                        item.remove();
                    });

                    added.forEach(id => {
                        const measurement = this.findMeasurementById(id);

                        if (!goldenLayout.root.contentItems[0]) {
                            goldenLayout.root.addChild({
                                type: "stack",
                                content: []
                            });
                        }

                        goldenLayout.root.contentItems[0].addChild(
                            measurement!.chartPanelConfiguration,
                            goldenLayout.root
                        );
                    });

                    goldenLayout.root
                        .getItemsByType("component")
                        .map((contentItem: any) => {
                            const measurement = this.findMeasurementById(
                                contentItem.config.id
                            );
                            contentItem.setTitle(measurement!.chartPanelTitle);
                        });

                    newChartPanelsViewState = JSON.stringify(
                        goldenLayout.config.content
                    );
                } else {
                    newChartPanelsViewState = JSON.stringify(
                        this.defaultChartPanelViewState
                    );
                }
            } else {
                newChartPanelsViewState = undefined;
            }

            if (newChartPanelsViewState != this.chartPanelsViewState) {
                runInAction(() => {
                    this.chartPanelsViewState = newChartPanelsViewState;
                    this.measurementsModel.chartPanelsViewState =
                        newChartPanelsViewState;
                });
            }
        });

        if (this.measurementsModel.chartPanelsViewState) {
            this.chartPanelsViewState =
                this.measurementsModel.chartPanelsViewState;
        } else {
            this.chartPanelsViewState = JSON.stringify(
                this.defaultChartPanelViewState
            );
        }

        // mark dirty all chart measurements when measurement interval changes
        this.dispose3 = reaction(
            () => ({
                isAnimationActive:
                    this.chartsController.xAxisController.isAnimationActive,
                measurementsInterval: this.calcMeasurementsInterval(),
                measurements: this.measurementsModel.measurements
            }),
            ({ isAnimationActive, measurementsInterval, measurements }) => {
                if (!isAnimationActive && measurements.length > 0) {
                    if (
                        !this.measurementsInterval ||
                        measurementsInterval.x1 !=
                            this.measurementsInterval.x1 ||
                        measurementsInterval.x2 != this.measurementsInterval.x2
                    ) {
                        this.measurements.forEach(
                            action(measurement => (measurement.dirty = true))
                        );
                    }
                }
            }
        );
    }

    @observable measurements: Measurement[];
    @observable measurementsInterval: { x1: number; x2: number } | undefined;

    @computed get refreshRequired() {
        return !!this.measurements.find(measurement => measurement.dirty);
    }

    timeoutId: any;

    calcMeasurementsInterval() {
        const rulersModel = this.chartsController.rulersController!.rulersModel;

        let x1: number;
        let x2: number;
        if (rulersModel.xAxisRulersEnabled) {
            if (rulersModel.x1 < rulersModel.x2) {
                x1 = rulersModel.x1;
                x2 = rulersModel.x2;
            } else {
                x1 = rulersModel.x2;
                x2 = rulersModel.x1;
            }
        } else {
            x1 = this.chartsController.xAxisController.from;
            x2 = this.chartsController.xAxisController.to;
        }

        let numSamples = 0;

        for (let i = 0; i < this.chartsController.lineControllers.length; ++i) {
            const waveformModel =
                this.chartsController.lineControllers[i].getWaveformModel();
            if (waveformModel) {
                numSamples = Math.max(
                    numSamples,
                    waveformModel.samplingRate * (x2 - x1)
                );
            }
        }

        return { x1, x2, numSamples };
    }

    startMeasurement(measurementsInterval: {
        x1: number;
        x2: number;
        numSamples: number;
    }) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        if (
            measurementsInterval.numSamples >
            CONF_MAX_NUM_SAMPLES_TO_SHOW_CALCULATING_MESSAGE
        ) {
            showCalculating();
            this.timeoutId = setTimeout(() => {
                this.timeoutId = undefined;
                runInAction(
                    () => (this.measurementsInterval = measurementsInterval)
                );
                setTimeout(() => {
                    hideCalculating();
                }, 10);
                this.refreshResults();
            }, 150);
        } else {
            runInAction(
                () => (this.measurementsInterval = measurementsInterval)
            );
            this.refreshResults();
        }
    }

    @computed
    get chartMeasurements() {
        return this.measurements.filter(measurement => {
            return (
                measurement.measurementFunction &&
                measurement.measurementFunction.resultType === "chart"
            );
        });
    }

    @computed
    get isThereAnyMeasurementChart() {
        return this.chartMeasurements.length > 0;
    }

    findMeasurementById(measurementId: string) {
        return this.measurements.find(
            measurement => measurement.measurementId === measurementId
        );
    }

    @observable chartPanelsViewState: string | undefined;

    get defaultChartPanelViewState() {
        const charts = this.measurements.filter(
            measurement => measurement.resultType === "chart"
        );
        if (charts.length === 0) {
            return undefined;
        }

        return [
            {
                type: "stack",
                content: charts.map(
                    measurement => measurement.chartPanelConfiguration
                )
            }
        ];
    }

    refreshResults() {
        this.measurements.forEach(measurement => {
            if (measurement.dirty) {
                measurement.refreshResult();
            }
        });
    }

    destroy() {
        this.dispose1();
        this.dispose2();
        this.dispose3();
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ChartsView extends React.Component<
    {
        chartsController: ChartsController;
        className?: string;
        tabIndex?: number;
        sideDockAvailable?: boolean;
    },
    {}
> {
    animationFrameRequestId: any = undefined;
    div: HTMLDivElement | null = null;
    sideDock: SideDock | null = null;
    chartMeasurements: ChartMeasurements | null = null;

    get sideDockAvailable() {
        return this.props.sideDockAvailable !== undefined
            ? this.props.sideDockAvailable
            : this.props.chartsController.mode !== "preview";
    }

    @action
    adjustSize() {
        const chartsController = this.props.chartsController;
        const firstChartController = chartsController.chartControllers[0];
        const svg =
            firstChartController &&
            firstChartController.chartView &&
            firstChartController.chartView.svg;
        if (svg) {
            const chartViewRect = svg.getBoundingClientRect();

            const chartViewWidth = chartViewRect.width;
            const chartViewHeight = chartViewRect.height;

            if (
                (chartViewWidth &&
                    chartViewWidth != chartsController.chartViewWidth) ||
                (chartViewHeight &&
                    chartViewHeight != chartsController.chartViewHeight)
            ) {
                chartsController.chartViewWidth = chartViewWidth;
                chartsController.chartViewHeight = chartViewHeight;
            }
        }
    }

    frameAnimation = () => {
        this.adjustSize();

        const chartsController = this.props.chartsController;

        chartsController.xAxisController.animationController.frameAnimation();

        chartsController.chartControllers.forEach(chartController => {
            chartController.yAxisController.animationController.frameAnimation();
            if (chartController.yAxisControllerOnRightSide) {
                chartController.yAxisControllerOnRightSide.animationController.frameAnimation();
            }
        });

        if (this.sideDock) {
            this.sideDock.updateSize();
        }

        if (this.chartMeasurements) {
            this.chartMeasurements.updateSize();
        }

        this.animationFrameRequestId = window.requestAnimationFrame(
            this.frameAnimation
        );
    };

    setFocus() {
        if (this.div && this.props.tabIndex !== undefined) {
            this.div.focus();
        }
    }

    componentDidMount() {
        this.frameAnimation();
        this.setFocus();
    }

    componentDidUpdate() {
        this.setFocus();
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.keyCode === 33) {
            this.props.chartsController.xAxisController.pageUp();
        } else if (event.keyCode === 34) {
            this.props.chartsController.xAxisController.pageDown();
        } else if (event.keyCode === 36) {
            this.props.chartsController.xAxisController.home();
        } else if (event.keyCode === 35) {
            this.props.chartsController.xAxisController.end();
        }
    }

    registerComponents = (factory: any) => {
        const chartsController = this.props.chartsController;

        factory.registerComponent(
            "RulersDockView",
            function (container: any, props: any) {
                ReactDOM.render(
                    <RulersDockView
                        chartsController={chartsController}
                        {...props}
                    />,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "MeasurementsDockView",
            function (container: any, props: any) {
                ReactDOM.render(
                    <MeasurementsDockView
                        measurementsController={
                            chartsController.measurementsController
                        }
                        {...props}
                    />,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "ChartViewOptions",
            function (container: any, props: ChartViewOptionsProps) {
                ReactDOM.render(
                    <ChartViewOptions
                        chartsController={chartsController}
                        {...props}
                    />,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "BookmarksView",
            function (container: any, props: any) {
                ReactDOM.render(
                    <BookmarksView chartsController={chartsController} />,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "HelpView",
            function (container: any, props: ChartViewOptionsProps) {
                ReactDOM.render(
                    <HelpView {...props} />,
                    container.getElement()[0]
                );
            }
        );
    };

    get chartViewOptionsItem() {
        return {
            type: "component",
            componentName: "ChartViewOptions",
            componentState: this.props.chartsController.chartViewOptionsProps,
            title: "View Options",
            isClosable: false
        };
    }

    get rulersItem() {
        return {
            type: "component",
            componentName: "RulersDockView",
            componentState: {},
            title: "Rulers",
            isClosable: false
        };
    }

    get measurementsItem() {
        return {
            type: "component",
            componentName: "MeasurementsDockView",
            componentState: {},
            title: "Measurements",
            isClosable: false
        };
    }

    get bookmarksItem() {
        return {
            type: "component",
            componentName: "BookmarksView",
            componentState: {},
            title: "Bookmarks",
            isClosable: false
        };
    }

    get helpItem() {
        return {
            type: "component",
            componentName: "HelpView",
            componentState: {},
            title: "Help",
            isClosable: false
        };
    }

    @computed
    get defaultLayoutConfig() {
        let content;

        if (this.props.chartsController.supportRulers) {
            content = [
                {
                    type: "column",
                    content: [
                        {
                            type: "stack",
                            content: this.props.chartsController.bookmarks
                                ? [
                                      this.chartViewOptionsItem,
                                      this.rulersItem,
                                      this.bookmarksItem,
                                      this.helpItem
                                  ]
                                : [
                                      this.chartViewOptionsItem,
                                      this.rulersItem,
                                      this.helpItem
                                  ]
                        },
                        this.measurementsItem
                    ]
                }
            ];
        } else {
            content = [
                {
                    type: "column",
                    content: this.props.chartsController.bookmarks
                        ? [
                              this.chartViewOptionsItem,
                              this.bookmarksItem,
                              this.helpItem
                          ]
                        : [this.chartViewOptionsItem, this.helpItem]
                }
            ];
        }

        const defaultLayoutConfig = {
            settings: DockablePanels.DEFAULT_SETTINGS,
            dimensions: DockablePanels.DEFAULT_DIMENSIONS,
            content: content
        };

        return defaultLayoutConfig;
    }

    render() {
        const chartsController = this.props.chartsController;
        const mode = chartsController.mode;

        const className = classNames(
            "EezStudio_ChartView",
            `EezStudio_ChartView_${capitalize(mode)}`,
            this.props.className,
            {
                EezStudio_ChartView_BlackBackground:
                    globalViewOptions.blackBackground
            }
        );

        const charts = chartsController.chartControllers.map(
            chartController => (
                <ChartView
                    ref={ref =>
                        runInAction(() => {
                            if (ref) {
                                chartController.chartViews.push(ref);
                            }
                        })
                    }
                    key={chartController.id}
                    chartController={chartController}
                    mode={mode}
                />
            )
        );

        let div = (
            <div
                ref={ref => (this.div = ref)}
                className={className}
                onKeyDown={this.onKeyDown}
                tabIndex={this.props.tabIndex}
            >
                {charts}
                <svg
                    className="EezStudio_Chart_XAxis"
                    height={chartsController.xAxisHeight}
                >
                    <AxisView
                        axisController={chartsController.xAxisController}
                    />
                </svg>
            </div>
        );

        if (
            chartsController.measurementsController &&
            chartsController.measurementsController.isThereAnyMeasurementChart
        ) {
            div = (
                <Splitter
                    type="vertical"
                    sizes={`50%|50%`}
                    persistId="shared/ui/chart/splitter-chart-measurements"
                    childrenOverflow="auto|visible"
                >
                    {div}
                    <ChartMeasurements
                        ref={ref => (this.chartMeasurements = ref)}
                        measurementsController={
                            chartsController.measurementsController
                        }
                    />
                </Splitter>
            );
        }

        if (this.sideDockAvailable) {
            const layoutId =
                "layout/3" +
                (this.props.chartsController.supportRulers
                    ? "/with-rulers"
                    : "") +
                (this.props.chartsController.bookmarks
                    ? "/with-bookmarks"
                    : "");

            return (
                <SideDock
                    ref={ref => (this.sideDock = ref)}
                    persistId="shared/ui/chart/sideDock"
                    layoutId={layoutId}
                    defaultLayoutConfig={this.defaultLayoutConfig}
                    registerComponents={this.registerComponents}
                    width={450}
                >
                    {div}
                </SideDock>
            );
        } else {
            return div;
        }
    }
}

@observer
class ChartMeasurements extends React.Component<{
    measurementsController: MeasurementsController;
}> {
    dockablePanels: DockablePanels | null = null;

    get measurementsModel() {
        return this.props.measurementsController.measurementsModel;
    }

    registerComponents = (factory: any) => {
        const measurementsController = this.props.measurementsController;

        factory.registerComponent(
            "MeasurementValue",
            function (container: any, props: any) {
                const measurement = measurementsController.findMeasurementById(
                    props.measurementId
                );
                if (measurement) {
                    const div: HTMLDivElement = container.getElement()[0];
                    ReactDOM.render(
                        <MeasurementValue
                            measurement={measurement}
                            inDockablePanel={true}
                        />,
                        div
                    );
                }
            }
        );
    };

    @computed
    get defaultLayoutConfig() {
        let content;
        try {
            content = JSON.parse(
                this.props.measurementsController.chartPanelsViewState!
            );
        } catch (err) {
            content = undefined;
        }
        return {
            settings: DockablePanels.DEFAULT_SETTINGS,
            dimensions: DockablePanels.DEFAULT_DIMENSIONS,
            content
        };
    }

    updateSize() {
        if (this.dockablePanels) {
            this.dockablePanels.updateSize();
        }
    }

    debounceTimeout: any;

    onStateChanged = (state: any) => {
        const newStateContent = state.content;

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.debounceTimeout = undefined;

            // workaround for the possible golden-layout BUG,
            // make sure activeItemIndex is not out of bounds
            const goldenLayout: any = new GoldenLayout(
                {
                    content: newStateContent
                },
                document.createElement("div")
            );
            goldenLayout.registerComponent("MeasurementValue", function () {});
            goldenLayout.init();

            goldenLayout.root
                .getItemsByType("component")
                .map((contentItem: any) => {
                    const measurement =
                        this.props.measurementsController.measurements.find(
                            measurement =>
                                measurement.measurementId ===
                                contentItem.config.id
                        );

                    contentItem.setTitle(measurement?.chartPanelTitle || "");
                });

            goldenLayout.root
                .getItemsByType("stack")
                .map(
                    (contentItem: any) =>
                        (contentItem.config.activeItemIndex = Math.min(
                            contentItem.config.activeItemIndex,
                            contentItem.config.content.length - 1
                        ))
                );

            const chartPanelsViewState = JSON.stringify(
                goldenLayout.config.content
            );

            runInAction(
                () =>
                    (this.measurementsModel.chartPanelsViewState =
                        chartPanelsViewState)
            );
        }, 1000);
    };

    render() {
        return (
            <DockablePanels
                ref={ref => (this.dockablePanels = ref)}
                defaultLayoutConfig={this.defaultLayoutConfig}
                registerComponents={this.registerComponents}
                onStateChanged={this.onStateChanged}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class DynamicAxisController extends AxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: ChartsController,
        public chartController: ChartController | undefined,
        public axisModel: IAxisModel
    ) {
        super(position, chartsController, chartController, axisModel);
    }

    @observable animationFrom: number = 0;
    @observable animationTo: number = 0;

    @computed
    get from() {
        if (this.isDigital) {
            return 0;
        }

        if (this.chartsController.mode === "preview") {
            return this.minValue;
        }

        if (this.isAnimationActive) {
            return this.animationFrom;
        }

        if (this.axisModel.dynamic.zoomMode === "all") {
            return this.minValue;
        }

        if (this.axisModel.dynamic.zoomMode === "default") {
            return this.axisModel.defaultFrom;
        }

        return this.axisModel.dynamic.from;
    }

    set from(value: number) {
        this.axisModel.dynamic.zoomMode = "custom";
        this.axisModel.dynamic.from = value;
    }

    @computed
    get to() {
        if (this.isDigital) {
            return 1.0;
        }

        if (this.chartsController.mode === "preview") {
            return this.maxValue;
        }

        if (this.isAnimationActive) {
            return this.animationTo;
        }

        if (this.axisModel.dynamic.zoomMode === "all") {
            return this.maxValue;
        }

        if (this.axisModel.dynamic.zoomMode === "default") {
            return this.axisModel.defaultTo;
        }

        return this.axisModel.dynamic.to;
    }

    set to(value: number) {
        this.axisModel.dynamic.zoomMode = "custom";
        this.axisModel.dynamic.to = value;
    }

    @computed
    get steps() {
        let steps;

        if (this.chartsController.viewOptions.axesLines.steps) {
            if (this.position === "x") {
                steps = this.chartsController.viewOptions.axesLines.steps.x;
            } else if (
                Array.isArray(
                    this.chartsController.viewOptions.axesLines.steps.y
                )
            ) {
                steps =
                    this.chartsController.viewOptions.axesLines.steps.y.find(
                        (vale: number[], i: number) =>
                            this.chartsController.chartControllers[i] ===
                            this.chartController
                    );
            }
        }

        if (!steps || steps.length === 0) {
            steps = this.unit.units;
        }

        return steps;
    }

    @computed
    get ticks() {
        const { from, to, scale, steps } = this;

        const minDistanceInPx = CONF_AXIS_MIN_TICK_DISTANCE;
        const maxDistanceInPx = CONF_AXIS_MAX_TICK_DISTANCE;
        const minColorOpacity = CONF_DYNAMIC_AXIS_LINE_MIN_COLOR_OPACITY;
        const maxColorOpacity = CONF_DYNAMIC_AXIS_LINE_MAX_COLOR_OPACITY;
        const minTextColorOpacity =
            CONF_DYNAMIC_AXIS_LINE_MIN_TEXT_COLOR_OPACITY;
        const maxTextColorOpacity =
            CONF_DYNAMIC_AXIS_LINE_MAX_TEXT_COLOR_OPACITY;

        const minLabelPx =
            this.position === "x"
                ? CONF_X_AXIS_MIN_TICK_LABEL_WIDTH
                : CONF_Y_AXIS_MIN_TICK_LABEL_WIDTH;

        let ticks: ITick[] = new Array();

        let self = this;

        function addLogarithmicLines(from: number, to: number, iStep: number) {
            const step = steps[iStep];

            let fromValue = Math.ceil(from / step) * step;
            let toValue = Math.floor(to / step) * step;

            let unitPx =
                self.valueToPx(fromValue) - self.valueToPx(fromValue - step);
            if (unitPx < minDistanceInPx) {
                return;
            }

            let lastValue = from;

            for (let value = fromValue; value <= toValue; value += step) {
                let px = self.valueToPx(value);

                let opacity = clamp(
                    minColorOpacity +
                        ((maxColorOpacity - minColorOpacity) *
                            (unitPx - minDistanceInPx)) /
                            (maxDistanceInPx - minDistanceInPx),
                    minColorOpacity,
                    maxColorOpacity
                );

                let textOpacity = clamp(
                    minTextColorOpacity +
                        ((maxTextColorOpacity - minTextColorOpacity) *
                            (unitPx - minDistanceInPx)) /
                            (maxDistanceInPx - minDistanceInPx),
                    minTextColorOpacity,
                    maxTextColorOpacity
                );

                ticks.push({
                    px,
                    value,
                    label: "",
                    color: globalViewOptions.blackBackground
                        ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${opacity})`
                        : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${opacity})`,
                    textColor: globalViewOptions.blackBackground
                        ? `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND}, ${textOpacity})`
                        : `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND}, ${textOpacity})`,
                    allowSnapTo: true,
                    step
                });

                if (iStep > 0) {
                    addLogarithmicLines(lastValue, value, iStep - 1);
                }

                lastValue = value;
            }

            if (iStep > 0) {
                addLogarithmicLines(lastValue, to, iStep - 1);
            }
        }

        function addLinearLines(from: number, to: number, iStep: number) {
            if (from >= to) {
                return;
            }

            const step = steps[iStep];

            let unitPx = step * scale;
            if (unitPx < minDistanceInPx) {
                return;
            }

            let fromValue = Math.ceil(from / step) * step;
            let toValue = Math.floor(to / step) * step;

            let lastValue = from;

            for (let value = fromValue; value <= toValue; value += step) {
                let px = self.valueToPx(value);

                let opacity = clamp(
                    minColorOpacity +
                        ((maxColorOpacity - minColorOpacity) *
                            (unitPx - minDistanceInPx)) /
                            (maxDistanceInPx - minDistanceInPx),
                    minColorOpacity,
                    maxColorOpacity
                );

                let textOpacity = clamp(
                    minTextColorOpacity +
                        ((maxTextColorOpacity - minTextColorOpacity) *
                            (unitPx - minDistanceInPx)) /
                            (maxDistanceInPx - minDistanceInPx),
                    minTextColorOpacity,
                    maxTextColorOpacity
                );

                let label =
                    unitPx >= minLabelPx
                        ? self.unit.formatValue(
                              self.axisModel.semiLogarithmic
                                  ? Math.pow(
                                        10,
                                        value + self.axisModel.semiLogarithmic.a
                                    ) + self.axisModel.semiLogarithmic.b
                                  : value,
                              4
                          )
                        : "";

                ticks.push({
                    px,
                    value,
                    label: label,
                    color: globalViewOptions.blackBackground
                        ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${opacity})`
                        : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${opacity})`,
                    textColor: globalViewOptions.blackBackground
                        ? `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND}, ${textOpacity})`
                        : `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND}, ${textOpacity})`,
                    allowSnapTo: true,
                    step
                });

                if (iStep > 0) {
                    addLinearLines(lastValue, value, iStep - 1);
                }

                lastValue = value;
            }

            if (iStep > 0) {
                addLinearLines(lastValue, to, iStep - 1);
            }
        }

        if (this.logarithmic) {
            addLogarithmicLines(
                this.pxToValue(this.linearValueToPx(from)),
                this.pxToValue(this.linearValueToPx(to)),
                steps.length - 1
            );
        } else {
            addLinearLines(from, to, steps.length - 1);
        }

        if (ticks.length === 0 && !this.logarithmic) {
            // no tick lines, at least add lines for "from" and "to"
            let from = Math.ceil(this.from / this.steps[0]) * this.steps[0];
            ticks.push({
                px: this.valueToPx(from),
                value: from,
                label: this.unit.formatValue(from),
                color: globalViewOptions.blackBackground
                    ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${maxColorOpacity})`
                    : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${maxColorOpacity})`,
                textColor: globalViewOptions.blackBackground
                    ? `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND}, ${maxTextColorOpacity})`
                    : `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND}, ${maxTextColorOpacity})`,
                allowSnapTo: false,
                step: undefined
            });

            let to = Math.floor(this.to / this.steps[0]) * this.steps[0];
            ticks.push({
                px: this.valueToPx(to),
                value: to,
                label: this.unit.formatValue(to),
                color: globalViewOptions.blackBackground
                    ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${maxColorOpacity})`
                    : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${maxColorOpacity})`,
                textColor: globalViewOptions.blackBackground
                    ? `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND}, ${maxTextColorOpacity})`
                    : `rgba(${CONF_DYNAMIC_AXIS_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND}, ${maxTextColorOpacity})`,
                allowSnapTo: false,
                step: undefined
            });
        } else if (this.logarithmic) {
            ticks = ticks.sort((a, b) => a.px - b.px);

            // set labels from the largest magnitude to the smallest
            for (let iStep = steps.length - 1; iStep >= 0; iStep--) {
                let step = steps[iStep];
                for (let iTick = 0; iTick < ticks.length; ++iTick) {
                    const tick = ticks[iTick];
                    if (tick.step === step) {
                        let foundTooCloseLabel = false;

                        // test if there is a label on the left that is too close to this tick
                        for (
                            let i = iTick - 1;
                            i >= 0 && tick.px - ticks[i].px < minLabelPx;
                            i--
                        ) {
                            if (ticks[i].label) {
                                foundTooCloseLabel = true;
                                break;
                            }
                        }
                        if (foundTooCloseLabel) {
                            continue;
                        }

                        // test if there is a label on the right that is too close to this tick
                        for (
                            let i = iTick + 1;
                            i < ticks.length &&
                            ticks[i].px - tick.px < minLabelPx;
                            i++
                        ) {
                            if (ticks[i].label) {
                                foundTooCloseLabel = true;
                                break;
                            }
                        }
                        if (foundTooCloseLabel) {
                            continue;
                        }

                        tick.label = this.unit.formatValue(tick.value);
                    }
                }
            }
        }

        // remove duplicates, i.e. ticks with the same label
        ticks = _uniqWith(ticks, (a, b) =>
            a.label ? a.label === b.label : false
        );

        return ticks;
    }

    @computed
    get maxScale() {
        return this.axisModel.maxScale !== undefined
            ? this.axisModel.maxScale
            : 1e15;
    }

    panByDirection(direction: number) {
        this.panByDistance(direction * CONF_PAN_STEP * this.distance);
    }

    panTo(newFrom: number) {
        const distance = this.distance;
        this.from = newFrom;
        this.to = this.from + distance;
    }

    zoomAll() {
        this.animate(() => (this.axisModel.dynamic.zoomMode = "all"));
    }

    zoomDefault() {
        this.animate(() => (this.axisModel.dynamic.zoomMode = "default"));
    }

    zoomIn = () => {
        if (!this.zoomInEnabled) {
            return;
        }

        const c = (this.to + this.from) / 2;
        const newDistance = this.distance / CONF_ZOOM_STEP;

        this.zoom(c - newDistance / 2, c + newDistance / 2);
    };

    zoomOut = () => {
        if (!this.zoomOutEnabled) {
            return;
        }

        const c = (this.to + this.from) / 2;
        const newDistance = this.distance * CONF_ZOOM_STEP;

        this.zoom(c - newDistance / 2, c + newDistance / 2);
    };

    zoom(from: number, to: number) {
        this.animate(() => {
            this.from = from;
            this.to = to;
        });
    }

    zoomAroundPivotPoint(pivotPx: number, zoomIn: boolean) {
        if (zoomIn) {
            if (!this.zoomInEnabled) {
                return;
            }
        } else {
            if (!this.zoomOutEnabled) {
                return;
            }
        }

        let distance = zoomIn
            ? this.distance / CONF_ZOOM_STEP
            : this.distance * CONF_ZOOM_STEP;

        let from =
            this.from +
            ((this.distance - distance) * pivotPx) / this.distancePx;
        let to = from + distance;

        this.animate(() => {
            this.from = from;
            this.to = to;
        });
    }

    @action
    animate(set: () => void) {
        if (!globalViewOptions.enableZoomAnimations) {
            set();
            return;
        }

        this.animationController.finish();

        const oldFrom = this.from;
        const oldTo = this.to;

        this.animationFrom = oldFrom;
        this.animationTo = oldTo;
        this.isAnimationActive = true;

        set();

        const newFrom = this.from;
        const newTo = this.to;

        this.animationController.animate(
            CONF_SCALE_ZOOM_FACTOR_ANIMATION_DURATION,
            {
                step: action((t: number) => {
                    if (t === 1) {
                        this.isAnimationActive = false;
                    } else {
                        this.animationFrom = oldFrom + t * (newFrom - oldFrom);
                        this.animationTo = oldTo + t * (newTo - oldTo);
                    }
                })
            }
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const MIN_FIXED_SCALE_POWER = -15;
const MAX_FIXED_SCALE_POWER = 15;

function calcSubdivisionScaleAndOffset(
    from: number,
    to: number,
    subdivision: number
) {
    // first try heuristic to find nice round numbers
    for (let i = MIN_FIXED_SCALE_POWER; i <= MAX_FIXED_SCALE_POWER; i++) {
        for (let k = 1; k < 10.0; k += 0.01) {
            const scale = k * Math.pow(10, i);
            const offset = Math.floor(from / scale) * scale;
            const range = scale * subdivision;
            if (offset + range >= to) {
                return {
                    scale,
                    offset
                };
            }
        }
    }

    const scale = (to - from) / subdivision;
    const offset = from;

    return {
        scale,
        offset
    };
}

function scaleZoomIn(currentScale: number) {
    for (let i = MAX_FIXED_SCALE_POWER; i >= MIN_FIXED_SCALE_POWER; i--) {
        for (let k = 9; k >= 1; k--) {
            const scale = k * Math.pow(10, i);
            if (scale < currentScale) {
                return scale;
            }
        }
    }

    return currentScale;
}

function scaleZoomOut(currentScale: number) {
    for (let i = MIN_FIXED_SCALE_POWER; i <= MAX_FIXED_SCALE_POWER; i++) {
        for (let k = 1; k <= 9; k++) {
            const scale = k * Math.pow(10, i);
            if (scale > currentScale) {
                return scale;
            }
        }
    }

    return currentScale;
}

class FixedAxisController extends AxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: ChartsController,
        public chartController: ChartController | undefined,
        public axisModel: IAxisModel
    ) {
        super(position, chartsController, chartController, axisModel);
    }

    animationController = new AnimationController();

    @observable animationSubdivisionOffset: number = 0;
    @observable animationSubdivisionScale: number = 0;

    get majorSubdivison() {
        return this.position === "x"
            ? this.chartsController.viewOptions.axesLines.majorSubdivision
                  .horizontal
            : this.chartsController.viewOptions.axesLines.majorSubdivision
                  .vertical;
    }

    @computed
    get subdivisionOffset() {
        if (
            this.chartsController.mode === "preview" ||
            this.axisModel.fixed.zoomMode === "default"
        ) {
            return this.axisModel.defaultSubdivisionOffset !== undefined
                ? this.axisModel.defaultSubdivisionOffset
                : calcSubdivisionScaleAndOffset(
                      this.axisModel.defaultFrom,
                      this.axisModel.defaultTo,
                      this.majorSubdivison
                  ).offset;
        }

        if (this.axisModel.fixed.zoomMode === "all") {
            return calcSubdivisionScaleAndOffset(
                this.minValue,
                this.maxValue,
                this.majorSubdivison
            ).offset;
        }

        return this.axisModel.fixed.subdivisionOffset;
    }

    @computed
    get subdivisionScale() {
        if (
            this.chartsController.mode === "preview" ||
            this.axisModel.fixed.zoomMode === "default"
        ) {
            return this.axisModel.defaultSubdivisionScale !== undefined
                ? this.axisModel.defaultSubdivisionScale
                : calcSubdivisionScaleAndOffset(
                      this.axisModel.defaultFrom,
                      this.axisModel.defaultTo,
                      this.majorSubdivison
                  ).scale;
        }

        if (this.axisModel.fixed.zoomMode === "all") {
            return calcSubdivisionScaleAndOffset(
                this.minValue,
                this.maxValue,
                this.majorSubdivison
            ).scale;
        }

        return this.axisModel.fixed.subdivisonScale;
    }

    @computed
    get from() {
        if (this.isDigital) {
            return 0;
        }

        if (this.isAnimationActive) {
            return this.animationSubdivisionOffset;
        }

        return this.subdivisionOffset;
    }

    @computed
    get to() {
        if (this.isDigital) {
            return 1.0;
        }

        if (this.isAnimationActive) {
            return (
                this.animationSubdivisionOffset +
                this.animationSubdivisionScale * this.majorSubdivison
            );
        }

        return (
            this.subdivisionOffset +
            this.subdivisionScale * this.majorSubdivison
        );
    }

    @computed
    get minValue(): number {
        const minValue = this._minValue;
        if (
            this.chartsController.mode === "preview" ||
            this.axisModel.fixed.zoomMode === "all"
        ) {
            return minValue;
        }
        return Math.min(minValue, this.from);
    }

    @computed
    get maxValue(): number {
        const maxValue = super._maxValue;
        if (
            this.chartsController.mode === "preview" ||
            this.axisModel.fixed.zoomMode === "all"
        ) {
            return maxValue;
        }
        return Math.max(maxValue, this.to);
    }

    @computed
    get ticks() {
        const minLabelPx =
            this.position === "x"
                ? CONF_X_AXIS_MIN_TICK_LABEL_WIDTH
                : CONF_Y_AXIS_MIN_TICK_LABEL_WIDTH;

        let lines: ITick[] = [];

        let n =
            this.position === "x"
                ? this.chartsController.viewOptions.axesLines.majorSubdivision
                      .horizontal
                : this.chartsController.viewOptions.axesLines.majorSubdivision
                      .vertical;

        let m =
            this.position === "x"
                ? this.chartsController.viewOptions.axesLines.minorSubdivision
                      .horizontal
                : this.chartsController.viewOptions.axesLines.minorSubdivision
                      .vertical;

        let minorSubdivision = (this.to - this.from) / (m * n);

        let visibleLabelPx = 0;

        let majorLineColor = globalViewOptions.blackBackground
            ? CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_BLACK_BACKGROUND
            : CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_WHITE_BACKGROUND;
        let minorLineColor = globalViewOptions.blackBackground
            ? CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_BLACK_BACKGROUND
            : CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_WHITE_BACKGROUND;

        let majorLineTextColor = globalViewOptions.blackBackground
            ? CONF_FIXED_AXIS_MAJOR_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND
            : CONF_FIXED_AXIS_MAJOR_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND;
        let minorLineTextColor = globalViewOptions.blackBackground
            ? CONF_FIXED_AXIS_MINOR_LINE_TEXT_COLOR_ON_BLACK_BACKGROUND
            : CONF_FIXED_AXIS_MINOR_LINE_TEXT_COLOR_ON_WHITE_BACKGROUND;

        for (let i = 0; i <= n * m; i++) {
            const value = this.from + i * minorSubdivision;

            let isMajorLine = i % m === 0;

            let px = Math.round(this.valueToPx(value));

            let isLabelVisible = false;
            if (isMajorLine) {
                if (this.position === "x") {
                    if (i === 0 || i === n * m) {
                        isLabelVisible = true;
                    } else {
                        if (
                            px - visibleLabelPx >= minLabelPx &&
                            Math.round(this.valueToPx(this.to)) - px >=
                                minLabelPx
                        ) {
                            isLabelVisible = true;
                        }
                    }

                    if (isLabelVisible) {
                        visibleLabelPx = px;
                    }
                } else {
                    isLabelVisible = true;
                }
            }

            lines.push({
                px,
                value: value,
                label: isLabelVisible ? this.unit.formatValue(value) : "",
                color: isMajorLine ? majorLineColor : minorLineColor,
                textColor: isMajorLine
                    ? majorLineTextColor
                    : minorLineTextColor,
                isMajorLine: isMajorLine,
                allowSnapTo: true,
                step: undefined
            });
        }

        return lines;
    }

    panByDirection(direction: number) {
        this.panByDistance(direction * this.subdivisionScale);
    }

    panTo(newFrom: number) {
        //newFrom = roundNumberWithMaxNumberOfDecimalDigits(newFrom, 2);
        this.axisModel.fixed.subdivisionOffset = newFrom;
        this.axisModel.fixed.subdivisonScale = this.subdivisionScale;
        this.axisModel.fixed.zoomMode = "custom";
    }

    zoomAll() {
        this.animate(() => (this.axisModel.fixed.zoomMode = "all"));
    }

    zoomDefault() {
        this.animate(() => (this.axisModel.fixed.zoomMode = "default"));
    }

    zoomIn = () => {
        if (!this.zoomInEnabled) {
            return;
        }

        const c = (this.to + this.from) / 2;
        const scale = scaleZoomIn(this.subdivisionScale);
        const offset = c - (scale * this.majorSubdivison) / 2;

        this.animate(() => {
            this.axisModel.fixed.subdivisonScale = scale;
            this.axisModel.fixed.subdivisionOffset = offset;
            this.axisModel.fixed.zoomMode = "custom";
        });
    };

    zoomOut = () => {
        if (!this.zoomOutEnabled) {
            return;
        }

        const c = (this.to + this.from) / 2;
        const scale = scaleZoomOut(this.subdivisionScale);
        const offset = c - (scale * this.majorSubdivison) / 2;

        this.animate(() => {
            this.axisModel.fixed.subdivisonScale = scale;
            this.axisModel.fixed.subdivisionOffset = offset;
            this.axisModel.fixed.zoomMode = "custom";
        });
    };

    zoom(from: number, to: number) {
        if (to - from < this.distance) {
            if (!this.zoomInEnabled) {
                return;
            }
        } else {
            if (!this.zoomOutEnabled) {
                return;
            }
        }

        const result = calcSubdivisionScaleAndOffset(
            from,
            to,
            this.majorSubdivison
        );

        this.animate(() => {
            this.axisModel.fixed.subdivisonScale = result.scale;
            this.axisModel.fixed.subdivisionOffset = result.offset;
            this.axisModel.fixed.zoomMode = "custom";
        });
    }

    zoomAroundPivotPoint(pivotPx: number, zoomIn: boolean) {
        if (zoomIn) {
            if (!this.zoomInEnabled) {
                return;
            }
        } else {
            if (!this.zoomOutEnabled) {
                return;
            }
        }

        let newScale: number;
        if (zoomIn) {
            newScale = scaleZoomIn(this.subdivisionScale);
        } else {
            newScale = scaleZoomOut(this.subdivisionScale);
        }

        if (newScale !== this.subdivisionScale) {
            let fixedOffset =
                this.subdivisionOffset +
                ((this.subdivisionScale - newScale) *
                    this.majorSubdivison *
                    pivotPx) /
                    this.distancePx;

            //fixedOffset = Math.floor(fixedOffset / newScale) * newScale;
            //fixedOffset = roundNumberWithMaxNumberOfDecimalDigits(fixedOffset, 2);
            this.animate(() => {
                this.axisModel.fixed.subdivisionOffset = fixedOffset;
                this.axisModel.fixed.subdivisonScale = newScale;
                this.axisModel.fixed.zoomMode = "custom";
            });
        }
    }

    @action
    animate(set: () => void) {
        if (!globalViewOptions.enableZoomAnimations) {
            set();
            return;
        }

        this.animationController.finish();

        const oldOffset = this.subdivisionOffset;
        const oldScale = this.subdivisionScale;

        this.isAnimationActive = true;
        this.animationSubdivisionOffset = oldOffset;
        this.animationSubdivisionScale = oldScale;

        set();

        const newOffset = this.subdivisionOffset;
        const newScale = this.subdivisionScale;

        this.animationController.animate(
            CONF_SCALE_ZOOM_FACTOR_ANIMATION_DURATION,
            {
                step: action((t: number) => {
                    if (t === 1) {
                        this.isAnimationActive = false;
                    } else {
                        this.animationSubdivisionOffset =
                            oldOffset + t * (newOffset - oldOffset);
                        this.animationSubdivisionScale =
                            oldScale + t * (newScale - oldScale);
                    }
                })
            }
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getNearestValuePoint(
    point: Point,
    xAxisController: AxisController,
    yAxisController: AxisController,
    waveform: IWaveform
): Point {
    let i1 = Math.floor(
        xAxisController.pxToValue(point.x - 0.5) * waveform.samplingRate
    );
    let i2 = Math.ceil(
        xAxisController.pxToValue(point.x + 0.5) * waveform.samplingRate
    );
    if (i2 - i1 > 1) {
        // find max value for logarithmic unit
        let min = waveform.value(i1);
        let max = waveform.value(i1);
        for (let i = i1 + 1; i <= i2; ++i) {
            const value = waveform.value(i);
            if (value > max) {
                max = value;
            } else if (value < min) {
                min = value;
            }
        }

        let xValue = xAxisController.pxToValue(point.x);
        let yValue = yAxisController.pxToValue(point.y);
        if (Math.abs(min - yValue) < Math.abs(max - yValue)) {
            return {
                x: xValue,
                y: min
            };
        } else {
            return {
                x: xValue,
                y: max
            };
        }
    } else {
        let i = Math.round(
            xAxisController.pxToValue(point.x) * waveform.samplingRate
        );
        if (i > waveform.length) {
            return {
                x: NaN,
                y: NaN
            };
        }
        return {
            x: i / waveform.samplingRate,
            y: waveform.value(i)
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartWaveform implements IWaveform {
    constructor(private chartData: IChart) {
        this.xAxes = {
            unit: UNITS[this.chartData.xAxes.unit],
            logarithmic: chartData.xAxes.logarithmic
        };

        let min = chartData.yAxes.minValue;
        let max = chartData.yAxes.maxValue;

        if (min === undefined && max === undefined) {
            min = this.chartData.data[0];
            max = this.chartData.data[0];
            for (let i = 1; i < this.chartData.data.length; ++i) {
                min = Math.min(min, this.chartData.data[i]);
                max = Math.max(max, this.chartData.data[i]);
            }
            const d = (max - min) * 0.1;
            min -= d;
            max += d;
        } else if (min === undefined) {
            min = this.chartData.data[0];
            for (let i = 1; i < this.chartData.data.length; ++i) {
                min = Math.min(min, this.chartData.data[i]);
            }
            const d = (max! - min) * 0.1;
            min -= d;
        } else if (max === undefined) {
            max = this.chartData.data[0];
            for (let i = 1; i < this.chartData.data.length; ++i) {
                max = Math.max(max, this.chartData.data[i]);
            }
            const d = (max - min) * 0.1;
            max += d;
        }

        this.yAxes = {
            minValue: min!,
            maxValue: max!,
            unit: UNITS[this.chartData.yAxes.unit]
        };
    }

    format = WaveformFormat.JS_NUMBERS;

    get values() {
        return this.chartData.data;
    }

    get length() {
        return this.chartData.data.length;
    }

    value(i: number) {
        return this.chartData.data[i];
    }

    waveformData(i: number) {
        return this.chartData.data[i];
    }

    dlog?: IWaveformDlogParams;

    offset = 0;
    scale = 1;

    get samplingRate() {
        return this.chartData.samplingRate;
    }

    xAxes: {
        unit: IUnit;
        logarithmic?: boolean;
    };

    yAxes: {
        minValue: number;
        maxValue: number;
        unit: IUnit;
    };
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartXAxisModel implements IAxisModel {
    constructor(private data: GenericChartWaveform) {}

    @computed
    get unit() {
        return this.data.xAxes.unit;
    }

    chartsController: ChartsController | undefined = undefined;

    get minValue() {
        return 0;
    }

    get maxValue() {
        return (this.data.length - 1) / this.data.samplingRate;
    }

    get defaultFrom() {
        return 0;
    }

    get defaultTo() {
        return this.maxValue;
    }

    get minScale() {
        return 1e-15;
    }

    get maxScale() {
        return 1e15;
    }

    @observable dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "default",
        from: 0,
        to: 0
    };

    @observable fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "default",
        subdivisionOffset: 0,
        subdivisonScale: 0
    };

    get defaultSubdivisionOffset() {
        return 0;
    }

    get defaultSubdivisionScale() {
        return 1;
    }

    label = "";
    color = "";
    colorInverse = "";

    get logarithmic() {
        return this.data.xAxes.logarithmic;
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartYAxisModel implements IAxisModel {
    constructor(private data: GenericChartWaveform) {}

    @computed
    get minValue() {
        return this.data.yAxes.minValue;
    }

    @computed
    get maxValue() {
        return this.data.yAxes.maxValue;
    }

    @computed
    get defaultFrom() {
        return this.data.yAxes.minValue;
    }

    @computed
    get defaultTo() {
        return this.data.yAxes.maxValue;
    }

    @computed
    get unit() {
        return this.data.yAxes.unit;
    }

    @observable dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "default",
        from: 0,
        to: 0
    };

    @observable fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "default",
        subdivisionOffset: 0,
        subdivisonScale: 0
    };

    get defaultSubdivisionOffset(): number | undefined {
        return 0;
    }

    get defaultSubdivisionScale() {
        return 1;
    }

    get label() {
        return "";
    }

    get color() {
        return "red";
    }

    get colorInverse() {
        return "green";
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartViewOptions implements IViewOptions {
    constructor(props?: any) {
        if (props) {
            Object.assign(this, props);
        }
    }

    @observable axesLines: IViewOptionsAxesLines = {
        type: "dynamic",
        steps: {
            x: [],
            y: []
        },
        majorSubdivision: {
            horizontal: 24,
            vertical: 8
        },
        minorSubdivision: {
            horizontal: 5,
            vertical: 5
        },
        snapToGrid: true,
        defaultZoomMode: "default"
    };

    @observable showAxisLabels: boolean = true;
    @observable showZoomButtons: boolean = true;

    setAxesLinesType(type: IViewOptionsAxesLinesType) {
        this.axesLines.type = type;
    }

    setAxesLinesMajorSubdivisionHorizontal(value: number) {
        this.axesLines.majorSubdivision.horizontal = value;
    }

    setAxesLinesMajorSubdivisionVertical(value: number) {
        this.axesLines.majorSubdivision.vertical = value;
    }

    setAxesLinesMinorSubdivisionHorizontal(value: number) {
        this.axesLines.minorSubdivision.horizontal = value;
    }

    setAxesLinesMinorSubdivisionVertical(value: number) {
        this.axesLines.minorSubdivision.vertical = value;
    }

    setAxesLinesStepsX(steps: number[]) {
        this.axesLines.steps.x = steps;
    }

    setAxesLinesStepsY(index: number, steps: number[]): void {
        this.axesLines.steps.y[index] = steps;
    }

    setAxesLinesSnapToGrid(value: boolean): void {
        this.axesLines.snapToGrid = value;
    }

    setShowAxisLabels(value: boolean) {
        this.showAxisLabels = value;
    }

    setShowZoomButtons(value: boolean) {
        this.showZoomButtons = value;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GenericChart extends React.Component<{
    chart: IChart;
    className?: string;
}> {
    render() {
        const waveform = new GenericChartWaveform(this.props.chart);
        const xAxisModel = new GenericChartXAxisModel(waveform);
        const yAxisModel = new GenericChartYAxisModel(waveform);
        const viewOptions = new GenericChartViewOptions();

        const chartsController = new GenericChartChartsController(
            waveform,
            "interactive",
            xAxisModel,
            viewOptions
        );

        xAxisModel.chartsController = chartsController;

        const chartController = new ChartController(chartsController, "TODO");

        chartsController.chartControllers = [chartController];

        chartController.createYAxisController(yAxisModel);

        chartController.lineControllers.push(
            new GenericChartLineController(
                "TODO",
                waveform,
                chartController.yAxisController
            )
        );

        return (
            <ChartsView
                chartsController={chartsController}
                className={this.props.className}
                sideDockAvailable={false}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartChartsController extends ChartsController {
    constructor(
        public data: GenericChartWaveform,
        mode: ChartMode,
        xAxisModel: IAxisModel,
        viewOptions: IViewOptions
    ) {
        super(mode, xAxisModel, viewOptions);
    }

    get chartViewOptionsProps() {
        return {
            showRenderAlgorithm: true,
            showShowSampledDataOption: false
        };
    }

    get supportRulers() {
        return false;
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartLineController extends LineController {
    constructor(
        public id: string,
        public waveform: GenericChartWaveform,
        yAxisController: AxisController
    ) {
        super(id, yAxisController);
    }

    @computed
    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        return this.yAxisController.axisModel.maxValue;
    }

    getNearestValuePoint(point: Point): Point {
        return getNearestValuePoint(
            point,
            this.xAxisController,
            this.yAxisController,
            this.waveform
        );
    }

    render(): JSX.Element {
        return <WaveformLineView key={this.id} waveformLineController={this} />;
    }

    getWaveformModel() {
        return null;
    }
}

class Measurement {
    constructor(
        public measurementsController: MeasurementsController,
        public measurementDefinition: IMeasurementDefinition,
        public measurementFunction: IMeasurementFunction | undefined
    ) {}

    @observable dirty = true;

    get measurementId() {
        return this.measurementDefinition.measurementId;
    }

    get namePrefix() {
        return (
            (this.measurementFunction && this.measurementFunction.name) ||
            this.measurementDefinition.measurementFunctionId
        );
    }

    @computed
    get name() {
        const namePrefix = this.namePrefix;

        let samePrefixBeforeCounter = 0;

        const measurements = this.measurementsController.measurements;

        let i;
        for (i = 0; i < measurements.length && measurements[i] !== this; ++i) {
            if (measurements[i].namePrefix === namePrefix) {
                samePrefixBeforeCounter++;
            }
        }

        if (i < measurements.length) {
            for (
                ++i;
                i < measurements.length &&
                measurements[i].namePrefix !== namePrefix;
                ++i
            ) {}
        }

        if (samePrefixBeforeCounter === 0 && i === measurements.length) {
            // no measurement with the same namePrefix found
            return namePrefix;
        }

        return `${namePrefix} ${samePrefixBeforeCounter + 1}`;
    }

    get arity() {
        return (
            (this.measurementFunction && this.measurementFunction.arity) || 1
        );
    }

    get parametersDescription() {
        return (
            this.measurementFunction &&
            this.measurementFunction.parametersDescription
        );
    }

    get parameters() {
        if (this.measurementDefinition.parameters) {
            return this.measurementDefinition.parameters;
        }

        const parameters: any = {};

        if (this.parametersDescription) {
            this.parametersDescription.forEach(parameter => {
                if (parameter.defaultValue) {
                    parameters[parameter.name] = parameter.defaultValue;
                }
            });
        }

        return parameters;
    }

    set parameters(value: any) {
        runInAction(() => (this.measurementDefinition.parameters = value));
    }

    get resultType() {
        return (
            (this.measurementFunction && this.measurementFunction.resultType) ||
            "value"
        );
    }

    get script() {
        return this.measurementFunction && this.measurementFunction.script;
    }

    get chartIndex() {
        return this.measurementDefinition.chartIndex || 0;
    }

    set chartIndex(value: number) {
        runInAction(() => (this.measurementDefinition.chartIndex = value));
    }

    get chartIndexes() {
        if (this.measurementDefinition.chartIndexes) {
            return this.measurementDefinition.chartIndexes;
        }
        return _range(this.arity);
    }

    set chartIndexes(value: number[]) {
        runInAction(() => (this.measurementDefinition.chartIndexes = value));
    }

    getChartTask(
        chartIndex: number
    ): ISingleInputMeasurementTaskSpecification | null {
        if (!this.script) {
            return null;
        }

        const lineController =
            this.measurementsController.chartsController.lineControllers[
                chartIndex
            ];
        const waveformModel =
            lineController && lineController.getWaveformModel();

        if (!waveformModel) {
            return null;
        }

        const length: number = waveformModel.length;

        if (length === 0) {
            return null;
        }

        function xAxisValueToIndex(value: number) {
            return value * waveformModel!.samplingRate;
        }

        const { x1, x2 } = this.measurementsController.measurementsInterval!;

        let xStartValue: number = x1;
        let a: number = clamp(
            Math.floor(xAxisValueToIndex(x1)),
            0,
            waveformModel.length
        );
        let b: number = clamp(
            Math.ceil(xAxisValueToIndex(x2)),
            0,
            waveformModel.length - 1
        );

        const xNumSamples = b - a + 1;
        if (xNumSamples <= 0) {
            return null;
        }

        return {
            xStartValue: xStartValue,
            xStartIndex: a,
            xNumSamples,

            format: waveformModel.format,
            values: waveformModel.values,
            offset: waveformModel.offset,
            scale: waveformModel.scale,

            dlog: waveformModel.dlog,

            samplingRate: waveformModel.samplingRate,
            valueUnit: waveformModel.valueUnit
        };
    }

    getMeasureTaskForSingleInput(
        taskSpec: ISingleInputMeasurementTaskSpecification
    ) {
        const accessor = {
            format: taskSpec.format,
            values: taskSpec.values,
            offset: taskSpec.offset,
            scale: taskSpec.scale,
            dlog: taskSpec.dlog,
            length: 0,
            value: (value: number) => 0,
            waveformData: (value: number) => 0
        };

        initValuesAccesor(accessor, true);

        return {
            values: taskSpec.values,
            xStartValue: taskSpec.xStartValue,
            xStartIndex: taskSpec.xStartIndex,
            xNumSamples: taskSpec.xNumSamples,
            samplingRate: taskSpec.samplingRate,
            getSampleValueAtIndex: accessor.value,
            valueUnit: taskSpec.valueUnit,
            inputs: [],
            parameters: this.parameters,
            result: null
        };
    }

    getMeasureTaskForMultipleInputs(
        taskSpec: IMultiInputMeasurementTaskSpecification
    ) {
        const inputs = taskSpec.inputs.map(input => {
            const accessor = {
                format: input.format,
                values: input.values,
                offset: input.offset,
                scale: input.scale,
                dlog: input.dlog,
                length: 0,
                value: (value: number) => 0,
                waveformData: (value: number) => 0
            };

            initValuesAccesor(accessor, true);

            return {
                values: input.values,
                samplingRate: input.samplingRate,
                getSampleValueAtIndex: accessor.value,
                valueUnit: input.valueUnit
            };
        });

        return {
            values: null,
            xStartValue: taskSpec.xStartValue,
            xStartIndex: taskSpec.xStartIndex,
            xNumSamples: taskSpec.xNumSamples,
            samplingRate: taskSpec.inputs[0].samplingRate,
            getSampleValueAtIndex: inputs[0].getSampleValueAtIndex,
            valueUnit: inputs[0].valueUnit,
            inputs,
            parameters: this.parameters,
            result: null
        };
    }

    get task(): IMeasureTask | null {
        if (!this.script) {
            return null;
        }

        if (this.arity === 1) {
            const singleInputTaskSpec = this.getChartTask(this.chartIndex);
            if (!singleInputTaskSpec) {
                return null;
            }
            return this.getMeasureTaskForSingleInput(singleInputTaskSpec);
        }

        const tasks = this.chartIndexes
            .map(chartIndex => this.getChartTask(chartIndex))
            .filter(task => task) as ISingleInputMeasurementTaskSpecification[];

        if (tasks.length < this.arity) {
            return null;
        }

        const task = tasks[0];
        let xStartValue = task.xStartValue;
        let xStartIndex = task.xStartIndex;
        let xEndIndex = task.xStartIndex + task.xNumSamples;

        for (let i = 1; i < tasks.length; ++i) {
            const task = tasks[i];

            if (task.xStartIndex > xStartIndex) {
                xStartIndex = task.xStartIndex;
            }

            if (task.xStartIndex + task.xNumSamples < xEndIndex) {
                xEndIndex = task.xStartIndex + task.xNumSamples;
            }
        }

        const xNumSamples = xEndIndex - xStartIndex;
        if (xNumSamples <= 0) {
            return null;
        }

        return this.getMeasureTaskForMultipleInputs({
            xStartValue,
            xStartIndex,
            xNumSamples,

            inputs: tasks.map(task => ({
                format: task.format,
                values: task.values,
                offset: task.offset,
                scale: task.scale,
                samplingRate: task.samplingRate,
                valueUnit: task.valueUnit,
                dlog: task.dlog,
                getSampleValueAtIndex: (index: number) => 0
            }))
        });
    }

    @observable result: {
        result: number | string | IChart | null;
        resultUnit?: keyof typeof UNITS | undefined;
    } | null = null;

    refreshResult() {
        if (!this.script) {
            return;
        }

        if (!this.measurementsController.measurementsInterval) {
            return;
        }

        const task = this.task;
        if (!task) {
            return;
        }

        let measureFunction: (task: IMeasureTask) => void;
        measureFunction = (require(this.script) as any).default;
        measureFunction(task);

        runInAction(() => {
            this.result = task;
            this.dirty = false;
        });
    }

    get chartPanelTitle() {
        const lineControllers =
            this.measurementsController.chartsController.lineControllers;
        if (lineControllers.length > 1) {
            if (this.arity === 1) {
                const lineController = lineControllers[this.chartIndex];
                if (lineController) {
                    return `${this.name} (${lineController.label})`;
                }
            } else {
                return `${this.name} (${this.chartIndexes
                    .map(chartIndex => {
                        const lineController = lineControllers[chartIndex];
                        return lineController ? lineController.label : "";
                    })
                    .join(", ")})`;
            }
        }

        return this.name;
    }

    get chartPanelConfiguration() {
        return {
            type: "component",
            componentName: "MeasurementValue",
            id: this.measurementId,
            componentState: {
                measurementId: this.measurementId
            },
            title: this.chartPanelTitle,
            isClosable: false
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IMeasurementDefinition {
    measurementId: string;
    measurementFunctionId: string;
    chartIndex?: number;
    chartIndexes?: number[];
    parameters?: any;
}

interface IInput {
    format: WaveformFormat;
    values: any;
    offset: number;
    scale: number;

    dlog?: IWaveformDlogParams;

    samplingRate: number;
    valueUnit: keyof typeof UNITS;
}

interface ISingleInputMeasurementTaskSpecification extends IInput {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;
}

interface IMultiInputMeasurementTaskSpecification {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;

    inputs: IInput[];
}

////////////////////////////////////////////////////////////////////////////////

export class MeasurementsModel {
    @observable measurements: IMeasurementDefinition[] = [];
    @observable chartPanelsViewState: string | undefined;

    constructor(props?: {
        measurements?: (string | IMeasurementDefinition)[];
        chartPanelsViewState?: string;
    }) {
        if (props) {
            if (props.measurements) {
                this.measurements = props.measurements.map(measurement => {
                    if (typeof measurement === "string") {
                        return {
                            measurementId: guid(),
                            measurementFunctionId: measurement
                        };
                    } else {
                        return measurement;
                    }
                });
            }

            if (props.chartPanelsViewState) {
                this.chartPanelsViewState = props.chartPanelsViewState;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class MeasurementInputField extends FieldComponent {
    render() {
        const measurement = this.props.dialogContext as Measurement;
        const inputIndex = parseInt(
            this.props.fieldProperties.name.slice(INPUT_FILED_NAME.length)
        );
        return (
            <select
                className="form-control"
                title="Chart rendering algorithm"
                value={
                    measurement.arity === 1
                        ? measurement.chartIndex
                        : measurement.chartIndexes[inputIndex]
                }
                onChange={action(
                    (event: React.ChangeEvent<HTMLSelectElement>) => {
                        const newChartIndex = parseInt(event.target.value);

                        if (measurement.arity === 1) {
                            measurement.chartIndex = newChartIndex;
                        } else {
                            const newChartIndexes =
                                measurement.chartIndexes.slice();
                            newChartIndexes[inputIndex] = newChartIndex;
                            measurement.chartIndexes = newChartIndexes;
                        }
                        measurement.dirty = true;
                    }
                )}
            >
                {measurement.measurementsController.chartsController.lineControllers.map(
                    (
                        lineController: ILineController,
                        lineControllerIndex: number
                    ) => (
                        <option
                            key={lineControllerIndex.toString()}
                            value={lineControllerIndex}
                        >
                            {lineController.label}
                        </option>
                    )
                )}
            </select>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const INPUT_FILED_NAME = "___input___";
const RESULT_FILED_NAME = "___result___";

@observer
class MeasurementComponent extends React.Component<{
    measurement: Measurement;
}> {
    get numCharts() {
        return this.props.measurement.measurementsController.chartsController
            .lineControllers.length;
    }

    get isResultVisible() {
        return this.props.measurement.resultType !== "chart";
    }

    get deleteAction() {
        const measurement = this.props.measurement;
        const measurements =
            measurement.measurementsController.measurementsModel.measurements;
        const index = measurements.indexOf(measurement.measurementDefinition);
        return (
            <IconAction
                icon="material:delete"
                iconSize={16}
                title="Remove measurement"
                style={{ color: "#333" }}
                onClick={() => {
                    runInAction(() => {
                        measurements.splice(index, 1);
                    });
                }}
            />
        );
    }

    get dialogDefinition() {
        const { measurement } = this.props;

        let fields: IFieldProperties[] = [];

        if (this.numCharts > 1) {
            fields = fields.concat(
                _range(measurement.arity).map(inputIndex => {
                    return {
                        name: `${INPUT_FILED_NAME}${inputIndex}`,
                        displayName:
                            measurement.arity === 1
                                ? "Input"
                                : `Input ${inputIndex + 1}`,
                        type: MeasurementInputField
                    } as IFieldProperties;
                })
            );
        }

        if (measurement.parametersDescription) {
            fields = fields.concat(measurement.parametersDescription);
        }

        if (this.isResultVisible) {
            fields.push({
                name: RESULT_FILED_NAME,
                displayName: "Result",
                type: MeasurementResultField,
                enclosureClassName:
                    "EezStudio_MeasurementsSideDockView_MeasurementResult_Enclosure"
            });
        }

        return {
            fields
        };
    }

    get dialogValues() {
        return this.props.measurement.parameters;
    }

    @action.bound
    onValueChange(name: string, value: string) {
        this.props.measurement.parameters = Object.assign(
            {},
            this.props.measurement.parameters,
            {
                [name]: value
            }
        );
        this.props.measurement.dirty = true;
    }

    @observable operationInProgress = false;

    async getCsv() {
        const result = this.props.measurement.result!.result as IChart;
        const data = result.data;
        const samplingRate = result.samplingRate;
        const xUnit = UNITS[result.xAxes.unit];
        const yUnit = UNITS[result.yAxes.unit];

        const locale = getLocale();

        // determine CSV separator depending of locale usage of ","
        let separator;
        if ((0.1).toLocaleString(locale).indexOf(",") != -1) {
            separator = ";";
        } else {
            separator = ",";
        }

        const numberFormat = new Intl.NumberFormat(locale, {
            useGrouping: false,
            maximumFractionDigits: 9
        });

        const CHUNK = 100000;

        let progressToastId: string | number = 0;

        if (data.length > CHUNK) {
            progressToastId = notification.info("Exporting to CSV ...", {
                autoClose: false,
                closeButton: false,
                closeOnClick: false,
                hideProgressBar: false,
                progressStyle: {
                    transition: "none"
                }
            });

            await new Promise(resolve => setTimeout(resolve, 0));
        }

        let csv = `[${xUnit.unitSymbol}]${separator}[${yUnit.unitSymbol}]\n`;
        for (let i = 0; i < data.length; i++) {
            csv += `${numberFormat.format(
                i / samplingRate
            )}${separator}${numberFormat.format(data[i])}\n`;

            if (data.length > CHUNK) {
                if (i > 0 && i % CHUNK === 0) {
                    const progress = i / data.length;

                    notification.update(progressToastId, {
                        progress
                    });

                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }

        if (data.length > CHUNK) {
            notification.dismiss(progressToastId);
        }

        return csv;
    }

    onSaveAsCsv = async () => {
        if (this.operationInProgress) {
            return;
        }

        runInAction(() => (this.operationInProgress = true));

        const csv = await this.getCsv();
        if (csv) {
            let options: SaveDialogOptions = {
                filters: [
                    {
                        name: "CSV Files",
                        extensions: ["csv"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ]
            };

            const result = await EEZStudio.remote.dialog.showSaveDialog(
                EEZStudio.remote.getCurrentWindow(),
                options
            );

            let filePath = result.filePath;
            if (filePath) {
                if (!filePath.toLowerCase().endsWith(".csv")) {
                    filePath += ".csv";
                }

                try {
                    await writeBinaryData(filePath, csv);
                    notification.success(`Saved as "${filePath}"`);
                } catch (err) {
                    console.error(err);
                    notification.error(err.toString());
                }
            }
        } else {
            notification.error(`Failed to export to CSV!`);
        }

        runInAction(() => (this.operationInProgress = false));
    };

    onCopy = async () => {
        if (this.operationInProgress) {
            return;
        }

        runInAction(() => (this.operationInProgress = true));

        if (this.props.measurement.resultType === "chart") {
            const csv = await this.getCsv();
            if (csv) {
                clipboard.writeText(csv);
                notification.success("CSV copied to the clipboard");
            } else {
                notification.error(`Failed to export to CSV!`);
            }
        } else {
            const measurementResult = this.props.measurement.result!;

            let text;
            if (typeof measurementResult.result === "string") {
                text = measurementResult.result;
            } else if (typeof measurementResult.result === "number") {
                let unit;
                if (measurementResult.resultUnit) {
                    unit = UNITS[measurementResult.resultUnit];
                }

                if (!unit) {
                    const lineController =
                        this.props.measurement.measurementsController
                            .chartsController.lineControllers[
                            this.props.measurement.chartIndex
                        ];
                    unit = lineController
                        ? lineController.yAxisController.unit
                        : UNKNOWN_UNIT;
                }

                text = unit.formatValue(measurementResult.result, 4);
            }

            if (text) {
                clipboard.writeText(text);
                notification.success("Value copied to the clipboard");
            } else {
                notification.error(`Failed to copy value to clipboard!`);
            }
        }

        runInAction(() => (this.operationInProgress = false));
    };

    render() {
        const { measurement } = this.props;

        let content;

        if (
            this.numCharts > 1 ||
            this.props.measurement.parametersDescription
        ) {
            content = (
                <td width="100%">
                    <GenericDialog
                        dialogDefinition={this.dialogDefinition}
                        dialogContext={measurement}
                        values={this.dialogValues}
                        embedded={true}
                        onValueChange={this.onValueChange}
                    />
                </td>
            );
        } else {
            // simplify in case of single chart and no measurement function parameters
            content = (
                <td width="100%">
                    {this.isResultVisible && (
                        <MeasurementValue
                            measurement={this.props.measurement}
                        />
                    )}
                </td>
            );
        }

        return (
            <React.Fragment>
                <tr key={measurement.measurementId}>
                    <td>{measurement.name}</td>
                    {content}
                    <td style={{ paddingRight: 20 }}>
                        <div className="EezStudio_ActionsContainer">
                            <IconAction
                                icon="material:content_copy"
                                iconSize={16}
                                title="Copy to clipboard"
                                onClick={this.onCopy}
                                enabled={
                                    !this.operationInProgress &&
                                    !!measurement.result
                                }
                            />
                            <IconAction
                                icon="material:save"
                                iconSize={16}
                                title="Save as CSV file"
                                onClick={this.onSaveAsCsv}
                                overlayText={"CSV"}
                                enabled={
                                    !this.operationInProgress &&
                                    !!measurement.result &&
                                    measurement.resultType == "chart"
                                }
                                style={{
                                    marginBottom: 10
                                }}
                            />
                            {this.deleteAction}
                        </div>
                    </td>
                </tr>
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class MeasurementsDockView extends React.Component<{
    measurementsController: MeasurementsController;
}> {
    get measurementsModel() {
        return this.props.measurementsController.measurementsModel;
    }

    get numCharts() {
        return this.props.measurementsController.chartsController
            .chartControllers.length;
    }

    @computed
    get availableMeasurements() {
        const availableMeasurements = [];
        for (const [
            measurementFunctionId,
            measurementFunction
        ] of measurementFunctions.get()) {
            if ((measurementFunction.arity || 1) > this.numCharts) {
                continue;
            }

            if (
                !measurementFunction.parametersDescription &&
                this.numCharts === 1 &&
                this.measurementsModel.measurements.find(
                    measurement =>
                        measurement.measurementFunctionId ===
                        measurementFunctionId
                )
            ) {
                continue;
            }

            availableMeasurements.push(measurementFunction);
        }
        return availableMeasurements
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(a => a.id);
    }

    render() {
        return (
            <div className="EezStudio_MeasurementsDockViewContainer">
                {this.props.measurementsController.refreshRequired && (
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            this.props.measurementsController.startMeasurement(
                                this.props.measurementsController.calcMeasurementsInterval()
                            );
                        }}
                    >
                        Refresh
                    </button>
                )}
                <div>
                    <table>
                        <tbody>
                            {_map(
                                this.props.measurementsController.measurements,
                                measurement => (
                                    <MeasurementComponent
                                        key={measurement.measurementId}
                                        measurement={measurement}
                                    />
                                )
                            )}
                        </tbody>
                    </table>
                </div>
                {this.availableMeasurements.length > 0 && (
                    <div className="dropdown">
                        <button
                            className="btn btn-sm btn-secondary dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                        >
                            Add Measurement
                        </button>
                        <div className="dropdown-menu">
                            {_map(
                                this.availableMeasurements,
                                measurementFunctionId => {
                                    return (
                                        <a
                                            key={measurementFunctionId}
                                            className="dropdown-item"
                                            href="#"
                                            onClick={action(() => {
                                                this.measurementsModel.measurements.push(
                                                    {
                                                        measurementId: guid(),
                                                        measurementFunctionId
                                                    }
                                                );
                                            })}
                                        >
                                            {
                                                measurementFunctions
                                                    .get()
                                                    .get(measurementFunctionId)!
                                                    .name
                                            }
                                        </a>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class MeasurementValue extends React.Component<{
    measurement: Measurement;
    inDockablePanel?: boolean;
}> {
    render() {
        if (!this.props.measurement.script) {
            return "?";
        }

        const measurementResult = this.props.measurement.result;

        if (measurementResult == null || measurementResult.result == null) {
            if (this.props.inDockablePanel) {
                return null;
            }
            return (
                <input
                    type="text"
                    className="form-control"
                    value={""}
                    readOnly={true}
                />
            );
        }

        if (typeof measurementResult.result === "string") {
            return measurementResult.result;
        }

        if (typeof measurementResult.result === "number") {
            let unit;
            if (measurementResult.resultUnit) {
                unit = UNITS[measurementResult.resultUnit];
            }

            if (!unit) {
                const lineController =
                    this.props.measurement.measurementsController
                        .chartsController.lineControllers[
                        this.props.measurement.chartIndex
                    ];
                unit = lineController
                    ? lineController.yAxisController.unit
                    : UNKNOWN_UNIT;
            }

            const strValue = unit.formatValue(measurementResult.result, 4);

            return (
                <input
                    type="text"
                    className="form-control"
                    value={strValue}
                    readOnly={true}
                />
            );
        }

        return (
            <div className="EezStudio_MeasurementChartContainer">
                <GenericChart chart={measurementResult.result} />
            </div>
        );
    }
}

@observer
class MeasurementResultField extends FieldComponent {
    render() {
        const measurement = this.props.dialogContext;
        return <MeasurementValue measurement={measurement} />;
    }
}

class GlobalViewOptions {
    static LOCAL_STORAGE_ITEM_ID = "shared/ui/chart/globalViewOptions";

    @observable enableZoomAnimations: boolean = true;
    @observable blackBackground: boolean = false;
    @observable renderAlgorithm: WaveformRenderAlgorithm = "minmax";
    @observable showSampledData: boolean = false;

    constructor() {
        const globalViewOptionsJSON = localStorage.getItem(
            GlobalViewOptions.LOCAL_STORAGE_ITEM_ID
        );
        if (globalViewOptionsJSON) {
            try {
                const globakViewOptionsJS = JSON.parse(globalViewOptionsJSON);
                runInAction(() => Object.assign(this, globakViewOptionsJS));
            } catch (err) {
                console.error(err);
            }
        }

        autorun(() => {
            localStorage.setItem(
                GlobalViewOptions.LOCAL_STORAGE_ITEM_ID,
                JSON.stringify(toJS(this))
            );
        });
    }
}

export const globalViewOptions = new GlobalViewOptions();

////////////////////////////////////////////////////////////////////////////////

const measurementFunctions = computed(() => {
    const allFunctions = new Map<string, IMeasurementFunction>();

    function loadMeasurementFunctions(
        extensionFolderPath: string,
        functions: IMeasurementFunction[]
    ) {
        functions.forEach((extensionMeasurementFunction: any) => {
            allFunctions.set(
                extensionMeasurementFunction.id,
                Object.assign({}, extensionMeasurementFunction, {
                    script:
                        extensionFolderPath +
                        "/" +
                        extensionMeasurementFunction.script
                })
            );
        });
    }

    extensions.forEach(extension => {
        if (extension.measurementFunctions) {
            loadMeasurementFunctions(
                extension.installationFolderPath!,
                extension.measurementFunctions
            );
        }
    });

    return allFunctions;
});

export interface WaveformModel {
    format: WaveformFormat;
    values: any;
    offset: number;
    scale: number;

    dlog?: IWaveformDlogParams;

    length: number;
    value: (index: number) => number;

    samplingRate: number;
    valueUnit: keyof typeof UNITS;

    rulers?: RulersModel;
    measurements?: MeasurementsModel;
}

const CONF_SINGLE_STEP_TIMEOUT = 1000 / 30;

////////////////////////////////////////////////////////////////////////////////

function clamp(value: number, min: number, max: number) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

function addAlphaToColor(color: string, alpha: number) {
    return tinycolor(color).setAlpha(alpha).toRgbString();
}

function genRandomOffsets(K: number) {
    let offsets = new Array(K);
    for (let i = 0; i < K; i++) {
        offsets[i] = i;
    }
    for (let i = 0; i < K; i++) {
        let a = Math.floor(Math.random() * K);
        let b = Math.floor(Math.random() * K);
        let temp = offsets[a];
        offsets[a] = offsets[b];
        offsets[b] = temp;
    }
    return offsets;
}

////////////////////////////////////////////////////////////////////////////////

interface IWaveformDlogParams {
    dataType: DataType;
    dataOffset: number;
    dataContainsSampleValidityBit: boolean;
    columnDataIndex: number;
    numBytesPerRow: number;
    bitMask: number;
    logOffset?: number;
    transformOffset: number;
    transformScale: number;
}

export interface IWaveform {
    format: any;
    values: any;
    offset: number;
    scale: number;

    dlog?: IWaveformDlogParams;

    length: number;
    value: (i: number) => number;
    waveformData: (i: number) => number;

    samplingRate: number;
}

interface IAxisController {
    from: number;
    to: number;
    range: number;
    scale: number;
    valueToPx(value: number): number;
    pxToValue(value: number): number;
    linearValueToPx(value: number): number;
    logarithmic?: boolean;
}

////////////////////////////////////////////////////////////////////////////////

type WaveformRenderAlgorithm = "avg" | "minmax" | "gradually";

interface IWaveformRenderJobSpecification {
    renderAlgorithm: string;
    waveform: IWaveform;
    xAxisController: IAxisController;
    yAxisController: IAxisController;
    xFromValue: number;
    xToValue: number;
    yFromValue: number;
    yToValue: number;
    strokeColor: string;
    label?: string;
}

////////////////////////////////////////////////////////////////////////////////

interface IContinuation {
    isDone?: boolean;
    xLabel?: number;
    yLabel?: number;
}

interface IAverageContinuation extends IContinuation {
    offsets: number[];
    offset: number;
    commitAlways: boolean;
}

interface IMinMaxContinuation extends IContinuation {
    offsets: number[];
    offset: number;
    commitAlways: boolean;
}

interface IGraduallyContinuation extends IContinuation {
    a: number;
    b: number;
    K: number;
    offsets: number[];
    offset: number;
    commitAlways: boolean;
}

interface ILogarithmicContinuation extends IContinuation {
    i: number;
    b: number;
    K: number;

    points: {
        x: number;
        y: number;
    }[];
}

////////////////////////////////////////////////////////////////////////////////

function renderWaveformPath(
    canvas: HTMLCanvasElement,
    job: IWaveformRenderJobSpecification,
    continuation: any
) {
    const { waveform, xAxisController, yAxisController, strokeColor, label } =
        job;

    let xFromPx = xAxisController.valueToPx(xAxisController.from);
    let xToPx = xAxisController.valueToPx(xAxisController.to);

    let xLabel = continuation ? continuation.xLabel : undefined;
    let yLabel = continuation ? continuation.yLabel : undefined;

    function xAxisPxToIndex(px: number) {
        return xAxisController.pxToValue(px) * waveform.samplingRate;
    }

    function renderSparse() {
        let a = Math.max(Math.floor(xAxisPxToIndex(xFromPx)) - 1, 0);
        let b = Math.min(
            Math.ceil(xAxisPxToIndex(xToPx)) + 1,
            waveform.length - 1
        );

        ctx.fillStyle = strokeColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.4;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let r = Math.max(
            1,
            Math.min(4, 0.75 / Math.sqrt(xAxisPxToIndex(1) - xAxisPxToIndex(0)))
        );

        // let y0 = Math.round(canvas.height - yAxisController.valueToPx(0));

        let xPrev = 0;
        let yPrev = 0;

        for (let i = a; i <= b; i++) {
            let x = Math.round(
                xAxisController.valueToPx(
                    (i * xAxisController.range) / (waveform.length - 1)
                )
            );
            let y = Math.round(
                canvas.height - yAxisController.valueToPx(waveform.value(i))
            );

            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fill();

            if (!label) {
                // draw vertical line to y-axis 0
                // if (r > 1.2) {
                //     ctx.beginPath();
                //     ctx.moveTo(x, y);
                //     ctx.lineTo(x, y0);
                //     ctx.stroke();
                // }
            }

            if (i > a) {
                ctx.beginPath();
                ctx.moveTo(xPrev, yPrev);
                ctx.lineTo(x, y);
                ctx.stroke();
            }

            xPrev = x;
            yPrev = y;

            if (xLabel == undefined || x > xLabel) {
                xLabel = x;
                yLabel = y;
            }
        }
    }

    function renderAverage(
        continuation: IAverageContinuation | undefined
    ): IAverageContinuation | undefined {
        function valueAt(x: number) {
            let a = xAxisPxToIndex(x);
            let b = xAxisPxToIndex(x + 1);

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);

            if (a >= b) {
                return NaN;
            }

            let aa = Math.ceil(a);
            let ad = aa - a;
            let y = waveform.value(Math.floor(a)) * ad;
            let c = ad;
            a = aa;

            let bb = Math.floor(b);
            let bd = b - bb;
            y += waveform.value(bb) * bd;
            c += bd;
            b = bb;

            for (let i = a; i < b; i++) {
                y += waveform.value(i);
                c++;
            }

            y /= c;

            y = yAxisController.valueToPx(y);

            return y;
        }

        xFromPx = Math.round(xFromPx);
        xToPx = Math.round(xToPx);

        const N = xToPx - xFromPx;

        let offsets: number[];
        let offset: number;
        if (continuation) {
            offsets = continuation.offsets;
            offset = continuation.offset;
        } else {
            ctx.fillStyle = strokeColor;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            offsets = genRandomOffsets(N);
            offset = 0;
        }

        let startTime = new Date().getTime();

        for (; offset < N; offset++) {
            if (new Date().getTime() - startTime > CONF_SINGLE_STEP_TIMEOUT) {
                return {
                    offsets,
                    offset,
                    commitAlways: false
                };
            }

            const x = xFromPx + offsets[offset];
            const y = valueAt(x);
            if (isFinite(y)) {
                ctx.beginPath();
                ctx.arc(x, canvas.height - y, 1, 0, 2 * Math.PI);
                ctx.fill();

                if (xLabel == undefined || x > xLabel) {
                    xLabel = x;
                    yLabel = canvas.height - y;
                }
            }
        }

        return undefined;
    }

    function renderMinMax(
        continuation: IMinMaxContinuation | undefined
    ): IMinMaxContinuation | undefined {
        function valueAt(x: number, result: number[]) {
            let a = Math.floor(xAxisPxToIndex(x));
            let b = Math.ceil(xAxisPxToIndex(x + 1));

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);
            if (a >= b) {
                return false;
            }

            let min = Number.MAX_VALUE;
            let max = -Number.MAX_VALUE;
            for (let i = a; i < b; i++) {
                const y = waveform.value(i);
                if (y < min) {
                    min = y;
                }
                if (y > max) {
                    max = y;
                }
            }

            if (min > max) {
                return false;
            }

            result[0] = yAxisController.valueToPx(min);
            result[1] = yAxisController.valueToPx(max);
            return true;
        }

        xFromPx = Math.round(xFromPx);
        xToPx = Math.round(xToPx);

        const N = xToPx - xFromPx;

        let offsets: number[];
        let offset: number;
        if (continuation) {
            offsets = continuation.offsets;
            offset = continuation.offset;
        } else {
            ctx.strokeStyle = strokeColor;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            offsets = genRandomOffsets(N);
            offset = 0;
        }

        let result = [0, 0];

        let startTime = new Date().getTime();

        for (; offset < N; offset++) {
            if (new Date().getTime() - startTime > CONF_SINGLE_STEP_TIMEOUT) {
                return {
                    offsets,
                    offset,
                    commitAlways: false
                };
            }

            const x = xFromPx + offsets[offset] + 0.5;

            if (valueAt(x, result)) {
                if (result[1] - result[0] < 1) {
                    result[1] = result[0] + 1;
                }
                ctx.beginPath();
                ctx.moveTo(x, canvas.height - result[0]);
                ctx.lineTo(x, canvas.height - result[1]);
                ctx.stroke();

                if (xLabel == undefined || x > xLabel) {
                    xLabel = x;
                    yLabel =
                        (canvas.height -
                            result[0] +
                            canvas.height -
                            result[1]) /
                        2;
                }
            }
        }

        return undefined;
    }

    function renderGradually(
        continuation: IGraduallyContinuation
    ): IGraduallyContinuation | undefined {
        function init(): boolean {
            let a = Math.round(xAxisPxToIndex(xFromPx));
            let b = Math.round(xAxisPxToIndex(xToPx));

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);

            if (a >= b) {
                return false;
            }

            let K = Math.floor((b - a) / canvas.width);
            if (K === 0) {
                K = 1;
            }

            const offsets = genRandomOffsets(K);
            const offset = 0;

            let minAlpha = 0.4;
            let maxAlpha = 1;
            let alpha = minAlpha + (maxAlpha - minAlpha) / K;

            ctx.fillStyle = addAlphaToColor(strokeColor, alpha);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            continuation = { a, b, K, offsets, offset, commitAlways: true };
            return true;
        }

        function renderStep(a: number, b: number, K: number, offset: number) {
            for (let i = a + offset; i < b; i += K) {
                let x = Math.round(
                    xAxisController.valueToPx(
                        (i * xAxisController.range) / waveform.length
                    )
                );
                let y = yAxisController.valueToPx(waveform.value(i));
                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                    ctx.fillRect(x - 1, canvas.height - y - 1, 2, 2);

                    if (xLabel == undefined || x > xLabel) {
                        xLabel = x;
                        yLabel = canvas.height - y;
                    }
                }
            }
        }

        if (!continuation && !init()) {
            return undefined;
        }

        renderStep(
            continuation.a,
            continuation.b,
            continuation.K,
            continuation.offsets[continuation.offset]
        );

        if (++continuation.offset < continuation.K) {
            return continuation;
        }

        return undefined;
    }

    function renderLogarithmic(
        continuation: ILogarithmicContinuation
    ): ILogarithmicContinuation | undefined {
        let xFromPx = Math.floor(
            xAxisController.linearValueToPx(xAxisController.from)
        );
        let xToPx = Math.ceil(
            xAxisController.linearValueToPx(xAxisController.to)
        );

        function init(): boolean {
            let a = Math.floor(xAxisPxToIndex(xFromPx)) - 1;
            let b = Math.ceil(xAxisPxToIndex(xToPx)) + 1;

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);

            if (a >= b) {
                return false;
            }

            let K = 50000;

            continuation = {
                i: a,
                b,
                K,
                points: [],
                isDone: false
            };
            return true;
        }

        function renderStep(continuation: ILogarithmicContinuation) {
            const { points, b, K } = continuation;

            let i = continuation.i;
            const iEnd = Math.min(i + K, b);
            for (; i < iEnd; ++i) {
                let x = Math.round(
                    xAxisController.valueToPx(i / waveform.samplingRate)
                );
                let y = Math.round(
                    canvas.height - yAxisController.valueToPx(waveform.value(i))
                );

                if (points.length === 0 || points[points.length - 1].x !== x) {
                    points.push({
                        x,
                        y
                    });
                } else {
                    if (y < points[points.length - 1].y) {
                        points[points.length - 1].y = y;
                    }
                }
            }
            continuation.i = i;
            if (i === b) {
                continuation.isDone = true;
            }

            ctx.fillStyle = strokeColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (i = 1; i < points.length; ++i) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
            }

            let R = 1.5;
            for (i = 0; i < points.length; ++i) {
                if (
                    (i === 0 || points[i].x - points[i - 1].x > 2 * R) &&
                    (i === points.length - 1 ||
                        points[i + 1].x - points[i].x > 2 * R)
                ) {
                    ctx.beginPath();
                    ctx.arc(points[i].x, points[i].y, R, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }

        if (!continuation && !init()) {
            return undefined;
        }

        renderStep(continuation);

        if (!continuation.isDone) {
            return continuation;
        }

        return undefined;
    }

    var ctx = canvas.getContext("2d")!;

    if (job.xAxisController.logarithmic) {
        continuation = renderLogarithmic(continuation);
    } else if (xAxisPxToIndex(1) - xAxisPxToIndex(0) < 1) {
        continuation = renderSparse();
    } else if (job.renderAlgorithm === "minmax") {
        continuation = renderMinMax(continuation);
    } else if (job.renderAlgorithm === "avg") {
        continuation = renderAverage(continuation);
    } else {
        continuation = renderGradually(continuation);
    }

    if (continuation) {
        continuation.xLabel = xLabel;
        continuation.yLabel = yLabel;
        return continuation;
    }

    // draw label
    if (label && xLabel != undefined && yLabel != undefined) {
        const FONT_SIZE = 14;
        const HORZ_PADDING = 4;
        const VERT_PADDING = 4;

        ctx.font = `${FONT_SIZE}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"`;

        const width =
            Math.ceil(ctx.measureText(label).width) + 2 * HORZ_PADDING;
        const height = FONT_SIZE + 2 * VERT_PADDING;

        xLabel = Math.round(xLabel - width);
        yLabel = Math.round(yLabel - height);

        if (xLabel < 0) {
            xLabel = 0;
        } else if (xLabel + width > canvas.width) {
            xLabel = canvas.width - width;
        }

        if (yLabel < 0) {
            yLabel = 0;
        } else if (yLabel + height > canvas.height) {
            yLabel = canvas.height - height;
        }

        xLabel += 0.5;
        yLabel += 0.5;

        ctx.fillStyle = strokeColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, xLabel + HORZ_PADDING, yLabel + VERT_PADDING);
    }

    return undefined;
}

export enum WaveformFormat {
    UNKNOWN,
    FLOATS_32BIT,
    RIGOL_BYTE,
    RIGOL_WORD,
    CSV_STRING,
    EEZ_DLOG,
    EEZ_DLOG_LOGARITHMIC,
    JS_NUMBERS,
    FLOATS_64BIT
}

function getCsvValues(valuesArray: any) {
    var values = new Buffer(valuesArray.buffer || []).toString("binary");

    if (!values || !values.split) {
        return [];
    }
    let lines = values
        .split("\n")
        .map(line => line.split(",").map(value => parseFloat(value)));
    if (lines.length === 1) {
        return lines[0];
    }
    return lines.map(line => line[0]);
}

const buffer = Buffer.allocUnsafe(8);

function readUInt8(data: any, i: number) {
    buffer[0] = data[i];
    return buffer.readUInt8(0);
}

function readInt16BE(data: any, i: number) {
    buffer[0] = data[i];
    buffer[1] = data[i + 1];
    return buffer.readInt16BE(0);
}

function readInt24BE(data: any, i: number) {
    buffer[0] = data[i];
    buffer[1] = data[i + 1];
    buffer[2] = data[i + 2];
    buffer[3] = 0;
    return buffer.readInt32BE(0) >> 8;
}

function readFloat(data: any, i: number) {
    buffer[0] = data[i];
    buffer[1] = data[i + 1];
    buffer[2] = data[i + 2];
    buffer[3] = data[i + 3];
    return buffer.readFloatLE(0);
}

function readDouble(data: any, i: number) {
    buffer[0] = data[i];
    buffer[1] = data[i + 1];
    buffer[2] = data[i + 2];
    buffer[3] = data[i + 3];
    buffer[4] = data[i + 4];
    buffer[5] = data[i + 5];
    buffer[6] = data[i + 6];
    buffer[7] = data[i + 7];
    return buffer.readDoubleLE(0);
}

export function initValuesAccesor(
    object: {
        // input
        format: WaveformFormat;
        values: any;
        offset: number;
        scale: number;

        dlog?: IWaveformDlogParams;

        // output
        length: number;
        value(value: number): number;
        waveformData(value: number): number;
    },
    disableNaNs: boolean = false
) {
    const values = object.values || [];
    const format = object.format;
    const offset = object.offset;
    const scale = object.scale;

    let length: number;
    let value: (value: number) => number;
    let waveformData: (value: number) => number;

    if (format === WaveformFormat.FLOATS_32BIT) {
        length = Math.floor(values.length / 4);
        value = (index: number) => {
            return offset + readFloat(values, 4 * index) * scale;
        };
        waveformData = value;
    } else if (format === WaveformFormat.FLOATS_64BIT) {
        length = Math.floor(values.length / 8);
        value = (index: number) => {
            return offset + readDouble(values, 8 * index) * scale;
        };
        waveformData = value;
    } else if (format === WaveformFormat.RIGOL_BYTE) {
        length = values.length;
        waveformData = (index: number) => {
            return values[index];
        };
        value = (index: number) => {
            return offset + waveformData(index) * scale;
        };
    } else if (format === WaveformFormat.RIGOL_WORD) {
        length = Math.floor(values.length / 2);
        waveformData = (index: number) => {
            return values[index];
        };
        value = (index: number) => {
            return offset + waveformData(index) * scale;
        };
    } else if (format === WaveformFormat.CSV_STRING) {
        const csvValues = getCsvValues(values);
        length = csvValues.length;
        value = (index: number) => {
            return offset + csvValues[index] * scale;
        };
        waveformData = value;
    } else if (
        format === WaveformFormat.EEZ_DLOG ||
        format === WaveformFormat.EEZ_DLOG_LOGARITHMIC
    ) {
        length = object.length;
        if (length === undefined) {
            length = values.length;
        }

        const {
            dataType,
            dataContainsSampleValidityBit,
            dataOffset,
            columnDataIndex,
            numBytesPerRow,
            bitMask,
            logOffset,
            transformOffset,
            transformScale
        } = object.dlog!;

        value = (index: number) => {
            let rowOffset = dataOffset + index * numBytesPerRow;

            let value;

            if (
                !dataContainsSampleValidityBit ||
                readUInt8(values, rowOffset) & 0x80
            ) {
                rowOffset += columnDataIndex;

                if (dataType == DataType.DATA_TYPE_BIT) {
                    value = readUInt8(values, rowOffset) & bitMask ? 1.0 : 0.0;
                } else if (dataType == DataType.DATA_TYPE_INT16_BE) {
                    value =
                        transformOffset +
                        transformScale * readInt16BE(values, rowOffset);
                } else if (dataType == DataType.DATA_TYPE_INT24_BE) {
                    value =
                        transformOffset +
                        transformScale * readInt24BE(values, rowOffset);
                } else if (dataType == DataType.DATA_TYPE_FLOAT) {
                    value = readFloat(values, rowOffset);
                } else {
                    console.error("Unknown data type", dataType);
                    value = NaN;
                }
            } else {
                value = NaN;
            }

            if (format === WaveformFormat.EEZ_DLOG_LOGARITHMIC) {
                return Math.log10(logOffset! + value);
            } else {
                return offset + value * scale;
            }
        };

        waveformData = value;
    } else if (format === WaveformFormat.JS_NUMBERS) {
        length = object.length;
        value = (index: number) => {
            return values[offset + index * scale];
        };
        waveformData = value;
    } else {
        return;
    }

    object.length = length;

    if (format === WaveformFormat.EEZ_DLOG && disableNaNs) {
        object.value = (index: number) => {
            let x = value(index);
            if (!isNaN(x)) {
                return x;
            }

            // find first non NaN on left or right
            const nLeft = index;
            const nRight = length - index - 1;

            const n = Math.min(nLeft, nRight);

            let k;
            for (k = 1; k <= n; ++k) {
                // check left
                x = value(index - k);
                if (!isNaN(x)) {
                    return x;
                }

                // check right
                x = value(index + k);
                if (!isNaN(x)) {
                    return x;
                }
            }

            if (nLeft > nRight) {
                index -= k;
                for (; index >= 0; --index) {
                    // check left
                    x = value(index);
                    if (!isNaN(x)) {
                        return x;
                    }
                }
            } else if (nLeft < nRight) {
                index += k;
                for (; index < length; ++index) {
                    // check right
                    x = value(index);
                    if (!isNaN(x)) {
                        return x;
                    }
                }
            }

            // give up
            return NaN;
        };
    } else {
        object.value = value;
    }

    object.waveformData = waveformData;
}

@observer
class BookmarkView extends React.Component<{
    chartsController: ChartsController;
    index: number;
    bookmark: ChartBookmark;
    selected: boolean;
    onClick: () => void;
}> {
    render() {
        const { chartsController, index, bookmark, selected, onClick } =
            this.props;

        let className = classNames({
            selected
        });

        const xAxisController = chartsController.xAxisController;
        const time = bookmark.value;

        const timeStr = xAxisController.axisModel.unit.formatValue(
            xAxisController.axisModel.semiLogarithmic
                ? Math.pow(
                      10,
                      time + xAxisController.axisModel.semiLogarithmic.a
                  ) + xAxisController.axisModel.semiLogarithmic.b
                : time,
            4
        );

        return (
            <tr className={className} onClick={onClick}>
                <td>{index}.</td>
                <td>{timeStr}</td>
                <td>{bookmark.text}</td>
            </tr>
        );
    }
}

@observer
class BookmarksView extends React.Component<{
    chartsController: ChartsController;
}> {
    div: HTMLElement | null = null;

    ensureVisible() {
        if (this.div) {
            const selectedRow = $(this.div).find("tr.selected")[0];
            if (selectedRow) {
                scrollIntoViewIfNeeded(selectedRow);
            }
        }
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    render() {
        const { chartsController } = this.props;

        if (!chartsController.bookmarks) {
            return null;
        }

        return (
            <div
                className="EezStudio_BookmarksTableContainer"
                ref={ref => (this.div = ref!)}
            >
                <table>
                    <tbody>
                        {chartsController.bookmarks.map((bookmark, i) => (
                            <BookmarkView
                                key={i}
                                chartsController={chartsController}
                                index={i + 1}
                                bookmark={bookmark}
                                selected={
                                    i == chartsController.selectedBookmark
                                }
                                onClick={() =>
                                    chartsController.selectBookmark(i)
                                }
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}

export class RulersModel {
    @observable xAxisRulersEnabled: boolean = false;
    @observable x1: number = 0;
    @observable x2: number = 0;
    @observable yAxisRulersEnabled: boolean[] = [];
    @observable y1: number[] = [];
    @observable y2: number[] = [];
    @observable pauseDbUpdate?: boolean = false;

    constructor(props: any) {
        if (props) {
            if (!Array.isArray(props.yAxisRulersEnabled)) {
                props.yAxisRulersEnabled = [props.yAxisRulersEnabled];
                props.y1 = [props.y1];
                props.y2 = [props.y2];
            }

            Object.assign(this, props);
        }
    }

    initYRulers(numCharts: number) {
        for (let chartIndex = 0; chartIndex < numCharts; chartIndex++) {
            if (
                chartIndex >= this.yAxisRulersEnabled.length ||
                this.yAxisRulersEnabled[chartIndex] === undefined
            ) {
                this.yAxisRulersEnabled[chartIndex] = false;
                this.y1[chartIndex] = 0;
                this.y2[chartIndex] = 0;
            }
        }
    }
}

class DragXRulerMouseHandler implements MouseHandler {
    cursor = "ew-resize";
    xStart: number = 0;
    x1: number = 0;
    dx: number = 0;

    constructor(
        private rulersController: RulersController,
        private whichRuller: "x1" | "x2" | "both" | "none"
    ) {}

    get xAxisController() {
        return this.rulersController.chartsController.xAxisController;
    }

    @action
    down(point: SVGPoint, event: PointerEvent) {
        this.rulersController.rulersModel.pauseDbUpdate = true;

        this.xStart = this.xAxisController.pxToValue(point.x);

        if (this.whichRuller === "none") {
            let x = getSnapToValue(event, this.xStart, this.xAxisController);
            x = this.rulersController.snapToSample(x);

            this.rulersController.rulersModel.x1 = x;
            this.rulersController.rulersModel.x2 = x;
        }

        this.x1 = this.rulersController.rulersModel.x1;
        this.dx =
            this.rulersController.rulersModel.x2 -
            this.rulersController.rulersModel.x1;
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let x = this.xAxisController.pxToValue(point.x);
        if (this.whichRuller === "both") {
            x = getSnapToValue(
                event,
                this.x1 + x - this.xStart,
                this.xAxisController
            );
            x = this.rulersController.snapToSample(x);

            if (x < this.xAxisController.minValue) {
                x = this.xAxisController.minValue;
            }

            if (x + this.dx < this.xAxisController.minValue) {
                x = this.xAxisController.minValue - this.dx;
            }

            if (x > this.xAxisController.maxValue) {
                x = this.xAxisController.maxValue;
            }

            if (x + this.dx > this.xAxisController.maxValue) {
                x = this.xAxisController.maxValue - this.dx;
            }

            this.rulersController.rulersModel.x1 = x;
            this.rulersController.rulersModel.x2 = x + this.dx;
        } else {
            x = getSnapToValue(event, x, this.xAxisController);
            x = this.rulersController.snapToSample(x);

            if (x < this.xAxisController.minValue) {
                x = this.xAxisController.minValue;
            } else if (x > this.xAxisController.maxValue) {
                x = this.xAxisController.maxValue;
            }

            if (this.whichRuller === "x1") {
                this.rulersController.rulersModel.x1 = x;
            } else {
                this.rulersController.rulersModel.x2 = x;
            }

            if (
                this.rulersController.rulersModel.x1 >
                this.rulersController.rulersModel.x2
            ) {
                const temp = this.rulersController.rulersModel.x2;
                this.rulersController.rulersModel.x2 =
                    this.rulersController.rulersModel.x1;
                this.rulersController.rulersModel.x1 = temp;

                this.whichRuller = this.whichRuller === "x1" ? "x2" : "x1";
            }
        }
    }

    @action
    up(
        point: SVGPoint | undefined,
        event: PointerEvent | undefined,
        cancel: boolean
    ) {
        this.rulersController.rulersModel.pauseDbUpdate = false;
    }

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = false;
    }

    render() {
        return null;
    }
}

class DragYRulerMouseHandler implements MouseHandler {
    chartIndex: number;

    cursor = "ns-resize";
    yStart: number = 0;
    y1: number = 0;
    dy: number = 0;

    constructor(
        private chartView: ChartView,
        private whichRuller: "y1" | "y2" | "both" | "none"
    ) {
        this.chartIndex = chartView.props.chartController.chartIndex;
    }

    get rulersController() {
        return this.chartView.props.chartController.chartsController
            .rulersController;
    }

    get rulersModel() {
        return this.rulersController.rulersModel;
    }

    get yAxisController() {
        return this.chartView.props.chartController.yAxisController;
    }

    @action
    down(point: SVGPoint, event: PointerEvent) {
        this.rulersModel.pauseDbUpdate = true;

        this.yStart = this.yAxisController.pxToValue(point.y);

        if (this.whichRuller === "none") {
            let y = this.yAxisController.pxToValue(point.y);
            y = getSnapToValue(event, y, this.yAxisController);

            this.rulersModel.y1[this.chartIndex] = y;
            this.rulersModel.y2[this.chartIndex] = y;
        }

        this.y1 = this.rulersModel.y1[this.chartIndex];
        this.dy =
            this.rulersModel.y2[this.chartIndex] -
            this.rulersModel.y1[this.chartIndex];
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let y = this.yAxisController.pxToValue(point.y);
        if (this.whichRuller === "both") {
            y = getSnapToValue(
                event,
                this.y1 + y - this.yStart,
                this.yAxisController
            );

            if (y < this.yAxisController.minValue) {
                y = this.yAxisController.minValue;
            }

            if (y + this.dy < this.yAxisController.minValue) {
                y = this.yAxisController.minValue - this.dy;
            }

            if (y > this.yAxisController.maxValue) {
                y = this.yAxisController.maxValue;
            }

            if (y + this.dy > this.yAxisController.maxValue) {
                y = this.yAxisController.maxValue - this.dy;
            }

            this.rulersModel.y1[this.chartIndex] = y;
            this.rulersModel.y2[this.chartIndex] = y + this.dy;
        } else {
            y = getSnapToValue(event, y, this.yAxisController);

            if (y < this.yAxisController.minValue) {
                y = this.yAxisController.minValue;
            } else if (y > this.yAxisController.maxValue) {
                y = this.yAxisController.maxValue;
            }

            if (this.whichRuller === "y1") {
                this.rulersModel.y1[this.chartIndex] = y;
            } else {
                this.rulersModel.y2[this.chartIndex] = y;
            }
        }
    }

    @action
    up(
        point: SVGPoint | undefined,
        event: PointerEvent | undefined,
        cancel: boolean
    ) {
        this.rulersModel.pauseDbUpdate = false;
    }

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = false;
    }

    render() {
        return null;
    }
}

class RulersController {
    constructor(
        public chartsController: ChartsController,
        public rulersModel: RulersModel
    ) {}

    @computed
    get x1() {
        return (
            Math.round(
                this.chartsController.chartLeft +
                    this.chartsController.xAxisController.valueToPx(
                        this.rulersModel.x1
                    )
            ) + 0.5
        );
    }

    @computed
    get x2() {
        return (
            Math.round(
                this.chartsController.chartLeft +
                    this.chartsController.xAxisController.valueToPx(
                        this.rulersModel.x2
                    )
            ) + 0.5
        );
    }

    getY1(chartIndex: number) {
        return (
            Math.round(
                this.chartsController.chartBottom -
                    this.chartsController.chartControllers[
                        chartIndex
                    ].yAxisController.valueToPx(this.rulersModel.y1[chartIndex])
            ) + 0.5
        );
    }

    getY2(chartIndex: number) {
        return (
            Math.round(
                this.chartsController.chartBottom -
                    this.chartsController.chartControllers[
                        chartIndex
                    ].yAxisController.valueToPx(this.rulersModel.y2[chartIndex])
            ) + 0.5
        );
    }

    onDragStart(
        chartView: ChartView,
        event: PointerEvent
    ): MouseHandler | undefined {
        if (closestByClass(event.target, "EezStudio_ChartRuler_x1rect")) {
            return new DragXRulerMouseHandler(this, "x1");
        }

        if (closestByClass(event.target, "EezStudio_ChartRuler_x2rect")) {
            return new DragXRulerMouseHandler(this, "x2");
        }

        if (closestByClass(event.target, "EezStudio_ChartRuler_y1rect")) {
            return new DragYRulerMouseHandler(chartView, "y1");
        }

        if (closestByClass(event.target, "EezStudio_ChartRuler_y2rect")) {
            return new DragYRulerMouseHandler(chartView, "y2");
        }

        if (closestByClass(event.target, "EezStudio_ChartRuler_xrect")) {
            return new DragXRulerMouseHandler(this, "both");
        }

        if (closestByClass(event.target, "EezStudio_ChartRuler_yrect")) {
            return new DragYRulerMouseHandler(chartView, "both");
        }

        if (this.rulersModel.xAxisRulersEnabled) {
            return new DragXRulerMouseHandler(this, "none");
        } else if (
            chartView.props.chartController.chartIndex <
                this.rulersModel.yAxisRulersEnabled.length &&
            this.rulersModel.yAxisRulersEnabled[
                chartView.props.chartController.chartIndex
            ]
        ) {
            return new DragYRulerMouseHandler(chartView, "none");
        }

        return undefined;
    }

    static LINE_WIDTH = 2;
    static BAND_WIDTH = 8;

    @computed
    get color() {
        return globalViewOptions.blackBackground ? "#d4e5f3" : "#337BB7";
    }

    @computed
    get fillOpacity() {
        return globalViewOptions.blackBackground ? 0.2 : 0.1;
    }

    renderXRulersRect(chartView: ChartView) {
        if (!this.rulersModel.xAxisRulersEnabled) {
            return null;
        }

        let x1 = this.x1;
        let x2 = this.x2;
        if (x1 > x2) {
            const temp = x1;
            x1 = x2;
            x2 = temp;
        }

        const y1 = this.chartsController.chartTop;
        const y2 = this.chartsController.chartBottom;

        return (
            <g clipPath={`url(#${chartView.clipId})`}>
                <rect
                    className="EezStudio_ChartRuler_xrect"
                    x={x1}
                    y={y1}
                    width={x2 - x1}
                    height={y2 - y1}
                    fillOpacity={this.fillOpacity}
                    fill={this.color}
                    style={{ cursor: "move" }}
                />
            </g>
        );
    }

    renderXRulersLines(chartView: ChartView) {
        if (!this.rulersModel.xAxisRulersEnabled) {
            return null;
        }

        const x1 = this.x1;
        const x2 = this.x2;

        const y1 = this.chartsController.chartTop;
        const y2 = this.chartsController.chartBottom;

        return (
            <g clipPath={`url(#${chartView.clipId})`}>
                <line
                    x1={x1}
                    y1={y1}
                    x2={x1}
                    y2={y2}
                    stroke={this.color}
                    strokeWidth={RulersController.LINE_WIDTH}
                />
                <rect
                    className="EezStudio_ChartRuler_x1rect"
                    x={x1 - RulersController.BAND_WIDTH / 2}
                    y={y1}
                    width={RulersController.BAND_WIDTH}
                    height={y2 - y1}
                    fillOpacity={0}
                    style={{ cursor: "ew-resize" }}
                />

                <line
                    x1={x2}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={this.color}
                    strokeWidth={RulersController.LINE_WIDTH}
                />
                <rect
                    className="EezStudio_ChartRuler_x2rect"
                    x={x2 - RulersController.BAND_WIDTH / 2}
                    y={y1}
                    width={RulersController.BAND_WIDTH}
                    height={y2 - y1}
                    fillOpacity={0}
                    style={{ cursor: "ew-resize" }}
                />
            </g>
        );
    }

    renderYRulersRect(chartView: ChartView) {
        const chartIndex = chartView.props.chartController.chartIndex;

        if (
            chartIndex >= this.rulersModel.yAxisRulersEnabled.length ||
            !this.rulersModel.yAxisRulersEnabled[chartIndex]
        ) {
            return null;
        }

        let y1 = this.getY1(chartIndex);
        let y2 = this.getY2(chartIndex);
        if (y1 < y2) {
            const temp = y1;
            y1 = y2;
            y2 = temp;
        }

        const x1 = this.chartsController.chartLeft;
        const x2 = this.chartsController.chartRight;

        return (
            <g clipPath={`url(#${chartView.clipId})`}>
                <rect
                    className="EezStudio_ChartRuler_yrect"
                    x={x1}
                    y={y2}
                    width={x2 - x1}
                    height={y1 - y2}
                    fillOpacity={this.fillOpacity}
                    fill={this.color}
                    style={{ cursor: "move" }}
                />
            </g>
        );
    }

    renderYRulersLines(chartView: ChartView) {
        const chartIndex = chartView.props.chartController.chartIndex;

        if (
            chartIndex >= this.rulersModel.yAxisRulersEnabled.length ||
            !this.rulersModel.yAxisRulersEnabled[chartIndex]
        ) {
            return null;
        }

        const y1 = this.getY1(chartIndex);
        const y2 = this.getY2(chartIndex);

        const x1 = this.chartsController.chartLeft;
        const x2 = this.chartsController.chartRight;

        return (
            <g clipPath={`url(#${chartView.clipId})`}>
                <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y1}
                    stroke={this.color}
                    strokeWidth={RulersController.LINE_WIDTH}
                />
                <rect
                    className="EezStudio_ChartRuler_y1rect"
                    x={x1}
                    y={y1 - RulersController.BAND_WIDTH / 2}
                    width={x2 - x1}
                    height={RulersController.BAND_WIDTH}
                    fillOpacity={0}
                    style={{ cursor: "ns-resize" }}
                />

                <line
                    x1={x1}
                    y1={y2}
                    x2={x2}
                    y2={y2}
                    stroke={this.color}
                    strokeWidth={RulersController.LINE_WIDTH}
                />
                <rect
                    className="EezStudio_ChartRuler_y2rect"
                    x={x1}
                    y={y2 - RulersController.BAND_WIDTH / 2}
                    width={x2 - x1}
                    height={RulersController.BAND_WIDTH}
                    fillOpacity={0}
                    style={{ cursor: "ns-resize" }}
                />
            </g>
        );
    }

    render(chartView: ChartView) {
        return (
            <React.Fragment>
                {this.renderYRulersRect(chartView)}
                {this.renderXRulersRect(chartView)}
                {this.renderYRulersLines(chartView)}
                {this.renderXRulersLines(chartView)}
            </React.Fragment>
        );
    }

    snapToSample(x: number) {
        x =
            (x / this.chartsController.xAxisController.range) *
            (this.chartsController.xAxisController.numSamples - 1);
        return (
            (Math.round(x) * this.chartsController.xAxisController.range) /
            (this.chartsController.xAxisController.numSamples - 1)
        );
    }
}

interface RulersDockViewProps {
    chartsController: ChartsController;
}

@observer
class RulersDockView extends React.Component<RulersDockViewProps> {
    @observable x1: string = "";
    @observable x1Error: boolean = false;
    @observable x2: string = "";
    @observable x2Error: boolean = false;
    @observable y1: string[] = [];
    @observable y1Error: boolean[] = [];
    @observable y2: string[] = [];
    @observable y2Error: boolean[] = [];

    outsideChangeInXRulersSubscriptionDisposer: any;
    outsideChangeInYRulersSubscriptionDisposer: any;

    isInsideChange: boolean = false;

    constructor(props: RulersDockViewProps) {
        super(props);

        this.subscribeToOutsideModelChanges();
    }

    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.subscribeToOutsideModelChanges();
        }
    }

    @action
    subscribeToOutsideModelChanges() {
        if (this.outsideChangeInXRulersSubscriptionDisposer) {
            this.outsideChangeInXRulersSubscriptionDisposer();
        }

        this.outsideChangeInXRulersSubscriptionDisposer = autorun(() => {
            const x1 =
                this.props.chartsController.xAxisController.unit.formatValue(
                    this.rulersModel.x1,
                    10
                );
            const x2 =
                this.props.chartsController.xAxisController.unit.formatValue(
                    this.rulersModel.x2,
                    10
                );
            if (!this.isInsideChange) {
                runInAction(() => {
                    this.x1 = x1;
                    this.x1Error = false;
                    this.x2 = x2;
                    this.x2Error = false;
                });
            }
        });

        if (this.outsideChangeInYRulersSubscriptionDisposer) {
            this.outsideChangeInYRulersSubscriptionDisposer();
        }

        this.outsideChangeInYRulersSubscriptionDisposer = autorun(() => {
            for (
                let i = 0;
                i < this.props.chartsController.chartControllers.length;
                ++i
            ) {
                const chartController =
                    this.props.chartsController.chartControllers[i];
                if (
                    i < this.rulersModel.yAxisRulersEnabled.length &&
                    this.rulersModel.yAxisRulersEnabled[i] &&
                    !this.isInsideChange
                ) {
                    const y1 = chartController.yAxisController.unit.formatValue(
                        this.rulersModel.y1[i],
                        4
                    );
                    const y2 = chartController.yAxisController.unit.formatValue(
                        this.rulersModel.y2[i],
                        4
                    );

                    runInAction(() => {
                        this.y1[i] = y1;
                        this.y1Error[i] = false;
                        this.y2[i] = y2;
                        this.y2Error[i] = false;
                    });
                }
            }
        });
    }

    get rulersController() {
        return this.props.chartsController.rulersController;
    }

    get rulersModel() {
        return this.rulersController.rulersModel!;
    }

    validateXRange() {
        const xAxisController = this.props.chartsController.xAxisController;

        const x1 = xAxisController.unit.parseValue(this.x1);
        this.x1Error =
            x1 == null ||
            x1 < xAxisController.minValue ||
            x1 > xAxisController.maxValue;

        const x2 = xAxisController.unit.parseValue(this.x2);
        this.x2Error =
            x2 == null ||
            x2 < xAxisController.minValue ||
            x2 > xAxisController.maxValue;

        if (this.x1Error || this.x2Error) {
            return;
        }

        this.rulersModel.x1 = x1!;
        this.rulersModel.x2 = x2!;
    }

    @action.bound
    enableXAxisRulers(checked: boolean) {
        if (checked) {
            this.rulersModel.xAxisRulersEnabled = true;

            const xAxisController = this.props.chartsController.xAxisController;

            this.rulersModel.x1 = this.rulersController.snapToSample(
                xAxisController.from + 0.1 * xAxisController.distance
            );

            this.rulersModel.x2 = this.rulersController.snapToSample(
                xAxisController.to - 0.1 * xAxisController.distance
            );
        } else {
            this.rulersModel.xAxisRulersEnabled = false;
        }
    }

    setX1 = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.isInsideChange = true;
        runInAction(() => {
            this.x1 = event.target.value;
            this.validateXRange();
        });
        this.isInsideChange = false;
    };

    setX2 = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.isInsideChange = true;
        runInAction(() => {
            this.x2 = event.target.value;
            this.validateXRange();
        });
        this.isInsideChange = false;
    };

    zoomToFitXRulers = () => {
        let x1;
        let x2;
        if (this.rulersModel.x1 < this.rulersModel.x2) {
            x1 = this.rulersModel.x1;
            x2 = this.rulersModel.x2;
        } else {
            x1 = this.rulersModel.x2;
            x2 = this.rulersModel.x1;
        }

        const dx = x2 - x1;
        this.props.chartsController.xAxisController.zoom(
            x1 - 0.05 * dx,
            x2 + 0.05 * dx
        );
    };

    validateYRange(chartIndex: number) {
        const yAxisController =
            this.props.chartsController.chartControllers[chartIndex]
                .yAxisController;

        const y1 = yAxisController.unit.parseValue(this.y1[chartIndex]);
        this.y1Error[chartIndex] =
            y1 == null ||
            y1 < yAxisController.minValue ||
            y1 > yAxisController.maxValue;

        const y2 = yAxisController.unit.parseValue(this.y2[chartIndex]);
        this.y2Error[chartIndex] =
            y2 == null ||
            y2 < yAxisController.minValue ||
            y2 > yAxisController.maxValue;

        if (this.y1Error[chartIndex] || this.y2Error[chartIndex]) {
            return;
        }

        this.rulersModel.y1[chartIndex] = y1!;
        this.rulersModel.y2[chartIndex] = y2!;
    }

    @action.bound
    enableYAxisRulers(chartIndex: number, checked: boolean) {
        if (checked) {
            this.rulersModel.yAxisRulersEnabled[chartIndex] = true;

            const yAxisController =
                this.props.chartsController.chartControllers[chartIndex]
                    .yAxisController;

            this.rulersModel.y1[chartIndex] =
                yAxisController.from + 0.1 * yAxisController.distance;
            this.rulersModel.y2[chartIndex] =
                yAxisController.to - 0.1 * yAxisController.distance;
        } else {
            this.rulersModel.yAxisRulersEnabled[chartIndex] = false;
        }
    }

    setY1 = (
        chartIndex: number,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        this.isInsideChange = true;
        runInAction(() => {
            this.y1[chartIndex] = event.target.value;
            this.validateYRange(chartIndex);
        });
        this.isInsideChange = false;
    };

    setY2 = (
        chartIndex: number,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        this.isInsideChange = true;
        runInAction(() => {
            this.y2[chartIndex] = event.target.value;
            this.validateYRange(chartIndex);
        });
        this.isInsideChange = false;
    };

    zoomToFitYRulers = (chartIndex: number) => {
        let y1;
        let y2;
        if (this.rulersModel.y1[chartIndex] < this.rulersModel.y2[chartIndex]) {
            y1 = this.rulersModel.y1[chartIndex];
            y2 = this.rulersModel.y2[chartIndex];
        } else {
            y1 = this.rulersModel.y2[chartIndex];
            y2 = this.rulersModel.y1[chartIndex];
        }

        const dy = y2 - y1;
        this.props.chartsController.chartControllers[
            chartIndex
        ].yAxisController.zoom(y1 - 0.05 * dy, y2 + 0.05 * dy);
    };

    render() {
        return (
            <div className="EezStudio_SideDockViewContainer">
                <div className="EezStudio_AxisRulersProperties">
                    <div className="EezStudio_SideDockView_PropertyLabel">
                        <Checkbox
                            checked={this.rulersModel.xAxisRulersEnabled}
                            onChange={this.enableXAxisRulers}
                        >
                            Enable X axis rulers
                        </Checkbox>
                    </div>
                    {this.rulersModel.xAxisRulersEnabled && (
                        <div className="EezStudio_SideDockView_Property">
                            <table>
                                <tbody>
                                    <tr>
                                        <td>X1</td>
                                        <td>
                                            <input
                                                type="text"
                                                className={classNames(
                                                    "form-control",
                                                    {
                                                        error: this.x1Error
                                                    }
                                                )}
                                                value={this.x1}
                                                onChange={this.setX1}
                                            />
                                        </td>
                                        <td>X2</td>
                                        <td>
                                            <input
                                                type="text"
                                                className={classNames(
                                                    "form-control",
                                                    {
                                                        error: this.x2Error
                                                    }
                                                )}
                                                value={this.x2}
                                                onChange={this.setX2}
                                            />
                                        </td>
                                        <td>&Delta;X</td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={this.props.chartsController.xAxisController.unit.formatValue(
                                                    this.rulersModel.x2 -
                                                        this.rulersModel.x1,
                                                    10
                                                )}
                                                readOnly={true}
                                            />
                                        </td>
                                        <td />
                                        <td style={{ textAlign: "left" }}>
                                            <IconAction
                                                icon="material:search"
                                                onClick={this.zoomToFitXRulers}
                                                title="Zoom chart to fit both x1 and x2"
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {_range(
                    this.props.chartsController.chartControllers.length
                ).map(chartIndex => (
                    <div
                        key={chartIndex}
                        className="EezStudio_AxisRulersProperties"
                    >
                        <div className="EezStudio_SideDockView_PropertyLabel">
                            <Checkbox
                                checked={
                                    chartIndex <
                                        this.rulersModel.yAxisRulersEnabled
                                            .length &&
                                    this.rulersModel.yAxisRulersEnabled[
                                        chartIndex
                                    ]
                                }
                                onChange={(checked: boolean) =>
                                    this.enableYAxisRulers(chartIndex, checked)
                                }
                            >
                                Enable{" "}
                                {this.props.chartsController.chartControllers
                                    .length > 1
                                    ? `"${this.props.chartsController.chartControllers[chartIndex].yAxisController.axisModel.label}" `
                                    : ""}
                                Y axis rulers
                            </Checkbox>
                        </div>
                        {chartIndex <
                            this.rulersModel.yAxisRulersEnabled.length &&
                            this.rulersModel.yAxisRulersEnabled[chartIndex] && (
                                <div className="EezStudio_SideDockView_Property">
                                    <table>
                                        <tbody>
                                            <tr>
                                                <td>Y1</td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className={classNames(
                                                            "form-control",
                                                            {
                                                                error: this
                                                                    .y1Error[
                                                                    chartIndex
                                                                ]
                                                            }
                                                        )}
                                                        value={
                                                            this.y1[chartIndex]
                                                        }
                                                        onChange={event =>
                                                            this.setY1(
                                                                chartIndex,
                                                                event
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>Y2</td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className={classNames(
                                                            "form-control",
                                                            {
                                                                error: this
                                                                    .y2Error[
                                                                    chartIndex
                                                                ]
                                                            }
                                                        )}
                                                        value={
                                                            this.y2[chartIndex]
                                                        }
                                                        onChange={event =>
                                                            this.setY2(
                                                                chartIndex,
                                                                event
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>&Delta;Y</td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={this.props.chartsController.chartControllers[
                                                            chartIndex
                                                        ].yAxisController.unit.formatValue(
                                                            this.rulersModel.y2[
                                                                chartIndex
                                                            ] -
                                                                this.rulersModel
                                                                    .y1[
                                                                    chartIndex
                                                                ],
                                                            4
                                                        )}
                                                        readOnly={true}
                                                    />
                                                </td>
                                                <td />
                                                <td
                                                    style={{
                                                        textAlign: "left"
                                                    }}
                                                >
                                                    <IconAction
                                                        icon="material:search"
                                                        onClick={() =>
                                                            this.zoomToFitYRulers(
                                                                chartIndex
                                                            )
                                                        }
                                                        title="Zoom chart to fit both y1 and y2"
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </div>
                ))}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface DynamicSubdivisionOptionsProps {
    chartsController: ChartsController;
}

@observer
class DynamicSubdivisionOptions extends React.Component<DynamicSubdivisionOptionsProps> {
    @observable xAxisSteps: string = "";
    @observable xAxisStepsError: boolean = false;
    @observable yAxisSteps: string[] = [];
    @observable yAxisStepsError: boolean[] = [];

    constructor(props: DynamicSubdivisionOptionsProps) {
        super(props);

        this.loadProps(this.props);
    }

    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.loadProps(this.props);
        }
    }

    @action
    loadProps(props: DynamicSubdivisionOptionsProps) {
        const chartsController = props.chartsController;
        const viewOptions = chartsController.viewOptions;

        const xSteps =
            viewOptions.axesLines.steps && viewOptions.axesLines.steps.x;
        this.xAxisSteps = xSteps
            ? xSteps
                  .map(step =>
                      chartsController.xAxisController.unit.formatValue(step)
                  )
                  .join(", ")
            : "";

        this.yAxisSteps = chartsController.chartControllers.map(
            (chartController: ChartController, i: number) => {
                const ySteps =
                    viewOptions.axesLines.steps &&
                    i < viewOptions.axesLines.steps.y.length &&
                    viewOptions.axesLines.steps.y[i];
                return ySteps
                    ? ySteps
                          .map(step =>
                              chartsController.chartControllers[
                                  i
                              ].yAxisController.unit.formatValue(step)
                          )
                          .join(", ")
                    : "";
            }
        );
        this.yAxisStepsError = this.yAxisSteps.map(x => false);
    }

    render() {
        const chartsController = this.props.chartsController;
        const viewOptions = chartsController.viewOptions;

        const yAxisSteps = chartsController.chartControllers
            .filter(
                chartController => !chartController.yAxisController.isDigital
            )
            .map((chartController: ChartController, i: number) => {
                const yAxisController = chartController.yAxisController;

                return (
                    <tr key={i}>
                        <td>{yAxisController.axisModel.label}</td>
                        <td>
                            <input
                                type="text"
                                className={classNames("form-control", {
                                    error: this.yAxisStepsError[i]
                                })}
                                value={this.yAxisSteps[i]}
                                onChange={action(
                                    (
                                        event: React.ChangeEvent<HTMLInputElement>
                                    ) => {
                                        this.yAxisSteps[i] = event.target.value;

                                        const steps = event.target.value
                                            .split(",")
                                            .map(value =>
                                                yAxisController.unit.parseValue(
                                                    value
                                                )
                                            );

                                        if (
                                            steps.length === 0 ||
                                            !steps.every(
                                                step =>
                                                    step != null &&
                                                    step >=
                                                        yAxisController.unit
                                                            .units[0]
                                            )
                                        ) {
                                            this.yAxisStepsError[i] = true;
                                        } else {
                                            this.yAxisStepsError[i] = false;
                                            steps.sort();
                                            viewOptions.setAxesLinesStepsY(
                                                i,
                                                steps as number[]
                                            );
                                        }
                                    }
                                )}
                            />
                        </td>
                    </tr>
                );
            });

        return (
            <div className="EezStudio_ChartViewOptions_DynamicAxisLines_Properties">
                <table>
                    <tbody>
                        <tr>
                            <td />
                            <td>Steps</td>
                        </tr>
                        <tr>
                            <td>Time</td>
                            <td>
                                <input
                                    type="text"
                                    className={classNames("form-control", {
                                        error: this.xAxisStepsError
                                    })}
                                    value={this.xAxisSteps}
                                    onChange={action(
                                        (
                                            event: React.ChangeEvent<HTMLInputElement>
                                        ) => {
                                            this.xAxisSteps =
                                                event.target.value;

                                            const steps = event.target.value
                                                .split(",")
                                                .map(value =>
                                                    chartsController.xAxisController.unit.parseValue(
                                                        value
                                                    )
                                                )
                                                .sort();

                                            if (
                                                steps.length === 0 ||
                                                !steps.every(
                                                    step =>
                                                        step != null &&
                                                        step >=
                                                            chartsController
                                                                .xAxisController
                                                                .unit.units[0]
                                                )
                                            ) {
                                                this.xAxisStepsError = true;
                                            } else {
                                                this.xAxisStepsError = false;
                                                steps.sort();
                                                viewOptions.setAxesLinesStepsX(
                                                    steps as number[]
                                                );
                                            }
                                        }
                                    )}
                                />
                            </td>
                        </tr>
                        {yAxisSteps}
                    </tbody>
                </table>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface FixedSubdivisionOptionsProps {
    chartsController: ChartsController;
}

@observer
class FixedSubdivisionOptions extends React.Component<FixedSubdivisionOptionsProps> {
    @observable majorSubdivisionHorizontal: number = 0;
    @observable majorSubdivisionVertical: number = 0;
    @observable minorSubdivisionHorizontal: number = 0;
    @observable minorSubdivisionVertical: number = 0;
    @observable majorSubdivisionHorizontalError: boolean = false;

    constructor(props: FixedSubdivisionOptionsProps) {
        super(props);

        this.loadProps(this.props);
    }

    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.loadProps(this.props);
        }
    }

    @action
    loadProps(props: FixedSubdivisionOptionsProps) {
        const axesLines = props.chartsController.viewOptions.axesLines;

        this.majorSubdivisionHorizontal = axesLines.majorSubdivision.horizontal;
        this.majorSubdivisionVertical = axesLines.majorSubdivision.vertical;
        this.minorSubdivisionHorizontal = axesLines.minorSubdivision.horizontal;
        this.minorSubdivisionVertical = axesLines.minorSubdivision.vertical;
    }

    render() {
        const viewOptions = this.props.chartsController.viewOptions;

        return (
            <div className="EezStudio_ChartViewOptions_FixedAxisLines_Properties">
                <table>
                    <tbody>
                        <tr>
                            <td />
                            <td>X axis</td>
                            <td />
                            <td>Y axis</td>
                        </tr>
                        <tr>
                            <td>Major</td>
                            <td>
                                <input
                                    type="number"
                                    min={2}
                                    max={100}
                                    className={classNames("form-control", {
                                        error: this
                                            .majorSubdivisionHorizontalError
                                    })}
                                    value={this.majorSubdivisionHorizontal}
                                    onChange={action((event: any) => {
                                        this.majorSubdivisionHorizontal =
                                            event.target.value;

                                        const value = parseInt(
                                            event.target.value
                                        );

                                        if (
                                            isNaN(value) ||
                                            value < 2 ||
                                            value > 100
                                        ) {
                                            this.majorSubdivisionHorizontalError =
                                                true;
                                        } else {
                                            this.majorSubdivisionHorizontalError =
                                                false;
                                            viewOptions.setAxesLinesMajorSubdivisionHorizontal(
                                                value
                                            );
                                        }
                                    })}
                                />
                            </td>
                            <td>by</td>
                            <td>
                                <input
                                    type="number"
                                    min={2}
                                    max={100}
                                    className="form-control"
                                    value={this.majorSubdivisionVertical}
                                    onChange={action((event: any) => {
                                        this.majorSubdivisionVertical =
                                            event.target.value;

                                        const value = parseInt(
                                            event.target.value
                                        );

                                        if (
                                            isNaN(value) ||
                                            value < 2 ||
                                            value > 100
                                        ) {
                                        } else {
                                            viewOptions.setAxesLinesMajorSubdivisionVertical(
                                                value
                                            );
                                        }
                                    })}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>Minor</td>
                            <td>
                                <input
                                    type="number"
                                    min={2}
                                    max={10}
                                    className="form-control"
                                    value={this.minorSubdivisionHorizontal}
                                    onChange={action((event: any) => {
                                        this.minorSubdivisionHorizontal =
                                            event.target.value;

                                        const value = parseInt(
                                            event.target.value
                                        );

                                        if (
                                            isNaN(value) ||
                                            value < 2 ||
                                            value > 10
                                        ) {
                                        } else {
                                            viewOptions.setAxesLinesMinorSubdivisionHorizontal(
                                                value
                                            );
                                        }
                                    })}
                                />
                            </td>
                            <td>by</td>
                            <td>
                                <input
                                    type="number"
                                    min={2}
                                    max={10}
                                    className="form-control"
                                    value={this.minorSubdivisionVertical}
                                    onChange={action((event: any) => {
                                        this.minorSubdivisionVertical =
                                            event.target.value;

                                        const value = parseInt(
                                            event.target.value
                                        );

                                        if (
                                            isNaN(value) ||
                                            value < 2 ||
                                            value > 10
                                        ) {
                                        } else {
                                            viewOptions.setAxesLinesMinorSubdivisionVertical(
                                                value
                                            );
                                        }
                                    })}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ChartViewOptionsProps {
    showRenderAlgorithm: boolean;
    showShowSampledDataOption: boolean;
}

@observer
class ChartViewOptions extends React.Component<
    ChartViewOptionsProps & {
        chartsController: ChartsController;
    }
> {
    render() {
        const chartsController = this.props.chartsController;
        const viewOptions = chartsController.viewOptions;

        return (
            <div className="EezStudio_ChartViewOptionsContainer">
                <div>
                    <div className="EezStudio_SideDockView_PropertyLabel">
                        Axes lines subdivision:
                    </div>
                    <div className="EezStudio_SideDockView_Property">
                        <Radio
                            checked={viewOptions.axesLines.type === "dynamic"}
                            onChange={action(() =>
                                viewOptions.setAxesLinesType("dynamic")
                            )}
                        >
                            Dynamic
                        </Radio>
                        {viewOptions.axesLines.type === "dynamic" && (
                            <DynamicSubdivisionOptions
                                chartsController={chartsController}
                            />
                        )}
                        <Radio
                            checked={viewOptions.axesLines.type === "fixed"}
                            onChange={action(() =>
                                viewOptions.setAxesLinesType("fixed")
                            )}
                        >
                            Fixed
                        </Radio>
                        {viewOptions.axesLines.type === "fixed" && (
                            <FixedSubdivisionOptions
                                chartsController={chartsController}
                            />
                        )}
                    </div>
                    <div className="EezStudio_SideDockView_PropertyLabel">
                        <Checkbox
                            checked={viewOptions.axesLines.snapToGrid}
                            onChange={action((checked: boolean) => {
                                viewOptions.setAxesLinesSnapToGrid(checked);
                            })}
                        >
                            Snap to grid
                        </Checkbox>
                    </div>
                </div>
                {this.props.showRenderAlgorithm && (
                    <div>
                        <div className="EezStudio_SideDockView_PropertyLabel">
                            Rendering algorithm:
                        </div>
                        <div className="EezStudio_SideDockView_Property">
                            <select
                                className="form-control"
                                title="Chart rendering algorithm"
                                value={globalViewOptions.renderAlgorithm}
                                onChange={action(
                                    (
                                        event: React.ChangeEvent<HTMLSelectElement>
                                    ) =>
                                        (globalViewOptions.renderAlgorithm =
                                            event.target
                                                .value as WaveformRenderAlgorithm)
                                )}
                            >
                                <option value="avg">Average</option>
                                <option value="minmax">Min-max</option>
                                <option value="gradually">Gradually</option>
                            </select>
                        </div>
                    </div>
                )}
                <div>
                    <div>
                        <Checkbox
                            checked={viewOptions.showAxisLabels}
                            onChange={action((checked: boolean) => {
                                viewOptions.setShowAxisLabels(checked);
                            })}
                        >
                            Show axis labels
                        </Checkbox>
                    </div>
                    <div>
                        <Checkbox
                            checked={viewOptions.showZoomButtons}
                            onChange={action((checked: boolean) => {
                                viewOptions.setShowZoomButtons(checked);
                            })}
                        >
                            Show zoom in/out buttons
                        </Checkbox>
                    </div>
                    <div className="EezStudio_GlobalOptionsContainer">
                        Global options:
                    </div>
                    <div>
                        <Checkbox
                            checked={globalViewOptions.enableZoomAnimations}
                            onChange={action((checked: boolean) => {
                                globalViewOptions.enableZoomAnimations =
                                    checked;
                            })}
                        >
                            Enable zoom in/out animations
                        </Checkbox>
                    </div>
                    <div>
                        <Checkbox
                            checked={globalViewOptions.blackBackground}
                            onChange={action((checked: boolean) => {
                                globalViewOptions.blackBackground = checked;
                            })}
                        >
                            Black background
                        </Checkbox>
                    </div>
                    {this.props.showShowSampledDataOption && (
                        <div>
                            <Checkbox
                                checked={globalViewOptions.showSampledData}
                                onChange={action(
                                    (checked: boolean) =>
                                        (globalViewOptions.showSampledData =
                                            checked)
                                )}
                            >
                                Show sampled data
                            </Checkbox>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IWaveformLineController extends ILineController {
    waveform: IWaveform;
}

interface WaveformLineViewProperties {
    waveformLineController: IWaveformLineController;
    label?: string;
}

@observer
export class WaveformLineView extends React.Component<WaveformLineViewProperties> {
    @observable waveformLineController = this.props.waveformLineController;

    nextJob: IWaveformRenderJobSpecification | undefined;
    canvas: HTMLCanvasElement | undefined;
    @observable chartImage: string | undefined;
    continuation: any;
    requestAnimationFrameId: any;

    @computed
    get waveformRenderJobSpecification():
        | IWaveformRenderJobSpecification
        | undefined {
        const yAxisController = this.waveformLineController.yAxisController;
        const chartsController = yAxisController.chartsController;
        const xAxisController = chartsController.xAxisController;
        const waveform = this.waveformLineController.waveform;

        if (chartsController.chartWidth < 1 || !waveform.length) {
            return undefined;
        }

        return {
            renderAlgorithm: globalViewOptions.renderAlgorithm,
            waveform,
            xAxisController,
            yAxisController,
            xFromValue: xAxisController.from,
            xToValue: xAxisController.to,
            yFromValue: yAxisController.from,
            yToValue: yAxisController.to,
            strokeColor: globalViewOptions.blackBackground
                ? yAxisController.axisModel.color
                : yAxisController.axisModel.colorInverse,
            label:
                yAxisController.chartController!.lineControllers.length > 1 &&
                chartsController.mode !== "preview"
                    ? this.props.label
                    : undefined
        };
    }

    @action
    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.waveformLineController = this.props.waveformLineController;
        }
        this.draw();
    }

    componentDidMount() {
        this.draw();
    }

    @action.bound
    drawStep() {
        if (!this.canvas) {
            const chartsController =
                this.props.waveformLineController.yAxisController
                    .chartsController;
            this.canvas = document.createElement("canvas");
            this.canvas.width = Math.floor(chartsController.chartWidth);
            this.canvas.height = Math.floor(chartsController.chartHeight);
        }

        this.continuation = renderWaveformPath(
            this.canvas,
            this.nextJob!,
            this.continuation
        );
        if (this.continuation) {
            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.drawStep
            );
        } else {
            this.requestAnimationFrameId = undefined;
            this.chartImage = this.canvas.toDataURL();
            this.canvas = undefined;
        }
    }

    draw() {
        if (this.nextJob != this.waveformRenderJobSpecification) {
            if (this.requestAnimationFrameId) {
                window.cancelAnimationFrame(this.requestAnimationFrameId);
                this.requestAnimationFrameId = undefined;
            }

            this.nextJob = this.waveformRenderJobSpecification;
            this.continuation = undefined;
            this.drawStep();
        }
    }

    componentWillUnmount() {
        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }
    }

    render() {
        if (!this.waveformRenderJobSpecification) {
            return null;
        }
        const chartsController =
            this.props.waveformLineController.yAxisController.chartsController;

        return (
            <image
                x={Math.floor(chartsController.chartLeft)}
                y={Math.floor(chartsController.chartTop)}
                width={Math.floor(chartsController.chartWidth)}
                height={Math.floor(chartsController.chartHeight)}
                href={this.chartImage}
            />
        );
    }
}
