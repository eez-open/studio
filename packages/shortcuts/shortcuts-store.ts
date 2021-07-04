import { values } from "mobx";

import { isRenderer } from "eez-studio-shared/util-electron";
import { db } from "eez-studio-shared/db";
import { sendMessage } from "eez-studio-shared/notify";
import {
    createStore,
    types,
    createStoreObjectsCollection
} from "eez-studio-shared/store";

import { IShortcut } from "shortcuts/interfaces";
import { DEFAULT_TOOLBAR_BUTTON_COLOR } from "shortcuts/toolbar-button-colors";

export const SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX = "__extension__";
export const SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX = "__instrument__";
export const FROM_EXTENSION_GROUP_NAME = "From instrument extension";

////////////////////////////////////////////////////////////////////////////////

export const store = createStore({
    storeName: "shortcuts/shortcuts",
    versionTables: [
        "instrumentShortcutsVersion",
        "instrument/shortcuts/version",
        "shortcuts/shortcuts/version"
    ],
    versions: [
        // version 1
        `CREATE TABLE instrumentShortcutsVersion(version INT NOT NULL);
        INSERT INTO instrumentShortcutsVersion(version) VALUES (1);
        CREATE TABLE instrumentShortcuts(
            name TEXT NOT NULL,
            action TEXT NOT NULL,
            keybinding TEXT
        );`,

        // version 2
        `ALTER TABLE instrumentShortcuts ADD COLUMN "group" TEXT;
        UPDATE instrumentShortcuts SET "group" = 'Default';
        ALTER TABLE instrumentShortcuts ADD COLUMN showInToolbar BOOLEAN;
        UPDATE instrumentShortcuts SET showInToolbar = 1;
        ALTER TABLE instrumentShortcuts ADD COLUMN requireConfirmation BOOLEAN;
        UPDATE instrumentShortcuts SET requireConfirmation = 0;
        UPDATE "instrumentShortcutsVersion" SET version = 2;`,

        // version 3
        `CREATE TABLE instrumentShortcutsNew(
            name TEXT NOT NULL,
            action TEXT NOT NULL,
            keybinding TEXT,
            "group" TEXT,
            showInToolbar BOOLEAN,
            requiresConfirmation BOOLEAN
        );
        INSERT INTO instrumentShortcutsNew(name, action, keybinding, "group", showInToolbar, requiresConfirmation)
            SELECT name, action, keybinding, "group", showInToolbar, requireConfirmation FROM instrumentShortcuts;
        DROP TABLE instrumentShortcuts;
        ALTER TABLE instrumentShortcutsNew RENAME TO instrumentShortcuts;
        UPDATE "instrumentShortcutsVersion" SET version = 3;`,

        // version 4
        `ALTER TABLE instrumentShortcuts ADD COLUMN toolbarButtonColor TEXT;
        UPDATE instrumentShortcuts SET toolbarButtonColor = '${DEFAULT_TOOLBAR_BUTTON_COLOR}';
        UPDATE "instrumentShortcutsVersion" SET version = 4;`,

        // version 5
        `ALTER TABLE instrumentShortcuts ADD COLUMN toolbarButtonPosition INTEGER;
        UPDATE "instrumentShortcutsVersion" SET version = 5;`,

        // version 6
        `CREATE TABLE instrumentShortcutsNew(
            name TEXT NOT NULL,
            action TEXT NOT NULL,
            keybinding TEXT,
            groupName TEXT,
            showInToolbar BOOLEAN,
            toolbarButtonColor TEXT,
            toolbarButtonPosition INTEGER,
            requiresConfirmation BOOLEAN
        );
        INSERT INTO instrumentShortcutsNew(name, action, keybinding, groupName, showInToolbar, toolbarButtonColor, toolbarButtonPosition, requiresConfirmation)
            SELECT name, action, keybinding, "group", showInToolbar, toolbarButtonColor, toolbarButtonPosition, requiresConfirmation FROM instrumentShortcuts;
        DROP TABLE instrumentShortcuts;
        ALTER TABLE instrumentShortcutsNew RENAME TO instrumentShortcuts;
        CREATE INDEX instrumentShortcuts_groupName ON instrumentShortcuts(groupName);
        UPDATE "instrumentShortcutsVersion" SET version = 6;`,

        // version 7
        `ALTER TABLE instrumentShortcutsVersion RENAME TO "instrument/shortcuts/version";
        ALTER TABLE instrumentShortcuts RENAME TO "instrument/shortcuts";
        UPDATE "instrument/shortcuts/version" SET version = 7;`,

        // version 8
        `CREATE TABLE "shortcuts/shortcuts-new"(name TEXT NOT NULL,
            action TEXT NOT NULL,
            keybinding TEXT,
            groupName TEXT,
            showInToolbar BOOLEAN,
            toolbarButtonColor TEXT,
            toolbarButtonPosition INTEGER,
            requiresConfirmation BOOLEAN);
        INSERT INTO "shortcuts/shortcuts-new"(name, action, keybinding, groupName, showInToolbar, toolbarButtonColor, toolbarButtonPosition, requiresConfirmation)
            SELECT name, action, keybinding, groupName, showInToolbar, toolbarButtonColor, toolbarButtonPosition, requiresConfirmation FROM "instrument/shortcuts";
        DROP INDEX IF EXISTS instrumentShortcuts_groupName;
        DROP TABLE "instrument/shortcuts";
        ALTER TABLE "shortcuts/shortcuts-new" RENAME TO "shortcuts/shortcuts";
        CREATE INDEX "shortcuts/shortcuts/groupName" ON "shortcuts/shortcuts"(groupName);
        ALTER TABLE "instrument/shortcuts/version" RENAME TO "shortcuts/shortcuts/version";
        UPDATE "shortcuts/shortcuts/version" SET version = 8;`,

        // version 9
        `ALTER TABLE "shortcuts/shortcuts" ADD COLUMN originalId TEXT;
        UPDATE "shortcuts/shortcuts/version" SET version = 9;`,

        // version 10
        `ALTER TABLE "shortcuts/shortcuts" ADD COLUMN deleted BOOLEAN;
        UPDATE "shortcuts/shortcuts"SET deleted=0;
        UPDATE "shortcuts/shortcuts/version" SET version = 10;`,

        // version 11
        `CREATE TABLE "shortcuts/shortcuts-new"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            deleted BOOLEAN,
            name TEXT NOT NULL,
            action TEXT NOT NULL,
            keybinding TEXT,
            groupName TEXT,
            showInToolbar BOOLEAN,
            toolbarButtonColor TEXT,
            toolbarButtonPosition INTEGER,
            requiresConfirmation BOOLEAN,
            originalId TEXT);
        INSERT INTO "shortcuts/shortcuts-new"(id, deleted, name, action, keybinding, groupName, showInToolbar, toolbarButtonColor, toolbarButtonPosition, requiresConfirmation, originalId)
            SELECT ROWID, deleted, name, action, keybinding, groupName, showInToolbar, toolbarButtonColor, toolbarButtonPosition, requiresConfirmation, originalId FROM "shortcuts/shortcuts";
        DROP TABLE "shortcuts/shortcuts";
        ALTER TABLE "shortcuts/shortcuts-new" RENAME TO "shortcuts/shortcuts";
        UPDATE "shortcuts/shortcuts/version" SET version = 11;`,

        // version 12
        // migrate version to versions table
        `DROP TABLE "shortcuts/shortcuts/version";
        CREATE TABLE IF NOT EXISTS versions(tableName TEXT PRIMARY KEY, version INT NOT NULL);
        INSERT INTO versions(tableName, version) VALUES ('shortcuts/shortcuts', 12);
        `
    ],
    properties: {
        id: types.id,
        originalId: types.string,
        name: types.string,
        action: types.object,
        keybinding: types.string,
        groupName: types.string,
        showInToolbar: types.boolean,
        toolbarButtonPosition: types.integer,
        toolbarButtonColor: types.string,
        requiresConfirmation: types.boolean,
        selected: types.transient(types.boolean, false),
        deleted: types.boolean
    }
});

const collection = createStoreObjectsCollection<IShortcut>();
if (isRenderer()) {
    store.watch(collection);
}
export const shortcuts = collection.objects;

export function addShortcut(shortcut: Partial<IShortcut>) {
    return store.createObject(shortcut);
}

export function updateShortcut(shortcut: Partial<IShortcut>) {
    store.updateObject(shortcut);
}

export function deleteShortcut(shortcut: Partial<IShortcut>) {
    store.deleteObject(shortcut);
}

export function deleteGroupInShortcuts(groupName: string) {
    db.prepare(`DELETE FROM "${store.storeName}" WHERE groupName = ?`).run(
        groupName
    );

    let changedShortcuts = values(shortcuts)
        .filter(shortcut => shortcut.groupName === groupName)
        .map(shortcut => ({ id: shortcut.id }));

    sendMessage(store.notifySource, {
        op: "delete",
        object: changedShortcuts
    });
}
