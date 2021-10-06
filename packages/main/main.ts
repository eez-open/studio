import "./fix-path";

import { app, session, ipcMain, powerSaveBlocker } from "electron";
import { configure } from "mobx";

require("@electron/remote/main").initialize();

import { setup } from "setup/setup";

import * as HomeWindowModule from "main/home-window";
import * as SettingsModule from "main/settings";

// disable security warnings inside dev console
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = true as any;

configure({ enforceActions: "observed" });

////////////////////////////////////////////////////////////////////////////////

let setupFinished: boolean = false;
let projectFilePath: string | undefined;

app.commandLine.appendSwitch("disable-renderer-backgrounding");

app.allowRendererProcessReuse = false;

app.on("ready", async function () {
    var gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    }

    app.on("second-instance", function (event, commandLine, workingDirectory) {
        const projectFilePath = commandLine[commandLine.length - 1];
        const { openProject } = require("main/menu");
        if (projectFilePath.toLowerCase().endsWith(".eez-project")) {
            openProject(projectFilePath);
        } else {
            const { bringHomeWindowToFocus } =
                require("main/home-window") as typeof HomeWindowModule;
            bringHomeWindowToFocus();
        }
    });

    // start with:
    // react devtools: npm start devToolsExtension="C:\Users\mvladic\AppData\Local\Google\Chrome\User Data\Default\Extensions\fmkadmapgofadopljbjfkapdkoienihi\4.10.1_0"
    // mobx devtools: npm start devToolsExtension="C:\Users\mvladic\AppData\Local\Google\Chrome\User Data\Default\Extensions\pfgnfdagidkfgccljigdamigbcnndkod\0.9.26_0"
    if (
        process.argv.length > 2 &&
        process.argv[2].startsWith("devToolsExtension=")
    ) {
        await app.whenReady();
        await session.defaultSession.loadExtension(
            process.argv[2].substr("devToolsExtension=".length),
            { allowFileAccess: true }
        );
    }

    const { loadSettings } = require("main/settings") as typeof SettingsModule;
    loadSettings();

    await setup();

    require("eez-studio-shared/service");

    const { openProject } = require("main/menu");

    if (projectFilePath) {
        openProject(projectFilePath);
    } else {
        const projectFilePath = process.argv[process.argv.length - 1];
        if (projectFilePath.toLowerCase().endsWith(".eez-project")) {
            openProject(projectFilePath);
        } else {
            const { openHomeWindow } =
                require("main/home-window") as typeof HomeWindowModule;
            openHomeWindow();
        }
    }

    require("main/menu");

    setupFinished = true;
});

// Quit when all windows are closed.
app.on("window-all-closed", function () {
    if (setupFinished) {
        app.quit();
    }
});

app.on("quit", function () {
    const { saveSettings } = require("main/settings") as typeof SettingsModule;
    saveSettings();
});

app.on("will-finish-launching", function () {
    app.on("open-file", function (event, path) {
        event.preventDefault();
        if (path.toLowerCase().endsWith(".eez-project")) {
            if (app.isReady()) {
                const { openProject } = require("main/menu");
                openProject(path);
            } else {
                projectFilePath = path;
            }
        }
    });
});

let powerSaveBlockerId: number | undefined = undefined;
ipcMain.on("preventAppSuspension", (event: any, on: boolean) => {
    if (on) {
        if (powerSaveBlockerId == undefined) {
            powerSaveBlockerId = powerSaveBlocker.start(
                "prevent-app-suspension"
            );
        }
    } else {
        if (powerSaveBlockerId != undefined) {
            powerSaveBlocker.stop(powerSaveBlockerId);
            powerSaveBlockerId = undefined;
        }
    }
});
