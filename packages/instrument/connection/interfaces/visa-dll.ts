/*

Works in electron 20.3.8. It doesn't work on newer versions.
See: https://github.com/node-ffi-napi/node-ffi-napi/issues/238

*/

import os from "os";
import vcon from "instrument/connection/interfaces/visa-constants";

import type { IKoffiLib } from "koffi";

// import type * as ffiModule from "ffi-napi";
// let ffi: typeof ffiModule | undefined;
// try {
//     ffi = require("ffi-napi");
// } catch (err) {
//     console.error("VISA: failed to load ffi-napi module", err);
// }

// import type * as refModule from "ref-napi";
// let ref: typeof refModule | undefined;
// try {
//     ref = require("ref-napi");
// } catch (err) {
//     console.error("VISA: failed to load ref-napi module", err);
// }

export let defaultSessionStatus: number = 0;
export let defaultSession: number = 0;

let _viOpenDefaultRM: () => any;
let _viFindRsrc: (
    sesn: any,
    includeNetworkResources: boolean,
    expr: any
) => any;
let _viFindNext: (findList: any) => any;
let _viParseRsrc: (sesn: any, rsrcName: any) => any;
let _viOpen: (
    sesn: any,
    rsrcName: any,
    accessMode: any,
    openTimeout: any
) => any;
let _viClose: (vi: any) => any;
let _viRead: (vi: any, count: any) => any;
let _viWrite: (vi: any, buf: any) => any;
let _vhListResources: (
    sesn: any,
    includeNetworkResources: boolean,
    expr: any
) => string[];
let _vhQuery: (vi: any, query: any) => any;
let _viInstallHandler: (
    sesn: any,
    eventType: any,
    handler: any,
    userHandle: any
) => any;
let _viUninstallHandler: (
    sesn: any,
    eventType: any,
    handler: any,
    userHandle: any
) => any;
let _viEnableEvent: (
    sesn: any,
    eventType: any,
    mechanism: any,
    context: any
) => any;
let _viDisableEvent: (sesn: any, eventType: any, mechanism: any) => any;
let _viSetAttribute: (sesn: any, attrName: any, attrValue: any) => any;
let _unloadVisa: () => any;

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

