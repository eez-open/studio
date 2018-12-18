import { IMeasureTask } from "eez-studio-shared/extensions/extension";

import { transformBluestein } from "./fft-algo";

export default function(task: IMeasureTask) {
    const numSamples = Math.min(65536, task.xNumSamples);

    var real = new Array(numSamples);
    var imaginary = new Array(numSamples);

    for (let i = 0; i < numSamples; ++i) {
        real[i] = task.getSampleValueAtIndex(
            task.xStartIndex + Math.floor((i * task.xNumSamples) / numSamples)
        );
        imaginary[i] = 0;
    }

    transformBluestein(real, imaginary);

    //Ignore 0 frequency part when trying to get frequency. Offset can be bigger than wave amplitude and cause issues.
    var startingIndex = 1;
    var maxMag = Math.sqrt(
        Math.pow(real[startingIndex], 2) + Math.pow(imaginary[startingIndex], 2)
    );
    var indexMax = startingIndex;
    for (var i = startingIndex + 1; i < real.length / 2; i++) {
        var magnitude = Math.sqrt(Math.pow(real[i], 2) + Math.pow(imaginary[i], 2));
        if (magnitude > maxMag) {
            maxMag = magnitude;
            indexMax = i;
        }
    }
    var step = task.samplingRate / task.xNumSamples;
    var frequency = indexMax * step;

    task.result = 1 / frequency;
    task.resultUnit = "time";
}
