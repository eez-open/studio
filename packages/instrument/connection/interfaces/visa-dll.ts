import ffi from "ffi-napi";
import ref from "ref-napi";
import os from "os";

import vcon from "instrument/connection/interfaces/visa-constants";

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// based on https://github.com/petertorelli/ni-visa

/**
 * Create types like the ones in "visatype.h" from National Instruments
 */
//const ViInt32 = ref.types.int32;
//const ViPInt32 = ref.refType(ViInt32);
const ViUInt32 = ref.types.uint32;
const ViPUInt32 = ref.refType(ViUInt32);
//const ViInt16 = ref.types.int16;
//const ViPInt16 = ref.refType(ViInt16);
const ViUInt16 = ref.types.uint16;
const ViPUInt16 = ref.refType(ViUInt16);
const ViUInt64 = ref.types.uint64;
//const ViChar = ref.types.char;
//const ViPChar = ref.refType(ViChar);
const ViByte = ref.types.uchar;
const ViPByte = ref.refType(ViByte);
// Note, this needs to be ViUInt32, not ViInt32 other we get negative hex
const ViStatus = ViUInt32;
const ViObject = ViUInt32;
const ViSession = ViUInt32;
const ViPSession = ref.refType(ViSession);
//const ViString = ViPChar;
//const ViConstString = ViString;
//const ViRsrc = ViString;
//const ViConstRsrc = ViConstString;
const ViAccessMode = ViUInt32;
//const ViBuf = ViPByte;
const ViPBuf = ViPByte;
//const ViConstBuf = ViPByte;
const ViFindList = ViObject;
const ViPFindList = ref.refType(ViFindList);

// Choose the proper DLL name
let dllName;
// I didn't see Linux support on the NI website...
switch (os.platform()) {
    case "darwin":
        dllName =
            "/Library/Frameworks/RsVisa.framework/Versions/Current/RsVisa/librsvisa.dylib";
        break;
    case "linux":
        dllName = "librsvisa";
        break;
    case "win32":
        dllName = os.arch() == "x64" ? "visa64.dll" : "visa32.dll";
        break;
}

console.log("VISA dll Name", dllName);

// 'string' is used to reduce code, the FFI module will create Buffers as needed
let libVisa: ReturnType<typeof ffi.Library> | undefined;

if (dllName) {
    try {
        libVisa = ffi.Library(dllName, {
            // Resource Manager Functions and Operations
            viOpenDefaultRM: [ViStatus, [ViPSession]],
            viFindRsrc: [
                ViStatus,
                [ViSession, "string", ViPFindList, ViPUInt32, "string"]
            ],
            viFindNext: [ViStatus, [ViFindList, "string"]],
            viParseRsrc: [
                ViStatus,
                [ViSession, "string", ViPUInt16, ViPUInt16]
            ],
            viParseRsrcEx: [
                ViStatus,
                [
                    ViSession,
                    "string",
                    ViPUInt16,
                    ViPUInt16,
                    "string",
                    "string",
                    "string"
                ]
            ],
            viOpen: [
                ViStatus,
                [ViSession, "string", ViAccessMode, ViUInt32, ViPSession]
            ],
            // Resource Template Operations
            viClose: [ViStatus, [ViObject]],
            // Basic I/O Operations
            viRead: [ViStatus, [ViSession, ViPBuf, ViUInt32, ViPUInt32]],
            viReadToFile: [
                ViStatus,
                [ViSession, "string", ViUInt32, ViPUInt32]
            ],
            viWrite: [ViStatus, [ViSession, "string", ViUInt32, ViPUInt32]],
            // Resource Template Operations
            viInstallHandler: [
                ViStatus,
                [ViSession, ViUInt32, "pointer", "pointer"]
            ],
            viUninstallHandler: [
                ViStatus,
                [ViSession, ViUInt32, "pointer", "pointer"]
            ],
            viEnableEvent: [
                ViStatus,
                [ViSession, ViUInt32, ViUInt16, "pointer"]
            ],
            viDisableEvent: [ViStatus, [ViSession, ViUInt32, ViUInt16]],
            viSetAttribute: [ViStatus, [ViSession, ViUInt32, ViUInt64]]
        });
    } catch (err) {
        console.error("Failed to load VISA dll");
        libVisa = undefined;
    }
} else {
    libVisa = undefined;
}