export function loadVisa() {
    if (_unloadVisa !== undefined) {
        return;
    }

    // Choose the proper DLL name
    let dllName;
    // I didn't see Linux support on the NI website...
    switch (os.platform()) {
        case "darwin":
            dllName =
                "/Library/Frameworks/RsVisa.framework/Versions/Current/RsVisa/librsvisa.dylib";
            break;
        case "linux":
            dllName = "librsvisa.so";
            break;
        case "win32":
            dllName = os.arch() == "x64" ? "visa64.dll" : "visa32.dll";
            break;
    }

    console.log("VISA dll Name", dllName);

    // 'string' is used to reduce code, the FFI module will create Buffers as needed
    let libVisa: IKoffiLib | undefined;

    let koffi;
    try {
        koffi = require("koffi");
    } catch (err) {
        console.warn("Failed to load VISA dll (Koffi import failed)");
    }

    if (dllName && koffi) {
        try {
            libVisa = koffi.load(dllName);
        } catch (err) {
            console.error("Failed to load VISA dll");
            libVisa = undefined;
        }
    } else {
        libVisa = undefined;
    }

    if (libVisa) {
        // Resource Manager Functions and Operations
        const visaFuncs = {
            viOpenDefaultRM: libVisa.func(
                "uint32_t viOpenDefaultRM(_Out_ uint32_t *sesn)"
            ),

            viFindRsrc: libVisa.func(
                "uint32_t viFindRsrc(uint32_t sesn, const char *expr, _Out_ uint32_t *findList, _Out_ uint32_t *retcnt, _Out_ uint8_t *instrDesc)"
            ),

            viFindNext: libVisa.func(
                "uint32_t viFindNext(uint32_t findList, _Out_ uint8_t *instrDesc)"
            ),

            viParseRsrc: libVisa.func(
                "uint32_t viParseRsrc(uint32_t sesn, const char *rsrcName, _Out_ uint16_t *intfType, _Out_ uint16_t *intfNum)"
            ),

            viOpen: libVisa.func(
                "uint32_t viOpen(uint32_t sesn, const char *rsrcName, uint32_t accessMode, uint32_t openTimeout, _Out_ uint32_t *vi)"
            ),

            // Resource Template Operations
            viClose: libVisa.func("uint32_t viClose(uint32_t vi)"),

            // Basic I/O Operations
            viRead: libVisa.func(
                "uint32_t viRead(uint32_t vi, _Out_ uchar *buf, uint32_t count, _Out_ uint32_t* retCount)"
            ),

            viWrite: libVisa.func(
                "uint32_t viWrite(uint32_t vi, const uchar *buf, uint32_t count, _Out_ uint32_t* retCount)"
            ),

            // Resource Template Operations
            viInstallHandler: libVisa.func(
                "uint32_t viInstallHandler(uint32_t, uint32_t, void *, void *)"
            ),

            viUninstallHandler: libVisa.func(
                "uint32_t viUninstallHandler(uint32_t vi, uint32_t eventType, void *handler, void *userHandle)"
            ),

            viEnableEvent: libVisa.func(
                "uint32_t viEnableEvent(uint32_t vi, uint32_t eventType, uint16_t mechanism, void *context)"
            ),

            viDisableEvent: libVisa.func(
                "uint32_t viDisableEvent(uint32_t vi, uint32_t eventType, uint16_t mechanism)"
            ),

            viSetAttribute: libVisa.func(
                "uint32_t viSetAttribute(uint32_t vi, uint32_t attribute, uint64_t attrState)"
            )
        };
        // TODO: since error handling is undecided, every function calls this
        function statusCheck(status: any, func: string) {
            if (status & vcon.VI_ERROR) {
                console.warn(
                    "Warning: VISA Error in " +
                        func +
                        ": 0x" +
                        (status >>> 0).toString(16).toUpperCase()
                );
                throw new Error();
            } else {
                if (status) {
                    let str = vcon.decodeStatus(status);
                    if (str != null) {
                        //debug(`non-error status check: ${status.toString(16)} ${str}`);
                    } else {
                        //debug(`non-error status check: ${status.toString(16)}`);
                    }
                }
            }
        }

        _viOpenDefaultRM = () => {
            if (!libVisa) throw "VISA not supported";

            const pSesn = [0];
            const status = visaFuncs.viOpenDefaultRM(pSesn);
            statusCheck(status, "viOpenDefaultRM");
            return [status, pSesn[0]];
        };

        _viFindRsrc = (
            sesn: any,
            includeNetworkResources: boolean,
            expr: any
        ) => {
            if (!libVisa) throw "VISA not supported";

            if (includeNetworkResources) {
                viSetAttribute(
                    sesn,
                    vcon.VI_RS_ATTR_TCPIP_FIND_RSRC_TMO,
                    0x3e8
                );
                viSetAttribute(sesn, vcon.VI_RS_ATTR_TCPIP_FIND_RSRC_MODE, 0x7);
            }

            let status;
            let pFindList = [0];
            let pRetcnt = [0];
            let instrDesc = Buffer.allocUnsafe(512);
            status = visaFuncs.viFindRsrc(
                sesn,
                expr,
                pFindList,
                pRetcnt,
                instrDesc
            );
            statusCheck(status, "viFindRsrc");
            return [
                status,
                pFindList[0],
                pRetcnt[0],
                // Fake null-term string
                instrDesc.toString("ascii", 0, instrDesc.indexOf(0))
            ];
        };

        _viFindNext = (findList: any) => {
            if (!libVisa) throw "VISA not supported";

            let status;
            let instrDesc = Buffer.allocUnsafe(512);
            status = visaFuncs.viFindNext(findList, instrDesc);
            statusCheck(status, "viFindNext");
            return [
                status,
                // Fake null-term string
                instrDesc.toString("ascii", 0, instrDesc.indexOf(0))
            ];
        };

        _viParseRsrc = (sesn: any, rsrcName: any) => {
            if (!libVisa) throw "VISA not supported";

            let status;
            let pIntfType = [0];
            let pIntfNum = [0];
            status = visaFuncs.viParseRsrc(sesn, rsrcName, pIntfType, pIntfNum);
            statusCheck(status, "viParseRsrc");
            return [
                status,
                // This is a VI_INTF_* define
                pIntfType[0],
                // This is the board #
                pIntfNum[0]
            ];
        };

        _viOpen = (
            sesn: any,
            rsrcName: any,
            accessMode: any = 0,
            openTimeout: any = 2000
        ) => {
            if (!libVisa) throw "VISA not supported";

            let status;
            let pVi = [0];
            status = visaFuncs.viOpen(
                sesn,
                rsrcName,
                accessMode,
                openTimeout,
                pVi
            );
            statusCheck(status, "viOpen");
            return [status, pVi[0]];
        };

        _viClose = (vi: any) => {
            if (!libVisa) throw "VISA not supported";

            let status;
            status = visaFuncs.viClose(vi);
            statusCheck(status, "viClose");
            return status;
        };

        // TODO ... assuming viRead always returns a string, probably wrong
        _viRead = (vi: any, count: any = 512) => {
            if (!libVisa) throw "VISA not supported";

            let status;
            let buf = Buffer.allocUnsafe(count);
            let pRetCount = [0];
            status = visaFuncs.viRead(vi, buf, buf.length, pRetCount);
            statusCheck(status, "viRead");
            //debug(`read (${count}) -> ${pRetCount.deref()}`);
            return [status, buf.slice(0, pRetCount[0]).toString("binary")];
        };

        _viWrite = (vi: any, buf: any) => {
            if (!libVisa) throw "VISA not supported";

            //debug("write:", buf);
            let status;
            let pRetCount = [0];
            status = visaFuncs.viWrite(vi, buf, buf.length, pRetCount as any);
            statusCheck(status, "viWrite");
            if (pRetCount[0] != buf.length) {
                throw new Error(
                    "viWrite length fail" + `: ${pRetCount[0]} vs ${buf.length}`
                );
            }
            return [status, pRetCount[0]];
        };

        /**
         * These helper functions combine vi* functions to perform routine tasks.
         * Error handling is left to the vi* functions.
         */

        /**
         * Returns a list of strings of found resources
         */
        _vhListResources = (
            sesn: any,
            includeNetworkResources: boolean,
            expr: any = "?*"
        ) => {
            if (!libVisa) throw "VISA not supported";
            let descList = [];
            try {
                let [status, findList, retcnt, instrDesc] = viFindRsrc(
                    sesn,
                    includeNetworkResources,
                    expr
                );
                if (status == 0 && retcnt) {
                    descList.push(instrDesc);
                    for (let i = 1; i < retcnt; ++i) {
                        [status, instrDesc] = viFindNext(findList);
                        descList.push(instrDesc);
                    }
                }
            } catch (err) {}
            return descList;
        };

        /**
         * TODO: How are compound queries handled (reponsed to)
         * Returns only the response, no status; status handled by error handler
         */
        _vhQuery = (vi: any, query: any) => {
            viWrite(vi, query);
            // TODO: return status as well?
            return viRead(vi)[1];
        };

        _viInstallHandler = (
            sesn: any,
            eventType: any,
            handler: any,
            userHandle: any
        ) => {
            if (!libVisa) throw "VISA not supported";

            const status = visaFuncs.viInstallHandler(
                sesn,
                eventType,
                handler,
                userHandle
            );
            statusCheck(status, "viInstallHandler");
            return [status];
        };

        _viUninstallHandler = (
            sesn: any,
            eventType: any,
            handler: any,
            userHandle: any
        ) => {
            if (!libVisa) throw "VISA not supported";

            const status = visaFuncs.viUninstallHandler(
                sesn,
                eventType,
                handler,
                userHandle
            );
            statusCheck(status, "viUninstallHandler");
            return [status];
        };

        _viEnableEvent = (
            sesn: any,
            eventType: any,
            mechanism: any,
            context: any
        ) => {
            if (!libVisa) throw "VISA not supported";

            const status = visaFuncs.viEnableEvent(
                sesn,
                eventType,
                mechanism,
                context
            );
            statusCheck(status, "viEnableEvent");
            return [status];
        };

        _viDisableEvent = (sesn: any, eventType: any, mechanism: any) => {
            if (!libVisa) throw "VISA not supported";

            const status = visaFuncs.viDisableEvent(sesn, eventType, mechanism);
            statusCheck(status, "viDisableEvent");
            return [status];
        };

        _viSetAttribute = (sesn: any, attrName: any, attrValue: any) => {
            if (!libVisa) throw "VISA not supported";

            const status = visaFuncs.viSetAttribute(sesn, attrName, attrValue);
            statusCheck(status, "viSetAttribute");
            return [status];
        };

        ////////////////////////////////////////////////////////////////////////////////

        try {
            [defaultSessionStatus, defaultSession] = viOpenDefaultRM();
        } catch (error) {
            console.error("viOpenDefaultRM", error);
        }

        _unloadVisa = () => {
            if (libVisa && defaultSession) {
                console.log("Unload VISA dll");
                viClose(defaultSession);
            }
        };

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

        // console.log("viOpenDefaultRM", status);
        // vhListResources(sesn).some(address => {
        //     console.log("address", address);
        //     const [status, vi] = viOpen(sesn, address);
        //     console.log("viOpen", status);
        //     const resp = vhQuery(vi, "*IDN?");
        //     console.log("Address " + address + " -> " + resp.toString().trim());
        //     if (typeof resp == "string") {
        //         if (resp.match(/SVA1/)) {
        //             console.log(`Using the first SVA1015 found at ${address}`);
        //             return true;
        //         }
        //     }
        //     viClose(vi);
        //     return false;
        // });
    }
}

