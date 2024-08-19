import fs from "fs";
import { ipcRenderer } from "electron";
import Database from "better-sqlite3";
import {
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction,
    toJS
} from "mobx";

import { isRenderer } from "eez-studio-shared/util-electron";

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

export let db = new Database(getActiveDbPath());
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
            const Database = require("better-sqlite3");
            db = new Database(this.filePath);

            const result = db.prepare("SELECT description FROM settings").get();

            if (result != undefined) {
                return result.description;
            }
        } catch (err) {
            console.error(err);
        } finally {
            db?.close();
        }
        return "";
    }

    storeDescription() {
        let db;
        try {
            const Database = require("better-sqlite3");
            db = new Database(this.filePath);

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

export function initInstrumentDatabase(filePath: string) {
    const Database = require("better-sqlite3");
    const db = new Database(filePath);

    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    for (const store of allStores) {
        for (let version = 0; version < store.versions.length; version++) {
            const versionSQL = store.versions[version];

            if (typeof versionSQL === "function") {
                versionSQL(db);
            } else {
                db.exec(versionSQL);
            }
        }
    }

    db.exec(`COMMIT TRANSACTION`);

    db.close();
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

    exportInstrumentToDatabase(instrumentId: string, filePath: string) {
        const result1 = db
            .prepare("SELECT * FROM instrument WHERE id = ?")
            .get([instrumentId]);
        console.log(result1);

        const result2 = db
            .prepare("SELECT count(*) as count FROM activityLog WHERE oid = ?")
            .get([instrumentId]);
        console.log(result2);
    }

    importInstrumentFromDatabase(filePath: string) {}
}

export const instrumentDatabases = new InstrumentDatabases();
