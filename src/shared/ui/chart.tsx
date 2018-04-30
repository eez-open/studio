import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, computed, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { clamp, guid } from "shared/util";
import { capitalize } from "shared/string";
import { Point, pointDistance } from "shared/geometry";
import { IUnit } from "shared/units";

import { Draggable } from "shared/ui/draggable";

////////////////////////////////////////////////////////////////////////////////

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

const CONF_ZOOM_TO_RECT_ORIENTATION_DETECTION_THRESHOLD = 5;

const CONF_DYNAMIC_AXIS_LINE_MIN_COLOR_OPACITY = 0.1;
const CONF_DYNAMIC_AXIS_LINE_MAX_COLOR_OPACITY = 0.9;
const CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND = "192, 192, 192";
const CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND = "164, 164, 164";

const CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_WHITE_BACKGROUND = "#ccc";
const CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_WHITE_BACKGROUND = "#f0f0f0";
const CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_BLACK_BACKGROUND = "#444";
const CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_BLACK_BACKGROUND = "#222";

export const CONF_CURSOR_RADIUS = 8;

////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////

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
}

interface ITick {
    px: number;
    value: number;
    label: string;
    color: string;
    isMajorLine?: boolean;
    allowSnapTo: boolean;
}

export abstract class AxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: ChartsController,
        public chartController: ChartController | undefined, // undefined for position === 'x'
        public axisModel: IAxisModel
    ) {}

    unit: IUnit = this.axisModel.unit;

    @observable labelTextsWidth: number = 0;
    @observable labelTextsHeight: number = 0;

    @observable isAnimationActive: boolean;
    animationController = new AnimationController();

    abstract get from(): number;
    abstract get to(): number;

    @computed
    get isScrollBarEnabled() {
        return (this.from > this.minValue || this.to < this.maxValue) && this.range != 0;
    }

    @computed
    get minValue() {
        return this.position === "x"
            ? this.chartsController.minValue
            : this.chartController!.minValue[this.position];
    }

    @computed
    get maxValue() {
        return this.position === "x"
            ? this.chartsController.maxValue
            : this.chartController!.maxValue[this.position];
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
        return this.axisModel.minScale !== undefined
            ? this.axisModel.minScale
            : this.distancePx / this.range;
    }

    @computed
    get maxScale() {
        return this.axisModel.maxScale !== undefined
            ? this.axisModel.maxScale
            : this.distancePx / this.unit.units[0];
    }

    pxToValue(px: number) {
        return this.from + px / this.scale;
    }

    valueToPx(value: number) {
        return (value - this.from) * this.scale;
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
        return /*this.position === "x" ? this.scale > this.minScale : */ this.isScrollBarEnabled;
    }

    abstract zoomOut(): void;

    abstract zoom(from: number, to: number): void;

    abstract zoomAroundPivotPoint(pivotPx: number, zoomIn: boolean): void;

    pageUp() {
        this.panTo(this.from + this.distance);
    }

    pageDown() {
        this.panTo(this.from - this.distance);
    }

    home() {
        this.panTo(this.minValue);
    }

    end() {
        this.panTo(this.maxValue - this.distance);
    }
}

////////////////////////////////////////////////////////////////////////////////

class DynamicAxisController extends AxisController {
    constructor(
        public position: "x" | "y" | "yRight",
        public chartsController: ChartsController,
        public chartController: ChartController | undefined, // undefined for position === 'x'
        public axisModel: IAxisModel
    ) {
        super(position, chartsController, chartController, axisModel);
    }

    @observable animationFrom: number;
    @observable animationTo: number;

    @computed
    get from() {
        if (this.isAnimationActive) {
            return this.animationFrom;
        }

        if (this.axisModel.dynamic.zoomMode === "default") {
            return this.axisModel.defaultFrom;
        }

        if (this.axisModel.dynamic.zoomMode === "all") {
            return this.minValue;
        }

        let from = this.axisModel.dynamic.from;
        let to = this.axisModel.dynamic.to;
        let range = to - from;
        if (range < this.steps[0] && from + this.steps[0] > this.maxValue) {
            from = this.maxValue - this.steps[0];
        }
        return from;
    }

    set from(value: number) {
        this.axisModel.dynamic.zoomMode = "custom";
        if (value < this.minValue) {
            this.axisModel.dynamic.from = this.minValue;
        } else {
            this.axisModel.dynamic.from = value;
        }
    }

