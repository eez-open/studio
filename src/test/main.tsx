/// <reference path="../shared/globals.d.ts"/>
import * as React from "react";
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

configure({ enforceActions: true });

EEZStudio.electron.ipcRenderer.on("beforeClose", () => {});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    window.location.reload();
});

async function main() {
    const { App } = await import("test/app");
    ReactDOM.render(<App />, document.getElementById("EezStudio_Content"));
}

main();

//require("shared/module-stat");
