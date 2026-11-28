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
    ScopeAxisMode,
    ScopeAxisSettings,
    ScopeCapture,
    ScopeTriggerMode,
    DEFAULT_AXIS_SETTINGS,
    SCOPE_RATES,
    SCOPE_SPANS,
    SCOPE_TRIGGER_MODES,
    READOUT_SIZES
} from "instrument/bb3plus/BB3PlusInstrument";
import { SampleBuffer } from "instrument/bb3plus/sample-buffer";
import { showTriggerHelp } from "instrument/bb3plus/components/trigger-help";
import {
    getUnitName,
    formatNumber,
    getFieldNameParts
} from "instrument/bb3plus/fields-model";
import { getListName } from "instrument/bb3plus/labels";
import { encodeDlog, DlogColumn } from "instrument/bb3plus/dlog-writer";
import {
    h,
    setText,
    setVisible,
    setClass,
    createSelect,
    setSelectOptions,
    setSelectValue,
    BB3PlusView,
    PushStatus,
    ErrorText,
    ICONS,
    svgIcon,
    infoIcon
} from "instrument/bb3plus/components/dom";

const AXIS_WIDTH = 58;
const TIME_AXIS_HEIGHT = 22;
// above each plot: the units of its axes
const PLOT_GAP = 18;
const TOP_MARGIN = 18;
const RIGHT_MARGIN = 12;
const FONT = "11px Roboto, sans-serif";

const TRACE_LINE_WIDTH = 1.5;

// The samples are drawn as points when they are at least this far apart
// (px); closer they are a line (points would merge into a thick line
// anyway). The radius of a point. Between the points a thin faint line (the
// steps of a bit field), the width and the opacity.
const POINTS_MIN_SPACING = 6;
const POINT_RADIUS = 2.5;
const POINTS_LINE_WIDTH = 1;
const POINTS_LINE_ALPHA = 0.4;

// the trigger level line and the trigger point, on a dark and on a light
// background; the level line is dragged within this distance (px)
const TRIGGER_COLOR_DARK = "#FFD933";
const TRIGGER_COLOR_LIGHT = "#C98A00";
const LEVEL_HIT_DISTANCE = 4;

// the samples of a trace that is not in the capture shown (added after it)
const EMPTY_BUFFER = new SampleBuffer();

// The readout box at the cursor is at least as wide as these (in its
// monospace font), so it doesn't jump as the digits change: a value with 6
// significant digits and a sign (formatNumber: all from 0.1 to 999999), a
// bit field value (0 - 255), a time with 4 significant digits (formatTime).
const READOUT_VALUE_TEMPLATE = "-0.000000";
const READOUT_BITS_TEMPLATE = "000";
const READOUT_TIME_TEMPLATE = "-000.0 ms";

// zoom factor per wheel notch and per zoom button
const WHEEL_ZOOM = 1.25;
const BUTTON_ZOOM = 2;

// the shortest time window: this many samples of the fastest trace
const MIN_VIEW_SAMPLES = 10;
const MIN_VIEW_SPAN = 1e-5;

// a mouse move shorter than this (px) is not a drag
const DRAG_THRESHOLD = 4;

// the ranges shown in the options are updated this often (ms)
const OPTIONS_UPDATE_INTERVAL = 500;
// the trigger status is updated this often (ms)
const TRIGGER_STATUS_INTERVAL = 100;

const MOUSE_HELP =
    "Mouse wheel: zoom time. Ctrl + wheel, or wheel over an axis: zoom values. " +
    "Drag: zoom to the box. Shift + drag, or right drag: move. " +
    "Drag an axis: move its values. Esc: cancel the drag. " +
    "Double click: reset the zoom (on an axis: back to the full range).";

const AXIS_MODES: { value: ScopeAxisMode; label: string }[] = [
    { value: "full", label: "Full range" },
    { value: "auto", label: "Auto" },
    { value: "grow", label: "Auto, grow only" },
    { value: "fixed", label: "Fixed" }
];

function formatRate(rate: number) {
    return rate >= 1000 ? `${rate / 1000} kSPS` : `${rate} SPS`;
}

function formatTime(seconds: number) {
    const abs = Math.abs(seconds);
    if (abs == 0) {
        return "0";
    }
    if (abs < 1e-3) {
        return `${formatNumber(seconds * 1e6, 4)} us`;
    }
    if (abs < 1) {
        return `${formatNumber(seconds * 1e3, 4)} ms`;
    }
    return `${formatNumber(seconds, 4)} s`;
}

// the 1, 2, 5 step for about count values from min to max
function getTickStep(min: number, max: number, count: number) {
    const rough = (max - min) / Math.max(1, count);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;
    return (
        (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) *
        magnitude
    );
}

