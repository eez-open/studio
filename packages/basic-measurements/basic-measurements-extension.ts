import { IExtensionDefinition, IFieldProperties } from "eez-studio-shared/extensions/extension";

const fftParametersDescription: IFieldProperties[] = [
    {
        name: "windowSize",
        displayName: "Size",
        type: "enum",
        defaultValue: 65536,
        enumItems: [...Array(17).keys()].map(x => Math.pow(2, 7 + x))
    },
    {
        name: "windowFunction",
        displayName: "Function",
        type: "enum",
        defaultValue: "rectangular",
        enumItems: [
            { id: "rectangular", label: "Rectangular window" },
            { id: "hamming", label: "Hamming window" },
            { id: "hann", label: "Hanning window" },
            { id: "blackman", label: "Blackman window" },
            { id: "blackman_harris", label: "Blackman-Harris window" },
            { id: "gaussian-2.5", label: "Gaussian (a=2.5) window" },
            { id: "gaussian-3.5", label: "Gaussian (a=3.5) window" },
            { id: "gaussian-4.5", label: "Gaussian (a=4.5) window" }
        ]
    },
    {
        name: "xAxis",
        displayName: "X axis",
        type: "enum",
        defaultValue: "log",
        enumItems: [{ id: "logarithmic", label: "Logarithmic" }, { id: "linear", label: "Linear" }]
    },
    {
        name: "yAxis",
        displayName: "Y axis",
        type: "enum",
        defaultValue: "decibel",
        enumItems: [{ id: "decibel", label: "Decibel" }, { id: "linear", label: "Linear" }]
    }
];

const basicMeasurementsExtension: IExtensionDefinition = {
    preInstalled: true,

    measurementFunctions: [
        {
            id: "min",
            name: "Min",
            script: "min.js"
        },
        {
            id: "max",
            name: "Max",
            script: "max.js"
        },
        {
            id: "peak-to-peak",
            name: "Peak-to-peak",
            script: "peak-to-peak.js"
        },
        {
            id: "average",
            name: "Average",
            script: "average.js"
        },
        {
            id: "period",
            name: "Period",
            script: "period.js"
        },
        {
            id: "frequency",
            name: "Frequency",
            script: "frequency.js"
        },
        {
            id: "fft",
            name: "FFT",
            script: "fft.js",
            parametersDescription: fftParametersDescription,
            resultType: "chart"
        },
        {
            id: "add",
            name: "A + B",
            script: "add.js",
            arity: 2,
            resultType: "chart"
        },
        {
            id: "sub",
            name: "A - B",
            script: "sub.js",
            arity: 2,
            resultType: "chart"
        }
    ]
};

export default basicMeasurementsExtension;
