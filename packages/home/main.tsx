/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";
import "mobx-react-lite/batchingForReactDom";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import * as notification from "eez-studio-ui/notification";

import { handleDragAndDrop } from "home/drag-and-drop";
import { loadTabs } from "home/tabs-store";

import * as ImportInstrumentDefinitionModule from "instrument/import-instrument-definition";

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
        const {
            importInstrumentDefinition
        } = require("instrument/import-instrument-definition") as typeof ImportInstrumentDefinitionModule;
        importInstrumentDefinition(filePath);
    }
);

async function main() {
    const { loadExtensions } = await import("eez-studio-shared/extensions/extensions");
    await loadExtensions();

    loadTabs();

    const { App } = await import("home/app");
    ReactDOM.render(
        <ThemeProvider theme={theme}>
            <App />
            {notification.container}
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );

    handleDragAndDrop();
}

main();

//require("eez-studio-shared/module-stat");