// about count values from min to max at a 1, 2, 5 step
function getTicks(min: number, max: number, count: number) {
    if (!(max - min > 0) || count < 1) {
        return [];
    }
    const step = getTickStep(min, max, count);
    const ticks: number[] = [];
    for (
        let value = Math.ceil(min / step) * step;
        value <= max;
        value += step
    ) {
        // no -0 and no 0.30000000000000004
        ticks.push(Math.abs(value) < step * 1e-9 ? 0 : +value.toPrecision(12));
    }
    return ticks;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

// the Y axis of a trace: one per unit of the float fields, one for the
// integer fields (drawn as steps in the lower plot)
function getAxisKey(trace: ScopeTrace) {
    return trace.bits ? "bits" : "unit" + trace.unit;
}

function getAxisLabel(trace: ScopeTrace) {
    return trace.bits ? "Integer" : getUnitName(trace.unit) || "No unit";
}

// the traces drawn, by their axes, the integer fields last
function getAxes(traces: ScopeTrace[]) {
    const axes: Axis[] = [];
    for (const trace of traces) {
        if (trace.fieldIndex < 0) {
            continue;
        }
        const key = getAxisKey(trace);
        let axis = axes.find(axis => axis.key == key);
        if (!axis) {
            axis = {
                key,
                label: trace.bits ? "" : getUnitName(trace.unit),
                traces: [],
                min: 0,
                max: 1
            };
            axes.push(axis);
        }
        axis.traces.push(trace);
    }
    return axes.sort((a, b) =>
        a.key == "bits" ? 1 : b.key == "bits" ? -1 : 0
    );
}

interface Axis {
    key: string;
    label: string;
    traces: ScopeTrace[];
    min: number;
    max: number;
}

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

interface Range {
    min: number;
    max: number;
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

// the full range of the traces of the axis, undefined if it isn't known
// for all of them
function getFullRange(axis: Axis): Range | undefined {
    let min = Infinity;
    let max = -Infinity;
    for (const trace of axis.traces) {
        if (!trace.fullRange) {
            return undefined;
        }
        min = Math.min(min, trace.fullRange.min);
        max = Math.max(max, trace.fullRange.max);
    }
    return min < max ? { min, max } : undefined;
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
class ScopeCanvas {
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

    // the range of the axis by its settings
    private computeAxisRange(
        axis: Axis,
        points: Map<ScopeTrace, TracePoints>,
        ticks: number
    ): Range {
        const settings = this.bb3PlusInstrument.getScopeAxis(axis.key);
        if (settings.mode == "fixed") {
            return { min: settings.min, max: settings.max };
        }

        if (settings.mode == "full") {
            const full = getFullRange(axis);
            if (full) {
                // a bit more, the values at the ends are not on the frame
                const padding = (full.max - full.min) * 0.03;
                return { min: full.min - padding, max: full.max + padding };
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
        return getNiceRange(min, max, ticks);
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

        // the Y axes alternating left and right, the integer fields on the
        // left of the lower plot
        const leftAxes = Math.max(1, Math.ceil(axes.length / 2));
        const rightAxes = Math.floor(axes.length / 2);
        const plotLeft = leftAxes * AXIS_WIDTH;
        const plotRight =
            width - Math.max(RIGHT_MARGIN, rightAxes * AXIS_WIDTH);
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

        const timeTicks = getTicks(
            start - timeWindow.ref,
            end - timeWindow.ref,
            Math.max(2, plotWidth / 100)
        );

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

            plot.axes.forEach((axis, axisIndex) => {
                const range = this.computeAxisRange(axis, points, ticksCount);
                axis.min = range.min;
                axis.max = range.max;
                const valueToY = (value: number) =>
                    plot.bottom -
                    ((value - axis.min) / (axis.max - axis.min)) * plotHeight;

                // the axis: its ticks, the grid of the first one
                const onLeft = axisIndex % 2 == 0;
                const slot = Math.floor(axisIndex / 2);
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

                const ticks = getTicks(axis.min, axis.max, ticksCount);
                ctx.fillStyle =
                    axis.traces.length == 1 && plot.axes.length > 1
                        ? axis.traces[0].color
                        : textColor;
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
                        formatNumber(tick, 4),
                        axisX + (onLeft ? -4 : 4),
                        clamp(y, plot.top + 6, plot.bottom - 6)
                    );
                }
                ctx.strokeStyle = gridColor;
                ctx.stroke();
                // above the plot: the unit, a lock when the scale is fixed
                const fixed =
                    bb3PlusInstrument.getScopeAxis(axis.key).mode == "fixed";
                const labelX = axisX + (onLeft ? -4 : 4);
                ctx.textBaseline = "bottom";
                if (axis.label) {
                    ctx.fillText(axis.label, labelX, plot.top - 4);
                }
                if (fixed) {
                    const labelWidth = axis.label
                        ? ctx.measureText(axis.label).width + 4
                        : 0;
                    drawLock(
                        ctx,
                        onLeft ? labelX - labelWidth - 8 : labelX + labelWidth,
                        plot.top - 15
                    );
                }

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

                // the trigger level on the axis of an analog source, with
                // the tag "T" at the right (dragged, see hitTest)
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
                        ctx.strokeStyle = triggerColor;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(plotLeft, y);
                        ctx.lineTo(plotRight, y);
                        ctx.stroke();
                        ctx.fillStyle = triggerColor;
                        ctx.fillRect(plotRight - 15, y - 7, 14, 14);
                        ctx.fillStyle = "#000";
                        ctx.font = "bold 10px Roboto, sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("T", plotRight - 8, y + 0.5);
                        ctx.font = FONT;
                        layout.triggerLevel = { axis: axisLayout, y };
                    }
                }
                ctx.restore();
            });

            // the trigger point: a line (dashed before a capture), a
            // handle at the top of the first plot
            if (triggerX != undefined) {
                const x = Math.round(triggerX) + 0.5;
                if (x >= plotLeft && x <= plotRight) {
                    ctx.strokeStyle = triggerColor;
                    ctx.globalAlpha = 0.6;
                    ctx.lineWidth = 1;
                    if (!capture) {
                        ctx.setLineDash([4, 4]);
                    }
                    ctx.beginPath();
                    ctx.moveTo(x, plot.top);
                    ctx.lineTo(x, plot.bottom);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;
                    if (plot == plots[0]) {
                        ctx.fillStyle = triggerColor;
                        ctx.beginPath();
                        ctx.moveTo(x - 6, plot.top + 1);
                        ctx.lineTo(x + 6, plot.top + 1);
                        ctx.lineTo(x, plot.top + 9);
                        ctx.closePath();
                        ctx.fill();
                    }
                    layout.triggerPosition = { x };
                }
            }
        }

        this.layout = layout;
        this.lastDraw = { end, secondsPerPixel: span / plotWidth };

        // time axis
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (const tick of timeTicks) {
            const label = formatTime(tick);
            // inside the canvas
            const half = ctx.measureText(label).width / 2;
            const x = Math.min(
                Math.max(timeToX(timeWindow.ref + tick), half + 2),
                width - half - 2
            );
            ctx.fillText(label, x, plotsBottom + 5);
        }

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

    // the values at the mouse: a line, a dot on each trace and a box with the
    // values
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
        ctx.globalAlpha = 0.6;
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
                        // at the mouse
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
                            ctx.beginPath();
                            ctx.arc(dotX, y, 3.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            }
        }

        const size = this.bb3PlusInstrument.settings.scopeReadoutSize;
        const lineHeight = Math.round(size * 1.4);
        const padding = Math.round(size * 0.5);
        const swatch = Math.round(size * 0.7);
        const nameFont = `${size}px Roboto, sans-serif`;
        const valueFont = `bold ${size}px "Roboto Mono", monospace`;

        const header = formatTime(time - timeWindow.ref);
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
            Math.max(
                headerWidth,
                swatch + padding + nameWidth + gap + valueWidth
            );
        const boxHeight = padding * 2 + lineHeight * (rows.length + 1);
        const boxX =
            x + 12 + boxWidth < plotRight
                ? x + 12
                : Math.max(plotLeft, x - 12 - boxWidth);
        const boxY = TOP_MARGIN + 4;

        // the background of the view, readable in both themes
        ctx.fillStyle = getComputedStyle(
            this.container.parentElement ?? this.container
        ).backgroundColor;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = textColor;
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);

        ctx.textBaseline = "middle";
        let y = boxY + padding + lineHeight / 2;
        ctx.fillStyle = textColor;
        ctx.font = valueFont;
        ctx.textAlign = "left";
        ctx.fillText(header, boxX + padding, y);

        for (const row of rows) {
            y += lineHeight;
            ctx.fillStyle = row.trace.color;
            ctx.fillRect(boxX + padding, y - swatch / 2, swatch, swatch);
            ctx.fillStyle = textColor;
            ctx.font = nameFont;
            ctx.textAlign = "left";
            ctx.fillText(row.name, boxX + padding + swatch + padding, y);
            ctx.font = valueFont;
            ctx.textAlign = "right";
            ctx.fillText(row.value, boxX + boxWidth - padding, y);
        }
        ctx.font = FONT;
    }
}

