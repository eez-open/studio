import fs from "fs";

import { BrowserWindow, ipcMain, app, dialog, shell } from "electron";
import { action, observable, runInAction } from "mobx";

import { getIcon } from "main/util";
import {
    settingsRegisterWindow,
    settingsSetWindowBoundsIntoParams
} from "main/settings";
import { sourceRootDir } from "eez-studio-shared/util";
import {
    PROJECT_TAB_ID_PREFIX,
    RUN_PROJECT_TAB_ID_PREFIX
} from "home/tabs-store-conf";

export interface IWindowSate {
    modified: boolean;
    undo: string | null;
    redo: string | null;
    isDebuggerActive: boolean;
    hasExtensionDefinitions: boolean;
}

export interface IWindowParams {
    url: string;
    hideOnClose?: boolean;
    showHidden?: boolean;
    utilityWindow?: boolean;
}

type ActiveTabType =
    | "instrument"
    | "project"
    | "run-project"
    | "home"
    | "history"
    | "shortcutsAndGroups"
    | "extensions"
    | "settings"
    | "notebooks"
    | undefined;

export interface IWindow {
    url: string;
    browserWindow: Electron.BrowserWindow;
    readyToClose: boolean;
    state: IWindowSate;
    focused: boolean;
    activeTabType: ActiveTabType;
}

export const windows = observable<IWindow>([]);

let forceQuit = false;

export function setForceQuit() {
    forceQuit = true;
}

export function createWindow(params: IWindowParams) {
    let windowUrl = params.url;
    if (!windowUrl.startsWith("file://")) {
        windowUrl = `file://${sourceRootDir()}/${windowUrl}`;
    }

    var windowContructorParams: Electron.BrowserWindowConstructorOptions = {
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            nodeIntegrationInWorker: true,
            plugins: true,
            contextIsolation: false,
            backgroundThrottling: false
        },
        show: false
    };

    const showHidden = params.showHidden === true;

    if (!showHidden) {
        settingsSetWindowBoundsIntoParams(params.url, windowContructorParams);

        windowContructorParams.icon = getIcon();
    }

    let browserWindow = new BrowserWindow(windowContructorParams);

    require("@electron/remote/main").enable(browserWindow.webContents);

    let window: IWindow | undefined;

    if (!showHidden) {
        if (!params.utilityWindow) {
            runInAction(() =>
                windows.push({
                    url: params.url,
                    browserWindow,
                    readyToClose: false,
                    state: {
                        modified: false,
                        undo: null,
                        redo: null,
                        isDebuggerActive: false,
                        hasExtensionDefinitions: false
                    },
                    focused: false,
                    activeTabType: undefined
                })
            );
            window = windows[windows.length - 1];

            settingsRegisterWindow(params.url, browserWindow);
        }
    }

    browserWindow.loadURL(windowUrl);

    if (!showHidden) {
        browserWindow.show();

        if (!params.utilityWindow) {
            browserWindow.on("close", function (event: any) {
                if (isCrashed(browserWindow)) {
                    app.exit();
                    return;
                }

                if (params.hideOnClose && windows.length > 1 && !forceQuit) {
                    browserWindow.hide();
                    event.preventDefault();
                    return;
                }

                if (!window?.readyToClose) {
                    try {
                        browserWindow.webContents.send("beforeClose");
                        event.preventDefault();
                    } catch (err) {}
                }
            });

            browserWindow.on("closed", function () {
                action(() =>
                    windows.splice(
                        windows.findIndex(
                            win => win.browserWindow === browserWindow
                        ),
                        1
                    )
                )();

                // if no visible window left, app can quit
                if (!windows.find(window => window.browserWindow.isVisible())) {
                    app.quit();
                }
            });
        }
    }

    return browserWindow;
}

export function findWindowByParams(params: IWindowParams) {
    return windows.find(win => win.url === params.url);
}

export function findWindowByBrowserWindow(browserWindow: Electron.BaseWindow) {
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

export function isCrashed(window: BrowserWindow) {
    return window.webContents.isCrashed();
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

ipcMain.on("reload", (event: any) => {
    const window = findWindowByWebContents(event.sender);
    if (window) {
        window.browserWindow.webContents.reload();
        window.browserWindow.webContents.clearHistory();
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
            isDebuggerActive: boolean;
            hasExtensionDefinitions: boolean;
        }
    ) => {
        const window = findWindowByWebContents(event.sender);
        if (window) {
            runInAction(() => {
                window.state = {
                    modified: state.modified,
                    undo: state.undo,
                    redo: state.redo,
                    isDebuggerActive: state.isDebuggerActive,
                    hasExtensionDefinitions: state.hasExtensionDefinitions
                };
            });
        }
    }
);

ipcMain.on("tabs-change", (event, tabs: { id: string; active: boolean }[]) => {
    const window = findWindowByWebContents(event.sender);
    if (window) {
        runInAction(() => {
            const activeTab = tabs.find(tab => tab.active);

            let activeTabType: ActiveTabType = undefined;
            if (activeTab) {
                if (activeTab.id.startsWith(PROJECT_TAB_ID_PREFIX)) {
                    activeTabType = "project";
                } else if (activeTab.id.startsWith(RUN_PROJECT_TAB_ID_PREFIX)) {
                    activeTabType = "run-project";
                } else if (Number.parseInt(activeTab.id) != undefined) {
                    activeTabType = "instrument";
                } else {
                    activeTabType = activeTab.id as ActiveTabType;
                }
            }

            window.activeTabType = activeTabType;
        });
    }
});

////////////////////////////////////////////////////////////////////////////////

ipcMain.on("printPDF", (event: any, { content, options }: any) => {
    const senderWindow = BrowserWindow.getFocusedWindow();
    if (!senderWindow) {
        return;
    }

    let printWindow: BrowserWindow;

    printWindow = createWindow({
        url: "home/print.html",
        showHidden: true,
        utilityWindow: true
    });

    printWindow.on("ready-to-show", () => {
        printWindow.webContents.send("printPDF", content);
    });

    ipcMain.once("readyToPrintPDF", async event => {
        const showSaveDialogPromise = dialog.showSaveDialog(senderWindow, {
            filters: [{ name: "PDF files", extensions: ["pdf"] }]
        });

        let data;
        try {
            // Use default printing options
            data = await printWindow.webContents.printToPDF(options);
        } catch (err) {
            await dialog.showMessageBox(senderWindow, {
                title: "Print to PDF - EEZ Studio",
                message: err.toString()
            });
        } finally {
            printWindow.close();
        }

        if (!data) {
            return;
        }

        const result = await showSaveDialogPromise;

        let filePath = result.filePath;
        if (filePath) {
            try {
                await fs.promises.writeFile(filePath, data);
                shell.openPath(filePath);
            } catch (err) {
                await dialog.showMessageBox(senderWindow, {
                    title: "Print to PDF - EEZ Studio",
                    message: err.toString()
                });
            }
        }
    });
});
