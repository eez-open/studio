/// <reference path="./globals.d.ts"/>
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

import * as AppStoreModule from "instrument/window/app-store";
import { undoManager } from "instrument/window/undo";

////////////////////////////////////////////////////////////////////////////////

configure({ enforceActions: true });

import { loadPreinstalledExtension } from "shared/extensions/extensions";

loadPreinstalledExtension("instrument").then(() => {
    const { AppStore } = require("instrument/window/app-store") as typeof AppStoreModule;

    const instrumentId = EEZStudio.electron.ipcRenderer.sendSync("getWindowArgs");

    const appStore = new AppStore(instrumentId);
    appStore.onCreate();
    appStore.onActivate();

    ReactDOM.render(appStore.editor, document.getElementById("EezStudio_Content"));
});

EEZStudio.electron.ipcRenderer.on("beforeClose", () => {
    undoManager.confirmSave(() => {
        EEZStudio.electron.ipcRenderer.send("readyToClose");
    });
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    window.location.reload();
});

//require("shared/module-stat");
