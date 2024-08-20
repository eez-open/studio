import fs from "fs";
import { ipcRenderer, shell } from "electron";
import DatabaseConstructor, { type Database } from "better-sqlite3";
import {
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction,
    toJS
} from "mobx";

import { createEmptyFile, isRenderer } from "eez-studio-shared/util-electron";

import type * as MainSettingsModule from "main/settings";
import { allStores } from "eez-studio-shared/store";

////////////////////////////////////////////////////////////////////////////////

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

export let db = new DatabaseConstructor(getActiveDbPath());
db.defaultSafeIntegers();

////////////////////////////////////////////////////////////////////////////////

// after this period we should advise user to compact database
const CONF_DATABASE_COMPACT_ADVISE_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days

export class InstrumentDatabase implements MainSettingsModule.IDbPath {
    filePath: string;
    isActive: boolean;
    timeOfLastDatabaseCompactOperation: number;

    description: string = "";

    databaseSize: number;

    constructor(
        filePath: string,
        isActive: boolean,
        timeOfLastDatabaseCompactOperation: number | undefined
    ) {
        this.filePath = filePath;
        this.isActive = isActive;
        this.timeOfLastDatabaseCompactOperation =
            timeOfLastDatabaseCompactOperation ?? Date.now();

        this.description = this.getDescription();

        makeObservable(this, {
            filePath: observable,
            isActive: observable,
            timeOfLastDatabaseCompactOperation: observable,
            description: observable
        });

        try {
            this.databaseSize = fs.statSync(this.filePath).size;
        } catch (error) {
            this.databaseSize = 0;
        }
    }

    get isCompactDatabaseAdvisable() {
        return (
            Date.now() - this.timeOfLastDatabaseCompactOperation >
            CONF_DATABASE_COMPACT_ADVISE_PERIOD
        );
    }

    getDescription() {
        let db;
        try {
            db = new DatabaseConstructor(this.filePath);

            const result = db.prepare("SELECT description FROM settings").get();

            if (result != undefined) {
                return result.description;
            }
        } catch (err) {
            //console.error(err);
        } finally {
            db?.close();
        }
        return "";
    }

