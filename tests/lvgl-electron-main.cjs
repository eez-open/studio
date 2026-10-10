const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
app.setPath("userData", process.env.EEZ_TEST_USER_DATA || path.join(require("node:os").tmpdir(), "eez-lvgl-tests"));
require("@electron/remote/main").initialize();
app.disableHardwareAcceleration();
ipcMain.on("getActiveDbPath", event => { event.returnValue = path.join(app.getPath("userData"), "test.db"); });
for (const [channel, value] of Object.entries({ getDbPaths: [], getLocale: "en-US", getDateFormat: "ll", getTimeFormat: "LTS", getReservedKeybindings: [], getIsDarkTheme: false, getMRU: [], getShowComponentsPaletteInProjectEditor: true })) {
    ipcMain.on(channel, event => { event.returnValue = value; });
}
app.whenReady().then(async () => {
    const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } });
    require("@electron/remote/main").enable(window.webContents);
    window.webContents.on("console-message", (_event, _level, message) => console.log(message));
    ipcMain.on("lvgl-test-result", (_event, error) => {
        if (error) console.error(error);
        app.exit(error ? 1 : 0);
    });
    await window.loadFile(path.join(__dirname, "lvgl-test.html"));
});
setTimeout(() => { console.error("Editor tests timed out"); app.exit(1); }, 120000);
