const fft = require("fourier-transform");

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    let windowSize = Math.min(Math.pow(2, Math.round(Math.log2(task.xNumSamples))), 65536 * 2);

    // resampling
    const input = new Float64Array(windowSize);
    for (let i = 0; i < windowSize; ++i) {
        input[i] = task.getSampleValueAtIndex(
            task.xStartIndex + Math.round(i * (task.xNumSamples / windowSize))
        );
    }

    let spectrum = fft(input);

    let N = spectrum.length;
    const output = new Array(N);

    let minValue;
    let maxValue;

    output[0] = 20 * Math.log10(spectrum[0]);
    minValue = maxValue = output[0];
    for (let i = 1; i < N; ++i) {
        output[i] = 20 * Math.log10(spectrum[i]);
        if (output[i] < minValue) {
            minValue = output[i];
        } else if (output[i] > maxValue) {
            maxValue = output[i];
        }
    }

    const d = 0.05 * (maxValue - minValue);
    minValue -= d;
    maxValue += d;

    task.result = {
        data: output,
        samplingRate: task.xNumSamples / task.samplingRate,
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
