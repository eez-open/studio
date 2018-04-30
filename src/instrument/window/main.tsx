/// <reference path="./globals.d.ts"/>
import * as React from "react";
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

import { undoManager } from "instrument/window/undo";

configure({ enforceActions: true });

import { loadPreinstalledExtension } from "shared/extensions/extensions";

loadPreinstalledExtension("instrument").then(() => {
    const { App } = require("instrument/window/app");
    ReactDOM.render(<App />, document.getElementById("content"));
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
