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
import { LineMarkers } from "./flow/flow-editor/ConnectionLineComponent";

configure({ enforceActions: "observed" });

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
            <LineMarkers />
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );
}

main();
