import { IExtensionDefinition } from "eez-studio-shared/extensions/extension";

const extension: IExtensionDefinition = {
    measurementFunctions: [
        {
            id: "rms",
            name: "RMS",
            script: "rms.js"
        }
    ]
};

export default extension;
