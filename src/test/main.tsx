/// <reference path="../shared/globals.d.ts"/>
import * as React from "react";
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

import { theme } from "shared/ui/theme";
import { ThemeProvider } from "shared/ui/styled-components";

configure({ enforceActions: true });

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

//require("shared/module-stat");
