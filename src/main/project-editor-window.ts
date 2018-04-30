import { BrowserWindow } from "electron";

import {
    IWindowParams,
    findWindowByParams,
    findWindowByWebContents,
    createWindow
} from "main/window";

export const PROJECT_WINDOW_URL = "project-editor/index.html";
export const PROJECT_FILE_PATH_PARAM = "?open=";

export function createNewProjectWindow() {
    createWindow({
        url: PROJECT_WINDOW_URL + "?new"
    });
}

export function openFile(filePath: string) {
    let params: IWindowParams = {
        url: PROJECT_WINDOW_URL + PROJECT_FILE_PATH_PARAM + encodeURIComponent(filePath)
    };

    var window = findWindowByParams(params);
    if (window) {
        window.browserWindow.focus();
    } else {
        let focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
            window = findWindowByWebContents(focusedWindow.webContents);
        }

        createWindow(params);
    }
}
