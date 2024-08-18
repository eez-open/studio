import Database from "better-sqlite3";

import { isRenderer } from "eez-studio-shared/util-electron";

import type * as MainSettingsModule from "main/settings";

import { ipcRenderer } from "electron";

export let getActiveDbPath: () => string;
export let getDbPaths: () => MainSettingsModule.IDbPath[];
export let setDbPaths: (dbPaths: MainSettingsModule.IDbPath[]) => void;
if (isRenderer()) {
    getActiveDbPath = function () {
        return ipcRenderer.sendSync("getActiveDbPath");
    };

    getDbPaths = function () {
        return ipcRenderer.sendSync("getDbPaths");
    };

    setDbPaths = function (dbPaths: MainSettingsModule.IDbPath[]) {
        ipcRenderer.send("setDbPaths", dbPaths);
    };
} else {
    ({ getActiveDbPath, getDbPaths, setDbPaths } =
        require("main/settings") as typeof MainSettingsModule);
}

export let db = new Database(getActiveDbPath());
db.defaultSafeIntegers();
