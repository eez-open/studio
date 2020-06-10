/// <reference path="./globals.d.ts"/>
import { configure, action } from "mobx";
import "mobx-react-lite/batchingForReactDom";
import React from "react";
import ReactDOM from "react-dom";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";

import * as StoreModule from "project-editor/core/store";
import * as ProjectModule from "project-editor/project/project";

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

    const { ProjectStore } = (await import(
        "project-editor/project/project"
    )) as typeof ProjectModule;
    ProjectStore.closeWindow();
});

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    const { ProjectStore } = (await import(
        "project-editor/project/project"
    )) as typeof ProjectModule;
    ProjectStore.saveUIState();
    window.location.reload();
});

(async () => {
    try {
        init();

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

async function init() {
    const { UndoManager, NavigationStore, UIStateStore } = (await import(
        "project-editor/core/store"
    )) as typeof StoreModule;

    const extensionsModule = await import("project-editor/core/extensions");
    await extensionsModule.loadExtensions();

    const { ProjectStore } = (await import(
        "project-editor/project/project"
    )) as typeof ProjectModule;

    EEZStudio.electron.ipcRenderer.on("newProject", () => ProjectStore.newProject());

    EEZStudio.electron.ipcRenderer.on("open", (sender: any, filePath: any) =>
        ProjectStore.open(sender, filePath)
    );

    EEZStudio.electron.ipcRenderer.on("save", () => ProjectStore.save());
    EEZStudio.electron.ipcRenderer.on("saveAs", () => ProjectStore.saveAs());

    EEZStudio.electron.ipcRenderer.on("check", () => ProjectStore.check());
    EEZStudio.electron.ipcRenderer.on("build", () => ProjectStore.build());
    EEZStudio.electron.ipcRenderer.on("build-extensions", () => ProjectStore.buildExtensions());

    EEZStudio.electron.ipcRenderer.on("undo", () => UndoManager.undo());
    EEZStudio.electron.ipcRenderer.on("redo", () => UndoManager.redo());

    EEZStudio.electron.ipcRenderer.on(
        "cut",
        () => NavigationStore.selectedPanel && NavigationStore.selectedPanel.cutSelection()
    );
    EEZStudio.electron.ipcRenderer.on(
        "copy",
        () => NavigationStore.selectedPanel && NavigationStore.selectedPanel.copySelection()
    );
    EEZStudio.electron.ipcRenderer.on(
        "paste",
        () => NavigationStore.selectedPanel && NavigationStore.selectedPanel.pasteSelection()
    );
    EEZStudio.electron.ipcRenderer.on(
        "delete",
        () => NavigationStore.selectedPanel && NavigationStore.selectedPanel.deleteSelection()
    );

    // EEZStudio.electron.ipcRenderer.on('goBack', () => ProjectStore.selection.selectionGoBack());
    // EEZStudio.electron.ipcRenderer.on('goForward', () => ProjectStore.selection.selectionGoForward());

    EEZStudio.electron.ipcRenderer.on(
        "toggleOutput",
        action(
            () => (UIStateStore.viewOptions.outputVisible = !UIStateStore.viewOptions.outputVisible)
        )
    );

    EEZStudio.electron.ipcRenderer.on("showProjectMetrics", () => ProjectStore.showMetrics());

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
