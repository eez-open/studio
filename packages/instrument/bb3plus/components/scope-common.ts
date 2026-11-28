// Helpers of the scope view and its panels: formats, ticks, the Y axes.

import type {
    ScopeTrace,
    ScopeAxisMode
} from "instrument/bb3plus/BB3PlusInstrument";
import { getUnitName, formatNumber } from "instrument/bb3plus/fields-model";

// the trigger point handle, on a dark and on a light background
export const TRIGGER_COLOR_DARK = "#FFB020";
export const TRIGGER_COLOR_LIGHT = "#E08A00";

// the zoom factor of the zoom buttons
export const BUTTON_ZOOM = 2;

export const AXIS_MODES: {
    value: ScopeAxisMode;
    label: string;
    title: string;
}[] = [
    { value: "auto", label: "Auto", title: "Fits the values shown" },
    {
        value: "grow",
        label: "Grow",
        title: "Fits the values shown since it was set (or restarted), it only grows"
    },
    { value: "fixed", label: "Fixed", title: "From Min to Max" },
    {
        value: "full",
        label: "Full",
        title: "The full range of the fields (Auto until BB3+ sends it)"
    }
];

export function formatRate(rate: number) {
    return rate >= 1000 ? `${rate / 1000} kSPS` : `${rate} SPS`;
}

export function formatTime(seconds: number) {
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

// with the typographic minus, a plus before a positive value if sign
export function withSign(text: string, value: number, sign: boolean) {
    if (value < 0) {
        return "−" + text.replace(/^-/, "");
    }
    return sign && value > 0 ? "+" + text : text;
}

// the unit of the time labels for the largest of them (seconds)
export function getTimeUnit(largest: number) {
    return largest < 1e-3
        ? { scale: 1e6, name: "us" }
        : largest < 1
          ? { scale: 1e3, name: "ms" }
          : { scale: 1, name: "s" };
}

// the 1, 2, 5 step for about count values from min to max
export function getTickStep(min: number, max: number, count: number) {
    const rough = (max - min) / Math.max(1, count);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;
    return (
        (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) *
        magnitude
    );
}

// the smallest 1, 2, 5 step at least as large as value
export function getStepAtLeast(value: number) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    return (
        (normalized <= 1 + 1e-9
            ? 1
            : normalized <= 2 + 1e-9
              ? 2
              : normalized <= 5 + 1e-9
                ? 5
                : 10) * magnitude
    );
}

// the 1, 2, 5 step after step
export function getNextStep(step: number) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
    const normalized = Math.round(step / magnitude);
    return (normalized == 1 ? 2 : normalized == 2 ? 5 : 10) * magnitude;
}

// the multiples of step from min to max
export function getTicksWithStep(min: number, max: number, step: number) {
    const ticks: number[] = [];
    if (!(max - min > 0) || !(step > 0)) {
        return ticks;
    }
    for (
        let value = Math.ceil(min / step - 1e-9) * step;
        value <= max + step * 1e-9;
        value += step
    ) {
        // no -0 and no 0.30000000000000004
        ticks.push(Math.abs(value) < step * 1e-9 ? 0 : +value.toPrecision(12));
    }
    return ticks;
}

// about count values from min to max at a 1, 2, 5 step
export function getTicks(min: number, max: number, count: number) {
    if (!(max - min > 0) || count < 1) {
        return [];
    }
    return getTicksWithStep(min, max, getTickStep(min, max, count));
}

export function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

// the Y axis of a trace: one per unit of the float fields, one for the
// integer fields (drawn as steps in the lower plot)
export function getAxisKey(trace: ScopeTrace) {
    return trace.bits ? "bits" : "unit" + trace.unit;
}

export interface Range {
    min: number;
    max: number;
}

export interface Axis {
    key: string;
    label: string;
    traces: ScopeTrace[];
    min: number;
    max: number;
}

// The axes of the traces, the integer fields last: of the traces drawn (not
// hidden), or of all of them. A trace whose field the module doesn't have
// has none.
export function getAxes(traces: ScopeTrace[], withHidden: boolean = false) {
    const axes: Axis[] = [];
    for (const trace of traces) {
        if (trace.fieldIndex < 0 || (trace.hidden && !withHidden)) {
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

// the full range of the traces of the axis, undefined if it isn't known
// for all of them
export function getFullRange(axis: Axis): Range | undefined {
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

// what the values of the unit are
const QUANTITIES: { [unit: string]: string } = {
    V: "Voltage",
    mV: "Voltage",
    Vpp: "Voltage",
    mVpp: "Voltage",
    A: "Current",
    mA: "Current",
    uA: "Current",
    App: "Current",
    mApp: "Current",
    uApp: "Current",
    W: "Power",
    mW: "Power",
    VA: "Apparent power",
    VAR: "Reactive power",
    s: "Time",
    ms: "Time",
    min: "Time",
    "°C": "Temperature",
    rpm: "Speed",
    Ω: "Resistance",
    kΩ: "Resistance",
    MΩ: "Resistance",
    Hz: "Frequency",
    mHz: "Frequency",
    kHz: "Frequency",
    MHz: "Frequency",
    J: "Energy",
    F: "Capacitance",
    mF: "Capacitance",
    uF: "Capacitance",
    nF: "Capacitance",
    pF: "Capacitance",
    "°": "Angle"
};

// the name of the axis in the scales panel: "Voltage axis (V)"
export function getAxisName(axis: Axis) {
    if (axis.key == "bits") {
        return "Integer fields";
    }
    if (!axis.label) {
        return "Values without a unit";
    }
    const quantity = QUANTITIES[axis.label];
    return quantity ? `${quantity} axis (${axis.label})` : `Axis ${axis.label}`;
}

// the title above the axis: the traces and the unit, "U · V"
export function getAxisTitle(axis: Axis) {
    const names = axis.traces.map(trace => trace.name).join(", ");
    return axis.label ? `${names} · ${axis.label}` : names;
}
