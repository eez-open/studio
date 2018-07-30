import { observable, runInAction } from "mobx";

import { db } from "shared/db";

import { createStore, types, IFilterSpecification, IStoreOperationOptions } from "shared/store";

////////////////////////////////////////////////////////////////////////////////

export const activityLogStore = createStore({
    storeName: "activityLog",

    versionTables: ["activityLogVersion"],

    versions: [
        // version 1
        `CREATE TABLE activityLogVersion(version INT NOT NULL);
        INSERT INTO activityLogVersion(version) VALUES (1);
        CREATE TABLE activityLog(
            date INTEGER NOT NULL,
            oid INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT
        );
        CREATE INDEX IF NOT EXISTS activityLog_date ON activityLog(date);
        CREATE INDEX IF NOT EXISTS activityLog_oidAndDate ON activityLog(oid, date);`,

        // version 2
        `ALTER TABLE activityLog ADD COLUMN deleted BOOLEAN;
        UPDATE activityLog SET deleted=0;
        DROP INDEX activityLog_date;
        DROP INDEX activityLog_oidAndDate;
        CREATE INDEX activityLog_date ON activityLog(date, deleted);
        CREATE INDEX activityLog_oidAndDate ON activityLog(oid, date, deleted);
        UPDATE activityLogVersion SET version = 2;`,

        // version 3
        `CREATE TABLE activityLog2(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            date INTEGER NOT NULL,
            oid INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT,
            deleted BOOLEAN
        );
        DROP INDEX activityLog_date;
        DROP INDEX activityLog_oidAndDate;
        INSERT INTO activityLog2(id, date, oid, type, message, data, deleted)
            SELECT ROWID, date, oid, type, message, data, deleted FROM activityLog;
        DROP TABLE activityLog;
        ALTER TABLE activityLog2 RENAME TO activityLog;
        CREATE INDEX activityLog_date ON activityLog(date, deleted);
        CREATE INDEX activityLog_oidAndDate ON activityLog(oid, date, deleted);
        UPDATE activityLogVersion SET version = 3;`,

        // version 4
        `UPDATE activityLog SET type = 'instrument/file-attachment' WHERE type == "instrument/file"
            AND json_extract(message, '$.direction') = 'upload'
            AND json_extract(message, '$.sourceFilePath') IS NOT NULL;

        UPDATE activityLog SET type = 'instrument/file-download' WHERE type = 'instrument/file'
            AND json_extract(message, '$.direction') = 'upload';

        UPDATE activityLog SET type = 'instrument/file-upload' WHERE type = 'instrument/file';

        UPDATE activityLog SET message == json_replace(message, '$.state', 'upload-filesize') WHERE
            type = "instrument/file-upload" AND json_extract(message, '$.state') = 'download-filesize';

        UPDATE activityLog SET message == json_replace(message, '$.state', 'upload-start') WHERE
            type = "instrument/file-upload" AND json_extract(message, '$.state') = 'download-start';

        UPDATE activityLog SET message == json_replace(message, '$.state', 'upload-error') WHERE
            type = "instrument/file-upload" AND json_extract(message, '$.state') = 'download-error';

        UPDATE activityLog SET message == json_replace(message, '$.state', 'upload-finish') WHERE
            type = "instrument/file-upload" AND json_extract(message, '$.state') = 'download-finish';

        UPDATE activityLogVersion SET version = 4;`,

        // version 5
        `INSERT INTO activityLog(date, oid, type, message, data, deleted)
            SELECT
                date-1, '0', 'activity-log/session', json_set('{}', '$.sessionName', json_extract(message, '$.sessionName')), NULL, 0
            FROM
                activityLog
            WHERE
                type="instrument/connected" AND
                json_valid(message) AND
                json_extract(message, '$.sessionName') IS NOT NULL;

        INSERT INTO activityLog(date, oid, type, message, data, deleted)
            SELECT
                date-1, '0', 'activity-log/session', json_set('{}', '$.sessionName', message), NULL, 0
            FROM
                activityLog
            WHERE
                type="instrument/connected" AND
                message IS NOT NULL AND
                message <> "" AND
                NOT json_valid(message);

        UPDATE activityLogVersion SET version = 5;`,

        // version 6
        `UPDATE activityLog SET type="activity-log/session-start" WHERE type="activity-log/session";

        UPDATE activityLogVersion SET version = 6;`,

        // version 7
        `CREATE TABLE activityLog2(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            date INTEGER NOT NULL,
            sid INTEGER,
            oid INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT,
            deleted BOOLEAN
        );
        DROP INDEX activityLog_date;
        DROP INDEX activityLog_oidAndDate;
        INSERT INTO activityLog2(id, date, oid, type, message, data, deleted)
            SELECT id, date, oid, type, message, data, deleted FROM activityLog;
        DROP TABLE activityLog;
        ALTER TABLE activityLog2 RENAME TO activityLog;
        CREATE INDEX activityLog_date ON activityLog(date, deleted);
        CREATE INDEX activityLog_oidAndDate ON activityLog(oid, date, deleted);
        UPDATE activityLogVersion SET version = 7;`,

        // version 8
        `UPDATE activityLog
        SET sid = (
            SELECT s2.id
            FROM activityLog AS s2
            WHERE
                s2.type = "activity-log/session-start" AND
                (
                    (
                        json_valid(activityLog.message) AND
                        json_extract(s2.message, '$.sessionName') = json_extract(activityLog.message, '$.sessionName')
                    )

                    OR

                    (
                        activityLog.message <> "" AND
                        json_extract(s2.message, '$.sessionName') = activityLog.message
                    )
                )

            )
        WHERE type = "instrument/connected";

        UPDATE activityLog
        SET sid = (
            SELECT s2.sid
            FROM activityLog AS s2
            WHERE
                s2.type = "instrument/connected" AND
                s2.oid = activityLog.oid AND
                s2.date < activityLog.date
            ORDER BY s2.date DESC
            LIMIT 1
        )
        WHERE type <> "instrument/connected" AND type <> "activity-log/session-start";

        UPDATE activityLogVersion SET version = 8;`,

        // version 9
        `INSERT INTO activityLog(date, sid, oid, type, message, data, deleted)
            SELECT
                date+1, sid, '0', 'activity-log/session-close', "", NULL, 0
            FROM
                activityLog
            WHERE
                type="instrument/disconnected" AND
                sid IS NOT NULL;

        UPDATE activityLog
            SET
                message = json_set(
                    message,
                    '$.sessionCloseId',
                    (
                        SELECT activityLog2.id FROM activityLog AS activityLog2 WHERE activityLog2.type = 'activity-log/session-close' AND activityLog2.sid = activityLog.id
                    )
                )
            WHERE
                type = 'activity-log/session-start' AND
                EXISTS(
                    SELECT * FROM activityLog AS activityLog2 WHERE activityLog2.type = 'activity-log/session-close' AND activityLog2.sid = activityLog.id
                );

        UPDATE activityLogVersion SET version = 9;`
    ],

    properties: {
        id: types.id,
        date: types.date,
        sid: types.foreign,
        oid: types.foreign,
        type: types.string,
        message: types.string,
        data: types.lazy(types.any),
        deleted: types.boolean
    },

    filterMessage(
        message: {
            op: "create" | "create-delated" | "read" | "update" | "delete";
            object: IActivityLogEntry[] | IActivityLogEntry;
        },
        filterSpecification: IActivityLogFilterSpecification
    ) {
        if (Array.isArray(message.object)) {
            return true;
        }

        if (message.object.oid === "0") {
            return true;
        }

        if (filterSpecification.oid && message.object.oid !== filterSpecification.oid) {
            return false;
        }

        if (
            filterSpecification.oids &&
            (filterSpecification.oids.length > 0 &&
                filterSpecification.oids.indexOf(message.object.oid) === -1)
        ) {
            return false;
        }

        if (
            filterSpecification.types &&
            filterSpecification.types.indexOf(message.object.type) === -1
        ) {
            return false;
        }

        return true;
    },

    prepareWhereClause(filterSpecification: IActivityLogFilterSpecification) {
        if (
            !(
                filterSpecification.oid ||
                filterSpecification.oids ||
                (filterSpecification.types && filterSpecification.types.length > 0)
            )
        ) {
            return undefined;
        }

        let whereClause: string = "";
        let params: any[] = [];

        if (filterSpecification.oid !== undefined) {
            whereClause += "oid=?";
            params.push(parseInt(filterSpecification.oid));
        }

        if (filterSpecification.oids !== undefined) {
            whereClause +=
                "oid IN (" +
                Array(filterSpecification.oids.length)
                    .fill("?")
                    .join(",") +
                ")";
            params.push(...filterSpecification.oids.map(oid => parseInt(oid)));
        }

        if (filterSpecification.types) {
            const whereClauseTerms: string[] = [];

            filterSpecification.types.forEach(type => {
                whereClauseTerms.push("type=?");
                params.push(type);
            });

            if (filterSpecification.oid !== undefined) {
                whereClause += " AND (";
            }

            whereClause += whereClauseTerms.join(" OR ");

            if (filterSpecification.oid !== undefined) {
                whereClause += ")";
            }
        }

        return {
            whereClause,
            params
        };
    },

    orderBy: "date"
});

