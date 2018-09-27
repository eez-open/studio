/// <reference path="./globals.d.ts"/>
import * as React from "react";
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

import { theme } from "shared/ui/theme";
import { ThemeProvider } from "shared/ui/styled-components";

import { instruments } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

configure({ enforceActions: true });

import { loadExtensions } from "shared/extensions/extensions";

loadExtensions().then(() => {
    const instrumentId = EEZStudio.electron.ipcRenderer.sendSync("getWindowArgs");

    const instrument = instruments.get(instrumentId);

    if (instrument) {
        const instrumentEditor = instrument.getEditor();
        instrumentEditor.onCreate();
        instrumentEditor.onActivate();

        ReactDOM.render(
            <ThemeProvider theme={theme}>{instrumentEditor.render()}</ThemeProvider>,
            document.getElementById("EezStudio_Content")
        );
    } else {
        console.error("instrument not found");
    }
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    window.location.reload();
});

//require("shared/module-stat");
