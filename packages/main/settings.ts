import fs from "fs";
import { app, screen, ipcMain, BrowserWindow } from "electron";
import {
    observable,
    action,
    runInAction,
    autorun,
    toJS,
    makeObservable,
    reaction
} from "mobx";
import DatabaseConstructor from "better-sqlite3";

import { getUserDataPath } from "eez-studio-shared/util-electron";
import { SETTINGS_FILE_NAME, DEFAULT_DB_NAME } from "eez-studio-shared/conf";
import { DATE_FORMATS, TIME_FORMATS } from "eez-studio-shared/i10n";

////////////////////////////////////////////////////////////////////////////////

interface WindowState {
    bounds?: Electron.Rectangle;
    displayBounds?: Electron.Rectangle;
    isMaximized?: boolean;
    isFullScreen?: boolean;
}

export interface IDbPath {
    filePath: string;
    isActive: boolean;
    timeOfLastDatabaseCompactOperation: number;
}

export interface IMruItem {
    filePath: string;
    projectType: string;
    hasFlowSupport: boolean;
}

class Settings {
    mru: IMruItem[] = [];

    windowStates: {
        [key: string]: WindowState;
    } = {};

    activeDbPath: string = "";

    dbPaths: IDbPath[] = [];

    locale: string = "";
    dateFormat: string = "";
    timeFormat: string = "";

    isDarkTheme: boolean = false;

    get settingsFilePath() {
        return app.getPath("userData") + "/" + SETTINGS_FILE_NAME;
    }

    _loaded: boolean = false;

    async loadSettings() {
        if (this._loaded) {
            return;
        }

        try {
            let data = fs.readFileSync(this.settingsFilePath, "utf8");
            try {
                let settingsJs: Settings = JSON.parse(data);
                await this.readSettings(settingsJs);
            } catch (parseError) {
                console.log(data);
                console.error(parseError);
            }
        } catch (readFileError) {
            console.info(
                `Settings file "${this.settingsFilePath}" doesn't exists.`
            );
        }

        this._loaded = true;

        makeObservable(this, {
            mru: observable,
            windowStates: observable,
            activeDbPath: observable,
            dbPaths: observable,
            locale: observable,
            dateFormat: observable,
            timeFormat: observable,
            isDarkTheme: observable
        });

        reaction(
            () => JSON.stringify(toJS(this), null, 2),
            settingsJSON => {
                try {
                    fs.writeFileSync(
                        this.settingsFilePath,
                        settingsJSON,
                        "utf8"
                    );
                } catch (writeFileError) {
                    console.error(writeFileError);
                }
            }
        );

        autorun(() => {
            const mru = toJS(this.mru);
            BrowserWindow.getAllWindows().forEach(window =>
                window.webContents.send("mru-changed", mru)
            );
        });
    }

