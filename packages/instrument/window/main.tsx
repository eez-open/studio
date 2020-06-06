/// <reference path="./globals.d.ts"/>
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";
import "mobx-react-lite/batchingForReactDom";

import { theme } from "eez-studio-ui/theme";
import { ThemeProvider } from "eez-studio-ui/styled-components";
import * as notification from "eez-studio-ui/notification";

import { instruments } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

configure({ enforceActions: "observed" });

import { loadExtensions } from "eez-studio-shared/extensions/extensions";

loadExtensions().then(() => {
    const instrumentId = EEZStudio.electron.ipcRenderer.sendSync("getWindowArgs");

    const instrument = instruments.get(instrumentId);

    if (instrument) {
        const instrumentEditor = instrument.getEditor();
        instrumentEditor.onCreate();
        instrumentEditor.onActivate();

        ReactDOM.render(
            <ThemeProvider theme={theme}>
                <>
                    {instrumentEditor.render()}
                    {notification.container}
                </>
            </ThemeProvider>,
            document.getElementById("EezStudio_Content")
        );
    } else {
        console.error("instrument not found");
    }
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    window.location.reload();
});

//require("eez-studio-shared/module-stat");