    @computed
    get to() {
        if (this.isAnimationActive) {
            return this.animationTo;
        }

        if (this.axisModel.dynamic.zoomMode === "default") {
            return this.axisModel.defaultTo;
        }

        if (this.axisModel.dynamic.zoomMode === "all") {
            return this.maxValue;
        }

        let from = this.axisModel.dynamic.from;
        let to = this.axisModel.dynamic.to;
        let range = to - from;
        if (range < this.steps[0]) {
            if (from + this.steps[0] > this.maxValue) {
                from = this.maxValue - this.steps[0];
            }
            to = from + this.steps[0];
        }
        return to;
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
            } else if (Array.isArray(this.chartsController.viewOptions.axesLines.steps.y)) {
                steps = this.chartsController.viewOptions.axesLines.steps.y.find(
                    (vale: number[], i: number) =>
                        this.chartsController.chartControllers[i] === this.chartController
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
        const minLabelPx =
            this.position === "x"
                ? CONF_X_AXIS_MIN_TICK_LABEL_WIDTH
                : CONF_Y_AXIS_MIN_TICK_LABEL_WIDTH;

        const { from, to, scale } = this;

        const minDistanceInPx = CONF_AXIS_MIN_TICK_DISTANCE;
        const maxDistanceInPx = CONF_AXIS_MAX_TICK_DISTANCE;
        const minColorOpacity = CONF_DYNAMIC_AXIS_LINE_MIN_COLOR_OPACITY;
        const maxColorOpacity = CONF_DYNAMIC_AXIS_LINE_MAX_COLOR_OPACITY;

        let linesMap = new Map<number, ITick>();

        let steps = this.steps;
        for (let i = steps.length - 1; i >= 0; --i) {
            let unit = steps[i];
            let unitPx = unit * scale;

            if (unitPx >= minDistanceInPx) {
                let p = Math.floor(from / unit);
                let q = Math.ceil(to / unit);

                for (let j = p; j <= q; ++j) {
                    let value = j * unit;
                    let px = Math.round((value - from) * scale);
                    if (px < 0 || px > Math.round(this.distancePx)) {
                        continue;
                    }
                    if (!linesMap.has(px)) {
                        let opacity = clamp(
                            minColorOpacity +
                                (maxColorOpacity - minColorOpacity) *
                                    (unitPx - minDistanceInPx) /
                                    (maxDistanceInPx - minDistanceInPx),
                            minColorOpacity,
                            maxColorOpacity
                        );

                        linesMap.set(px, {
                            px,
                            value,
                            label: unitPx >= minLabelPx ? this.unit.formatValue(value) : "",
                            color: globalViewOptions.blackBackground
                                ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${opacity})`
                                : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${opacity})`,
                            allowSnapTo: true
                        });
                    }
                }
            }
        }

        let ticks = Array.from(linesMap.keys())
            .sort((a, b) => a - b)
            .map(x => linesMap.get(x)!);

        if (ticks.length === 0) {
            // no tick lines, at least add lines for "from" and "to"
            let from = Math.ceil(this.from / this.steps[0]) * this.steps[0];
            ticks.push({
                px: this.valueToPx(from),
                value: from,
                label: this.unit.formatValue(from),
                color: globalViewOptions.blackBackground
                    ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${maxColorOpacity})`
                    : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${maxColorOpacity})`,
                allowSnapTo: false
            });

            let to = Math.floor(this.to / this.steps[0]) * this.steps[0];
            ticks.push({
                px: this.valueToPx(to),
                value: to,
                label: this.unit.formatValue(to),
                color: globalViewOptions.blackBackground
                    ? `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_BLACK_BACKGROUND}, ${maxColorOpacity})`
                    : `rgba(${CONF_DYNAMIC_AXIS_LINE_COLOR_ON_WHITE_BACKGROUND}, ${maxColorOpacity})`,
                allowSnapTo: false
            });
        } else {
            const noLabels = ticks.every(tick => !tick.label);
            if (noLabels) {
                // no tick labels, at least add for first and last line
                ticks[0].label = this.unit.formatValue(ticks[0].value);
                if (ticks.length > 1) {
                    ticks[ticks.length - 1].label = this.unit.formatValue(
                        ticks[ticks.length - 1].value
                    );
                }
            }
        }

