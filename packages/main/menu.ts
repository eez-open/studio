import os from "os";
import fs from "fs";
import {
    app,
    dialog,
    Menu,
    ipcMain,
    BrowserWindow,
    BaseWindow
} from "electron";
import { autorun, runInAction } from "mobx";

import {
    importInstrumentDefinitionFile,
    openHomeWindow
} from "main/home-window";
import {
    IWindow,
    setForceQuit,
    windows,
    findWindowByBrowserWindow,
    isCrashed
} from "main/window";
import { settings } from "main/settings";
import { APP_NAME } from "main/util";
import { undoManager } from "eez-studio-shared/store";
import { isDev } from "eez-studio-shared/util-electron";

////////////////////////////////////////////////////////////////////////////////

function showAboutBox(item: any, focusedWindow: any) {
    if (focusedWindow) {
        focusedWindow.webContents.send("show-about-box");
    }
}

function isMacOs() {
    return os.platform() === "darwin";
}

function enableMenuItem(
    menuItems: Electron.MenuItemConstructorOptions[],
    id: string,
    enabled: boolean
) {
    for (let i = 0; i < menuItems.length; i++) {
        if (menuItems[i].id === id) {
            menuItems[i].enabled = enabled;
            return;
        }
    }
}

async function openProjectWithFileDialog(focusedWindow: BaseWindow) {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            { name: "EEZ Project", extensions: ["eez-project"] },
            {
                name: "EEZ Dashboard",
                extensions: ["eez-dashboard"]
            },
            { name: "All Files", extensions: ["*"] }
        ]
    });
    const filePaths = result.filePaths;
    if (filePaths && filePaths[0]) {
        openFile(filePaths[0], focusedWindow, false);
    }
}

export function openFile(
    filePath: string,
    focusedWindow?: any,
    runMode?: boolean
) {
    if (
        filePath.toLowerCase().endsWith(".eez-project") ||
        filePath.toLowerCase().endsWith(".eez-dashboard")
    ) {
        if (!focusedWindow) {
            focusedWindow = BrowserWindow.getFocusedWindow() || undefined;
        }

        if (focusedWindow) {
            focusedWindow.webContents.send("open-project", filePath, runMode);
        }
    }
}

export function loadDebugInfo(debugInfoFilePath: string, focusedWindow?: any) {
    if (!focusedWindow) {
        focusedWindow = BrowserWindow.getFocusedWindow();
    }

    if (focusedWindow) {
        focusedWindow.webContents.send("load-debug-info", debugInfoFilePath);
    }
}

export function saveDebugInfo(focusedWindow?: any) {
    if (!focusedWindow) {
        focusedWindow = BrowserWindow.getFocusedWindow();
    }

    if (focusedWindow) {
        focusedWindow.webContents.send("save-debug-info");
    }
}

function createNewProject() {
    BrowserWindow.getFocusedWindow()!.webContents.send("new-project");
}

function addInstrument() {
    BrowserWindow.getFocusedWindow()!.webContents.send("add-instrument");
}

////////////////////////////////////////////////////////////////////////////////

