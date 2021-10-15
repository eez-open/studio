import { service } from "eez-studio-shared/service";

import type * as BdfModule from "font-services/bdf";
import type * as FreeTypeModule from "font-services/freetype";

const path = require("path");

interface Params {
    name?: string;
    absoluteFilePath: string;
    relativeFilePath: string;
    bpp: number;
    size: number;
    threshold: number;
    createGlyphs: boolean;
    fromEncoding?: number;
    toEncoding?: number;
    createBlankGlyphs?: boolean;
}

function serviceImplementation(data: Params) {
    if (path.extname(data.relativeFilePath) == ".bdf") {
        const { extractBdfFont } =
            require("font-services/bdf") as typeof BdfModule;
        return extractBdfFont(
            data.name,
            data.absoluteFilePath,
            data.relativeFilePath,
            data.bpp,
            data.createGlyphs,
            data.fromEncoding,
            data.toEncoding,
            data.createBlankGlyphs || false
        );
    } else {
        const { extractFreeTypeFont } =
            require("font-services/freetype") as typeof FreeTypeModule;
        return extractFreeTypeFont(
            data.name,
            data.absoluteFilePath,
            data.relativeFilePath,
            data.bpp,
            data.size,
            data.threshold,
            data.createGlyphs,
            data.fromEncoding,
            data.toEncoding,
            data.createBlankGlyphs || false
        );
    }
}

export default service(
    "font-services/font-extract",
    serviceImplementation,
    true
);