// the options of the scales: a row per Y axis, the time zoom, the size of
// the values at the cursor, the colors
class ScopeOptions {
    element = h("div", { className: "EezStudio_BB3Plus_ScopeOptions" });
    private axesElement = h("div");
    private axesKey = "";
    private axisRows = new Map<
        string,
        {
            axis: Axis;
            mode: HTMLSelectElement;
            min: HTMLInputElement;
            max: HTMLInputElement;
            includeZero: HTMLInputElement;
            restart: HTMLButtonElement;
            note: HTMLSpanElement;
        }
    >();
    private timeText = h("span");
    private showAllButton: HTMLButtonElement;
    private readoutSelect: HTMLSelectElement;
    private channelColorsCheckbox: HTMLInputElement;

    constructor(
        private bb3PlusInstrument: BB3PlusInstrument,
        private scopeCanvas: ScopeCanvas
    ) {
        this.showAllButton = h(
            "button",
            {
                className: "btn btn-sm btn-outline-secondary",
                onclick: () =>
                    bb3PlusInstrument.setScopeView(undefined, undefined)
            },
            "Show the whole span"
        );

        this.readoutSelect = createSelect(
            READOUT_SIZES,
            { style: { width: "130px" } },
            size => bb3PlusInstrument.setScopeReadoutSize(size)
        );

        this.channelColorsCheckbox = h("input", {
            type: "checkbox",
            className: "form-check-input me-1",
            onchange: () =>
                bb3PlusInstrument.setScopeChannelColors(
                    this.channelColorsCheckbox.checked
                )
        });

        this.element.append(
            this.axesElement,
            h(
                "div",
                { className: "EezStudio_BB3Plus_ScopeOptionsRow" },
                h("span", { className: "name" }, "Time"),
                this.timeText,
                this.showAllButton,
                h("label", { className: "ms-4" }, "Size of the cursor values"),
                this.readoutSelect
            ),
            h(
                "div",
                { className: "EezStudio_BB3Plus_ScopeOptionsRow" },
                h("span", { className: "name" }, "Colors"),
                h(
                    "label",
                    {
                        className: "form-check-label",
                        title: "The colors BB3+ draws the channels with (the channel or the slot color), not the colors of the fields"
                    },
                    this.channelColorsCheckbox,
                    "Channel colors"
                )
            ),
            h(
                "div",
                { className: "EezStudio_BB3Plus_ScopeOptionsRow text-muted" },
                MOUSE_HELP
            )
        );
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;

        // a row per axis
        const axes = getAxes(bb3PlusInstrument.traces);
        const axesKey = JSON.stringify(
            axes.map(axis => [
                axis.key,
                axis.traces.map(trace => [trace.key, trace.name, trace.color])
            ])
        );
        if (axesKey != this.axesKey) {
            this.axesKey = axesKey;
            this.axisRows.clear();
            this.axesElement.replaceChildren(
                ...axes.map(axis => this.createAxisRow(axis))
            );
            if (axes.length == 0) {
                this.axesElement.append(
                    h(
                        "div",
                        {
                            className:
                                "EezStudio_BB3Plus_ScopeOptionsRow text-muted"
                        },
                        "The scales of the values are here when there are traces."
                    )
                );
            }
        }
        this.updateAxisRows();

        // time
        const full = bb3PlusInstrument.scopeSpan;
        const viewSpan = bb3PlusInstrument.scopeViewSpan;
        setText(
            this.timeText,
            viewSpan != undefined
                ? `Zoomed: ${formatTime(viewSpan)} of ${formatTime(full)}`
                : `The whole span, ${formatTime(full)}`
        );
        this.showAllButton.disabled = viewSpan == undefined;

        setSelectValue(
            this.readoutSelect,
            bb3PlusInstrument.settings.scopeReadoutSize
        );

        this.channelColorsCheckbox.checked =
            bb3PlusInstrument.settings.scopeChannelColors;
    }

