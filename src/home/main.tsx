/// <reference path="./globals.d.ts"/>
import * as React from "react";
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

import { theme } from "eez-studio-shared/ui/theme";
import { ThemeProvider } from "eez-studio-shared/ui/styled-components";

import { handleDragAndDrop } from "home/drag-and-drop";

configure({ enforceActions: "observed" });

EEZStudio.electron.ipcRenderer.on("beforeClose", () => {
    const { destroyExtensions } = require("eez-studio-shared/extensions/extensions");
    destroyExtensions();
    EEZStudio.electron.ipcRenderer.send("readyToClose");
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    const { destroyExtensions } = require("eez-studio-shared/extensions/extensions");
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
    ReactDOM.render(
        <ThemeProvider theme={theme}>
            <App />
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );

    const { loadExtensions } = await import("eez-studio-shared/extensions/extensions");
    loadExtensions();

    handleDragAndDrop();
}

main();

//require("eez-studio-shared/module-stat");
