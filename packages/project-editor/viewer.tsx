/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import * as notification from "eez-studio-ui/notification";

import { DocumentStoreClass } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project/ProjectEditor";
import { isBrowser } from "eez-studio-shared/util-electron";

configure({ enforceActions: "observed" });

if (isBrowser()) {
} else {
    EEZStudio.electron.ipcRenderer?.on("beforeClose", async () => {
        EEZStudio.electron.ipcRenderer.send("readyToClose");
    });

    EEZStudio.electron.ipcRenderer?.on("reload", async () => {
        window.location.reload();
    });

    EEZStudio.electron.ipcRenderer?.on("show-about-box", async () => {
        const { showAboutBox } = await import("eez-studio-ui/about-box");
        showAboutBox();
    });
}

async function main() {
    const params = new URLSearchParams(location.search);
    const url = params.get("url");
    console.log(url);

    const DocumentStore = await DocumentStoreClass.create();
    if (url) {
        DocumentStore.openFile(url);
    } else {
        DocumentStore.newProject();
    }
    DocumentStore.waitUntilready();

    ReactDOM.render(
        <ThemeProvider theme={theme}>
            <ProjectContext.Provider value={DocumentStore}>
                <ProjectEditor />
            </ProjectContext.Provider>
            {notification.container}
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );
}

main();
