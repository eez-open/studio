import { parentPort } from "worker_threads";

// import {
//     defaultSessionStatus,
//     defaultSession,
//     vhListResources,
//     viOpen
//     viSetAttribute,
//     viRead,
//     viWrite,
//     viClose
// } from "instrument/connection/interfaces/visa-dll";

if (parentPort) {
    parentPort.on("connect", (params: { resource: string }) => {
        console.log(params);

        // if (defaultSessionStatus != 0) {
        //     parentPort;
        //     return;
        // }

        // try {
        //     let viOpenStatus;
        //     let vi;

        //     try {
        //         [viOpenStatus, vi] = viOpen(
        //             defaultSessionStatus,
        //             params.resource
        //         );
        //     } catch (err) {
        //         console.error("viOpen", err);
        //         throw err;
        //     }

        //     if (viOpenStatus != 0) {
        //         this.host.setError(
        //             ConnectionErrorCode.UNKNOWN,
        //             `Failed to open VISA resource, status = ${viOpenStatus}`
        //         );
        //         this.host.disconnected();
        //         return;
        //     }

        //     this.vi = vi;

        //     // try {
        //     //     viInstallHandler(
        //     //         vi,
        //     //         vcon.VI_EVENT_SERVICE_REQ,
        //     //         viHandler,
        //     //         ref.NULL
        //     //     );
        //     // } catch (err) {
        //     //     console.error("viInstallHandler", err);
        //     //     throw err;
        //     // }

        //     // try {
        //     //     viEnableEvent(
        //     //         vi,
        //     //         vcon.VI_EVENT_SERVICE_REQ,
        //     //         vcon.VI_HNDLR,
        //     //         ref.NULL
        //     //     );
        //     // } catch (err) {
        //     //     console.error("viEnableEvent VI_EVENT_SERVICE_REQ", err);
        //     //     throw err;
        //     // }

        //     // try {
        //     //     viEnableEvent(
        //     //         vi,
        //     //         vcon.VI_EVENT_IO_COMPLETION,
        //     //         vcon.VI_QUEUE,
        //     //         ref.NULL
        //     //     );
        //     // } catch (err) {
        //     //     console.error("viEnableEvent VI_EVENT_IO_COMPLETION", err);
        //     //     throw err;
        //     // }

        //     try {
        //         viSetAttribute(this.vi, vcon.VI_ATTR_SEND_END_EN, 1);
        //         console.log("set VI_ATTR_SEND_END_EN = 1");
        //     } catch (err) {
        //         console.error("viSetAttribute VI_ATTR_SEND_END_EN", err);
        //     }

        //     this.host.connected();
        // } catch (err) {
        //     this.vi = undefined;
        //     this.host.setError(
        //         ConnectionErrorCode.UNKNOWN,
        //         `Failed to open VISA resource: ${err.toString()}`
        //     );
        //     this.host.disconnected();
        // }
    });
}
