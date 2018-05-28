import * as React from "react";
import { observable, computed, action, runInAction } from "mobx";

import { isRenderer } from "shared/util";
import { createStore, types, createStoreObjectsCollection } from "shared/store";
import { Rect } from "shared/geometry";
import { IActivityLogEntry } from "shared/activity-log";

import { getObject } from "shared/extensions/extensions";
import { IObject, IEditor, IActivityLogEntryInfo } from "shared/extensions/extension";

import { IBaseObject } from "shared/model/base-object";

import { Icon } from "shared/ui/icon";
import { ITab } from "shared/ui/tabs";

import { instrumentStore } from "instrument/instrument-object";

import { HomeComponent } from "home/home-component";

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
        this.rect = props.rect;
    }

    id: string;
    type: string;
    oid: string;
    @observable rect: Rect;
    @observable selected: boolean;

    @observable _boundingRect: Rect | undefined;

    @computed
    get implementation() {
        return getObject(this.type, this.oid);
    }

    get name() {
        return this.implementation.name;
    }

    @computed
    get boundingRect() {
        return this._boundingRect || this.rect;
    }

    @action
    setBoundingRect(rect: Rect) {
        this._boundingRect = rect;
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

    get resizable() {
        return this.implementation.resizable;
    }

    @action
    toggleSelect() {
        this.selected = !this.selected;
    }

    getEditor() {
        return this.implementation.getEditor();
    }

    open() {
        const tab = tabs.findObjectTab(this.type, this.implementation.id);
        if (tab) {
            tabs.makeActive(tab);
        } else {
            const editor = this.getEditor();
            if (editor !== null) {
                tabs.addObjectTab(this.type, this.implementation, editor);
            } else {
                this.implementation.open();
            }
        }
    }

    @action
    setRect(rect: Rect) {
        this.rect = rect;
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
}

export type IObject = IBaseObject;

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
        UPDATE "workbench/objects/version" SET version = 4;`
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
            instrumentStore.deleteObject(object.implementation);
        }
    }
    store.deleteObject(object);
}

////////////////////////////////////////////////////////////////////////////////

interface IHomeTab extends ITab {
    editor: JSX.Element;
}

class HomeTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;

    id = "home";
    title = (
        <React.Fragment>
            <Icon icon="material: home" />
            <span>Home</span>
        </React.Fragment>
    );

    editor = <HomeComponent />;

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }
}

class ObjectEditorTab implements IHomeTab {
    constructor(
        public tabs: Tabs,
        public objectType: string,
        public object: IObject,
        public objectEditor: IEditor
    ) {
        this.objectEditor.onCreate();
    }

    permanent: boolean = true;
    @observable _active: boolean = false;

    get active() {
        return this._active;
    }

    set active(value: boolean) {
        if (value !== this._active) {
            runInAction(() => (this._active = value));

            if (this._active) {
                this.objectEditor.onActivate();
            } else {
                this.objectEditor.onDeactivate();
            }
        }
    }

    get id() {
        return this.object.id;
    }

    get title() {
        return this.object.name;
    }

    get editor() {
        return this.objectEditor.editor;
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
        this.objectEditor.onTerminate();
    }
}

class Tabs {
    @observable tabs: IHomeTab[] = [new HomeTab(this)];
    @observable activeTab: IHomeTab;

    constructor() {
        this.tabs[0].makeActive();
    }

    findObjectTab(objectType: string, objectId: string) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; ++tabIndex) {
            const tab = this.tabs[tabIndex];
            if (
                tab instanceof ObjectEditorTab &&
                tab.objectType === objectType &&
                tab.id === objectId
            ) {
                return tab;
            }
        }
        return null;
    }

    @action
    addObjectTab(objectType: string, object: IObject, editor: IEditor) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; ++tabIndex) {
            if (this.tabs[tabIndex].id === object.id) {
                this.makeActive(this.tabs[tabIndex]);
                return;
            }
        }

        const tab = new ObjectEditorTab(this, objectType, object, editor);
        this.tabs.push(tab);
        this.makeActive(tab);
    }

    @action
    removeTab(tab: IHomeTab) {
        const tabIndex = this.tabs.indexOf(tab);
        if (tabIndex !== -1) {
            const tab = this.tabs[tabIndex];
            this.tabs.splice(tabIndex, 1);
            if (tab.active) {
                if (tabIndex === this.tabs.length) {
                    this.makeActive(this.tabs[tabIndex - 1]);
                } else {
                    this.makeActive(this.tabs[tabIndex]);
                }
            }
        }
    }

    @action
    makeActive(tab: IHomeTab) {
        if (this.activeTab) {
            this.activeTab.active = false;
        }
        this.activeTab = tab;
        if (this.activeTab) {
            this.activeTab.active = true;
        }
    }
}

export const tabs = new Tabs();

////////////////////////////////////////////////////////////////////////////////

if (isRenderer()) {
    window.onmessage = message => {
        if (message.data.type === "open-tab-or-window") {
            const tab = tabs.findObjectTab(message.data.object.type, message.data.object.id);
            if (tab) {
                tabs.makeActive(tab);
            } else {
                EEZStudio.electron.ipcRenderer.send("openWindow", message.data.openWindowArgs);
            }
        }
    };
}
