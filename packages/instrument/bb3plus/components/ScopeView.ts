import { clipboard, nativeImage } from "electron";

import * as notification from "eez-studio-ui/notification";
import { MIME_EEZ_DLOG } from "instrument/connection/file-type";
import {
    activityLogStore,
    log
} from "instrument/window/history/activity-log";
import { Unit as DlogUnit } from "instrument/window/waveform/dlog-file";

import {
    BB3PlusInstrument,
    ScopeTrace,
    ScopeAxisSettings,
    ScopeCapture
} from "instrument/bb3plus/BB3PlusInstrument";
import { SampleBuffer, SampleStats } from "instrument/bb3plus/sample-buffer";
import { getUnitName, formatNumber } from "instrument/bb3plus/fields-model";
import { encodeDlog, DlogColumn } from "instrument/bb3plus/dlog-writer";
import { getStatsOptions } from "instrument/bb3plus/scope-measurements";
import { h, BB3PlusView } from "instrument/bb3plus/components/dom";
import {
    Axis,
    Range,
    getFullRange,
    TRIGGER_COLOR_DARK,
    TRIGGER_COLOR_LIGHT,
    formatRate,
    formatTime,
    withSign,
    getTimeUnit,
    getTickStep,
    getStepAtLeast,
    getNextStep,
    getTicksWithStep,
    clamp,
    getAxes,
    getAxisTitle
} from "instrument/bb3plus/components/scope-common";
import {
    ScopeToolbar,
    ScopeChannels,
    ScopeSidePanel,
    ScopeMeasureBar
} from "instrument/bb3plus/components/scope-panels";

const AXIS_WIDTH = 58;
// the time labels and their unit under them
const TIME_AXIS_HEIGHT = 34;
// above each plot: the titles of its axes
const PLOT_GAP = 20;
const TOP_MARGIN = 20;
// without an axis on that side
const LEFT_MARGIN = 12;
const RIGHT_MARGIN = 12;
const FONT = "11px Roboto, sans-serif";
const TITLE_FONT = "600 11px Roboto, sans-serif";

const TRACE_LINE_WIDTH = 1.5;

// The samples are drawn as points when they are at least this far apart
// (px); closer they are a line (points would merge into a thick line
// anyway). The radius of a point. Between the points a thin faint line (the
// steps of a bit field), the width and the opacity.
const POINTS_MIN_SPACING = 6;
const POINT_RADIUS = 2.5;
const POINTS_LINE_WIDTH = 1;
const POINTS_LINE_ALPHA = 0.4;

// the trigger level line and the trigger point line are dragged within this
// distance (px); the tag "T" of the level line (px)
const LEVEL_HIT_DISTANCE = 4;
const LEVEL_TAG_SIZE = 14;

// the samples of a trace that is not in the capture shown (added after it)
const EMPTY_BUFFER = new SampleBuffer();

// The readout box at the cursor is at least as wide as these (in its
// monospace font), so it doesn't jump as the digits change: a value with 6
// significant digits and a sign (formatNumber: all from 0.1 to 999999), a
// bit field value (0 - 255), a time with 4 significant digits (formatTime).
const READOUT_VALUE_TEMPLATE = "-0.000000";
const READOUT_BITS_TEMPLATE = "000";
const READOUT_TIME_TEMPLATE = "t = -000.0 ms";
// the readout box: dark on the light theme, raised on the dark theme
const READOUT_BACKGROUND_LIGHT = "rgba(28, 32, 38, 0.94)";
const READOUT_BACKGROUND_DARK = "rgba(62, 68, 76, 0.96)";
const READOUT_TEXT = "#f1f3f5";
const READOUT_MUTED_TEXT = "rgba(241, 243, 245, 0.7)";

// zoom factor per wheel notch and per zoom button
const WHEEL_ZOOM = 1.25;

// the shortest time window: this many samples of the fastest trace
const MIN_VIEW_SAMPLES = 10;
const MIN_VIEW_SPAN = 1e-5;

// a mouse move shorter than this (px) is not a drag
const DRAG_THRESHOLD = 4;

// the margin around the plot in a screenshot (px)
const CAPTURE_MARGIN = 10;

// the ranges shown in the scales panel are updated this often (ms)
const OPTIONS_UPDATE_INTERVAL = 500;
// the trigger status is updated this often (ms)
const TRIGGER_STATUS_INTERVAL = 100;
// the measurements are made again this often (ms), less often if they take
// longer than this part of the time (many samples in the window)
const MEASURE_INTERVAL = 250;
const MEASURE_MAX_LOAD = 0.1;

interface TracePoints {
    times: number[];
    values: number[];
    // the minimum and the maximum of each pixel column (or a NaN gap)
    envelope: boolean;
}

// a point at each sample (not at the NaN gaps)
function fillPoints(
    ctx: CanvasRenderingContext2D,
    points: TracePoints,
    timeToX: (time: number) => number,
    valueToY: (value: number) => number
) {
    ctx.beginPath();
    for (let i = 0; i < points.times.length; i++) {
        const value = points.values[i];
        if (isNaN(value)) {
            continue;
        }
        const x = timeToX(points.times[i]);
        const y = valueToY(value);
        ctx.moveTo(x + POINT_RADIUS, y);
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
    }
    ctx.fill();
}

// The envelope of a trace (SampleBuffer.getWindowPoints): a rectangle per
// pixel column from its minimum to its maximum. Rectangles are the cheapest
// to rasterize (a line or a polygon through the columns of a fast signal has
// thousands of steep antialiased edges, too slow for a large canvas). The
// columns are on whole device pixels (no seams between them), their tops and
// bottoms exact (antialiased) and a column at least as high as the trace
// line is wide, so the envelope looks as the line drawn when the samples are
// fewer (no jump in the thickness when the zoom crosses between them). Next
// columns that don't overlap (a steep signal, a step between them) both
// reach the middle of the gap between them, as a line through the samples
// would. The columns of the same height are one rectangle.
function fillEnvelope(
    ctx: CanvasRenderingContext2D,
    points: TracePoints,
    timeToX: (time: number) => number,
    valueToY: (value: number) => number,
    ratio: number
) {
    const { times, values } = points;
    const toPixel = (value: number) => Math.round(value * ratio) / ratio;
    const minHeight = TRACE_LINE_WIDTH;

    // the columns: x, top and bottom (NaN: a gap)
    const xs: number[] = [];
    const columnTops: number[] = [];
    const columnBottoms: number[] = [];
    let i = 0;
    while (i < values.length) {
        xs.push(toPixel(timeToX(times[i])));
        if (isNaN(values[i])) {
            columnTops.push(NaN);
            columnBottoms.push(NaN);
            i++;
            continue;
        }
        let top = valueToY(values[i + 1]);
        let bottom = valueToY(values[i]);
        if (bottom - top < minHeight) {
            const middle = (top + bottom) / 2;
            top = middle - minHeight / 2;
            bottom = middle + minHeight / 2;
        }
        columnTops.push(top);
        columnBottoms.push(bottom);
        i += 2;
    }

    const n = xs.length;

    // joined to the next columns (not across a NaN gap)
    const tops: number[] = [];
    const bottoms: number[] = [];
    for (let j = 0; j < n; j++) {
        let top = columnTops[j];
        let bottom = columnBottoms[j];
        for (let k = j - 1; k <= j + 1; k += 2) {
            if (k < 0 || k >= n || isNaN(columnTops[k])) {
                continue;
            }
            if (columnBottoms[k] < columnTops[j]) {
                // the next column is above
                top = Math.min(top, (columnBottoms[k] + columnTops[j]) / 2);
            } else if (columnTops[k] > columnBottoms[j]) {
                // below
                bottom = Math.max(
                    bottom,
                    (columnTops[k] + columnBottoms[j]) / 2
                );
            }
        }
        tops.push(top);
        bottoms.push(bottom);
    }

    let left = 0;
    let right = 0;
    let top = NaN;
    let bottom = NaN;
    for (let j = 0; j <= n; j++) {
        let columnRight = 0;
        if (j < n) {
            // to the next column, the last one as wide as the one before
            columnRight =
                j + 1 < n
                    ? xs[j + 1]
                    : xs[j] + (n > 1 ? xs[j] - xs[j - 1] : 1 / ratio);
            columnRight = Math.max(columnRight, xs[j] + 1 / ratio);
            if (tops[j] === top && bottoms[j] === bottom) {
                right = columnRight;
                continue;
            }
        }
        if (!isNaN(top)) {
            ctx.fillRect(left, top, right - left, bottom - top);
        }
        if (j < n) {
            left = xs[j];
            right = columnRight;
            top = tops[j];
            bottom = bottoms[j];
        }
    }
}

// where the plots and the axes were drawn, for the mouse
interface PlotLayout {
    top: number;
    bottom: number;
    axes: AxisLayout[];
}

