const os = require("os");
const net = require("net");

import {
    CommunicationInterface,
    CommunicationInterfaceHost,
    ConnectionErrorCode
} from "instrument/connection/interface";

export class EthernetInterface implements CommunicationInterface {
    socket: any;

    constructor(private host: CommunicationInterfaceHost) {}

    connect() {
        this.socket = new net.Socket();

        this.socket.setEncoding("binary");

        this.socket.on("data", (data: string) => {
            this.host.onData(data);
        });

        this.socket.on("error", (err: any) => {
            if (err.code === "ECONNRESET") {
                this.host.setError(
                    ConnectionErrorCode.CLOSED_BY_INSTRUMENT,
                    "A connection was forcibly closed by an instrument."
                );
            } else if (err.code === "ECONNREFUSED") {
                this.host.setError(
                    ConnectionErrorCode.NOT_FOUND,
                    "No connection could be made because the target instrument actively refused it."
                );
            } else {
                this.host.setError(ConnectionErrorCode.UNKNOWN, err.toString());
            }
            this.destroy();
        });

        this.socket.on("close", (e: any) => {
            this.destroy();
        });

        this.socket.on("end", (e: any) => {
            this.destroy();
        });

        this.socket.on("timeout", (e: any) => {
            this.destroy();
        });

        this.socket.on("destroyed", (e: any) => {
            this.destroy();
        });

        try {
            this.socket.connect(
                this.host.connectionParameters.ethernetParameters.port,
                this.host.connectionParameters.ethernetParameters.address,
                () => {
                    this.host.connected();
                }
            );
        } catch (err) {
            this.host.setError(ConnectionErrorCode.NONE, err.toString());
            this.destroy();
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.destroy();
            this.socket.unref();
            this.socket.removeAllListeners();
            this.socket = undefined;
        }
        this.host.disconnected();
    }

    write(data: string) {
        this.socket.write(data, "binary");
    }

    disconnect() {
        if (os.platform() == "win32") {
            this.destroy();
        } else {
            if (this.socket.connecting) {
                this.destroy();
            } else {
                this.socket.end();
            }
        }
    }
}
