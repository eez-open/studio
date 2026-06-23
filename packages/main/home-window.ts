import { openWindow, findWindowByParams, IWindowParams } from "main/window";

export const HOME_WINDOW_URL = "home/index.html";

const HOME_WINDOW_PARAMS: IWindowParams = {
    url: HOME_WINDOW_URL,
    hideOnClose: true
};

export function openHomeWindow(params?: Partial<IWindowParams>) {
    return openWindow(Object.assign(HOME_WINDOW_PARAMS, params));
}

export function bringHomeWindowToFocus() {
    let homeWindow = findWindowByParams(HOME_WINDOW_PARAMS);
    if (homeWindow) {
        homeWindow.browserWindow.show();
    } else {
        openHomeWindow();
    }
}

export function reloadProject() {
    let homeWindow = findWindowByParams(HOME_WINDOW_PARAMS);
    console.log("[reload-project] homeWindow found:", !!homeWindow);
    if (homeWindow) {
        console.log("[reload-project] sending IPC reload-project to renderer");
        homeWindow.browserWindow.webContents.send("reload-project");
    }
}

export function importInstrumentDefinitionFile(filePath: string) {
    let homeWindow = findWindowByParams(HOME_WINDOW_PARAMS);
    if (homeWindow) {
        homeWindow.browserWindow.webContents.send(
            "importInstrumentDefinitionFile",
            filePath
        );
    }
}
