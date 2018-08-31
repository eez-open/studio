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

function handleDragAndDrop() {
    function removeDragData(ev: DragEvent) {
        console.log("Removing drag data");

        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to remove the drag data
            ev.dataTransfer.items.clear();
        } else {
            // Use DataTransfer interface to remove the drag data
            ev.dataTransfer.clearData();
        }
    }

    $(document).on("dragover", $ev => {
        $ev.preventDefault();
        const ev = $ev.originalEvent as DragEvent;
        ev.dataTransfer.dropEffect = "copy";
    });

    $(document).on("drop", $ev => {
        $ev.preventDefault();
        const ev = $ev.originalEvent as DragEvent;
        console.log(ev);
        removeDragData(ev);
    });
}

async function main() {
    const { App } = await import("home/app");
    ReactDOM.render(<App />, document.getElementById("EezStudio_Content"));

    const { loadExtensions } = await import("shared/extensions/extensions");
    loadExtensions();

    handleDragAndDrop();
}

main();

//require("shared/module-stat");
