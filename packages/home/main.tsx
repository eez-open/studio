/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import * as notification from "eez-studio-ui/notification";

import { handleDragAndDrop } from "home/drag-and-drop";
import { loadTabs, ProjectEditorTab, tabs } from "home/tabs-store";

import * as ImportInstrumentDefinitionModule from "instrument/import-instrument-definition";
import { LineMarkers } from "project-editor/flow/flow-editor/ConnectionLineComponent";

configure({ enforceActions: "observed" });

// make sure we store all the values waiting to be stored inside blur event handler
function blurAll() {
    var tmp = document.createElement("input");
    document.body.appendChild(tmp);
    tmp.focus();
    document.body.removeChild(tmp);
}

async function beforeAppClose() {
    blurAll();

    for (const tab of tabs.tabs) {
        if (tab.beforeAppClose) {
            if (!(await tab.beforeAppClose())) {
                return false;
            }
        }
    }

    const {
        destroyExtensions
    } = require("eez-studio-shared/extensions/extensions");
    destroyExtensions();

    return true;
}

EEZStudio.electron.ipcRenderer.on("beforeClose", async () => {
    if (await beforeAppClose()) {
        EEZStudio.electron.ipcRenderer.send("readyToClose");
    }
});

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    if (await beforeAppClose()) {
        window.location.reload();
    }
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

EEZStudio.electron.ipcRenderer.on("show-about-box", async () => {
    const { showAboutBox } = await import("eez-studio-ui/about-box");
    showAboutBox();
});

EEZStudio.electron.ipcRenderer.on(
    "open-project",
    async (sender: any, filePath: any) => {
        try {
            let tab = tabs.findProjectEditorTab(filePath);
            if (!tab) {
                tab = await ProjectEditorTab.addTab(filePath);
            }
            if (tab) {
                tab.makeActive();
            }
        } catch (err) {
            console.error(err);
        }
    }
);

EEZStudio.electron.ipcRenderer.on(
    "new-project",
    async (sender: any, filePath: any) => {
        try {
            const tab = await ProjectEditorTab.addTab();
            if (tab) {
                tab.makeActive();
            }
        } catch (err) {
            console.error(err);
        }
    }
);

async function main() {
    const { loadExtensions } = await import(
        "eez-studio-shared/extensions/extensions"
    );
    await loadExtensions();

    loadTabs();

    const { App } = await import("home/app");
    ReactDOM.render(
        <ThemeProvider theme={theme}>
            <App />
            {notification.container}
            <LineMarkers />
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );

    handleDragAndDrop();
}

main();

//require("eez-studio-shared/module-stat");
