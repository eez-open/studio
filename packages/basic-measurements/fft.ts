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
            real[i] = task.getSampleValueAtIndex(
                task.xStartIndex + Math.round(i * F)
            );
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
        !task.parameters ||
        !task.parameters.yAxis ||
        task.parameters.yAxis !== "linear";

    function toDecibels(i: number) {
        const re = real[i];
        const im = imag[i];
        const pow_dB =
            10 * Math.log10((re * re + im * im) / (numSamples * numSamples));
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

    if (!isNaN(minValue) && !isNaN(maxValue)) {
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
    } else {
        task.result = null;
    }
}
