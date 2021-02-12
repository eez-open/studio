import React from "react";
import { observable, action, runInAction, reaction, autorun } from "mobx";
import { bind } from "bind-decorator";

import { scheduleTask, Priority } from "eez-studio-shared/scheduler";
import { IStore } from "eez-studio-shared/store";

import { IEditor } from "eez-studio-shared/extensions/extension";

import { IShortcut } from "shortcuts/interfaces";
import { bindShortcuts } from "shortcuts/mousetrap";

import { InstrumentObject, instruments } from "instrument/instrument-object";

import { App } from "instrument/window/app";
import { NavigationStore } from "instrument/window/navigation-store";
import { ScriptsModel, ScriptView } from "instrument/window/scripts";
import * as ScriptModule from "instrument/window/script";
import { ShortcutsStore, GroupsStore } from "instrument/window/shortcuts";
import { UndoManager } from "instrument/window/undo";

import {
    History,
    DeletedItemsHistory,
    SelectHistoryItemsSpecification
} from "instrument/window/history/history";

import { Filters } from "instrument/window/history/filters";

import { Terminal } from "instrument/window/terminal/terminal";
import { CommandsTree } from "instrument/window/terminal/commands-tree";

import { createInstrumentListStore } from "instrument/window/lists/store";
import { BaseList } from "instrument/window/lists/store-renderer";
import { getScrapbookStore } from "instrument/window/history/scrapbook";

////////////////////////////////////////////////////////////////////////////////

export class InstrumentAppStore implements IEditor {
    @observable instrument: InstrumentObject | undefined = undefined;
    @observable helpVisible: boolean = false;
    @observable filters: Filters = new Filters();
    @observable selectHistoryItemsSpecification:
        | SelectHistoryItemsSpecification
        | undefined = undefined;
    @observable selectedHistoryItems = new Map<string, boolean>();

    navigationStore = new NavigationStore(this);
    scriptsModel = new ScriptsModel(this);
    shortcutsStore = new ShortcutsStore(this);
    groupsStore = new GroupsStore(this);

    commandsTree = new CommandsTree();

    history: History = new History(this);
    deletedItemsHistory: DeletedItemsHistory = new DeletedItemsHistory(this);

    undoManager = new UndoManager();

    instrumentListStore: IStore;
    @observable instrumentLists: BaseList[] = [];

    editor: JSX.Element | null = null;

    terminal: Terminal | null = null;

    scriptView: ScriptView | null = null;

    autorunDisposer: any;
    reactionDisposer: any;

    _created = false;

    constructor(private instrumentId: string) {}

    onCreate() {
        if (this._created) {
            return;
        }
        this._created = true;

        scheduleTask(
            "Load instrument",
            Priority.High,
            action(async () => {
                this.instrument = instruments.get(this.instrumentId);

                this.helpVisible =
                    localStorage.getItem(`instrument/${this.instrumentId}/window/help-visible`) ===
                        "1" || false;

                this.filters = this.getFiltersFromLocalStorage();

                scheduleTask("Load commands tree", Priority.Low, () =>
                    this.commandsTree.load(this.instrument!.instrumentExtensionId)
                );

                bindShortcuts(this.shortcutsStore.instrumentShortcuts, (shortcut: IShortcut) => {
                    if (shortcut.action.type === "micropython") {
                        return;
                    }
                    const {
                        executeShortcut
                    } = require("instrument/window/script") as typeof ScriptModule;
                    executeShortcut(this, shortcut);
                });

                // @todo
                // this is autorun because instrument extension is loaded asynchronously,
                // so getListsProperty would eventually become true
                this.autorunDisposer = autorun(() => {
                    if (this.instrument!.listsProperty) {
                        this.instrumentListStore = createInstrumentListStore(this);

                        const appStore = this;

                        this.instrumentListStore.watch({
                            createObject(object: any) {
                                runInAction(() => appStore.instrumentLists.push(object));
                            },

                            updateObject(changes: any) {
                                const list = appStore.instrumentLists.find(
                                    list => list.id === changes.id
                                );
                                if (list) {
                                    runInAction(() => {
                                        list.applyChanges(changes);
                                    });
                                }
                            },

                            deleteObject(object: any) {
                                const list = appStore.instrumentLists.find(
                                    list => list.id === object.id
                                );
                                if (list) {
                                    runInAction(() => {
                                        appStore.instrumentLists.splice(
                                            appStore.instrumentLists.indexOf(list),
                                            1
                                        );
                                    });
                                }
                            }
                        });
                    }
                });
            })
        );

        this.reactionDisposer = reaction(
            () => JSON.stringify(this.filters),
            filters => {
                localStorage.setItem(`instrument/${this.instrumentId}/window/filters`, filters);
            }
        );
    }

