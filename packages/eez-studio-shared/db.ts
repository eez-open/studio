import Database from "better-sqlite3";
import { isRenderer, isWebStudio } from "eez-studio-shared/util-electron";

import * as MainSettingsModule from "main/settings";

export let getDbPath: () => string;
export let setDbPath: (dbPath: string) => void;
if (isWebStudio()) {
    getDbPath = function () {
        return "";
    };

    setDbPath = function (dbPath: string) {};
} else if (isRenderer()) {
    getDbPath = function () {
        return EEZStudio.electron.ipcRenderer.sendSync("getDbPath");
    };

    setDbPath = function (dbPath: string) {
        EEZStudio.electron.ipcRenderer.send("setDbPath", dbPath);
    };
} else {
    ({
        getDbPath,
        setDbPath
    } = require("main/settings") as typeof MainSettingsModule);
}

export let db = new Database(getDbPath());
db.defaultSafeIntegers();

// // DB query is executed in Main process
// if (!isRenderer()) {
//     const { ipcMain } = require("electron");

//     ipcMain.on(
//         "dbQueryTask",
//         (event: Electron.Event, taskId: string, query: string, ...args: any[]) => {
//             try {
//                 const rows = db.prepare(query).all(...args);
//                 event.sender.send("dbQueryTask" + taskId, null, rows);
//             } catch (err) {
//                 event.sender.send("dbQueryTask" + taskId, err);
//             }
//         }
//     );
// }

// let dbQueryTaskId = 1;

// export function dbQuery(query: string) {
//     return {
//         all: async (...args: any[]): Promise<any[]> => {
//             return new Promise<any>((resolve, reject) => {
//                 const taskId = dbQueryTaskId++;

//                 EEZStudio.electron.ipcRenderer.once(
//                     "dbQueryTask" + taskId,
//                     (event: Electron.Event, err: any, rows: any[]) => {
//                         if (err) {
//                             reject(err);
//                         } else {
//                             for (const row of rows) {
//                                 for (const key in row) {
//                                     if (row.hasOwnProperty(key)) {
//                                         const value = row[key];
//                                         if (value && typeof value === "object") {
//                                             const low = row[key].low;
//                                             const high = row[key].high;
//                                             if (low !== undefined && high !== undefined) {
//                                                 row[key] = Database.Integer.fromBits(low, high);
//                                             }
//                                         }
//                                     }
//                                 }
//                             }

//                             resolve(rows);
//                         }
//                     }
//                 );

//                 EEZStudio.electron.ipcRenderer.send("dbQueryTask", taskId, query, ...args);
//             });
//         }
//     };
// }

// Execute DB query as service (inside Renderer process).

import dbQueryService from "db-services/query";

export function dbQuery(query: string) {
    return {
        all: async (...args: any[]): Promise<any[]> => {
            const { err, rows } = await dbQueryService({
                query,
                args
            });

            if (err) {
                throw err;
            } else {
                for (const row of rows) {
                    for (const key in row) {
                        if (row.hasOwnProperty(key)) {
                            const value = row[key];
                            if (value && typeof value === "object") {
                                const low = row[key].low;
                                const high = row[key].high;
                                if (low !== undefined && high !== undefined) {
                                    row[key] = Database.Integer.fromBits(
                                        low,
                                        high
                                    );
                                }
                            }
                        }
                    }
                }

                return rows;
            }
        }
    };
}
