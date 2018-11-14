import * as Database from "better-sqlite3";
import { isRenderer } from "eez-studio-shared/util";

import * as MainSettingsModule from "main/settings";

export let getDbPath: () => string;
export let setDbPath: (dbPath: string) => void;

if (isRenderer()) {
    getDbPath = function() {
        return EEZStudio.electron.ipcRenderer.sendSync("getDbPath");
    };

    setDbPath = function(dbPath: string) {
        EEZStudio.electron.ipcRenderer.send("setDbPath", dbPath);
    };
} else {
    ({ getDbPath, setDbPath } = require("main/settings") as typeof MainSettingsModule);
}

export let db = new Database(getDbPath());

db.defaultSafeIntegers();
