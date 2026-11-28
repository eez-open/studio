// The measurements of the scope traces: of the samples of the time window
// shown (SampleBuffer.getStats), in the channel cards (mean, peak to peak) and
// in the measure bar (the ones chosen per trace).

import type {
    SampleStats,
    StatsOptions
} from "instrument/bb3plus/sample-buffer";
import { formatNumber } from "instrument/bb3plus/fields-model";

export type MeasurementKind =
    | "mean"
    | "rms"
    | "acrms"
    | "max"
    | "min"
    | "pkpk"
    | "top"
    | "base"
    | "amplitude"
    | "overshoot"
    | "undershoot"
    | "freq"
    | "period"
    | "rise"
    | "fall"
    | "pwidth"
    | "nwidth"
    | "pduty"
    | "nduty";

// A measurement: of the values or of the time (the groups of the menus),
// what getStats measures for it (basic: always), the unit of its value (the
// unit of the trace, %, seconds, hertz), the value from the stats.
interface Measurement {
    kind: MeasurementKind;
    label: string;
    title: string;
    group: "values" | "time";
    needs: "basic" | "levels" | "edges";
    unit: "trace" | "percent" | "time" | "frequency";
    value: (stats: SampleStats) => number;
}

const EDGES =
    "The edges go from the base + 10 % of the amplitude to the top - 10 % (rising) or back (falling).";

export const MEASUREMENT_GROUPS: {
    group: Measurement["group"];
    label: string;
}[] = [
    { group: "values", label: "Values" },
    { group: "time", label: "Time" }
];

export const MEASUREMENTS: Measurement[] = [
    {
        kind: "mean",
        label: "Mean",
        title: "The average of the samples shown",
        group: "values",
        needs: "basic",
        unit: "trace",
        value: stats => stats.mean
    },
    {
        kind: "rms",
        label: "RMS",
        title: "The root mean square of the samples shown",
        group: "values",
        needs: "basic",
        unit: "trace",
        value: stats => stats.rms
    },
    {
        kind: "acrms",
        label: "AC RMS",
        title: "The RMS of the samples shown minus their mean (the standard deviation): the ripple and the noise",
        group: "values",
        needs: "basic",
        unit: "trace",
        value: stats => stats.acRms
    },
    {
        kind: "max",
        label: "Max",
        title: "The highest sample shown",
        group: "values",
        needs: "basic",
        unit: "trace",
        value: stats => stats.max
    },
    {
        kind: "min",
        label: "Min",
        title: "The lowest sample shown",
        group: "values",
        needs: "basic",
        unit: "trace",
        value: stats => stats.min
    },
    {
        kind: "pkpk",
        label: "Pk-Pk",
        title: "The highest minus the lowest sample shown",
        group: "values",
        needs: "basic",
        unit: "trace",
        value: stats => stats.max - stats.min
    },
    {
        kind: "top",
        label: "Top",
        title: "The most common value of the upper half of the samples shown (a flat top), else the highest one (a sine)",
        group: "values",
        needs: "levels",
        unit: "trace",
        value: stats => stats.top
    },
    {
        kind: "base",
        label: "Base",
        title: "The most common value of the lower half of the samples shown (a flat base), else the lowest one (a sine)",
        group: "values",
        needs: "levels",
        unit: "trace",
        value: stats => stats.base
    },
    {
        kind: "amplitude",
        label: "Amplitude",
        title: "Top - base",
        group: "values",
        needs: "levels",
        unit: "trace",
        value: stats => stats.amplitude
    },
    {
        kind: "overshoot",
        label: "Overshoot",
        title: "(Max - top) / amplitude",
        group: "values",
        needs: "levels",
        unit: "percent",
        value: stats => stats.overshoot
    },
    {
        kind: "undershoot",
        label: "Undershoot",
        title: "(Base - min) / amplitude",
        group: "values",
        needs: "levels",
        unit: "percent",
        value: stats => stats.undershoot
    },
    {
        kind: "freq",
        label: "Frequency",
        title: "1 / period",
        group: "time",
        needs: "edges",
        unit: "frequency",
        value: stats => stats.frequency
    },
    {
        kind: "period",
        label: "Period",
        title: `The average time between the rising edges shown, at the middle of the amplitude (at least two edges). ${EDGES}`,
        group: "time",
        needs: "edges",
        unit: "time",
        value: stats => stats.period
    },
    {
        kind: "rise",
        label: "Rise time",
        title: `The average time of the rising edges shown from 10 % to 90 % of the amplitude, not shorter than the samples show. ${EDGES}`,
        group: "time",
        needs: "edges",
        unit: "time",
        value: stats => stats.riseTime
    },
    {
        kind: "fall",
        label: "Fall time",
        title: `The average time of the falling edges shown from 90 % to 10 % of the amplitude, not shorter than the samples show. ${EDGES}`,
        group: "time",
        needs: "edges",
        unit: "time",
        value: stats => stats.fallTime
    },
    {
        kind: "pwidth",
        label: "+Width",
        title: `The average time from a rising to the next falling edge shown, at the middle of the amplitude. ${EDGES}`,
        group: "time",
        needs: "edges",
        unit: "time",
        value: stats => stats.positiveWidth
    },
    {
        kind: "nwidth",
        label: "−Width",
        title: `The average time from a falling to the next rising edge shown, at the middle of the amplitude. ${EDGES}`,
        group: "time",
        needs: "edges",
        unit: "time",
        value: stats => stats.negativeWidth
    },
    {
        kind: "pduty",
        label: "+Duty",
        title: "+Width / period",
        group: "time",
        needs: "edges",
        unit: "percent",
        value: stats => stats.positiveDuty
    },
    {
        kind: "nduty",
        label: "−Duty",
        title: "−Width / period",
        group: "time",
        needs: "edges",
        unit: "percent",
        value: stats => stats.negativeDuty
    }
];

export function isMeasurementKind(value: any): value is MeasurementKind {
    return MEASUREMENTS.some(measurement => measurement.kind == value);
}

export function getMeasurement(kind: MeasurementKind) {
    return MEASUREMENTS.find(measurement => measurement.kind == kind)!;
}

// what getStats has to measure for the measurements
export function getStatsOptions(kinds: MeasurementKind[]): StatsOptions {
    const needs = kinds.map(kind => getMeasurement(kind).needs);
    return {
        levels: needs.includes("levels"),
        edges: needs.includes("edges")
    };
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

// a measurement with its unit (the unit of the trace, %, Hz or seconds), "—"
// without the stats or without the value (a period without two edges)
export function formatMeasurement(
    stats: SampleStats | undefined,
    kind: MeasurementKind,
    unit: string
) {
    const measurement = getMeasurement(kind);
    const value = stats ? measurement.value(stats) : NaN;
    if (!isFinite(value)) {
        return "—";
    }
    switch (measurement.unit) {
        case "frequency":
            return value >= 1e6
                ? `${formatDigits(value / 1e6)} MHz`
                : value >= 1e3
                  ? `${formatDigits(value / 1e3)} kHz`
                  : `${formatDigits(value)} Hz`;
        case "time":
            return value < 1e-3
                ? `${formatDigits(value * 1e6)} us`
                : value < 1
                  ? `${formatDigits(value * 1e3)} ms`
                  : `${formatDigits(value)} s`;
        case "percent":
            return `${formatDigits(value, 3)} %`;
        default:
            return formatDigits(value) + (unit ? " " + unit : "");
    }
}
