import { computed, toJS } from "mobx";

import { isRenderer } from "eez-studio-shared/util-electron";
import {
    createStore,
    types,
    createStoreObjectsCollection,
    beginTransaction,
    commitTransaction
} from "eez-studio-shared/store";
import { Rect } from "eez-studio-shared/geometry";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import { getObject } from "eez-studio-shared/extensions/extensions";
import { IActivityLogEntryInfo } from "eez-studio-shared/extensions/extension";

import * as TabsStoreModule from "home/tabs-store";

import { instrumentStore } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

export interface IWorkbenchObjectProps {
    id: string;
    type: string;
    oid: string;
    rect: Rect;
}

export class WorkbenchObject {
    constructor(props: IWorkbenchObjectProps) {
        this.id = props.id;
        this.type = props.type;
        this.oid = props.oid;
    }

    id: string;
    type: string;
    oid: string;

    @computed
    get implementation() {
        return getObject(this.type, this.oid);
    }

    get name() {
        return this.implementation.name;
    }

    get content(): JSX.Element | null {
        return this.implementation.content;
    }

    activityLogEntryInfo(
        logEntry: IActivityLogEntry
    ): IActivityLogEntryInfo | null {
        return this.implementation.activityLogEntryInfo(logEntry);
    }

    get details(): JSX.Element | null {
        return this.implementation.details;
    }

    open() {
        this.openEditor("default");
    }

    getEditor() {
        return this.implementation.getEditor!();
    }

    getEditorWindowArgs() {
        return this.implementation.getEditorWindowArgs!();
    }

    openEditor(target: "tab" | "window" | "default") {
        if (target === "default") {
            if (
                EEZStudio.electron.ipcRenderer.sendSync(
                    "focusWindow",
                    this.getEditorWindowArgs()
                )
            ) {
                return;
            }
            target = "tab";
        }

        const { tabs } = require("home/tabs-store") as typeof TabsStoreModule;

        if (target === "tab") {
            const tab = tabs.findTab(this.id);
            if (tab) {
                // tab already exists
                tabs.makeActive(tab);
            } else {
                // close window if open
                EEZStudio.electron.ipcRenderer.send(
                    "closeWindow",
                    toJS(this.getEditorWindowArgs())
                );

                // open tab
                const tab = tabs.addObjectTab(this);
                tab.makeActive();
            }
        } else {
            // close tab if open
            const tab = tabs.findTab(this.id);
            if (tab) {
                tabs.removeTab(tab);
            }

            // open window
            EEZStudio.electron.ipcRenderer.send(
                "openWindow",
                toJS(this.getEditorWindowArgs())
            );
        }
    }

    afterDelete() {
        if (this.implementation && this.implementation.afterDelete) {
            this.implementation.afterDelete();
        }
    }

    addToContextMenu(menu: Electron.Menu) {
        if (this.implementation.addToContextMenu) {
            this.implementation.addToContextMenu(menu);
        }
    }

    getIcon() {
        return this.implementation.getIcon();
    }
}

////////////////////////////////////////////////////////////////////////////////

export const store = createStore({
    storeName: "workbench/objects",
    versionTables: ["front-panel/objects/version", "workbench/objects/version"],
    versions: [
        // version 1
        `CREATE TABLE "front-panel/objects/version"(version INT NOT NULL);
        INSERT INTO "front-panel/objects/version"(version) VALUES (1);
        CREATE TABLE "front-panel/objects"(
            deleted INTEGER NOT NULL,
            type TEXT NOT NULL,
            oid TEXT NOT NULL,
            rect TEXT NOT NULL
        );`,

        // version 2
        `ALTER TABLE "front-panel/objects" RENAME TO "workbench/objects";
        ALTER TABLE "front-panel/objects/version" RENAME TO "workbench/objects/version";
        UPDATE "workbench/objects/version" SET version = 2;`,

        // version 3
        `CREATE TABLE "workbench/objects-new"(
            deleted INTEGER NOT NULL,
            type TEXT NOT NULL,
            oid INTEGER NOT NULL,
            rect TEXT NOT NULL);
        INSERT INTO "workbench/objects-new"(deleted, type, oid, rect)
            SELECT deleted, type, oid, rect FROM "workbench/objects";
        DROP TABLE "workbench/objects";
        ALTER TABLE "workbench/objects-new" RENAME TO "workbench/objects";
        UPDATE "workbench/objects/version" SET version = 3;`,

        // version 4
        `CREATE TABLE "workbench/objects-new"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            deleted INTEGER NOT NULL,
            type TEXT NOT NULL,
            oid INTEGER NOT NULL,
            rect TEXT NOT NULL);
        INSERT INTO "workbench/objects-new"(id, deleted, type, oid, rect)
            SELECT ROWID, deleted, type, oid, rect FROM "workbench/objects";
        DROP TABLE "workbench/objects";
        ALTER TABLE "workbench/objects-new" RENAME TO "workbench/objects";
        UPDATE "workbench/objects/version" SET version = 4;`,

        // version 5
        // migrate version to versions table
        `DROP TABLE "workbench/objects/version";
        CREATE TABLE IF NOT EXISTS versions(tableName TEXT PRIMARY KEY, version INT NOT NULL);
        INSERT INTO versions(tableName, version) VALUES ('workbench/objects', 5);
        `
    ],
    properties: {
        id: types.id,
        deleted: types.boolean,
        type: types.string,
        oid: types.foreign,
        rect: types.object,
        selected: types.transient(types.boolean, false)
    },
    create(props: IWorkbenchObjectProps) {
        return new WorkbenchObject(props);
    }
});

const collection = createStoreObjectsCollection<WorkbenchObject>();
if (isRenderer()) {
    store.watch(collection);
}
export const workbenchObjects = collection.objects;

export function findWorkbenchObjectById(id: string) {
    return collection.objects.get(id);
}

export function deleteWorkbenchObject(object: WorkbenchObject) {
    if (object.type === "instrument") {
        if (object.implementation) {
            instrumentStore.deleteObject({
                id: object.implementation.id
            });
        }
    }
    store.deleteObject(object);
}

////////////////////////////////////////////////////////////////////////////////

if (isRenderer()) {
    window.onmessage = (message: any) => {
        for (let key of workbenchObjects.keys()) {
            const workbenchObject = workbenchObjects.get(key);
            if (
                workbenchObject &&
                message.data.object &&
                workbenchObject.type === message.data.object.type &&
                workbenchObject.oid === message.data.object.id
            ) {
                if (message.data.type === "open-object-editor") {
                    workbenchObject.openEditor(message.data.target);
                } else if (message.data.type === "delete-object") {
                    beginTransaction("Delete workbench item");
                    deleteWorkbenchObject(workbenchObject);
                    commitTransaction();
                }
                return;
            }
        }
    };
}
