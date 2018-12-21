// const fft = require("fourier-transform");

// import { IMeasureTask } from "eez-studio-shared/extensions/extension";

// export default function(task: IMeasureTask) {
//     let windowSize = Math.pow(2, Math.round(Math.log2(task.xNumSamples)));

//     // resampling
//     const input = new Float64Array(windowSize);
//     for (let i = 0; i < windowSize; ++i) {
//         input[i] = task.getSampleValueAtIndex(
//             task.xStartIndex + Math.floor(i * (task.xNumSamples / windowSize))
//         );
//     }

//     let spectrum = fft(input);

//     let N = spectrum.length;
//     const output = new Array(N);

//     let minValue;
//     let maxValue;

//     output[0] = 20 * Math.log10(spectrum[0]);
//     minValue = maxValue = output[0];
//     for (let i = 1; i < N; ++i) {
//         output[i] = 20 * Math.log10(spectrum[i]);
//         if (output[i] < minValue) {
//             minValue = output[i];
//         } else if (output[i] > maxValue) {
//             maxValue = output[i];
//         }
//     }

//     const d = 0.05 * (maxValue - minValue);
//     minValue -= d;
//     maxValue += d;

//     task.result = {
//         data: output,
//         samplingRate: task.xNumSamples / task.samplingRate,
//         xAxes: {
//             unit: "frequency",
//             logarithmic:
//                 !task.parameters || !task.parameters.axis || task.parameters.axis !== "linear"
//         },
//         yAxes: {
//             unit: "decibel",
//             minValue,
//             maxValue
//         }
//     };
// }

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

import { transformBluestein, transformRadix2 } from "./fft-algo";

export default function(task: IMeasureTask) {
    let numSamples;
    let transformAlgorithm;
    if (task.xNumSamples < 100000) {
        numSamples = task.xNumSamples;
        transformAlgorithm = transformBluestein;
    } else {
        numSamples = Math.min(
            1024 * 1024,
            Math.pow(2, Math.floor(Math.log(task.xNumSamples) / Math.log(2)))
        );
        transformAlgorithm = transformRadix2;
    }

    var real = new Float64Array(numSamples);
    var imaginary = new Float64Array(numSamples).fill(0);

    for (let i = 0; i < numSamples; ++i) {
        real[i] = task.getSampleValueAtIndex(
            task.xStartIndex + Math.floor((i * task.xNumSamples) / numSamples)
        );
    }

    transformAlgorithm(real, imaginary);

    const N = real.length / 2;

    const output = new Array(N);

    output[0] = 20 * Math.log10(Math.sqrt(Math.pow(real[0], 2) + Math.pow(imaginary[0], 2)));
    let minValue, maxValue;
    minValue = maxValue = output[0];
    for (let i = 1; i < N; ++i) {
        output[i] = 20 * Math.log10(Math.sqrt(Math.pow(real[i], 2) + Math.pow(imaginary[i], 2)));
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