interface AxisLayout {
    key: string;
    plot: PlotLayout;
    // the area of its tick labels
    x0: number;
    x1: number;
    min: number;
    max: number;
}

interface Layout {
    plotLeft: number;
    plotRight: number;
    window: TimeWindow;
    plots: PlotLayout[];
    axes: AxisLayout[];
    // the trigger level line (on the axis of the source), undefined if not
    // drawn
    triggerLevel: { axis: AxisLayout; y: number } | undefined;
    // the trigger point line (the pre-trigger), undefined if not drawn
    triggerPosition: { x: number } | undefined;
}

interface TimeWindow {
    start: number;
    end: number;
    span: number;
    // the time labels are relative to it: the newest sample, the stop time
    // or the trigger of the capture shown
    ref: number;
}

type Hit =
    | { kind: "axis"; axis: AxisLayout }
    | { kind: "level"; axis: AxisLayout }
    | { kind: "position"; plot: PlotLayout }
    | { kind: "plot"; plot: PlotLayout }
    | undefined;

type Drag =
    | {
          kind: "box";
          plot: PlotLayout;
          x0: number;
          y0: number;
          x1: number;
          y1: number;
      }
    | {
          kind: "move";
          plot: PlotLayout;
          x0: number;
          y0: number;
          window: TimeWindow;
          ranges: Range[];
          movedTime: boolean;
          movedValues: boolean;
          before: ZoomState;
      }
    | {
          kind: "axis";
          axis: AxisLayout;
          y0: number;
          range: Range;
          before: ZoomState;
      }
    | {
          // the trigger level line, Esc goes back to the level before
          kind: "level";
          axis: AxisLayout;
          before: number;
      }
    | {
          // the trigger point line: the seconds before the trigger at the
          // start (of the window of full seconds), Esc goes back to the
          // pre-trigger before
          kind: "position";
          x0: number;
          pre0: number;
          full: number;
          before: number;
      };

// the zoom before a drag, Esc goes back to it
interface ZoomState {
    axes: { [key: string]: ScopeAxisSettings };
    viewSpan: number | undefined;
    viewEnd: number | undefined;
}

// the min and the max of the values of the traces of the axis, undefined if
// there are none
function getDataRange(axis: Axis, points: Map<ScopeTrace, TracePoints>) {
    let min = Infinity;
    let max = -Infinity;
    for (const trace of axis.traces) {
        const tracePoints = points.get(trace);
        if (!tracePoints) {
            continue;
        }
        for (const value of tracePoints.values) {
            if (value < min) {
                min = value;
            }
            if (value > max) {
                max = value;
            }
        }
    }
    return min > max ? undefined : { min, max };
}

// padded a bit and out to whole tick steps, so an auto range doesn't change
// at every small change of the values
function getNiceRange(min: number, max: number, ticks: number) {
    if (min == max) {
        const delta = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 0.5;
        min -= delta;
        max += delta;
    } else {
        const padding = (max - min) * 0.05;
        min -= padding;
        max += padding;
    }
    const step = getTickStep(min, max, ticks);
    return {
        min: Math.floor(min / step) * step,
        max: Math.ceil(max / step) * step
    };
}

// The range of an axis to fit to (getTargetRange): fixed or full as they are,
// auto and grow (nice) padded and out to whole steps.
interface TargetRange extends Range {
    nice: boolean;
}

// A range for the target on the grid of the primary axis of the plot: its
// ticks (a 1, 2, 5 step) on the lines of the grid, the smallest step with
// which the target fits, the target as near the middle as the ticks allow.
function alignRange(
    target: TargetRange,
    primary: Range & { step: number }
): Range & { step: number } {
    let { min, max } = target;
    if (target.nice) {
        if (min == max) {
            const delta = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 0.5;
            min -= delta;
            max += delta;
        } else {
            const padding = (max - min) * 0.05;
            min -= padding;
            max += padding;
        }
    }
    const primarySpan = primary.max - primary.min;
    // the parts of the height: a step of the grid, to its first line
    const stepPart = primary.step / primarySpan;
    const firstPart =
        (Math.ceil(primary.min / primary.step - 1e-9) * primary.step -
            primary.min) /
        primarySpan;
    let step = getStepAtLeast((max - min) * stepPart);
    for (let i = 0; i < 20; i++) {
        const span = step / stepPart;
        // the tick k * step on the first line of the grid: the range from
        // k * step - firstPart * span, the k with which the target fits
        // (from the highest k the bottom fits to the lowest the top fits),
        // the one nearest the middle
        const kHigh = Math.floor((min + firstPart * span) / step + 1e-9);
        const kLow = Math.ceil((max - span + firstPart * span) / step - 1e-9);
        if (kLow <= kHigh) {
            const kMiddle = Math.round(
                ((min + max) / 2 + firstPart * span - span / 2) / step
            );
            const k = clamp(kMiddle, kLow, kHigh);
            const alignedMin = k * step - firstPart * span;
            return { min: alignedMin, max: alignedMin + span, step };
        }
        step = getNextStep(step);
    }
    return { min, max, step: getTickStep(min, max, 1 / stepPart) };
}

// a small padlock (8 x 10 px) at x, y with the fill color
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x + 4, y + 4, 2.5, Math.PI, 0);
    ctx.lineTo(x + 6.5, y + 5);
    ctx.moveTo(x + 1.5, y + 5);
    ctx.lineTo(x + 1.5, y + 4);
    ctx.stroke();
    ctx.fillRect(x, y + 5, 8, 5);
    ctx.restore();
}

// the traces drawn on a canvas, again at each animation frame while the
// scope runs, and the zoom with the mouse
export class ScopeCanvas {
    container: HTMLDivElement;
    canvas: HTMLCanvasElement;
    private animationFrame: number | undefined;
    private resizeObserver: ResizeObserver;
    // drawn again at the next frame while stopped
    private needsDraw = true;
    // the mouse in the canvas (CSS pixels), undefined if outside
    private mouse: { x: number; y: number } | undefined;
    private drag: Drag | undefined;
    private dragPointerId: number | undefined;
    // the end of the time window drawn last and the seconds of a pixel,
    // undefined if nothing was drawn
    private lastDraw: { end: number; secondsPerPixel: number } | undefined;
    // the capture of the trigger drawn last, undefined if none
    private lastDrawCapture: ScopeCapture | undefined;
    private layout: Layout | undefined;
    // the widths of the time and of the values in the readout box while it
    // is shown (they only grow), for the traces and the size of key
    private readoutWidths:
        | { key: string; header: number; value: number }
        | undefined;
    // the ranges of the "grow" axes
    private growRanges = new Map<string, Range>();

    // The steps of the grid drawn last (the seconds and the values of a
    // division): of the time, of each Y axis drawn (by its key);
    // onScaleChange is called after a draw that changed them.
    scale: { time: number; axes: Map<string, number> } = {
        time: 0,
        axes: new Map()
    };
    private scaleKey = "";
    onScaleChange: (() => void) | undefined;

    constructor(private bb3PlusInstrument: BB3PlusInstrument) {
        this.canvas = h("canvas");
        this.container = h(
            "div",
            {
                className: "EezStudio_BB3Plus_ScopeCanvas",
                onpointerdown: (event: PointerEvent) =>
                    this.onPointerDown(event),
                onpointermove: (event: PointerEvent) =>
                    this.onPointerMove(event),
                onpointerup: () => this.onPointerUp(),
                onpointercancel: () => this.endDrag(),
                onpointerleave: () => {
                    this.mouse = undefined;
                    this.invalidate();
                },
                ondblclick: (event: MouseEvent) => this.onDoubleClick(event),
                oncontextmenu: (event: MouseEvent) => event.preventDefault()
            },
            this.canvas
        );
        this.container.addEventListener("wheel", event => this.onWheel(event), {
            passive: false
        });
        this.resizeObserver = new ResizeObserver(() => this.invalidate());
        this.resizeObserver.observe(this.container);
        this.animationFrame = requestAnimationFrame(this.tick);
    }

