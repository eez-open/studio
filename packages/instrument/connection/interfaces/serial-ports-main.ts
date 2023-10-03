import { ipcMain, WebContents } from "electron";
import { SerialPort } from "serialport";
import type { SerialConnectionConstructorParams } from "instrument/connection/interfaces/serial-ports-renderer";

ipcMain.handle("getSerialPorts", async () => {
    return await SerialPort.list();
});

ipcMain.on(
    "newSerialPortConnection",
    (
        event,
        args: {
            connectionId: string;
            params: SerialConnectionConstructorParams;
        }
    ) => {
        connections.set(
            args.connectionId,
            new Connection(event.sender, args.connectionId, args.params)
        );
    }
);

ipcMain.on(
    "serialPortConnectionDisconnect",
    (
        event,
        args: {
            connectionId: string;
        }
    ) => {
        const connection = connections.get(args.connectionId);
        if (connection) {
            connection.disconnect();
        }
    }
);

ipcMain.on(
    "serialPortConnectionWrite",
    (
        event,
        args: {
            connectionId: string;
            data: string;
        }
    ) => {
        const connection = connections.get(args.connectionId);
        if (connection) {
            connection.write(args.data);
        }
    }
);

const CONF_CHUNK_SIZE = 64;

class Connection {
    port: SerialPort | undefined;
    connectedCalled: boolean = false;
    dataToWrite: string | undefined;

    constructor(
        public webContents: WebContents,
        public connectionId: string,
        params: SerialConnectionConstructorParams
    ) {
        try {
            this.port = new SerialPort(
                {
                    ...params,
                    path: params.port,
                    rtscts: false
                },
                (err: any) => {
                    if (err) {
                        webContents.send("serialPortError", {
                            connectionId,
                            err
                        });
                    } else {
                        if (!this.connectedCalled) {
                            this.connectedCalled = true;
                            webContents.send("serialPortConnected", {
                                connectionId
                            });
                        }
                    }
                }
            );
        } catch (err) {
            webContents.send("serialPortError", {
                connectionId,
                err: "Invalid port!"
            });
            return;
        }

        this.port.on("open", () => {
            if (!this.connectedCalled) {
                this.connectedCalled = true;
                webContents.send("serialPortConnected", { connectionId });
            }
        });

        this.port.on("close", (err: any) => {
            this.disconnect();
        });

        this.port.on("error", (err: any) => {
            webContents.send("serialPortError", {
                connectionId,
                err
            });
        });

        this.port.on("data", (data: any) => {
            webContents.send("serialPortData", {
                connectionId,
                data: data.toString("binary")
            });
        });
    }

    disconnect() {
        if (this.port) {
            this.port.close();
            this.port = undefined;
        }

        this.webContents.send("serialPortDisconnected", {
            connectionId: this.connectionId
        });

        connections.delete(this.connectionId);
    }

    sendNextChunkCallback = () => {
        if (this.port && this.dataToWrite) {
            let nextChunk;
            if (this.dataToWrite.length <= CONF_CHUNK_SIZE) {
                nextChunk = this.dataToWrite;
                this.dataToWrite = undefined;
            } else {
                nextChunk = this.dataToWrite.slice(0, CONF_CHUNK_SIZE);
                this.dataToWrite = this.dataToWrite.slice(CONF_CHUNK_SIZE);
            }

            this.port.write(nextChunk, "binary");

            if (this.dataToWrite) {
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    };

    write(data: string) {
        if (this.port) {
            if (this.dataToWrite) {
                this.dataToWrite += data;
            } else {
                this.dataToWrite = data;
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    }
}

const connections = new Map<string, Connection>();
