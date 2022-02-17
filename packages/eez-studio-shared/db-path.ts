import Database from "better-sqlite3";

import { isRenderer } from "eez-studio-shared/util-electron";

import type * as MainSettingsModule from "main/settings";

import { ipcRenderer } from "electron";

export let getDbPath: () => string;
export let setDbPath: (dbPath: string) => void;
if (isRenderer()) {
    getDbPath = function () {
        return ipcRenderer.sendSync("getDbPath");
    };

    setDbPath = function (dbPath: string) {
        ipcRenderer.send("setDbPath", dbPath);
    };
} else {
    ({ getDbPath, setDbPath } =
        require("main/settings") as typeof MainSettingsModule);
}

export let db = new Database(getDbPath());
db.defaultSafeIntegers();
