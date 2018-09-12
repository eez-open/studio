const fftJs = require("fft-js");
const fft = fftJs.fft;
const fftUtil = fftJs.util;

import { IMeasureTask } from "shared/extensions/extension";

export default function(task: IMeasureTask) {
    const n = Math.min(1024, Math.pow(2, Math.floor(Math.log2(task.xNumSamples))));
    const signal = new Array(n);
    for (let i = 0; i < n; ++i) {
        signal[i] = task.getSampleValueAtIndex(
            Math.floor(task.xStartIndex + (i * task.xNumSamples) / n)
        );
    }
    const complexCoef = fft(signal);

    const frequencies = fftUtil.fftFreq(complexCoef, task.xSamplingRate);
    const magnitudes = fftUtil.fftMag(complexCoef);

    if (magnitudes.length === 0) {
        task.result = null;
    } else {
        let samplingRate = 1 / frequencies[1];
        if (isNaN(samplingRate)) {
            samplingRate = 1;
        }

        task.result = {
            data: magnitudes,
            samplingRate,
            xAxes: {
                unit: "frequency"
            },
            yAxes: {
                unit: "voltage"
            }
        };
    }
}
