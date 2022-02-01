import { BrowserWindow, ipcMain } from "electron";
import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";

function binaryStringToArrayBuffer(data: string) {
    const buffer = Buffer.from(data, "binary");
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );
}

function arrayBufferToBinaryString(data: ArrayBuffer) {
    const buffer = Buffer.from(data);
    return buffer.toString("binary");
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
                binaryStringToArrayBuffer(dataStr)
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

    static onData(simulatorID: string, scpiOutputBuffer: ArrayBuffer) {
        const connection = WebSimulatorInterface.connections.get(simulatorID);
        if (connection) {
            const data = arrayBufferToBinaryString(scpiOutputBuffer);
            connection.host.onData(data);
        }
    }
}

ipcMain.on(
    "web-simulator-connection-on-data",
    (event, simulatorID, scpiOutputBuffer) =>
        WebSimulatorInterface.onData(simulatorID, scpiOutputBuffer)
);
