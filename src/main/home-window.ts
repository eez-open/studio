import { openWindow, findWindowByParams } from "main/window";

const HOME_WINDOW_PARAMS = {
    url: "home/index.html",
    hideOnClose: true
};

export function openHomeWindow() {
    openWindow(HOME_WINDOW_PARAMS);
}

export function bringHomeWindowToFocus() {
    let homeWindow = findWindowByParams(HOME_WINDOW_PARAMS);
    if (homeWindow) {
        homeWindow.browserWindow.show();
    } else {
        openHomeWindow();
    }
}

export function importInstrumentDefinitionFile(filePath: string) {
    let homeWindow = findWindowByParams(HOME_WINDOW_PARAMS);
    if (homeWindow) {
        homeWindow.browserWindow.webContents.send("importInstrumentDefinitionFile", filePath);
    }
}
