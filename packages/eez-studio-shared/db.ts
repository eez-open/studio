import fs from "fs";
import { ipcRenderer } from "electron";
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

            const result = db
                .prepare("SELECT description FROM settings")
                .get() as any;

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
            storeDescription(db, this.description);
        } catch (err) {
            console.error(err);
        } finally {
            db?.close();
        }
    }
}

export function storeDescription(db: Database, description: string) {
    db.exec(`CREATE TABLE IF NOT EXISTS settings(description TEXT)`);

    if (db.prepare("SELECT * FROM settings").get() == undefined) {
        db.prepare(`INSERT INTO settings(description) VALUES (?)`).run([
            description
        ]);
    } else {
        db.prepare(`UPDATE settings SET description=?`).run([description]);
    }
}

////////////////////////////////////////////////////////////////////////////////

async function createTables(db: Database) {
    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    for (const store of allStores) {
        let version;

        try {
            const versionRow = db
                .prepare(
                    `SELECT * FROM versions WHERE tableName = '${store.store.storeName}'`
                )
                .get() as any;
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

            await pause();
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

    async exportDatabase(
        destination: string,
        conf: {
            mode: "instruments" | "sessions" | "archive" | "shortcuts";

            instrumentsOption: "all" | "selected";
            selectedInstruments: string[];

            sessionsOption: "all" | "selected";
            selectedSessions: string[];

            shortcutsOption: "all" | "selected";
            selectedShortcuts: string[];

            historyOption: "all" | "older-then";
            historyOdlerThenYears: number;
            historyOdlerThenMonths: number;
            historyOdlerThenDays: number;

            removeHistoryAfterExport: boolean;

            description: string;
        }
    ) {
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

        await pause();

        let sourceDb = db;
        let destDb;

        try {
            createEmptyFile(destination);

            await pause();

            destDb = new DatabaseConstructor(destination);
            await createTables(destDb);

            await pause();

            //
            let logsQueryCondition;
            if (conf.mode == "instruments") {
                logsQueryCondition = `WHERE oid IN (${conf.selectedInstruments.join(
                    ","
                )})`;
            } else if (conf.mode == "sessions") {
                logsQueryCondition = `WHERE sid IN (${conf.selectedSessions.join(
                    ","
                )})`;
            } else if (conf.mode == "archive") {
                logsQueryCondition = `WHERE "date" < unixepoch(date('now','-${conf.historyOdlerThenYears} year','-${conf.historyOdlerThenMonths} month','-${conf.historyOdlerThenDays} day')) * 1000`;
            } else if (conf.mode == "shortcuts") {
                logsQueryCondition = `WHERE 0`;
            } else {
                throw "this mode not implemented";
            }
            logsQueryCondition += " AND NOT deleted";

            // get source instruments
            let instrumentIds: string[];
            if (conf.mode == "instruments") {
                instrumentIds = conf.selectedInstruments;
            } else if (conf.mode == "sessions" || conf.mode == "archive") {
                instrumentIds = sourceDb
                    .prepare(
                        `SELECT DISTINCT(oid) AS oid FROM activityLog ${logsQueryCondition}`
                    )
                    .all()
                    .filter((row: any) => row.oid != null)
                    .map((row: any) => row.oid.toString());
            } else if (conf.mode == "shortcuts") {
                instrumentIds = [];
            } else {
                throw "this mode not implemented";
            }
            const sourceInstruments = sourceDb
                .prepare(
                    `SELECT * FROM instrument WHERE id IN (${instrumentIds.join(
                        ","
                    )})`
                )
                .all() as any;

            // get source sessions
            let sessionIds: string[];
            if (conf.mode == "sessions") {
                sessionIds = conf.selectedSessions;
            } else if (conf.mode == "instruments" || conf.mode == "archive") {
                sessionIds = sourceDb
                    .prepare(
                        `SELECT DISTINCT(sid) AS sid FROM activityLog ${logsQueryCondition}`
                    )
                    .all()
                    .filter((row: any) => row.sid != null)
                    .map((row: any) => row.sid.toString());
            } else if (conf.mode == "shortcuts") {
                sessionIds = [];
            } else {
                throw "this mode not implemented";
            }
            const sourceSessions = sourceDb
                .prepare(
                    `SELECT * FROM "history/sessions" WHERE id IN (${sessionIds.join(
                        ","
                    )})`
                )
                .all() as any;

            // get source shortcuts
            let sourceShortcuts;
            if (conf.mode == "shortcuts") {
                sourceShortcuts = sourceDb
                    .prepare(
                        `SELECT * FROM "shortcuts/shortcuts" WHERE  id IN (${conf.selectedShortcuts.join(
                            ","
                        )})`
                    )
                    .all() as any;
            } else {
                sourceShortcuts = sourceDb
                    .prepare(
                        `SELECT * FROM "shortcuts/shortcuts" WHERE "groupName" IN (${instrumentIds
                            .map(id => `'__instrument__${id}'`)
                            .join(",")})`
                    )
                    .all() as any;
            }

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

                    await pause();
                }
            }
            for (const instrumentId of instrumentIds) {
                if (
                    !mapSourceInstrumentToDestInstrumentId.get(
                        BigInt(instrumentId)
                    )
                ) {
                    mapSourceInstrumentToDestInstrumentId.set(
                        BigInt(instrumentId),
                        BigInt(0)
                    );
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
                        .get([sourceSession.uuid]) as any;
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

                    await pause();
                }
            }

            // insert destination shortcuts
            if (conf.mode == "shortcuts") {
                if (sourceShortcuts.length > 0) {
                    const shortcutColumns = Object.keys(
                        sourceShortcuts[0]
                    ).filter(column => column != "id");

                    for (const sourceShortcut of sourceShortcuts) {
                        destDb
                            .prepare(
                                `INSERT INTO "shortcuts/shortcuts" (${shortcutColumns.join(
                                    ","
                                )}) VALUES (${shortcutColumns
                                    .map(() => "?")
                                    .join(",")})`
                            )
                            .run([
                                ...shortcutColumns.map(
                                    column => sourceShortcut[column]
                                )
                            ]);
                    }

                    await pause();
                }
            } else {
                if (sourceShortcuts.length > 0) {
                    const shortcutColumns = Object.keys(
                        sourceShortcuts[0]
                    ).filter(column => column != "id" && column != "groupName");

                    for (const sourceShortcut of sourceShortcuts) {
                        const sourceInstrumentId = BigInt(
                            sourceShortcut.groupName.substr(
                                "__instrument__".length
                            )
                        );

                        const groupName =
                            "__instrument__" +
                            mapSourceInstrumentToDestInstrumentId.get(
                                sourceInstrumentId
                            );

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

                    await pause();
                }
            }

            // insert destination logs in chunks
            const logsCountRow = sourceDb
                .prepare(
                    `SELECT count(*) as count FROM activityLog ${logsQueryCondition}`
                )
                .get() as any;

            const CHUNK = 100;
            let offset = 0;
            let logColumns: string[] | undefined;
            while (true) {
                const logs = sourceDb
                    .prepare(
                        `SELECT * FROM activityLog ${logsQueryCondition} limit ${CHUNK} offset ${offset}`
                    )
                    .all() as any;

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
                            (log: any) =>
                                `(?, ?, ${logColumns!
                                    .map(() => "?")
                                    .join(",")})`
                        )}`
                    )
                    .run(
                        logs.reduce(
                            (arr: any, log: any) => [
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
                    render: `Exporting ${Math.round(progress * 100)}%`,
                    progress
                });

                await pause();

                if (logs.length < CHUNK) {
                    break;
                }
            }

            storeDescription(destDb, conf.description);

            // delete source logs
            if (conf.removeHistoryAfterExport) {
                sourceDb.exec(`DELETE FROM activityLog ${logsQueryCondition}`);
            }

            notification.update(progressToastId, {
                autoClose: 1000,
                render: "Exported successfully",
                progress: undefined,
                closeOnClick: true,
                type: notification.SUCCESS
            });
        } catch (err) {
            notification.update(progressToastId, {
                render: "Export failed: " + err,
                progress: 1,
                closeOnClick: true,
                type: notification.ERROR
            });
        } finally {
            destDb?.close();
        }
    }

    async importDatabase(filePath: string) {
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

            await pause();

            // get source instrument
            const sourceInstruments = sourceDb
                .prepare("SELECT * FROM instrument")
                .all() as any;

            await pause();

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

                await pause();
            }

            const logsCountRow = sourceDb
                .prepare("SELECT count(*) as count FROM activityLog")
                .get() as any;

            await pause();

            // get source sessions
            const sourceSessions = sourceDb
                .prepare(`SELECT * FROM "history/sessions"`)
                .all() as any;

            await pause();

            // get source shortcuts
            const sourceShortcuts = sourceDb
                .prepare(`SELECT * FROM "shortcuts/shortcuts"`)
                .all() as any;

            await pause();

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

                    await pause();
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
                        .get([sourceSession.uuid]) as any;
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

                    await pause();
                }
            }

            // insert destination shortcuts
            const destShortcutIds = [];
            if (sourceShortcuts.length > 0) {
                const shortcutColumns = Object.keys(sourceShortcuts[0]).filter(
                    column => column != "id" && column != "groupName"
                );

                for (const sourceShortcut of sourceShortcuts) {
                    let groupName = sourceShortcut["groupName"];

                    if (groupName.startsWith("__instrument__")) {
                        const sourceInstrumentId = BigInt(
                            sourceShortcut.groupName.substr(
                                "__instrument__".length
                            )
                        );

                        const destinationInstrumentId =
                            mapSourceInstrumentToDestInstrumentId.get(
                                sourceInstrumentId
                            );

                        if (destinationInstrumentId) {
                            groupName =
                                "__instrument__" +
                                mapSourceInstrumentToDestInstrumentId.get(
                                    sourceInstrumentId
                                );
                        } else {
                            groupName = "Imported";
                            if (
                                !destDb
                                    .prepare(
                                        `SELECT * FROM "shortcuts/groups" WHERE name = ?`
                                    )
                                    .get([groupName])
                            ) {
                                destDb
                                    .prepare(
                                        `INSERT INTO "shortcuts/groups" (name) VALUES (?)`
                                    )
                                    .run([groupName]);
                            }
                        }
                    } else {
                        if (
                            !destDb
                                .prepare(
                                    `SELECT * FROM "shortcuts/groups" WHERE name = ?`
                                )
                                .get([groupName])
                        ) {
                            destDb
                                .prepare(
                                    `INSERT INTO "shortcuts/groups" (name) VALUES (?)`
                                )
                                .run([groupName]);
                        }
                    }

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

                await pause();
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
                    .all() as any;

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
                            (log: any) =>
                                `(?, ?, ${logColumns!
                                    .map(() => "?")
                                    .join(",")})`
                        )}`
                    )
                    .run(
                        logs.reduce(
                            (arr: any, log: any) => [
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
                    render: `Importing ${Math.round(progress * 100)}%`,
                    progress
                });

                await pause();

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
                await pause();
            }

            for (const objectId of destSessionIds) {
                ipcRenderer.send(
                    "shared/store/create-object-notify/" + "history/sessions",
                    {
                        objectId
                    }
                );
                await pause();
            }

            for (const objectId of destShortcutIds) {
                ipcRenderer.send(
                    "shared/store/create-object-notify/" +
                        "shortcuts/shortcuts",
                    {
                        objectId
                    }
                );
                await pause();
            }

            notification.update(progressToastId, {
                autoClose: 1000,
                render: "Imported successfully",
                progress: undefined,
                closeOnClick: true,
                type: notification.SUCCESS
            });
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

////////////////////////////////////////////////////////////////////////////////

async function pause() {
    await new Promise(resolve => setTimeout(resolve, 0));
}
