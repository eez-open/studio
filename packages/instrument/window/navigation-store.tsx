import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    autorun,
    makeObservable,
    IReactionDisposer
} from "mobx";

import type { InstrumentAppStore } from "instrument/window/app-store";
import type * as ScriptsModule from "instrument/window/scripts";
import type * as ShortcutsModule from "instrument/window/shortcuts";

import type * as TerminalModule from "instrument/window/terminal/terminal";

import type * as DeletedHistoryItemsModule from "instrument/window/history/deleted-history-items-view";
import {
    HistoryViewComponent,
    showSessionsList
} from "instrument/window/history/history-view";

import type * as ListsModule from "instrument/window/lists/lists";

import type { INavigationItem } from "instrument/window/navigation";

import type * as Bb3Module from "instrument/bb3";

import type * as DashboardModule from "instrument/window/dashboard";

////////////////////////////////////////////////////////////////////////////////

export class NavigationStore {
    terminalNavigationItem: INavigationItem;
    deletedHistoryItemsNavigationItem: INavigationItem;
    scriptsNavigationItem: INavigationItem;
    shortcutsAndGroupsNavigationItem: INavigationItem;
    listsNavigationItem: INavigationItem;

    private _mainNavigationSelectedItem: INavigationItem;

    mainHistoryView: HistoryViewComponent | undefined;

    autorunDispose: IReactionDisposer | undefined;

    constructor(public appStore: InstrumentAppStore) {
        makeObservable<
            NavigationStore,
            | "_mainNavigationSelectedItem"
            | "_selectedListId"
            | "_selectedScriptId"
        >(this, {
            _mainNavigationSelectedItem: observable.ref,
            startPageNavigationItem: computed({ keepAlive: true }),
            navigationItems: computed,
            mainNavigationSelectedItem: computed,
            navigateToHistory: action.bound,
            navigateToDeletedHistoryItems: action.bound,
            navigateToSessionsList: action.bound,
            navigateToScripts: action.bound,
            _selectedListId: observable,
            _selectedScriptId: observable,
            dashboardNavigationItems: computed
        });

        this.terminalNavigationItem = {
            id: "terminal",
            icon: "material:navigate_next",
            title: "Terminal",
            renderContent: () => {
                const { render } =
                    require("instrument/window/terminal/terminal") as typeof TerminalModule;
                return appStore.instrument ? render(this.appStore) : <div />;
            },
            renderToolbarButtons: () => {
                const { renderToolbarButtons } =
                    require("instrument/window/terminal/terminal") as typeof TerminalModule;
                return appStore.instrument ? (
                    renderToolbarButtons(this.appStore)
                ) : (
                    <div />
                );
            }
        };

        this.deletedHistoryItemsNavigationItem = {
            id: "deletedHistoryItems",
            position: "hidden",
            icon: "",
            title: "",
            renderContent: () => {
                const { DeletedHistoryItemsView } =
                    require("instrument/window/history/deleted-history-items-view") as typeof DeletedHistoryItemsModule;
                return (
                    <DeletedHistoryItemsView
                        appStore={this.appStore}
                        persistId={"instrument/window/deleted-history-items"}
                    />
                );
            },
            renderToolbarButtons: () => {
                const { DeletedHistoryItemsTools } =
                    require("instrument/window/history/deleted-history-items-view") as typeof DeletedHistoryItemsModule;
                return <DeletedHistoryItemsTools appStore={this.appStore} />;
            }
        };

        this.scriptsNavigationItem = {
            id: "scripts",
            icon: "material:slideshow",
            title: "Scripts",
            renderContent: () => {
                const { render } =
                    require("instrument/window/scripts") as typeof ScriptsModule;
                return render(this.appStore);
            },
            renderToolbarButtons: () => {
                const { toolbarButtonsRender } =
                    require("instrument/window/scripts") as typeof ScriptsModule;
                return toolbarButtonsRender(this.appStore);
            }
        };

        this.shortcutsAndGroupsNavigationItem = {
            id: "shortcutsAndGroups",
            icon: "material:playlist_play",
            title: "Shortcuts",
            renderContent: () => {
                const { render } =
                    require("instrument/window/shortcuts") as typeof ShortcutsModule;
                return render(this.appStore);
            },
            renderToolbarButtons: () => {
                const { toolbarButtonsRender } =
                    require("instrument/window/shortcuts") as typeof ShortcutsModule;
                return toolbarButtonsRender(this.appStore);
            }
        };

        this.listsNavigationItem = {
            id: "lists",
            icon: "material:timeline",
            title: "Lists",
            renderContent: () => {
                const { render } =
                    require("instrument/window/lists/lists") as typeof ListsModule;
                return appStore.instrument ? render(this.appStore) : <div />;
            },
            renderToolbarButtons: () => {
                const { toolbarButtonsRender } =
                    require("instrument/window/lists/lists") as typeof ListsModule;
                return toolbarButtonsRender(this.appStore);
            }
        };

        this.autorunDispose = autorun(() => {
            if (
                this.mainNavigationSelectedItem ===
                    this.deletedHistoryItemsNavigationItem &&
                this.appStore.deletedItemsHistory.deletedCount === 0
            ) {
                this.navigateToHistory();
            }
        });
    }

