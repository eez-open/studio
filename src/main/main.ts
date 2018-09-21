require("app-module-path").addPath(__dirname + "/..");

import { app } from "electron";
import { configure } from "mobx";

import { setup } from "setup/setup";

import * as HomeWindowModule from "main/home-window";
import * as SettingsModule from "main/settings";

configure({ enforceActions: true });

////////////////////////////////////////////////////////////////////////////////

let setupFinished: boolean = false;

app.on("ready", async function() {
    // make sure there is only one instance of this application
    var gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    }
    app.on("second-instance", function(commandLine, workingDirectory) {
        const { bringHomeWindowToFocus } = require("main/home-window") as typeof HomeWindowModule;
        bringHomeWindowToFocus();
    });

    const { loadSettings } = require("main/settings") as typeof SettingsModule;
    loadSettings();

    await setup();

    require("main/pdf-to-png");

    const { openHomeWindow } = require("main/home-window") as typeof HomeWindowModule;
    openHomeWindow();

    require("main/menu");

    setupFinished = true;
});

// Quit when all windows are closed.
app.on("window-all-closed", function() {
    if (setupFinished) {
        app.quit();
    }
});

app.on("quit", function() {
    const { saveSettings } = require("main/settings") as typeof SettingsModule;
    saveSettings();
});