    // the values of the rows, the ranges of the auto axes as drawn
    updateAxisRows() {
        for (const [key, row] of this.axisRows) {
            const settings = this.bb3PlusInstrument.getScopeAxis(key);
            setSelectValue(row.mode, settings.mode);
            const range =
                settings.mode == "fixed"
                    ? settings
                    : this.scopeCanvas.getAxisRange(key);
            for (const [input, value] of [
                [row.min, range?.min],
                [row.max, range?.max]
            ] as [HTMLInputElement, number | undefined][]) {
                if (document.activeElement != input) {
                    input.value =
                        value != undefined ? formatNumber(value, 6) : "";
                    setClass(input, "is-invalid", false);
                }
            }
            // full range: auto if it isn't known
            const fullKnown = getFullRange(row.axis) != undefined;
            const auto =
                settings.mode == "auto" ||
                settings.mode == "grow" ||
                (settings.mode == "full" && !fullKnown);
            row.includeZero.checked = settings.includeZero;
            row.includeZero.disabled = !auto;
            setVisible(row.restart, settings.mode == "grow");
            setVisible(row.note, settings.mode == "full" && !fullKnown);
        }
    }

    private createAxisRow(axis: Axis) {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const key = axis.key;
        const trace = axis.traces[0];

        const mode = createSelect(
            AXIS_MODES,
            { style: { width: "150px" } },
            mode => {
                if (mode == "fixed") {
                    // the range typed in last, or the range shown now
                    const settings = bb3PlusInstrument.getScopeAxis(key);
                    const range =
                        settings.enteredMin != undefined &&
                        settings.enteredMax != undefined
                            ? {
                                  min: settings.enteredMin,
                                  max: settings.enteredMax
                              }
                            : this.scopeCanvas.getAxisRange(key);
                    bb3PlusInstrument.setScopeAxis(key, {
                        mode,
                        ...(range ?? {})
                    });
                } else {
                    if (mode == "grow") {
                        this.scopeCanvas.restartGrow(key);
                    }
                    bb3PlusInstrument.setScopeAxis(key, { mode });
                }
            }
        );

        // a value typed in fixes the scale
        const onRangeChange = () => {
            const min = parseFloat(minInput.value);
            const max = parseFloat(maxInput.value);
            const valid = isFinite(min) && isFinite(max) && min < max;
            setClass(minInput, "is-invalid", !valid);
            setClass(maxInput, "is-invalid", !valid);
            if (valid) {
                // remembered for Fixed
                bb3PlusInstrument.setScopeAxis(key, {
                    mode: "fixed",
                    min,
                    max,
                    enteredMin: min,
                    enteredMax: max
                });
            }
        };
        const createRangeInput = (title: string) =>
            h("input", {
                className: "form-control form-control-sm",
                style: { width: "100px" },
                title,
                onchange: onRangeChange,
                onkeydown: (event: KeyboardEvent) => {
                    if (event.key == "Enter") {
                        onRangeChange();
                    }
                }
            });
        const minInput = createRangeInput(
            "The lowest value shown, typing a value fixes the scale"
        );
        const maxInput = createRangeInput(
            "The highest value shown, typing a value fixes the scale"
        );

        const includeZero = h("input", {
            type: "checkbox",
            className: "form-check-input me-1",
            onchange: () =>
                bb3PlusInstrument.setScopeAxis(key, {
                    includeZero: includeZero.checked
                })
        });

        const restart = h(
            "button",
            {
                className: "btn btn-sm btn-outline-secondary",
                title: "Fit the values shown now and grow from there",
                onclick: () => this.scopeCanvas.restartGrow(key)
            },
            "Restart"
        );

        const note = h(
            "span",
            { className: "text-muted" },
            "No full range received yet, shown as Auto"
        );

        this.axisRows.set(key, {
            axis,
            mode,
            min: minInput,
            max: maxInput,
            includeZero,
            restart,
            note
        });

        return h(
            "div",
            { className: "EezStudio_BB3Plus_ScopeOptionsRow" },
            h(
                "span",
                {
                    className: "name",
                    title: axis.traces.map(trace => trace.name).join(", ")
                },
                ...axis.traces.map(trace =>
                    h("span", {
                        className: "swatch",
                        style: { backgroundColor: trace.color }
                    })
                ),
                getAxisLabel(trace)
            ),
            mode,
            h("label", null, "from"),
            minInput,
            h("label", null, "to"),
            maxInput,
            h(
                "label",
                {
                    className: "form-check-label",
                    title: "The auto scales always show the value 0"
                },
                includeZero,
                "Include 0"
            ),
            restart,
            note
        );
    }
}

