import * as React from "react";
import { observable, computed, action, autorun } from "mobx";

import { IRootNavigationItem } from "eez-studio-ui/app";

import { InstrumentAppStore } from "instrument/window/app-store";
import * as ScriptsModule from "instrument/window/scripts";
import * as ShortcutsModule from "instrument/window/shortcuts";

import * as TerminalModule from "instrument/window/terminal/terminal";

import * as DeletedHistoryItemsModule from "instrument/window/history/deleted-history-items-view";
import { HistoryView, showSessionsList } from "instrument/window/history/history-view";

import * as ListsModule from "instrument/window/lists/lists";

////////////////////////////////////////////////////////////////////////////////

export interface IInstrumentWindowNavigationItem extends IRootNavigationItem {
    renderToolbarButtons: () => JSX.Element;
}

////////////////////////////////////////////////////////////////////////////////

export class NavigationStore {
    terminalNavigationItem: IInstrumentWindowNavigationItem;
    deletedHistoryItemsNavigationItem: IInstrumentWindowNavigationItem;
    scriptsNavigationItem: IInstrumentWindowNavigationItem;
    shortcutsAndGroupsNavigationItem: IInstrumentWindowNavigationItem;
    listsNavigationItem: IInstrumentWindowNavigationItem;

    @observable.ref
    private _mainNavigationSelectedItem: IInstrumentWindowNavigationItem;

    mainHistoryView: HistoryView | undefined;

    constructor(public appStore: InstrumentAppStore) {
        this.terminalNavigationItem = {
            id: "terminal",
            icon: "material:navigate_next",
            title: "Terminal",
            renderContent: () => {
                const {
                    render
                } = require("instrument/window/terminal/terminal") as typeof TerminalModule;
                return appStore.instrument ? render(this.appStore) : <div />;
            },
            renderToolbarButtons: () => {
                const {
                    renderToolbarButtons
                } = require("instrument/window/terminal/terminal") as typeof TerminalModule;
                return appStore.instrument ? renderToolbarButtons(this.appStore) : <div />;
            }
        };

        this.deletedHistoryItemsNavigationItem = {
            id: "deletedHistoryItems",
            position: "hidden",
            icon: "",
            title: "",
            renderContent: () => {
                const {
                    DeletedHistoryItemsView
                } = require("instrument/window/history/deleted-history-items-view") as typeof DeletedHistoryItemsModule;
                return (
                    <DeletedHistoryItemsView
                        appStore={this.appStore}
                        persistId={"instrument/window/deleted-history-items"}
                    />
                );
            },
            renderToolbarButtons: () => {
                const {
                    DeletedHistoryItemsTools
                } = require("instrument/window/history/deleted-history-items-view") as typeof DeletedHistoryItemsModule;
                return <DeletedHistoryItemsTools appStore={this.appStore} />;
            }
        };

        this.scriptsNavigationItem = {
            id: "scripts",
            icon: "material:slideshow",
            title: "Scripts",
            renderContent: () => {
                const { render } = require("instrument/window/scripts") as typeof ScriptsModule;
                return render(this.appStore);
            },
            renderToolbarButtons: () => {
                const {
                    toolbarButtonsRender
                } = require("instrument/window/scripts") as typeof ScriptsModule;
                return toolbarButtonsRender(this.appStore);
            }
        };

        this.shortcutsAndGroupsNavigationItem = {
            id: "shortcutsAndGroups",
            icon: "material:playlist_play",
            title: "Shortcuts and Groups",
            renderContent: () => {
                const { render } = require("instrument/window/shortcuts") as typeof ShortcutsModule;
                return render(this.appStore);
            },
            renderToolbarButtons: () => {
                const {
                    toolbarButtonsRender
                } = require("instrument/window/shortcuts") as typeof ShortcutsModule;
                return toolbarButtonsRender(this.appStore);
            }
        };

        this.listsNavigationItem = {
            id: "lists",
            icon: "material:timeline",
            title: "Lists",
            renderContent: () => {
                const { render } = require("instrument/window/lists/lists") as typeof ListsModule;
                return appStore.instrument ? render(this.appStore) : <div />;
            },
            renderToolbarButtons: () => {
                const {
                    toolbarButtonsRender
                } = require("instrument/window/lists/lists") as typeof ListsModule;
                return appStore.instrument ? toolbarButtonsRender(this.appStore) : <div />;
            }
        };

        this._mainNavigationSelectedItem = this.terminalNavigationItem;

        autorun(() => {
            if (
                this.mainNavigationSelectedItem === this.deletedHistoryItemsNavigationItem &&
                this.appStore.deletedItemsHistory.deletedCount === 0
            ) {
                this.navigateToHistory();
            }

            if (appStore.instrument) {
                document.title = `${appStore.instrument.name} - Instrument - EEZ Studio`;
            } else {
                document.title = "Instrument - EEZ Studio";
            }
        });
    }

    @computed
    get navigationItems() {
        let navigationItems = [
            this.terminalNavigationItem,
            this.deletedHistoryItemsNavigationItem,
            this.scriptsNavigationItem,
            this.shortcutsAndGroupsNavigationItem
        ];

        if (this.appStore.instrument && this.appStore.instrument.listsProperty) {
            navigationItems.push(this.listsNavigationItem);
        }

        return navigationItems;
    }

    get mainNavigationSelectedItem() {
        return this._mainNavigationSelectedItem;
    }

    set mainNavigationSelectedItem(value: IInstrumentWindowNavigationItem) {
        this.appStore.undoManager.confirmSave(
            action(() => {
                this._mainNavigationSelectedItem = value;
            })
        );
    }

    @action.bound
    navigateToHistory() {
        this.mainNavigationSelectedItem = this.terminalNavigationItem;
    }

    @action.bound
    navigateToDeletedHistoryItems() {
        this.mainNavigationSelectedItem = this.deletedHistoryItemsNavigationItem;
    }

    @action.bound
    navigateToSessionsList() {
        this.mainNavigationSelectedItem = this.terminalNavigationItem;
        showSessionsList(this);
    }

    @action.bound
    navigateToScripts() {
        this.mainNavigationSelectedItem = this.scriptsNavigationItem;
    }

    //
    @observable
    private _selectedListId: string | undefined;

    get selectedListId() {
        return this._selectedListId;
    }

    set selectedListId(value: string | undefined) {
        this.appStore.undoManager.confirmSave(
            action(() => {
                if (this._mainNavigationSelectedItem !== this.listsNavigationItem) {
                    // First switch to lists section ...
                    this._selectedListId = undefined;
                    this._mainNavigationSelectedItem = this.listsNavigationItem;
                    window.requestAnimationFrame(
                        action(() => {
                            // ... and than select the list.
                            // This way list chart view will be automatically in focus,
                            // so keyboard shortcuts will work immediatelly (no need to
                            // manually click on chart view).
                            this._selectedListId = value;
                        })
                    );
                } else {
                    this._selectedListId = value;
                }
            })
        );
    }

    //
    @observable
    private _selectedScriptId: string | undefined;

    get selectedScriptId() {
        return this._selectedScriptId;
    }

    set selectedScriptId(value: string | undefined) {
        this.appStore.undoManager.confirmSave(
            action(() => {
                this._mainNavigationSelectedItem = this.scriptsNavigationItem;
                this._selectedScriptId = value;
            })
        );
    }
}
