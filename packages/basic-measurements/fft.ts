const fftJs = require("fourier-transform");
const fftAsm = require("fourier-transform/asm");
const windowing = require("fft-windowing");

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    //
    let windowSize = parseInt(task.parameters && task.parameters.windowSize) || 65536;
    if (task.xNumSamples < windowSize) {
        task.result = "Not enough data selected.";
        return;
    }

    const fft = windowSize > 8192 ? fftJs : fftAsm;

    const halfWindowSize = windowSize / 2;

    let windowFunctionName = (task.parameters && task.parameters.windowFunction) || "rectangular";
    let windowFunction;
    let windowFunctionParam;
    if (windowFunctionName !== "rectangular") {
        if (windowFunctionName.startsWith("gaussian-")) {
            windowFunction = windowing.gaussian;
            windowFunctionParam = parseFloat(windowFunctionName.slice("gaussian-".length));
        } else {
            windowFunction = windowing[windowFunctionName];
        }
    }

    //
    let minValue, maxValue;
    minValue = maxValue = task.getSampleValueAtIndex(task.xStartIndex + 0);
    for (let i = 1; i < task.xNumSamples; ++i) {
        const value = task.getSampleValueAtIndex(task.xStartIndex + i);
        if (value < minValue) {
            minValue = value;
        } else if (value > maxValue) {
            maxValue = value;
        }
    }

    //
    const input = new Float64Array(windowSize);
    const output = new Float64Array(halfWindowSize).fill(0);
    let numWindows = 0;
    for (let i = 0; i + windowSize < task.xNumSamples; i += halfWindowSize, ++numWindows) {
        for (let j = 0; j < windowSize; ++j) {
            input[j] = task.getSampleValueAtIndex(task.xStartIndex + i + j);
        }
        let spectrum = fft(windowFunction ? windowFunction(input, windowFunctionParam) : input);
        for (let j = 0; j < halfWindowSize; ++j) {
            output[j] += spectrum[j];
        }
    }

    //
    const scale = 1 / (2 * (maxValue - minValue) * numWindows);

    function toDecibels(i: number) {
        return 20 * Math.log10(output[i] * scale);
    }

    const data = new Array(halfWindowSize);
    minValue = maxValue = data[0] = toDecibels(0);
    for (let i = 1; i < halfWindowSize; ++i) {
        data[i] = toDecibels(i);
        if (data[i] < minValue) {
            minValue = data[i];
        } else if (data[i] > maxValue) {
            maxValue = data[i];
        }
    }

    //
    task.result = {
        data,
        samplingRate: windowSize / task.samplingRate,
        xAxes: {
            unit: "frequency",
            logarithmic:
                !task.parameters || !task.parameters.axis || task.parameters.axis !== "linear"
        },
        yAxes: {
            unit: "decibel",
            minValue,
            maxValue
        }
    };
}