// TODO: since error handling is undecided, every function calls this
function statusCheck(status: any) {
    if (status & vcon.VI_ERROR) {
        console.warn(
            "Warning: VISA Error: 0x" +
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

export function viOpenDefaultRM() {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pSesn = ref.alloc(ViSession);
    status = libVisa.viOpenDefaultRM(pSesn as any);
    statusCheck(status);
    return [status, pSesn.deref()];
}

function viFindRsrc(sesn: any, expr: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pFindList = ref.alloc(ViFindList);
    let pRetcnt = ref.alloc(ViUInt32);
    let instrDesc = Buffer.alloc(512);
    status = libVisa.viFindRsrc(
        sesn,
        expr,
        pFindList as any,
        pRetcnt as any,
        instrDesc as any
    );
    statusCheck(status);
    return [
        status,
        pFindList.deref(),
        pRetcnt.deref(),
        // Fake null-term string
        instrDesc.toString("ascii", 0, instrDesc.indexOf(0))
    ];
}

function viFindNext(findList: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let instrDesc = Buffer.alloc(512);
    status = libVisa.viFindNext(findList, instrDesc as any);
    statusCheck(status);
    return [
        status,
        // Fake null-term string
        instrDesc.toString("ascii", 0, instrDesc.indexOf(0))
    ];
}

export function viParseRsrc(sesn: any, rsrcName: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pIntfType = ref.alloc(ViUInt16);
    let pIntfNum = ref.alloc(ViUInt16);
    status = libVisa.viParseRsrc(
        sesn,
        rsrcName,
        pIntfType as any,
        pIntfNum as any
    );
    statusCheck(status);
    return [
        status,
        // This is a VI_INTF_* define
        pIntfType.deref(),
        // This is the board #
        pIntfNum.deref()
    ];
}

// TODO: Untested, I don't hardware that responds to this call
export function viParseRsrcEx(sesn: any, rsrcName: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pIntfType = ref.alloc(ViUInt16);
    let pIntfNum = ref.alloc(ViUInt16);
    let rsrcClass = Buffer.alloc(512);
    let expandedUnaliasedName = Buffer.alloc(512);
    let aliasIfExists = Buffer.alloc(512);
    status = libVisa.viParseRsrcEx(
        sesn,
        rsrcName,
        pIntfType as any,
        pIntfNum as any,
        rsrcClass as any,
        expandedUnaliasedName as any,
        aliasIfExists as any
    );
    statusCheck(status);
    return [
        status,
        // This is a VI_INTF_* define
        pIntfType.deref(),
        // This is the board #
        pIntfNum.deref(),
        rsrcClass.toString("ascii", 0, rsrcClass.indexOf(0)),
        expandedUnaliasedName.toString(
            "ascii",
            0,
            expandedUnaliasedName.indexOf(0)
        ),
        aliasIfExists.toString("ascii", 0, aliasIfExists.indexOf(0))
    ];
}

export function viOpen(
    sesn: any,
    rsrcName: any,
    accessMode: any = 0,
    openTimeout: any = 2000
) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pVi = ref.alloc(ViSession);
    status = libVisa.viOpen(
        sesn,
        rsrcName,
        accessMode,
        openTimeout,
        pVi as any
    );
    statusCheck(status);
    return [status, pVi.deref()];
}

export function viClose(vi: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    status = libVisa.viClose(vi);
    statusCheck(status);
    return status;
}

// TODO ... assuming viRead always returns a string, probably wrong
export function viRead(vi: any, count: any = 512) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let buf = Buffer.alloc(count);
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viRead(vi, buf as any, buf.length, pRetCount as any);
    statusCheck(status);
    //debug(`read (${count}) -> ${pRetCount.deref()}`);
    return [
        status,
        ref.reinterpret(buf, pRetCount.deref(), 0).toString("binary")
    ];
}

// Returns the raw Buffer object rather than a decoded string
export function viReadRaw(vi: any, count: any = 512) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let buf = Buffer.alloc(count);
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viRead(vi, buf as any, buf.length, pRetCount as any);
    statusCheck(status);
    //debug(`readRaw: (${count}) -> ${pRetCount.deref()}`);
    return [status, buf.slice(0, pRetCount.deref())];
}

