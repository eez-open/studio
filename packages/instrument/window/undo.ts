import { ipcRenderer } from "electron";
import { observable, action, runInAction, autorun, makeObservable } from "mobx";

import { objectClone } from "eez-studio-shared/util";
import { confirmSave } from "eez-studio-shared/util-renderer";
import {
    IStore,
    beginTransaction,
    commitTransaction
} from "eez-studio-shared/store";
import type { ICommand } from "instrument/window/history/history";

export interface IModel {
    modified: boolean;
    commit(): void;
    rollback(): void;
    canUndo: boolean;
    undo(): void;
    canRedo: boolean;
    redo(): void;
}

export class UndoManager {
    dbObject: boolean;
    store: IStore;
    object: any;
    transactionLabel: string;
    undoStack: ICommand[] = [];
    redoStack: ICommand[] = [];
    _model: IModel | undefined;
    autorunDisposer: any;

    constructor() {
        makeObservable(this, {
            dbObject: observable,
            undoStack: observable.shallow,
            redoStack: observable.shallow,
            _model: observable.shallow,
            commit: action.bound,
            rollback: action,
            addCommand: action,
            undo: action.bound,
            redo: action.bound
        });

        this.autorunDisposer = autorun(() => {
            ipcRenderer.send("windowSetState", {
                modified: this.modified,
                undo: this.canUndo,
                redo: this.canRedo
            });
        });
    }

    onTerminate() {
        this.autorunDisposer();
    }

    confirmSave() {
        return new Promise<boolean>(resolve => {
            if (this.modified) {
                confirmSave({
                    saveCallback: () => {
                        this.commit();
                        resolve(true);
                    },
                    dontSaveCallback: () => {
                        this.rollback();
                        resolve(true);
                    },
                    cancelCallback: () => resolve(false)
                });
            } else {
                resolve(true);
            }
        });
    }

    get modified() {
        return (
            (this.dbObject && this.undoStack.length > 0) ||
            (this._model && this._model.modified)
        );
    }

    commit() {
        if (this.dbObject) {
            try {
                beginTransaction(this.transactionLabel);
                this.store.updateObject(objectClone(this.object));
                commitTransaction();
            } finally {
                this.dbObject = false;
                this.object = undefined;
                this.undoStack = [];
                this.redoStack = [];
            }
        } else if (this._model) {
            this._model.commit();
            this._model = undefined;
        }
    }

    rollback() {
        if (this.dbObject) {
            try {
                runInAction(() => {
                    while (this.canUndo) {
                        this.undo();
                    }
                });
            } finally {
                this.dbObject = false;
                this.object = undefined;
                this.undoStack = [];
                this.redoStack = [];
            }
        } else if (this._model) {
            this._model.rollback();
            this._model = undefined;
        }
    }

    set model(value: IModel | undefined) {
        if (this.model) {
            throw "try to set model while object is already set";
        }

        runInAction(() => {
            this._model = value;
        });
    }

    addCommand(
        transactionLabel: string,
        store: IStore,
        object: any,
        command: ICommand
    ) {
        if (this._model) {
            throw "try to add command while model is already set";
        }

        if (this.dbObject) {
            if (store !== this.store) {
                throw "try to add command to undo stack for different store";
            }

            if (object !== this.object) {
                throw "try to add command to undo stack for different object";
            }

            this.transactionLabel = transactionLabel;
        } else {
            this.dbObject = true;
            this.store = store;
            this.transactionLabel = transactionLabel;
            this.object = object;
        }

        this.undoStack.push(command);
        this.redoStack = [];

        command.execute();
    }

    get canUndo() {
        if (this._model) {
            return this._model.canUndo;
        }
        if (this.dbObject) {
            return this.undoStack.length > 0;
        }
        return undefined;
    }

    undo() {
        if (this._model) {
            this._model.undo();
            return;
        }

        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
        } else {
            console.error("Undo stack is empty");
            return;
        }
    }

    get canRedo() {
        if (this._model) {
            return this._model.canRedo;
        }
        if (this.dbObject) {
            return this.redoStack.length > 0;
        }
        return undefined;
    }

    redo() {
        if (this._model) {
            this._model.redo();
            return;
        }

        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
        } else {
            console.error("Redo stack is empty");
            return;
        }
    }
}
