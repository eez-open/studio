import "./fix-path";

import { app, session, ipcMain, powerSaveBlocker } from "electron";
import { configure } from "mobx";

require("@electron/remote/main").initialize();

import { setup } from "setup/setup";

import type * as HomeWindowModule from "main/home-window";
import { unloadVisa } from "instrument/connection/interfaces/visa-dll";

// disable security warnings inside dev console
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = true as any;

configure({ enforceActions: "observed" });

const contextMenu = require("electron-context-menu");

contextMenu({
    showSaveImageAs: true
});

////////////////////////////////////////////////////////////////////////////////

let setupFinished: boolean = false;

app.commandLine.appendSwitch("disable-renderer-backgrounding");

// app.allowRendererProcessReuse = false;

app.on("ready", async function () {
    var gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    }

    app.on("second-instance", function (event, commandLine, workingDirectory) {
        const { bringHomeWindowToFocus } =
            require("main/home-window") as typeof HomeWindowModule;
        bringHomeWindowToFocus();

        const { openFile } = require("main/menu");
        openFile(commandLine[commandLine.length - 1]);
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

    const { loadSettings } = await import("main/settings");
    await loadSettings();

    await setup();

    await import("instrument/connection/interfaces/serial-ports-main");

    require("eez-studio-shared/service");

    const { openHomeWindow } = await import("main/home-window");
    openHomeWindow();

    await import("main/menu");

    setupFinished = true;
});

// Quit when all windows are closed.
app.on("window-all-closed", function () {
    if (setupFinished) {
        app.quit();
    }
});

app.on("quit", function () {
    unloadVisa();
});

app.on("will-finish-launching", async function () {
    app.on("open-file", async function (event, path) {
        event.preventDefault();
        const { openFile } = require("main/menu");
        openFile(path);
    });
});

ipcMain.once("open-command-line-project", async function () {
    const filePath = process.argv[process.argv.length - 1];
    const { openFile } = require("main/menu");
    openFile(filePath);
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

process.on("warning", e => console.warn(e.stack));
