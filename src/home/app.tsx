import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
//import { DragDropContext } from "react-dnd";
//import HTML5Backend from "react-dnd-html5-backend";

import { AppRootComponent } from "shared/ui/app";

import * as DesignerModule from "home/designer/designer";
import * as HistoryModule from "home/history/history";
import * as ShortcutsModule from "home/shortcuts";
import * as ExtensionsManagerModule from "home/extensions-manager/extensions-manager";
import * as SettingsModule from "home/settings";

////////////////////////////////////////////////////////////////////////////////

const navigationItems = [
    {
        id: "workbench",
        icon: "material:developer_board",
        title: "Workbench",
        renderContent: () => {
            const { Designer } = require("home/designer/designer") as typeof DesignerModule;
            return <Designer />;
        }
    },
    {
        id: "history",
        icon: "material:history",
        title: "History",
        renderContent: () => {
            const { History } = require("home/history/history") as typeof HistoryModule;
            return <History />;
        }
    },
    {
        id: "shortcutsAndGroups",
        icon: "material:playlist_play",
        title: "Shortcuts and Groups",
        renderContent: () => {
            const { ShortcutsAndGroups } = require("home/shortcuts") as typeof ShortcutsModule;
            return <ShortcutsAndGroups />;
        }
    },
    {
        id: "extensions",
        icon: "material:extension",
        title: "Extensions Manager",
        renderContent: () => {
            const {
                ExtensionsManager
            } = require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
            return <ExtensionsManager />;
        }
    },
    {
        id: "settings",
        icon: "material:settings",
        title: "Settings",
        position: "bottom",
        renderContent: () => {
            const { Settings } = require("home/settings") as typeof SettingsModule;
            return <Settings />;
        }
    }
];

@observer
class AppComponent extends React.Component<{}, {}> {
    @observable.ref selectedItem = navigationItems[0];

    @action.bound
    selectItem(item: any) {
        this.selectedItem = item;

        if (item) {
            document.title = `${item.title} - Home - EEZ Studio`;
        } else {
            document.title = `Home - EEZ Studio`;
        }
    }

    render() {
        return (
            <AppRootComponent
                navigationItems={navigationItems}
                selectedItem={this.selectedItem}
                onSelectionChange={this.selectItem}
            />
        );
    }
}

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;
