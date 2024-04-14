import { ipcMain } from "electron";

import { parseScpi, SCPI_PART_QUERY } from "eez-studio-shared/scpi-parser";

import {
    CommunicationInterface,
    CommunicationInterfaceHost
} from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";

import vcon from "instrument/connection/interfaces/visa-constants";

import {
    loadVisa,
    defaultSession,
    defaultSessionStatus,
    vhListResources,
    viClose,
    viOpen,
    viRead,
    viSetAttribute,
    viWrite
} from "instrument/connection/interfaces/visa-dll";

////////////////////////////////////////////////////////////////////////////////

ipcMain.on("get-visa-resources", function (event, includeNetworkResources) {
    loadVisa();
    if (defaultSessionStatus == 0) {
        try {
            const resources = vhListResources(
                defaultSession,
                includeNetworkResources
            );
            event.sender.send(
                "visa-resources",
                resources.map(resource => resource.toString())
            );
        } catch (err) {
            console.error("vhListResources", err);
            event.sender.send("visa-resources", undefined);
        }
    }
});

////////////////////////////////////////////////////////////////////////////////

// var viHandler = ffi.Callback(
//     "void",
//     [ViPSession, ViPUInt32, ViPUInt32, "pointer"],
//     function (vi, eventType, event, userHandle) {
//         console.log("viHandler");
//         console.log("\tvi: ", vi);
//         console.log("\teventType: ", eventType);
//         console.log("\tevent: ", event);
//         console.log("\tuserHandle: ", userHandle);
//     }
// );

export class VisaInterface implements CommunicationInterface {
    port: any;
    connectedCalled = false;
    data: string | undefined;

    vi: number | undefined;

    stripTermChar = false;

    constructor(private host: CommunicationInterfaceHost) {}

    connect() {
        loadVisa();
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
                    defaultSession,
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

            if (
                this.host.connectionParameters.visaParameters.resource.endsWith(
                    "::SOCKET"
                )
            ) {
                try {
                    viSetAttribute(this.vi, vcon.VI_ATTR_SUPPRESS_END_EN, 0);
                    console.info("set VI_ATTR_SUPPRESS_END_EN = 0");
                } catch (err) {
                    console.error(
                        "viSetAttribute set VI_ATTR_SUPPRESS_END_EN",
                        err
                    );
                }
            } else {
                try {
                    viSetAttribute(this.vi, vcon.VI_ATTR_SEND_END_EN, 1);
                    console.info("set VI_ATTR_SEND_END_EN = 1");
                    this.stripTermChar = true;
                } catch (err) {
                    console.error(
                        "viSetAttribute set VI_ATTR_SEND_END_EN",
                        err
                    );
                }
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
                const [status, buffer] = viRead(this.vi, 32 * 1024);
                this.readLock = false;
                // TODO check status
                console.log("viRead return status", status);
                if (typeof buffer == "string") {
                    consoleLogMaxChars(`RECEIVED FROM VISA`, buffer, 20);
                    this.host.onData(buffer, status == 0 ? true : false);
                } else {
                    console.log(
                        "RECEIVED FROM VISA (number):",
                        JSON.stringify(buffer.toString())
                    );
                    this.host.onData(
                        buffer.toString(),
                        status == 0 ? true : undefined
                    );
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
            if (this.stripTermChar && data.endsWith("\n")) {
                data = data.slice(0, data.length - 1);
            }

            consoleLogMaxChars("SEND TO VISA", data, 40);
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

                let hasQuery = false;
                try {
                    const parts = parseScpi(data);
                    hasQuery = !!parts.find(
                        part => part.tag == SCPI_PART_QUERY
                    );
                } catch (err) {
                    console.error(`SCPI parser error "${err}": ${data}`);
                }

                if (hasQuery) {
                    setTimeout(this.read, 0);
                }
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

function consoleLogMaxChars(message: string, data: string, maxChars: number) {
    const dataJSON = JSON.stringify(data);
    if (data.length <= maxChars) {
        console.log(`${message} (${data.length} chars): ${dataJSON}`);
    } else {
        console.log(
            `${message} (${data.length} chars): ${dataJSON.slice(
                0,
                maxChars / 2
            )}...${dataJSON.slice(dataJSON.length - maxChars / 2)}`
        );
    }
}