    get startPageNavigationItem() {
        if (this.appStore.instrument.isBB3) {
            return {
                id: "start-page",
                icon: "material:dashboard",
                title: "Start Page",
                renderContent: () => {
                    const { render } =
                        require("instrument/bb3") as typeof Bb3Module;
                    return render(this.appStore);
                },
                renderToolbarButtons: () => {
                    const { toolbarButtonsRender } =
                        require("instrument/bb3") as typeof Bb3Module;
                    return toolbarButtonsRender(this.appStore);
                }
            };
        }

        return undefined;
    }

    get dashboardNavigationItems() {
        const dashboards =
            this.appStore.instrument.extension?.properties?.dashboards;
        if (!dashboards) {
            return [];
        }

        return dashboards.map((dashboard, i) => ({
            id: "dashboard-" + i,
            icon: dashboard.icon || "material:dashboard",
            title: dashboard.title,
            renderContent: () => {
                const { Dashboard } =
                    require("instrument/window/dashboard") as typeof DashboardModule;
                return (
                    <Dashboard
                        instrument={this.appStore.instrument}
                        dashboardIndex={i}
                    />
                );
            },
            renderToolbarButtons: () => {
                return <div></div>;
            }
        }));
    }

    get navigationItems() {
        let navigationItems: INavigationItem[] = [];

        if (this.startPageNavigationItem) {
            navigationItems.push(this.startPageNavigationItem);
        }

        navigationItems.push(...this.dashboardNavigationItems);

        navigationItems.push(this.terminalNavigationItem);
        navigationItems.push(this.deletedHistoryItemsNavigationItem);
        navigationItems.push(this.scriptsNavigationItem);
        navigationItems.push(this.shortcutsAndGroupsNavigationItem);

        if (
            this.appStore.instrument &&
            this.appStore.instrument.listsProperty
        ) {
            navigationItems.push(this.listsNavigationItem);
        }

        return navigationItems;
    }

    get mainNavigationSelectedItem() {
        if (
            this._mainNavigationSelectedItem &&
            this.navigationItems.indexOf(this._mainNavigationSelectedItem) != -1
        ) {
            return this._mainNavigationSelectedItem;
        }

        if (this.startPageNavigationItem) {
            return this.startPageNavigationItem;
        }

        return this.terminalNavigationItem;
    }

    async changeMainNavigationSelectedItem(value: INavigationItem) {
        if (await this.appStore.undoManager.confirmSave()) {
            runInAction(() => {
                this._mainNavigationSelectedItem = value;
            });
            return true;
        } else {
            return false;
        }
    }

    navigateToHistory() {
        this.changeMainNavigationSelectedItem(this.terminalNavigationItem);
    }

    navigateToDeletedHistoryItems() {
        this.changeMainNavigationSelectedItem(
            this.deletedHistoryItemsNavigationItem
        );
    }

    async navigateToSessionsList() {
        if (
            await this.changeMainNavigationSelectedItem(
                this.terminalNavigationItem
            )
        ) {
            showSessionsList(this);
        }
    }

    navigateToScripts() {
        this.changeMainNavigationSelectedItem(this.scriptsNavigationItem);
    }

    //
    private _selectedListId: string | undefined;

    get selectedListId() {
        return this._selectedListId;
    }

    async changeSelectedListId(value: string | undefined) {
        if (!(await this.appStore.undoManager.confirmSave())) {
            return;
        }

        runInAction(() => {
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
        });
    }

    //
    private _selectedScriptId: string | undefined;

    get selectedScriptId() {
        return this._selectedScriptId;
    }

    async changeSelectedScriptId(value: string | undefined) {
        if (!(await this.appStore.undoManager.confirmSave())) {
            return;
        }

        runInAction(() => {
            this._mainNavigationSelectedItem = this.scriptsNavigationItem;
            this._selectedScriptId = value;
        });
    }

    onTerminate() {
        if (this.autorunDispose) {
            this.autorunDispose();
            this.autorunDispose = undefined;
        }

        this.mainHistoryView = undefined;

        // WORKAROUND: for some reason garbage collector doesn't collect this object unless we delete all the properties here
        for (const propertyName in this) {
            try {
                delete this[propertyName];
            } catch (err) {}
        }
    }
}
