import { IMeasureTask } from "eez-studio-shared/extensions/extension";

// import { transformBluestein } from "./fft-algo";

import getFrequency from "./frequency";

export default function(task: IMeasureTask) {
    // var real = new Array(task.xNumSamples);
    // var imaginary = new Array(task.xNumSamples);

    // for (let i = 0; i < task.xNumSamples; ++i) {
    //     real[i] = task.getSampleValueAtIndex(task.xStartIndex + i);
    //     imaginary[i] = 0;
    // }

    // transformBluestein(real, imaginary);

    // //Ignore 0 frequency part when trying to get frequency. Offset can be bigger than wave amplitude and cause issues.
    // var startingIndex = 1;
    // var maxMag = Math.sqrt(
    //     Math.pow(real[startingIndex], 2) + Math.pow(imaginary[startingIndex], 2)
    // );
    // var indexMax = 0;
    // for (var i = startingIndex + 1; i < real.length / 2; i++) {
    //     var magnitude = Math.sqrt(Math.pow(real[i], 2) + Math.pow(imaginary[i], 2));
    //     if (magnitude > maxMag) {
    //         maxMag = magnitude;
    //         indexMax = i;
    //     }
    // }
    // var step = task.samplingRate / task.xNumSamples;
    // var frequency = indexMax * step;

    // task.result = frequency;
    // task.resultUnit = "frequency";

    getFrequency(task);
    if (typeof task.result === "number") {
        task.result = 1 / (task.result as number);
        task.resultUnit = "time";
    }
}
