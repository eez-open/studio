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

        UPDATE activityLogVersion SET version = 4;`
    ],

    properties: {
        id: types.id,
        date: types.date,
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

        if (filterSpecification.oid && message.object.oid !== filterSpecification.oid) {
            return false;
        }

        if (
            filterSpecification.oids &&
            filterSpecification.oids.indexOf(message.object.oid) === -1
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
    oid: string;
    type: string;
    message: string;
    data: any;
    deleted: boolean;
}

export function log(activityLogEntry: Partial<IActivityLogEntry>, options: IStoreOperationOptions) {
    activityLogEntry.date = new Date();

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