    async readSettings(settingsJs: Partial<Settings>) {
        if (settingsJs.mru != undefined) {
            const mru = settingsJs.mru.filter((mruItem: IMruItem) =>
                fs.existsSync(mruItem.filePath)
            );

            for (const mruItem of mru) {
                if (!mruItem.projectType) {
                    try {
                        const jsonStr = await fs.promises.readFile(
                            mruItem.filePath,
                            "utf-8"
                        );
                        const json = JSON.parse(jsonStr);
                        mruItem.projectType = json.settings.general.projectType;
                    } catch (err) {}
                }
            }

            this.mru = mru;
        }

        if (settingsJs.windowStates != undefined) {
            this.windowStates = settingsJs.windowStates;
        }

        if (settingsJs.dbPaths != undefined) {
            this.dbPaths = settingsJs.dbPaths;

            this.dbPaths.forEach(dbPath => {
                if (dbPath.timeOfLastDatabaseCompactOperation == undefined) {
                    dbPath.timeOfLastDatabaseCompactOperation = Date.now();
                }
            });

            this.activeDbPath =
                this.dbPaths.find(dbPath => dbPath.isActive)?.filePath ?? "";
        } else {
            this.activeDbPath = (settingsJs as any).dbPath;
            this.dbPaths = [
                {
                    filePath: this.activeDbPath,
                    isActive: true,
                    timeOfLastDatabaseCompactOperation: Date.now()
                }
            ];
        }

        if (settingsJs.locale != undefined) {
            this.locale = settingsJs.locale;
        }

        if (settingsJs.dateFormat != undefined) {
            this.dateFormat = settingsJs.dateFormat;
        }

        if (settingsJs.timeFormat != undefined) {
            this.timeFormat = settingsJs.timeFormat;
        }

        if (settingsJs.isDarkTheme != undefined) {
            this.isDarkTheme = settingsJs.isDarkTheme;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export const settings = new Settings();

////////////////////////////////////////////////////////////////////////////////

export async function loadSettings() {
    settings.loadSettings();
}

////////////////////////////////////////////////////////////////////////////////

export function findMruIndex(mruItemFilePath: string) {
    for (var i = 0; i < settings.mru.length; i++) {
        if (settings.mru[i].filePath == mruItemFilePath) {
            return i;
        }
    }
    return -1;
}

ipcMain.on("setMruFilePath", function (event: any, mruItem: IMruItem) {
    action(() => {
        var i = findMruIndex(mruItem.filePath);
        if (i != -1) {
            settings.mru.splice(i, 1);
        }

        settings.mru.unshift(mruItem);
    })();
});

ipcMain.on("getMRU", function (event: Electron.IpcMainEvent) {
    const mru: IMruItem[] = toJS(settings.mru);

    event.returnValue = mru;
});

ipcMain.on("setMRU", function (event: any, mru: IMruItem[]) {
    function isMruChanged(mru1: IMruItem[], mru2: IMruItem[]) {
        if (!!mru1 != !!mru) {
            return true;
        }
        if (mru1.length != mru2.length) {
            return true;
        }
        for (let i = 0; i < mru1.length; i++) {
            if (mru1[i].filePath != mru2[i].filePath) {
                return true;
            }
        }
        return false;
    }

    if (isMruChanged(mru, settings.mru)) {
        runInAction(() => (settings.mru = mru));
    }
});

////////////////////////////////////////////////////////////////////////////////

function isValidWindowState(windowState: WindowState) {
    if (windowState && windowState.bounds && windowState.displayBounds) {
        // check if the display where the window was last open is still available
        var displayBounds = screen.getDisplayMatching(
            windowState.bounds
        ).bounds;
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
    const initialWidth = params.width || 1200;
    const initialHeight = params.height || 900;

    let windowState = settings.windowStates[windowId];
    if (isValidWindowState(windowState)) {
        if (windowState.isMaximized) {
            if (windowState.bounds!.width < initialWidth) {
                windowState.bounds!.width = initialWidth;
            }
            if (windowState.bounds!.height < initialHeight) {
                windowState.bounds!.height = initialHeight;
            }
        } else {
            if (windowState.bounds!.width < Math.round(initialWidth / 2)) {
                windowState.bounds!.width = Math.round(initialWidth / 2);
            }
            if (windowState.bounds!.height < Math.round(initialHeight / 2)) {
                windowState.bounds!.height = Math.round(initialHeight / 2);
            }
        }
        Object.assign(params, windowState.bounds);
    } else {
        params.width = initialWidth;
        params.height = initialHeight;
    }
}

export function settingsRegisterWindow(
    windowId: string,
    window: Electron.BrowserWindow
) {
    let stateChangeTimer: any;
    let normalWindowBounds: Electron.Rectangle | undefined;

    function updateState() {
        var windowBounds = window.getBounds();

        if (
            !window.isMaximized() &&
            !window.isMinimized() &&
            !window.isFullScreen()
        ) {
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

////////////////////////////////////////////////////////////////////////////////

function isValidDbPath(dbPath: string) {
    try {
        const db = new DatabaseConstructor(dbPath);
        db.close();
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

export function getActiveDbPath() {
    if (settings.activeDbPath && isValidDbPath(settings.activeDbPath)) {
        return settings.activeDbPath;
    }

    return getUserDataPath(DEFAULT_DB_NAME);
}

export function getDbPaths() {
    return toJS(settings.dbPaths);
}

export function setDbPaths(dbPaths: IDbPath[]) {
    runInAction(() => (settings.dbPaths = dbPaths));
}

ipcMain.on("getActiveDbPath", function (event: any) {
    event.returnValue = getActiveDbPath();
});

ipcMain.on("getDbPaths", function (event: any) {
    event.returnValue = getDbPaths();
});

ipcMain.on("setDbPaths", function (event: any, dbPaths: IDbPath[]) {
    setDbPaths(dbPaths);
});

////////////////////////////////////////////////////////////////////////////////

export function getLocale() {
    return settings.locale || app.getLocale();
}

export function setLocale(value: string) {
    runInAction(() => (settings.locale = value));
}

export function getDateFormat() {
    return settings.dateFormat || DATE_FORMATS[0].format;
}

export function setDateFormat(value: string) {
    runInAction(() => (settings.dateFormat = value));
}

export function getTimeFormat() {
    return settings.timeFormat || TIME_FORMATS[0].format;
}

export function setTimeFormat(value: string) {
    runInAction(() => (settings.timeFormat = value));
}

ipcMain.on("getLocale", function (event: any) {
    event.returnValue = getLocale();
});

ipcMain.on("setLocale", function (event: any, value: string) {
    setLocale(value);
});

ipcMain.on("getDateFormat", function (event: any) {
    event.returnValue = getDateFormat();
});

ipcMain.on("setDateFormat", function (event: any, value: string) {
    setDateFormat(value);
});

ipcMain.on("getTimeFormat", function (event: any) {
    event.returnValue = getTimeFormat();
});

ipcMain.on("setTimeFormat", function (event: any, value: string) {
    setTimeFormat(value);
});

////////////////////////////////////////////////////////////////////////////////

function getIsDarkTheme() {
    return settings.isDarkTheme;
}

function setIsDarkTheme(value: boolean) {
    runInAction(() => {
        settings.isDarkTheme = value;
    });
}

ipcMain.on("getIsDarkTheme", function (event: any) {
    event.returnValue = getIsDarkTheme();
});

ipcMain.on("setIsDarkTheme", function (event: any, value: boolean) {
    setIsDarkTheme(value);
});

////////////////////////////////////////////////////////////////////////////////