export function viOpenDefaultRM() {
    if (!_viOpenDefaultRM) throw "VISA not supported";
    return _viOpenDefaultRM();
}

export function viFindRsrc(
    sesn: any,
    includeNetworkResources: boolean,
    expr: any
) {
    if (!_viFindRsrc) throw "VISA not supported";
    return _viFindRsrc(sesn, includeNetworkResources, expr);
}

export function viFindNext(findList: any) {
    if (!_viFindNext) throw "VISA not supported";
    return _viFindNext(findList);
}

export function viParseRsrc(sesn: any, rsrcName: any) {
    if (!_viParseRsrc) throw "VISA not supported";
    return _viParseRsrc(sesn, rsrcName);
}

export function viOpen(
    sesn: any,
    rsrcName: any,
    accessMode: any = 0,
    openTimeout: any = 2000
) {
    if (!_viOpen) throw "VISA not supported";
    return _viOpen(sesn, rsrcName, accessMode, openTimeout);
}

export function viClose(vi: any) {
    if (!_viClose) throw "VISA not supported";
    return _viClose(vi);
}

export function viRead(vi: any, count: any = 512) {
    if (!_viRead) throw "VISA not supported";
    return _viRead(vi, count);
}

export function viWrite(vi: any, buf: any) {
    if (!_viWrite) throw "VISA not supported";
    return _viWrite(vi, buf);
}

