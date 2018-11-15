/// <reference path="../eez-studio-shared/globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";

configure({ enforceActions: "observed" });

EEZStudio.electron.ipcRenderer.on("beforeClose", () => {});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    window.location.reload();
});

async function main() {
    const { App } = await import("test/app");
    ReactDOM.render(
        <ThemeProvider theme={theme}>
            <App />
        </ThemeProvider>,
        document.getElementById("EezStudio_Content")
    );
}

main();

//require("eez-studio-shared/module-stat");