function iconButton(icon: string, title: string, onclick: () => void) {
    // icon: the path data of an ICONS item
    return h(
        "button",
        {
            className:
                "btn btn-sm btn-outline-secondary EezStudio_BB3Plus_IconButton",
            title,
            onclick
        },
        svgIcon(icon)
    );
}

const TRIGGER_EDGES = [
    { value: "rising" as const, label: "Rising" },
    { value: "falling" as const, label: "Falling" }
];

// The trigger settings (BB3PlusInstrument.setScopeTrigger...) and its
// status: the mode, then (not Off) the source trace, the edge, the level of
// an analog source or the pin of a bit field, the part of the window before
// the trigger.
class TriggerBar {
    element: HTMLDivElement;
    private modeSelect: HTMLSelectElement;
    private sourceSelect = h("select", {
        className: "form-select form-select-sm",
        style: { width: "140px" },
        title: "The trace of the trigger"
    });
    private sourceKey = "";
    private edgeSelect: HTMLSelectElement;
    private levelLabel = h("label", null, "Level");
    private levelInput = h("input", {
        className: "form-control form-control-sm",
        style: { width: "100px" },
        title: "The level of the edge, also dragged in the plot (the line with the tag T)"
    });
    private bitSelect = h("select", {
        className: "form-select form-select-sm",
        style: { width: "110px" },
        title: "The pin of the edge"
    });
    private bitKey = "";
    private positionLabel = h("label", null, "Pre-trigger");
    private positionInput = h("input", {
        type: "range",
        className: "form-range",
        min: "0",
        max: "100",
        step: "5",
        style: { width: "100px" },
        title: "The part of the window before the trigger, also dragged in the plot (the trigger point line, its handle at the top)"
    });
    private positionText = h("span", { style: { width: "40px" } });
    private status = h("span", { className: "EezStudio_BB3Plus_Status" });
    // shown only with a trigger mode
    private details: HTMLElement[];

