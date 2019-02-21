import os from "os";
import fs from "fs";
import { app, dialog, Menu, ipcMain, BrowserWindow } from "electron";
import { autorun, runInAction } from "mobx";

import { importInstrumentDefinitionFile } from "main/home-window";
import { createNewProjectWindow, openFile } from "main/project-editor-window";
import {
    openWindow,
    IWindow,
    setForceQuit,
    windows,
    WindowType,
    getWindowType,
    findWindowByBrowserWindow
} from "main/window";
import { settings } from "main/settings";
import { APP_NAME } from "main/util";
import showAboutBox from "main/about-box";
import { undoManager } from "eez-studio-shared/store";

////////////////////////////////////////////////////////////////////////////////

const darwinAppMenu: Electron.MenuItemConstructorOptions = {
    label: APP_NAME,
    submenu: [
        {
            label: "About " + APP_NAME,
            role: "about",
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
            role: "hideothers"
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
            click: function() {
                setForceQuit();
                app.quit();
            }
        }
    ]
};

////////////////////////////////////////////////////////////////////////////////

let fileRecentSubmenu: Electron.MenuItemConstructorOptions = {
    label: "Open Recent",
    submenu: []
};

const fileMenuSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
        label: "New Project",
        accelerator: "CmdOrCtrl+N",
        click: function(item, focusedWindow) {
            createNewProjectWindow();
        }
    },
    {
        type: "separator"
    },
    {
        label: "Open...",
        accelerator: "CmdOrCtrl+O",
        click: function(item: any, focusedWindow: any) {
            dialog.showOpenDialog(
                {
                    properties: ["openFile"],
                    filters: [
                        { name: "EEZ Project", extensions: ["eez-project"] },
                        { name: "All Files", extensions: ["*"] }
                    ]
                },
                function(filePaths) {
                    if (filePaths && filePaths[0]) {
                        openFile(filePaths[0]);
                    }
                }
            );
        }
    },
    fileRecentSubmenu,
    {
        type: "separator"
    },
    {
        id: "save",
        label: "Save",
        accelerator: "CmdOrCtrl+S",
        click: function(item: any, focusedWindow: any) {
            if (focusedWindow) {
                focusedWindow.webContents.send("save");
            }
        }
    },
    {
        label: "Save As",
        accelerator: "CmdOrCtrl+Shift+S",
        click: function(item: any, focusedWindow: any) {
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
        click: function(item: any, focusedWindow: any) {
            if (focusedWindow) {
                focusedWindow.webContents.send("check");
            }
        }
    },
    {
        label: "Build",
        accelerator: "CmdOrCtrl+B",
        click: function(item: any, focusedWindow: any) {
            if (focusedWindow) {
                focusedWindow.webContents.send("build");
            }
        }
    },
    {
        type: "separator"
    },
    {
        label: "Close Window",
        accelerator: "CmdOrCtrl+W",
        click: function(item: any, focusedWindow: any) {
            if (focusedWindow) {
                focusedWindow.webContents.send("beforeClose");
            }
        }
    }
];

