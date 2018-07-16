import * as React from "react";
import { observable, computed, action, runInAction, autorun } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

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
    @observable xAxisRulersEnabled: boolean = false;
    @observable x1: number = 0;
    @observable x2: number = 0;

    @observable yAxisRulersEnabled: boolean = false;
    @observable y1: number = 0;
    @observable y2: number = 0;

    @observable pauseDbUpdate: boolean = false;

    constructor(props?: any) {
        if (props) {
            Object.assign(this, props);
        }
    }
}

class DragXRulerMouseHandler implements MouseHandler {
    cursor = "ew-resize";
    xStart: number;
    x1: number;
    dx: number;

    constructor(private rulersController: RulersController, private whichRuller: 0 | 1 | 2) {}

    down(point: SVGPoint, event: PointerEvent) {
        this.rulersController.rulersModel.pauseDbUpdate = true;

        this.x1 = this.rulersController.rulersModel.x1;
        this.dx = this.rulersController.rulersModel.x2 - this.rulersController.rulersModel.x1;
        this.xStart = this.rulersController.chartController.xAxisController.pxToValue(point.x);
    }

    snapToSample(x: number) {
        x =
            (x / this.rulersController.chartController.xAxisController.range) *
            (this.rulersController.waveformModel.length - 1);
        if (this.whichRuller === 2) {
            return (
                (Math.floor(x) * this.rulersController.chartController.xAxisController.range) /
                (this.rulersController.waveformModel.length - 1)
            );
        } else {
            return (
                (Math.ceil(x) * this.rulersController.chartController.xAxisController.range) /
                (this.rulersController.waveformModel.length - 1)
            );
        }
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let x = this.rulersController.chartController.xAxisController.pxToValue(point.x);
        if (this.whichRuller === 0) {
            x = getSnapToValue(
                event,
                this.x1 + x - this.xStart,
                this.rulersController.chartController.xAxisController
            );
            x = this.snapToSample(x);

            if (
                x >= this.rulersController.chartController.xAxisController.minValue &&
                x + this.dx <= this.rulersController.chartController.xAxisController.maxValue
            ) {
                this.rulersController.rulersModel.x1 = x;
                this.rulersController.rulersModel.x2 = x + this.dx;
            }
        } else {
            x = getSnapToValue(event, x, this.rulersController.chartController.xAxisController);
            x = this.snapToSample(x);

            if (
                x >= this.rulersController.chartController.xAxisController.minValue &&
                x <= this.rulersController.chartController.xAxisController.maxValue
            ) {
                if (this.whichRuller === 1) {
                    if (x <= this.rulersController.rulersModel.x2) {
                        this.rulersController.rulersModel.x1 = x;
                    }
                } else {
                    if (this.rulersController.rulersModel.x1 <= x) {
                        this.rulersController.rulersModel.x2 = x;
                    }
                }
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

    constructor(private rulersController: RulersController, private whichRuller: 0 | 1 | 2) {}

    down(point: SVGPoint, event: PointerEvent) {
        this.rulersController.rulersModel.pauseDbUpdate = true;

        this.y1 = this.rulersController.rulersModel.y1;
        this.dy = this.rulersController.rulersModel.y2 - this.rulersController.rulersModel.y1;
        this.yStart = this.rulersController.chartController.yAxisController.pxToValue(point.y);
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let y = this.rulersController.chartController.yAxisController.pxToValue(point.y);
        if (this.whichRuller === 0) {
            y = getSnapToValue(
                event,
                this.y1 + y - this.yStart,
                this.rulersController.chartController.yAxisController
            );

            if (
                y >= this.rulersController.chartController.yAxisController.minValue &&
                y + this.dy <= this.rulersController.chartController.yAxisController.maxValue
            ) {
                this.rulersController.rulersModel.y1 = y;
                this.rulersController.rulersModel.y2 = y + this.dy;
            }
        } else {
            y = getSnapToValue(event, y, this.rulersController.chartController.yAxisController);

            if (
                y >= this.rulersController.chartController.yAxisController.minValue &&
                y <= this.rulersController.chartController.yAxisController.maxValue
            ) {
                if (this.whichRuller === 1) {
                    if (y <= this.rulersController.rulersModel.y2) {
                        this.rulersController.rulersModel.y1 = y;
                    }
                } else {
                    if (this.rulersController.rulersModel.y1 <= y) {
                        this.rulersController.rulersModel.y2 = y;
                    }
                }
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

    constructor(public chartController: ChartController, public waveformModel: WaveformModel) {}

    get rulersModel() {
        return this.waveformModel.rulers;
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
                    this.chartController.yAxisController.valueToPx(this.rulersModel.y1)
            ) + 0.5
        );
    }

    @computed
    get y2() {
        return (
            Math.round(
                this.chartController.chartsController.chartBottom -
                    this.chartController.yAxisController.valueToPx(this.rulersModel.y2)
            ) + 0.5
        );
    }

    onDragStart(chartView: ChartView, event: PointerEvent): MouseHandler | undefined {
        if (event.target === this.x1Rect) {
            return new DragXRulerMouseHandler(this, 1);
        }

        if (event.target === this.x2Rect) {
            return new DragXRulerMouseHandler(this, 2);
        }

        if (event.target === this.y1Rect) {
            return new DragYRulerMouseHandler(this, 1);
        }

        if (event.target === this.y2Rect) {
            return new DragYRulerMouseHandler(this, 2);
        }

        if (event.target === this.xRect) {
            return new DragXRulerMouseHandler(this, 0);
        }

        if (event.target === this.yRect) {
            return new DragYRulerMouseHandler(this, 0);
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

        const x1 = this.x1;
        const x2 = this.x2;

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
        if (!this.rulersModel.yAxisRulersEnabled) {
            return null;
        }

        const y1 = this.y1;
        const y2 = this.y2;

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
        if (!this.rulersModel.yAxisRulersEnabled) {
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
}

interface RulersDockViewProps {
    chartsController: ChartsController;
}

@observer
export class RulersDockView extends React.Component<RulersDockViewProps> {
    @observable x1: string;
    @observable x1Error: boolean;

    @observable x2: string;
    @observable x2Error: boolean;

    @observable y1: string;
    @observable y1Error: boolean;

    @observable y2: string;
    @observable y2Error: boolean;

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
            const x1 = this.chartController.xAxisController.unit.formatValue(
                this.rulersModel.x1,
                4
            );
            const x2 = this.chartController.xAxisController.unit.formatValue(
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
            const y1 = this.chartController.yAxisController.unit.formatValue(
                this.rulersModel.y1,
                4
            );
            const y2 = this.chartController.yAxisController.unit.formatValue(
                this.rulersModel.y2,
                4
            );
            if (!this.isInsideChange) {
                runInAction(() => {
                    this.y1 = y1;
                    this.y1Error = false;
                    this.y2 = y2;
                    this.y2Error = false;
                });
            }
        });
    }

    get chartController() {
        return this.props.chartsController.chartControllers[0];
    }

    get rulersController() {
        return this.chartController.rulersController!;
    }

    get rulersModel() {
        return this.rulersController.rulersModel!;
    }

    validateXRange() {
        const xAxisController = this.chartController.xAxisController;

        const x1 = xAxisController.unit.parseValue(this.x1);
        this.x1Error = x1 == null || x1 < xAxisController.minValue || x1 > xAxisController.maxValue;

        const x2 = xAxisController.unit.parseValue(this.x2);
        this.x2Error = x2 == null || x2 < xAxisController.minValue || x2 > xAxisController.maxValue;

        if (this.x1Error || this.x2Error) {
            return;
        }

        if (x1! > x2!) {
            this.x1Error = true;
            this.x2Error = true;
            return;
        }

        this.rulersModel.x1 = x1!;
        this.rulersModel.x2 = x2!;
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
        const dx = this.rulersModel.x2 - this.rulersModel.x1;
        this.chartController.xAxisController.zoom(
            this.rulersModel.x1 - 0.05 * dx,
            this.rulersModel.x2 + 0.05 * dx
        );
    }

    validateYRange() {
        const yAxisController = this.chartController.yAxisController;

        const y1 = yAxisController.unit.parseValue(this.y1);
        this.y1Error = y1 == null || y1 < yAxisController.minValue || y1 > yAxisController.maxValue;

        const y2 = yAxisController.unit.parseValue(this.y2);
        this.y2Error = y2 == null || y2 < yAxisController.minValue || y2 > yAxisController.maxValue;

        if (this.y1Error || this.y2Error) {
            return;
        }

        if (y1! > y2!) {
            this.y1Error = true;
            this.y2Error = true;
            return;
        }

        this.rulersModel.y1 = y1!;
        this.rulersModel.y2 = y2!;
    }

    @bind
    setY1(event: React.ChangeEvent<HTMLInputElement>) {
        this.isInsideChange = true;
        runInAction(() => {
            this.y1 = event.target.value;
            this.validateYRange();
        });
        this.isInsideChange = false;
    }

    @bind
    setY2(event: React.ChangeEvent<HTMLInputElement>) {
        this.isInsideChange = true;
        runInAction(() => {
            this.y2 = event.target.value;
            this.validateYRange();
        });
        this.isInsideChange = false;
    }

    @bind
    zoomToFitYRulers() {
        const dy = this.rulersModel.y2 - this.rulersModel.y1;
        this.chartController.yAxisController.zoom(
            this.rulersModel.y1 - 0.05 * dy,
            this.rulersModel.y2 + 0.05 * dy
        );
    }

    render() {
        return (
            <div className="EezStudio_SideDockView">
                <div className="horizontal">
                    <div className="EezStudio_SideDockView_PropertyLabel">
                        <Checkbox
                            checked={this.rulersModel.xAxisRulersEnabled}
                            onChange={action(
                                (checked: boolean) =>
                                    (this.rulersModel.xAxisRulersEnabled = checked)
                            )}
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
                                    </tr>
                                    <tr>
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
                                    </tr>
                                    <tr>
                                        <td>&Delta;X</td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={this.chartController.xAxisController.unit.formatValue(
                                                    this.rulersModel.x2 - this.rulersModel.x1,
                                                    4
                                                )}
                                                readOnly={true}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td />
                                        <td style={{ textAlign: "left" }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={this.zoomToFitXRulers}
                                            >
                                                Zoom to fit
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="horizontal">
                    <div className="EezStudio_SideDockView_PropertyLabel">
                        <Checkbox
                            checked={this.rulersModel.yAxisRulersEnabled}
                            onChange={action(
                                (checked: boolean) =>
                                    (this.rulersModel.yAxisRulersEnabled = checked)
                            )}
                        >
                            Enable Y axis rulers
                        </Checkbox>
                    </div>
                    {this.rulersModel.yAxisRulersEnabled && (
                        <div className="EezStudio_SideDockView_Property">
                            <table>
                                <tbody>
                                    <tr>
                                        <td>Y1</td>
                                        <td>
                                            <input
                                                type="text"
                                                className={classNames("form-control", {
                                                    error: this.y1Error
                                                })}
                                                value={this.y1}
                                                onChange={this.setY1}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Y2</td>
                                        <td>
                                            <input
                                                type="text"
                                                className={classNames("form-control", {
                                                    error: this.y2Error
                                                })}
                                                value={this.y2}
                                                onChange={this.setY2}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>&Delta;Y</td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={this.chartController.yAxisController.unit.formatValue(
                                                    this.rulersModel.y2 - this.rulersModel.y1,
                                                    4
                                                )}
                                                readOnly={true}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td />
                                        <td style={{ textAlign: "left" }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={this.zoomToFitYRulers}
                                            >
                                                Zoom to fit
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
