import * as React from "react";
import { observable, computed, action, runInAction, autorun } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { _range } from "shared/algorithm";

import { IconAction } from "shared/ui/action";
import { Checkbox } from "shared/ui/properties";
import {
    ChartController,
    ChartsController,
    ChartView,
    getSnapToValue,
    globalViewOptions,
    MouseHandler,
    ICursor
} from "shared/ui/chart/chart";

import { WaveformModel } from "shared/ui/chart/waveform";

export class RulersModel {
    @observable
    xAxisRulersEnabled: boolean = false;
    @observable
    x1: number = 0;
    @observable
    x2: number = 0;

    @observable
    yAxisRulersEnabled: boolean[] = [];
    @observable
    y1: number[] = [];
    @observable
    y2: number[] = [];

    @observable
    pauseDbUpdate: boolean = false;

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
    xStart: number;
    x1: number;
    dx: number;

    constructor(
        private rulersController: RulersController,
        private whichRuller: "x1" | "x2" | "both" | "none"
    ) {}

    @action
    down(point: SVGPoint, event: PointerEvent) {
        this.rulersController.rulersModel.pauseDbUpdate = true;

        this.xStart = this.rulersController.chartController.xAxisController.pxToValue(point.x);

        if (this.whichRuller === "none") {
            let x = getSnapToValue(
                event,
                this.xStart,
                this.rulersController.chartController.xAxisController
            );
            x = this.rulersController.snapToSample(x);

            this.rulersController.rulersModel.x1 = x;
            this.rulersController.rulersModel.x2 = x;
        }

        this.x1 = this.rulersController.rulersModel.x1;
        this.dx = this.rulersController.rulersModel.x2 - this.rulersController.rulersModel.x1;
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let x = this.rulersController.chartController.xAxisController.pxToValue(point.x);
        if (this.whichRuller === "both") {
            x = getSnapToValue(
                event,
                this.x1 + x - this.xStart,
                this.rulersController.chartController.xAxisController
            );
            x = this.rulersController.snapToSample(x);

            if (x < this.rulersController.chartController.xAxisController.minValue) {
                x = this.rulersController.chartController.xAxisController.minValue;
            } else if (
                x + this.dx >
                this.rulersController.chartController.xAxisController.maxValue
            ) {
                x = this.rulersController.chartController.xAxisController.maxValue - this.dx;
            }

            this.rulersController.rulersModel.x1 = x;
            this.rulersController.rulersModel.x2 = x + this.dx;
        } else {
            x = getSnapToValue(event, x, this.rulersController.chartController.xAxisController);
            x = this.rulersController.snapToSample(x);

            if (x < this.rulersController.chartController.xAxisController.minValue) {
                x = this.rulersController.chartController.xAxisController.minValue;
            } else if (x > this.rulersController.chartController.xAxisController.maxValue) {
                x = this.rulersController.chartController.xAxisController.maxValue;
            }

            if (this.whichRuller === "x1") {
                this.rulersController.rulersModel.x1 = x;
            } else {
                this.rulersController.rulersModel.x2 = x;
            }
        }
    }

    up(point: SVGPoint | undefined, event: PointerEvent | undefined, cancel: boolean) {
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
    cursor = "ns-resize";
    yStart: number;
    y1: number;
    dy: number;

    constructor(
        private rulersController: RulersController,
        private chartIndex: number,
        private whichRuller: "y1" | "y2" | "both" | "none"
    ) {}

    down(point: SVGPoint, event: PointerEvent) {
        this.rulersController.rulersModel.pauseDbUpdate = true;

        this.yStart = this.rulersController.chartController.yAxisController.pxToValue(point.y);

        if (this.whichRuller === "none") {
            let y = this.rulersController.chartController.yAxisController.pxToValue(point.y);
            y = getSnapToValue(event, y, this.rulersController.chartController.yAxisController);

            this.rulersController.rulersModel.y1[this.chartIndex] = y;
            this.rulersController.rulersModel.y2[this.chartIndex] = y;
        }

        this.y1 = this.rulersController.rulersModel.y1[this.chartIndex];
        this.dy =
            this.rulersController.rulersModel.y2[this.chartIndex] -
            this.rulersController.rulersModel.y1[this.chartIndex];
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let y = this.rulersController.chartController.yAxisController.pxToValue(point.y);
        if (this.whichRuller === "both") {
            y = getSnapToValue(
                event,
                this.y1 + y - this.yStart,
                this.rulersController.chartController.yAxisController
            );

            if (y < this.rulersController.chartController.yAxisController.minValue) {
                y = this.rulersController.chartController.yAxisController.minValue;
            } else if (
                y + this.dy >
                this.rulersController.chartController.yAxisController.maxValue
            ) {
                y = this.rulersController.chartController.yAxisController.maxValue - this.dy;
            }

            this.rulersController.rulersModel.y1[this.chartIndex] = y;
            this.rulersController.rulersModel.y2[this.chartIndex] = y + this.dy;
        } else {
            y = getSnapToValue(event, y, this.rulersController.chartController.yAxisController);

            if (y < this.rulersController.chartController.yAxisController.minValue) {
                y = this.rulersController.chartController.yAxisController.minValue;
            } else if (y > this.rulersController.chartController.yAxisController.maxValue) {
                y = this.rulersController.chartController.yAxisController.maxValue;
            }

            if (this.whichRuller === "y1") {
                this.rulersController.rulersModel.y1[this.chartIndex] = y;
            } else {
                this.rulersController.rulersModel.y2[this.chartIndex] = y;
            }
        }
    }

    up(point: SVGPoint | undefined, event: PointerEvent | undefined, cancel: boolean) {
        this.rulersController.rulersModel.pauseDbUpdate = false;
    }

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = false;
    }