if (os.platform() != "darwin") {
    fileMenuSubmenu.push(
        {
            type: "separator"
        },
        {
            label: "Exit",
            click: function(item: any, focusedWindow: any) {
                setForceQuit();
                app.quit();
            }
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

function insertBefore(
    newMenuItems: Electron.MenuItemConstructorOptions[],
    referenceMenuItems: Electron.MenuItemConstructorOptions[],
    id: string
) {
    for (let i = 0; i < referenceMenuItems.length; i++) {
        if (referenceMenuItems[i].id === id) {
            return referenceMenuItems
                .slice(0, i)
                .concat(newMenuItems)
                .concat(referenceMenuItems.slice(i));
        }
    }

    return newMenuItems.concat(referenceMenuItems);
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

////////////////////////////////////////////////////////////////////////////////

const fileMenu: Electron.MenuItemConstructorOptions = {
    label: "File",
    submenu: fileMenuSubmenu
};

const homeFileMenu: Electron.MenuItemConstructorOptions = {
    label: "File",
    submenu: insertBefore(
        [
            {
                label: "Import Instrument Definition...",
                click: function(item: any, focusedWindow: any) {
                    dialog.showOpenDialog(
                        {
                            properties: ["openFile"],
                            filters: [
                                { name: "Instrument Definition Files", extensions: ["zip"] },
                                { name: "All Files", extensions: ["*"] }
                            ]
                        },
                        function(filePaths) {
                            if (filePaths && filePaths[0]) {
                                importInstrumentDefinitionFile(filePaths[0]);
                            }
                        }
                    );
                }
            },
            {
                type: "separator"
            }
        ],
        fileMenuSubmenu,
        "save"
    )
};

////////////////////////////////////////////////////////////////////////////////

const editMenu: Electron.MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
        {
            id: "undo",
            label: "Undo",
            accelerator: "CmdOrCtrl+Z",
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    const win = findWindowByBrowserWindow(focusedWindow);
                    if (win !== undefined && win.state.undo != null) {
                        focusedWindow.webContents.send("undo");
                        return;
                    }
                }

                undoManager.undo();
            }
        },
        {
            id: "redo",
            label: "Redo",
            accelerator: "Shift+CmdOrCtrl+Z",
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    const win = findWindowByBrowserWindow(focusedWindow);
                    if (win !== undefined && win.state.redo != null) {
                        focusedWindow.webContents.send("redo");
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
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send("cut");
                }
            }
        },
        {
            label: "Copy",
            accelerator: "CmdOrCtrl+C",
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send("copy");
                }
            }
        },
        {
            label: "Paste",
            accelerator: "CmdOrCtrl+V",
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send("paste");
                }
            }
        },
        {
            label: "Delete",
            accelerator: "Delete",
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send("delete");
                }
            }
        },
        {
            type: "separator"
        },
        {
            label: "Select All",
            accelerator: "CmdOrCtrl+A"
        }
    ]
};

////////////////////////////////////////////////////////////////////////////////

const darwinWindowMenu: Electron.MenuItemConstructorOptions = {
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

////////////////////////////////////////////////////////////////////////////////

const helpMenu: Electron.MenuItemConstructorOptions = {
    label: "Help",
    role: "help",
    submenu: [
        {
            label: "About",
            role: "about",
            click: showAboutBox
        }
    ]
};

////////////////////////////////////////////////////////////////////////////////

function buildFileMenu(windowType: WindowType) {
    fileRecentSubmenu.submenu = settings.mru.map(mru => ({
        label: mru.filePath,
        click: function() {
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
                dialog.showMessageBox(BrowserWindow.getFocusedWindow()!, {
                    type: "error",
                    title: "EEZ Studio",
                    message: "File does not exist.",
                    detail: `The file '${mru.filePath}' does not seem to exist anymore.`
                });
            }
        }
    }));

    if (windowType === "home") {
        return homeFileMenu;
    } else {
        return fileMenu;
    }
}

////////////////////////////////////////////////////////////////////////////////

function buildEditMenu(windowType: WindowType, win: IWindow | undefined) {
    enableMenuItem(
        <Electron.MenuItemConstructorOptions[]>editMenu.submenu,
        "undo",
        win !== undefined && win.state.undo != null ? !!win.state.undo : undoManager.canUndo
    );

    enableMenuItem(
        <Electron.MenuItemConstructorOptions[]>editMenu.submenu,
        "redo",
        win !== undefined && win.state.redo != null ? !!win.state.redo : undoManager.canRedo
    );

    return editMenu;
}

////////////////////////////////////////////////////////////////////////////////

