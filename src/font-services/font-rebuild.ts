import { service } from "eez-studio-shared/service";

import { FontProperties } from "font-services/interfaces";

import * as FreeTypeModule from "font-services/freetype";

interface Params {
    font: FontProperties;
    projectFilePath: string;
}

function serviceImplementation(data: Params) {
    const { rebuildFont } = require("font-services/freetype") as typeof FreeTypeModule;
    return rebuildFont(data.font, data.projectFilePath);
}

export default service("font-services/font-rebuild", serviceImplementation, true);
