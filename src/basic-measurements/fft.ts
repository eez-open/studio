const fftJs = require("fourier-transform");
const fftAsm = require("fourier-transform/asm");
const decibels = require("decibels");
const windowing = require("fft-windowing");

import { IMeasureTask } from "shared/extensions/extension";

export default function(task: IMeasureTask) {
    let windowSize = (task.parameters && task.parameters.windowSize) || 1024;
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

    const input = new Array(windowSize);

    const output = new Array(halfWindowSize);
    for (let i = 0; i < halfWindowSize; ++i) {
        output[i] = 0;
    }

    let numWindows = Math.floor(task.xNumSamples / windowSize);
    for (let iWindow = 0; iWindow < numWindows; ++iWindow) {
        for (let i = 0; i < windowSize; ++i) {
            input[i] = task.getSampleValueAtIndex(task.xStartIndex + iWindow * windowSize + i);
        }

        let spectrum;
        if (windowFunction) {
            spectrum = fft(windowFunction(input, windowFunctionParam));
        } else {
            spectrum = fft(input);
        }

        for (let i = 0; i < halfWindowSize; ++i) {
            output[i] += spectrum[i];
        }
    }

    let minValue;
    let maxValue;

    for (let i = 0; i < halfWindowSize; ++i) {
        output[i] = decibels.fromGain(output[i] / numWindows);

        if (output[i] !== -Infinity) {
            if (minValue === undefined) {
                minValue = maxValue = output[i];
            } else {
                if (output[i] < minValue) {
                    minValue = output[i];
                } else if (output[i] > maxValue) {
                    maxValue = output[i];
                }
            }
        }
    }

    if (minValue !== undefined) {
        const d = 0.1 * (maxValue - minValue);
        minValue -= d;
        maxValue += d;
    } else {
        minValue = -1;
        maxValue = 1;
    }

    task.result = {
        data: output,
        samplingRate: windowSize / task.samplingRate,
        xAxes: {
            unit: "frequency"
        },
        yAxes: {
            unit: "decibel",
            minValue,
            maxValue
        }
    };
}
