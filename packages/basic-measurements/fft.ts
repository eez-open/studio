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

import { transform } from "./fft-algo";

export default function(task: IMeasureTask) {
    let numSamples = Math.min(
        Math.pow(2, Math.ceil(Math.log(task.xNumSamples) / Math.log(2))),
        1024 * 1024
    );

    var real = new Float64Array(numSamples);
    var imaginary = new Float64Array(numSamples).fill(0);

    for (let i = 0; i < numSamples; ++i) {
        real[i] = task.getSampleValueAtIndex(
            task.xStartIndex + Math.floor((i * task.xNumSamples) / numSamples)
        );
    }

    transform(real, imaginary);

    const N = real.length / 2;

    const output = new Array(N);

    function amplitudeAt(i: number) {
        const re = real[i];
        const im = imaginary[i];
        return Math.sqrt(re * re + im * im);
    }

    let maxAmplitude: number;
    maxAmplitude = output[0] = amplitudeAt(0);
    for (let i = 1; i < N; ++i) {
        output[i] = amplitudeAt(i);
        if (output[i] > maxAmplitude) {
            maxAmplitude = output[i];
        }
    }

    function decibelsAt(i: number) {
        return 20 * Math.log10(output[i] / maxAmplitude);
    }

    output[0] = decibelsAt(0);
    for (let i = 1; i < N; ++i) {
        output[i] = decibelsAt(i);
        if (output[i] < -90) {
            output[i] = -90;
        }
    }

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
            minValue: -90,
            maxValue: 0
        }
    };
}
