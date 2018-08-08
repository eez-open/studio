import { IExtensionDefinition } from "shared/extensions/extension";

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
        }
    ]
};

export default basicMeasurementsExtension;
