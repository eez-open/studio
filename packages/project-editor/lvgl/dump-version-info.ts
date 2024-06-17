import { isDev } from "eez-studio-shared/util-electron";
import type { ProjectStore } from "project-editor/store";
import { lvglProperties } from "./style-catalog";

let dumpVersionInfoCalled = new Set<string>();
export async function dumpVersionInfo(projectStore: ProjectStore) {
    if (!isDev) {
        return;
    }

    const lvglVersion = projectStore.project.settings.general.lvglVersion;

    if (dumpVersionInfoCalled.has(lvglVersion)) {
        return;
    }
    dumpVersionInfoCalled.add(lvglVersion);

    const versionInfo: any = {
        version: lvglVersion,
        styles: dumpStyles(projectStore)
    };

    const fs = await import("fs");
    fs.promises.writeFile(
        `../lvgl-versions/${lvglVersion}/version_info.json`,
        JSON.stringify(versionInfo, undefined, 4),
        "utf-8"
    );
}

function dumpStyles(projectStore: ProjectStore) {
    return lvglProperties;
}
