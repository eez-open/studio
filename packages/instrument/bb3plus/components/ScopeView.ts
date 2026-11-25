import {
    BB3PlusInstrument,
    ScopeTrace,
    ScopeAxisMode,
    ScopeAxisSettings,
    DEFAULT_AXIS_SETTINGS,
    SCOPE_RATES,
    SCOPE_SPANS,
    READOUT_SIZES
} from "instrument/bb3plus/BB3PlusInstrument";
import { getUnitName, formatNumber } from "instrument/bb3plus/fields-model";
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
    svgIcon
} from "instrument/bb3plus/components/dom";

const AXIS_WIDTH = 58;
const TIME_AXIS_HEIGHT = 22;
// above each plot: the units of its axes
const PLOT_GAP = 18;
const TOP_MARGIN = 18;
const RIGHT_MARGIN = 12;
const FONT = "11px Roboto, sans-serif";

const TRACE_LINE_WIDTH = 1.5;

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

// The envelope of a trace (SampleBuffer.getWindowPoints): a rectangle per
// pixel column from its minimum to its maximum, on whole device pixels.
// Rectangles are the cheapest to rasterize (a line or a polygon through the
// columns of a fast signal has thousands of steep antialiased edges, too slow
// for a large canvas). A column is at least as high as the trace line, so a
// flat signal is still a line; the columns of the same height are one
// rectangle.
function fillEnvelope(
    ctx: CanvasRenderingContext2D,
    points: TracePoints,
    timeToX: (time: number) => number,
    valueToY: (value: number) => number,
    ratio: number
) {
    const { times, values } = points;
    const toPixel = (value: number) => Math.round(value * ratio) / ratio;
    const minHeight = Math.max(1 / ratio, toPixel(TRACE_LINE_WIDTH));

    // the columns: x, top and bottom (NaN: a gap)
    const xs: number[] = [];
    const tops: number[] = [];
    const bottoms: number[] = [];
    let i = 0;
    while (i < values.length) {
        xs.push(toPixel(timeToX(times[i])));
        if (isNaN(values[i])) {
            tops.push(NaN);
            bottoms.push(NaN);
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
        tops.push(Math.floor(top * ratio) / ratio);
        bottoms.push(Math.ceil(bottom * ratio) / ratio);
        i += 2;
    }

    const n = xs.length;
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
}

interface TimeWindow {
    start: number;
    end: number;
    span: number;
    // the time labels are relative to it: the newest sample or the stop time
    ref: number;
}

type Hit =
    | { kind: "axis"; axis: AxisLayout }
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
    private layout: Layout | undefined;
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
            // running: again when the window moved by a pixel (a long span
            // moves less than a pixel per frame)
            const lastDraw = this.lastDraw;
            if (
                lastDraw &&
                Math.abs(
                    this.bb3PlusInstrument.getNewestSampleTime() - lastDraw.end
                ) < lastDraw.secondsPerPixel
            ) {
                return;
            }
        }
        this.needsDraw = false;
        this.draw();
    };

    ////////////////////////////////////////////////////////////////////////////
    // zoom

    // the time window shown
    getTimeWindow(): TimeWindow {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const full = bb3PlusInstrument.scopeSpan;
        const span = Math.min(bb3PlusInstrument.scopeViewSpan ?? full, full);
        if (bb3PlusInstrument.scopeRunning) {
            const end = bb3PlusInstrument.getNewestSampleTime();
            return { start: end - span, end, span, ref: end };
        }
        const ref = bb3PlusInstrument.scopeStopTime;
        const end = clamp(
            bb3PlusInstrument.scopeViewEnd ?? ref,
            ref - full + span,
            ref
        );
        return { start: end - span, end, span, ref };
    }

    private getMinViewSpan() {
        let period = 0;
        for (const trace of this.bb3PlusInstrument.traces) {
            const tracePeriod = trace.buffer.period;
            if (tracePeriod > 0 && (period == 0 || tracePeriod < period)) {
                period = tracePeriod;
            }
        }
        return Math.max(MIN_VIEW_SPAN, period * MIN_VIEW_SAMPLES);
    }

    // a time window of span seconds ending at end (while stopped)
    private setTimeWindow(span: number, end: number | undefined) {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const full = bb3PlusInstrument.scopeSpan;
        span = clamp(span, this.getMinViewSpan(), full);
        if (span >= full * 0.999) {
            bb3PlusInstrument.setScopeView(undefined, undefined);
            return;
        }
        if (end != undefined) {
            const ref = bb3PlusInstrument.scopeStopTime;
            end = clamp(end, ref - full + span, ref);
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
        } else if (event.shiftKey || event.button == 1 || event.button == 2) {
            this.drag = {
                kind: "move",
                plot: hit.plot,
                x0: x,
                y0: y,
                window: this.getTimeWindow(),
                ranges: hit.plot.axes.map(axis => ({
                    min: axis.min,
                    max: axis.max
                })),
                movedTime: false,
                movedValues: false,
                before: this.getZoomState()
            };
        } else if (event.button == 0) {
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
        if (drag.kind != "box") {
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
                hit?.kind == "axis"
                    ? "ns-resize"
                    : hit?.kind == "plot"
                      ? "crosshair"
                      : "";
            return;
        }

        if (drag.kind == "box") {
            drag.x1 = x;
            drag.y1 = y;
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
        } else if (hit?.kind == "plot") {
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
            for (const axis of hit.plot.axes) {
                this.zoomAxis(axis, factor, this.yToValue(axis, hit.plot, y));
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
        const timeWindow = this.getTimeWindow();
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

        // the points of the window
        const points = new Map<ScopeTrace, TracePoints>();
        for (const trace of traces) {
            points.set(
                trace,
                trace.buffer.getWindowPoints(start, end, plotWidth)
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
            axes: []
        };

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
                    ctx.strokeStyle = trace.color;
                    ctx.lineWidth = TRACE_LINE_WIDTH;
                    ctx.beginPath();
                    let drawing = false;
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
                        lastY = y;
                    }
                    if (drawing && trace.bits) {
                        // the last value up to the newest time shown
                        ctx.lineTo(
                            timeToX(
                                Math.min(trace.buffer.getNewestTime(), end)
                            ),
                            lastY
                        );
                    }
                    ctx.stroke();
                }
                ctx.restore();
            });
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

        const rows: { trace: ScopeTrace; name: string; value: string }[] = [];
        for (const plot of plots) {
            for (const axis of plot.axes) {
                for (const trace of axis.traces) {
                    if (!points.has(trace)) {
                        continue;
                    }
                    const value = trace.buffer.getValueAt(time, trace.bits);
                    const unit = trace.bits ? "" : getUnitName(trace.unit);
                    rows.push({
                        trace,
                        name: trace.label,
                        value: isNaN(value)
                            ? "-"
                            : formatNumber(value, 6) + (unit ? " " + unit : "")
                    });
                    if (!isNaN(value)) {
                        // the dot on the trace
                        const y =
                            plot.bottom -
                            ((value - axis.min) / (axis.max - axis.min)) *
                                (plot.bottom - plot.top);
                        if (y >= plot.top && y <= plot.bottom) {
                            ctx.fillStyle = trace.color;
                            ctx.beginPath();
                            ctx.arc(mouseX, y, 3.5, 0, Math.PI * 2);
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
        const headerWidth = ctx.measureText(header).width;
        const valueWidth = Math.max(
            ...rows.map(row => ctx.measureText(row.value).width)
        );
        ctx.font = nameFont;
        const nameWidth = Math.max(
            ...rows.map(row => ctx.measureText(row.name).width)
        );

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
// the values at the cursor
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
            axes.map(axis => [axis.key, axis.traces.map(trace => trace.key)])
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
                    title: axis.traces.map(trace => trace.label).join(", ")
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

export class ScopeView extends BB3PlusView {
    private runButton: HTMLButtonElement;
    private rateSelect: HTMLSelectElement;
    private spanSelect: HTMLSelectElement;
    private addSelect: HTMLSelectElement;
    private addKey = "";
    private resetZoomButton: HTMLButtonElement;
    private optionsButton: HTMLButtonElement;
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
                title: "BB3+ samples the fields at least this fast, up to the max sample rate of each field"
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

        this.element.append(
            h(
                "div",
                { className: "EezStudio_BB3Plus_Toolbar" },
                this.runButton,
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
                this.addSelect,
                this.droppedText,
                this.pushStatus.element,
                this.samplesError.element
            ),
            this.options.element,
            this.legend,
            this.scopeCanvas.container
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
        const addKey = JSON.stringify(
            available.map(({ slot, field }) => [slot, field.name])
        );
        if (addKey != this.addKey) {
            this.addKey = addKey;
            setSelectOptions(this.addSelect, [
                { value: "", label: "Add sampled field..." },
                ...available.map(({ slot, field }) => ({
                    value: JSON.stringify([slot, field.name]),
                    label: `${slot}: ${field.name}`
                }))
            ]);
            this.addSelect.value = "";
            this.addSelect.disabled = available.length == 0;
        }

        this.updateLegend(traces);
    }

    private updateLegend(traces: ScopeTrace[]) {
        const key = JSON.stringify(
            traces.map(trace => [
                trace.key,
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
                            : undefined
                    },
                    h("span", {
                        className: "swatch",
                        style: { backgroundColor: trace.color }
                    }),
                    h(
                        "span",
                        { className: missing ? "text-muted" : "" },
                        trace.label +
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