function buildMacOSAppMenu(
    win: IWindow | undefined
): Electron.MenuItemConstructorOptions {
    return {
        label: APP_NAME,
        submenu: [
            {
                label: "About " + APP_NAME,
                click: showAboutBox
            },
            {
                type: "separator"
            },
            {
                label: "Services",
                role: "services",
                submenu: []
            },
            {
                type: "separator"
            },
            {
                label: "Hide " + APP_NAME,
                accelerator: "Command+H",
                role: "hide"
            },
            {
                label: "Hide Others",
                accelerator: "Command+Alt+H",
                role: "hideOthers"
            },
            {
                label: "Show All",
                role: "unhide"
            },
            {
                type: "separator"
            },
            {
                label: "Quit",
                accelerator: "Command+Q",
                click: function () {
                    setForceQuit();
                    app.quit();
                }
            }
        ]
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildFileMenu(win: IWindow | undefined) {
    const fileMenuSubmenu: Electron.MenuItemConstructorOptions[] = [];

    fileMenuSubmenu.push(
        {
            label: "New Project...",
            accelerator: "CmdOrCtrl+N",
            click: function (item, focusedWindow) {
                createNewProject();
            }
        },
        {
            label: "Add Instrument...",
            accelerator: "CmdOrCtrl+Alt+N",
            click: function (item, focusedWindow) {
                addInstrument();
            }
        },
        {
            label: "New Window",
            accelerator: "CmdOrCtrl+Shift+N",
            click: function (item, focusedWindow) {
                openHomeWindow();
            }
        },
        {
            type: "separator"
        },
        {
            label: "Open...",
            accelerator: "CmdOrCtrl+O",
            click: (item, focusedWindow) => {
                if (!focusedWindow) {
                    focusedWindow =
                        BrowserWindow.getFocusedWindow() || undefined;
                }

                if (focusedWindow) {
                    openProjectWithFileDialog(focusedWindow);
                }
            }
        },
        {
            label: "Open Recent",
            submenu: settings.mru.map(mru => ({
                label: mru.filePath,
                click: function () {
                    if (fs.existsSync(mru.filePath)) {
                        openFile(mru.filePath);
                    } else {
                        // file not found, remove from mru
                        var i = settings.mru.indexOf(mru);
                        if (i != -1) {
                            runInAction(() => {
                                settings.mru.splice(i, 1);
                            });
                        }

                        // notify user
                        dialog.showMessageBox(
                            BrowserWindow.getFocusedWindow()!,
                            {
                                type: "error",
                                title: "EEZ Studio",
                                message: "File does not exist.",
                                detail: `The file '${mru.filePath}' does not seem to exist anymore.`
                            }
                        );
                    }
                }
            }))
        }
    );

    if (
        win?.activeTabType === "project" ||
        win?.activeTabType === "run-project"
    ) {
        fileMenuSubmenu.push(
            {
                type: "separator"
            },
            {
                label: "Reload Project",
                click: function (item: any, focusedWindow: any) {
                    focusedWindow.webContents.send("reload-project");
                }
            }
        );

        fileMenuSubmenu.push(
            {
                type: "separator"
            },
            {
                label: "Load Debug Info...",
                click: async function (item: any, focusedWindow: any) {
                    const result = await dialog.showOpenDialog({
                        properties: ["openFile"],
                        filters: [
                            {
                                name: "EEZ Debug Info",
                                extensions: ["eez-debug-info"]
                            },
                            {
                                name: "EEZ Debug Info",
                                extensions: ["eez-debug-info"]
                            },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    });
                    const filePaths = result.filePaths;
                    if (filePaths && filePaths[0]) {
                        loadDebugInfo(filePaths[0], focusedWindow);
                    }
                }
            }
        );

        if (win.state.isDebuggerActive) {
            fileMenuSubmenu.push({
                label: "Save Debug Info...",
                click: function (item: any, focusedWindow: any) {
                    saveDebugInfo(focusedWindow);
                }
            });
        }
    }

    fileMenuSubmenu.push(
        {
            type: "separator"
        },
        {
            label: "Import Instrument Definition...",
            click: async function (item: any, focusedWindow: any) {
                const result = await dialog.showOpenDialog({
                    properties: ["openFile"],
                    filters: [
                        {
                            name: "Instrument Definition Files",
                            extensions: ["zip"]
                        },
                        { name: "All Files", extensions: ["*"] }
                    ]
                });
                const filePaths = result.filePaths;
                if (filePaths && filePaths[0]) {
                    importInstrumentDefinitionFile(filePaths[0]);
                }
            }
        }
    );

    if (win?.activeTabType === "project") {
        fileMenuSubmenu.push(
            {
                type: "separator"
            },
            {
                id: "save",
                label: "Save",
                accelerator: "CmdOrCtrl+S",
                click: function (item: any, focusedWindow: any) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("save");
                    }
                }
            },
            {
                label: "Save As",
                accelerator: "CmdOrCtrl+Shift+S",
                click: function (item: any, focusedWindow: any) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("saveAs");
                    }
                }
            },

            {
                type: "separator"
            },
            {
                label: "Check",
                accelerator: "CmdOrCtrl+K",
                click: function (item: any, focusedWindow: any) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("check");
                    }
                }
            },
            {
                label: "Build",
                accelerator: "CmdOrCtrl+B",
                click: function (item: any, focusedWindow: any) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("build");
                    }
                }
            }
        );

        if (win.state.hasExtensionDefinitions) {
            fileMenuSubmenu.push(
                {
                    label: "Build Extensions",
                    click: function (item: any, focusedWindow: any) {
                        if (focusedWindow) {
                            focusedWindow.webContents.send("build-extensions");
                        }
                    }
                },
                {
                    label: "Build and Install Extensions",
                    click: function (item: any, focusedWindow: any) {
                        if (focusedWindow) {
                            focusedWindow.webContents.send(
                                "build-and-install-extensions"
                            );
                        }
                    }
                }
            );
        }
    } else if (win?.activeTabType === "instrument") {
        fileMenuSubmenu.push(
            {
                type: "separator"
            },
            {
                id: "save",
                label: "Save",
                accelerator: "CmdOrCtrl+S",
                click: function (item: any, focusedWindow: any) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("save");
                    }
                }
            }
        );
    }

    let count = BrowserWindow.getAllWindows().filter(b => {
        return b.isVisible();
    }).length;
    if (count > 1) {
        fileMenuSubmenu.push(
            {
                type: "separator"
            },
            {
                label: "Close Window",
                accelerator: "CmdOrCtrl+W",
                click: function (item: any, focusedWindow: any) {
                    if (focusedWindow) {
                        if (isCrashed(focusedWindow)) {
                            app.exit();
                        } else {
                            focusedWindow.webContents.send("beforeClose");
                        }
                    }
                }
            }
        );
    }

    if (!isMacOs()) {
        fileMenuSubmenu.push(
            {
                type: "separator"
            },
            {
                label: "Exit",
                click: function (item: any, focusedWindow: any) {
                    if (isCrashed(focusedWindow)) {
                        app.exit();
                    } else {
                        setForceQuit();
                        app.quit();
                    }
                }
            }
        );
    }

    return {
        label: "File",
        submenu: fileMenuSubmenu
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildEditMenu(win: IWindow | undefined) {
    const editMenu: Electron.MenuItemConstructorOptions = {
        label: "Edit",
        submenu: [
            {
                id: "undo",
                label: "Undo",
                accelerator: "CmdOrCtrl+Z",
                role: isMacOs() ? "undo" : undefined,
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        const win = findWindowByBrowserWindow(focusedWindow);
                        if (win !== undefined && win.state.undo != null) {
                            win.browserWindow.webContents.send("undo");
                            return;
                        }
                    }

                    undoManager.undo();
                }
            },
            {
                id: "redo",
                label: "Redo",
                accelerator: "CmdOrCtrl+Y",
                role: isMacOs() ? "redo" : undefined,
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        const win = findWindowByBrowserWindow(focusedWindow);
                        if (win !== undefined && win.state.redo != null) {
                            win.browserWindow.webContents.send("redo");
                            return;
                        }
                    }

                    undoManager.redo();
                }
            },
            {
                type: "separator"
            },
            {
                label: "Cut",
                accelerator: "CmdOrCtrl+X",
                role: isMacOs() ? "cut" : undefined,
                click: function (item) {
                    if (win) {
                        win.browserWindow.webContents.send("cut");
                    }
                }
            },
            {
                label: "Copy",
                accelerator: "CmdOrCtrl+C",
                role: isMacOs() ? "copy" : undefined,
                click: function (item) {
                    if (win) {
                        win.browserWindow.webContents.send("copy");
                    }
                }
            },
            {
                label: "Paste",
                accelerator: "CmdOrCtrl+V",
                role: isMacOs() ? "paste" : undefined,
                click: function (item) {
                    if (win) {
                        win.browserWindow.webContents.send("paste");
                    }
                }
            },
            {
                label: "Delete",
                accelerator: "Delete",
                role: isMacOs() ? "delete" : undefined,
                click: function (item) {
                    if (win) {
                        win.browserWindow.webContents.send("delete");
                    }
                }
            },
            {
                type: "separator"
            },
            {
                label: "Select All",
                accelerator: isMacOs() ? "CmdOrCtrl+A" : undefined,
                role: isMacOs() ? "selectAll" : undefined,
                click: function (item) {
                    if (win) {
                        win.browserWindow.webContents.send("select-all");
                    }
                }
            }
        ]
    };

    enableMenuItem(
        <Electron.MenuItemConstructorOptions[]>editMenu.submenu,
        "undo",
        win !== undefined && win.state.undo != null
            ? !!win.state.undo
            : undoManager.canUndo
    );

    enableMenuItem(
        <Electron.MenuItemConstructorOptions[]>editMenu.submenu,
        "redo",
        win !== undefined && win.state.redo != null
            ? !!win.state.redo
            : undoManager.canRedo
    );

    return editMenu;
}