    constructor(private bb3PlusInstrument: BB3PlusInstrument) {
        this.modeSelect = createSelect<ScopeTriggerMode>(
            SCOPE_TRIGGER_MODES,
            {
                style: { width: "100px" },
                title: "Off: the samples scroll as they come. Auto: as Normal, but without a trigger for a while they scroll again. Normal: each trigger shows its window until the next one. Single: the first trigger shows its window and stops the scope (Run arms it again)."
            },
            mode => bb3PlusInstrument.setScopeTriggerMode(mode)
        );
        this.sourceSelect.addEventListener("change", () =>
            bb3PlusInstrument.setScopeTriggerSource(this.sourceSelect.value)
        );
        this.edgeSelect = createSelect(
            TRIGGER_EDGES,
            { style: { width: "90px" }, title: "The edge of the trigger" },
            edge => bb3PlusInstrument.setScopeTriggerEdge(edge)
        );
        this.levelInput.addEventListener("change", () => {
            const level = parseFloat(this.levelInput.value);
            if (isFinite(level)) {
                bb3PlusInstrument.setScopeTriggerLevel(level);
            } else {
                this.updateLevel(true);
            }
        });
        this.bitSelect.addEventListener("change", () =>
            bb3PlusInstrument.setScopeTriggerBit(Number(this.bitSelect.value))
        );
        this.positionInput.addEventListener("input", () =>
            bb3PlusInstrument.setScopeTriggerPosition(
                Number(this.positionInput.value) / 100
            )
        );

        this.details = [
            this.sourceSelect,
            this.edgeSelect,
            this.levelLabel,
            this.levelInput,
            this.bitSelect,
            this.positionLabel,
            this.positionInput,
            this.positionText,
            this.status
        ];
        // below the plot: the line between them at the top (in the color of
        // the grid, it fits both themes)
        this.element = h(
            "div",
            {
                className: "EezStudio_BB3Plus_Toolbar",
                style: {
                    borderBottom: "none",
                    borderTop: "1px solid rgba(128, 128, 128, 0.3)"
                }
            },
            h("label", null, "Trigger"),
            // the help: an info icon without a border, a background on hover
            h(
                "button",
                {
                    className: "btn btn-sm border-0",
                    style: {
                        display: "inline-flex",
                        padding: "3px",
                        color: "var(--bs-primary, #0d6efd)"
                    },
                    title: "How the trigger works",
                    onmouseenter: (event: MouseEvent) =>
                        ((event.currentTarget as HTMLElement).style.background =
                            "rgba(128, 128, 128, 0.25)"),
                    onmouseleave: (event: MouseEvent) =>
                        ((event.currentTarget as HTMLElement).style.background =
                            ""),
                    onclick: () =>
                        showTriggerHelp(
                            bb3PlusInstrument.darkTheme
                                ? TRIGGER_COLOR_DARK
                                : TRIGGER_COLOR_LIGHT
                        )
                },
                infoIcon(20)
            ),
            this.modeSelect,
            ...this.details
        );
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const settings = bb3PlusInstrument.settings;
        setSelectValue(this.modeSelect, settings.scopeTriggerMode);
        const on = settings.scopeTriggerMode != "off";
        for (const element of this.details) {
            setVisible(element, on);
        }
        if (!on) {
            return;
        }

        // the traces
        const traces = bb3PlusInstrument.traces;
        const sourceKey = JSON.stringify(
            traces.map(trace => [trace.key, trace.name])
        );
        if (sourceKey != this.sourceKey) {
            this.sourceKey = sourceKey;
            setSelectOptions(
                this.sourceSelect,
                traces.map(trace => ({ value: trace.key, label: trace.name }))
            );
        }
        const source = bb3PlusInstrument.scopeTriggerSource;
        setSelectValue(this.sourceSelect, source?.key ?? "");
        this.sourceSelect.disabled = traces.length == 0;

        setSelectValue(this.edgeSelect, settings.scopeTriggerEdge);

        // a bit field: its pins, else the level
        const bits = source?.bits ?? false;
        setVisible(this.levelLabel, !bits);
        setVisible(this.levelInput, !bits);
        setVisible(this.bitSelect, bits);
        if (bits && source) {
            const field = bb3PlusInstrument.getTraceCatalog(source)?.field;
            const numBits = field?.bits || 8;
            const pins = Array.from(
                { length: numBits },
                (_, bit) => field?.pinLabels[bit] || `Bit ${bit + 1}`
            );
            const bitKey = JSON.stringify(pins);
            if (bitKey != this.bitKey) {
                this.bitKey = bitKey;
                setSelectOptions(
                    this.bitSelect,
                    pins.map((label, bit) => ({ value: bit, label }))
                );
            }
            setSelectValue(this.bitSelect, settings.scopeTriggerBit);
        } else {
            this.updateLevel(false);
        }

        const percent = Math.round(settings.scopeTriggerPosition * 100);
        if (Number(this.positionInput.value) != percent) {
            this.positionInput.value = String(percent);
        }
        setText(this.positionText, `${percent} %`);

        this.updateStatus();
    }

    // the level of the settings, not while it is typed in (unless force)
    private updateLevel(force: boolean) {
        if (force || document.activeElement != this.levelInput) {
            const text = formatNumber(
                this.bb3PlusInstrument.settings.scopeTriggerLevel,
                6
            );
            if (this.levelInput.value != text) {
                this.levelInput.value = text;
            }
        }
    }

    // also by a timer: "triggered" and "auto" go by the time
    updateStatus() {
        const status = this.bb3PlusInstrument.scopeTriggerStatus;
        setText(this.status, status);
        setClass(this.status, "text-warning", status == "triggered");
    }
}

