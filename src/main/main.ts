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
    var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
        const { bringHomeWindowToFocus } = require("main/home-window") as typeof HomeWindowModule;
        bringHomeWindowToFocus();
    });

    if (shouldQuit) {
        app.quit();
        return;
    }

    const { loadSettings } = require("main/settings") as typeof SettingsModule;
    loadSettings();

    await setup();

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
