import { BrowserWindow, ipcMain } from "electron";
import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";

function binaryToString(data: string) {
    const arr = Buffer.from(data, "binary");
    let str = "";
    for (let i = 0; i < arr.length; i++) {
        let x = arr[i].toString(16);
        if (x.length == 1) {
            x = "0" + x;
        }
        str += x;
    }
    return str;
}

function stringToBinary(data: string) {
    const arr = Buffer.alloc(data.length / 2);
    for (let i = 0; i < data.length; i += 2) {
        arr[i / 2] = parseInt(data.substring(i, i + 2), 16);
    }
    return arr.toString("binary");
}

export class WebSimulatorInterface implements CommunicationInterface {
    static connections = new Map<string, WebSimulatorInterface>();

    _isConnected: boolean;

    constructor(private host: CommunicationInterfaceHost) {}

    connect() {
        setTimeout(() => {
            WebSimulatorInterface.connections.set(
                this.host.connectionParameters.webSimulatorParameters.id,
                this
            );
            this._isConnected = true;
            this.host.connected();
        });
    }

    isConnected() {
        return this._isConnected;
    }

    write(dataStr: string) {
        BrowserWindow.getAllWindows().forEach(window =>
            window.webContents.send(
                "web-simulator-connection-write",
                this.host.connectionParameters.webSimulatorParameters.id,
                binaryToString(dataStr)
            )
        );
    }

    disconnect() {
        setTimeout(() => {
            WebSimulatorInterface.connections.delete(
                this.host.connectionParameters.webSimulatorParameters.id
            );
            this._isConnected = false;
            this.host.disconnected();
        });
    }

    static onData(simulatorID: string, scpiOutputBuffer: string) {
        const connection = WebSimulatorInterface.connections.get(simulatorID);
        if (connection) {
            const data = stringToBinary(scpiOutputBuffer);
            connection.host.onData(data);
        }
    }
}

ipcMain.on(
    "web-simulator-connection-on-data",
    (event, simulatorID, scpiOutputBuffer) =>
        WebSimulatorInterface.onData(simulatorID, scpiOutputBuffer)
);
