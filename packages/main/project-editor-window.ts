import { findWindowByParams, createWindow } from "main/window";
import { PROJECT_WINDOW_URL, getProjectWindowParams } from "main/project-editor-window-params";

export function createNewProjectWindow() {
    createWindow({
        url: PROJECT_WINDOW_URL + "?new"
    });
}

export function openFile(filePath: string) {
    let params = getProjectWindowParams(filePath);

    var window = findWindowByParams(params);
    if (window) {
        window.browserWindow.focus();
    } else {
        createWindow(params);
    }
}