    storeDescription() {
        let db;
        try {
            db = new DatabaseConstructor(this.filePath);

            db.exec(`CREATE TABLE IF NOT EXISTS settings(description TEXT)`);

            if (db.prepare("SELECT * FROM settings").get() == undefined) {
                db.prepare(`INSERT INTO settings(description) VALUES (?)`).run([
                    this.description
                ]);
            } else {
                db.prepare(`UPDATE settings SET description=?`).run([
                    this.description
                ]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            db?.close();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function createTables(db: Database) {
    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    for (const store of allStores) {
        let version;

        try {
            const versionRow = db
                .prepare(
                    `SELECT * FROM versions WHERE tableName = '${store.store.storeName}'`
                )
                .get();
            if (versionRow !== undefined) {
                version = versionRow.version;
            }
        } catch (err) {}

        if (version === undefined) {
            version = 0;
        }

        for (; version < store.versions.length; version++) {
            const versionSQL = store.versions[version];

            if (typeof versionSQL === "function") {
                versionSQL(db);
            } else {
                db.exec(versionSQL);
            }
        }
    }

    db.exec(`COMMIT TRANSACTION`);
}

export function initInstrumentDatabase(filePath: string) {
    let db;
    try {
        db = new DatabaseConstructor(filePath);
        createTables(db);
    } finally {
        db?.close();
    }
}

////////////////////////////////////////////////////////////////////////////////

class InstrumentDatabases {
    activeDatabasePath = getActiveDbPath();
    databases: InstrumentDatabase[] = [];

    constructor() {
        if (!isRenderer()) {
            return;
        }

        this.databases = getDbPaths().map(
            dbPath =>
                new InstrumentDatabase(
                    dbPath.filePath,
                    dbPath.isActive,
                    dbPath.timeOfLastDatabaseCompactOperation
                )
        );

        makeObservable(this, {
            databases: observable,
            activeDatabase: computed
        });

        reaction(
            () => toJS(this.databases),
            databases => {
                setDbPaths(databases);
            }
        );
    }

    get activeDatabase() {
        return this.databases.find(database => database.isActive);
    }

    getDatabaseByFilePath(filePath: string) {
        return this.databases.find(db => db.filePath === filePath);
    }

    addDatabase(filePath: string, isActive: boolean) {
        runInAction(() => {
            if (isActive && this.activeDatabase) {
                this.activeDatabase.isActive = false;
            }

            const database = this.databases.find(
                database => database.filePath == filePath
            );

            if (database) {
                database.isActive = isActive;
            } else {
                this.databases.push(
                    new InstrumentDatabase(filePath, isActive, Date.now())
                );
            }
        });
    }

    removeDatabase(database: InstrumentDatabase) {
        const i = this.databases.indexOf(database);
        if (i != -1) {
            runInAction(() => {
                this.databases.splice(i, 1);
            });
        }
    }

    setAsActiveDatabase(database: InstrumentDatabase) {
        if (database != this.activeDatabase) {
            runInAction(() => {
                if (this.activeDatabase) {
                    this.activeDatabase.isActive = false;
                }
                database.isActive = true;
            });
        }
    }

    async exportInstrumentToDatabase(instrumentId: string, filePath: string) {
        const notification = await import("eez-studio-ui/notification");

        let progressToastId = notification.info("Exporting ...", {
            autoClose: false,
            closeButton: false,
            closeOnClick: false,
            hideProgressBar: false,
            progressStyle: {
                transition: "none"
            }
        });

        const sourceDb = db;
        let destDb;

        try {
            createEmptyFile(filePath);
            destDb = new DatabaseConstructor(filePath);
            createTables(destDb);

            // get source instrument
            const sourceInstrument = sourceDb
                .prepare("SELECT * FROM instrument WHERE id = ?")
                .get([instrumentId]);

            const logsCountRow = sourceDb
                .prepare(
                    "SELECT count(*) as count FROM activityLog WHERE oid = ?"
                )
                .get([instrumentId]);

            // get source sessions
            const sourceSessions = sourceDb
                .prepare(
                    `select * FROM "history/sessions" WHERE id IN (select DISTINCT(sid) from activityLog where oid = ?)`
                )
                .all([instrumentId]);

            // get source shortcuts
            const sourceShortcuts = sourceDb
                .prepare(
                    `select * FROM "shortcuts/shortcuts" WHERE "groupName" = ?`
                )
                .all(["__instrument__" + instrumentId]);

            // insert destination instrument
            const instrumentColumns = Object.keys(sourceInstrument).filter(
                column => column != "id"
            );

            const result = destDb
                .prepare(
                    `INSERT INTO instrument (${instrumentColumns.join(
                        ","
                    )}) VALUES (${instrumentColumns.map(() => "?").join(",")})`
                )
                .run(instrumentColumns.map(column => sourceInstrument[column]));
            const destInstrumentId = result.lastInsertRowid;

            // insert destination sessions
            const mapSourceSessionToDestSessionId = new Map<bigint, bigint>();
            if (sourceSessions.length > 0) {
                const sessionColumns = Object.keys(sourceSessions[0]).filter(
                    column => column != "id"
                );

                for (const sourceSession of sourceSessions) {
                    const result = destDb
                        .prepare(
                            `INSERT INTO "history/sessions" (${sessionColumns.join(
                                ","
                            )}) VALUES (${sessionColumns
                                .map(() => "?")
                                .join(",")})`
                        )
                        .run(
                            sessionColumns.map(column => sourceSession[column])
                        );
                    const destSessionId = result.lastInsertRowid as bigint;
                    mapSourceSessionToDestSessionId.set(
                        BigInt(sourceSession.id),
                        BigInt(destSessionId)
                    );
                }
            }

            // insert destination shortcuts
            if (sourceShortcuts.length > 0) {
                const shortcutColumns = Object.keys(sourceShortcuts[0]).filter(
                    column => column != "id" && column != "groupName"
                );

                for (const sourceShortcut of sourceShortcuts) {
                    const groupName = "__instrument__" + destInstrumentId;

                    destDb
                        .prepare(
                            `INSERT INTO "shortcuts/shortcuts" (groupName, ${shortcutColumns.join(
                                ","
                            )}) VALUES (?, ${shortcutColumns
                                .map(() => "?")
                                .join(",")})`
                        )
                        .run([
                            groupName,
                            ...shortcutColumns.map(
                                column => sourceShortcut[column]
                            )
                        ]);
                }
            }

            // insert destination logs in chunks
            const CHUNK = 100;
            let offset = 0;
            let logColumns: string[] | undefined;
            while (true) {
                const logs = sourceDb
                    .prepare(
                        `SELECT * FROM activityLog WHERE oid = ${instrumentId} ORDER BY date ASC limit ${CHUNK} offset ${offset}`
                    )
                    .all();

                if (logs.length == 0) {
                    break;
                }

                if (!logColumns) {
                    logColumns = Object.keys(logs[0]).filter(
                        column =>
                            column != "id" && column != "oid" && column != "sid"
                    );
                }

                destDb
                    .prepare(
                        `INSERT INTO activityLog (oid, sid, ${logColumns.join(
                            ","
                        )}) VALUES ${logs.map(
                            log =>
                                `(${destInstrumentId}, ?, ${logColumns!
                                    .map(() => "?")
                                    .join(",")})`
                        )}`
                    )
                    .run(
                        logs.reduce(
                            (arr, log) => [
                                ...arr,
                                log.sid
                                    ? mapSourceSessionToDestSessionId.get(
                                          BigInt(log.sid)
                                      )
                                    : null,
                                ...logColumns!.map(column => log[column])
                            ],
                            []
                        )
                    );

                // update notification progress bar
                offset += logs.length;
                const progress = offset / Number(logsCountRow.count);
                notification.update(progressToastId, {
                    progress
                });

                await new Promise(resolve => setTimeout(resolve, 0));

                if (logs.length < CHUNK) {
                    break;
                }
            }

            notification.update(progressToastId, {
                autoClose: 1000,
                render: "Exported successfully",
                progress: undefined,
                closeOnClick: true,
                type: notification.SUCCESS
            });

            shell.showItemInFolder(filePath);
        } catch (err) {
            notification.update(progressToastId, {
                render: "Exported failed: " + err,
                progress: 1,
                closeOnClick: true,
                type: notification.ERROR
            });
        } finally {
            destDb?.close();
        }
    }

    async importInstrumentFromDatabase(filePath: string) {
        const notification = await import("eez-studio-ui/notification");

        let progressToastId = notification.info("Importing ...", {
            autoClose: false,
            closeButton: false,
            closeOnClick: false,
            hideProgressBar: false,
            progressStyle: {
                transition: "none"
            }
        });

        const destDb = db;

        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

        let sourceDb;
        try {
            sourceDb = new DatabaseConstructor(filePath);

            // get source instrument
            const sourceInstruments = sourceDb
                .prepare("SELECT * FROM instrument")
                .all();

            for (const sourceInstrument of sourceInstruments) {
                const destinationInstrument = destDb
                    .prepare("SELECT * FROM instrument WHERE uuid = ?")
                    .get([sourceInstrument.uuid]);
                if (destinationInstrument) {
                    notification.update(progressToastId, {
                        render: "Import failed, instrument already exists!",
                        progress: 1,
                        closeOnClick: true,
                        type: notification.ERROR
                    });

                    db.exec(`ROLLBACK TRANSACTION`);
                    return;
                }
            }

            const logsCountRow = sourceDb
                .prepare("SELECT count(*) as count FROM activityLog")
                .get();

            // get source sessions
            const sourceSessions = sourceDb
                .prepare(`select * FROM "history/sessions"`)
                .all();

            // get source shortcuts
            const sourceShortcuts = sourceDb
                .prepare(`select * FROM "shortcuts/shortcuts"`)
                .all();

            // insert destination instrument
            const destInstrumentIds = [];
            const mapSourceInstrumentToDestInstrumentId = new Map<
                bigint,
                bigint
            >();
            if (sourceInstruments.length > 0) {
                const instrumentColumns = Object.keys(
                    sourceInstruments[0]
                ).filter(column => column != "id");

                for (const sourceInstrument of sourceInstruments) {
                    const result = destDb
                        .prepare(
                            `INSERT INTO instrument (${instrumentColumns.join(
                                ","
                            )}) VALUES (${instrumentColumns
                                .map(() => "?")
                                .join(",")})`
                        )
                        .run(
                            instrumentColumns.map(
                                column => sourceInstrument[column]
                            )
                        );
                    const destInstrumentId = result.lastInsertRowid as bigint;
                    mapSourceInstrumentToDestInstrumentId.set(
                        BigInt(sourceInstrument.id),
                        BigInt(destInstrumentId)
                    );
                    destInstrumentIds.push(destInstrumentId);
                }
            }

            // insert destination sessions
            const mapSourceSessionToDestSessionId = new Map<bigint, bigint>();
            const destSessionIds = [];
            if (sourceSessions.length > 0) {
                const sessionColumns = Object.keys(sourceSessions[0]).filter(
                    column => column != "id"
                );

                for (const sourceSession of sourceSessions) {
                    const destinationSession = destDb
                        .prepare(
                            `SELECT * FROM "history/sessions" WHERE uuid = ?`
                        )
                        .get([sourceSession.uuid]);
                    if (destinationSession) {
                        mapSourceSessionToDestSessionId.set(
                            BigInt(sourceSession.id),
                            BigInt(destinationSession.id)
                        );
                    } else {
                        const result = destDb
                            .prepare(
                                `INSERT INTO "history/sessions" (${sessionColumns.join(
                                    ","
                                )}) VALUES (${sessionColumns
                                    .map(() => "?")
                                    .join(",")})`
                            )
                            .run(
                                sessionColumns.map(
                                    column => sourceSession[column]
                                )
                            );
                        const destSessionId = result.lastInsertRowid as bigint;
                        mapSourceSessionToDestSessionId.set(
                            BigInt(sourceSession.id),
                            BigInt(destSessionId)
                        );
                        destSessionIds.push(destSessionId);
                    }
                }
            }

            // insert destination shortcuts
            const destShortcutIds = [];
            if (sourceShortcuts.length > 0) {
                const shortcutColumns = Object.keys(sourceShortcuts[0]).filter(
                    column => column != "id" && column != "groupName"
                );

                for (const sourceShortcut of sourceShortcuts) {
                    const sourceInstrumentId = BigInt(
                        sourceShortcut.groupName.substr("__instrument__".length)
                    );

                    const groupName =
                        "__instrument__" +
                        mapSourceInstrumentToDestInstrumentId.get(
                            sourceInstrumentId
                        );

                    const result = destDb
                        .prepare(
                            `INSERT INTO "shortcuts/shortcuts" (groupName, ${shortcutColumns.join(
                                ","
                            )}) VALUES (?, ${shortcutColumns
                                .map(() => "?")
                                .join(",")})`
                        )
                        .run([
                            groupName,
                            ...shortcutColumns.map(
                                column => sourceShortcut[column]
                            )
                        ]);
                    const destShortcutId = result.lastInsertRowid as bigint;
                    destShortcutIds.push(destShortcutId);
                }
            }

            // insert destination logs in chunks
            const CHUNK = 100;
            let offset = 0;
            let logColumns: string[] | undefined;
            while (true) {
                const logs = sourceDb
                    .prepare(
                        `SELECT * FROM activityLog ORDER BY date ASC limit ${CHUNK} offset ${offset}`
                    )
                    .all();

                if (logs.length == 0) {
                    break;
                }

                if (!logColumns) {
                    logColumns = Object.keys(logs[0]).filter(
                        column =>
                            column != "id" && column != "oid" && column != "sid"
                    );
                }

                destDb
                    .prepare(
                        `INSERT INTO activityLog (oid, sid, ${logColumns.join(
                            ","
                        )}) VALUES ${logs.map(
                            log =>
                                `(?, ?, ${logColumns!
                                    .map(() => "?")
                                    .join(",")})`
                        )}`
                    )
                    .run(
                        logs.reduce(
                            (arr, log) => [
                                ...arr,
                                mapSourceInstrumentToDestInstrumentId.get(
                                    BigInt(log.oid)
                                ),
                                log.sid
                                    ? mapSourceSessionToDestSessionId.get(
                                          BigInt(log.sid)
                                      )
                                    : null,
                                ...logColumns!.map(column => log[column])
                            ],
                            []
                        )
                    );

                // update notification progress bar
                offset += logs.length;
                const progress = offset / Number(logsCountRow.count);
                notification.update(progressToastId, {
                    progress
                });

                await new Promise(resolve => setTimeout(resolve, 0));

                if (logs.length < CHUNK) {
                    break;
                }
            }

            db.exec(`COMMIT TRANSACTION`);

            // notify renderer process to update stores
            const { ipcRenderer } = await import("electron");

            for (const objectId of destInstrumentIds) {
                ipcRenderer.send(
                    "shared/store/create-object-notify/" + "instrument",
                    {
                        objectId
                    }
                );
            }

            for (const objectId of destSessionIds) {
                ipcRenderer.send(
                    "shared/store/create-object-notify/" + "history/sessions",
                    {
                        objectId
                    }
                );
            }

            for (const objectId of destShortcutIds) {
                ipcRenderer.send(
                    "shared/store/create-object-notify/" +
                        "shortcuts/shortcuts",
                    {
                        objectId
                    }
                );
            }

            notification.update(progressToastId, {
                autoClose: 1000,
                render: "Imported successfully",
                progress: undefined,
                closeOnClick: true,
                type: notification.SUCCESS
            });

            shell.showItemInFolder(filePath);
        } catch (err) {
            db.exec(`ROLLBACK TRANSACTION`);

            notification.update(progressToastId, {
                render: "Import failed: " + err,
                progress: 1,
                closeOnClick: true,
                type: notification.ERROR
            });
        } finally {
            sourceDb?.close();
        }
    }
}

export const instrumentDatabases = new InstrumentDatabases();