    render() {
        return null;
    }
}

export class RulersController {
    x1Rect: SVGRectElement | null;
    xRect: SVGRectElement | null;
    x2Rect: SVGRectElement | null;

    y1Rect: SVGRectElement | null;
    yRect: SVGRectElement | null;
    y2Rect: SVGRectElement | null;

    constructor(
        public chartController: ChartController,
        public waveformModel: WaveformModel,
        public rulersModel: RulersModel
    ) {}

    get chartIndex() {
        return this.chartController.chartsController.chartControllers.indexOf(this.chartController);
    }

    @computed
    get x1() {
        return (
            Math.round(
                this.chartController.chartsController.chartLeft +
                    this.chartController.xAxisController.valueToPx(this.rulersModel.x1)
            ) + 0.5
        );
    }

    @computed
    get x2() {
        return (
            Math.round(
                this.chartController.chartsController.chartLeft +
                    this.chartController.xAxisController.valueToPx(this.rulersModel.x2)
            ) + 0.5
        );
    }

    @computed
    get y1() {
        return (
            Math.round(
                this.chartController.chartsController.chartBottom -
                    this.chartController.yAxisController.valueToPx(
                        this.rulersModel.y1[this.chartIndex]
                    )
            ) + 0.5
        );
    }

    @computed
    get y2() {
        return (
            Math.round(
                this.chartController.chartsController.chartBottom -
                    this.chartController.yAxisController.valueToPx(
                        this.rulersModel.y2[this.chartIndex]
                    )
            ) + 0.5
        );
    }

