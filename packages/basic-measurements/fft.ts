import { transform } from "./fft-algo";

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

// simple cache
let lastTask:
    | {
          xStartIndex: number;
          xNumSamples: number;
          values: any;
          result: {
              real: Float64Array;
              imag: Float64Array;
          };
      }
    | undefined;

export default function (task: IMeasureTask) {
    //
    let numSamples = Math.pow(2, Math.floor(Math.log2(task.xNumSamples)));

    let F = task.xNumSamples / numSamples;

    let halfNumSamples = Math.floor(numSamples / 2);

    let real: Float64Array;
    let imag: Float64Array;

    if (
        lastTask &&
        lastTask.xStartIndex === task.xStartIndex &&
        lastTask.xNumSamples === task.xNumSamples &&
        lastTask.values === task.values
    ) {
        real = lastTask.result.real;
        imag = lastTask.result.imag;
    } else {
        //
        real = new Float64Array(numSamples);

        real[0] = task.getSampleValueAtIndex(task.xStartIndex + 0);
        for (let i = 1; i < numSamples; ++i) {
            real[i] = task.getSampleValueAtIndex(task.xStartIndex + Math.round(i * F));
        }

        imag = new Float64Array(numSamples).fill(0);

        //
        transform(real, imag);

        lastTask = {
            xStartIndex: task.xStartIndex,
            xNumSamples: task.xNumSamples,
            values: task.values,
            result: { real, imag }
        };
    }

    //
    const yAxisInDecibels =
        !task.parameters || !task.parameters.yAxis || task.parameters.yAxis !== "linear";

    function toDecibels(i: number) {
        const re = real[i];
        const im = imag[i];
        const pow_dB = 10 * Math.log10((re * re + im * im) / (numSamples * numSamples));
        return Math.max(pow_dB, -110);
    }

    function getLinearYValue(i: number) {
        const re = real[i];
        const im = imag[i];
        return Math.sqrt(re * re + im * im) / numSamples;
    }

    const getYValue = yAxisInDecibels ? toDecibels : getLinearYValue;

    let data = new Array(halfNumSamples);
    let minValue, maxValue, maxValueIndex;
    minValue = maxValue = data[1] = getYValue(1);
    maxValueIndex = 1;
    for (let i = 2; i < halfNumSamples; ++i) {
        data[i] = getYValue(i);
        if (data[i] < minValue) {
            minValue = data[i];
        } else if (data[i] > maxValue) {
            maxValue = data[i];
            maxValueIndex = i;
        }
    }

    let samplingRate = numSamples / (task.samplingRate / F);

    if (task.parameters?.xAxis === "harmonics") {
        if (maxValueIndex) {
            let numHarmonics = task.parameters?.numHarmonics ?? 40;
            let harmonics = new Array(numHarmonics + 1);
            for (let i = 0; i <= numHarmonics; i++) {
                harmonics[i] = data[i * maxValueIndex];
            }
            data = harmonics;
            samplingRate /= maxValueIndex;
        } else {
            data = [];
            samplingRate = 0;
        }
    }

    //
    task.result = {
        data,
        samplingRate,
        xAxes: {
            unit: "frequency",
            logarithmic:
                !task.parameters ||
                !task.parameters.xAxis ||
                task.parameters.xAxis === "logarithmic"
        },
        yAxes: {
            unit: yAxisInDecibels ? "decibel" : task.valueUnit,
            minValue,
            maxValue
        }
    };
}

// const fftJs = require("fourier-transform");
// const fftAsm = require("fourier-transform/asm");
// const windowing = require("fft-windowing");

// import { IMeasureTask } from "eez-studio-shared/extensions/extension";

// export default function(task: IMeasureTask) {
//     //
//     let windowSize = parseInt((task.parameters && task.parameters.windowSize) || 65535);

//     let resample = parseInt((task.parameters && task.parameters.resample) || 1);

//     let minResample = 1;
//     let maxResample = task.xNumSamples / windowSize;

//     const RESAMPLE = minResample + ((resample - 1) * (maxResample - minResample)) / (100 - 1);

//     let numSamples = Math.round(task.xNumSamples / RESAMPLE);

//     if (numSamples < windowSize) {
//         task.result = "Not enough data selected.";
//         return;
//     }

//     const fft = windowSize > 8192 ? fftJs : fftAsm;

//     const halfWindowSize = windowSize / 2;

//     let windowFunctionName = (task.parameters && task.parameters.windowFunction) || "rectangular";
//     let windowFunction;
//     let windowFunctionParam;
//     if (windowFunctionName !== "rectangular") {
//         if (windowFunctionName.startsWith("gaussian-")) {
//             windowFunction = windowing.gaussian;
//             windowFunctionParam = parseFloat(windowFunctionName.slice("gaussian-".length));
//         } else {
//             windowFunction = windowing[windowFunctionName];
//         }
//     }

//     //
//     let minValue, maxValue;
//     minValue = maxValue = task.getSampleValueAtIndex(task.xStartIndex + 0);
//     for (let i = 1; i < numSamples; ++i) {
//         const value = task.getSampleValueAtIndex(task.xStartIndex + Math.round(i * RESAMPLE));
//         if (value < minValue) {
//             minValue = value;
//         } else if (value > maxValue) {
//             maxValue = value;
//         }
//     }

//     //
//     const input = new Float64Array(windowSize);
//     const output = new Float64Array(halfWindowSize).fill(0);
//     let numWindows = 0;
//     for (let i = 0; i + windowSize <= numSamples; i += windowSize, ++numWindows) {
//         for (let j = 0; j < windowSize; ++j) {
//             input[j] = task.getSampleValueAtIndex(
//                 task.xStartIndex + Math.round((i + j) * RESAMPLE)
//             );
//         }
//         if (windowFunction) {
//             windowFunction(input, windowFunctionParam);
//         }
//         let spectrum = fft(input);
//         for (let j = 0; j < halfWindowSize; ++j) {
//             output[j] += spectrum[j];
//         }
//     }

//     //
//     const f = 2 * (maxValue - minValue) * numWindows;

//     function getLogarithmicYValue(i: number) {
//         return 20 * Math.log10(output[i] / f);
//     }

//     function getLinearYValue(i: number) {
//         return output[i] / numWindows;
//     }

//     const yAxisInDecibels =
//         !task.parameters || !task.parameters.yAxis || task.parameters.yAxis !== "linear";

//     const getYValue = yAxisInDecibels ? getLogarithmicYValue : getLinearYValue;

//     const data = new Array(halfWindowSize);
//     minValue = maxValue = data[0] = getYValue(0);
//     for (let i = 1; i < halfWindowSize; ++i) {
//         data[i] = getYValue(i);
//         if (data[i] < minValue) {
//             minValue = data[i];
//         } else if (data[i] > maxValue) {
//             maxValue = data[i];
//         }
//     }

//     //
//     task.result = {
//         data,
//         samplingRate: windowSize / (task.samplingRate / RESAMPLE),
//         xAxes: {
//             unit: "frequency",
//             logarithmic:
//                 !task.parameters || !task.parameters.xAxis || task.parameters.xAxis !== "linear"
//         },
//         yAxes: {
//             unit: yAxisInDecibels ? "decibel" : task.valueUnit,
//             minValue,
//             maxValue
//         }
//     };
// }