//	'viReadToFile': [ViStatus, [ViSession, 'string', ViUInt32, ViPUInt32]],
export function viReadToFile(vi: any, fileName: any, count: any) {
    if (!libVisa) throw "VISA not supported";

    let status;
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viReadToFile(vi, fileName, count, pRetCount as any);
    statusCheck(status);
    //debug(`readToFile (${count}) -> ${pRetCount.deref()}`);
    return [status];
}

export function viWrite(vi: any, buf: any) {
    if (!libVisa) throw "VISA not supported";

    //debug("write:", buf);
    let status;
    let pRetCount = ref.alloc(ViUInt32);
    status = libVisa.viWrite(vi, buf, buf.length, pRetCount as any);
    statusCheck(status);
    if (pRetCount.deref() != buf.length) {
        throw new Error(
            "viWrite length fail" + `: ${pRetCount.deref()} vs ${buf.length}`
        );
    }
    return [status, pRetCount.deref()];
}

/**
 * These helper functions combine vi* functions to perform routine tasks.
 * Error handling is left to the vi* functions.
 */

/**
 * Returns a list of strings of found resources
 */
export function vhListResources(sesn: any, expr: any = "?*") {
    let descList = [];
    let [status, findList, retcnt, instrDesc] = viFindRsrc(sesn, expr);
    if (status == 0 && retcnt) {
        descList.push(instrDesc);
        for (let i = 1; i < retcnt; ++i) {
            [status, instrDesc] = viFindNext(findList);
            descList.push(instrDesc);
        }
    }
    return descList;
}

/**
 * TODO: How are compound queries handled (reponsed to)
 * Returns only the response, no status; status handled by error handler
 */
export function vhQuery(vi: any, query: any) {
    viWrite(vi, query);
    // TODO: return status as well?
    return viRead(vi)[1];
}

export function viInstallHandler(
    sesn: any,
    eventType: any,
    handler: any,
    userHandle: any
) {
    if (!libVisa) throw "VISA not supported";

    const status = libVisa.viInstallHandler(
        sesn,
        eventType,
        handler,
        userHandle
    );
    statusCheck(status);
    return [status];
}

export function viUninstallHandler(
    sesn: any,
    eventType: any,
    handler: any,
    userHandle: any
) {
    if (!libVisa) throw "VISA not supported";

    const status = libVisa.viUninstallHandler(
        sesn,
        eventType,
        handler,
        userHandle
    );
    statusCheck(status);
    return [status];
}

export function viEnableEvent(
    sesn: any,
    eventType: any,
    mechanism: any,
    context: any
) {
    if (!libVisa) throw "VISA not supported";

    const status = libVisa.viEnableEvent(sesn, eventType, mechanism, context);
    statusCheck(status);
    return [status];
}

export function viDisableEvent(sesn: any, eventType: any, mechanism: any) {
    if (!libVisa) throw "VISA not supported";

    const status = libVisa.viDisableEvent(sesn, eventType, mechanism);
    statusCheck(status);
    return [status];
}

export function viSetAttribute(sesn: any, attrName: any, attrValue: any) {
    if (!libVisa) throw "VISA not supported";

    const status = libVisa.viSetAttribute(sesn, attrName, attrValue);
    statusCheck(status);
    return [status];
}

////////////////////////////////////////////////////////////////////////////////

export let defaultSessionStatus: number = 0;
export let defaultSession: number = 0;

try {
    [defaultSessionStatus, defaultSession] = viOpenDefaultRM();
} catch (error) {
    console.error("viOpenDefaultRM", error);
}

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
