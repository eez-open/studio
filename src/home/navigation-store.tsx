import * as React from "react";
import { observable, computed, action, runInAction, autorun } from "mobx";

import { extensions } from "shared/extensions/extensions";

import { IRootNavigationItem } from "shared/ui/app";

import { HistoryView, showSessionsList } from "instrument/window/history/history-view";

import {
    ExtensionsManager,
    extensionsManagerStore
} from "home/extensions-manager/extensions-manager";

import * as DesignerModule from "home/designer/designer";
import * as HistoryModule from "home/history";
import * as ShortcutsModule from "home/shortcuts";
import * as SettingsModule from "home/settings";

import { tabs } from "home/tabs-store";

////////////////////////////////////////////////////////////////////////////////

export class NavigationStore {
    workbenchNavigationItem: IRootNavigationItem;
    historyNavigationItem: IRootNavigationItem;
    deletedHistoryItemsNavigationItem: IRootNavigationItem;
    shortcutsAndGroupsNavigationItem: IRootNavigationItem;
    settingsNavigationItem: IRootNavigationItem;

    @observable
    private _mainNavigationSelectedItemId: string;

    mainHistoryView: HistoryView | undefined;

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

        this._mainNavigationSelectedItemId = this.workbenchNavigationItem.id;

        autorun(() => {
            if (tabs.activeTab === tabs.homeTab) {
                if (this.mainNavigationSelectedItem) {
                    document.title = `${this.mainNavigationSelectedItem.title} - Home - EEZ Studio`;
                } else {
                    document.title = `Home - EEZ Studio`;
                }
            } else {
                document.title = `${tabs.activeTab.title} - Home - EEZ Studio`;
            }

            if (
                this.mainNavigationSelectedItem === this.deletedHistoryItemsNavigationItem &&
                this.mainHistoryView &&
                this.mainHistoryView.props.appStore.deletedItemsHistory.deletedCount === 0
            ) {
                this.navigateToHistory();
            }
        });
    }

    @computed
    get extensionsNavigationItem(): IRootNavigationItem {
        let numNewVersions = extensionsManagerStore.newVersions.length;

        let title = "Extension Manager";
        if (numNewVersions > 1) {
            title += ` (${extensionsManagerStore.newVersions.length} new versions)`;
        } else if (numNewVersions === 1) {
            title += " (1 new version)";
        }

        return {
            id: "extensions",
            icon: "material:extension",
            title: title,
            attention: numNewVersions > 0,
            renderContent: () => {
                return <ExtensionsManager />;
            }
        };
    }

    @computed
    get navigationItemsFromExtensions() {
        const navigationItems: IRootNavigationItem[] = [];

        extensions.forEach(extension => {
            if (extension.homeSections) {
                extension.homeSections.forEach(homeSection => {
                    navigationItems.push({
                        id: homeSection.id,
                        icon: homeSection.icon,
                        title: homeSection.title,
                        renderContent: homeSection.render
                    });
                });
            }
        });

        return navigationItems;
    }

    @computed
    get navigationItems() {
        return [
            this.workbenchNavigationItem,
            this.historyNavigationItem,
            this.deletedHistoryItemsNavigationItem,
            this.shortcutsAndGroupsNavigationItem,
            this.extensionsNavigationItem
        ]
            .concat(this.navigationItemsFromExtensions)
            .concat([this.settingsNavigationItem]);
    }

    get mainNavigationSelectedItem() {
        return (
            this.navigationItems.find(
                navigationItem => navigationItem.id === this._mainNavigationSelectedItemId
            ) || this.workbenchNavigationItem
        );
    }

    set mainNavigationSelectedItem(value: IRootNavigationItem) {
        runInAction(() => {
            this._mainNavigationSelectedItemId = value.id;
        });
    }

    @action
    navigateToHomeTab() {
        tabs.makeActive(tabs.homeTab);
    }

    @action.bound
    navigateToHistory() {
        this.navigateToHomeTab();
        this.mainNavigationSelectedItem = this.historyNavigationItem;
    }

    @action.bound
    navigateToDeletedHistoryItems() {
        this.navigateToHomeTab();
        this.mainNavigationSelectedItem = this.deletedHistoryItemsNavigationItem;
    }

    @action.bound
    navigateToSessionsList() {
        this.navigateToHomeTab();
        this.mainNavigationSelectedItem = this.historyNavigationItem;
        showSessionsList(this);
    }

    // @TODO remove this, not requred in home
    selectedListId: string | undefined = undefined;
}

export const navigationStore = new NavigationStore();
