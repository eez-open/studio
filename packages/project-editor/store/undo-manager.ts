import { makeObservable } from "mobx";
import { observable, computed, action } from "mobx";

import type { ProjectStore } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

interface IUndoItem {
    commands: ICommand[];
    selectionBefore: any;
    selectionAfter: any;
}

export class UndoManager {
    undoStack: IUndoItem[] = [];
    redoStack: IUndoItem[] = [];
    commands: ICommand[] = [];

    private selectionBeforeFirstCommand: any;
    public combineCommands: boolean = false;

    postponeSetCombineCommandsFalse: boolean = false;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            undoStack: observable,
            redoStack: observable,
            commands: observable,
            clear: action,
            pushToUndoStack: action,
            setCombineCommands: action,
            executeCommand: action,
            canUndo: computed,
            undoDescription: computed,
            undo: action,
            canRedo: computed,
            redoDescription: computed,
            redo: action
        });
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    pushToUndoStack() {
        if (this.commands.length > 0) {
            // TODO set selectionAfter to current selection
            const selectionAfter = undefined;

            this.undoStack.push({
                commands: this.commands,
                selectionBefore: this.selectionBeforeFirstCommand,
                selectionAfter: selectionAfter
            });

            this.commands = [];

            // TODO set this.selectionBeforeFirstCommand to current selection
            this.selectionBeforeFirstCommand = undefined;
        }
    }

    setCombineCommands(value: boolean) {
        if (value == false && this.postponeSetCombineCommandsFalse) {
            return;
        }

        this.pushToUndoStack();
        this.combineCommands = value;

        if (!this.combineCommands) {
            this.projectStore.updateLastRevisionStable();
        }
    }

    executeCommand(command: ICommand) {
        if (this.commands.length == 0) {
            // TODO set this.selectionBeforeFirstCommand to current selection
            this.selectionBeforeFirstCommand = undefined;
        } else {
            if (!this.combineCommands) {
                this.pushToUndoStack();
            }
        }

        command.execute();

        command.revision = Symbol();
        command.previousRevision = this.projectStore.setModified(
            command.revision
        );

        this.commands.push(command);

        this.redoStack = [];
    }

    static getCommandsDescription(commands: ICommand[]) {
        return commands[commands.length - 1].description;
    }

    get canUndo() {
        return this.undoStack.length > 0 || this.commands.length > 0;
    }

    get undoDescription() {
        let commands;
        if (this.commands.length > 0) {
            commands = this.commands;
        } else if (this.undoStack.length > 0) {
            commands = this.undoStack[this.undoStack.length - 1].commands;
        }
        if (commands) {
            return UndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    undo() {
        this.pushToUndoStack();

        let undoItem = this.undoStack.pop();
        if (undoItem) {
            for (let i = undoItem.commands.length - 1; i >= 0; i--) {
                undoItem.commands[i].undo();
                this.projectStore.setModified(
                    undoItem.commands[i].previousRevision!
                );
            }

            // TODO select undoItem.selectionBefore

            this.redoStack.push(undoItem);

            this.projectStore.project.enableTabs();
        }
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    get redoDescription() {
        let commands;
        if (this.redoStack.length > 0) {
            commands = this.redoStack[this.redoStack.length - 1].commands;
        }
        if (commands) {
            return UndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    redo() {
        let redoItem = this.redoStack.pop();
        if (redoItem) {
            for (let i = 0; i < redoItem.commands.length; i++) {
                redoItem.commands[i].execute();
                this.projectStore.setModified(redoItem.commands[i].revision!);
            }

            // TODO select redoItem.selectionAfter

            this.undoStack.push(redoItem);

            this.projectStore.project.enableTabs();
        }
    }
}

export interface ICommand {
    execute(): void;
    undo(): void;
    description: string;
    revision?: symbol;
    previousRevision?: symbol;
}

export interface IUndoManager {
    executeCommand(command: ICommand): void;
    combineCommands: boolean;
    commands: ICommand[];
}
