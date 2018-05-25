import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { AppRootComponent, IRootNavigationItem } from "shared/ui/app";
import { AlertDanger } from "shared/ui/alert";

import { appStore } from "instrument/window/app-store";
import { AppBar } from "instrument/window/app-bar";
import { undoManager } from "instrument/window/undo";

import * as HistoryModule from "instrument/window/history";

import * as TerminalModule from "instrument/window/terminal/terminal";
import * as DeletedHistoryItemsModule from "instrument/window/terminal/deleted-history-items";
import * as ScriptsModule from "instrument/window/scripts";
import * as ShortcutsModule from "instrument/window/shortcuts";
import * as ListsModule from "instrument/window/lists/lists";

export interface IInstrumentWindowNavigationItem extends IRootNavigationItem {
    renderToolbarButtons: () => JSX.Element;
}

export const terminalNavigationItem: IInstrumentWindowNavigationItem = {
    id: "terminal",
    icon: "material:navigate_next",
    title: "Terminal",
    renderContent: () => {
        const { render } = require("instrument/window/terminal/terminal") as typeof TerminalModule;
        return appStore.instrument ? render(appStore.instrument) : <div />;
    },
    renderToolbarButtons: () => {
        const {
            renderToolbarButtons
        } = require("instrument/window/terminal/terminal") as typeof TerminalModule;
        return appStore.instrument ? renderToolbarButtons(appStore.instrument) : <div />;
    }
};

export const deletedHistoryItemsNavigationItem: IInstrumentWindowNavigationItem = {
    id: "deletedHistoryItems",
    position: "hidden",
    icon: "",
    title: "",
    renderContent: () => {
        const {
            render
        } = require("instrument/window/terminal/deleted-history-items") as typeof DeletedHistoryItemsModule;
        return render();
    },
    renderToolbarButtons: () => {
        const {
            renderToolbarButtons
        } = require("instrument/window/terminal/deleted-history-items") as typeof DeletedHistoryItemsModule;
        return renderToolbarButtons();
    }
};

export const scriptsNavigationItem: IInstrumentWindowNavigationItem = {
    id: "scripts",
    icon: "material:slideshow",
    title: "Scripts",
    renderContent: () => {
        const { render } = require("instrument/window/scripts") as typeof ScriptsModule;
        return render();
    },
    renderToolbarButtons: () => {
        const {
            toolbarButtonsRender
        } = require("instrument/window/scripts") as typeof ScriptsModule;
        return toolbarButtonsRender();
    }
};

const shortcutsAndGroupsNavigationItem: IInstrumentWindowNavigationItem = {
    id: "shortcutsAndGroups",
    icon: "material:playlist_play",
    title: "Shortcuts and Groups",
    renderContent: () => {
        const { render } = require("instrument/window/shortcuts") as typeof ShortcutsModule;
        return render();
    },
    renderToolbarButtons: () => {
        const {
            toolbarButtonsRender
        } = require("instrument/window/shortcuts") as typeof ShortcutsModule;
        return toolbarButtonsRender();
    }
};

const listsNavigationItem: IInstrumentWindowNavigationItem = {
    id: "lists",
    icon: "material:timeline",
    title: "Lists",
    renderContent: () => {
        const { render } = require("instrument/window/lists/lists") as typeof ListsModule;
        return appStore.instrument ? render(appStore.instrument) : <div />;
    },
    renderToolbarButtons: () => {
        const {
            toolbarButtonsRender
        } = require("instrument/window/lists/lists") as typeof ListsModule;
        return appStore.instrument ? toolbarButtonsRender(appStore.instrument) : <div />;
    }
};

export const navigationItems = computed(() => {
    let navigationItems = [
        terminalNavigationItem,
        deletedHistoryItemsNavigationItem,
        scriptsNavigationItem,
        shortcutsAndGroupsNavigationItem
    ];

    if (appStore.instrument && appStore.instrument.getListsProperty()) {
        navigationItems.push(listsNavigationItem);
    }

    return navigationItems;
});

////////////////////////////////////////////////////////////////////////////////

class NavigationStore {
    //
    @observable.ref
    private _mainNavigationSelectedItem: IInstrumentWindowNavigationItem = navigationItems.get()[0];

    get mainNavigationSelectedItem() {
        return this._mainNavigationSelectedItem;
    }

    set mainNavigationSelectedItem(value: IInstrumentWindowNavigationItem) {
        undoManager.confirmSave(
            action(() => {
                this._mainNavigationSelectedItem = value;
            })
        );
    }

    //
    @observable private _selectedListId: string | undefined;

    get selectedListId() {
        return this._selectedListId;
    }

    set selectedListId(value: string | undefined) {
        undoManager.confirmSave(
            action(() => {
                if (this._mainNavigationSelectedItem !== listsNavigationItem) {
                    // First switch to lists section ...
                    this._selectedListId = undefined;
                    this._mainNavigationSelectedItem = listsNavigationItem;
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
    @observable private _selectedScriptId: string | undefined;

    get selectedScriptId() {
        return this._selectedScriptId;
    }

    set selectedScriptId(value: string | undefined) {
        undoManager.confirmSave(
            action(() => {
                this._mainNavigationSelectedItem = scriptsNavigationItem;
                this._selectedScriptId = value;
            })
        );
    }
}

export const navigationStore = new NavigationStore();

////////////////////////////////////////////////////////////////////////////////

@observer
export class App extends React.Component<{}, {}> {
    @bind
    onSelectionChange(item: IInstrumentWindowNavigationItem) {
        navigationStore.mainNavigationSelectedItem = item;
    }

    @computed
    get appBar() {
        const instrument = appStore.instrument;
        if (!instrument) {
            return undefined;
        }

        return (
            <div>
                {instrument.connection.error && (
                    <AlertDanger
                        className="mb-0"
                        onDismiss={() => instrument.connection.dismissError()}
                    >
                        {instrument.connection.error}
                    </AlertDanger>
                )}
                {
                    <AppBar
                        instrument={instrument}
                        selectedItem={navigationStore.mainNavigationSelectedItem}
                    />
                }
            </div>
        );
    }

    render() {
        return (
            <AppRootComponent
                navigationItems={navigationItems.get()}
                appBar={this.appBar}
                selectedItem={navigationStore.mainNavigationSelectedItem}
                onSelectionChange={this.onSelectionChange}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

EEZStudio.electron.ipcRenderer.on("delete", () => {
    if ($(document.activeElement).hasClass("EezStudio_History_Container")) {
        const { history } = require("instrument/window/history") as typeof HistoryModule;
        history.deleteSelectedHistoryItems();
    } else if ($(document.activeElement).hasClass("EezStudio_DeletedHistory_Container")) {
        const {
            deletedItemsHistory
        } = require("instrument/window/history") as typeof HistoryModule;
        deletedItemsHistory.deleteSelectedHistoryItems();
    }
});