////////////////////////////////////////////////////////////////////////////////

function buildViewMenu(win: IWindow | undefined) {
    let viewSubmenu: Electron.MenuItemConstructorOptions[] = [];

    viewSubmenu.push(
        {
            label: "Home",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send("openTab", "home");
                }
            }
        },
        {
            label: "History",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send("openTab", "history");
                }
            }
        },
        {
            label: "Shortcuts and Groups",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send(
                        "openTab",
                        "shortcutsAndGroups"
                    );
                }
            }
        },
        {
            label: "Noteboooks",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send(
                        "openTab",
                        "homeSection_notebooks"
                    );
                }
            }
        },
        {
            label: "Extensions",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send("openTab", "extensions");
                }
            }
        },
        {
            label: "Settings",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send("openTab", "settings");
                }
            }
        },
        {
            type: "separator"
        },
        {
            label: "Scrapbook for Project Editor",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send("showScrapbookManager");
                }
            }
        },
        {
            type: "separator"
        }
    );

    viewSubmenu.push(
        {
            label: "Toggle Full Screen",
            accelerator: (function () {
                if (isMacOs()) {
                    return "Ctrl+Command+F";
                } else {
                    return "F11";
                }
            })(),
            click: function (item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                }
            }
        },
        {
            label: "Toggle Developer Tools",
            accelerator: (function () {
                if (isMacOs()) {
                    return "Alt+Command+I";
                } else {
                    return "Ctrl+Shift+I";
                }
            })(),
            click: function (item, focusedWindow: any) {
                if (focusedWindow) {
                    focusedWindow.toggleDevTools();
                }
            }
        },
        {
            label: settings.isDarkTheme
                ? "Switch to Light Theme"
                : "Switch to Dark Theme",
            accelerator: (function () {
                if (isMacOs()) {
                    return "Alt+Command+T";
                } else {
                    return "Ctrl+Shift+T";
                }
            })(),
            click: function (item, focusedWindow: any) {
                if (focusedWindow) {
                    focusedWindow.webContents.send("switch-theme");
                }
            }
        },
        {
            type: "separator"
        },
        {
            label: "Zoom In",
            role: "zoomIn"
        },
        {
            label: "Zoom Out",
            role: "zoomOut"
        },
        {
            label: "Reset Zoom",
            role: "resetZoom"
        },
        {
            type: "separator"
        }
    );

    if (win?.activeTabType === "project") {
        viewSubmenu.push({
            type: "separator"
        });

        viewSubmenu.push({
            label: "Reset Layout",
            click: function (item) {
                if (win) {
                    win.browserWindow.webContents.send("resetLayoutModels");
                }
            }
        });

        viewSubmenu.push({
            type: "separator"
        });
    }

    viewSubmenu.push({
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click: function (item) {
            if (win) {
                win.browserWindow.webContents.send("reload");
                //focusedWindow.webContents.reload();
                //focusedWindow.webContents.clearHistory();
            }
        }
    });

    return {
        label: "View",
        submenu: viewSubmenu
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildMacOSWindowMenu(
    win: IWindow | undefined
): Electron.MenuItemConstructorOptions {
    return {
        label: "Window",
        role: "window",
        submenu: [
            {
                label: "Minimize",
                accelerator: "CmdOrCtrl+M",
                role: "minimize"
            },
            {
                label: "Close",
                accelerator: "CmdOrCtrl+W",
                role: "close"
            },
            {
                type: "separator"
            },
            {
                label: "Bring All to Front",
                role: "front"
            }
        ]
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildHelpMenu(
    win: IWindow | undefined
): Electron.MenuItemConstructorOptions {
    const helpMenuSubmenu: Electron.MenuItemConstructorOptions[] = [];

    if (isDev) {
        helpMenuSubmenu.push({
            label: "Documentation",
            accelerator: "F1",
            click: function (item: any, focusedWindow: any) {
                focusedWindow.webContents.send("show-documentation-browser");
            }
        });
        helpMenuSubmenu.push({
            type: "separator"
        });
    }

    helpMenuSubmenu.push({
        label: "About",
        click: showAboutBox
    });

    return {
        label: "Help",
        role: "help",
        submenu: helpMenuSubmenu
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildMenuTemplate(win: IWindow | undefined) {
    var menuTemplate: Electron.MenuItemConstructorOptions[] = [];

    if (isMacOs()) {
        menuTemplate.push(buildMacOSAppMenu(win));
    }

    menuTemplate.push(buildFileMenu(win));

    menuTemplate.push(buildEditMenu(win));

    menuTemplate.push(buildViewMenu(win));

    if (isMacOs()) {
        menuTemplate.push(buildMacOSWindowMenu(win));
    } else {
        menuTemplate.push(buildHelpMenu(win));
    }

    return menuTemplate;
}

////////////////////////////////////////////////////////////////////////////////

autorun(() => {
    for (let i = 0; i < windows.length; i++) {
        const win = windows[i];
        if (win.focused) {
            let menuTemplate = buildMenuTemplate(win);
            let menu = Menu.buildFromTemplate(menuTemplate);
            Menu.setApplicationMenu(menu);
        }
    }
});

////////////////////////////////////////////////////////////////////////////////

ipcMain.on("getReservedKeybindings", function (event: any) {
    const menuTemplate = buildMenuTemplate(undefined);

    let keybindings: string[] = [];

    function addKeybinding(accelerator: Electron.Accelerator) {
        let keybinding = accelerator.toString();

        if (isMacOs()) {
            keybinding = keybinding.replace("CmdOrCtrl", "Meta");
            keybinding = keybinding.replace("CommandOrControl", "Meta");
        } else {
            keybinding = keybinding.replace("CmdOrCtrl", "Ctrl");
            keybinding = keybinding.replace("CommandOrControl", "Ctrl");
        }

        keybindings.push(keybinding);
    }

    function addKeybindings(menu: Electron.MenuItemConstructorOptions[]) {
        for (let i = 0; i < menu.length; i++) {
            const menuItem = menu[i];
            if (menuItem.accelerator) {
                addKeybinding(menuItem.accelerator);
            }
            if (menuItem.submenu && "length" in menuItem.submenu) {
                addKeybindings(
                    menuItem.submenu as Electron.MenuItemConstructorOptions[]
                );
            }
        }
    }

    addKeybindings(menuTemplate);

    event.returnValue = keybindings;
});

ipcMain.on("open-file", function (event, path, runMode) {
    openFile(path, undefined, runMode);
});

ipcMain.on("new-project", function (event) {
    createNewProject();
});

ipcMain.on("open-project", function (event) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        openProjectWithFileDialog(focusedWindow);
    }
});
