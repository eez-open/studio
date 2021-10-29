import { ipcMain } from "electron";

import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";

import vcon from "instrument/connection/interfaces/visa-constants";
import {
    defaultSessionStatus,
    defaultSession,
    vhListResources,
    viOpen,
    viSetAttribute,
    viRead,
    viWrite,
    viClose
} from "instrument/connection/interfaces/visa-dll";

ipcMain.on("get-visa-resources", function (event) {
    if (defaultSessionStatus == 0) {
        try {
            const resources = vhListResources(defaultSession);
            event.sender.send(
                "visa-resources",
                resources.map(resource => resource.toString())
            );
        } catch (err) {
            console.error("vhListResources", err);
        }
    }
});

export class VisaInterface implements CommunicationInterface {
    port: any;
    connectedCalled = false;
    data: string | undefined;

    vi: number | undefined;

    constructor(private host: CommunicationInterfaceHost) {}

    connect() {
        if (defaultSessionStatus != 0) {
            this.host.setError(
                ConnectionErrorCode.UNKNOWN,
                "VISA initialization failed."
            );
            this.host.disconnected();
            return;
        }

        try {
            let viOpenStatus;
            let vi;

            try {
                [viOpenStatus, vi] = viOpen(
                    defaultSessionStatus,
                    this.host.connectionParameters.visaParameters.resource
                );
            } catch (err) {
                console.error("viOpen", err);
                throw err;
            }

            if (viOpenStatus != 0) {
                this.host.setError(
                    ConnectionErrorCode.UNKNOWN,
                    `Failed to open VISA resource, status = ${viOpenStatus}`
                );
                this.host.disconnected();
                return;
            }

            this.vi = vi;

            // try {
            //     viInstallHandler(
            //         vi,
            //         vcon.VI_EVENT_SERVICE_REQ,
            //         viHandler,
            //         ref.NULL
            //     );
            // } catch (err) {
            //     console.error("viInstallHandler", err);
            //     throw err;
            // }

            // try {
            //     viEnableEvent(
            //         vi,
            //         vcon.VI_EVENT_SERVICE_REQ,
            //         vcon.VI_HNDLR,
            //         ref.NULL
            //     );
            // } catch (err) {
            //     console.error("viEnableEvent VI_EVENT_SERVICE_REQ", err);
            //     throw err;
            // }

            // try {
            //     viEnableEvent(
            //         vi,
            //         vcon.VI_EVENT_IO_COMPLETION,
            //         vcon.VI_QUEUE,
            //         ref.NULL
            //     );
            // } catch (err) {
            //     console.error("viEnableEvent VI_EVENT_IO_COMPLETION", err);
            //     throw err;
            // }

            try {
                viSetAttribute(this.vi, vcon.VI_ATTR_SEND_END_EN, 1);
                console.log("set VI_ATTR_SEND_END_EN = 1");
            } catch (err) {
                console.error("viSetAttribute VI_ATTR_SEND_END_EN", err);
            }

            this.host.connected();
        } catch (err) {
            this.vi = undefined;
            this.host.setError(
                ConnectionErrorCode.UNKNOWN,
                `Failed to open VISA resource: ${err.toString()}`
            );
            this.host.disconnected();
        }
    }

    isConnected() {
        return this.vi != undefined;
    }

    readLock = false;

    read = () => {
        if (this.readLock) {
            return;
        }

        if (this.vi != undefined) {
            try {
                this.readLock = true;
                const [status, buffer] = viRead(this.vi, 1024 * 1024);
                this.readLock = false;
                // TODO check status
                console.log("viRead return status", status);
                if (typeof buffer == "string") {
                    console.log(
                        `RECEIVED FROM VISA (showing first 10 of ${buffer.length} characters)`,
                        JSON.stringify(buffer.slice(0, 10))
                    );
                    this.host.onData(buffer);
                } else {
                    console.log(
                        "RECEIVED FROM VISA number",
                        JSON.stringify(buffer.toString())
                    );
                    this.host.onData(buffer.toString());
                }

                if (status == vcon.VI_SUCCESS_MAX_CNT) {
                    setTimeout(this.read, 0);
                }
            } catch (err) {
                this.readLock = false;
                console.error("viRead", err.toString());
            }
        }
    };

    write(data: string) {
        if (this.vi != undefined) {
            console.log("SEND TO VISA", JSON.stringify(data));
            try {
                const [status, written] = viWrite(
                    this.vi,
                    Buffer.from(data, "binary")
                );
                if (status != 0) {
                    this.host.setError(
                        ConnectionErrorCode.UNKNOWN,
                        "Write error: VISA Error 0x" +
                            (status >>> 0).toString(16).toUpperCase()
                    );
                }
                if (written != data.length) {
                    this.host.setError(
                        ConnectionErrorCode.UNKNOWN,
                        `Write error: uncomplete, only ${written} of ${data.length} written`
                    );
                }
                setTimeout(this.read, 0);
            } catch (err) {
                this.host.setError(
                    ConnectionErrorCode.UNKNOWN,
                    `Failed to write to VISA resource: ${err.toString()}`
                );
            }
        }
    }

    destroy() {
        if (this.vi != undefined) {
            // try {
            //     viDisableEvent(
            //         this.vi,
            //         vcon.VI_ALL_ENABLED_EVENTS,
            //         vcon.VI_ALL_MECH
            //     );
            // } catch (err) {
            //     console.error("viDisableEvent", err);
            // }

            // try {
            //     viUninstallHandler(
            //         this.vi,
            //         vcon.VI_EVENT_SERVICE_REQ,
            //         viHandler,
            //         ref.NULL
            //     );
            // } catch (err) {
            //     console.error("viUninstallHandler", err);
            // }

            try {
                viClose(this.vi);
            } catch (err) {
                console.error("viClose", err);
            }
            this.vi = undefined;
        }
        this.host.disconnected();
    }

    disconnect() {
        this.destroy();
    }
}