    onDragStart(chartView: ChartView, event: PointerEvent): MouseHandler | undefined {
        if (event.target === this.x1Rect) {
            return new DragXRulerMouseHandler(this, "x1");
        }

        if (event.target === this.x2Rect) {
            return new DragXRulerMouseHandler(this, "x2");
        }

        if (event.target === this.y1Rect) {
            return new DragYRulerMouseHandler(this, this.chartIndex, "y1");
        }

        if (event.target === this.y2Rect) {
            return new DragYRulerMouseHandler(this, this.chartIndex, "y2");
        }

        if (event.target === this.xRect) {
            return new DragXRulerMouseHandler(this, "both");
        }

        if (event.target === this.yRect) {
            return new DragYRulerMouseHandler(this, this.chartIndex, "both");
        }

        if (this.rulersModel.xAxisRulersEnabled) {
            return new DragXRulerMouseHandler(this, "none");
        } else if (this.rulersModel.yAxisRulersEnabled) {
            return new DragYRulerMouseHandler(this, this.chartIndex, "none");
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

    renderXRulersRect(clipId: string) {
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

        const y1 = this.chartController.chartsController.chartTop;
        const y2 = this.chartController.chartsController.chartBottom;

        return (
            <g clipPath={`url(#${clipId})`}>
                <rect
                    ref={ref => (this.xRect = ref)}
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

    renderXRulersLines(clipId: string) {
        if (!this.rulersModel.xAxisRulersEnabled) {
            return null;
        }

        const x1 = this.x1;
        const x2 = this.x2;

        const y1 = this.chartController.chartsController.chartTop;
        const y2 = this.chartController.chartsController.chartBottom;

        return (
            <g clipPath={`url(#${clipId})`}>
                <line
                    x1={x1}
                    y1={y1}
                    x2={x1}
                    y2={y2}
                    stroke={this.color}
                    strokeWidth={RulersController.LINE_WIDTH}
                />
                <rect
                    ref={ref => (this.x1Rect = ref)}
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
                    ref={ref => (this.x2Rect = ref)}
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

    renderYRulersRect(clipId: string) {
        if (!this.rulersModel.yAxisRulersEnabled[this.chartIndex]) {
            return null;
        }

        let y1 = this.y1;
        let y2 = this.y2;
        if (y1 < y2) {
            const temp = y1;
            y1 = y2;
            y2 = temp;
        }

        const x1 = this.chartController.chartsController.chartLeft;
        const x2 = this.chartController.chartsController.chartRight;

        return (
            <g clipPath={`url(#${clipId})`}>
                <rect
                    ref={ref => (this.yRect = ref)}
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

    renderYRulersLines(clipId: string) {
        if (!this.rulersModel.yAxisRulersEnabled[this.chartIndex]) {
            return null;
        }

        const y1 = this.y1;
        const y2 = this.y2;

        const x1 = this.chartController.chartsController.chartLeft;
        const x2 = this.chartController.chartsController.chartRight;

        return (
            <g clipPath={`url(#${clipId})`}>
                <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y1}
                    stroke={this.color}
                    strokeWidth={RulersController.LINE_WIDTH}
                />
                <rect
                    ref={ref => (this.y1Rect = ref)}
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
                    ref={ref => (this.y2Rect = ref)}
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

    render(clipId: string) {
        return (
            <React.Fragment>
                {this.renderYRulersRect(clipId)}
                {this.renderXRulersRect(clipId)}
                {this.renderYRulersLines(clipId)}
                {this.renderXRulersLines(clipId)}
            </React.Fragment>
        );
    }

    snapToSample(x: number) {
        x = (x / this.chartController.xAxisController.range) * (this.waveformModel.length - 1);
        return (
            (Math.round(x) * this.chartController.xAxisController.range) /
            (this.waveformModel.length - 1)
        );
    }
}

interface RulersDockViewProps {
    chartsController: ChartsController;
}

@observer
export class RulersDockView extends React.Component<RulersDockViewProps> {
    @observable
    x1: string;
    @observable
    x1Error: boolean;

    @observable
    x2: string;
    @observable
    x2Error: boolean;

    @observable
    y1: string[] = [];
    @observable
    y1Error: boolean[] = [];

    @observable
    y2: string[] = [];
    @observable
    y2Error: boolean[] = [];

    outsideChangeInXRulersSubscriptionDisposer: any;
    outsideChangeInYRulersSubscriptionDisposer: any;

    isInsideChange: boolean = false;

    constructor(props: RulersDockViewProps) {
        super(props);

        this.subscribeToOutsideModelChanges();
    }

    componentWillReceiveProps(props: RulersDockViewProps) {
        this.subscribeToOutsideModelChanges();
    }

    @action
    subscribeToOutsideModelChanges() {
        if (this.outsideChangeInXRulersSubscriptionDisposer) {
            this.outsideChangeInXRulersSubscriptionDisposer();
        }

        this.outsideChangeInXRulersSubscriptionDisposer = autorun(() => {
            const x1 = this.props.chartsController.xAxisController.unit.formatValue(
                this.rulersModel.x1,
                4
            );
            const x2 = this.props.chartsController.xAxisController.unit.formatValue(
                this.rulersModel.x2,
                4
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
            for (let i = 0; i < this.props.chartsController.chartControllers.length; ++i) {
                const chartController = this.props.chartsController.chartControllers[i];

                const y1 = chartController.yAxisController.unit.formatValue(
                    this.rulersModel.y1[i],
                    4
                );
                const y2 = chartController.yAxisController.unit.formatValue(
                    this.rulersModel.y2[i],
                    4
                );
                if (!this.isInsideChange) {
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
        return this.props.chartsController.chartControllers[0].rulersController;
    }

    get rulersModel() {
        return this.rulersController.rulersModel!;
    }

    validateXRange() {
        const xAxisController = this.props.chartsController.xAxisController;

        const x1 = xAxisController.unit.parseValue(this.x1);
        this.x1Error = x1 == null || x1 < xAxisController.minValue || x1 > xAxisController.maxValue;

        const x2 = xAxisController.unit.parseValue(this.x2);
        this.x2Error = x2 == null || x2 < xAxisController.minValue || x2 > xAxisController.maxValue;

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

    @bind
    setX1(event: React.ChangeEvent<HTMLInputElement>) {
        this.isInsideChange = true;
        runInAction(() => {
            this.x1 = event.target.value;
            this.validateXRange();
        });
        this.isInsideChange = false;
    }

    @bind
    setX2(event: React.ChangeEvent<HTMLInputElement>) {
        this.isInsideChange = true;
        runInAction(() => {
            this.x2 = event.target.value;
            this.validateXRange();
        });
        this.isInsideChange = false;
    }

    @bind
    zoomToFitXRulers() {
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
        this.props.chartsController.xAxisController.zoom(x1 - 0.05 * dx, x2 + 0.05 * dx);
    }

    validateYRange(chartIndex: number) {
        const yAxisController = this.props.chartsController.chartControllers[chartIndex]
            .yAxisController;

        const y1 = yAxisController.unit.parseValue(this.y1[chartIndex]);
        this.y1Error[chartIndex] =
            y1 == null || y1 < yAxisController.minValue || y1 > yAxisController.maxValue;

        const y2 = yAxisController.unit.parseValue(this.y2[chartIndex]);
        this.y2Error[chartIndex] =
            y2 == null || y2 < yAxisController.minValue || y2 > yAxisController.maxValue;

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

            const yAxisController = this.props.chartsController.chartControllers[chartIndex]
                .yAxisController;

            this.rulersModel.y1[chartIndex] = yAxisController.from + 0.1 * yAxisController.distance;
            this.rulersModel.y2[chartIndex] = yAxisController.to - 0.1 * yAxisController.distance;
        } else {
            this.rulersModel.yAxisRulersEnabled[chartIndex] = false;
        }
    }

    @bind
    setY1(chartIndex: number, event: React.ChangeEvent<HTMLInputElement>) {
        this.isInsideChange = true;
        runInAction(() => {
            this.y1[chartIndex] = event.target.value;
            this.validateYRange(chartIndex);
        });
        this.isInsideChange = false;
    }

    @bind
    setY2(chartIndex: number, event: React.ChangeEvent<HTMLInputElement>) {
        this.isInsideChange = true;
        runInAction(() => {
            this.y2[chartIndex] = event.target.value;
            this.validateYRange(chartIndex);
        });
        this.isInsideChange = false;
    }

    @bind
    zoomToFitYRulers(chartIndex: number) {
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
        this.props.chartsController.chartControllers[chartIndex].yAxisController.zoom(
            y1 - 0.05 * dy,
            y2 + 0.05 * dy
        );
    }

    render() {
        return (
            <div className="EezStudio_SideDockView">
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
                                                className={classNames("form-control", {
                                                    error: this.x1Error
                                                })}
                                                value={this.x1}
                                                onChange={this.setX1}
                                            />
                                        </td>
                                        <td>X2</td>
                                        <td>
                                            <input
                                                type="text"
                                                className={classNames("form-control", {
                                                    error: this.x2Error
                                                })}
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
                                                    this.rulersModel.x2 - this.rulersModel.x1,
                                                    4
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
                {_range(this.props.chartsController.chartControllers.length).map(chartIndex => (
                    <div key={chartIndex} className="EezStudio_AxisRulersProperties">
                        <div className="EezStudio_SideDockView_PropertyLabel">
                            <Checkbox
                                checked={this.rulersModel.yAxisRulersEnabled[chartIndex]}
                                onChange={(checked: boolean) =>
                                    this.enableYAxisRulers(chartIndex, checked)
                                }
                            >
                                Enable{" "}
                                {this.props.chartsController.chartControllers.length > 1
                                    ? `"${
                                          this.props.chartsController.chartControllers[chartIndex]
                                              .yAxisController.axisModel.label
                                      }" `
                                    : ""}
                                Y axis rulers
                            </Checkbox>
                        </div>
                        {this.rulersModel.yAxisRulersEnabled[chartIndex] && (
                            <div className="EezStudio_SideDockView_Property">
                                <table>
                                    <tbody>
                                        <tr>
                                            <td>Y1</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={classNames("form-control", {
                                                        error: this.y1Error[chartIndex]
                                                    })}
                                                    value={this.y1[chartIndex]}
                                                    onChange={event =>
                                                        this.setY1(chartIndex, event)
                                                    }
                                                />
                                            </td>
                                            <td>Y2</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={classNames("form-control", {
                                                        error: this.y2Error[chartIndex]
                                                    })}
                                                    value={this.y2[chartIndex]}
                                                    onChange={event =>
                                                        this.setY2(chartIndex, event)
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
                                                        this.rulersModel.y2[chartIndex] -
                                                            this.rulersModel.y1[chartIndex],
                                                        4
                                                    )}
                                                    readOnly={true}
                                                />
                                            </td>
                                            <td />
                                            <td style={{ textAlign: "left" }}>
                                                <IconAction
                                                    icon="material:search"
                                                    onClick={() =>
                                                        this.zoomToFitYRulers(chartIndex)
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
