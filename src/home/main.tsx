/// <reference path="./globals.d.ts"/>
import * as React from "react";
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

configure({ enforceActions: true });

EEZStudio.electron.ipcRenderer.on("beforeClose", () => {
    const { destroyExtensions } = require("shared/extensions/extensions");
    destroyExtensions();
    EEZStudio.electron.ipcRenderer.send("readyToClose");
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    const { destroyExtensions } = require("shared/extensions/extensions");
    destroyExtensions();
    window.location.reload();
});

EEZStudio.electron.ipcRenderer.on(
    "importInstrumentDefinitionFile",
    (sender: any, filePath: string) => {
        const { importInstrumentDefinition } = require("instrument/import-instrument-definition");
        importInstrumentDefinition(filePath);
    }
);

async function main() {
    const { App } = await import("home/app");
    ReactDOM.render(<App />, document.getElementById("EezStudio_Content"));

    const { loadExtensions } = await import("shared/extensions/extensions");
    loadExtensions();
}

main();

//require("shared/module-stat");

document.onselectstart = function(event) {
    console.log(event);
    console.log("New selection made");
    const selection = document.getSelection();
    console.log(selection);
};
