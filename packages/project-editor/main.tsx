/// <reference path="./globals.d.ts"/>
import { configure } from "mobx";
import React from "react";
import ReactDOM from "react-dom";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";

configure({ enforceActions: "observed" });

EEZStudio.electron.ipcRenderer.on("beforeClose", async () => {
    const storeModule = await import("project-editor/core/store");
    storeModule.ProjectStore.closeWindow();
});

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    const storeModule = await import("project-editor/core/store");
    storeModule.ProjectStore.saveUIState();
    window.location.reload();
});

(async () => {
    try {
        // this must be executed before GUI widgets initialization,
        // makeDataPropertyInfo will not work without this
        const contextModule = await import("eez-studio-page-editor/page-init-context");
        contextModule.setPageInitContext({
            dataItemsCollectionPath: ["data"]
        });

        const storeModule = await import("project-editor/core/store");

        const extensionsModule = await import("project-editor/core/extensions");
        await extensionsModule.loadExtensions();

        storeModule.init();

        const ProjectEditorModule = await import("project-editor/project/ProjectEditor");

        ReactDOM.render(
            <ThemeProvider theme={theme}>
                <ProjectEditorModule.ProjectEditor />
            </ThemeProvider>,
            document.getElementById("EezStudio_Content")
        );

        //require("eez-studio-shared/module-stat");
    } catch (err) {
        console.error(err);
    }
})();
