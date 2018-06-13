import * as fs from "fs";
import { app, screen, ipcMain } from "electron";
import { observable, action } from "mobx";

import { getUserDataPath } from "shared/util";
import { SETTINGS_FILE_NAME, DEFAULT_DB_NAME } from "shared/conf";

////////////////////////////////////////////////////////////////////////////////

interface WindowState {
    bounds?: Electron.Rectangle;
    displayBounds?: Electron.Rectangle;
    isMaximized?: boolean;
    isFullScreen?: boolean;
}

interface IMruItem {
    filePath: string;
}

class Settings {
    @observable mru: IMruItem[];

    @observable
    windowStates: {
        [key: string]: WindowState;
    };

    dbPath: string;
    locale: string;
}

export const settings = new Settings();

function getSettingsFilePath() {
    return app.getPath("userData") + "/" + SETTINGS_FILE_NAME;
}

export function loadSettings() {
    action(() => {
        settings.mru = [];
        settings.windowStates = {};

        try {
            let data = fs.readFileSync(getSettingsFilePath(), "utf8");

            try {
                let settingsJs: Settings = JSON.parse(data);

                if (settingsJs.mru) {
                    settings.mru = settingsJs.mru.filter((mruItem: IMruItem) =>
                        fs.existsSync(mruItem.filePath)
                    );
                } else {
                    settings.mru = [];
                }

                if (settingsJs.windowStates) {
                    settings.windowStates = settingsJs.windowStates;
                } else {
                    settings.windowStates = {};
                }

                settings.dbPath = settingsJs.dbPath;
                settings.locale = settingsJs.locale;
            } catch (parseError) {
                console.log(data);
                console.error(parseError);
            }
        } catch (readFileError) {
            console.info(`Settings file "${getSettingsFilePath()}" doesn't exists.`);
        }
    })();
}

export function saveSettings() {
    try {
        fs.writeFileSync(getSettingsFilePath(), JSON.stringify(settings, null, 2), "utf8");
    } catch (writeFileError) {
        console.error(writeFileError);
    }
}

export function findMruIndex(mruItemFilePath: string) {
    for (var i = 0; i < settings.mru.length; i++) {
        if (settings.mru[i].filePath == mruItemFilePath) {
            return i;
        }
    }
    return -1;
}

function isValidWindowState(windowState: WindowState) {
    if (windowState && windowState.bounds && windowState.displayBounds) {
        // check if the display where the window was last open is still available
        var displayBounds = screen.getDisplayMatching(windowState.bounds).bounds;
        if (
            windowState.displayBounds.x == displayBounds.x &&
            windowState.displayBounds.y == displayBounds.y &&
            windowState.displayBounds.width == displayBounds.width &&
            windowState.displayBounds.height == displayBounds.height
        ) {
            return true;
        }
    }

    return false;
}

export function settingsSetWindowBoundsIntoParams(
    windowId: string,
    params: Electron.BrowserWindowConstructorOptions
) {
    let windowState = settings.windowStates[windowId];
    if (isValidWindowState(windowState)) {
        Object.assign(params, windowState.bounds);
    } else {
        params.width = 1200;
        params.height = 900;
    }
}

export function settingsRegisterWindow(windowId: string, window: Electron.BrowserWindow) {
    let stateChangeTimer: any;
    let normalWindowBounds: Electron.Rectangle | undefined;

    function updateState() {
        var windowBounds = window.getBounds();

        if (!window.isMaximized() && !window.isMinimized() && !window.isFullScreen()) {
            normalWindowBounds = Object.assign({}, windowBounds);
        }

        var displayBounds = screen.getDisplayMatching(windowBounds).bounds;

        action(() => {
            settings.windowStates[windowId] = {
                bounds: normalWindowBounds,
                isMaximized: window.isMaximized(),
                isFullScreen: window.isFullScreen(),
                displayBounds: Object.assign({}, displayBounds)
            };
        })();
    }

    function stateChangeHandler() {
        clearTimeout(stateChangeTimer);
        stateChangeTimer = setTimeout(updateState, 10);
    }

    function closeHandler() {
        clearTimeout(stateChangeTimer);
        updateState();
    }

    let windowState = settings.windowStates[windowId];
    if (windowState) {
        normalWindowBounds = windowState.bounds;
        if (windowState.isMaximized) {
            window.maximize();
        }

        if (windowState.isFullScreen) {
            window.setFullScreen(true);
        }
    } else {
        normalWindowBounds = window.getBounds();
    }

    window.on("resize", stateChangeHandler);
    window.on("move", stateChangeHandler);
    window.on("close", closeHandler);
}

ipcMain.on("getMruFilePath", function(event: any) {
    var mruItem = settings.mru[0];
    event.returnValue = mruItem ? mruItem.filePath : null;
});

ipcMain.on("setMruFilePath", function(event: any, mruItemFilePath: string) {
    action(() => {
        var i = findMruIndex(mruItemFilePath);
        if (i != -1) {
            settings.mru.splice(i, 1);
        }

        settings.mru.unshift({
            filePath: mruItemFilePath
        });
    })();
});

function isValidDbPath(dbPath: string) {
    try {
        const Database = require("better-sqlite3");
        const db = new Database(dbPath);
        db.close();
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

export function getDbPath() {
    if (settings.dbPath && isValidDbPath(settings.dbPath)) {
        return settings.dbPath;
    }

    return getUserDataPath(DEFAULT_DB_NAME);
}

export function setDbPath(dbPath: string) {
    settings.dbPath = dbPath;
    saveSettings();
}

export function getLocale() {
    return settings.locale || app.getLocale();
}

export function setLocale(locale: string) {
    settings.locale = locale;
    saveSettings();
}

ipcMain.on("saveSettings", function() {
    saveSettings();
});

ipcMain.on("getDbPath", function(event: any) {
    event.returnValue = getDbPath();
});

ipcMain.on("setDbPath", function(event: any, dbPath: string) {
    setDbPath(dbPath);
});

ipcMain.on("getLocale", function(event: any) {
    event.returnValue = getLocale();
});

ipcMain.on("setLocale", function(event: any, locale: string) {
    setLocale(locale);
});
