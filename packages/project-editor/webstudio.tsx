/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure, runInAction } from "mobx";

import * as notification from "eez-studio-ui/notification";

import { DocumentStoreClass } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project/ProjectEditor";
import { LineMarkers } from "project-editor/flow/flow-editor/ConnectionLineComponent";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";

configure({ enforceActions: "observed" });

async function main() {
    const params = new URLSearchParams(location.search);
    const url = params.get("url");
    console.log(url);

    await initProjectEditor();
    const DocumentStore = await DocumentStoreClass.create();
    if (url) {
        DocumentStore.openFile(url);
    } else {
        DocumentStore.newProject();
    }

    await DocumentStore.loadAllExternalProjects();
    runInAction(() => {
        DocumentStore.project._fullyLoaded = true;
    });
    DocumentStore.startBackgroundCheck();

    ReactDOM.render(
        <>
            <ProjectContext.Provider value={DocumentStore}>
                <ProjectEditor />
            </ProjectContext.Provider>
            {notification.container}
            <LineMarkers />
        </>,
        document.getElementById("EezStudio_Content")
    );
}

main();
