import { BrowserWindow, ipcMain, app } from "electron";
import { action, observable, runInAction } from "mobx";

import { getIcon } from "main/util";
import {
    settingsRegisterWindow,
    settingsSetWindowBoundsIntoParams
} from "main/settings";

export interface IWindowSate {
    modified: boolean;
    undo: string | null;
    redo: string | null;
}

export interface IWindowParams {
    url: string;
    hideOnClose?: boolean;
}

export interface IWindow {
    url: string;
    browserWindow: Electron.BrowserWindow;
    readyToClose: boolean;
    state: IWindowSate;
    focused: boolean;
}

export const windows = observable<IWindow>([]);

let forceQuit = false;

export function setForceQuit() {
    forceQuit = true;
}

export function createWindow(params: IWindowParams) {
    let windowUrl = params.url;
    if (!windowUrl.startsWith("file://")) {
        windowUrl = `file://${__dirname}/../${windowUrl}`;
    }

    var windowContructorParams: Electron.BrowserWindowConstructorOptions = {
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            nodeIntegrationInWorker: true,
            plugins: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false
    };

    settingsSetWindowBoundsIntoParams(params.url, windowContructorParams);

    windowContructorParams.icon = getIcon();

    let browserWindow = new BrowserWindow(windowContructorParams);

    runInAction(() =>
        windows.push({
            url: params.url,
            browserWindow,
            readyToClose: false,
            state: {
                modified: false,
                undo: null,
                redo: null
            },
            focused: false
        })
    );
    let window = windows[windows.length - 1];

    settingsRegisterWindow(params.url, browserWindow);

    browserWindow.loadURL(windowUrl);

    browserWindow.show();

    browserWindow.on("close", function (event: any) {
        if (params.hideOnClose && windows.length > 1 && !forceQuit) {
            browserWindow.hide();
            event.preventDefault();
            return;
        }

        if (!window.readyToClose) {
            browserWindow.webContents.send("beforeClose");
            event.preventDefault();
        }
    });

    browserWindow.on("closed", function () {
        action(() =>
            windows.splice(
                windows.findIndex(win => win.browserWindow === browserWindow),
                1
            )
        )();

        // if no visible window left, app can quit
        if (!windows.find(window => window.browserWindow.isVisible())) {
            app.quit();
        }
    });

    return browserWindow;
}

export function findWindowByParams(params: IWindowParams) {
    return windows.find(win => win.url === params.url);
}

export function findWindowByBrowserWindow(
    browserWindow: Electron.BrowserWindow
) {
    return windows.find(win => win.browserWindow === browserWindow);
}

export function findWindowByWebContents(webContents: Electron.WebContents) {
    return windows.find(win => win.browserWindow.webContents === webContents);
}

export function openWindow(params: IWindowParams) {
    return createWindow(params);
}

export function closeWindow(params: IWindowParams) {
    let win = findWindowByParams(params);
    if (win) {
        win.browserWindow.close();
    }
}

////////////////////////////////////////////////////////////////////////////////

ipcMain.on("openWindow", function (event: any, params: any) {
    openWindow(params);
});

ipcMain.on("focusWindow", function (event: any, params: any) {
    let win = findWindowByParams(params);
    if (win) {
        win.browserWindow.focus();
        event.returnValue = true;
    } else {
        event.returnValue = false;
    }
});

ipcMain.on("closeWindow", function (event: any, params: any) {
    closeWindow(params);
});

ipcMain.on("readyToClose", (event: any) => {
    const window = findWindowByWebContents(event.sender);
    if (window) {
        runInAction(() => {
            window.readyToClose = true;
        });
        window.browserWindow.close();
    }
});

app.on(
    "browser-window-focus",
    function (event: Electron.Event, browserWindow: Electron.BrowserWindow) {
        runInAction(() => {
            windows.forEach(window => {
                window.focused = window.browserWindow === browserWindow;
            });
        });
    }
);

ipcMain.on(
    "windowSetState",
    (
        event: any,
        state: {
            modified: boolean;
            projectFilePath: string;
            undo: string | null;
            redo: string | null;
        }
    ) => {
        const window = findWindowByWebContents(event.sender);
        if (window) {
            runInAction(() => {
                window.state = {
                    modified: state.modified,
                    undo: state.undo,
                    redo: state.redo
                };
            });
        }
    }
);

ipcMain.on("tabs-change", (event, tabs) => {
    console.log("event.sender.id", event.sender.id);
    console.log("tabs", tabs);
});
