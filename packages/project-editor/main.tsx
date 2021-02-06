/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure, action } from "mobx";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import { ProjectStoreClass } from "./project/project";

const ProjectStore = new ProjectStoreClass();

const ipcRenderer = EEZStudio.electron.ipcRenderer;

configure({ enforceActions: "observed" });

EEZStudio.electron.ipcRenderer.on("beforeClose", async () => {
    function blurAll() {
        var tmp = document.createElement("input");
        document.body.appendChild(tmp);
        tmp.focus();
        document.body.removeChild(tmp);
    }

    // make sure we store all the values waiting to be stored inside blur event handler
    blurAll();

    ProjectStore.closeWindow();
});

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    ProjectStore.saveUIState();
    window.location.reload();
});

(async () => {
    try {
        init(ProjectStore);

        const { ProjectContext } = await import(
            "project-editor/project/context"
        );

        const { ProjectEditor } = await import(
            "project-editor/project/ProjectEditor"
        );

        ReactDOM.render(
            <ProjectContext.Provider value={ProjectStore}>
                <ThemeProvider theme={theme}>
                    <ProjectEditor />
                </ThemeProvider>
            </ProjectContext.Provider>,
            document.getElementById("EezStudio_Content")
        );

        //require("eez-studio-shared/module-stat");
    } catch (err) {
        console.error(err);
    }
})();

async function init(ProjectStore: ProjectStoreClass) {
    const extensionsModule = await import("project-editor/core/extensions");
    await extensionsModule.loadExtensions();

    EEZStudio.electron.ipcRenderer.on("newProject", () =>
        ProjectStore.newProject()
    );

    EEZStudio.electron.ipcRenderer.on("open", (sender: any, filePath: any) =>
        ProjectStore.open(sender, filePath)
    );

    EEZStudio.electron.ipcRenderer.on("save", () => ProjectStore.save());
    EEZStudio.electron.ipcRenderer.on("saveAs", () => ProjectStore.saveAs());

    EEZStudio.electron.ipcRenderer.on("check", () => ProjectStore.check());
    EEZStudio.electron.ipcRenderer.on("build", () => ProjectStore.build());
    EEZStudio.electron.ipcRenderer.on("build-extensions", () =>
        ProjectStore.buildExtensions()
    );

    EEZStudio.electron.ipcRenderer.on("undo", () =>
        ProjectStore.UndoManager.undo()
    );
    EEZStudio.electron.ipcRenderer.on("redo", () =>
        ProjectStore.UndoManager.redo()
    );

    EEZStudio.electron.ipcRenderer.on(
        "cut",
        () =>
            ProjectStore.NavigationStore.selectedPanel &&
            ProjectStore.NavigationStore.selectedPanel.cutSelection()
    );
    EEZStudio.electron.ipcRenderer.on(
        "copy",
        () =>
            ProjectStore.NavigationStore.selectedPanel &&
            ProjectStore.NavigationStore.selectedPanel.copySelection()
    );
    EEZStudio.electron.ipcRenderer.on(
        "paste",
        () =>
            ProjectStore.NavigationStore.selectedPanel &&
            ProjectStore.NavigationStore.selectedPanel.pasteSelection()
    );
    EEZStudio.electron.ipcRenderer.on(
        "delete",
        () =>
            ProjectStore.NavigationStore.selectedPanel &&
            ProjectStore.NavigationStore.selectedPanel.deleteSelection()
    );

    // EEZStudio.electron.ipcRenderer.on('goBack', () => ProjectStore.selection.selectionGoBack());
    // EEZStudio.electron.ipcRenderer.on('goForward', () => ProjectStore.selection.selectionGoForward());

    EEZStudio.electron.ipcRenderer.on(
        "toggleOutput",
        action(
            () =>
                (ProjectStore.UIStateStore.viewOptions.outputVisible = !ProjectStore
                    .UIStateStore.viewOptions.outputVisible)
        )
    );

    EEZStudio.electron.ipcRenderer.on("showProjectMetrics", () =>
        ProjectStore.showMetrics()
    );

    if (window.location.search == "?mru") {
        let mruFilePath = ipcRenderer.sendSync("getMruFilePath");
        if (mruFilePath) {
            ProjectStore.openFile(mruFilePath);
        } else {
            ProjectStore.newProject();
        }
    } else if (window.location.search.startsWith("?open=")) {
        let ProjectStorePath = decodeURIComponent(
            window.location.search.substring("?open=".length)
        );
        ProjectStore.openFile(ProjectStorePath);
    } else if (window.location.search.startsWith("?new")) {
        ProjectStore.newProject();
    } else {
        ProjectStore.noProject();
    }

    ProjectStore.waitUntilready();
}
