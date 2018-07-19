import * as React from "react";
import { observable, computed, action, runInAction, autorun } from "mobx";

import { IRootNavigationItem } from "shared/ui/app";

import * as DesignerModule from "home/designer/designer";
import * as HistoryModule from "home/history";
import * as ShortcutsModule from "home/shortcuts";
import * as ExtensionsManagerModule from "home/extensions-manager/extensions-manager";
import * as SettingsModule from "home/settings";

////////////////////////////////////////////////////////////////////////////////

export class NavigationStore {
    workbenchNavigationItem: IRootNavigationItem;
    historyNavigationItem: IRootNavigationItem;
    deletedHistoryItemsNavigationItem: IRootNavigationItem;
    shortcutsAndGroupsNavigationItem: IRootNavigationItem;
    extensionsNavigationItem: IRootNavigationItem;
    settingsNavigationItem: IRootNavigationItem;

    @observable.ref private _mainNavigationSelectedItem: IRootNavigationItem;

    constructor() {
        this.workbenchNavigationItem = {
            id: "workbench",
            icon: "material:developer_board",
            title: "Workbench",
            renderContent: () => {
                const { Designer } = require("home/designer/designer") as typeof DesignerModule;
                return <Designer />;
            }
        };

        this.historyNavigationItem = {
            id: "history",
            icon: "material:history",
            title: "History",
            renderContent: () => {
                const { HistorySection } = require("home/history") as typeof HistoryModule;
                return <HistorySection />;
            }
        };

        this.deletedHistoryItemsNavigationItem = {
            id: "deletedHistoryItems",
            position: "hidden",
            icon: "",
            title: "",
            renderContent: () => {
                const {
                    DeletedHistoryItemsSection
                } = require("home/history") as typeof HistoryModule;
                return <DeletedHistoryItemsSection />;
            }
        };

        this.shortcutsAndGroupsNavigationItem = {
            id: "shortcutsAndGroups",
            icon: "material:playlist_play",
            title: "Shortcuts and Groups",
            renderContent: () => {
                const { ShortcutsAndGroups } = require("home/shortcuts") as typeof ShortcutsModule;
                return <ShortcutsAndGroups />;
            }
        };

        this.extensionsNavigationItem = {
            id: "extensions",
            icon: "material:extension",
            title: "Extensions Manager",
            renderContent: () => {
                const {
                    ExtensionsManager
                } = require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
                return <ExtensionsManager />;
            }
        };

        this.settingsNavigationItem = {
            id: "settings",
            icon: "material:settings",
            title: "Settings",
            position: "bottom",
            renderContent: () => {
                const { Settings } = require("home/settings") as typeof SettingsModule;
                return <Settings />;
            }
        };

        this._mainNavigationSelectedItem = this.workbenchNavigationItem;

        autorun(() => {
            if (this._mainNavigationSelectedItem) {
                document.title = `${this._mainNavigationSelectedItem.title} - Home - EEZ Studio`;
            } else {
                document.title = `Home - EEZ Studio`;
            }
        });
    }

    @computed
    get navigationItems() {
        let navigationItems = [
            this.workbenchNavigationItem,
            this.historyNavigationItem,
            this.deletedHistoryItemsNavigationItem,
            this.shortcutsAndGroupsNavigationItem,
            this.extensionsNavigationItem,
            this.settingsNavigationItem
        ];

        return navigationItems;
    }

    get mainNavigationSelectedItem() {
        return this._mainNavigationSelectedItem;
    }

    set mainNavigationSelectedItem(value: IRootNavigationItem) {
        runInAction(() => {
            this._mainNavigationSelectedItem = value;
        });
    }

    @action.bound
    navigateToHistory() {
        this.mainNavigationSelectedItem = this.historyNavigationItem;
    }

    @action.bound
    navigateToDeletedHistoryItems() {
        this.mainNavigationSelectedItem = this.deletedHistoryItemsNavigationItem;
    }

    // @TODO remove this
    selectedListId: string | undefined = undefined;
}

export const navigationStore = new NavigationStore();
