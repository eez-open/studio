import { dialog, getCurrentWindow } from "@electron/remote";
import { clipboard, SaveDialogOptions } from "electron";
import bootstrap from "bootstrap";
import React from "react";
import { createRoot } from "react-dom/client";
import {
    action,
    computed,
    observable,
    reaction,
    runInAction,
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { cssTransition } from "react-toastify";
import * as FlexLayout from "flexlayout-react";

import { getLocale } from "eez-studio-shared/i10n";
import { extensions } from "eez-studio-shared/extensions/extensions";
import { IUnit, UNITS, UNKNOWN_UNIT } from "eez-studio-shared/units";
import { Point, pointDistance } from "eez-studio-shared/geometry";
import { guid } from "eez-studio-shared/guid";
import { capitalize, stringCompare } from "eez-studio-shared/string";
import { writeBinaryData } from "eez-studio-shared/util-electron";
import { scrollIntoViewIfNeeded } from "eez-studio-shared/dom";
import {
    _difference,
    _map,
    _range,
    _uniqWith
} from "eez-studio-shared/algorithm";

import { SvgLabel } from "eez-studio-ui/svg-label";
import * as notification from "eez-studio-ui/notification";
import { Draggable } from "eez-studio-ui/draggable";
import {
    LayoutModels,
    layoutModels,
    SideDock2,
    SideDockComponent2
} from "eez-studio-ui/side-dock";
import { Splitter } from "eez-studio-ui/splitter";
import {
    FieldComponent,
    GenericDialog,
    IFieldProperties
} from "eez-studio-ui/generic-dialog";
import { IconAction } from "eez-studio-ui/action";

import type {
    IChart,
    IMeasurementFunction,
    IMeasurementFunctionResultType
} from "eez-studio-shared/extensions/extension";
import { Measurement } from "eez-studio-ui/chart/Measurement";
import { clamp } from "eez-studio-ui/chart/clamp";
import { WaveformFormat } from "eez-studio-ui/chart/WaveformFormat";
import type { IWaveformDlogParams } from "eez-studio-ui/chart/IWaveformDlogParams";
import { WaveformLineView } from "eez-studio-ui/chart/WaveformLineView";
import {
    ChartViewOptionsProps,
    ChartViewOptions
} from "eez-studio-ui/chart/ChartViewOptions";
import { globalViewOptions } from "eez-studio-ui/chart/GlobalViewOptions";
import {
    IRulersController,
    IRulersModel,
    RulersController,
    RulersDockView
} from "eez-studio-ui/chart/rulers";

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

    xAxisController: IAxisController;
    xMin: number;
    xMax: number;

    yAxisController: IAxisController;
    yMin: number;
    yMax: number;

    label: string;

    getWaveformModel(): WaveformModel | null;

    getNearestValuePoint(point: Point): Point;

    updateCursor(cursor: ICursor, point: Point, event: PointerEvent): void;
    addPoint(chartView: IChartView, cursor: ICursor): MouseHandler | undefined;
    onDragStart(
        chartView: IChartView,
        event: PointerEvent
    ): MouseHandler | undefined;
    render(clipId: string): JSX.Element;
    // find closest point on line to the given point
    closestPoint(point: Point): Point | undefined;
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

interface IAnimationController {
    frameAnimation(): void;
}

export interface IAxisController {
    position: "x" | "y" | "yRight";
    from: number;
    to: number;
    range: number;
    scale: number;
    distance: number;
    distancePx: number;
    unit: IUnit;
    ticks: ITick[];
    logarithmic?: boolean;
    chartsController: IChartsController;
    axisModel: IAxisModel;
    chartController: IChartController | undefined;
    isAnimationActive: boolean;
    isDigital: boolean;
    labelTextsWidth: number;
    labelTextsHeight: number;
    zoomInEnabled: boolean;
    zoomOutEnabled: boolean;
    minValue: number;
    maxValue: number;
    isScrollBarEnabled: boolean;
    animationController: IAnimationController;
    numSamples: number;
    valueToPx(value: number): number;
    pxToValue(value: number): number;
    linearValueToPx(value: number): number;
    zoom(from: number, to: number): void;
    zoomDefault(): void;
    zoomAll(): void;
    zoomAroundPivotPoint(pivotPx: number, zoomIn: boolean): void;
    zoomIn(): void;
    zoomOut(): void;
    panByDirection(direction: number): void;
    panByDistanceInPx(distanceInPx: number): void;
    panTo(to: number): void;
    pxToLinearValue(px: number): number;
    pageUp(): void;
    pageDown(): void;
    home(): void;
    end(): void;
}

export interface IChartController {
    id: string;
    xAxisController: IAxisController;
    yAxisController: IAxisController;
    yAxisControllerOnRightSide?: IAxisController;
    chartsController: IChartsController;
    lineControllers: ILineController[];
    minValue: { x: number; y: number; yRight: number };
    maxValue: { x: number; y: number; yRight: number };
    chartView: IChartView | undefined;
    chartViews: IChartView[];
    axes: IAxisController[];
    chartIndex: number;
    zoomAll(): void;
    zoomDefault(): void;
    onDragStart(
        chartView: IChartView,
        event: PointerEvent
    ): MouseHandler | undefined;
    customRender(): JSX.Element | null;
}

export interface IChartView {
    svg: SVGSVGElement | null;
    props: IChartViewProps;
    clipId: string;
    transformEventPoint(event: { clientX: number; clientY: number }): Point;
}

export interface IChartsController {
    mode: ChartMode;

    xAxisController: IAxisController;
    xAxisModel: IAxisModel;

    lineControllers: ILineController[];
    chartControllers: IChartController[];

    chartLeft: number;
    chartTop: number;
    chartRight: number;
    chartBottom: number;
    chartWidth: number;
    chartHeight: number;

    xAxisHeight: number;
    minLeftMargin: number;
    minRightMargin: number;

    viewOptions: IViewOptions;

    areZoomButtonsVisible: boolean;

    minValue: number;
    maxValue: number;

    selectBookmark(index: number): void;
    selectedBookmark: number;
    bookmarks: IChartBookmark[] | undefined;

    chartViewWidth: number | undefined;
    chartViewHeight: number | undefined;

    rulersController: IRulersController;
    measurementsController: IMeasurementsController | undefined;

    supportRulers: boolean;

    isZoomAllEnabled: boolean;
    zoomAll(): void;

    zoomDefault(): void;

    chartViewOptionsProps: {
        showRenderAlgorithm: boolean;
        showShowSampledDataOption: boolean;
    };

    destroy(): void;
}

export interface IMeasurementsController {
    isThereAnyMeasurementChart: boolean;
    chartsController: IChartsController;
    measurementsModel: IMeasurementsModel;
    measurements: IMeasurement[];
    measurementsInterval: { x1: number; x2: number } | undefined;
    refreshRequired: boolean;
    findMeasurementById(measurementId: string): IMeasurement | undefined;
    startMeasurement(measurementsInterval: {
        x1: number;
        x2: number;
        numSamples: number;
    }): void;
    calcMeasurementsInterval(): { x1: number; x2: number; numSamples: number };
    destroy(): void;
}

interface IChartBookmark {
    value: number;
    text: string;
}

////////////////////////////////////////////////////////////////////////////////

export type WaveformRenderAlgorithm = "avg" | "minmax" | "gradually";

export interface IWaveformRenderJobSpecification {
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

export interface IAverageContinuation extends IContinuation {
    offsets: number[];
    offset: number;
    commitAlways: boolean;
}

export interface IMinMaxContinuation extends IContinuation {
    offsets: number[];
    offset: number;
    commitAlways: boolean;
}

export interface IGraduallyContinuation extends IContinuation {
    a: number;
    b: number;
    K: number;
    offsets: number[];
    offset: number;
    commitAlways: boolean;
}

export interface ILogarithmicContinuation extends IContinuation {
    i: number;
    b: number;
    K: number;

    points: {
        x: number;
        y: number;
    }[];
}

////////////////////////////////////////////////////////////////////////////////

export abstract class LineController implements ILineController {
    private _yAxisController: IAxisController;

    constructor(public id: string, yAxisController: IAxisController) {
        makeObservable(this, {
            xMin: computed,
            xMax: computed
        });

        this._yAxisController = yAxisController;
    }

    get xAxisController() {
        return this.yAxisController.chartsController.xAxisController;
    }

    get xMin(): number {
        return this.xAxisController.axisModel.minValue;
    }

    get xMax(): number {
        return this.xAxisController.axisModel.maxValue;
    }

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

    addPoint(chartView: IChartView, cursor: ICursor): MouseHandler | undefined {
        return undefined;
    }

    onDragStart(
        chartView: IChartView,
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

export class ChartController implements IChartController {
    constructor(public chartsController: IChartsController, public id: string) {
        makeObservable(this, {
            axes: computed,
            minValue: computed,
            maxValue: computed,
            zoomAll: action,
            zoomDefault: action
        });
    }

    get xAxisController() {
        return this.chartsController.xAxisController;
    }

    get chartIndex(): number {
        return this.chartsController.chartControllers.indexOf(this);
    }

    yAxisController: IAxisController;

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

    yAxisControllerOnRightSide?: IAxisController;

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

    chartViews: IChartView[] = [];

    get chartView(): IChartView | undefined {
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

    get axes() {
        const axes = [this.xAxisController, this.yAxisController];
        if (this.yAxisControllerOnRightSide) {
            axes.push(this.yAxisControllerOnRightSide);
        }
        return axes;
    }

    onDragStart(
        chartView: IChartView,
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

    zoomAll() {
        this.yAxisController.zoomAll();

        if (this.yAxisControllerOnRightSide) {
            this.yAxisControllerOnRightSide.zoomAll();
        }
    }

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

const ChartBorder = observer(
    class ChartBorder extends React.Component<
        { chartsController: IChartsController },
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
);

////////////////////////////////////////////////////////////////////////////////

const AxisLines = observer(
    class AxisLines extends React.Component<
        { axisController: IAxisController },
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
);

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

const SvgButton = observer(
    class SvgButton extends React.Component<
        {
            icon: SvgIcon;
            x: number;
            y: number;
            width: number;
            height: number;
            padding: number;
            onClick: () => void;
            title: string;
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
            const sx = (width - 2 * padding) / viewBox.width / 1.5;
            const sy = (height - 2 * padding) / viewBox.height / 1.5;

            return (
                <g transform={`translate(${tx}, ${ty}) scale(${sx}, ${sy})`}>
                    <g className="EezStudio_SvgButtonGroup" onClick={onClick}>
                        <title>{this.props.title}</title>
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
);

////////////////////////////////////////////////////////////////////////////////

const AxisLabels = observer(
    class AxisLabels extends React.Component<
        { axisController: IAxisController },
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
                            chartsController.chartLeft -
                            CONF_LABEL_TICK_GAP_HORZ;
                        yText = chartsController.chartBottom - tick.px;
                        textAnchor = "end";
                        alignmentBaseline = "middle";
                    } else {
                        xText =
                            chartsController.chartRight +
                            CONF_LABEL_TICK_GAP_HORZ;
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
);

////////////////////////////////////////////////////////////////////////////////

const AxisScrollBar = observer(
    class AxisScrollBar extends React.Component<
        { axisController: IAxisController },
        {}
    > {
        div: HTMLDivElement | null = null;

        constructor(props: { axisController: IAxisController }) {
            super(props);

            makeObservable(this, {
                onScroll: action.bound
            });
        }

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

        onScroll() {
            if (this.div) {
                const { axisController } = this.props;

                if (axisController.position === "x") {
                    const newScrollPosition = this.div.scrollLeft;
                    const oldScrollPosition =
                        (axisController.from - this.from) *
                        axisController.scale;

                    if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                        axisController.panTo(
                            this.from + newScrollPosition / axisController.scale
                        );
                    }
                } else {
                    const newScrollPosition = this.div.scrollTop;
                    const oldScrollPosition =
                        this.div.scrollHeight -
                        (axisController.from - this.from) *
                            axisController.scale -
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
                        (axisController.from - this.from) *
                        axisController.scale;
                    const oldScrollPosition = this.div.scrollLeft;
                    if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                        this.div.scrollLeft = newScrollPosition;
                    }
                } else {
                    const newScrollPosition =
                        this.div.scrollHeight -
                        (axisController.from - this.from) *
                            axisController.scale -
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
);

////////////////////////////////////////////////////////////////////////////////

const AxisView = observer(
    class AxisView extends React.Component<
        {
            axisController: IAxisController;
        },
        {}
    > {
        render() {
            const { axisController } = this.props;
            const chartsController = axisController.chartsController;

            let x1;
            let y1;
            let x2;
            let y2;

            if (axisController.position === "x") {
                x1 =
                    (chartsController.chartLeft + chartsController.chartRight) /
                        2 -
                    ZOOM_ICON_SIZE;
                y1 =
                    chartsController.xAxisHeight -
                    SCROLL_BAR_SIZE -
                    ZOOM_ICON_SIZE / 1.5;
                x2 =
                    (chartsController.chartLeft + chartsController.chartRight) /
                    2;
                y2 = y1;
            } else if (axisController.position === "y") {
                x1 =
                    chartsController.chartLeft -
                    chartsController.minLeftMargin +
                    SCROLL_BAR_SIZE;
                y1 =
                    (chartsController.chartTop + chartsController.chartBottom) /
                        2 -
                    ZOOM_ICON_SIZE;
                x2 = x1;
                y2 =
                    (chartsController.chartTop + chartsController.chartBottom) /
                    2;
            } else {
                x1 =
                    chartsController.chartRight +
                    chartsController.minRightMargin -
                    ZOOM_ICON_SIZE -
                    SCROLL_BAR_SIZE;
                y1 =
                    (chartsController.chartTop + chartsController.chartBottom) /
                        2 -
                    ZOOM_ICON_SIZE;
                x2 = x1;
                y2 =
                    (chartsController.chartTop + chartsController.chartBottom) /
                    2;
            }

            return (
                <g className="eez-flow-editor-capture-pointers">
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
                        axisController.zoomInEnabled && (
                            <SvgButton
                                icon={SVG_ICON_ZOOM_IN}
                                x={Math.round(x1) + 0.5}
                                y={Math.round(y1) + 0.5}
                                width={ZOOM_ICON_SIZE}
                                height={ZOOM_ICON_SIZE}
                                padding={ZOOM_ICON_PADDING}
                                onClick={this.props.axisController.zoomIn}
                                title="Zoom In"
                            />
                        )}

                    {chartsController.areZoomButtonsVisible &&
                        !axisController.isDigital &&
                        axisController.zoomOutEnabled && (
                            <SvgButton
                                icon={SVG_ICON_ZOOM_OUT}
                                x={Math.round(x2) + 0.5}
                                y={Math.round(y2) + 0.5}
                                width={ZOOM_ICON_SIZE}
                                height={ZOOM_ICON_SIZE}
                                padding={ZOOM_ICON_PADDING}
                                onClick={this.props.axisController.zoomOut}
                                title="Zoom Out"
                            />
                        )}

                    {!axisController.isDigital && (
                        <AxisScrollBar axisController={axisController} />
                    )}
                </g>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Bookmark = observer(
    class Bookmark extends React.Component<
        {
            chartController: IChartController;
            index: number;
            x: number;
            y1: number;
            y2: number;
        },
        {}
    > {
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

        constructor(props: {
            chartController: IChartController;
            index: number;
            x: number;
            y1: number;
            y2: number;
        }) {
            super(props);

            makeObservable(this, {
                mouseOver: observable
            });
        }

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
);

const Bookmarks = observer(
    class Bookmarks extends React.Component<
        {
            chartController: IChartController;
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
);

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

class PanMouseHandler implements MouseHandler {
    constructor(private axes: IAxisController[]) {
        makeObservable(this, {
            move: action
        });
    }

    lastPoint: Point = { x: 0, y: 0 };

    cursor = "default";

    down(point: SVGPoint, event: PointerEvent) {
        this.lastPoint = point;
    }

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

    constructor(private chartController: IChartController) {
        makeObservable(this, {
            startPoint: observable,
            endPoint: observable,
            orientation: observable,
            down: action,
            move: action,
            xLabel: computed,
            yLabel: computed
        });
    }

    startPoint: Point = { x: 0, y: 0 };
    endPoint: Point = { x: 0, y: 0 };
    orientation: "x" | "y" | "both" | undefined = undefined;

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

    down(point: SVGPoint, event: PointerEvent) {
        this.startPoint = this.clamp(point);
    }

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
                        horizontalAlignment="center"
                        verticalAlignment="center"
                    ></SvgLabel>
                )}
                {!this.xLabel && this.yLabel && (
                    <SvgLabel
                        text={this.yLabel}
                        x={chartsController.chartLeft + x + width / 2}
                        y={chartsController.chartBottom - y + height / 2}
                        horizontalAlignment="center"
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
                            horizontalAlignment="center"
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
                            horizontalAlignment="center"
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

const CursorPopover = observer(
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
                          cursor.time +
                              xAxisController.axisModel.semiLogarithmic.a
                      ) + xAxisController.axisModel.semiLogarithmic.b
                    : cursor.time,
                4
            );
            const value =
                cursor.lineController.yAxisController.unit.formatValue(
                    yAxisController.axisModel.semiLogarithmic
                        ? Math.pow(
                              10,
                              cursor.value +
                                  yAxisController.axisModel.semiLogarithmic.a
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
);

class Cursor implements ICursor {
    visible: boolean = false;
    lineController: ILineController;
    time: number = 0;
    value: number = 0;
    valueIndex: number = 0;
    addPoint: boolean = false;
    error: string | undefined = undefined;
    cursorElement: SVGElement | null = null;
    cursorPopover: any = undefined;

    fillColor: string | undefined;
    strokeColor: string | undefined;

    constructor(private chartView: IChartView) {
        makeObservable(this, {
            visible: observable,
            lineController: observable,
            time: observable,
            value: observable,
            valueIndex: observable,
            addPoint: observable,
            error: observable,
            fillColor: observable,
            strokeColor: observable,
            onMouseEvent: action,
            hidePopover: action
        });
    }

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
            const root = createRoot(content);
            root.render(<CursorPopover cursor={this} />);
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

interface IChartViewProps {
    chartController: IChartController;
    mode: ChartMode;
}

export const ChartView = observer(
    class ChartView
        extends React.Component<IChartViewProps>
        implements IChartView
    {
        svg: SVGSVGElement | null = null;
        deltaY: number = 0;
        cursor = new Cursor(this);
        mouseHandler: MouseHandler | undefined;
        clipId = "c_" + guid();
        draggable = new Draggable(this);

        constructor(props: IChartViewProps) {
            super(props);

            makeObservable(this, {
                mouseHandler: observable,
                onWheel: action.bound,
                onDragStart: action.bound,
                onDragEnd: action.bound
            });
        }

        transformEventPoint(event: { clientX: number; clientY: number }) {
            let point = this.svg!.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            point = point.matrixTransform(this.svg!.getScreenCTM()!.inverse());
            point.x -= this.props.chartController.chartsController.chartLeft;
            point.y =
                this.props.chartController.chartsController.chartBottom -
                point.y;
            return point;
        }

        handleMouseWheelPanAndZoom(
            event: React.WheelEvent<SVGSVGElement>,
            pivotPx: number,
            axisController: IAxisController
        ) {
            this.deltaY += event.deltaY;
            if (Math.abs(this.deltaY) > 10) {
                if (event.ctrlKey) {
                    axisController.zoomAroundPivotPoint(
                        pivotPx,
                        this.deltaY < 0
                    );
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
                point.x >
                    this.props.chartController.chartsController.chartWidth &&
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
                        !this.props.chartController
                            .yAxisControllerOnRightSide ||
                        point.x <
                            this.props.chartController.chartsController
                                .chartWidth /
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
                            this.props.chartController
                                .yAxisControllerOnRightSide
                        );
                    }
                } else {
                    this.handleMouseWheelPanAndZoom(
                        event,
                        point.x,
                        this.props.chartController.chartsController
                            .xAxisController
                    );
                }
            }
        }

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
                if (
                    this.cursor &&
                    this.cursor.visible &&
                    this.cursor.addPoint
                ) {
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

                chartTitle = chartController.yAxisController.axisModel
                    .label && (
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
                        ? chartController.yAxisControllerOnRightSide.axisModel
                              .color
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
                        <g>{chartController.customRender()}</g>

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
                                (this.mouseHandler &&
                                    this.mouseHandler.cursor) ||
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
);

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

function getAxisController(chartsController: IChartsController) {
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

export abstract class AxisController implements IAxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: IChartsController,
        public chartController: IChartController | undefined,
        public axisModel: IAxisModel
    ) {
        makeObservable(this, {
            labelTextsWidth: observable,
            labelTextsHeight: observable,
            isAnimationActive: observable,
            isScrollBarEnabled: computed,
            minValue: computed,
            maxValue: computed,
            range: computed,
            distancePx: computed,
            distance: computed,
            scale: computed,
            minScale: computed,
            maxScale: computed,
            zoomInEnabled: computed,
            zoomOutEnabled: computed
        });
    }

    get unit() {
        return this.axisModel.unit;
    }

    labelTextsWidth: number = 0;
    labelTextsHeight: number = 0;

    isAnimationActive: boolean = false;
    animationController = new AnimationController();

    isDigital = false;

    get logarithmic() {
        return this.axisModel.logarithmic;
    }

    abstract get from(): number;
    abstract get to(): number;

    get isScrollBarEnabled() {
        return (
            (this.from > this.minValue || this.to < this.maxValue) &&
            this.range != 0
        );
    }

    get _minValue(): number {
        return this.position === "x"
            ? this.chartsController.minValue
            : this.chartController!.minValue[this.position];
    }

    get minValue() {
        return this._minValue;
    }

    get _maxValue(): number {
        return this.position === "x"
            ? this.chartsController.maxValue
            : this.chartController!.maxValue[this.position];
    }

    get maxValue() {
        return this._maxValue;
    }

    get range() {
        return this.maxValue - this.minValue;
    }

    get distancePx() {
        return this.position === "x"
            ? this.chartsController.chartWidth
            : this.chartsController.chartHeight;
    }

    get distance() {
        return this.to - this.from || 1;
    }

    get scale() {
        return this.distancePx / this.distance;
    }

    get minScale() {
        return 1e-15;
    }

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

    get zoomInEnabled() {
        return this.scale < this.maxScale;
    }

    abstract zoomIn(): void;

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

export abstract class ChartsController implements IChartsController {
    constructor(
        public mode: ChartMode,
        public xAxisModel: IAxisModel,
        public viewOptions: IViewOptions
    ) {
        makeObservable(this, {
            xAxisController: computed,
            yAxisOnRightSideExists: computed,
            chartViewWidth: observable,
            chartViewHeight: observable,
            xAxisLabelTextsHeight: computed,
            yAxisLabelTextsWidth: computed,
            xAxisHeight: computed,
            minLeftMargin: computed,
            minRightMargin: computed,
            minTopMargin: computed,
            minBottomMargin: computed,
            maxChartWidth: computed,
            maxChartHeight: computed,
            chartWidth: computed,
            chartHeight: computed,
            leftMargin: computed,
            rightMargin: computed,
            topMargin: computed,
            bottomMargin: computed,
            chartLeft: computed,
            chartTop: computed,
            chartRight: computed,
            chartBottom: computed,
            minValue: computed,
            maxValue: computed,
            isZoomAllEnabled: computed,
            zoomAll: action.bound,
            zoomDefault: action.bound,
            lineControllers: computed,
            selectedBookmark: observable,
            selectBookmark: action
        });
    }

    chartControllers: IChartController[] = [];

    get xAxisController(): IAxisController {
        return getAxisController(this);
    }

    get yAxisOnRightSideExists() {
        return this.chartControllers.find(
            chartController => !!chartController.yAxisControllerOnRightSide
        );
    }

    chartViewWidth: number | undefined;
    chartViewHeight: number | undefined;

    get xAxisLabelTextsHeight() {
        return Math.max(
            CONF_MIN_X_AXIS_BAND_HEIGHT,
            this.xAxisController.labelTextsHeight
        );
    }

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

    get minTopMargin() {
        return CONF_LABEL_TICK_GAP_VERT;
    }

    get minBottomMargin() {
        return CONF_LABEL_TICK_GAP_VERT;
    }

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

    get leftMargin() {
        if (this.chartWidth === this.maxChartWidth) {
            return this.minLeftMargin;
        }
        return (
            this.minLeftMargin +
            Math.round((this.maxChartWidth - this.chartWidth) / 2)
        );
    }

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

    get topMargin() {
        if (this.chartHeight === this.maxChartHeight) {
            return this.minTopMargin;
        }
        return (
            this.minTopMargin +
            Math.round((this.maxChartHeight - this.chartHeight) / 2)
        );
    }

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

    get chartLeft() {
        return this.leftMargin + 0.5;
    }

    get chartTop() {
        return this.topMargin + 0.5;
    }

    get chartRight() {
        return this.chartLeft + this.chartWidth;
    }

    get chartBottom() {
        return this.chartTop + this.chartHeight;
    }

    get minValue(): number {
        return this.chartControllers.length > 0
            ? Math.min(
                  ...this.chartControllers.map(
                      chartController => chartController.minValue.x
                  )
              )
            : 0;
    }

    get maxValue(): number {
        return this.chartControllers.length > 0
            ? Math.max(
                  ...this.chartControllers.map(
                      chartController => chartController.maxValue.x
                  )
              )
            : 1;
    }

    get isZoomAllEnabled() {
        return (
            this.xAxisController.from != this.minValue ||
            this.xAxisController.to != this.maxValue ||
            !!this.chartControllers.find(chartController => {
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

    zoomAll() {
        this.xAxisController.zoomAll();
        this.chartControllers.forEach(chartController =>
            chartController.zoomAll()
        );
    }

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

    get bookmarks(): IChartBookmark[] | undefined {
        return undefined;
    }

    get lineControllers() {
        const lineControllers: ILineController[] = [];

        this.chartControllers.forEach(chartController => {
            chartController.lineControllers.forEach(lineController =>
                lineControllers.push(lineController)
            );
        });

        return lineControllers;
    }

    rulersController: IRulersController;
    measurementsController: IMeasurementsController | undefined = undefined;

    createRulersController(rulersModel: IRulersModel) {
        if (this.supportRulers && this.mode !== "preview") {
            this.rulersController = new RulersController(this, rulersModel);
        }
    }

    createMeasurementsController(measurementsModel: IMeasurementsModel) {
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

    selectedBookmark = -1;

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
    console.log("showCalculating");
    if (!calculatingToastId) {
        calculatingToastId = notification.info("Calculating...", {
            transition: Fade,
            closeButton: false,
            position: "top-center"
        });
        console.log("showCalculating do it", calculatingToastId);
    }
}

function hideCalculating() {
    console.log("hideCalculating");
    if (calculatingToastId) {
        console.log("hideCalculating do it", calculatingToastId);
        notification.dismiss(calculatingToastId);
        calculatingToastId = undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class MeasurementsController {
    dispose1: any;
    dispose2: any;

    constructor(
        public chartsController: IChartsController,
        public measurementsModel: IMeasurementsModel
    ) {
        makeObservable(this, {
            measurements: observable,
            measurementsInterval: observable,
            refreshRequired: computed,
            chartMeasurements: computed,
            isThereAnyMeasurementChart: computed
        });

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

        // mark dirty all chart measurements when measurement interval changes
        this.dispose2 = reaction(
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

    measurements: IMeasurement[];
    measurementsInterval: { x1: number; x2: number } | undefined;

    get refreshRequired() {
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

        console.log(
            "startMeasurement",
            measurementsInterval.numSamples,
            CONF_MAX_NUM_SAMPLES_TO_SHOW_CALCULATING_MESSAGE
        );

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

                this.refreshResults();

                setTimeout(() => {
                    hideCalculating();
                }, 10);
            }, 150);
        } else {
            runInAction(
                () => (this.measurementsInterval = measurementsInterval)
            );
            this.refreshResults();
        }
    }

    get chartMeasurements() {
        return this.measurements.filter(measurement => {
            return (
                measurement.measurementFunction &&
                measurement.measurementFunction.resultType === "chart"
            );
        });
    }

    get isThereAnyMeasurementChart() {
        return this.chartMeasurements.length > 0;
    }

    findMeasurementById(measurementId: string) {
        return this.measurements.find(
            measurement => measurement.measurementId === measurementId
        );
    }

    refreshResults() {
        this.measurements.forEach(measurement => {
            console.log("meas", measurement);
            if (measurement.dirty) {
                console.log("refresh", measurement);
                measurement.refreshResult();
            }
        });
    }

    destroy() {
        this.dispose1();
        this.dispose2();
    }
}

////////////////////////////////////////////////////////////////////////////////

export const ChartsView = observer(
    class ChartsView extends React.Component<{
        children?: React.ReactNode;
        chartsController: IChartsController;
        className?: string;
        tabIndex?: number;
        sideDockAvailable?: boolean;
    }> {
        animationFrameRequestId: any = undefined;
        div: HTMLDivElement | null = null;
        sideDock: SideDockComponent2 | null = null;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                adjustSize: action,
                onKeyDown: action.bound
            });
        }

        get sideDockAvailable() {
            return this.props.sideDockAvailable !== undefined
                ? this.props.sideDockAvailable
                : this.props.chartsController.mode !== "preview";
        }

        adjustSize() {
            const chartsController = this.props.chartsController;
            const firstChartController = chartsController.chartControllers[0];
            const svg =
                firstChartController &&
                firstChartController.chartView &&
                firstChartController.chartView.svg;
            if (svg) {
                const chartViewWidth = svg.clientWidth;
                const chartViewHeight = svg.clientHeight;

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

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            const chartsController = this.props.chartsController;

            if (component === "Rulers") {
                return <RulersDockView chartsController={chartsController} />;
            } else if (component === "Measurements") {
                return (
                    <MeasurementsDockView
                        measurementsController={
                            chartsController.measurementsController!
                        }
                    />
                );
            } else if (component === "ViewOptions") {
                return (
                    <ChartViewOptions
                        chartsController={chartsController}
                        {...chartsController.chartViewOptionsProps}
                    />
                );
            } else if (component === "Bookmarks") {
                return <BookmarksView chartsController={chartsController} />;
            } else if (component === "Help") {
                return <HelpView />;
            }

            return null;
        };

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
                chartsController.measurementsController
                    .isThereAnyMeasurementChart
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
                            measurementsController={
                                chartsController.measurementsController
                            }
                        />
                    </Splitter>
                );
            }

            if (this.sideDockAvailable) {
                return (
                    <SideDock2
                        ref={ref => (this.sideDock = ref)}
                        persistId="shared/ui/chart/sideDock"
                        flexLayoutModel={layoutModels.getChartsViewModel(
                            this.props.chartsController.supportRulers,
                            this.props.chartsController.bookmarks != undefined
                        )}
                        factory={this.factory}
                        width={450}
                    >
                        {div}
                    </SideDock2>
                );
            } else {
                return div;
            }
        }
    }
);

export class ChartMeasurementsComponent extends React.Component<{
    measurementsController: IMeasurementsController;
}> {
    get measurementsModel() {
        return this.props.measurementsController.measurementsModel;
    }

    factory = (node: FlexLayout.TabNode) => {
        const measurementsController = this.props.measurementsController;

        var component = node.getComponent();
        if (component) {
            if (component.startsWith("MeasurementValue_")) {
                const measurementId = component.substring(
                    "MeasurementValue_".length
                );

                const measurement =
                    measurementsController.findMeasurementById(measurementId);

                if (measurement) {
                    return (
                        <MeasurementValue
                            measurement={measurement}
                            inDockablePanel={true}
                        />
                    );
                }
            }
        }

        return null;
    };

    get flexLayoutModel() {
        return FlexLayout.Model.fromJson({
            global: LayoutModels.GLOBAL_OPTIONS,
            borders: [],
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: this.props.measurementsController.measurements
                            .filter(measurement => {
                                return (
                                    measurement.measurementFunction &&
                                    measurement.measurementFunction
                                        .resultType === "chart"
                                );
                            })
                            .map(measurement => ({
                                type: "tab",
                                enableClose: false,
                                name: measurement?.chartPanelTitle || "",
                                id:
                                    "MeasurementValue_" +
                                    measurement.measurementId,
                                component:
                                    "MeasurementValue_" +
                                    measurement.measurementId
                            }))
                    }
                ]
            }
        });
    }

    render() {
        return (
            <>
                <FlexLayout.Layout
                    model={this.flexLayoutModel}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT}
                />
            </>
        );
    }
}

const ChartMeasurements = observer(ChartMeasurementsComponent);

////////////////////////////////////////////////////////////////////////////////

class DynamicAxisController extends AxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: IChartsController,
        public chartController: IChartController | undefined,
        public axisModel: IAxisModel
    ) {
        super(position, chartsController, chartController, axisModel);

        makeObservable(this, {
            animationFrom: observable,
            animationTo: observable,
            from: computed,
            to: computed,
            steps: computed,
            ticks: computed,
            animate: action
        });
    }

    animationFrom: number = 0;
    animationTo: number = 0;

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
        public chartsController: IChartsController,
        public chartController: IChartController | undefined,
        public axisModel: IAxisModel
    ) {
        super(position, chartsController, chartController, axisModel);

        makeObservable(this, {
            animationSubdivisionOffset: observable,
            animationSubdivisionScale: observable,
            subdivisionOffset: computed,
            subdivisionScale: computed,
            from: computed,
            to: computed,
            ticks: computed,
            animate: action
        });
    }

    animationController = new AnimationController();

    animationSubdivisionOffset: number = 0;
    animationSubdivisionScale: number = 0;

    get majorSubdivison() {
        return this.position === "x"
            ? this.chartsController.viewOptions.axesLines.majorSubdivision
                  .horizontal
            : this.chartsController.viewOptions.axesLines.majorSubdivision
                  .vertical;
    }

    get subdivisionOffset() {
        if (
            this.chartsController.mode === "preview" ||
            this.axisModel.fixed.zoomMode === "all"
        ) {
            return calcSubdivisionScaleAndOffset(
                this._minValue,
                this._maxValue,
                this.majorSubdivison
            ).offset;
        }

        if (this.axisModel.fixed.zoomMode === "default") {
            return this.axisModel.defaultSubdivisionOffset !== undefined
                ? this.axisModel.defaultSubdivisionOffset
                : calcSubdivisionScaleAndOffset(
                      this.axisModel.defaultFrom,
                      this.axisModel.defaultTo,
                      this.majorSubdivison
                  ).offset;
        }

        return this.axisModel.fixed.subdivisionOffset;
    }

    get subdivisionScale() {
        if (
            this.chartsController.mode === "preview" ||
            this.axisModel.fixed.zoomMode === "all"
        ) {
            return calcSubdivisionScaleAndOffset(
                this.minValue,
                this.maxValue,
                this.majorSubdivison
            ).scale;
        }

        if (this.axisModel.fixed.zoomMode === "default") {
            return this.axisModel.defaultSubdivisionScale !== undefined
                ? this.axisModel.defaultSubdivisionScale
                : calcSubdivisionScaleAndOffset(
                      this.axisModel.defaultFrom,
                      this.axisModel.defaultTo,
                      this.majorSubdivison
                  ).scale;
        }

        return this.axisModel.fixed.subdivisonScale;
    }

    get from() {
        if (this.isDigital) {
            return 0;
        }

        if (this.isAnimationActive) {
            return this.animationSubdivisionOffset;
        }

        return this.subdivisionOffset;
    }

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
    xAxisController: IAxisController,
    yAxisController: IAxisController,
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
    constructor(private data: GenericChartWaveform) {
        makeObservable(this, {
            unit: computed,
            dynamic: observable,
            fixed: observable
        });
    }

    get unit() {
        return this.data.xAxes.unit;
    }

    chartsController: IChartsController | undefined = undefined;

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

    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "all",
        from: 0,
        to: 0
    };

    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "all",
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
    constructor(private data: GenericChartWaveform) {
        makeObservable(this, {
            minValue: computed,
            maxValue: computed,
            defaultFrom: computed,
            defaultTo: computed,
            unit: computed,
            dynamic: observable,
            fixed: observable
        });
    }

    get minValue() {
        return this.data.yAxes.minValue;
    }

    get maxValue() {
        return this.data.yAxes.maxValue;
    }

    get defaultFrom() {
        return this.data.yAxes.minValue;
    }

    get defaultTo() {
        return this.data.yAxes.maxValue;
    }

    get unit() {
        return this.data.yAxes.unit;
    }

    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "all",
        from: 0,
        to: 0
    };

    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "all",
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
        makeObservable(this, {
            axesLines: observable,
            showAxisLabels: observable,
            showZoomButtons: observable
        });

        if (props) {
            Object.assign(this, props);
        }
    }

    axesLines: IViewOptionsAxesLines = {
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
        defaultZoomMode: "all"
    };

    showAxisLabels: boolean = true;
    showZoomButtons: boolean = true;

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
        if (!this.axesLines.steps) {
            this.axesLines.steps = {
                x: [],
                y: []
            };
        }
        this.axesLines.steps.x = steps;
    }

    setAxesLinesStepsY(index: number, steps: number[]): void {
        if (!this.axesLines.steps) {
            this.axesLines.steps = {
                x: [],
                y: []
            };
        }
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

const GenericChart = observer(
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

            const chartController = new ChartController(
                chartsController,
                "TODO"
            );

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
);

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
        yAxisController: IAxisController
    ) {
        super(id, yAxisController);

        makeObservable(this, {
            yMin: computed,
            yMax: computed
        });
    }

    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

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

export interface IMeasurement {
    measurementsController: IMeasurementsController;
    measurementDefinition: IMeasurementDefinition;
    measurementFunction: IMeasurementFunction | undefined;
    measurementId: string;
    namePrefix: string;
    name: string;
    arity: number;
    chartPanelTitle: string;
    script: string | undefined;
    result: {
        result: number | string | IChart | null;
        resultUnit?: keyof typeof UNITS | undefined;
    } | null;
    resultType: IMeasurementFunctionResultType;
    chartIndex: number;
    chartIndexes: number[];
    parametersDescription: IFieldProperties[] | undefined;
    parameters: any;
    dirty: boolean;
    refreshResult(): void;
}

////////////////////////////////////////////////////////////////////////////////

export interface IMeasurementDefinition {
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

export interface ISingleInputMeasurementTaskSpecification extends IInput {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;
}

export interface IMultiInputMeasurementTaskSpecification {
    xStartValue: number;
    xStartIndex: number;
    xNumSamples: number;

    inputs: IInput[];
}

////////////////////////////////////////////////////////////////////////////////

export interface IMeasurementsModel {
    measurements: IMeasurementDefinition[];
}

export class MeasurementsModel implements IMeasurementsModel {
    measurements: IMeasurementDefinition[] = [];

    constructor(props?: {
        measurements?: (string | IMeasurementDefinition)[];
    }) {
        makeObservable(this, {
            measurements: observable
        });

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
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const MeasurementInputField = observer(
    class MeasurementInputField extends FieldComponent {
        render() {
            const measurement = this.props.dialogContext as IMeasurement;
            const inputIndex = parseInt(
                this.props.fieldProperties.name.slice(INPUT_FILED_NAME.length)
            );
            return (
                <select
                    className="form-select"
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
);

////////////////////////////////////////////////////////////////////////////////

const INPUT_FILED_NAME = "___input___";
const RESULT_FILED_NAME = "___result___";

const MeasurementComponent = observer(
    class MeasurementComponent extends React.Component<{
        measurement: IMeasurement;
    }> {
        constructor(props: { measurement: IMeasurement }) {
            super(props);

            makeObservable(this, {
                onValueChange: action.bound,
                operationInProgress: observable
            });
        }

        get numCharts() {
            return this.props.measurement.measurementsController
                .chartsController.lineControllers.length;
        }

        get isResultVisible() {
            return this.props.measurement.resultType !== "chart";
        }

        get deleteAction() {
            const measurement = this.props.measurement;
            const measurements =
                measurement.measurementsController.measurementsModel
                    .measurements;
            const index = measurements.indexOf(
                measurement.measurementDefinition
            );
            return (
                <IconAction
                    icon="material:delete"
                    iconSize={16}
                    title="Remove measurement"
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

        operationInProgress = false;

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

                const result = await dialog.showSaveDialog(
                    getCurrentWindow(),
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
                        <td>
                            <div className="EezStudio_ActionsContainer">
                                <IconAction
                                    icon="material:content_copy"
                                    iconSize={16}
                                    title="Copy to clipboard"
                                    onClick={this.onCopy}
                                    enabled={
                                        !this.operationInProgress &&
                                        !!measurement.result?.result
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
                                        !!measurement.result?.result &&
                                        measurement.resultType == "chart"
                                    }
                                    style={{ marginRight: 12 }}
                                />
                                {this.deleteAction}
                            </div>
                        </td>
                    </tr>
                </React.Fragment>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const MeasurementsDockView = observer(
    class MeasurementsDockView extends React.Component<{
        measurementsController: IMeasurementsController;
    }> {
        constructor(props: {
            measurementsController: IMeasurementsController;
        }) {
            super(props);

            makeObservable(this, {
                availableMeasurements: computed
            });
        }

        get measurementsModel() {
            return this.props.measurementsController.measurementsModel;
        }

        get numCharts() {
            return this.props.measurementsController.chartsController
                .chartControllers.length;
        }

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
                                    this.props.measurementsController
                                        .measurements,
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
                                                            measurementId:
                                                                guid(),
                                                            measurementFunctionId
                                                        }
                                                    );
                                                })}
                                            >
                                                {
                                                    measurementFunctions
                                                        .get()
                                                        .get(
                                                            measurementFunctionId
                                                        )!.name
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
);

////////////////////////////////////////////////////////////////////////////////

const MeasurementValue = observer(
    class MeasurementValue extends React.Component<{
        measurement: IMeasurement;
        inDockablePanel?: boolean;
    }> {
        render() {
            if (!this.props.measurement.script) {
                return "?";
            }

            const measurementResult = this.props.measurement.result;

            if (measurementResult == null || measurementResult.result == null) {
                if (this.props.inDockablePanel) {
                    return this.props.measurement.dirty ? null : (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%"
                            }}
                        >
                            <div className="alert alert-danger">
                                Too many samples. Use the X-axis ruler to reduce
                                input samples.
                            </div>
                        </div>
                    );
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
);

const MeasurementResultField = observer(
    class MeasurementResultField extends FieldComponent {
        render() {
            const measurement = this.props.dialogContext;
            return <MeasurementValue measurement={measurement} />;
        }
    }
);

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

    rulers?: IRulersModel;
    measurements?: IMeasurementsModel;
}

const BookmarkView = observer(
    class BookmarkView extends React.Component<{
        chartsController: IChartsController;
        index: number;
        bookmark: IChartBookmark;
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
);

const BookmarksView = observer(
    class BookmarksView extends React.Component<{
        chartsController: IChartsController;
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
);
