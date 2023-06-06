import {
    IExtensionDefinition,
    IFieldProperties
} from "eez-studio-shared/extensions/extension";

const fftParametersDescription: IFieldProperties[] = [
    // {
    //     name: "windowSize",
    //     displayName: "Size",
    //     type: "enum",
    //     defaultValue: 65536,
    //     enumItems: [...Array(17).keys()].map(x => Math.pow(2, 7 + x))
    // },
    // {
    //     name: "windowFunction",
    //     displayName: "Function",
    //     type: "enum",
    //     defaultValue: "rectangular",
    //     enumItems: [
    //         { id: "rectangular", label: "Rectangular window" },
    //         { id: "hamming", label: "Hamming window" },
    //         { id: "hann", label: "Hanning window" },
    //         { id: "blackman", label: "Blackman window" },
    //         { id: "blackman_harris", label: "Blackman-Harris window" },
    //         { id: "gaussian-2.5", label: "Gaussian (a=2.5) window" },
    //         { id: "gaussian-3.5", label: "Gaussian (a=3.5) window" },
    //         { id: "gaussian-4.5", label: "Gaussian (a=4.5) window" }
    //     ]
    // },
    // {
    //     name: "resample",
    //     displayName: "Resample",
    //     type: "range",
    //     defaultValue: 1,
    //     minValue: 1,
    //     maxValue: 100
    // },
    {
        name: "xAxis",
        displayName: "X axis",
        type: "enum",
        defaultValue: "logarithmic",
        enumItems: [
            { id: "logarithmic", label: "Logarithmic" },
            { id: "linear", label: "Linear" },
            { id: "harmonics", label: "Harmonics" }
        ]
    },
    {
        name: "yAxis",
        displayName: "Y axis",
        type: "enum",
        defaultValue: "decibel",
        enumItems: [
            { id: "decibel", label: "Decibel" },
            { id: "linear", label: "Linear" }
        ]
    },
    {
        name: "numHarmonics",
        displayName: "No. of harmonics",
        type: "number",
        defaultValue: 40,
        visible: values => {
            return values.xAxis === "harmonics";
        }
    }
];

const basicMeasurementsExtension: IExtensionDefinition = {
    preInstalled: true,
    extensionType: "measurement-functions",

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
        // {
        //     id: "acActivePower",
        //     name: "AC Active Power",
        //     script: "ac_active.js",
        //     arity: 2
        // },
        // {
        //     id: "acReactivePower",
        //     name: "AC Reactive Power",
        //     script: "ac_reactive.js",
        //     arity: 2
        // },
        // {
        //     id: "acApparentPower",
        //     name: "AC Apparent Power",
        //     script: "ac_apparent.js",
        //     arity: 2
        // }
    ]
};

export default basicMeasurementsExtension;
