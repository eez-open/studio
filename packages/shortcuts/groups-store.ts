import { values } from "mobx";

import { isRenderer } from "eez-studio-shared/util-electron";

import {
    createStore,
    types,
    createStoreObjectsCollection,
    beginTransaction,
    commitTransaction
} from "eez-studio-shared/store";

import { IGroup } from "shortcuts/interfaces";
import { store as shortcutsStore, shortcuts } from "shortcuts/shortcuts-store";

const store = createStore({
    storeName: "shortcuts/groups",
    versionTables: ["instrument/groups/version", "shortcuts/groups/version"],
    versions: [
        // version 1
        `CREATE TABLE "instrument/groups/version"(version INT NOT NULL);
        INSERT INTO "instrument/groups/version"(version) VALUES (1);
        CREATE TABLE "instrument/groups"(
            name TEXT NOT NULL
        );
        INSERT INTO "instrument/groups"(name) VALUES ('Default');`,

        // version 2
        `CREATE UNIQUE INDEX "instrument/groups/name" ON "instrument/groups"(name);
        UPDATE "instrument/groups/version" SET version = 2;`,

        // version 3
        `CREATE TABLE "shortcuts/groups-new"(name TEXT NOT NULL);
        INSERT INTO "shortcuts/groups-new"(name) SELECT name FROM "instrument/groups";
        DROP INDEX "instrument/groups/name";
        DROP TABLE "instrument/groups";
        ALTER TABLE "shortcuts/groups-new" RENAME TO "shortcuts/groups";
        CREATE UNIQUE INDEX "shortcuts/groups/name" ON "shortcuts/groups"(name);
        ALTER TABLE "instrument/groups/version" RENAME TO "shortcuts/groups/version";
        UPDATE "shortcuts/groups/version" SET version = 3;`,

        // version 4
        `ALTER TABLE "shortcuts/groups" ADD COLUMN deleted BOOLEAN;
        UPDATE "shortcuts/groups" SET deleted=0;
        UPDATE "shortcuts/groups/version" SET version = 4;`,

        // version 5
        `CREATE TABLE "shortcuts/groups-new"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            deleted BOOLEAN,
            name TEXT NOT NULL);
        INSERT INTO "shortcuts/groups-new"(id, deleted, name)
            SELECT ROWID, deleted, name FROM "shortcuts/groups";
        DROP TABLE "shortcuts/groups";
        ALTER TABLE "shortcuts/groups-new" RENAME TO "shortcuts/groups";
        UPDATE "shortcuts/groups/version" SET version = 5;`,

        // version 6
        // migrate version to versions table
        `DROP TABLE "shortcuts/groups/version";
        CREATE TABLE IF NOT EXISTS versions(tableName TEXT PRIMARY KEY, version INT NOT NULL);
        INSERT INTO versions(tableName, version) VALUES ('shortcuts/groups', 6);
        `
    ],
    properties: {
        id: types.id,
        name: types.string,
        deleted: types.boolean
    }
});

const collection = createStoreObjectsCollection<IGroup>();
if (isRenderer()) {
    store.watch(collection);
}
export const groups = collection.objects;

export function addGroup(group: Partial<IGroup>) {
    beginTransaction("Add shortcuts group");
    let result = store.createObject(group);
    commitTransaction();
    return result;
}

export function updateGroup(changes: Partial<IGroup>) {
    beginTransaction("Edit shortcuts group");

    if (changes.name) {
        const group = groups.get(changes.id!);
        if (group && group.name != changes.name) {
            values(shortcuts)
                .filter(shortcut => shortcut.groupName === group.name)
                .forEach(shortcut =>
                    shortcutsStore.updateObject({
                        id: shortcut.id,
                        groupName: changes.name
                    })
                );
        }
    }

    store.updateObject(changes);

    commitTransaction();
}

export function deleteGroup(group: Partial<IGroup>) {
    beginTransaction("Delete shortcuts group");

    store.deleteObject(group);

    values(shortcuts)
        .filter(shortcut => shortcut.groupName === group.name)
        .forEach(shortcut => shortcutsStore.deleteObject(shortcut));

    commitTransaction();
}
