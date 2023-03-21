import { ipcRenderer } from "electron";
import React from "react";
import {
    observable,
    action,
    runInAction,
    reaction,
    autorun,
    makeObservable,
    IReactionDisposer
} from "mobx";

import { scheduleTask, Priority } from "eez-studio-shared/scheduler";
import type { IStore } from "eez-studio-shared/store";

import type { IEditor } from "eez-studio-shared/extensions/extension";

import type { InstrumentObject } from "instrument/instrument-object";

import { App } from "instrument/window/app";
import { NavigationStore } from "instrument/window/navigation-store";
import { ScriptsModel, ScriptViewComponent } from "instrument/window/scripts";
import { ShortcutsStore, GroupsStore } from "instrument/window/shortcuts";
import { UndoManager } from "instrument/window/undo";

import {
    History,
    DeletedItemsHistory,
    SelectHistoryItemsSpecification
} from "instrument/window/history/history";

import { Filters } from "instrument/window/history/filters";

import { TerminalComponent } from "instrument/window/terminal/terminal";

import { createInstrumentListStore } from "instrument/window/lists/store";
import { BaseList } from "instrument/window/lists/store-renderer";
import { getScrapbookStore } from "instrument/window/history/scrapbook";
import { unwatch } from "eez-studio-shared/notify";

////////////////////////////////////////////////////////////////////////////////

export class InstrumentAppStore implements IEditor {
    helpVisible: boolean = false;
    filters: Filters = new Filters();
    selectHistoryItemsSpecification:
        | SelectHistoryItemsSpecification
        | undefined = undefined;
    selectedHistoryItems = new Map<string, boolean>();

    navigationStore = new NavigationStore(this);
    scriptsModel = new ScriptsModel(this);
    shortcutsStore = new ShortcutsStore(this);
    groupsStore = new GroupsStore(this);

    history: History;
    deletedItemsHistory: DeletedItemsHistory;

    undoManager = new UndoManager();

    instrumentListStore: IStore;
    instrumentLists: BaseList[] = [];

    editor: JSX.Element | null = null;

    terminal: TerminalComponent | null = null;

    scriptView: ScriptViewComponent | null = null;

    autorunDisposer: IReactionDisposer | undefined;
    reactionDisposer: IReactionDisposer | undefined;

    _created = false;

    _instrumentListStoreWatchId: string | undefined;

    terminated: boolean = false;

    constructor(public instrument: InstrumentObject) {
        makeObservable(this, {
            helpVisible: observable,
            filters: observable,
            selectHistoryItemsSpecification: observable,
            selectedHistoryItems: observable,
            instrumentLists: observable,
            toggleHelpVisible: action,
            selectHistoryItems: action,
            selectHistoryItem: action
        });
    }

    get commandsTree() {
        return this.instrument.commandsTree;
    }

