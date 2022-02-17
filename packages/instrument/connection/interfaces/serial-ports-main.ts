import { ipcMain } from "electron";
import SerialPort from "serialport";

ipcMain.handle("getSerialPorts", async () => {
    return await SerialPort.list();
});