////////////////////////////////////////////////////////////////////////////////

export interface IActivityLogFilterSpecification extends IFilterSpecification {
    oid?: string;
    oids?: string[];
    types?: string[];
}

export interface IActivityLogEntry {
    id: string;
    date: Date;
    sid: string | null;
    oid: string;
    type: string;
    message: string;
    data: any;
    deleted: boolean;
}

export function log(activityLogEntry: Partial<IActivityLogEntry>, options: IStoreOperationOptions) {
    activityLogEntry.date = new Date();
    activityLogEntry.sid = activeSession.id;

    if (!activityLogEntry.message) {
        activityLogEntry.message = "";
    }

    return activityLogStore.createObject(activityLogEntry, options);
}

export function logUpdate(
    activityLogEntry: Partial<IActivityLogEntry>,
    options: IStoreOperationOptions
) {
    activityLogStore.updateObject(activityLogEntry, options);
}

export function logDelete(
    activityLogEntry: Partial<IActivityLogEntry>,
    options: IStoreOperationOptions
) {
    activityLogStore.deleteObject(activityLogEntry, options);
}

export function logUndelete(
    activityLogEntry: Partial<IActivityLogEntry>,
    options: IStoreOperationOptions
) {
    activityLogStore.undeleteObject(activityLogEntry, options);
}

