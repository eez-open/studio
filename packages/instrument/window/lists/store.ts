import { createStore, types } from "eez-studio-shared/store";

import type { InstrumentAppStore } from "instrument/window/app-store";

import type * as ListsFactoryModule from "instrument/window/lists/factory";

export function createInstrumentListStore(appStore: InstrumentAppStore | null) {
    return createStore({
        storeName: "instrument/list",
        versionTables: ["instrument/list/version"],
        versions: [
            // version 1
            `CREATE TABLE "instrument/list/version"(version INT NOT NULL);
            INSERT INTO "instrument/list/version"(version) VALUES (1);
            CREATE TABLE "instrument/list"(
                deleted INTEGER NOT NULL,
                name TEXT,
                data TEXT
            );`,

            // version 2
            `ALTER TABLE "instrument/list" ADD COLUMN type TEXT;
            UPDATE "instrument/list" SET type='table';
            UPDATE "instrument/list/version" SET version = 2;`,

            // version 3
            `ALTER TABLE "instrument/list" ADD COLUMN description TEXT;
            UPDATE "instrument/list" SET description='';
            UPDATE "instrument/list/version" SET version = 3;`,

            // version 4
            `CREATE TABLE "instrument/list-new"(
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
                deleted INTEGER NOT NULL,
                name TEXT,
                data TEXT,
                type TEXT,
                description TEXT);
            INSERT INTO "instrument/list-new"(id, deleted, name, data, type, description)
                SELECT ROWID, deleted, name, data, type, description FROM "instrument/list";
            DROP TABLE "instrument/list";
            ALTER TABLE "instrument/list-new" RENAME TO "instrument/list";
            UPDATE "instrument/list/version" SET version = 4;`,

            // version 5
            // migrate version to versions table
            `DROP TABLE "instrument/list/version";
            CREATE TABLE IF NOT EXISTS versions(tableName TEXT PRIMARY KEY, version INT NOT NULL);
            INSERT INTO versions(tableName, version) VALUES ('instrument/list', 5);
            `,

            // version 6
            // migrate version to versions table
            `ALTER TABLE "instrument/list" ADD COLUMN "modifiedAt" INTEGER;
            UPDATE versions SET version = 6 WHERE "tableName" = 'instrument/list';
            `
        ],
        properties: {
            id: types.id,
            deleted: types.boolean,
            name: types.string,
            description: types.string,
            type: types.string,
            data: types.object,
            modifiedAt: types.date
        },
        create: (props: any) => {
            const { createListObject } =
                require("instrument/window/lists/factory") as typeof ListsFactoryModule;
            return createListObject(props);
        }
    });
}