    onActivate() {
        EEZStudio.electron.ipcRenderer.on("undo", this.undoManager.undo);
        EEZStudio.electron.ipcRenderer.on("redo", this.undoManager.redo);
        EEZStudio.electron.ipcRenderer.on("save", this.onSave);
        EEZStudio.electron.ipcRenderer.on("delete", this.onDeleteShortcut);
        document.addEventListener("keydown", this.onKeyDown);
    }

    onDeactivate() {
        EEZStudio.electron.ipcRenderer.removeListener("undo", this.undoManager.undo);
        EEZStudio.electron.ipcRenderer.removeListener("redo", this.undoManager.redo);
        EEZStudio.electron.ipcRenderer.removeListener("save", this.onSave);
        EEZStudio.electron.ipcRenderer.removeListener("delete", this.onDeleteShortcut);
        document.removeEventListener("keydown", this.onKeyDown);
    }

    onTerminate() {
        if (this.instrument) {
            this.instrument.terminate();
        }
        this.editor = null;
        this.terminal = null;
        this.scriptView = null;
        if (this.autorunDisposer) {
            this.autorunDisposer();
        }
        if (this.reactionDisposer) {
            this.reactionDisposer();
        }
        this.undoManager.onTerminate();
        this.history.onTerminate();
    }

    onBeforeAppClose() {
        return this.undoManager.confirmSave();
    }

    render() {
        if (!this.editor) {
            this.editor = <App appStore={this} />;
        }
        return this.editor;
    }

    @bind
    onSave() {
        if (this.undoManager.modified) {
            this.undoManager.commit();
        }
    }

    @bind
    onDeleteShortcut() {
        if (document.activeElement) {
            if ($(document.activeElement).closest(".EezStudio_History_Container").length > 0) {
                this.history.deleteSelectedHistoryItems();
            } else if (
                $(document.activeElement).closest(".EezStudio_DeletedHistory_Container").length > 0
            ) {
                this.deletedItemsHistory.deleteSelectedHistoryItems();
            } else if (
                $(document.activeElement).closest(".EezStudio_Scrapbook_Container").length > 0
            ) {
                getScrapbookStore().deleteSelectedHistoryItems();
            }
        }
    }

    @bind
    onKeyDown(event: KeyboardEvent) {
        if (event.target && $(event.target).parents(".modal").length > 0) {
            // ignore if target is modal dialog
            return;
        }

        if (event.ctrlKey && event.keyCode == 65) {
            // Ctrl+A
            if (event.target instanceof HTMLInputElement) {
                return;
            }

            if (document.activeElement) {
                if ($(document.activeElement).closest(".EezStudio_History_Container").length > 0) {
                    event.preventDefault();
                    this.history.selection.selectItems(this.history.items);
                } else if (
                    $(document.activeElement).closest(".EezStudio_DeletedHistory_Container")
                        .length > 0
                ) {
                    event.preventDefault();
                    this.deletedItemsHistory.selection.selectItems(this.deletedItemsHistory.items);
                } else if (
                    $(document.activeElement).closest(".EezStudio_Scrapbook_Container").length > 0
                ) {
                    event.preventDefault();
                    getScrapbookStore().selectAllItems(this.history.appStore);
                }
            }
        }
    }

    getFiltersFromLocalStorage(): Filters {
        const filters = new Filters();

        let filtersJSON = localStorage.getItem(`instrument/${this.instrumentId}/window/filters`);
        if (filtersJSON) {
            try {
                Object.assign(filters, JSON.parse(filtersJSON));
            } catch (err) {
                console.error("getFiltersFromLocalStorage", err);
            }
        }

        return filters;
    }

    @action
    toggleHelpVisible() {
        this.helpVisible = !this.helpVisible;
        localStorage.setItem(
            `instrument/${this.instrumentId}/window/help-visible`,
            this.helpVisible ? "1" : "0"
        );
    }

    @action
    selectHistoryItems(specification: SelectHistoryItemsSpecification | undefined) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    isHistoryItemSelected(id: string) {
        return this.selectedHistoryItems.has(id);
    }

    @action
    selectHistoryItem(id: string, selected: boolean) {
        if (selected) {
            this.selectedHistoryItems.set(id, true);
        } else {
            this.selectedHistoryItems.delete(id);
        }
    }

    findListIdByName(listName: string) {
        const list = this.instrumentLists.find(list => list.name === listName);
        if (list) {
            return list.id;
        }
        return undefined;
    }
}