export function vhListResources(
    sesn: any,
    includeNetworkResources: boolean,
    expr: any = "?*"
) {
    if (!_vhListResources) throw "VISA not supported";
    return _vhListResources(sesn, includeNetworkResources, expr);
}

export function vhQuery(vi: any, query: any) {
    if (!_vhQuery) throw "VISA not supported";
    return _vhQuery(vi, query);
}

export function viInstallHandler(
    sesn: any,
    eventType: any,
    handler: any,
    userHandle: any
) {
    if (!_viInstallHandler) throw "VISA not supported";
    return _viInstallHandler(sesn, eventType, handler, userHandle);
}

export function viUninstallHandler(
    sesn: any,
    eventType: any,
    handler: any,
    userHandle: any
) {
    if (!_viUninstallHandler) throw "VISA not supported";
    return _viUninstallHandler(sesn, eventType, handler, userHandle);
}

export function viEnableEvent(
    sesn: any,
    eventType: any,
    mechanism: any,
    context: any
) {
    if (!_viEnableEvent) throw "VISA not supported";
    return _viEnableEvent(sesn, eventType, mechanism, context);
}

export function viDisableEvent(sesn: any, eventType: any, mechanism: any) {
    if (!_viDisableEvent) throw "VISA not supported";
    return _viDisableEvent(sesn, eventType, mechanism);
}

export function viSetAttribute(sesn: any, attrName: any, attrValue: any) {
    if (!_viSetAttribute) throw "VISA not supported";
    return _viSetAttribute(sesn, attrName, attrValue);
}

////////////////////////////////////////////////////////////////////////////////

export function unloadVisa() {
    if (_unloadVisa) {
        _unloadVisa();
    }
}
