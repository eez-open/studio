/// <reference path="./globals.d.ts"/>
import { configure } from "mobx";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { theme } from "shared/ui/theme";
import { ThemeProvider } from "shared/ui/styled-components";

import { ProjectStore } from "project-editor/core/store";
import { loadExtensions } from "project-editor/core/extensions";
import { init as storeInit } from "project-editor/core/store";
import * as layout from "project-editor/core/layout";
import { ProjectEditor } from "project-editor/project/ProjectEditor";

configure({ enforceActions: "observed" });

window.requestAnimationFrame(async () => {
    try {
        await loadExtensions();
        storeInit();
        ReactDOM.render(
            <ThemeProvider theme={theme}>
                <ProjectEditor />
            </ThemeProvider>,
            document.getElementById("content")
        );
        layout.enable();
    } catch (err) {
        console.error(err);
    }
});

EEZStudio.electron.ipcRenderer.on("beforeClose", () => {
    ProjectStore.closeWindow();
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    ProjectStore.saveUIState();
    window.location.reload();
});

//require("shared/module-stat");