export class ScopeView extends BB3PlusView {
    private runButton: HTMLButtonElement;
    private rateSelect: HTMLSelectElement;
    private spanSelect: HTMLSelectElement;
    private addSelect: HTMLSelectElement;
    private addKey = "";
    private resetZoomButton: HTMLButtonElement;
    private optionsButton: HTMLButtonElement;
    private historyButton: HTMLButtonElement;
    private droppedText = h("span", {
        className: "text-warning",
        title: "BB3+ dropped them because they were not read fast enough"
    });
    private pushStatus: PushStatus;
    private samplesError = new ErrorText();
    private legend = h("div", { className: "EezStudio_BB3Plus_Legend" });
    private legendKey = "";
    private scopeCanvas: ScopeCanvas;
    private options: ScopeOptions;
    private triggerBar: TriggerBar;

    constructor(bb3PlusInstrument: BB3PlusInstrument) {
        super(bb3PlusInstrument);

        this.runButton = h("button", {
            className: "btn btn-sm",
            style: { width: "60px" },
            onclick: () =>
                bb3PlusInstrument.setScopeRunning(
                    !bb3PlusInstrument.scopeRunning
                )
        });

        this.rateSelect = createSelect(
            SCOPE_RATES.map(rate => ({ value: rate, label: formatRate(rate) })),
            {
                style: { width: "110px" },
                title: "BB3+ sends the averages of the module readings at this rate, every reading if the module doesn't read faster"
            },
            rate => bb3PlusInstrument.setScopeRate(rate)
        );

        this.spanSelect = createSelect(
            SCOPE_SPANS.map(span => ({ value: span, label: formatTime(span) })),
            { style: { width: "90px" } },
            span => bb3PlusInstrument.setScopeSpan(span)
        );

        this.addSelect = h("select", {
            className: "form-select form-select-sm",
            style: { width: "240px" },
            onchange: () => {
                const value = this.addSelect.value;
                this.addSelect.value = "";
                if (value) {
                    const [slot, fieldName] = JSON.parse(value);
                    bb3PlusInstrument.addTrace(slot, fieldName);
                }
            }
        });

        this.pushStatus = new PushStatus(bb3PlusInstrument);

        this.scopeCanvas = new ScopeCanvas(bb3PlusInstrument);
        this.addDisposer(() => this.scopeCanvas.destroy());

        this.options = new ScopeOptions(bb3PlusInstrument, this.scopeCanvas);
        this.triggerBar = new TriggerBar(bb3PlusInstrument);

        this.resetZoomButton = iconButton(
            ICONS.zoomReset,
            "Reset the zoom: the whole span, auto scales (double click on the plot)",
            () => this.scopeCanvas.resetZoom()
        );

        this.optionsButton = h(
            "button",
            {
                className:
                    "btn btn-sm btn-outline-secondary EezStudio_BB3Plus_IconButton",
                title: "Scales, zoom and the size of the cursor values",
                onclick: () =>
                    bb3PlusInstrument.setScopeShowOptions(
                        !bb3PlusInstrument.settings.scopeShowOptions
                    )
            },
            svgIcon(ICONS.scales),
            "Scales"
        );

        this.historyButton = h(
            "button",
            {
                className:
                    "btn btn-sm btn-outline-secondary EezStudio_BB3Plus_IconButton",
                title: "Add the samples of the time shown to the history of the instrument as a DLOG chart",
                onclick: () => this.addDlogToHistory()
            },
            svgIcon(ICONS.history),
            "To history"
        );

        this.element.append(
            h(
                "div",
                { className: "EezStudio_BB3Plus_Toolbar" },
                this.runButton,
                this.addSelect,
                h("label", null, "Rate"),
                this.rateSelect,
                h("label", null, "Span"),
                this.spanSelect,
                h(
                    "span",
                    { className: "btn-group" },
                    iconButton(
                        ICONS.zoomIn,
                        "Zoom in the time (mouse wheel)",
                        () => this.scopeCanvas.zoomTime(1 / BUTTON_ZOOM)
                    ),
                    iconButton(
                        ICONS.zoomOut,
                        "Zoom out the time (mouse wheel)",
                        () => this.scopeCanvas.zoomTime(BUTTON_ZOOM)
                    ),
                    this.resetZoomButton
                ),
                this.optionsButton,
                this.historyButton,
                this.droppedText,
                this.pushStatus.element,
                this.samplesError.element
            ),
            this.options.element,
            this.legend,
            this.scopeCanvas.container,
            this.triggerBar.element
        );

        this.listen(["scope", "fields"], () => this.update());
        this.listen(["status"], () => this.updateStatus());
        this.update();
        this.updateStatus();

        // the auto ranges in the options
        const timer = setInterval(() => {
            if (
                bb3PlusInstrument.settings.scopeShowOptions &&
                this.element.clientWidth > 0
            ) {
                this.options.updateAxisRows();
            }
        }, OPTIONS_UPDATE_INTERVAL);
        this.addDisposer(() => clearInterval(timer));

        // the trigger status goes by the time too ("triggered", "auto")
        const statusTimer = setInterval(() => {
            if (
                bb3PlusInstrument.settings.scopeTriggerMode != "off" &&
                this.element.clientWidth > 0
            ) {
                this.triggerBar.updateStatus();
            }
        }, TRIGGER_STATUS_INTERVAL);
        this.addDisposer(() => clearInterval(statusTimer));
    }