export function loadData(id: string) {
    try {
        let result = db.prepare(`SELECT data FROM activityLog WHERE id = ?`).get(id);
        return result && result.data;
    } catch (err) {
        console.error(err);
    }
    return undefined;
}

export function logGet(id: string) {
    return activityLogStore.findById(id);
}

////////////////////////////////////////////////////////////////////////////////

class ActiveSession {
    @observable id: string | undefined;
    @observable message: string | undefined;

    constructor() {
        activityLogStore.watch(
            {
                createObject: (object: any) => {
                    if (object.type === "activity-log/session-start") {
                        runInAction(() => {
                            this.id = object.id;
                            this.message = object.message;
                        });
                    }
                },
                updateObject: (changes: any) => {
                    if (changes.id === this.id && changes.message !== undefined) {
                        try {
                            const message = JSON.parse(changes.message);
                            if (message.sessionCloseId) {
                                runInAction(() => {
                                    this.id = undefined;
                                    this.message = undefined;
                                });
                            } else {
                                runInAction(() => {
                                    this.message = changes.message;
                                });
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                },
                deleteObject: (object: any) => {
                    if (object.id === this.id) {
                        runInAction(() => {
                            this.id = undefined;
                            this.message = undefined;
                        });
                    }
                }
            },
            {
                skipInitialQuery: true
            }
        );

        const result = db
            .prepare(
                `SELECT
                    id
                FROM
                    activityLog
                WHERE
                    type = 'activity-log/session-start' AND
                    json_extract(message, '$.sessionCloseId') IS NULL
                ORDER BY date DESC
                LIMIT 1`
            )
            .get();

        this.id = result && result.id.toString();
    }
}

export const activeSession = new ActiveSession();