    destroy() {
        if (this.animationFrame != undefined) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = undefined;
        }
        this.resizeObserver.disconnect();
        document.removeEventListener("keydown", this.onKeyDown, true);
    }

    invalidate() {
        this.needsDraw = true;
    }

    private tick = () => {
        this.animationFrame = requestAnimationFrame(this.tick);
        if (this.container.clientWidth == 0) {
            // hidden
            this.needsDraw = true;
            return;
        }
        if (!this.needsDraw) {
            if (!this.bb3PlusInstrument.scopeRunning) {
                return;
            }
            const capture = this.bb3PlusInstrument.scopeShownCapture;
            if (capture != this.lastDrawCapture) {
                // another capture or back to the samples as they come (Auto)
            } else if (capture) {
                // the capture stays
                return;
            } else {
                // running: again when the window moved by a pixel (a long
                // span moves less than a pixel per frame)
                const lastDraw = this.lastDraw;
                if (
                    lastDraw &&
                    Math.abs(
                        this.bb3PlusInstrument.getNewestSampleTime() -
                            lastDraw.end
                    ) < lastDraw.secondsPerPixel
                ) {
                    return;
                }
            }
        }
        this.needsDraw = false;
        this.draw();
    };

    ////////////////////////////////////////////////////////////////////////////
    // zoom

    // the samples of the trace shown: of the capture of the trigger shown,
    // else as they come
    bufferOf(
        trace: ScopeTrace,
        capture = this.bb3PlusInstrument.scopeShownCapture
    ) {
        return capture
            ? (capture.buffers.get(trace) ?? EMPTY_BUFFER)
            : trace.buffer;
    }

    // The whole window that can be shown: the window of the capture shown
    // (the time labels from the trigger), else the span up to the newest
    // sample (running) or up to the stop time.
    private getFullWindow(capture: ScopeCapture | undefined) {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        if (capture) {
            return {
                start: capture.time - capture.pre,
                end: capture.time + capture.post,
                ref: capture.time
            };
        }
        const ref = bb3PlusInstrument.scopeRunning
            ? bb3PlusInstrument.getNewestSampleTime()
            : bb3PlusInstrument.scopeStopTime;
        return { start: ref - bb3PlusInstrument.scopeSpan, end: ref, ref };
    }

    // The time window shown: the whole window or its zoom. The zoom ends at
    // the end set while stopped, else at the newest sample (running) or the
    // stop time; in a capture it keeps the trigger at its place.
    getTimeWindow(
        capture = this.bb3PlusInstrument.scopeShownCapture
    ): TimeWindow {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const window = this.getFullWindow(capture);
        const full = window.end - window.start;
        const span = Math.min(bb3PlusInstrument.scopeViewSpan ?? full, full);
        let end = window.end;
        if (bb3PlusInstrument.scopeViewEnd != undefined) {
            end = bb3PlusInstrument.scopeViewEnd;
        } else if (capture) {
            end = capture.time + span * (capture.post / full);
        }
        end = clamp(end, window.start + span, window.end);
        return { start: end - span, end, span, ref: window.ref };
    }

    private getMinViewSpan() {
        let period = 0;
        for (const trace of this.bb3PlusInstrument.traces) {
            const tracePeriod = this.bufferOf(trace).period;
            if (tracePeriod > 0 && (period == 0 || tracePeriod < period)) {
                period = tracePeriod;
            }
        }
        return Math.max(MIN_VIEW_SPAN, period * MIN_VIEW_SAMPLES);
    }

    // a time window of span seconds ending at end (while stopped)
    private setTimeWindow(span: number, end: number | undefined) {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const window = this.getFullWindow(bb3PlusInstrument.scopeShownCapture);
        const full = window.end - window.start;
        span = clamp(span, this.getMinViewSpan(), full);
        if (span >= full * 0.999) {
            bb3PlusInstrument.setScopeView(undefined, undefined);
            return;
        }
        if (end != undefined) {
            end = clamp(end, window.start + span, window.end);
        }
        bb3PlusInstrument.setScopeView(span, end);
    }

    // factor < 1 zooms in; the time at the anchor stays where it is (while
    // running the window ends at the newest sample)
    zoomTime(factor: number, anchor?: number) {
        const timeWindow = this.getTimeWindow();
        const span = timeWindow.span * factor;
        if (this.bb3PlusInstrument.scopeRunning) {
            this.setTimeWindow(span, undefined);
            return;
        }
        if (anchor == undefined) {
            anchor = (timeWindow.start + timeWindow.end) / 2;
        }
        const position = (anchor - timeWindow.start) / timeWindow.span;
        this.setTimeWindow(span, anchor - position * span + span);
    }

    private zoomAxis(axis: AxisLayout, factor: number, anchor: number) {
        this.bb3PlusInstrument.setScopeAxis(axis.key, {
            mode: "fixed",
            min: anchor - (anchor - axis.min) * factor,
            max: anchor + (axis.max - anchor) * factor
        });
    }

    resetZoom() {
        this.bb3PlusInstrument.setScopeView(undefined, undefined);
        this.bb3PlusInstrument.resetScopeAxes();
        this.growRanges.clear();
    }

    restartGrow(key: string) {
        this.growRanges.delete(key);
        this.invalidate();
    }

    // the range drawn last, undefined if the axis is not drawn
    getAxisRange(key: string): Range | undefined {
        const axis = this.layout?.axes.find(axis => axis.key == key);
        return axis ? { min: axis.min, max: axis.max } : undefined;
    }

    ////////////////////////////////////////////////////////////////////////////
    // mouse

    private getMousePosition(event: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    private hitTest(x: number, y: number): Hit {
        const layout = this.layout;
        if (!layout) {
            return undefined;
        }
        for (const axis of layout.axes) {
            if (
                x >= axis.x0 &&
                x < axis.x1 &&
                y >= axis.plot.top &&
                y <= axis.plot.bottom
            ) {
                return { kind: "axis", axis };
            }
        }
        const level = layout.triggerLevel;
        if (
            level &&
            x >= layout.plotLeft &&
            x <= layout.plotRight &&
            Math.abs(y - level.y) <= LEVEL_HIT_DISTANCE
        ) {
            return { kind: "level", axis: level.axis };
        }
        const position = layout.triggerPosition;
        if (position && Math.abs(x - position.x) <= LEVEL_HIT_DISTANCE) {
            for (const plot of layout.plots) {
                if (y >= plot.top && y <= plot.bottom) {
                    return { kind: "position", plot };
                }
            }
        }
        if (x >= layout.plotLeft && x <= layout.plotRight) {
            for (const plot of layout.plots) {
                if (y >= plot.top && y <= plot.bottom) {
                    return { kind: "plot", plot };
                }
            }
        }
        return undefined;
    }

    private xToTime(x: number) {
        const layout = this.layout!;
        const { start, span } = layout.window;
        return (
            start +
            ((x - layout.plotLeft) / (layout.plotRight - layout.plotLeft)) *
                span
        );
    }

    private yToValue(
        axis: { min: number; max: number },
        plot: PlotLayout,
        y: number
    ) {
        return (
            axis.min +
            ((plot.bottom - y) / (plot.bottom - plot.top)) *
                (axis.max - axis.min)
        );
    }

    private onPointerDown(event: PointerEvent) {
        const { x, y } = this.getMousePosition(event);
        const hit = this.hitTest(x, y);
        if (!hit) {
            return;
        }
        if (hit.kind == "axis") {
            this.drag = {
                kind: "axis",
                axis: hit.axis,
                y0: y,
                range: { min: hit.axis.min, max: hit.axis.max },
                before: this.getZoomState()
            };
            // the level line with the left button, else as the plot
        } else if (
            hit.kind == "level" &&
            event.button == 0 &&
            !event.shiftKey
        ) {
            this.drag = {
                kind: "level",
                axis: hit.axis,
                before: this.bb3PlusInstrument.settings.scopeTriggerLevel
            };
        } else if (
            hit.kind == "position" &&
            event.button == 0 &&
            !event.shiftKey
        ) {
            const bb3PlusInstrument = this.bb3PlusInstrument;
            const position = bb3PlusInstrument.settings.scopeTriggerPosition;
            const capture = bb3PlusInstrument.scopeShownCapture;
            const full = capture
                ? capture.pre + capture.post
                : bb3PlusInstrument.scopeSpan;
            this.drag = {
                kind: "position",
                x0: x,
                pre0: capture ? capture.pre : full * position,
                full,
                before: position
            };
            // the window follows the trigger (not a place moved to while
            // stopped), so the line follows the mouse
            if (bb3PlusInstrument.scopeViewEnd != undefined) {
                bb3PlusInstrument.setScopeView(
                    bb3PlusInstrument.scopeViewSpan,
                    undefined
                );
            }
        } else if (event.shiftKey || event.button == 1 || event.button == 2) {
            const plot = hit.kind == "level" ? hit.axis.plot : hit.plot;
            this.drag = {
                // (a hit on the trigger point line moves the plot too)
                kind: "move",
                plot,
                x0: x,
                y0: y,
                window: this.getTimeWindow(),
                ranges: plot.axes.map(axis => ({
                    min: axis.min,
                    max: axis.max
                })),
                movedTime: false,
                movedValues: false,
                before: this.getZoomState()
            };
        } else if (event.button == 0 && hit.kind != "level") {
            this.drag = {
                kind: "box",
                plot: hit.plot,
                x0: x,
                y0: y,
                x1: x,
                y1: y
            };
        } else {
            return;
        }
        // the drag continues outside the canvas
        this.dragPointerId = event.pointerId;
        try {
            this.container.setPointerCapture(event.pointerId);
        } catch (err) {
            // not an active pointer
        }
        document.addEventListener("keydown", this.onKeyDown, true);
        event.preventDefault();
        this.invalidate();
    }

    private getZoomState(): ZoomState {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        return {
            axes: bb3PlusInstrument.settings.scopeAxes,
            viewSpan: bb3PlusInstrument.scopeViewSpan,
            viewEnd: bb3PlusInstrument.scopeViewEnd
        };
    }

    // the drag ended or was canceled
    private endDrag() {
        this.drag = undefined;
        document.removeEventListener("keydown", this.onKeyDown, true);
        if (
            this.dragPointerId != undefined &&
            this.container.hasPointerCapture(this.dragPointerId)
        ) {
            this.container.releasePointerCapture(this.dragPointerId);
        }
        this.dragPointerId = undefined;
        this.container.style.cursor = "";
        this.invalidate();
    }

    // Esc cancels the drag: no box zoom, the moves go back
    private onKeyDown = (event: KeyboardEvent) => {
        const drag = this.drag;
        if (event.key != "Escape" || !drag) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.endDrag();
        if (drag.kind == "level") {
            this.bb3PlusInstrument.setScopeTriggerLevel(drag.before);
        } else if (drag.kind == "position") {
            this.bb3PlusInstrument.setScopeTriggerPosition(drag.before);
        } else if (drag.kind != "box") {
            this.bb3PlusInstrument.setScopeAxes(drag.before.axes);
            this.bb3PlusInstrument.setScopeView(
                drag.before.viewSpan,
                drag.before.viewEnd
            );
        }
    };

    private onPointerMove(event: PointerEvent) {
        const { x, y } = this.getMousePosition(event);
        this.mouse = { x, y };
        this.invalidate();

        const drag = this.drag;
        if (!drag) {
            const hit = this.hitTest(x, y);
            this.container.style.cursor =
                hit?.kind == "axis" || hit?.kind == "level"
                    ? "ns-resize"
                    : hit?.kind == "position"
                      ? "ew-resize"
                      : hit?.kind == "plot"
                        ? "crosshair"
                        : "";
            return;
        }

        if (drag.kind == "box") {
            drag.x1 = x;
            drag.y1 = y;
        } else if (drag.kind == "position") {
            // the trigger is at pre / full of the plot width (also zoomed,
            // see getTimeWindow)
            const layout = this.layout!;
            const pre =
                drag.pre0 +
                ((x - drag.x0) / (layout.plotRight - layout.plotLeft)) *
                    drag.full;
            this.bb3PlusInstrument.setScopeTriggerPosition(pre / drag.full);
        } else if (drag.kind == "level") {
            this.bb3PlusInstrument.setScopeTriggerLevel(
                this.yToValue(drag.axis, drag.axis.plot, y)
            );
        } else if (drag.kind == "axis") {
            const height = drag.axis.plot.bottom - drag.axis.plot.top;
            const delta =
                ((y - drag.y0) / height) * (drag.range.max - drag.range.min);
            this.bb3PlusInstrument.setScopeAxis(drag.axis.key, {
                mode: "fixed",
                min: drag.range.min + delta,
                max: drag.range.max + delta
            });
        } else {
            this.container.style.cursor = "grabbing";
            const layout = this.layout!;
            // the time while stopped, the window ends at the newest sample
            // while running
            if (
                !this.bb3PlusInstrument.scopeRunning &&
                (drag.movedTime || Math.abs(x - drag.x0) > DRAG_THRESHOLD)
            ) {
                drag.movedTime = true;
                const dt =
                    ((drag.x0 - x) / (layout.plotRight - layout.plotLeft)) *
                    drag.window.span;
                this.setTimeWindow(drag.window.span, drag.window.end + dt);
            }
            if (drag.movedValues || Math.abs(y - drag.y0) > DRAG_THRESHOLD) {
                drag.movedValues = true;
                const height = drag.plot.bottom - drag.plot.top;
                drag.plot.axes.forEach((axis, i) => {
                    const range = drag.ranges[i];
                    const delta =
                        ((y - drag.y0) / height) * (range.max - range.min);
                    this.bb3PlusInstrument.setScopeAxis(axis.key, {
                        mode: "fixed",
                        min: range.min + delta,
                        max: range.max + delta
                    });
                });
            }
        }
    }

    private onPointerUp() {
        const drag = this.drag;
        if (!drag) {
            return;
        }
        this.endDrag();
        if (drag.kind != "box") {
            return;
        }

        const layout = this.layout!;
        const plot = drag.plot;
        const dx = Math.abs(drag.x1 - drag.x0);
        const dy = Math.abs(drag.y1 - drag.y0);

        if (dx > DRAG_THRESHOLD) {
            const x0 = clamp(
                Math.min(drag.x0, drag.x1),
                layout.plotLeft,
                layout.plotRight
            );
            const x1 = clamp(
                Math.max(drag.x0, drag.x1),
                layout.plotLeft,
                layout.plotRight
            );
            const t0 = this.xToTime(x0);
            const t1 = this.xToTime(x1);
            // a part of the past: the scope stops
            if (this.bb3PlusInstrument.scopeRunning) {
                this.bb3PlusInstrument.setScopeRunning(false);
            }
            this.setTimeWindow(t1 - t0, t1);
        }

        if (dy > DRAG_THRESHOLD) {
            const y0 = clamp(Math.min(drag.y0, drag.y1), plot.top, plot.bottom);
            const y1 = clamp(Math.max(drag.y0, drag.y1), plot.top, plot.bottom);
            for (const axis of plot.axes) {
                const max = this.yToValue(axis, plot, y0);
                const min = this.yToValue(axis, plot, y1);
                if (max > min) {
                    this.bb3PlusInstrument.setScopeAxis(axis.key, {
                        mode: "fixed",
                        min,
                        max
                    });
                }
            }
        }
    }

    private onDoubleClick(event: MouseEvent) {
        const { x, y } = this.getMousePosition(event);
        const hit = this.hitTest(x, y);
        if (hit?.kind == "axis") {
            this.bb3PlusInstrument.resetScopeAxes([hit.axis.key]);
            this.growRanges.delete(hit.axis.key);
        } else if (hit) {
            this.resetZoom();
        }
    }

    private onWheel(event: WheelEvent) {
        const { x, y } = this.getMousePosition(event);
        const hit = this.hitTest(x, y);
        if (!hit) {
            return;
        }
        event.preventDefault();

        // lines or pages to pixels
        const delta =
            event.deltaY *
            (event.deltaMode == 1 ? 33 : event.deltaMode == 2 ? 300 : 1);
        const factor = Math.pow(WHEEL_ZOOM, delta / 100);

        if (hit.kind == "axis") {
            this.zoomAxis(
                hit.axis,
                factor,
                this.yToValue(hit.axis, hit.axis.plot, y)
            );
        } else if (event.ctrlKey || event.metaKey) {
            const plot = hit.kind == "level" ? hit.axis.plot : hit.plot;
            for (const axis of plot.axes) {
                this.zoomAxis(axis, factor, this.yToValue(axis, plot, y));
            }
        } else {
            this.zoomTime(factor, this.xToTime(x));
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // drawing

    // The range of the axis by its settings and its step of the ticks for
    // about ticks of them; on the grid of the primary axis of the plot if
    // it is given (see alignRange), not a fixed scale.
    private computeAxisRange(
        axis: Axis,
        points: Map<ScopeTrace, TracePoints>,
        ticks: number,
        primary: (Range & { step: number }) | undefined
    ): Range & { step: number } {
        const target = this.getTargetRange(axis, points);
        if (
            primary &&
            this.bb3PlusInstrument.getScopeAxis(axis.key).mode != "fixed"
        ) {
            return alignRange(target, primary);
        }
        const range = target.nice
            ? getNiceRange(target.min, target.max, ticks)
            : target;
        return {
            min: range.min,
            max: range.max,
            step: getTickStep(range.min, range.max, ticks)
        };
    }

    // the range the axis fits to by its settings (see TargetRange)
    private getTargetRange(
        axis: Axis,
        points: Map<ScopeTrace, TracePoints>
    ): TargetRange {
        const settings = this.bb3PlusInstrument.getScopeAxis(axis.key);
        if (settings.mode == "fixed") {
            return { min: settings.min, max: settings.max, nice: false };
        }

        if (settings.mode == "full") {
            const full = getFullRange(axis);
            if (full) {
                // a bit more, the values at the ends are not on the frame
                const padding = (full.max - full.min) * 0.03;
                return {
                    min: full.min - padding,
                    max: full.max + padding,
                    nice: false
                };
            }
            // not known: auto
        }

        let range = getDataRange(axis, points);
        if (settings.mode == "grow") {
            const grown = this.growRanges.get(axis.key);
            if (grown) {
                range = range
                    ? {
                          min: Math.min(range.min, grown.min),
                          max: Math.max(range.max, grown.max)
                      }
                    : grown;
            }
            if (range) {
                this.growRanges.set(axis.key, range);
            }
        }

        let { min, max } = range ?? { min: 0, max: 1 };
        if (settings.includeZero) {
            min = Math.min(min, 0);
            max = Math.max(max, 0);
        }
        return { min, max, nice: true };
    }

    draw() {
        const container = this.container;
        const canvas = this.canvas;

        const width = container.clientWidth;
        const height = container.clientHeight;
        const ratio = window.devicePixelRatio || 1;
        if (
            canvas.width != Math.round(width * ratio) ||
            canvas.height != Math.round(height * ratio)
        ) {
            canvas.width = Math.round(width * ratio);
            canvas.height = Math.round(height * ratio);
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
        }

        const ctx = canvas.getContext("2d")!;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const style = getComputedStyle(container);
        const textColor = style.color;
        const mutedColor =
            style.getPropertyValue("--bb3plus-muted").trim() || textColor;
        const gridColor = style.getPropertyValue("--bb3plus-grid") || "#8884";
        ctx.font = FONT;

        const bb3PlusInstrument = this.bb3PlusInstrument;
        // the capture of the trigger shown in this frame
        const capture = bb3PlusInstrument.scopeShownCapture;
        this.lastDrawCapture = capture;
        const timeWindow = this.getTimeWindow(capture);
        const { start, end, span } = timeWindow;

        const allAxes = getAxes(bb3PlusInstrument.traces);
        const axes = allAxes.filter(axis => axis.key != "bits");
        const bitsAxis = allAxes.find(axis => axis.key == "bits");
        const traces = allAxes.flatMap(axis => axis.traces);

        // the sides of the Y axes (chosen, else alternating), the integer
        // fields on the left of the lower plot
        const sides = new Map(
            axes.map((axis, i) => [
                axis,
                bb3PlusInstrument.getScopeAxisSide(axis.key, i)
            ])
        );
        if (bitsAxis) {
            sides.set(bitsAxis, "left");
        }
        const countOnSide = (side: string) =>
            axes.filter(axis => sides.get(axis) == side).length;
        const leftAxes = Math.max(countOnSide("left"), bitsAxis ? 1 : 0);
        const rightAxes = countOnSide("right");
        const plotLeft =
            leftAxes > 0 || axes.length == 0
                ? Math.max(1, leftAxes) * AXIS_WIDTH
                : LEFT_MARGIN;
        const plotRight =
            width - (rightAxes > 0 ? rightAxes * AXIS_WIDTH : RIGHT_MARGIN);
        const plotWidth = plotRight - plotLeft;
        if (plotWidth < 20 || height < 60) {
            this.layout = undefined;
            this.lastDraw = undefined;
            return;
        }

        const plotsBottom = height - TIME_AXIS_HEIGHT;
        let analogTop = TOP_MARGIN;
        let analogBottom = plotsBottom;
        let bitsTop = plotsBottom;
        if (bitsAxis) {
            const available = plotsBottom - TOP_MARGIN;
            const bitsHeight =
                axes.length > 0
                    ? Math.min(
                          available * 0.4,
                          40 + 20 * bitsAxis.traces.length
                      )
                    : available;
            bitsTop = plotsBottom - bitsHeight;
            analogBottom = bitsTop - PLOT_GAP;
        }

        const timeToX = (time: number) =>
            plotLeft + ((time - start) / span) * plotWidth;

        // the points of the window, the envelope columns on device pixels
        // (a column of the envelope is a pixel wide, see fillEnvelope)
        const points = new Map<ScopeTrace, TracePoints>();
        for (const trace of traces) {
            points.set(
                trace,
                this.bufferOf(trace, capture).getWindowPoints(
                    start,
                    end,
                    plotWidth * ratio
                )
            );
        }

        const plots: { axes: Axis[]; top: number; bottom: number }[] = [];
        if (axes.length > 0 || !bitsAxis) {
            plots.push({ axes, top: analogTop, bottom: analogBottom });
        }
        if (bitsAxis) {
            plots.push({ axes: [bitsAxis], top: bitsTop, bottom: plotsBottom });
        }

        const layout: Layout = {
            plotLeft,
            plotRight,
            window: timeWindow,
            plots: [],
            axes: [],
            triggerLevel: undefined,
            triggerPosition: undefined
        };
        const scale = { time: 0, axes: new Map<string, number>() };

        // the trigger: its level line on the axis of an analog source, the
        // trigger point of the capture shown
        const triggerColor = bb3PlusInstrument.darkTheme
            ? TRIGGER_COLOR_DARK
            : TRIGGER_COLOR_LIGHT;
        const triggerSource =
            bb3PlusInstrument.settings.scopeTriggerMode != "off"
                ? bb3PlusInstrument.scopeTriggerSource
                : undefined;
        // the trigger point: of the capture shown, else where the next
        // trigger will be in the window (the pre-trigger); dragged, see
        // hitTest
        const triggerX = capture
            ? timeToX(capture.time)
            : triggerSource
              ? plotLeft +
                bb3PlusInstrument.settings.scopeTriggerPosition * plotWidth
              : undefined;

        const timeCount = Math.max(2, plotWidth / 100);
        const timeStep = getTickStep(
            start - timeWindow.ref,
            end - timeWindow.ref,
            timeCount
        );
        const timeTicks = getTicksWithStep(
            start - timeWindow.ref,
            end - timeWindow.ref,
            timeStep
        );
        scale.time = timeStep;

        for (const plot of plots) {
            const plotHeight = plot.bottom - plot.top;
            const plotLayout: PlotLayout = {
                top: plot.top,
                bottom: plot.bottom,
                axes: []
            };
            layout.plots.push(plotLayout);
            if (plotHeight < 10) {
                continue;
            }

            // frame and time grid
            ctx.strokeStyle = gridColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(
                plotLeft + 0.5,
                plot.top + 0.5,
                plotWidth - 1,
                plotHeight - 1
            );
            ctx.beginPath();
            for (const tick of timeTicks) {
                const x = Math.round(timeToX(timeWindow.ref + tick)) + 0.5;
                ctx.moveTo(x, plot.top);
                ctx.lineTo(x, plot.bottom);
            }
            ctx.stroke();

            const ticksCount = Math.max(2, plotHeight / 40);
            // the grid of the first axis, the others on it (the option)
            let primary: (Range & { step: number }) | undefined;
            const align = bb3PlusInstrument.settings.scopeAlignAxes;

            plot.axes.forEach((axis, axisIndex) => {
                const range = this.computeAxisRange(
                    axis,
                    points,
                    ticksCount,
                    align ? primary : undefined
                );
                if (axisIndex == 0) {
                    primary = range;
                }
                axis.min = range.min;
                axis.max = range.max;
                scale.axes.set(axis.key, range.step);
                const valueToY = (value: number) =>
                    plot.bottom -
                    ((value - axis.min) / (axis.max - axis.min)) * plotHeight;

                // the axis: on its side next to the axes before it
                const onLeft = sides.get(axis) != "right";
                const slot = plot.axes
                    .slice(0, axisIndex)
                    .filter(
                        other => (sides.get(other) != "right") == onLeft
                    ).length;
                const axisX = onLeft
                    ? plotLeft - slot * AXIS_WIDTH
                    : plotRight + slot * AXIS_WIDTH;

                const axisLayout: AxisLayout = {
                    key: axis.key,
                    plot: plotLayout,
                    x0: onLeft ? axisX - AXIS_WIDTH : axisX,
                    x1: onLeft ? axisX : axisX + AXIS_WIDTH,
                    min: axis.min,
                    max: axis.max
                };
                plotLayout.axes.push(axisLayout);
                layout.axes.push(axisLayout);

                // the ticks: of the first axis muted (its grid is drawn),
                // of the others in the color of their trace
                const axisColor =
                    axis.traces.length == 1 ? axis.traces[0].color : textColor;
                const ticks = getTicksWithStep(axis.min, axis.max, range.step);
                ctx.fillStyle = axisIndex == 0 ? mutedColor : axisColor;
                ctx.textAlign = onLeft ? "right" : "left";
                ctx.textBaseline = "middle";
                ctx.beginPath();
                for (const tick of ticks) {
                    const y = Math.round(valueToY(tick)) + 0.5;
                    if (axisIndex == 0) {
                        ctx.moveTo(plotLeft, y);
                        ctx.lineTo(plotRight, y);
                    }
                    // inside the height of the plot
                    ctx.fillText(
                        withSign(formatNumber(tick, 4), tick, false),
                        axisX + (onLeft ? -6 : 6),
                        clamp(y, plot.top + 6, plot.bottom - 6)
                    );
                }
                ctx.strokeStyle = gridColor;
                ctx.stroke();

                // above the plot: the title (the traces and the unit) from
                // the outer edge of the axis, a lock when the scale is
                // fixed; the title of the inner axis may go over the plot
                const title = getAxisTitle(axis);
                const fixed =
                    bb3PlusInstrument.getScopeAxis(axis.key).mode == "fixed";
                ctx.font = TITLE_FONT;
                ctx.fillStyle = axisColor;
                ctx.textBaseline = "bottom";
                const maxTitleWidth =
                    slot == 0 ? AXIS_WIDTH + plotWidth / 3 : AXIS_WIDTH - 8;
                const titleText = fitText(ctx, title, maxTitleWidth - 12);
                const titleWidth = ctx.measureText(titleText).width;
                const titleX = onLeft ? axisLayout.x0 + 4 : axisLayout.x1 - 4;
                ctx.textAlign = onLeft ? "left" : "right";
                ctx.fillText(titleText, titleX, plot.top - 5);
                if (fixed) {
                    drawLock(
                        ctx,
                        onLeft
                            ? titleX + titleWidth + 4
                            : titleX - titleWidth - 12,
                        plot.top - 16
                    );
                }
                ctx.font = FONT;

                // the traces
                ctx.save();
                ctx.beginPath();
                ctx.rect(plotLeft, plot.top, plotWidth, plotHeight);
                ctx.clip();
                for (const trace of axis.traces) {
                    const tracePoints = points.get(trace);
                    if (!tracePoints) {
                        continue;
                    }
                    if (tracePoints.envelope) {
                        ctx.fillStyle = trace.color;
                        fillEnvelope(
                            ctx,
                            tracePoints,
                            timeToX,
                            valueToY,
                            ratio
                        );
                        continue;
                    }
                    const buffer = this.bufferOf(trace, capture);
                    const asPoints =
                        (buffer.period / span) * plotWidth >=
                        POINTS_MIN_SPACING;
                    ctx.strokeStyle = trace.color;
                    ctx.lineWidth = asPoints
                        ? POINTS_LINE_WIDTH
                        : TRACE_LINE_WIDTH;
                    ctx.globalAlpha = asPoints ? POINTS_LINE_ALPHA : 1;
                    ctx.beginPath();
                    let drawing = false;
                    let lastX = 0;
                    let lastY = 0;
                    for (let i = 0; i < tracePoints.times.length; i++) {
                        const value = tracePoints.values[i];
                        if (isNaN(value)) {
                            drawing = false;
                            continue;
                        }
                        const x = timeToX(tracePoints.times[i]);
                        const y = valueToY(value);
                        if (!drawing) {
                            ctx.moveTo(x, y);
                            drawing = true;
                        } else if (trace.bits) {
                            // steps
                            ctx.lineTo(x, lastY);
                            ctx.lineTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                        lastX = x;
                        lastY = y;
                    }
                    if (drawing && trace.bits) {
                        // the last value up to the newest time shown (not
                        // after a sample past the window)
                        const newestX = timeToX(
                            Math.min(buffer.getNewestTime(), end)
                        );
                        if (newestX > lastX) {
                            ctx.lineTo(newestX, lastY);
                        }
                    }
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    if (asPoints) {
                        // the samples on the thin line (a bit field holds
                        // its value until the next sample: steps)
                        ctx.fillStyle = trace.color;
                        fillPoints(ctx, tracePoints, timeToX, valueToY);
                    }
                }

                // the trigger level on the axis of an analog source: a
                // dashed line in its color, the tag "T" at the side of its
                // axis (dragged, see hitTest)
                if (
                    triggerSource &&
                    !triggerSource.bits &&
                    axis.traces.includes(triggerSource)
                ) {
                    const y =
                        Math.round(
                            valueToY(
                                bb3PlusInstrument.settings.scopeTriggerLevel
                            )
                        ) + 0.5;
                    if (y >= plot.top && y <= plot.bottom) {
                        ctx.strokeStyle = triggerSource.color;
                        ctx.globalAlpha = 0.75;
                        ctx.lineWidth = 1;
                        ctx.setLineDash([5, 4]);
                        ctx.beginPath();
                        ctx.moveTo(plotLeft, y);
                        ctx.lineTo(plotRight, y);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.globalAlpha = 1;
                        const tagX = onLeft
                            ? plotLeft + 1
                            : plotRight - 1 - LEVEL_TAG_SIZE;
                        ctx.fillStyle = triggerSource.color;
                        ctx.beginPath();
                        ctx.roundRect(
                            tagX,
                            y - LEVEL_TAG_SIZE / 2,
                            LEVEL_TAG_SIZE,
                            LEVEL_TAG_SIZE,
                            3
                        );
                        ctx.fill();
                        ctx.fillStyle = "#fff";
                        ctx.font = "bold 10px Roboto, sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("T", tagX + LEVEL_TAG_SIZE / 2, y + 0.5);
                        ctx.font = FONT;
                        layout.triggerLevel = { axis: axisLayout, y };
                    }
                }
                ctx.restore();
            });

            // the trigger point: a dashed line, a handle at the top of the
            // first plot
            if (triggerX != undefined) {
                const x = Math.round(triggerX) + 0.5;
                if (x >= plotLeft && x <= plotRight) {
                    ctx.strokeStyle = textColor;
                    ctx.globalAlpha = 0.45;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(x, plot.top);
                    ctx.lineTo(x, plot.bottom);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;
                    if (plot == plots[0]) {
                        ctx.fillStyle = triggerColor;
                        ctx.beginPath();
                        ctx.moveTo(x - 6, plot.top - 1);
                        ctx.lineTo(x + 6, plot.top - 1);
                        ctx.lineTo(x, plot.top + 8);
                        ctx.closePath();
                        ctx.fill();
                    }
                    layout.triggerPosition = { x };
                }
            }
        }

        this.layout = layout;
        this.lastDraw = { end, secondsPerPixel: span / plotWidth };

        // time axis: the values in the unit under them, from the trigger
        // with a sign
        const timeUnit = getTimeUnit(
            Math.max(
                Math.abs(start - timeWindow.ref),
                Math.abs(end - timeWindow.ref)
            )
        );
        const signed = timeTicks.some(tick => tick < 0);
        ctx.fillStyle = mutedColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (const tick of timeTicks) {
            const label = withSign(
                formatNumber(+(tick * timeUnit.scale).toPrecision(10), 4),
                tick,
                signed
            );
            // inside the canvas
            const half = ctx.measureText(label).width / 2;
            const x = Math.min(
                Math.max(timeToX(timeWindow.ref + tick), half + 2),
                width - half - 2
            );
            ctx.fillText(label, x, plotsBottom + 5);
        }
        ctx.fillText(
            timeUnit.name,
            (plotLeft + plotRight) / 2,
            plotsBottom + 19
        );

        this.setScale(scale);

        const drag = this.drag;
        if (drag?.kind == "box") {
            // the box to zoom to
            const x0 = clamp(Math.min(drag.x0, drag.x1), plotLeft, plotRight);
            const x1 = clamp(Math.max(drag.x0, drag.x1), plotLeft, plotRight);
            const y0 = clamp(
                Math.min(drag.y0, drag.y1),
                drag.plot.top,
                drag.plot.bottom
            );
            const y1 = clamp(
                Math.max(drag.y0, drag.y1),
                drag.plot.top,
                drag.plot.bottom
            );
            ctx.fillStyle = textColor;
            ctx.globalAlpha = 0.12;
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = textColor;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        } else if (
            !drag &&
            this.mouse &&
            this.mouse.x >= plotLeft &&
            this.mouse.x <= plotRight &&
            traces.length > 0
        ) {
            this.drawReadout(ctx, layout, plots, points, textColor, height);
        } else {
            // the next readout starts from the templates
            this.readoutWidths = undefined;
        }
    }

    // the steps of the grid drawn (see scale), onScaleChange if they changed
    private setScale(scale: { time: number; axes: Map<string, number> }) {
        const key = JSON.stringify([scale.time, Array.from(scale.axes)]);
        if (key == this.scaleKey) {
            return;
        }
        this.scaleKey = key;
        this.scale = scale;
        this.onScaleChange?.();
    }

    // the values at the mouse: a line, a dot on each trace and a box with the
    // time and the values
    private drawReadout(
        ctx: CanvasRenderingContext2D,
        layout: Layout,
        plots: { axes: Axis[]; top: number; bottom: number }[],
        points: Map<ScopeTrace, TracePoints>,
        textColor: string,
        height: number
    ) {
        const { plotLeft, plotRight, window: timeWindow } = layout;
        const mouseX = this.mouse!.x;
        const x = Math.round(mouseX) + 0.5;
        const time = this.xToTime(mouseX);
        const plotsBottom = height - TIME_AXIS_HEIGHT;

        ctx.strokeStyle = textColor;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, TOP_MARGIN);
        ctx.lineTo(x, plotsBottom);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const rows: {
            trace: ScopeTrace;
            name: string;
            value: string;
            // a value at least as wide as most (see READOUT_VALUE_TEMPLATE)
            template: string;
        }[] = [];
        for (const plot of plots) {
            for (const axis of plot.axes) {
                for (const trace of axis.traces) {
                    if (!points.has(trace)) {
                        continue;
                    }
                    // the sample, not interpolated: the nearest one, of a
                    // bit field the one before
                    const sample = this.bufferOf(
                        trace,
                        this.lastDrawCapture
                    ).getSampleAt(time, trace.bits);
                    const value = sample ? sample.value : NaN;
                    const unit = trace.bits ? "" : getUnitName(trace.unit);
                    rows.push({
                        trace,
                        name: trace.name,
                        value: isNaN(value)
                            ? "-"
                            : formatNumber(value, 6) + (unit ? " " + unit : ""),
                        template: trace.bits
                            ? READOUT_BITS_TEMPLATE
                            : READOUT_VALUE_TEMPLATE + (unit ? " " + unit : "")
                    });
                    if (sample && !isNaN(value)) {
                        // the dot: on the sample, of a bit field on its step
                        // at the mouse; a ring in the background color
                        const dotX = trace.bits
                            ? mouseX
                            : plotLeft +
                              ((sample.time - timeWindow.start) /
                                  timeWindow.span) *
                                  (plotRight - plotLeft);
                        const y =
                            plot.bottom -
                            ((value - axis.min) / (axis.max - axis.min)) *
                                (plot.bottom - plot.top);
                        if (y >= plot.top && y <= plot.bottom) {
                            ctx.fillStyle = trace.color;
                            ctx.strokeStyle = this.getBackgroundColor();
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.arc(dotX, y, 4, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        const size = this.bb3PlusInstrument.settings.scopeReadoutSize;
        const lineHeight = Math.round(size * 1.45);
        const padding = Math.round(size * 0.6);
        const bar = Math.max(3, Math.round(size * 0.2));
        const nameFont = `${size}px Roboto, sans-serif`;
        const valueFont = `600 ${size}px "Roboto Mono", monospace`;

        const relative = time - timeWindow.ref;
        const header = "t = " + withSign(formatTime(relative), relative, true);
        ctx.font = valueFont;
        let headerWidth = Math.max(
            ctx.measureText(header).width,
            ctx.measureText(READOUT_TIME_TEMPLATE).width
        );
        let valueWidth = Math.max(
            ...rows.map(row =>
                Math.max(
                    ctx.measureText(row.value).width,
                    ctx.measureText(row.template).width
                )
            )
        );
        ctx.font = nameFont;
        const nameWidth = Math.max(
            ...rows.map(row => ctx.measureText(row.name).width)
        );

        // the box doesn't jump: its widths only grow while the cursor stays
        // in the plot with the same traces and size
        const key = [
            size,
            ...rows.map(row => row.name + "\t" + row.template)
        ].join("\n");
        const kept = this.readoutWidths;
        if (kept && kept.key == key) {
            headerWidth = Math.max(headerWidth, kept.header);
            valueWidth = Math.max(valueWidth, kept.value);
        }
        this.readoutWidths = { key, header: headerWidth, value: valueWidth };

        const gap = size;
        const boxWidth =
            padding * 2 +
            Math.max(headerWidth, bar + padding + nameWidth + gap + valueWidth);
        const boxHeight = padding * 2 + lineHeight * (rows.length + 1) - 2;
        const boxX =
            x + 12 + boxWidth < plotRight
                ? x + 12
                : Math.max(plotLeft, x - 12 - boxWidth);
        const boxY = TOP_MARGIN + 8;

        ctx.fillStyle = this.bb3PlusInstrument.darkTheme
            ? READOUT_BACKGROUND_DARK
            : READOUT_BACKGROUND_LIGHT;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
        ctx.fill();

        ctx.textBaseline = "middle";
        let y = boxY + padding + lineHeight / 2 - 1;
        ctx.fillStyle = READOUT_MUTED_TEXT;
        ctx.font = valueFont;
        ctx.textAlign = "left";
        ctx.fillText(header, boxX + padding, y);

        for (const row of rows) {
            y += lineHeight;
            ctx.fillStyle = row.trace.color;
            ctx.beginPath();
            ctx.roundRect(
                boxX + padding,
                y - size * 0.45,
                bar,
                size * 0.9,
                bar / 2
            );
            ctx.fill();
            ctx.fillStyle = READOUT_TEXT;
            ctx.font = nameFont;
            ctx.textAlign = "left";
            ctx.fillText(row.name, boxX + padding + bar + padding, y);
            ctx.font = valueFont;
            ctx.textAlign = "right";
            ctx.fillText(row.value, boxX + boxWidth - padding, y);
        }
        ctx.font = FONT;
    }

    // The plot as drawn now (drawn again without the cursor readout) as a
    // PNG, on the background of its card with a margin, in device pixels;
    // undefined if nothing is drawn.
    capturePng() {
        this.mouse = undefined;
        this.readoutWidths = undefined;
        this.draw();
        this.needsDraw = true;
        const canvas = this.canvas;
        if (!this.layout || canvas.width == 0 || canvas.height == 0) {
            return undefined;
        }
        const ratio = window.devicePixelRatio || 1;
        const margin = Math.round(CAPTURE_MARGIN * ratio);
        const image = document.createElement("canvas");
        image.width = canvas.width + 2 * margin;
        image.height = canvas.height + 2 * margin;
        const ctx = image.getContext("2d")!;
        ctx.fillStyle = this.getBackgroundColor();
        ctx.fillRect(0, 0, image.width, image.height);
        ctx.drawImage(canvas, margin, margin);
        const url = image.toDataURL("image/png");
        return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    }

    // the background of the plot (of its card), for the rings of the dots
    private getBackgroundColor() {
        return getComputedStyle(this.container.parentElement ?? this.container)
            .backgroundColor;
    }
}

// the text cut with an ellipsis to the width (px) in the font of ctx
function fitText(ctx: CanvasRenderingContext2D, text: string, width: number) {
    if (ctx.measureText(text).width <= width) {
        return text;
    }
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + "…").width > width) {
        cut = cut.slice(0, -1);
    }
    return cut + "…";
}

// The scope: the toolbar (run, acquisition, trigger, zoom), a card per
// trace, the plot with the scales panel next to it, the measure bar.
export class ScopeView extends BB3PlusView {
    private scopeCanvas: ScopeCanvas;
    private toolbar: ScopeToolbar;
    private channels: ScopeChannels;
    private sidePanel: ScopeSidePanel;
    private measureBar: ScopeMeasureBar;
    private plotCard: HTMLDivElement;
    // the measurements of the analog traces (by updateStats), for the
    // window of measureKey
    private stats = new Map<ScopeTrace, SampleStats | undefined>();
    private measureKey = "";
    // performance.now() of the next measurements (see MEASURE_MAX_LOAD)
    private nextMeasureTime = 0;

    constructor(bb3PlusInstrument: BB3PlusInstrument) {
        super(bb3PlusInstrument);
        this.element.classList.add("EezStudio_BB3Plus_Scope");
        // focused by a click in the plot, for Ctrl+C (see onCopy)
        this.element.tabIndex = -1;

        this.scopeCanvas = new ScopeCanvas(bb3PlusInstrument);
        this.addDisposer(() => this.scopeCanvas.destroy());

        this.sidePanel = new ScopeSidePanel(
            bb3PlusInstrument,
            this.scopeCanvas
        );
        this.toolbar = new ScopeToolbar(bb3PlusInstrument, this.scopeCanvas, {
            addToHistory: () => this.addDlogToHistory(),
            addScreenshot: () => this.addScreenshotToHistory(),
            copyScreenshot: () => this.copyScreenshot()
        });
        this.channels = new ScopeChannels(
            bb3PlusInstrument,
            this.scopeCanvas,
            this.sidePanel
        );
        this.measureBar = new ScopeMeasureBar(bb3PlusInstrument);

        this.plotCard = h(
            "div",
            { className: "EezStudio_BB3Plus_Card EezStudio_BB3Plus_PlotCard" },
            this.scopeCanvas.container
        );

        this.element.append(
            this.toolbar.element,
            this.channels.element,
            h(
                "div",
                { className: "EezStudio_BB3Plus_ScopeMain" },
                this.plotCard,
                this.sidePanel.element
            ),
            this.measureBar.element
        );

        // the steps of the grid: the time per division, the values per
        // division of the cards
        this.scopeCanvas.onScaleChange = () => {
            this.toolbar.updateScale();
            this.channels.updateScale();
        };

        // the canvas prevents the default of a press (the drags), so it
        // doesn't move the focus by itself
        this.scopeCanvas.container.addEventListener("pointerdown", () =>
            this.element.focus({ preventScroll: true })
        );
        document.addEventListener("copy", this.onCopy);
        this.addDisposer(() =>
            document.removeEventListener("copy", this.onCopy)
        );

        this.listen(["scope", "fields"], () => this.update());
        this.listen(["status"], () => this.toolbar.updateStatus());
        this.update();
        this.toolbar.updateStatus();

        // the auto ranges in the scales panel
        const timer = setInterval(() => {
            if (
                bb3PlusInstrument.settings.scopeShowOptions &&
                this.element.clientWidth > 0
            ) {
                this.sidePanel.updateAxisRows();
            }
        }, OPTIONS_UPDATE_INTERVAL);
        this.addDisposer(() => clearInterval(timer));

        // the trigger status goes by the time too ("triggered", "auto")
        const statusTimer = setInterval(() => {
            if (this.element.clientWidth > 0) {
                this.toolbar.updateTriggerStatus();
            }
        }, TRIGGER_STATUS_INTERVAL);
        this.addDisposer(() => clearInterval(statusTimer));

        // the measurements of the window shown
        const measureTimer = setInterval(() => {
            if (this.element.clientWidth > 0) {
                this.updateStats();
            }
        }, MEASURE_INTERVAL);
        this.addDisposer(() => clearInterval(measureTimer));
    }

    // The measurements of the analog traces in the time window shown, again
    // only if the window or the samples changed (not while stopped), and
    // after a pause at least MEASURE_MAX_LOAD times longer than they took.
    private updateStats() {
        if (performance.now() < this.nextMeasureTime) {
            return;
        }
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const capture = bb3PlusInstrument.scopeShownCapture;
        const { start, end } = this.scopeCanvas.getTimeWindow(capture);
        const traces = bb3PlusInstrument.traces.filter(
            trace => !trace.bits && trace.fieldIndex >= 0
        );
        const key = JSON.stringify([
            start,
            end,
            capture?.capturedAt,
            traces.map(trace => [
                trace.key,
                this.scopeCanvas.bufferOf(trace, capture).getNewestTime(),
                this.scopeCanvas.bufferOf(trace, capture).size
            ])
        ]);
        if (key == this.measureKey) {
            return;
        }
        this.measureKey = key;
        const startTime = performance.now();
        this.stats = new Map(
            traces.map(trace => [
                trace,
                this.scopeCanvas
                    .bufferOf(trace, capture)
                    .getStats(start, end, getStatsOptions(trace.measurements))
            ])
        );
        const endTime = performance.now();
        this.nextMeasureTime =
            endTime + (endTime - startTime) * (1 / MEASURE_MAX_LOAD - 1);
        this.channels.updateStats(this.stats);
        this.measureBar.updateStats(this.stats);
    }

    // The samples of the traces shown in the time window shown (of the
    // capture of the trigger shown): of the fastest trace at its rate, a
    // slower trace has the sample shown at each of those times (held, not
    // interpolated). Undefined (with a warning) if there are none.
    private getWindowSamples() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const capture = bb3PlusInstrument.scopeShownCapture;
        const { start, end } = this.scopeCanvas.getTimeWindow(capture);
        const bufferOf = (trace: ScopeTrace) =>
            this.scopeCanvas.bufferOf(trace, capture);

        // the traces shown
        const traces = bb3PlusInstrument.traces.filter(
            trace => !trace.hidden && bufferOf(trace).period > 0
        );
        let reference: ScopeTrace | undefined;
        for (const trace of traces) {
            if (
                !reference ||
                bufferOf(trace).period < bufferOf(reference).period
            ) {
                reference = trace;
            }
        }
        const referenceBuffer = reference ? bufferOf(reference) : undefined;
        const samples = referenceBuffer?.getSamples(start, end);
        if (!reference || !referenceBuffer || !samples) {
            notification.warn("No samples in the time shown");
            return undefined;
        }

        const period = referenceBuffer.period;
        const count = samples.values.length;
        const firstTime = referenceBuffer.getTime(samples.first);
        const channels = traces.map(trace =>
            trace == reference
                ? samples.values
                : bufferOf(trace).getValuesAt(
                      firstTime,
                      period,
                      count,
                      trace.bits
                  )
        );
        return { traces, period, count, firstTime, channels };
    }

    // The traces in the time window shown as a DLOG chart in the history of
    // the instrument (see dlog-writer.ts and getWindowSamples), as BB3+
    // records them: a float column per analog trace, a bit column per pin
    // of a bit field, the names and the colors from the catalogs.
    private addDlogToHistory() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const samples = this.getWindowSamples();
        if (!samples) {
            return;
        }
        const { traces, period, count, firstTime, channels } = samples;

        const columns: DlogColumn[] = [];
        traces.forEach((trace, i) => {
            const catalog = bb3PlusInstrument.getTraceCatalog(trace);
            const field = catalog?.field;
            const nameAndColors = catalog
                ? {
                      module: catalog.slotFields.moduleName,
                      slot: trace.slot,
                      channel: catalog.field.channel + 1,
                      slotLabel: catalog.slotFields.slotLabel,
                      channelLabel: catalog.field.channelLabel,
                      color: catalog.field.color,
                      channelColor: catalog.field.channelColor
                  }
                : {};
            const label = field ? field.label || field.name : trace.name;
            if (trace.bits) {
                const numBits = field?.bits || 8;
                for (let bit = 0; bit < numBits; bit++) {
                    columns.push({
                        values: channels[i],
                        bitIndex: bit,
                        unit: DlogUnit.UNIT_NONE,
                        rangeMin: 0,
                        rangeMax: 1,
                        label: `${label}${bit + 1}`,
                        pinLabel: field?.pinLabels[bit],
                        ...nameAndColors
                    });
                }
            } else {
                const range = trace.fullRange;
                const hasRange = range != undefined && range.min < range.max;
                columns.push({
                    values: channels[i],
                    unit:
                        field && field.unit != 255
                            ? field.unit
                            : DlogUnit.UNIT_NONE,
                    rangeMin: hasRange ? range.min : 0,
                    rangeMax: hasRange ? range.max : 1,
                    label,
                    ...nameAndColors
                });
            }
        });

        const comment = `BB3+ scope, ${formatRate(
            Math.max(1, Math.round(1 / period))
        )}, ${formatTime(count * period)}`;
        // the sample times are performance.now() seconds
        const startTime = Math.floor(
            Date.now() / 1000 - (performance.now() / 1000 - firstTime)
        );
        const data = encodeDlog({
            comment,
            startTime,
            period,
            numRows: count,
            columns
        });

        log(
            activityLogStore,
            {
                oid: bb3PlusInstrument.instrument.id,
                type: "instrument/file-attachment",
                message: JSON.stringify({
                    state: "success",
                    fileType: { ext: "dlog", mime: MIME_EEZ_DLOG },
                    dataLength: data.length,
                    note: JSON.stringify([{ insert: comment }])
                }),
                data
            },
            { undoable: false }
        );
        notification.success("DLOG chart added to the history");
    }

    // Ctrl+C (Edit > Copy fires the "copy" event on the focused element, or
    // on the body if none) copies the screenshot while the scope is shown:
    // not with text selected, in an input or in a dialog. Ctrl+Shift+C is
    // Connect/Disconnect of the instrument window.
    private onCopy = (event: ClipboardEvent) => {
        if (event.defaultPrevented || this.element.clientWidth == 0) {
            return;
        }
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            return;
        }
        const target = event.target;
        if (
            !(target instanceof HTMLElement) ||
            !(this.element.contains(target) || target == document.body) ||
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target.isContentEditable ||
            document.querySelector(".modal.show")
        ) {
            return;
        }
        event.preventDefault();
        this.copyScreenshot();
    };

    // the plot as drawn now as a PNG image to the clipboard, not saved
    private copyScreenshot() {
        const data = this.scopeCanvas.capturePng();
        if (!data) {
            notification.warn("Nothing is drawn");
            return;
        }
        clipboard.writeImage(nativeImage.createFromBuffer(data));
        notification.success("Screenshot copied to the clipboard");
    }

    // The plot as drawn now as a PNG image in the history of the instrument
    // (it can be saved or copied to the clipboard there), with the rate and
    // the time shown in its note.
    private addScreenshotToHistory() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const data = this.scopeCanvas.capturePng();
        if (!data) {
            notification.warn("Nothing is drawn");
            return;
        }
        const comment = `BB3+ scope screenshot, ${formatRate(
            bb3PlusInstrument.settings.scopeRate
        )}, ${formatTime(this.scopeCanvas.getTimeWindow().span)}`;
        log(
            activityLogStore,
            {
                oid: bb3PlusInstrument.instrument.id,
                type: "instrument/file-attachment",
                message: JSON.stringify({
                    state: "success",
                    fileType: { ext: "png", mime: "image/png" },
                    dataLength: data.length,
                    note: JSON.stringify([{ insert: comment }])
                }),
                data
            },
            { undoable: false }
        );
        notification.success("Screenshot added to the history");
    }

    private update() {
        this.scopeCanvas.invalidate();
        this.toolbar.update();
        this.channels.update();
        this.sidePanel.update();
        this.measureBar.update();
        // the cards and the measurements made again have the values (a new
        // trace gets them with the next measurements)
        this.channels.updateStats(this.stats);
        this.measureBar.updateStats(this.stats);
    }
}