    // The samples of the traces in the time window shown (of the capture of
    // the trigger shown): of the fastest trace at its rate, a slower trace
    // has the sample shown at each of those times (held, not interpolated).
    // Undefined (with a warning) if there are none.
    private getWindowSamples() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const capture = bb3PlusInstrument.scopeShownCapture;
        const { start, end } = this.scopeCanvas.getTimeWindow(capture);
        const bufferOf = (trace: ScopeTrace) =>
            this.scopeCanvas.bufferOf(trace, capture);

        const traces = bb3PlusInstrument.traces.filter(
            trace => bufferOf(trace).period > 0
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

    private updateStatus() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        this.pushStatus.update();
        this.samplesError.update(bb3PlusInstrument.samplesError);
        setText(
            this.droppedText,
            `${bb3PlusInstrument.droppedSamples} samples dropped`
        );
        setVisible(this.droppedText, bb3PlusInstrument.droppedSamples > 0);
    }

    private update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const { settings, traces } = bb3PlusInstrument;

        this.scopeCanvas.invalidate();

        const running = bb3PlusInstrument.scopeRunning;
        setText(this.runButton, running ? "Stop" : "Run");
        setClass(this.runButton, "btn-secondary", running);
        setClass(this.runButton, "btn-success", !running);

        setSelectValue(this.rateSelect, settings.scopeRate);
        setSelectValue(this.spanSelect, settings.scopeSpan);

        // zoomed: the time or a fixed scale
        const zoomed =
            bb3PlusInstrument.scopeViewSpan != undefined ||
            Object.values(settings.scopeAxes).some(
                axis => axis.mode != DEFAULT_AXIS_SETTINGS.mode
            );
        this.resetZoomButton.disabled = !zoomed;

        this.triggerBar.update();

        setClass(this.optionsButton, "active", settings.scopeShowOptions);
        setVisible(this.options.element, settings.scopeShowOptions);
        if (settings.scopeShowOptions) {
            this.options.update();
        }

        // the sampled fields not shown yet
        const available = bb3PlusInstrument.sampledFields.filter(
            ({ slot, field }) =>
                !traces.find(
                    trace => trace.slot == slot && trace.fieldName == field.name
                )
        );
        const addItems = available.map(({ slot, slotFields, field }) => ({
            slot,
            slotLabel: slotFields.slotLabel || slotFields.moduleName,
            fieldName: field.name,
            name: getListName(getFieldNameParts(slotFields, field))
        }));
        const addKey = JSON.stringify(addItems);
        if (addKey != this.addKey) {
            this.addKey = addKey;
            // a group per slot
            const groups: HTMLOptGroupElement[] = [];
            for (const item of addItems) {
                const groupLabel = `Slot ${item.slot}: ${item.slotLabel}`;
                let group = groups[groups.length - 1];
                if (!group || group.label != groupLabel) {
                    group = h("optgroup", { label: groupLabel });
                    groups.push(group);
                }
                group.append(
                    h(
                        "option",
                        {
                            value: JSON.stringify([item.slot, item.fieldName]),
                            title: item.fieldName
                        },
                        item.name
                    )
                );
            }
            this.addSelect.replaceChildren(
                h("option", { value: "" }, "Add sampled field..."),
                ...groups
            );
            this.addSelect.value = "";
            this.addSelect.disabled = available.length == 0;
        }

        this.updateLegend(traces);
    }

    private updateLegend(traces: ScopeTrace[]) {
        const key = JSON.stringify(
            traces.map(trace => [
                trace.key,
                trace.name,
                trace.details,
                trace.color,
                trace.fieldIndex,
                trace.unit,
                trace.bits
            ])
        );
        if (key == this.legendKey) {
            return;
        }
        this.legendKey = key;

        if (traces.length == 0) {
            this.legend.replaceChildren(
                h(
                    "span",
                    { className: "text-muted" },
                    "Add a sampled module field to see its samples."
                )
            );
            return;
        }

        this.legend.replaceChildren(
            ...traces.map(trace => {
                const unit = trace.bits ? "" : getUnitName(trace.unit);
                const missing = trace.fieldIndex < 0;
                return h(
                    "span",
                    {
                        className: "EezStudio_BB3Plus_LegendItem",
                        title: missing
                            ? "The module in the slot doesn't have this sampled field"
                            : trace.details
                    },
                    h("span", {
                        className: "swatch",
                        style: { backgroundColor: trace.color }
                    }),
                    h(
                        "span",
                        { className: missing ? "text-muted" : "" },
                        trace.name +
                            (unit ? ` [${unit}]` : "") +
                            (missing ? " (not available)" : "")
                    ),
                    h(
                        "button",
                        {
                            className: "btn btn-sm btn-link p-0",
                            title: "Remove",
                            onclick: () =>
                                this.bb3PlusInstrument.removeTrace(trace)
                        },
                        "✕"
                    )
                );
            })
        );
    }
}
