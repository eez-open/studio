import type * as ElectronModule from "electron";
import { observable, computed, action, toJS, makeObservable } from "mobx";
import { each, map, keys, pickBy } from "lodash";
import type { Database } from "better-sqlite3";

import { db } from "eez-studio-shared/db";
import { watch, sendMessage, registerSource } from "eez-studio-shared/notify";
import { isRenderer } from "eez-studio-shared/util-electron";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

export type StoreOperation =
    | "create"
    | "restore"
    | "read"
    | "update"
    | "delete";

interface IStoreObjectsCollection<T> {
    createObject(
        object: T,
        op: StoreOperation,
        options?: IStoreOperationOptions
    ): void;
    updateObject(
        changes: Partial<T>,
        op: StoreOperation,
        options?: IStoreOperationOptions
    ): void;
    deleteObject(
        object: T,
        op: StoreOperation,
        options?: IStoreOperationOptions
    ): void;
}

export function createStoreObjectsCollection<
    T extends {
        id: string;
        deleted?: boolean;
        afterCreate?(): void;
        afterRestore?(): void;
        afterDelete?(): void;
    }
>(isDeletedCollection?: boolean) {
    const objects = observable.map<string, T>();

    return {
        objects: objects,

        createObject(
            object: T,
            op: StoreOperation,
            options?: IStoreOperationOptions
        ) {
            objects.set(object.id, object);

            if (!isDeletedCollection) {
                if (op === "create") {
                    if (object.afterCreate) {
                        object.afterCreate();
                    }
                } else if (op === "restore") {
                    if (object.afterRestore) {
                        object.afterRestore();
                    }
                }
            }
        },

        updateObject(
            changes: Partial<T>,
            op: StoreOperation,
            options?: IStoreOperationOptions
        ) {
            const object = objects.get(changes.id!);
            if (object) {
                each(changes, function (value: any, key: string) {
                    (object as any)[key] = value;
                });
            }
        },

        deleteObject(
            object: T,
            op: StoreOperation,
            options?: IStoreOperationOptions
        ) {
            let collectionObject = objects.get(object.id);
            if (collectionObject) {
                if (
                    !isDeletedCollection &&
                    collectionObject.afterDelete &&
                    !(options && options.deletePermanently)
                ) {
                    collectionObject.afterDelete();
                }

                objects.delete(object.id);
            }
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

interface IType {
    fromDB?: (value: any) => any;
    toDB?: (value: any) => any;
    transient?: boolean;
    lazy?: boolean;
    defaultValue?: any;
}

export const types = {
    id: {
        transient: true
    },
    foreign: {
        fromDB: (value: any) => (value != null ? value.toString() : null),
        toDB: (value: any) => value
    },
    any: {},
    string: {},
    boolean: {
        fromDB: (value: any) => !!Number(value),
        toDB: (value: any) => (value ? 1 : 0)
    },
    integer: {
        fromDB: (value: any) => Number(value),
        toDB: (value: any) => value
    },
    object: {
        fromDB: (value: any) => (value ? JSON.parse(value) : undefined),
        toDB: (value: any) => JSON.stringify(toJS(value))
    },
    date: {
        fromDB: (value: any) => (value ? new Date(Number(value)) : null),
        toDB: (value: any) => {
            if (value == null) {
                return null;
            }
            if (typeof value === "string") {
                return new Date(value).getTime();
            }
            return value && value.getTime();
        }
    },
    transient: (type: IType, defaultValue?: any) =>
        Object.assign({}, type, { transient: true, defaultValue }),
    lazy: (type: IType) => Object.assign({}, type, { lazy: true })
};

////////////////////////////////////////////////////////////////////////////////

export interface IFilterSpecification {
    skipInitialQuery?: boolean;
    deletedOption?: "exclude" | "include" | "only";
}

export interface IStoreOperationOptions {
    undoable?: boolean;
    deletePermanently?: boolean;
    transaction?: string;
}

export interface IStore {
    storeName: string;
    storeVersion: any;
    notifySource: {
        id: string;
        filterMessage(
            message: any,
            filterSpecification: IFilterSpecification
        ): boolean;
        onNewTarget(
            targetId: string,
            filterSpecification: IFilterSpecification,
            inProcessTarget: boolean
        ): void;
    };
    createObject(object: any, options?: IStoreOperationOptions): any;
    updateObject(object: any, options?: IStoreOperationOptions): void;
    deleteObject(object: any, options?: IStoreOperationOptions): void;
    undeleteObject(object: any, options?: IStoreOperationOptions): void;
    findById(id: string): any;
    findByOid(oid: string): any;
    watch(
        objectsCollection: IStoreObjectsCollection<any>,
        filterSpecification?: IFilterSpecification
    ): string;
    nonTransientAndNonLazyProperties: string;
    dbRowToObject: (row: any) => any;
    getSourceDescription?: (sid: string) => string | null;
}

export function createStore({
    storeName,
    versionTables,
    versions,
    properties,
    create,
    filterMessage,
    prepareWhereClause,
    orderBy,
    getSourceDescription,
    onInit
}: {
    storeName: string;
    versionTables?: (
        | string
        | {
              tableName: string;
          }
    )[];
    versions: (string | ((db: Database) => void))[];
    properties: { [propertyName: string]: IType };
    create?: (props: any) => any;
    filterMessage?: (
        message: any,
        filterSpecification: IFilterSpecification
    ) => boolean;
    prepareWhereClause?: (
        filterSpecification: IFilterSpecification
    ) => { whereClause: string; params: any[] } | undefined;
    orderBy?: string;
    getSourceDescription?: (sid: string) => string | null;
    onInit?: () => void;
}) {
    function execCreateObject(object: any, options?: IStoreOperationOptions) {
        let questionMarks = map(
            nonTransientProperties,
            (value: IType, key: string) => "?"
        ).join(",");

        let values = map(nonTransientProperties, (value: IType, key: string) =>
            value.toDB ? value.toDB(object[key]) : object[key]
        );

        let info = db
            .prepare(
                `INSERT INTO "${storeName}"(${keys(nonTransientProperties).join(
                    ","
                )}) VALUES(${questionMarks})`
            )
            .run(values);

        object.id = info.lastInsertRowid.toString();

        const notifyArg = {
            op: "create",
            object,
            options
        };

        const undoable =
            !(options && options.undoable === false) &&
            undoManager.currentTransaction;
        if (undoable) {
            undoManager.execCommand({
                store,
                notifyArg,
                undo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET deleted=1 WHERE id = ?`
                            )
                            .run(object.id),
                    notifyArg: {
                        op: "delete",
                        object,
                        options
                    }
                },
                redo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET deleted=0 WHERE id = ?`
                            )
                            .run(object.id),
                    notifyArg: {
                        op: "restore",
                        object,
                        options
                    }
                }
            });
        } else {
            sendMessage(store.notifySource, notifyArg);
        }

        return object.id;
    }

    function notifyCreateObject(objectId: string) {
        const object = findById(objectId);

        const notifyArg = {
            op: "create",
            object,
            options: {}
        };
        sendMessage(store.notifySource, notifyArg);
    }

    function execUpdateObject(object: any, options?: IStoreOperationOptions) {
        const changedProperties = pickBy(
            object,
            (value: any, key: string) =>
                properties[key] && !properties[key].transient
        );

        const undoable =
            !(options && options.undoable === false) &&
            undoManager.currentTransaction;

        // select old values
        const undoValues: any = [];
        const undoObject: any = {
            id: object.id
        };
        if (undoable) {
            let propertyNames = Object.keys(changedProperties);
            const query = `SELECT ${propertyNames.join(
                ","
            )} FROM "${storeName}" WHERE id = ?`;

            const row: any = db.prepare(query).get(object.id);
            map(propertyNames, propertyName => {
                undoValues.push(row[propertyName]);
                let type = properties[propertyName];
                undoObject[propertyName] = type.fromDB
                    ? type.fromDB(row[propertyName])
                    : row[propertyName];
            });
            undoValues.push(object.id);
        }

        // update
        const columns = map(changedProperties, (value, key) => key + "=?").join(
            ","
        );

        let values = map(changedProperties, (value, key) => {
            let toDB = properties[key].toDB;
            return toDB ? toDB(value) : value;
        });

        values.push(object.id);

        db.prepare(`UPDATE "${storeName}" SET ${columns} WHERE id = ?`).run(
            values
        );

        const notifyArg = {
            op: "update",
            object,
            options
        };

        if (undoable) {
            undoManager.execCommand({
                store,
                notifyArg,
                undo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET ${columns} WHERE id = ?`
                            )
                            .run(undoValues),
                    notifyArg: {
                        op: "update",
                        object: undoObject,
                        options
                    }
                },
                redo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET ${columns} WHERE id = ?`
                            )
                            .run(values),
                    notifyArg
                }
            });
        } else {
            sendMessage(store.notifySource, notifyArg);
        }
    }

    function execDeleteObject(object: any, options?: IStoreOperationOptions) {
        const notifyArg = {
            op: "delete",
            object,
            options
        };

        const undoable =
            !(
                options &&
                (options.undoable === false ||
                    options.deletePermanently === true)
            ) && undoManager.currentTransaction;
        if (undoable) {
            db.prepare(`UPDATE "${storeName}" SET deleted=1 WHERE id = ?`).run(
                object.id
            );

            undoManager.execCommand({
                store,
                notifyArg,
                undo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET deleted=0 WHERE id = ?`
                            )
                            .run(object.id),
                    notifyArg: {
                        op: "restore",
                        object,
                        options
                    }
                },
                redo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET deleted=1 WHERE id = ?`
                            )
                            .run(object.id),
                    notifyArg: {
                        op: "delete",
                        object,
                        options
                    }
                }
            });
        } else {
            if (object.id) {
                db.prepare(`DELETE FROM "${storeName}" WHERE id = ?`).run(
                    object.id
                );
            } else {
                db.prepare(`DELETE FROM "${storeName}" WHERE oid = ?`).run(
                    object.oid
                );
            }

            if (options && options.deletePermanently) {
                undoManager.removeAllTransactionsReferencingObject(
                    store,
                    object
                );
            }

            sendMessage(store.notifySource, notifyArg);
        }
    }

    function execUndeleteObject(object: any, options?: IStoreOperationOptions) {
        const notifyArg = {
            op: "restore",
            object,
            options
        };

        db.prepare(`UPDATE "${storeName}" SET deleted=0 WHERE id = ?`).run(
            object.id
        );

        const undoable =
            !(
                options &&
                (options.undoable === false ||
                    options.deletePermanently === true)
            ) && undoManager.currentTransaction;
        if (undoable) {
            undoManager.execCommand({
                store,
                notifyArg,
                undo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET deleted=1 WHERE id = ?`
                            )
                            .run(object.id),
                    notifyArg: {
                        op: "delete",
                        object,
                        options
                    }
                },
                redo: {
                    exec: () =>
                        db
                            .prepare(
                                `UPDATE "${storeName}" SET deleted=0 WHERE id = ?`
                            )
                            .run(object.id),
                    notifyArg: {
                        op: "restore",
                        object,
                        options
                    }
                }
            });
        } else {
            sendMessage(store.notifySource, notifyArg);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    if (!isRenderer()) {
        const { ipcMain } = require("electron");

        ipcMain.on(
            "shared/store/create-object/" + storeName,
            (event: any, arg: any) => {
                event.returnValue = execCreateObject(arg.object, arg.options);
            }
        );

        ipcMain.on(
            "shared/store/create-object-notify/" + storeName,
            (event: any, arg: any) => {
                notifyCreateObject(arg.objectId);
            }
        );

        ipcMain.on(
            "shared/store/update-object/" + storeName,
            (event: any, arg: any) => {
                execUpdateObject(arg.object, arg.options);
                event.returnValue = true;
            }
        );

        ipcMain.on(
            "shared/store/delete-object/" + storeName,
            (event: any, arg: any) => {
                execDeleteObject(arg.object, arg.options);
                event.returnValue = true;
            }
        );

        ipcMain.on(
            "shared/store/undelete-object/" + storeName,
            (event: any, arg: any) => {
                execUndeleteObject(arg.object, arg.options);
                event.returnValue = true;
            }
        );
    }

    function createObject(object: any, options?: IStoreOperationOptions) {
        if (isRenderer()) {
            const { ipcRenderer } =
                require("electron") as typeof ElectronModule;
            return ipcRenderer.sendSync(
                "shared/store/create-object/" + storeName,
                {
                    object: toJS(observable(object)),
                    options
                }
            );
        } else {
            return execCreateObject(object, options);
        }
    }

    function updateObject(object: any, options?: IStoreOperationOptions) {
        if (isRenderer()) {
            const { ipcRenderer } =
                require("electron") as typeof ElectronModule;
            ipcRenderer.sendSync("shared/store/update-object/" + storeName, {
                object: toJS(object),
                options
            });
        } else {
            return execUpdateObject(object, options);
        }
    }

    function deleteObject(object: any, options?: IStoreOperationOptions) {
        if (isRenderer()) {
            const { ipcRenderer } =
                require("electron") as typeof ElectronModule;
            ipcRenderer.sendSync("shared/store/delete-object/" + storeName, {
                object: {
                    id: object.id,
                    oid: object.oid
                },
                options
            });
        } else {
            return execDeleteObject(object, options);
        }
    }

    function undeleteObject(object: any, options?: IStoreOperationOptions) {
        if (isRenderer()) {
            const { ipcRenderer } =
                require("electron") as typeof ElectronModule;
            ipcRenderer.sendSync("shared/store/undelete-object/" + storeName, {
                object: {
                    id: object.id,
                    oid: object.oid
                },
                options
            });
        } else {
            return execUndeleteObject(object, options);
        }
    }

    function dbRowToObject(row: any) {
        let object: any = {};

        map(properties, (type: IType, propertyName: string) => {
            if (type.transient) {
                if (type === types.id) {
                    object[propertyName] = row.id.toString();
                } else {
                    object[propertyName] = type.defaultValue;
                }
            } else if (!type.lazy) {
                object[propertyName] = type.fromDB
                    ? type.fromDB(row[propertyName])
                    : row[propertyName];
            }
        });

        return object;
    }

    function findById(id: string) {
        let query = `SELECT id, ${nonTransientAndNonLazyProperties} FROM "${storeName}" WHERE id = ?`;

        let result = db.prepare(query).get(id);
        if (result) {
            return dbRowToObject(result);
        }

        return undefined;
    }

    function findByOid(oid: string) {
        let query = `SELECT id, ${nonTransientAndNonLazyProperties} FROM "${storeName}" WHERE oid = ?`;

        let result = db.prepare(query).get(oid);
        if (result) {
            return dbRowToObject(result);
        }

        return undefined;
    }

    ////////////////////////////////////////////////////////////////////////////////

    const nonTransientProperties = pickBy(properties, type => !type.transient);

    const nonTransientAndNonLazyProperties = keys(nonTransientProperties)
        .filter(propertyName => properties[propertyName].lazy !== true)
        .join(",");

    const store: IStore = {
        storeName,
        storeVersion: undefined,
        notifySource: undefined as any,
        createObject,
        updateObject,
        deleteObject,
        undeleteObject,
        findById,
        findByOid,
        watch: undefined as any,
        nonTransientAndNonLazyProperties,
        dbRowToObject,
        getSourceDescription
    };

    ////////////////////////////////////////////////////////////////////////////////

    (function setupTable() {
        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

        let version;

        if (!versionTables) {
            versionTables = [];
        }

        versionTables.splice(0, 0, {
            tableName: storeName
        });

        for (let i = 0; i < versionTables.length; i++) {
            const versionTable = versionTables[i];
            try {
                let versionRows;
                if (typeof versionTable === "string") {
                    versionRows = db.prepare(`SELECT * FROM "${versionTable}"`);
                } else {
                    versionRows = db.prepare(
                        `SELECT * FROM versions WHERE tableName = '${versionTable.tableName}'`
                    );
                }
                const versionRow: any = versionRows.get();
                if (versionRow !== undefined) {
                    version = versionRow.version;
                    break;
                }
            } catch (err) {
                //console.info(err);
            }
        }

        if (version === undefined) {
            version = 0;
        }

        while (version < versions.length) {
            const versionSQL = versions[version++];
            if (typeof versionSQL === "function") {
                versionSQL(db);
            } else {
                db.exec(versionSQL);
            }
        }

        if (onInit) {
            onInit();
        }

        db.exec(`COMMIT TRANSACTION`);

        store.storeVersion = version;
    })();

    ////////////////////////////////////////////////////////////////////////////////

    store.notifySource = {
        id: storeName,

        filterMessage(message: any, filterSpecification: IFilterSpecification) {
            if (filterMessage) {
                return filterMessage(message, filterSpecification);
            }
            return true;
        },

        onNewTarget(
            targetId: string,
            filterSpecification: IFilterSpecification,
            inProcessTarget: boolean
        ) {
            if (!inProcessTarget) {
                return;
            }

            let query = `SELECT id, ${nonTransientAndNonLazyProperties} FROM "${storeName}"`;

            let whereClause: string = "";
            let params: any[] = [];

            if (prepareWhereClause) {
                let result = prepareWhereClause(filterSpecification);
                if (result) {
                    whereClause = result.whereClause;
                    params = result.params;
                }
            }

            if (properties.deleted) {
                let deletedOption =
                    (filterSpecification &&
                        filterSpecification.deletedOption) ||
                    "exclude";
                if (deletedOption === "exclude") {
                    if (whereClause) {
                        whereClause = `(${whereClause}) AND `;
                    }
                    whereClause += "deleted = 0";
                } else if (deletedOption === "only") {
                    if (whereClause) {
                        whereClause = `(${whereClause}) AND `;
                    }
                    whereClause += "deleted = 1";
                }
            }

            if (whereClause) {
                query += " WHERE " + whereClause;
            }

            query += " ORDER BY " + (orderBy || "id");

            let rows = db.prepare(query).all(...params);

            if (rows !== undefined && rows.length > 0) {
                sendMessage(
                    store.notifySource,
                    {
                        op: "read",
                        object: rows.map(dbRowToObject)
                    },
                    targetId
                );
            }
        }
    };

    registerSource(store.notifySource);

    ////////////////////////////////////////////////////////////////////////////////

    store.watch = (objectsCollection, filterSpecification) => {
        let deletedOption =
            (filterSpecification && filterSpecification.deletedOption) ||
            "exclude";

        return watch(
            store.notifySource.id,

            filterSpecification,

            action(
                (params: {
                    op: StoreOperation;
                    object: any;
                    options?: IStoreOperationOptions;
                }) => {
                    function createObject(object: any) {
                        if (create) {
                            object = create(object);
                        }
                        objectsCollection.createObject(
                            object,
                            params.op,
                            params.options
                        );
                        return object;
                    }

                    function updateObject(changes: any) {
                        objectsCollection.updateObject(
                            changes,
                            params.op,
                            params.options
                        );
                    }

                    function deleteObject(object: any) {
                        objectsCollection.deleteObject(
                            object,
                            params.op,
                            params.options
                        );
                    }

                    if (params.op === "create") {
                        if (deletedOption !== "only") {
                            createObject(params.object);
                        }
                    } else if (params.op === "restore") {
                        if (deletedOption !== "only") {
                            createObject(findById(params.object.id));
                        } else {
                            deleteObject(params.object);
                        }
                    } else if (params.op === "read") {
                        params.object.forEach(createObject);
                    } else if (params.op === "update") {
                        if (isArray(params.object)) {
                            params.object.forEach(updateObject);
                        } else {
                            updateObject(params.object);
                        }
                    } else {
                        if (isArray(params.object)) {
                            params.object.forEach(deleteObject);
                        } else {
                            if (
                                deletedOption !== "only" ||
                                (params.options &&
                                    params.options.deletePermanently)
                            ) {
                                deleteObject(params.object);
                            } else {
                                createObject(findById(params.object.id));
                            }
                        }
                    }
                }
            )
        );
    };

    ////////////////////////////////////////////////////////////////////////////////

    allStores.push({
        store,
        versions
    });

    return store;
}

export const allStores: {
    store: IStore;
    versions: (string | ((db: Database) => void))[];
}[] = [];

////////////////////////////////////////////////////////////////////////////////

interface ICommand {
    store: IStore;

    notifyArg: any;

    undo: {
        exec: () => {};
        notifyArg: any;
    };

    redo: {
        exec: () => {};
        notifyArg: any;
    };
}

interface ITransaction {
    label: string;
    commands: ICommand[];
}

class UndoManager {
    undoStack: ITransaction[] = [];
    redoStack: ITransaction[] = [];

    currentTransaction: ITransaction | undefined;
    pendingTransactions: (() => void)[] = [];

    constructor() {
        makeObservable(this, {
            undoStack: observable.shallow,
            redoStack: observable.shallow,
            canUndo: computed,
            undo: action,
            canRedo: computed,
            redo: action,
            execCommitTransaction: action,
            removeAllTransactionsReferencingObject: action
        });
    }

    get canUndo() {
        return this.undoStack.length > 0;
    }

    undo() {
        if (this.undoStack.length === 0) {
            console.error("Undo stack is empty");
            return;
        }

        let transaction = this.undoStack[this.undoStack.length - 1];

        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

        for (let i = transaction.commands.length - 1; i >= 0; i--) {
            transaction.commands[i].undo.exec();
        }

        db.exec(`COMMIT TRANSACTION`);

        for (let i = transaction.commands.length - 1; i >= 0; i--) {
            sendMessage(
                transaction.commands[i].store.notifySource,
                transaction.commands[i].undo.notifyArg
            );
        }

        this.undoStack.pop();
        this.redoStack.push(transaction);
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    redo() {
        if (this.redoStack.length === 0) {
            console.error("Redo stack is empty");
            return;
        }

        let transaction = this.redoStack[this.redoStack.length - 1];

        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

        for (let i = 0; i < transaction.commands.length; i++) {
            transaction.commands[i].redo.exec();
        }

        db.exec(`COMMIT TRANSACTION`);

        for (let i = 0; i < transaction.commands.length; i++) {
            sendMessage(
                transaction.commands[i].store.notifySource,
                transaction.commands[i].redo.notifyArg
            );
        }

        this.redoStack.pop();
        this.undoStack.push(transaction);
    }

    async execBeginTransaction(label: string) {
        if (this.currentTransaction) {
            await new Promise<void>(resolve => {
                this.pendingTransactions.push(resolve);
            });
        }

        this.currentTransaction = {
            label: label,
            commands: []
        };
        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);
    }

    execCommand(command: ICommand) {
        if (!this.currentTransaction) {
            console.error("No transaction to add command");
            return;
        }

        this.currentTransaction.commands.push(command);
    }

    execCommitTransaction() {
        if (!this.currentTransaction) {
            console.error("No transaction to commit");
            return;
        }

        db.exec(`COMMIT TRANSACTION`);

        this.undoStack.push(this.currentTransaction);

        this.currentTransaction.commands.forEach(command =>
            sendMessage(command.store.notifySource, command.notifyArg)
        );

        this.currentTransaction = undefined;

        let nextTransaction = this.pendingTransactions.shift();
        if (nextTransaction) {
            nextTransaction();
        }
    }

    removeAllTransactionsReferencingObject(store: IStore, object: any) {
        const filter = (transaction: ITransaction) => {
            for (let i = 0; i < transaction.commands.length; i++) {
                let command = transaction.commands[i];
                if (command.store === store) {
                    if (
                        object.id &&
                        command.notifyArg.object.id === object.id
                    ) {
                        return false;
                    }
                    if (
                        object.oid &&
                        command.notifyArg.object.oid === object.oid
                    ) {
                        return false;
                    }
                }
            }

            return true;
        };

        this.undoStack = this.undoStack.filter(filter);
        this.redoStack = this.redoStack.filter(filter);
    }
}

export let undoManager: UndoManager;

if (!isRenderer()) {
    undoManager = new UndoManager();

    const { ipcMain } = require("electron");

    ipcMain.on(
        "shared/store/begin-transaction",
        async (event: any, arg: any) => {
            await undoManager.execBeginTransaction(arg);
            event.returnValue = true;
        }
    );

    ipcMain.on("shared/store/commit-transaction", (event: any) => {
        undoManager.execCommitTransaction();
        event.returnValue = true;
    });

    ipcMain.on("shared/store/undo", (event: any) => {
        undoManager.undo();
    });

    ipcMain.on("shared/store/redo", (event: any) => {
        undoManager.redo();
    });
}

export function beginTransaction(label: string) {
    if (isRenderer()) {
        const { ipcRenderer } = require("electron") as typeof ElectronModule;
        return ipcRenderer.sendSync("shared/store/begin-transaction", label);
    } else {
        return undoManager.execBeginTransaction(label);
    }
}

export function commitTransaction() {
    if (isRenderer()) {
        const { ipcRenderer } = require("electron") as typeof ElectronModule;
        ipcRenderer.sendSync("shared/store/commit-transaction");
    } else {
        return undoManager.execCommitTransaction();
    }
}

export function undo() {
    if (isRenderer()) {
        const { ipcRenderer } = require("electron") as typeof ElectronModule;
        ipcRenderer.sendSync("shared/store/undo");
    } else {
        return undoManager.undo();
    }
}

export function redo() {
    if (isRenderer()) {
        const { ipcRenderer } = require("electron") as typeof ElectronModule;
        ipcRenderer.sendSync("shared/store/redo");
    } else {
        return undoManager.redo();
    }
}
