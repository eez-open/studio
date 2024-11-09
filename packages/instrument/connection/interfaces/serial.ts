import os from "os";
import SerialPortModule from "serialport";

import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";

const CONF_CHUNK_SIZE = os.platform() == "darwin" ? 48 : 64;

export class SerialInterface implements CommunicationInterface {
    port: SerialPortModule.SerialPort | undefined;
    connectedCalled = false;
    data: string | undefined;

    constructor(private host: CommunicationInterfaceHost) {}

    connect() {
        try {
            const SerialPort = require("serialport") as typeof SerialPortModule;

            const flowControl =
                this.host.connectionParameters.serialParameters.flowControl ??
                "none";

            this.port = new SerialPort.SerialPort(
                {
                    path: this.host.connectionParameters.serialParameters.port,
                    baudRate:
                        this.host.connectionParameters.serialParameters
                            .baudRate,
                    dataBits:
                        this.host.connectionParameters.serialParameters
                            .dataBits ?? 8,
                    stopBits:
                        this.host.connectionParameters.serialParameters
                            .stopBits ?? 1,
                    parity:
                        this.host.connectionParameters.serialParameters
                            .parity ?? "none",
                    rtscts: flowControl == "rts/cts" ? true : false,
                    xon: flowControl == "xon/xoff" ? true : false,
                    xoff: flowControl == "xon/xoff" ? true : false
                },
                (err: any) => {
                    if (err) {
                        this.host.setError(
                            ConnectionErrorCode.NONE,
                            err.toString()
                        );
                        this.destroy();
                    } else {
                        if (!this.connectedCalled) {
                            this.connectedCalled = true;
                            this.host.connected();
                        }
                    }
                }
            );
        } catch (err) {
            this.host.setError(ConnectionErrorCode.NONE, "Invalid port!");
            this.destroy();
            return;
        }

        this.port.on("open", () => {
            if (!this.connectedCalled) {
                this.connectedCalled = true;
                this.host.connected();
            }
        });

        this.port.on("error", (err: any) => {
            this.host.setError(ConnectionErrorCode.NONE, err.toString());
            this.destroy();
        });

        this.port.on("data", (data: any) => {
            this.host.onData(data.toString("binary"));
        });
    }

    isConnected() {
        return this.port ? this.port.isOpen : false;
    }

    destroy() {
        if (this.port) {
            if (this.port.isOpen) {
                this.port.close();
            }
            this.port = undefined;
        }
        this.host.disconnected();
    }

    sendNextChunkCallback = () => {
        if (this.port && this.data) {
            let nextChunk;
            if (this.data.length <= CONF_CHUNK_SIZE) {
                nextChunk = this.data;
                this.data = undefined;
            } else {
                nextChunk = this.data.slice(0, CONF_CHUNK_SIZE);
                this.data = this.data.slice(CONF_CHUNK_SIZE);
            }

            this.port.write(nextChunk, "binary");

            if (this.data) {
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    };

    write(data: string) {
        if (this.port) {
            if (this.data) {
                this.data += data;
            } else {
                this.data = data;
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    }

    disconnect() {
        this.destroy();
    }
}
