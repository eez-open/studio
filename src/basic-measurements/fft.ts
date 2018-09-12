const fft = require("fourier-transform/asm");
const db = require("decibels");

import { IMeasureTask } from "shared/extensions/extension";

export default function(task: IMeasureTask) {
    const windowSize = 1024;
    const halfWindowSize = windowSize / 2;

    if (task.xNumSamples < windowSize) {
        task.result = null;
        return;
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
        const spectrum = fft(input);

        for (let i = 0; i < halfWindowSize; ++i) {
            output[i] += spectrum[i];
        }
    }

    for (let i = 0; i < halfWindowSize; ++i) {
        output[i] = db.fromGain(output[i] / numWindows);
    }

    task.result = {
        data: output,
        samplingRate: windowSize / task.xSamplingRate,
        xAxes: {
            unit: "frequency"
        },
        yAxes: {
            unit: "decibel"
        }
    };
}