    onCreate() {
        if (this._created) {
            return;
        }
        this._created = true;

        this.history = new History(this);
        this.deletedItemsHistory = new DeletedItemsHistory(this);

        scheduleTask(
            "Load instrument",
            Priority.High,
            action(async () => {
                if (this.terminated) {
                    return;
                }

                this.helpVisible =
                    localStorage.getItem(
                        `instrument/${this.instrument.id}/window/help-visible`
                    ) === "1" || false;

                this.filters = this.getFiltersFromLocalStorage();

                // @todo
                // this is autorun because instrument extension is loaded asynchronously,
                // so getListsProperty would eventually become true
                this.autorunDisposer = autorun(() => {
                    if (this.instrument.listsProperty) {
                        if (this._instrumentListStoreWatchId != undefined) {
                            unwatch(this._instrumentListStoreWatchId);
                        }

                        this.instrumentListStore =
                            createInstrumentListStore(this);

                        const appStore = this;

                        this._instrumentListStoreWatchId =
                            this.instrumentListStore.watch({
                                createObject(object: any) {
                                    runInAction(() =>
                                        appStore.instrumentLists.push(object)
                                    );
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
                                                appStore.instrumentLists.indexOf(
                                                    list
                                                ),
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
                localStorage.setItem(
                    `instrument/${this.instrument.id}/window/filters`,
                    filters
                );
            }
        );
    }

    onActivate() {
        ipcRenderer.on("undo", this.undoManager.undo);
        ipcRenderer.on("redo", this.undoManager.redo);
        ipcRenderer.on("save", this.onSave);
        ipcRenderer.on("delete", this.onDeleteShortcut);
        document.addEventListener("keydown", this.onKeyDown);

        this.shortcutsStore.onActivate();
    }

    onDeactivate() {
        ipcRenderer.removeListener("undo", this.undoManager.undo);
        ipcRenderer.removeListener("redo", this.undoManager.redo);
        ipcRenderer.removeListener("save", this.onSave);
        ipcRenderer.removeListener("delete", this.onDeleteShortcut);
        document.removeEventListener("keydown", this.onKeyDown);

        this.shortcutsStore.onDeactivate();
    }

    onTerminate() {
        if (this.instrument) {
            this.instrument.terminate();
            this.instrument._instrumentAppStore = undefined;
        }
        this.editor = null;
        this.terminal = null;
        this.scriptView = null;
        if (this.autorunDisposer) {
            this.autorunDisposer();
            this.autorunDisposer = undefined;
        }
        if (this.reactionDisposer) {
            this.reactionDisposer();
            this.reactionDisposer = undefined;
        }
        this.undoManager.onTerminate();
        this.history.onTerminate();
        this.deletedItemsHistory.onTerminate();
        this.shortcutsStore.onTerminate();
        this.navigationStore.onTerminate();
        if (this._instrumentListStoreWatchId != undefined) {
            unwatch(this._instrumentListStoreWatchId);
        }

        this.terminated = true;
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

    onSave = () => {
        if (this.undoManager.modified) {
            this.undoManager.commit();
        }
    };

    onDeleteShortcut = () => {
        if (document.activeElement) {
            if (
                $(document.activeElement).closest(".EezStudio_HistoryContainer")
                    .length > 0
            ) {
                this.history.deleteSelectedHistoryItems();
            } else if (
                $(document.activeElement).closest(
                    ".EezStudio_DeletedHistoryContainer"
                ).length > 0
            ) {
                this.deletedItemsHistory.deleteSelectedHistoryItems();
            } else if (
                $(document.activeElement).closest(
                    ".EezStudio_ScrapbookContainer"
                ).length > 0
            ) {
                getScrapbookStore().deleteSelectedHistoryItems();
            }
        }
    };

    onKeyDown = (event: KeyboardEvent) => {
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
                if (
                    $(document.activeElement).closest(
                        ".EezStudio_HistoryContainer"
                    ).length > 0
                ) {
                    event.preventDefault();
                    this.history.selection.selectItems(this.history.items);
                } else if (
                    $(document.activeElement).closest(
                        ".EezStudio_DeletedHistoryContainer"
                    ).length > 0
                ) {
                    event.preventDefault();
                    this.deletedItemsHistory.selection.selectItems(
                        this.deletedItemsHistory.items
                    );
                } else if (
                    $(document.activeElement).closest(
                        ".EezStudio_ScrapbookContainer"
                    ).length > 0
                ) {
                    event.preventDefault();
                    getScrapbookStore().selectAllItems(this.history.appStore);
                }
            }
        }
    };

    getFiltersFromLocalStorage(): Filters {
        const filters = new Filters();

        let filtersJSON = localStorage.getItem(
            `instrument/${this.instrument.id}/window/filters`
        );
        if (filtersJSON) {
            try {
                Object.assign(filters, JSON.parse(filtersJSON));
            } catch (err) {
                console.error("getFiltersFromLocalStorage", err);
            }
        }

        return filters;
    }

    toggleHelpVisible() {
        this.helpVisible = !this.helpVisible;
        localStorage.setItem(
            `instrument/${this.instrument.id}/window/help-visible`,
            this.helpVisible ? "1" : "0"
        );
    }

    selectHistoryItems(
        specification: SelectHistoryItemsSpecification | undefined
    ) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    isHistoryItemSelected(id: string) {
        return this.selectedHistoryItems.has(id);
    }

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
