import * as fs from "fs";
import * as path from "path";
import { BrowserWindow, ipcMain, Event, WebContents } from "electron";

import * as ExtensionsModule from "shared/extensions/extensions";
import { IExtension } from "shared/extensions/extension";

import { isDev, getUserDataPath, makeFolder, copyFile, delay } from "shared/util";
import { DEFAULT_DB_NAME, EXTENSIONS_FOLDER_NAME } from "shared/conf";

async function setupExtensions(
    webContents: WebContents,
    resourcesPath: string,
    extensionsFolderPath: string
) {
    webContents.send("setupMessage", "Making extensions folder");
    await makeFolder(extensionsFolderPath);
    await delay(500);

    const fileList: string[] = [];

    fs.readdirSync(resourcesPath).forEach(fileName => {
        const filePath = resourcesPath + "/" + fileName;
        if (filePath.toLowerCase().endsWith(".zip")) {
            fileList.push(filePath);
        }
    });

    webContents.send("setupMessage", `Installing ${fileList.length} extensions`);

    const { installExtension } = require("shared/extensions/extensions") as typeof ExtensionsModule;

    for (let i = 0; i < fileList.length; i++) {
        const filePath = fileList[i];

        const fileName = path.basename(filePath);

        webContents.send("setupMessage", `Installing extension ${fileName}`);

        try {
            const extension = await installExtension(filePath, {
                checkExtensionType(type: string) {
                    return true;
                },
                notFound() {},
                async confirmReplaceNewerVersion(
                    newExtension: IExtension,
                    existingExtension: IExtension
                ) {
                    return true;
                },
                async confirmReplaceOlderVersion(
                    newExtension: IExtension,
                    existingExtension: IExtension
                ) {
                    return true;
                },
                async confirmReplaceTheSameVersion(
                    newExtension: IExtension,
                    existingExtension: IExtension
                ) {
                    return true;
                }
            });
            if (!extension) {
                webContents.send("setupMessage", {
                    error: `Failed to install ${fileName}`
                });
                await delay(1000);
            }
        } catch (err) {
            webContents.send("setupMessage", {
                error: `Failed to install ${fileName} (${err.toString()})`
            });
            await delay(1000);
        }
    }
}

async function setupDatabase(webContents: WebContents, resourcesPath: string, dbFilePath: string) {
    webContents.send("setupMessage", "Installing database");
    await copyFile(resourcesPath + "/init_storage.db", dbFilePath);
    await delay(500);
}

function isAnySetupRequired() {
    const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);
    if (!fs.existsSync(extensionsFolderPath)) {
        return true;
    }

    const dbFilePath = getUserDataPath(DEFAULT_DB_NAME);
    if (!fs.existsSync(dbFilePath)) {
        return true;
    }

    return false;
}

async function doSetup(webContents: WebContents) {
    const resourcesPath = process.resourcesPath!;

    const dbFilePath = getUserDataPath(DEFAULT_DB_NAME);
    if (!fs.existsSync(dbFilePath)) {
        await setupDatabase(webContents, resourcesPath, dbFilePath);
    }

    // database is ready, we can now load extensions
    const { loadExtensions } = require("shared/extensions/extensions") as typeof ExtensionsModule;
    loadExtensions();

    const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);
    if (!fs.existsSync(extensionsFolderPath)) {
        await setupExtensions(webContents, resourcesPath, extensionsFolderPath);
    }
}

export async function setup() {
    return new Promise(resolve => {
        if (isDev || !isAnySetupRequired()) {
            const {
                loadExtensions
            } = require("shared/extensions/extensions") as typeof ExtensionsModule;
            loadExtensions();

            resolve();
            return;
        }

        let win = new BrowserWindow({
            width: 600,
            height: 200,
            backgroundColor: "#333",
            show: false
        });

        win.setMenu(null);
        win.loadURL(`file://${__dirname}/../setup/setup.html`);

        win.show();

        ipcMain.on("startSetup", async (event: Event) => {
            await doSetup(event.sender);
            win.close();
            resolve();
        });
    });
}