        return ticks;
    }

    @computed
    get maxScale() {
        return this.axisModel.maxScale !== undefined
            ? this.axisModel.maxScale
            : this.distancePx / this.steps[0];
    }

    panByDirection(direction: number) {
        this.panByDistance(direction * CONF_PAN_STEP * this.distance);
    }

    panTo(newFrom: number) {
        if (newFrom < this.minValue) {
            newFrom = this.minValue;
        } else if (newFrom + this.distance > this.maxValue) {
            newFrom = this.maxValue - this.distance;
        }

        let distance = this.distance;
        if (newFrom > this.from) {
            let maxTo = Math.max(this.to, this.maxValue);
            if (newFrom + distance > maxTo) {
                newFrom = maxTo - distance;
            }
        }
        this.from = newFrom;
        this.to = this.from + distance;
    }

    zoomAll() {
        this.animate(() => (this.axisModel.dynamic.zoomMode = "all"));
    }

    zoomDefault() {
        this.animate(() => (this.axisModel.dynamic.zoomMode = "default"));
    }

    @action.bound
    zoomIn() {
        this.zoom(this.from, this.from + this.distance / CONF_ZOOM_STEP);
    }

    @action.bound
    zoomOut() {
        this.zoom(this.from, this.from + this.distance * CONF_ZOOM_STEP);
    }

    zoom(from: number, to: number) {
        let distance = to - from;

        if (distance < this.distance) {
            if (!this.zoomInEnabled) {
                return;
            }
        } else {
            if (!this.zoomOutEnabled) {
                return;
            }
        }

        if (distance > this.range) {
            distance = this.range;
        }

        if (from < this.minValue) {
            from = this.minValue;
            to = from + distance;
        }

        if (to > this.maxValue) {
            to = this.maxValue;
            from = to - distance;
        }

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

        let distance = zoomIn ? this.distance / CONF_ZOOM_STEP : this.distance * CONF_ZOOM_STEP;

        if (distance > this.range) {
            distance = this.range;
        }

        let from = this.from + (this.distance - distance) * pivotPx / this.distancePx;
        let to = from + distance;

        if (from < this.minValue) {
            from = this.minValue;
            to = from + distance;
        }
        if (to > this.maxValue) {
            to = this.maxValue;
            from = to - distance;
        }

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

        set();

        const newFrom = this.from;
        const newTo = this.to;

        this.animationController.animate(CONF_SCALE_ZOOM_FACTOR_ANIMATION_DURATION, {
            step: action((t: number) => {
                if (t === 1) {
                    this.isAnimationActive = false;
                } else {
                    this.isAnimationActive = true;
                    this.animationFrom = oldFrom + t * (newFrom - oldFrom);
                    this.animationTo = oldTo + t * (newTo - oldTo);
                }
            })
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

const MIN_FIXED_SCALE_POWER = -9;
const MAX_FIXED_SCALE_POWER = 9;

function calcSubdivisionScaleOffset(from: number, to: number, subdivision: number) {
    for (let i = MIN_FIXED_SCALE_POWER; i <= MAX_FIXED_SCALE_POWER; ++i) {
        for (let k = 1; k < 100; ++k) {
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
    for (let i = MAX_FIXED_SCALE_POWER; i >= MIN_FIXED_SCALE_POWER; --i) {
        for (let k = 9; k >= 1; --k) {
            const scale = k * Math.pow(10, i);
            if (scale < currentScale) {
                return scale;
            }
        }
    }

    return currentScale;
}

function scaleZoomOut(currentScale: number) {
    for (let i = MIN_FIXED_SCALE_POWER; i <= MAX_FIXED_SCALE_POWER; ++i) {
        for (let k = 1; k <= 9; ++k) {
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
        public chartController: ChartController | undefined, // undefined for position === 'x'
        public axisModel: IAxisModel
    ) {
        super(position, chartsController, chartController, axisModel);
    }

    @observable isAnimationActive: boolean;
    animationController = new AnimationController();

    @observable animationSubdivisionOffset: number;
    @observable animationSubdivisionScale: number;

    get majorSubdivison() {
        return this.position === "x"
            ? this.chartsController.viewOptions.axesLines.majorSubdivision.horizontal
            : this.chartsController.viewOptions.axesLines.majorSubdivision.vertical;
    }

    @computed
    get subdivisionOffset() {
        if (this.axisModel.fixed.zoomMode === "default") {
            return this.axisModel.defaultSubdivisionOffset !== undefined
                ? this.axisModel.defaultSubdivisionOffset
                : calcSubdivisionScaleOffset(
                      this.axisModel.defaultFrom,
                      this.axisModel.defaultTo,
                      this.majorSubdivison
                  ).offset;
        }

        if (this.axisModel.fixed.zoomMode === "all") {
            return calcSubdivisionScaleOffset(this.minValue, this.maxValue, this.majorSubdivison)
                .offset;
        }

        return this.axisModel.fixed.subdivisionOffset;
    }

    @computed
    get subdivisionScale() {
        if (this.axisModel.fixed.zoomMode === "default") {
            return this.axisModel.defaultSubdivisionScale !== undefined
                ? this.axisModel.defaultSubdivisionScale
                : calcSubdivisionScaleOffset(
                      this.axisModel.defaultFrom,
                      this.axisModel.defaultTo,
                      this.majorSubdivison
                  ).scale;
        }

        if (this.axisModel.fixed.zoomMode === "all") {
            return calcSubdivisionScaleOffset(this.minValue, this.maxValue, this.majorSubdivison)
                .scale;
        }

        return this.axisModel.fixed.subdivisonScale;
    }

    @computed
    get from() {
        if (this.isAnimationActive) {
            return this.animationSubdivisionOffset;
        }

        return this.subdivisionOffset;
    }

    @computed
    get to() {
        if (this.isAnimationActive) {
            return (
                this.animationSubdivisionOffset +
                this.animationSubdivisionScale * this.majorSubdivison
            );
        }

        return this.subdivisionOffset + this.subdivisionScale * this.majorSubdivison;
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
                ? this.chartsController.viewOptions.axesLines.majorSubdivision.horizontal
                : this.chartsController.viewOptions.axesLines.majorSubdivision.vertical;

        let m =
            this.position === "x"
                ? this.chartsController.viewOptions.axesLines.minorSubdivision.horizontal
                : this.chartsController.viewOptions.axesLines.minorSubdivision.vertical;

        let minorSubdivision = (this.to - this.from) / (m * n);

        let visibleLabelPx = 0;

        let majorLineColor = globalViewOptions.blackBackground
            ? CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_BLACK_BACKGROUND
            : CONF_FIXED_AXIS_MAJOR_LINE_COLOR_ON_WHITE_BACKGROUND;
        let minorLineColor = globalViewOptions.blackBackground
            ? CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_BLACK_BACKGROUND
            : CONF_FIXED_AXIS_MINOR_LINE_COLOR_ON_WHITE_BACKGROUND;

        for (let i = 0; i <= n * m; ++i) {
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
                            Math.round(this.valueToPx(this.to)) - px >= minLabelPx
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
                isMajorLine: isMajorLine,
                allowSnapTo: true
            });
        }

        return lines;
    }

    panByDirection(direction: number) {
        this.panByDistance(direction * 1.1 * this.subdivisionScale);
    }

    panTo(newFrom: number) {
        if (newFrom < this.minValue) {
            newFrom = this.minValue;
        } else if (newFrom + this.distance > this.maxValue) {
            newFrom = this.maxValue - this.distance;
        }

        this.axisModel.fixed.subdivisionOffset =
            Math.floor(newFrom / this.subdivisionScale) * this.subdivisionScale;
    }

    zoomAll() {
        this.animate(() => (this.axisModel.fixed.zoomMode = "all"));
    }

    zoomDefault() {
        this.animate(() => (this.axisModel.fixed.zoomMode = "default"));
    }

    @action.bound
    zoomIn() {
        if (!this.zoomInEnabled) {
            return;
        }

        const scale = scaleZoomIn(this.subdivisionScale);

        this.animate(() => {
            this.axisModel.fixed.subdivisonScale = scale;
            this.axisModel.fixed.subdivisionOffset = this.subdivisionOffset;
            this.axisModel.fixed.zoomMode = "custom";
        });
    }

    @action.bound
    zoomOut() {
        if (!this.zoomOutEnabled) {
            return;
        }

        const scale = scaleZoomOut(this.subdivisionScale);

        this.animate(() => {
            this.axisModel.fixed.subdivisonScale = scale;
            this.axisModel.fixed.subdivisionOffset = this.subdivisionOffset;
            this.axisModel.fixed.zoomMode = "custom";
        });
    }

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

        const result = calcSubdivisionScaleOffset(from, to, this.majorSubdivison);

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
                (this.subdivisionScale - newScale) *
                    this.majorSubdivison *
                    pivotPx /
                    this.distancePx;

            if (fixedOffset > this.maxValue - this.majorSubdivison * newScale) {
                fixedOffset = this.maxValue - this.majorSubdivison * newScale;
            }

            if (fixedOffset < this.minValue) {
                fixedOffset = this.minValue;
            }

            fixedOffset = Math.floor(fixedOffset / newScale) * newScale;

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

        set();

        const newOffset = this.subdivisionOffset;
        const newScale = this.subdivisionScale;

        this.animationController.animate(CONF_SCALE_ZOOM_FACTOR_ANIMATION_DURATION, {
            step: action((t: number) => {
                if (t === 1) {
                    this.isAnimationActive = false;
                } else {
                    this.isAnimationActive = true;
                    this.animationSubdivisionOffset = oldOffset + t * (newOffset - oldOffset);
                    this.animationSubdivisionScale = oldScale + t * (newScale - oldScale);
                }
            })
        });
    }
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

    updateCursor(cursor: ICursor, point: Point, event: PointerEvent): void;
    addPoint(chartView: ChartView, cursor: ICursor): MouseHandler | undefined;
    onDragStart(chartView: ChartView, event: PointerEvent): MouseHandler | undefined;
    render(clipId: string): JSX.Element;
    // find closest point on line to the given point
    closestPoint(point: Point): Point | undefined;
}

export abstract class LineController implements ILineController {
    constructor(public id: string, public yAxisController: AxisController) {}

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

    abstract get yMin(): number;
    abstract get yMax(): number;

    updateCursor(cursor: ICursor | undefined, point: Point, event: PointerEvent): void {}

    addPoint(chartView: ChartView, cursor: ICursor): MouseHandler | undefined {
        return undefined;
    }

    onDragStart(chartView: ChartView, event: PointerEvent): MouseHandler | undefined {
        return undefined;
    }

    abstract render(clipId: string): JSX.Element;

    closestPoint(point: Point): Point | undefined {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ChartController {
    constructor(public chartsController: ChartsController, public id: string) {}

    get xAxisController() {
        return this.chartsController.xAxisController;
    }

    yAxisController: AxisController;

    createYAxisController(unit: IUnit, model: IAxisModel) {
        if (this.chartsController.viewOptions.axesLines.type === "dynamic") {
            this.yAxisController = new DynamicAxisController(
                "y",
                this.chartsController,
                this,
                model
            );
        } else {
            this.yAxisController = new FixedAxisController("y", this.chartsController, this, model);
        }
    }

    yAxisControllerOnRightSide?: AxisController;

    createYAxisControllerOnRightSide(unit: IUnit, model: IAxisModel) {
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

    chartView: ChartView | undefined;

    @computed
    get axes() {
        const axes = [this.xAxisController, this.yAxisController];
        if (this.yAxisControllerOnRightSide) {
            axes.push(this.yAxisControllerOnRightSide);
        }
        return axes;
    }

    onDragStart(chartView: ChartView, event: PointerEvent): MouseHandler | undefined {
        for (let i = 0; i < this.lineControllers.length; ++i) {
            const mouseHandler = this.lineControllers[i].onDragStart(chartView, event);
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
                    ? Math.min(...this.lineControllers.map(lineController => lineController.xMin))
                    : 0,

            y:
                this.lineControllers.length > 0
                    ? Math.min(
                          ...this.lineControllers
                              .filter(
                                  lineController =>
                                      lineController.yAxisController === this.yAxisController
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
                    ? Math.max(...this.lineControllers.map(lineController => lineController.xMax))
                    : 1,

            y:
                this.lineControllers.length > 0
                    ? Math.max(
                          ...this.lineControllers
                              .filter(
                                  lineController =>
                                      lineController.yAxisController === this.yAxisController
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

export class GlobalViewOptions {
    @observable enableZoomAnimations: boolean = true;
    @observable blackBackground: boolean = false;
}

export const globalViewOptions = new GlobalViewOptions();

////////////////////////////////////////////////////////////////////////////////

export class ChartsController {
    constructor(
        public mode: ChartMode,
        private xAxisModel: IAxisModel,
        public viewOptions: IViewOptions
    ) {}

    chartControllers: ChartController[];

    @computed
    get xAxisController() {
        if (this.viewOptions.axesLines.type === "dynamic") {
            return new DynamicAxisController("x", this, undefined, this.xAxisModel);
        } else {
            return new FixedAxisController("x", this, undefined, this.xAxisModel);
        }
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
        return Math.max(CONF_MIN_X_AXIS_BAND_HEIGHT, this.xAxisController.labelTextsHeight);
    }

    @computed
    get yAxisLabelTextsWidth() {
        let maxLabelTextsWidth = 0;
        for (let i = 0; i < this.chartControllers.length; ++i) {
            const chartController = this.chartControllers[i];
            if (chartController.yAxisController.labelTextsWidth > maxLabelTextsWidth) {
                maxLabelTextsWidth = chartController.yAxisController.labelTextsWidth;
            }
            if (
                chartController.yAxisControllerOnRightSide &&
                chartController.yAxisControllerOnRightSide.labelTextsWidth > maxLabelTextsWidth
            ) {
                maxLabelTextsWidth = chartController.yAxisControllerOnRightSide.labelTextsWidth;
            }
        }

        return Math.max(
            CONF_MIN_Y_SCALE_LABELS_WIDTH,
            maxLabelTextsWidth + CONF_LABEL_TICK_GAP_HORZ
        );
    }

    @computed
    get xAxisHeight() {
        let xAxisHeight = SCROLL_BAR_SIZE;
        if (this.viewOptions.showZoomButtons && this.viewOptions.showAxisLabels) {
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

        if (this.viewOptions.showZoomButtons && this.viewOptions.showAxisLabels) {
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
            if (this.viewOptions.showZoomButtons && this.viewOptions.showAxisLabels) {
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
            ? Math.max(this.chartViewWidth - this.minLeftMargin - this.minRightMargin, 1)
            : 1;
    }
    @computed
    get maxChartHeight() {
        return this.chartViewHeight
            ? Math.max(this.chartViewHeight - this.minTopMargin - this.minBottomMargin, 1)
            : 1;
    }

    @computed
    get chartWidth() {
        if (this.viewOptions.axesLines.type === "dynamic") {
            return this.maxChartWidth;
        }

        if (
            this.maxChartWidth / this.viewOptions.axesLines.majorSubdivision.horizontal <
            this.maxChartHeight / this.viewOptions.axesLines.majorSubdivision.vertical
        ) {
            return this.maxChartWidth;
        }

        return (
            this.viewOptions.axesLines.majorSubdivision.horizontal *
            this.maxChartHeight /
            this.viewOptions.axesLines.majorSubdivision.vertical
        );
    }

    @computed
    get chartHeight() {
        if (this.viewOptions.axesLines.type === "dynamic") {
            return this.maxChartHeight;
        }

        if (
            this.maxChartWidth / this.viewOptions.axesLines.majorSubdivision.horizontal <
            this.maxChartHeight / this.viewOptions.axesLines.majorSubdivision.vertical
        ) {
            return (
                this.viewOptions.axesLines.majorSubdivision.vertical *
                this.maxChartWidth /
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
        return this.minLeftMargin + Math.round((this.maxChartWidth - this.chartWidth) / 2);
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
        return this.minTopMargin + Math.round((this.maxChartHeight - this.chartHeight) / 2);
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
            ? Math.min(...this.chartControllers.map(chartController => chartController.minValue.x))
            : 0;
    }

    @computed
    get maxValue() {
        return this.chartControllers.length > 0
            ? Math.max(...this.chartControllers.map(chartController => chartController.maxValue.x))
            : 1;
    }

    @computed
    get isZoomAllEnabled() {
        return (
            this.xAxisController.from != this.minValue ||
            this.xAxisController.to != this.maxValue ||
            this.chartControllers.find(chartController => {
                return (
                    chartController.yAxisController.isScrollBarEnabled ||
                    !!(
                        chartController.yAxisControllerOnRightSide &&
                        chartController.yAxisControllerOnRightSide.isScrollBarEnabled
                    )
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
        this.chartControllers.forEach(chartController => chartController.zoomAll());
    }

    @action.bound
    zoomDefault() {
        this.xAxisController.zoomDefault();
        this.chartControllers.forEach(chartController => chartController.zoomDefault());
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ChartBorder extends React.Component<{ chartsController: ChartsController }, {}> {
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
class AxisLines extends React.Component<{ axisController: AxisController }, {}> {
    @bind
    line(tick: ITick, i: number) {
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

        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" stroke={tick.color} />;
    }

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
                <g className="svgButton" onClick={onClick}>
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
class AxisLabels extends React.Component<{ axisController: AxisController }, {}> {
    render() {
        const { axisController } = this.props;

        const chartsController = axisController.chartsController;

        const labels = axisController.ticks.filter(tick => !!tick.label).map((tick, i) => {
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
                xText = chartsController.chartLeft - CONF_LABEL_TICK_GAP_HORZ;
                yText = chartsController.chartBottom - tick.px;
                textAnchor = "end";
                alignmentBaseline = "middle";
            } else {
                xText = chartsController.chartRight + CONF_LABEL_TICK_GAP_HORZ;
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
                >
                    {tick.label}
                </text>
            );
        });

        return (
            <g
                ref={ref =>
                    ref &&
                    runInAction(() => {
                        const rect = ref!.getBBox();
                        this.props.axisController.labelTextsWidth = rect.width;
                        this.props.axisController.labelTextsHeight = rect.height;
                    })
                }
                className="EezStudio_ListChartView_Labels"
            >
                {labels}
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class AxisScrollBar extends React.Component<{ axisController: AxisController }, {}> {
    div: HTMLDivElement | null;

    get from() {
        return Math.min(this.props.axisController.minValue, this.props.axisController.from);
    }

    get to() {
        return Math.max(this.props.axisController.maxValue, this.props.axisController.to);
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
                const oldScrollPosition = (axisController.from - this.from) * axisController.scale;

                if (Math.abs(newScrollPosition - oldScrollPosition) >= 1) {
                    axisController.panTo(this.from + newScrollPosition / axisController.scale);
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
                            (this.div.scrollHeight - this.div.clientHeight - newScrollPosition) /
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
                const newScrollPosition = (axisController.from - this.from) * axisController.scale;
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
                    ? chartsController.chartLeft - chartsController.minLeftMargin
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
            <foreignObject x={track.x} y={track.y} width={track.width} height={track.height}>
                <div ref={ref => (this.div = ref)} style={divStyle} onScroll={this.onScroll}>
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
            y1 = chartsController.xAxisHeight - SCROLL_BAR_SIZE - ZOOM_ICON_SIZE;
        } else if (axisController.position === "y") {
            x1 = chartsController.chartLeft - chartsController.minLeftMargin + SCROLL_BAR_SIZE;
            y1 = chartsController.chartBottom - 3 * ZOOM_ICON_SIZE / 2;
        } else {
            x1 =
                chartsController.chartRight +
                chartsController.minRightMargin -
                ZOOM_ICON_SIZE -
                SCROLL_BAR_SIZE;
            y1 = chartsController.chartBottom - 3 * ZOOM_ICON_SIZE / 2;
        }

        let x2;
        let y2;

        if (axisController.position === "x") {
            x2 = chartsController.chartRight - 3 * ZOOM_ICON_SIZE / 2;
            y2 = y1;
        } else if (axisController.position === "y") {
            x2 = x1;
            y2 = chartsController.chartBottom - (chartsController.chartHeight - ZOOM_ICON_SIZE / 2);
        } else {
            x2 = x1;
            y2 = chartsController.chartBottom - (chartsController.chartHeight - ZOOM_ICON_SIZE / 2);
        }

        return (
            <g>
                {axisController.position !== "x" && <AxisLines axisController={axisController} />}
                {chartsController.viewOptions.showAxisLabels &&
                    (chartsController.viewOptions.axesLines.type === "dynamic" ||
                        !axisController.isAnimationActive) && (
                        <AxisLabels axisController={axisController} />
                    )}

                {chartsController.areZoomButtonsVisible &&
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

                <AxisScrollBar axisController={axisController} />
            </g>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface MouseHandler {
    cursor: string;
    down(point: SVGPoint, event: PointerEvent): void;
    move(point: SVGPoint, event: PointerEvent): void;
    up(point: SVGPoint | undefined, event: PointerEvent | undefined, cancel: boolean): void;
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

    lastPoint: Point;

    cursor: "default";

    down(point: SVGPoint, event: PointerEvent) {
        this.lastPoint = point;
    }

    @action
    move(point: SVGPoint, event: PointerEvent) {
        let dx = this.lastPoint.x - point.x;
        this.axes[0].panByDistanceInPx(dx);

        let dy = this.lastPoint.y - point.y;
        for (let i = 1; i < this.axes.length; ++i) {
            this.axes[i].panByDistanceInPx(dy);
        }

        this.lastPoint = point;
    }

    up(point: SVGPoint | undefined, event: PointerEvent | undefined, cancel: boolean) {}

    updateCursor(event: PointerEvent | undefined, cursor: ICursor) {
        cursor.visible = false;
    }

    render() {
        return null;
    }
}

class ZoomToRectMouseHandler implements MouseHandler {
    constructor(private chartController: ChartController) {}

    @observable startPoint: Point;
    @observable endPoint: Point;
    @observable orientation: "x" | "y" | "both" | undefined = undefined;

    cursor: "default";

    clamp(point: SVGPoint) {
        return {
            x: clamp(point.x, 0, this.chartController.xAxisController.distancePx),
            y: clamp(point.y, 0, this.chartController.yAxisController.distancePx)
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

        const THRESHOLD = CONF_ZOOM_TO_RECT_ORIENTATION_DETECTION_THRESHOLD;

        if (!this.orientation) {
            if (
                this.chartController.yAxisControllerOnRightSide ||
                (width > 4 * THRESHOLD && height < THRESHOLD)
            ) {
                this.orientation = "x";
            } else if (height > 4 * THRESHOLD && width < THRESHOLD) {
                this.orientation = "y";
            } else if (height > THRESHOLD && width > THRESHOLD) {
                this.orientation = "both";
            }
        }
    }

    up(point: SVGPoint | undefined, event: PointerEvent | undefined, cancel: boolean) {
        if (cancel) {
            return;
        }

        const chartsController = this.chartController.chartsController;

        if (this.orientation === "x" || this.orientation === "both") {
            const xAxisController = chartsController.xAxisController;
            let fromPx = Math.min(this.startPoint.x, this.endPoint.x);
            let toPx = Math.max(this.startPoint.x, this.endPoint.x);
            xAxisController.zoom(
                xAxisController.pxToValue(fromPx),
                xAxisController.pxToValue(toPx)
            );
        }

        if (this.orientation === "y" || this.orientation === "both") {
            const yAxisController = this.chartController.yAxisController;
            let fromPx = Math.min(this.startPoint.y, this.endPoint.y);
            let toPx = Math.max(this.startPoint.y, this.endPoint.y);
            yAxisController.zoom(
                yAxisController.pxToValue(fromPx),
                yAxisController.pxToValue(toPx)
            );
        }
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
        } else if (this.orientation === "y") {
            x = 0;
            width = chartsController.chartWidth;
        }

        return (
            <rect
                className="EezStudio_ZoomRectangle"
                x={chartsController.chartLeft + x}
                y={chartsController.chartBottom - y}
                width={width}
                height={height}
            />
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
}

@observer
class CursorPopover extends React.Component<{ cursor: ICursor }, {}> {
    render() {
        const { cursor } = this.props;

        const time = cursor.lineController.yAxisController.chartsController.xAxisController.unit.formatValue(
            cursor.time
        );
        const value = cursor.lineController.yAxisController.unit.formatValue(cursor.value);

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
    @observable time: number;
    @observable value: number;
    @observable valueIndex: number;
    @observable addPoint: boolean;
    @observable error: string | undefined;
    cursorElement: EventTarget | null;
    cursorPopover: any;

    constructor(private chartView: ChartView) {}

    get xAxisController() {
        return this.chartView.props.chartController.xAxisController;
    }

    get yAxisController() {
        return this.lineController.yAxisController;
    }

    updateCursor(point: Point | undefined, event: PointerEvent | undefined) {
        this.visible = false;

        const { chartWidth, chartHeight } = this.chartView.props.chartController.chartsController;
        if (
            !point ||
            !event ||
            (point.x < 0 || point.x > chartWidth || point.y < 0 || point.y > chartHeight)
        ) {
            return;
        }

        const cursors = this.chartView.props.chartController.lineControllers.map(lineController => {
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
        });

        let minDistance = 0;
        let minDistanceIndex: number = -1;
        cursors.forEach((cursor, i) => {
            if (cursor.visible) {
                const lineController = this.chartView.props.chartController.lineControllers[i];
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
        }

        if (!this.visible) {
            this.hidePopover();
        }
    }

    @action
    onMouseEvent(event: PointerEvent | undefined, mouseHandler: MouseHandler | undefined) {
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

    @bind
    onPointerMove(event: PointerEvent) {
        if (
            event.target instanceof Element &&
            !$.contains(this.chartView.svg, event.target) &&
            event.target != this.chartView.svg &&
            !$(event.target).closest(".popover").length
        ) {
            this.hidePopover();
        }
    }

    showPopover() {
        if (this.cursorElement) {
            let content = document.createElement("div");
            ReactDOM.render(<CursorPopover cursor={this} />, content);
            this.cursorPopover = $(this.cursorElement)
                .popover({
                    content,
                    html: true,
                    placement: "top",
                    delay: {
                        show: 0,
                        hide: 0
                    },
                    trigger: "manual"
                })
                .popover("show");
            this.cursorPopover.css("pointer-events", "none");
            window.addEventListener("pointermove", this.onPointerMove, true);
        }
    }

    @action
    hidePopover() {
        this.visible = false;
        if (this.cursorPopover) {
            window.removeEventListener("pointermove", this.onPointerMove, true);
            this.cursorPopover.popover("dispose");
            this.cursorPopover = undefined;
        }
    }

    update() {
        if (this.cursorElement) {
            if (this.cursorPopover) {
                this.cursorPopover.popover("update");
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
                    this.lineController.yAxisController.chartsController.chartLeft +
                        this.xAxisController.valueToPx(this.time)
                ) + 0.5,
            y:
                Math.round(
                    this.lineController.yAxisController.chartsController.chartBottom -
                        this.yAxisController.valueToPx(this.value)
                ) + 0.5
        };

        const className = classNames("EezStudio_ListChartView_Cursor", {
            EezStudio_ListChartView_Cursor_AddPoint: this.addPoint,
            error: !!this.error
        });

        return (
            <g className={className}>
                <circle
                    ref={ref => (this.cursorElement = ref)}
                    cx={point.x}
                    cy={point.y}
                    r={CONF_CURSOR_RADIUS}
                    fill={this.yAxisController.axisModel.color}
                    stroke={this.yAxisController.axisModel.color}
                />
                {this.addPoint && (
                    <React.Fragment>
                        <rect
                            x={point.x - CONF_CURSOR_RADIUS / 8}
                            y={point.y - CONF_CURSOR_RADIUS * 2 / 3}
                            width={CONF_CURSOR_RADIUS / 4}
                            height={CONF_CURSOR_RADIUS * 4 / 3}
                            fill={this.yAxisController.axisModel.color}
                        />
                        <rect
                            x={point.x - CONF_CURSOR_RADIUS * 2 / 3}
                            y={point.y - CONF_CURSOR_RADIUS / 8}
                            width={CONF_CURSOR_RADIUS * 4 / 3}
                            height={CONF_CURSOR_RADIUS / 4}
                            fill={this.yAxisController.axisModel.color}
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

export type ChartMode = "preview" | "interactive" | "editable";

@observer
export class ChartView extends React.Component<
    {
        chartController: ChartController;
        mode: ChartMode;
    },
    {}
> {
    svg: SVGSVGElement;
    deltaY: number = 0;
    cursor = new Cursor(this);
    @observable mouseHandler: MouseHandler | undefined;

    draggable = new Draggable(this);

    transformEventPoint(event: { clientX: number; clientY: number }) {
        let point = this.svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        point = point.matrixTransform(this.svg.getScreenCTM()!.inverse());
        point.x -= this.props.chartController.chartsController.chartLeft;
        point.y = this.props.chartController.chartsController.chartBottom - point.y;
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
                if (axisController.isScrollBarEnabled) {
                    runInAction(() => {
                        axisController.panByDirection(this.deltaY < 0 ? 1 : -1);
                    });
                }
            }

            this.deltaY = 0;
        }
    }

    @action.bound
    onWheel(event: React.WheelEvent<SVGSVGElement>) {
        if (this.props.mode === "preview") {
            return;
        }

        event.preventDefault();
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
                    point.x < this.props.chartController.chartsController.chartWidth / 2
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

        if (event.buttons === 1) {
            if (this.cursor && this.cursor.visible && this.cursor.addPoint) {
                this.mouseHandler = this.cursor.lineController.addPoint(this, this.cursor);
            } else {
                this.mouseHandler = this.props.chartController.onDragStart(this, event);
            }
        } else {
            this.mouseHandler = new PanMouseHandler(this.props.chartController.axes);
        }

        if (this.mouseHandler) {
            this.mouseHandler.down(point, event);
        }

        this.cursor.onMouseEvent(event, this.mouseHandler);
    }

    @bind
    onDragMove(event: PointerEvent) {
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
    }

    @bind
    onMove(event: PointerEvent) {
        this.cursor.onMouseEvent(event, this.mouseHandler);
    }

    @action.bound
    onDragEnd(event: PointerEvent, cancel: boolean) {
        let point = event && this.transformEventPoint(event);
        if (this.mouseHandler) {
            this.mouseHandler.up(point, event, cancel);
            this.mouseHandler = undefined;
        }

        this.cursor.onMouseEvent(event, this.mouseHandler);
    }

    componentDidUpdate() {
        this.cursor.update();
    }

    componentWillUnmount() {
        if (this.mouseHandler) {
            this.mouseHandler.up(undefined, undefined, true);
        }
        this.cursor.unmount();
        this.draggable.attach(null);
    }

    render() {
        const { chartController } = this.props;
        const chartsController = chartController.chartsController;

        const color = globalViewOptions.blackBackground
            ? chartController.yAxisController.axisModel.color
            : chartController.yAxisController.axisModel.colorInverse;

        let chartTitle = (
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
                : chartController.yAxisControllerOnRightSide.axisModel.colorInverse;

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
                        {chartController.yAxisControllerOnRightSide.axisModel.label}
                    </div>
                </React.Fragment>
            );
        }

        const clipId = "c_" + guid();

        return (
            <div className="EezStudio_ChartContainer">
                <svg
                    className="EezStudio_Chart"
                    ref={ref => (this.svg = ref!)}
                    onWheel={this.onWheel}
                >
                    {chartController.customRender()}

                    {<AxisLines axisController={chartController.xAxisController} />}
                    {<AxisView axisController={chartController.yAxisController} />}
                    {chartController.yAxisControllerOnRightSide && (
                        <AxisView axisController={chartController.yAxisControllerOnRightSide} />
                    )}
                    <ChartBorder chartsController={chartController.chartsController} />

                    <defs>
                        <clipPath id={clipId}>
                            <rect
                                x={chartsController.chartLeft}
                                y={chartsController.chartTop}
                                width={chartsController.chartWidth}
                                height={chartsController.chartHeight}
                            />
                        </clipPath>
                    </defs>

                    <g
                        ref={ref => this.draggable.attach(ref)}
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
                            chartController.lineControllers.map(lineController =>
                                lineController.render(clipId)
                            )}

                        {this.cursor.render()}

                        {this.mouseHandler && this.mouseHandler.render()}
                    </g>
                </svg>
                {chartTitle}
            </div>
        );
    }
}

interface ChartsViewInterface {
    chartsController: ChartsController;
    className?: string;
    tabIndex?: number;
}

@observer
export class ChartsView extends React.Component<ChartsViewInterface, {}> {
    animationFrameRequestId: any;
    div: HTMLDivElement | null;

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
                (chartViewWidth && chartViewWidth != chartsController.chartViewWidth) ||
                (chartViewHeight && chartViewHeight != chartsController.chartViewHeight)
            ) {
                chartsController.chartViewWidth = chartViewWidth;
                chartsController.chartViewHeight = chartViewHeight;
            }
        }
    }

    @bind
    frameAnimation() {
        this.adjustSize();

        const chartsController = this.props.chartsController;

        chartsController.xAxisController.animationController.frameAnimation();

        chartsController.chartControllers.forEach(chartController => {
            chartController.yAxisController.animationController.frameAnimation();
            if (chartController.yAxisControllerOnRightSide) {
                chartController.yAxisControllerOnRightSide.animationController.frameAnimation();
            }
        });

        this.animationFrameRequestId = window.requestAnimationFrame(this.frameAnimation);
    }

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

    render() {
        const chartsController = this.props.chartsController;
        const mode = chartsController.mode;

        const className = classNames(
            "EezStudio_ListChartView",
            `EezStudio_ListChartView_${capitalize(mode)}`,
            this.props.className,
            {
                EezStudio_ListChartView_BlackBackground: globalViewOptions.blackBackground
            }
        );

        const charts = chartsController.chartControllers.map(chartController => (
            <ChartView
                ref={ref => runInAction(() => (chartController.chartView = ref!))}
                key={chartController.id}
                chartController={chartController}
                mode={mode}
            />
        ));

        return (
            <div
                ref={ref => (this.div = ref)}
                className={className}
                onKeyDown={this.onKeyDown}
                tabIndex={this.props.tabIndex}
            >
                {charts}
                <svg className="EezStudio_Chart_XAxis" height={chartsController.xAxisHeight}>
                    <AxisView axisController={chartsController.xAxisController} />
                </svg>
            </div>
        );
    }
}
