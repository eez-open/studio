const fftJs = require("fourier-transform");
const fftAsm = require("fourier-transform/asm");
const decibels = require("decibels");
const windowing = require("fft-windowing");

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    let windowSize = Math.pow(2, Math.floor(Math.log(task.xNumSamples) / Math.log(2)));
    if (windowSize < 128) {
        task.result = "Not enough data selected.";
        return;
    }
    if (windowSize > 65536) {
        windowSize = 65536;
    }

    const fft = windowSize > 8192 ? fftJs : fftAsm;

    const halfWindowSize = windowSize / 2;

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

        let spectrum = fft(windowing.gaussian(input, 3.5));

        for (let i = 0; i < halfWindowSize; ++i) {
            output[i] += spectrum[i];
        }
    }

    let maxValue;
    let frequency = 1;

    for (let i = 1; i < halfWindowSize; ++i) {
        const value = decibels.fromGain(output[i] / numWindows);

        if (value !== -Infinity && value !== Infinity) {
            if (maxValue === undefined || value > maxValue) {
                maxValue = value;
                frequency = (i * task.samplingRate) / windowSize;
            }
        }
    }

    task.result = frequency;
    task.resultUnit = "frequency";
}
