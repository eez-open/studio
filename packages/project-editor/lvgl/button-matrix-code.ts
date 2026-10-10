import fs from "fs";
import { resolve } from "path";
import { isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";
import type { LVGLBuild } from "./build";

export function addButtonMatrixFunctions(build: LVGLBuild) {
    // Use the framework's C-compatible implementation for projects without Flow.
    const resourceDir = isDev
        ? resolve(`${sourceRootDir()}/../resources/eez-framework-amalgamation`)
        : process.resourcesPath! + "/eez-framework-amalgamation";
    const source = fs.readFileSync(
        resourceDir + "/lvgl_button_matrix.h",
        "utf8"
    );
    build.addFunction("eez_bm_set_text", () => build.line(source));
}