function buildViewMenu(windowType: WindowType) {
    let viewSubmenu: Electron.MenuItemConstructorOptions[] = [];

    if (windowType !== "home") {
        viewSubmenu.push(
            {
                label: "Home",
                accelerator: "Ctrl+Shift+H",
                click: function() {
                    openWindow({ url: "home/index.html" });
                }
            },
            {
                type: "separator"
            }
        );
    }

    if (windowType === "project") {
        viewSubmenu.push(
            {
                label: "Navigation",
                accelerator: "Ctrl+Shift+N",
                click: function(item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("toggleNavigation");
                    }
                }
            },
            {
                label: "Output",
                accelerator: "Ctrl+Shift+O",
                click: function(item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("toggleOutput");
                    }
                }
            },
            {
                label: "Properties",
                accelerator: "Ctrl+Shift+P",
                click: function(item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("toggleProperties");
                    }
                }
            },
            {
                label: "Debug",
                click: function(item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("toggleDebug");
                    }
                }
            },
            {
                type: "separator"
            }
        );
    }

    viewSubmenu.push(
        {
            label: "Reload",
            accelerator: "CmdOrCtrl+R",
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.webContents.send("reload");
                }
            }
        },
        {
            label: "Toggle Full Screen",
            accelerator: (function() {
                if (os.platform() == "darwin") {
                    return "Ctrl+Command+F";
                } else {
                    return "F11";
                }
            })(),
            click: function(item, focusedWindow) {
                if (focusedWindow) {
                    focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                }
            }
        },
        {
            label: "Toggle Developer Tools",
            accelerator: (function() {
                if (os.platform() == "darwin") {
                    return "Alt+Command+I";
                } else {
                    return "Ctrl+Shift+I";
                }
            })(),
            click: function(item, focusedWindow: any) {
                if (focusedWindow) {
                    focusedWindow.toggleDevTools();
                }
            }
        },
        {
            type: "separator"
        },
        {
            label: "Test",
            click: function() {
                openWindow({ url: "test/index.html" });
            }
        },
        {
            type: "separator"
        },
        {
            label: "Zoom In",
            role: "zoomin"
        },
        {
            label: "Zoom Out",
            role: "zoomout"
        },
        {
            label: "Reset Zoom",
            role: "resetzoom"
        }
    );

    if (windowType === "project") {
        viewSubmenu.push(
            {
                type: "separator"
            },
            {
                label: "Project Metrics...",
                click: function(item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.webContents.send("showProjectMetrics");
                    }
                }
            }
        );
    }

    return {
        label: "View",
        submenu: viewSubmenu
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildMenuTemplate(windowType: WindowType, win: IWindow | undefined) {
    var menuTemplate: Electron.MenuItemConstructorOptions[] = [];

    if (os.platform() === "darwin") {
        menuTemplate.push(darwinAppMenu);
    }

    menuTemplate.push(buildFileMenu(windowType));

    menuTemplate.push(buildEditMenu(windowType, win));

    menuTemplate.push(buildViewMenu(windowType));

    if (os.platform() == "darwin") {
        menuTemplate.push(darwinWindowMenu);
    } else {
        menuTemplate.push(helpMenu);
    }

    return menuTemplate;
}

////////////////////////////////////////////////////////////////////////////////

autorun(() => {
    for (let i = 0; i < windows.length; i++) {
        const win = windows[i];
        if (win.focused) {
            const windowType = getWindowType(win);
            let menuTemplate = buildMenuTemplate(windowType, win);
            let menu = Menu.buildFromTemplate(menuTemplate);
            Menu.setApplicationMenu(menu);
        }
    }
});

ipcMain.on("getReservedKeybindings", function(event: any) {
    const menuTemplate = buildMenuTemplate("instrument", undefined);

    let keybindings: string[] = [];

    function addKeybinding(accelerator: Electron.Accelerator) {
        console.log(accelerator);
        let keybinding = accelerator.toString();

        if (os.platform() === "darwin") {
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
                addKeybindings(menuItem.submenu as Electron.MenuItemConstructorOptions[]);
            }
        }
    }

    addKeybindings(menuTemplate);

    event.returnValue = keybindings;
});
