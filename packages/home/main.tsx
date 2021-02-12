/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";
import "mobx-react-lite/batchingForReactDom";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import * as notification from "eez-studio-ui/notification";

import { handleDragAndDrop } from "home/drag-and-drop";
import { loadTabs, ProjectEditorTab, tabs } from "home/tabs-store";

import * as ImportInstrumentDefinitionModule from "instrument/import-instrument-definition";

configure({ enforceActions: "observed" });

EEZStudio.electron.ipcRenderer.on("beforeClose", async () => {
    // make sure we store all the values waiting to be stored inside blur event handler
    function blurAll() {
        var tmp = document.createElement("input");
        document.body.appendChild(tmp);
        tmp.focus();
        document.body.removeChild(tmp);
    }
    blurAll();

    for (const tab of tabs.tabs) {
        if (tab.beforeAppClose) {
            await tab.beforeAppClose();
        }
    }

    const {
        destroyExtensions
    } = require("eez-studio-shared/extensions/extensions");
    destroyExtensions();
    EEZStudio.electron.ipcRenderer.send("readyToClose");
});

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    for (const tab of tabs.tabs) {
        if (tab instanceof ProjectEditorTab) {
            await tab.ProjectStore.saveUIState();
        }
    }

    const {
        destroyExtensions
    } = require("eez-studio-shared/extensions/extensions");
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

EEZStudio.electron.ipcRenderer.on("show-about-box", async () => {
    const { showAboutBox } = await import("eez-studio-ui/about-box");
    showAboutBox();
});

EEZStudio.electron.ipcRenderer.on(
    "open-project",
    async (sender: any, filePath: any) => {
        try {
            const tab = await ProjectEditorTab.addTab(filePath);
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
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );

    handleDragAndDrop();
}

main();

//require("eez-studio-shared/module-stat");
