/// <reference path="./globals.d.ts"/>
import * as ReactDOM from "react-dom";
import { configure } from "mobx";

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

        ReactDOM.render(instrumentEditor.render(), document.getElementById("EezStudio_Content"));
    } else {
        console.error("instrument not found");
    }
});

EEZStudio.electron.ipcRenderer.on("reload", () => {
    window.location.reload();
});

//require("shared/module-stat");
