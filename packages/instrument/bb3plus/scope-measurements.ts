// The measurements of the scope traces: of the samples of the time window
// shown (SampleBuffer.getStats), in the channel cards (mean, peak to peak) and
// in the measure bar (the ones chosen per trace).

import type { SampleStats } from "instrument/bb3plus/sample-buffer";
import { formatNumber } from "instrument/bb3plus/fields-model";

export type MeasurementKind =
    | "mean"
    | "rms"
    | "min"
    | "max"
    | "pkpk"
    | "freq"
    | "period";

export const MEASUREMENTS: {
    kind: MeasurementKind;
    label: string;
    title: string;
}[] = [
    { kind: "mean", label: "Mean", title: "The average of the samples shown" },
    {
        kind: "rms",
        label: "RMS",
        title: "The root mean square of the samples shown"
    },
    { kind: "max", label: "Max", title: "The highest sample shown" },
    { kind: "min", label: "Min", title: "The lowest sample shown" },
    {
        kind: "pkpk",
        label: "Pk-Pk",
        title: "The highest minus the lowest sample shown"
    },
    {
        kind: "freq",
        label: "Frequency",
        title: "1 / period"
    },
    {
        kind: "period",
        label: "Period",
        title: "The average time between the rising edges through the middle of the lowest and the highest sample shown (at least two edges)"
    }
];

export function isMeasurementKind(value: any): value is MeasurementKind {
    return MEASUREMENTS.some(measurement => measurement.kind == value);
}

export function getMeasurementLabel(kind: MeasurementKind) {
    return MEASUREMENTS.find(measurement => measurement.kind == kind)!.label;
}

export function getMeasurementValue(stats: SampleStats, kind: MeasurementKind) {
    switch (kind) {
        case "mean":
            return stats.mean;
        case "rms":
            return stats.rms;
        case "min":
            return stats.min;
        case "max":
            return stats.max;
        case "pkpk":
            return stats.max - stats.min;
        case "freq":
            return stats.frequency;
        case "period":
            return stats.period;
    }
}

// The value with 4 significant digits, the zeros at the end kept (the width
// doesn't change as the value does), no exponent below 10000.
export function formatDigits(value: number, digits: number = 4) {
    if (!isFinite(value)) {
        return "—";
    }
    if (Math.abs(value) >= Math.pow(10, digits)) {
        return value.toFixed(0);
    }
    if (value == 0) {
        return (0).toFixed(digits - 1);
    }
    const text = value.toPrecision(digits);
    return text.indexOf("e") == -1 ? text : formatNumber(value, digits);
}

// a measurement with its unit (the unit of the trace, Hz or seconds), "—"
// without the stats or without the edges of a period
export function formatMeasurement(
    stats: SampleStats | undefined,
    kind: MeasurementKind,
    unit: string
) {
    const value = stats ? getMeasurementValue(stats, kind) : NaN;
    if (!isFinite(value)) {
        return "—";
    }
    if (kind == "freq") {
        return value >= 1e6
            ? `${formatDigits(value / 1e6)} MHz`
            : value >= 1e3
              ? `${formatDigits(value / 1e3)} kHz`
              : `${formatDigits(value)} Hz`;
    }
    if (kind == "period") {
        return value < 1e-3
            ? `${formatDigits(value * 1e6)} us`
            : value < 1
              ? `${formatDigits(value * 1e3)} ms`
              : `${formatDigits(value)} s`;
    }
    return formatDigits(value) + (unit ? " " + unit : "");
}
