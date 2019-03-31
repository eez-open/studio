require("app-module-path").addPath(__dirname + "/..");

import { app, BrowserWindow } from "electron";
import { configure } from "mobx";

import { setup } from "setup/setup";

import * as HomeWindowModule from "main/home-window";
import * as SettingsModule from "main/settings";
import { openFile } from "main/project-editor-window";

configure({ enforceActions: "observed" });

////////////////////////////////////////////////////////////////////////////////

let setupFinished: boolean = false;
let projectFilePath: string | undefined;

app.on("ready", async function() {
    // make sure there is only one instance of this application
    var gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    }
    app.on("second-instance", function(event, commandLine, workingDirectory) {
        const projectFilePath = commandLine[commandLine.length - 1];
        if (projectFilePath.toLowerCase().endsWith(".eez-project")) {
            openFile(projectFilePath);
        } else {
            const {
                bringHomeWindowToFocus
            } = require("main/home-window") as typeof HomeWindowModule;
            bringHomeWindowToFocus();
        }
    });

    const { loadSettings } = require("main/settings") as typeof SettingsModule;
    loadSettings();

    await setup();

    require("eez-studio-shared/service");

    // start with:
    // npm start devToolsExtension="C:\Users\mvladic\AppData\Local\Google\Chrome\User Data\Default\Extensions\fmkadmapgofadopljbjfkapdkoienihi\3.4.2_0"
    if (process.argv.length > 2 && process.argv[2].startsWith("devToolsExtension=")) {
        BrowserWindow.addDevToolsExtension(process.argv[2].substr("devToolsExtension=".length));
    }

    if (projectFilePath) {
        openFile(projectFilePath);
    } else {
        const projectFilePath = process.argv[process.argv.length - 1];
        if (projectFilePath.toLowerCase().endsWith(".eez-project")) {
            openFile(projectFilePath);
        } else {
            const { openHomeWindow } = require("main/home-window") as typeof HomeWindowModule;
            openHomeWindow();
        }
    }

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

app.on("will-finish-launching", function() {
    app.on("open-file", function(event, path) {
        event.preventDefault();
        if (path.toLowerCase().endsWith(".eez-project")) {
            if (app.isReady()) {
                openFile(path);
            } else {
                projectFilePath = path;
            }
        }
    });
});
