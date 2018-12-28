import { IMeasureTask } from "eez-studio-shared/extensions/extension";

import { transform } from "./fft-algo";

export default function(task: IMeasureTask) {
    let numSamples = Math.min(
        Math.pow(2, Math.floor(Math.log(task.xNumSamples) / Math.log(2))),
        1024 * 1024
    );

    var real = new Float64Array(numSamples);
    var imag = new Float64Array(numSamples).fill(0);

    for (let i = 0; i < numSamples; ++i) {
        real[i] = task.getSampleValueAtIndex(
            task.xStartIndex + Math.floor((i * task.xNumSamples) / numSamples)
        );
    }

    transform(real, imag);

    // Ignore 0 frequency part when trying to get frequency. Offset can be bigger than wave amplitude and cause issues.
    var maxMag = real[1] * real[1] + imag[1] * imag[1];
    var indexMax = 1;
    for (var i = 2; i < real.length / 2; i++) {
        var magnitude = real[i] * real[i] + imag[i] * imag[i];
        if (magnitude > maxMag) {
            maxMag = magnitude;
            indexMax = i;
        }
    }
    var step = task.samplingRate / task.xNumSamples;
    var frequency = indexMax * step;

    task.result = frequency;
    task.resultUnit = "frequency";
}
