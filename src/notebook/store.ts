import { isRenderer } from "shared/util";
import {
    createStore,
    types,
    createStoreObjectsCollection,
    IFilterSpecification
} from "shared/store";

////////////////////////////////////////////////////////////////////////////////

export interface INotebook {
    id: string;
    name: string;
}

////////////////////////////////////////////////////////////////////////////////

export const notebooksStore = createStore({
    storeName: "notebook/notebooks",
    versionTables: ["notebook/notebooks/version"],
    versions: [
        // version 1
        `CREATE TABLE "notebook/notebooks/version"(version INT NOT NULL);
        INSERT INTO "notebook/notebooks/version"(version) VALUES (1);
        CREATE TABLE "notebook/notebooks"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            deleted BOOLEAN,
            name TEXT NOT NULL
        );`
    ],
    properties: {
        id: types.id,
        name: types.string,
        deleted: types.boolean
    }
});

const notebookCollection = createStoreObjectsCollection<INotebook>();

if (isRenderer()) {
    notebooksStore.watch(notebookCollection);
}

export const notebooks = notebookCollection.objects;

export function addNotebook(notebook: Partial<INotebook>) {
    return notebooksStore.createObject(notebook);
}

export function updateNotebook(notebook: Partial<INotebook>) {
    notebooksStore.updateObject(notebook);
}

export function deleteNotebook(notebook: Partial<INotebook>) {
    notebooksStore.deleteObject(notebook);
}

////////////////////////////////////////////////////////////////////////////////

export interface INotebookItem {
    id: string;
    date: Date;
    oid: string;
    sid: string;
    type: string;
    message: string;
    data: any;
    deleted: boolean;
}

export interface INotebookItemsFilterSpecification extends IFilterSpecification {
    oid?: string;
}

export const itemsStore = createStore({
    storeName: "notebook/items",
    versionTables: ["notebook/items/version"],
    versions: [
        // version 1
        `CREATE TABLE "notebook/items/version"(version INT NOT NULL);
        INSERT INTO "notebook/items/version"(version) VALUES (1);
        CREATE TABLE "notebook/items"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            date INTEGER NOT NULL,
            sid INTEGER,
            oid INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT,
            deleted BOOLEAN
        );`
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
            object: INotebookItem[] | INotebookItem;
        },
        filterSpecification: INotebookItemsFilterSpecification
    ) {
        if (Array.isArray(message.object)) {
            return true;
        }

        if (
            filterSpecification &&
            filterSpecification.oid &&
            message.object.oid !== filterSpecification.oid
        ) {
            return false;
        }

        return true;
    },

    prepareWhereClause(filterSpecification: INotebookItemsFilterSpecification) {
        if (!filterSpecification || !filterSpecification.oid) {
            return undefined;
        }

        let whereClause: string = "";
        let params: any[] = [];

        if (filterSpecification.oid !== undefined) {
            whereClause += "oid=?";
            params.push(parseInt(filterSpecification.oid));
        }

        return {
            whereClause,
            params
        };
    },

    orderBy: "date"
});

const itemsCollection = createStoreObjectsCollection<INotebookItem>();

if (isRenderer()) {
    itemsStore.watch(itemsCollection);
}

export const items = itemsCollection.objects;
