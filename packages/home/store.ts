import { observable, computed, runInAction } from "mobx";

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

import { tabs } from "home/tabs-store";

import { instrumentStore } from "instrument/instrument-object";
import { IWorkbenchObject } from "home/designer/store";

////////////////////////////////////////////////////////////////////////////////

export interface IWorkbenchObjectProps {
    id: string;
    type: string;
    oid: string;
    rect: Rect;
}

export class WorkbenchObject implements IWorkbenchObject {
    constructor(props: IWorkbenchObjectProps) {
        this.id = props.id;
        this.type = props.type;
        this.oid = props.oid;
        this.rect = props.rect;
    }

    id: string;
    type: string;
    oid: string;
    @observable private _rect: Rect;

    children: WorkbenchObject[] = [];

    @computed
    get implementation() {
        return getObject(this.type, this.oid);
    }

    get name() {
        return this.implementation.name;
    }

    get rect() {
        return {
            left: this._rect.left,
            top: this._rect.top,
            width: 128,
            height: 164
        };
    }

    set rect(rect: Rect) {
        runInAction(() => (this._rect = rect));
    }

    @computed
    get boundingRect() {
        return this.rect;
    }

    get content(): JSX.Element | null {
        return this.implementation.content;
    }

    activityLogEntryInfo(logEntry: IActivityLogEntry): IActivityLogEntryInfo | null {
        return this.implementation.activityLogEntryInfo(logEntry);
    }

    get details(): JSX.Element | null {
        return this.implementation.details;
    }

    open() {
        if (this.isEditable) {
            this.openEditor("default");
        }
    }

    get isMoveable() {
        return true;
    }

    get isEditable() {
        return this.implementation.isEditable;
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
                EEZStudio.electron.ipcRenderer.sendSync("focusWindow", this.getEditorWindowArgs())
            ) {
                return;
            }
            target = "tab";
        }

        if (target === "tab") {
            const tab = tabs.findObjectTab(this.id);
            if (tab) {
                // tab already exists
                tabs.makeActive(tab);
            } else {
                // close window if open
                EEZStudio.electron.ipcRenderer.send("closeWindow", this.getEditorWindowArgs());

                // open tab
                const tab = tabs.addObjectTab(this);
                tab.makeActive();
            }
        } else {
            // close tab if open
            const tab = tabs.findObjectTab(this.id);
            if (tab) {
                tabs.removeTab(tab);
            }

            // open window
            EEZStudio.electron.ipcRenderer.send("openWindow", this.getEditorWindowArgs());
        }
    }

    saveRect() {
        store.updateObject({
            id: this.id,
            rect: this.rect
        });
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
