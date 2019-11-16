import React from "react";
import ReactDOM from "react-dom";

import { Icon } from "eez-studio-ui/icon";

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    window.location.reload();
});

EEZStudio.electron.ipcRenderer.on("beforeClose", async () => {
    EEZStudio.electron.ipcRenderer.send("readyToClose");
});

(async () => {
    try {
        ReactDOM.render(
            <div>
                Hello, world 1234!<Icon icon="material:edit"></Icon>
            </div>,
            document.getElementById("EezStudio_Content")
        );

        //require("eez-studio-shared/module-stat");
    } catch (err) {
        console.error(err);
    }
})();
