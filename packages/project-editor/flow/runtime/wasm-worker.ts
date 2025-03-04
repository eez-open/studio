import type {
    WorkerToRenderMessage,
    IPropertyValue,
    IWasmFlowRuntime
} from "eez-studio-types";

import type {
    RendererToWorkerMessage,
    IGlobalVariable
} from "project-editor/flow/runtime/wasm-worker-interfaces";

import {
    getValue,
    getArrayValue,
    createWasmValue,
    getJSObjectFromID,
    jsObjectIncRef,
    jsObjectDecRef
} from "project-editor/flow/runtime/wasm-value";

import { DashboardComponentContext } from "project-editor/flow/runtime/worker-dashboard-component-context";

import { isArray } from "eez-studio-shared/util";
import { getLvglWasmFlowRuntimeConstructor } from "project-editor/lvgl/lvgl-versions";
import { runInAction } from "mobx";
import deepEqual from "fast-deep-equal";

const eez_flow_runtime_constructor = require("project-editor/flow/runtime/eez_runtime.js");

////////////////////////////////////////////////////////////////////////////////

const wasmFlowRuntimes = new Map<number, IWasmFlowRuntime>();

function getWasmFlowRuntime(wasmModuleId: number) {
    return wasmFlowRuntimes.get(wasmModuleId)!;
}

////////////////////////////////////////////////////////////////////////////////

let wasmModuleToMessageToDebugger = new Map<number, Uint8Array>();

function startToDebuggerMessage(wasmModuleId: number) {}

function writeDebuggerBuffer(wasmModuleId: number, buffer: any) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    let newMessageToDebugger = new Uint8Array(buffer);

    let currentMessagesToDebugger =
        wasmModuleToMessageToDebugger.get(wasmModuleId);

    let messageToDebugger;

    if (currentMessagesToDebugger) {
        // merge
        messageToDebugger = new Uint8Array(
            currentMessagesToDebugger.length + newMessageToDebugger.length
        );
        messageToDebugger.set(currentMessagesToDebugger);
        messageToDebugger.set(
            newMessageToDebugger,
            currentMessagesToDebugger.length
        );
    } else {
        messageToDebugger = newMessageToDebugger;
    }

    wasmModuleToMessageToDebugger.set(wasmModuleId, messageToDebugger);
}

function finishToDebuggerMessage(wasmModuleId: number) {}

////////////////////////////////////////////////////////////////////////////////

function executeScpi(
    wasmModuleId: number,
    instrumentPtr: number,
    arr: any,
    isQuery: number,
    timeout: number,
    delay: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    const result = getArrayValue(WasmFlowRuntime, instrumentPtr, [
        "object:Instrument"
    ]);
    if (!result) {
        WasmFlowRuntime._onScpiResult(
            WasmFlowRuntime.allocateUTF8("Invalid instrument"),
            0,
            0,
            0
        );
        return;
    }

    const instrument = result.value as any as {
        id: string;
    };

    const data: WorkerToRenderMessage = {
        scpiCommand: {
            instrumentId: instrument.id,
            command: new Uint8Array(arr),
            isQuery: isQuery ? true : false,
            timeout,
            delay
        }
    };

    setTimeout(() => WasmFlowRuntime.postWorkerToRendererMessage(data));
}

function executeDashboardComponent(
    wasmModuleId: number,
    componentType: number,
    flowStateIndex: number,
    componentIndex: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    const dashboardComponentContext = new DashboardComponentContext(
        WasmFlowRuntime,
        flowStateIndex,
        componentIndex
    );

    const componentName =
        WasmFlowRuntime.assetsMap.dashboardComponentTypeToNameMap[
            componentType
        ];

    let aClass = WasmFlowRuntime.getClassByName(componentName);
    if (!aClass) {
        aClass = WasmFlowRuntime.getClassByName(componentName + "Widget");
    }
    if (!aClass) {
        aClass = WasmFlowRuntime.getClassByName(
            componentName + "ActionComponent"
        );
    }

    if (aClass && aClass.classInfo.execute) {
        aClass.classInfo.execute(dashboardComponentContext);
    } else {
        dashboardComponentContext.throwError(
            `Unknown component ${componentName}`
        );
    }
}

function operationJsonGet(
    wasmModuleId: number,
    jsObjectID: number,
    propertyName: string
) {
    let value = undefined;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        value = getJSObjectFromID(jsObjectID, wasmModuleId);

        const path = [];
        let part = "";

        for (let i = 0; i < propertyName.length; i++) {
            const ch = propertyName[i];
            if (ch == "\\") {
                i++;
                if (i < propertyName.length) {
                    part += propertyName[i];
                }
            } else if (ch == ".") {
                path.push(part);
                part = "";
            } else {
                part += ch;
            }
        }
        path.push(part);

        for (let i = 0; value && i < path.length; i++) {
            value = value[path[i]];
        }
    }

    return createWasmValue(WasmFlowRuntime, value);
}

function operationJsonSet(
    wasmModuleId: number,
    jsObjectID: number,
    property: string,
    valuePtr: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        let value = getJSObjectFromID(jsObjectID, wasmModuleId);
        const propertyParts = property.split(".");
        for (let i = 0; value && i < propertyParts.length - 1; i++) {
            value = value[propertyParts[i]];
        }

        if (value) {
            runInAction(() => {
                value[propertyParts[propertyParts.length - 1]] = getValue(
                    WasmFlowRuntime,
                    valuePtr
                ).value;
            });

            return 0; // success
        }
    }

    return 1; // error
}

function operationJsonArrayLength(wasmModuleId: number, jsObjectID: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        let value = getJSObjectFromID(jsObjectID, wasmModuleId);
        if (value && Array.isArray(value)) {
            return value.length; // success
        }
    }

    return -1; // error
}

function operationJsonArraySlice(
    wasmModuleId: number,
    jsObjectID: number,
    from: number,
    to: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        let array = getJSObjectFromID(jsObjectID, wasmModuleId);
        if (array && Array.isArray(array)) {
            if (to == -1) {
                to = array.length;
            }

            return createWasmValue(WasmFlowRuntime, array.slice(from, to));
        }
    }

    return createWasmValue(WasmFlowRuntime, Error()); // error
}

function operationJsonArrayAppend(
    wasmModuleId: number,
    jsObjectID: number,
    valuePtr: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        let array = getJSObjectFromID(jsObjectID, wasmModuleId);
        if (array && Array.isArray(array)) {
            return createWasmValue(WasmFlowRuntime, [
                ...array,
                getValue(WasmFlowRuntime, valuePtr).value
            ]);
        }
    }

    return createWasmValue(WasmFlowRuntime, Error()); // error
}

function operationJsonArrayInsert(
    wasmModuleId: number,
    jsObjectID: number,
    position: number,
    valuePtr: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        let array = getJSObjectFromID(jsObjectID, wasmModuleId);
        if (array && Array.isArray(array)) {
            if (position < 0) {
                position = 0;
            } else if (position > array.length) {
                position = array.length;
            }

            const newArray = [
                ...array.slice(0, position),
                getValue(WasmFlowRuntime, valuePtr).value,
                ...array.slice(position)
            ];

            return createWasmValue(WasmFlowRuntime, newArray);
        }
    }

    return createWasmValue(WasmFlowRuntime, Error()); // error
}

function operationJsonArrayRemove(
    wasmModuleId: number,
    jsObjectID: number,
    position: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        let array = getJSObjectFromID(jsObjectID, wasmModuleId);
        if (array && Array.isArray(array)) {
            if (position >= 0 && position < array.length) {
                const newArray = [
                    ...array.slice(0, position),
                    ...array.slice(position + 1)
                ];

                return createWasmValue(WasmFlowRuntime, newArray);
            }
        }
    }

    return createWasmValue(WasmFlowRuntime, Error()); // error
}

function operationJsonClone(wasmModuleId: number, jsObjectID: number) {
    let value = undefined;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        value = getJSObjectFromID(jsObjectID, wasmModuleId);
        if (value) {
            value = JSON.parse(JSON.stringify(value));
        }
    }

    return createWasmValue(WasmFlowRuntime, value);
}

function operationJsonMake(wasmModuleId: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    return createWasmValue(WasmFlowRuntime, {});
}

function operationStringFormat(
    wasmModuleId: number,
    format: string,
    paramValuePtr: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        const param = getValue(WasmFlowRuntime, paramValuePtr).value;
        try {
            const result = (window as any).d3.format(format)(param);
            return createWasmValue(WasmFlowRuntime, result);
        } catch (err) {}
    }

    return createWasmValue(WasmFlowRuntime, Error()); // error
}

function operationStringFormatPrefix(
    wasmModuleId: number,
    format: string,
    valueValuePtr: number,
    paramValuePtr: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        console.log(format);
        const value = getValue(WasmFlowRuntime, valueValuePtr).value;
        console.log(value);
        const param = getValue(WasmFlowRuntime, paramValuePtr).value;
        console.log(param);
        try {
            const result = (window as any).d3.formatPrefix(
                format,
                value
            )(param);
            console.log(result);
            return createWasmValue(WasmFlowRuntime, result);
        } catch (err) {
            console.error(err);
        }
    }

    return createWasmValue(WasmFlowRuntime, Error()); // error
}

function convertFromJson(
    wasmModuleId: number,
    jsObjectID: number,
    toValueTypeIndex: number
) {
    let value = undefined;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        value = getJSObjectFromID(jsObjectID, wasmModuleId);
    }

    return createWasmValue(WasmFlowRuntime, value, toValueTypeIndex);
}

function convertToJson(wasmModuleId: number, valuePtr: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);

    return createWasmValue(
        WasmFlowRuntime,
        getValue(WasmFlowRuntime, valuePtr).value,
        +WasmFlowRuntime.assetsMap.typeIndexes["json"]
    );
}

function getObjectVariableMemberValue(
    wasmModuleId: number,
    arrayValuePtr: number,
    memberIndex: number
) {
    let value = undefined;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        value = WasmFlowRuntime.postWorkerToRendererMessage({
            getObjectVariableMemberValue: { arrayValuePtr, memberIndex }
        });
    }

    return createWasmValue(WasmFlowRuntime, value);
}

function operationBlobToString(
    wasmModuleId: number,
    blobPtr: number,
    len: number
) {
    let value = undefined;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        value = Buffer.from(
            WasmFlowRuntime.HEAP8.buffer,
            blobPtr,
            len
        ).toString("utf8");
    }

    return createWasmValue(WasmFlowRuntime, value);
}

function dashboardObjectValueIncRef(wasmModuleId: number, jsObjectID: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        jsObjectIncRef(jsObjectID, wasmModuleId);
    }
}

function dashboardObjectValueDecRef(wasmModuleId: number, jsObjectID: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        jsObjectDecRef(jsObjectID, wasmModuleId);
    }
}

function onObjectArrayValueFree(wasmModuleId: number, ptr: number) {
    console.log("onObjectArrayValueFree", wasmModuleId, ptr);

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    const arrayValue = getArrayValue(WasmFlowRuntime, ptr);
    const data: WorkerToRenderMessage = {
        freeArrayValue: arrayValue
    };

    setTimeout(() => WasmFlowRuntime.postWorkerToRendererMessage(data));
}

function getBitmapAsDataURL(wasmModuleId: number, name: string) {
    let dataURL: string | null = null;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        dataURL = WasmFlowRuntime.postWorkerToRendererMessage({
            getBitmapAsDataURL: { name }
        });
    }

    return createWasmValue(WasmFlowRuntime, dataURL);
}

function setDashboardColorTheme(wasmModuleId: number, themeName: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        WasmFlowRuntime.postWorkerToRendererMessage({
            setDashboardColorTheme: { themeName }
        });
    }
}

function getLvglScreenByName(wasmModuleId: number, name: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    return WasmFlowRuntime.postWorkerToRendererMessage({
        getLvglScreenByName: { name }
    });
}

function getLvglObjectByName(wasmModuleId: number, name: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    return WasmFlowRuntime.postWorkerToRendererMessage({
        getLvglObjectByName: { name }
    });
}

function getLvglGroupByName(wasmModuleId: number, name: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    return WasmFlowRuntime.postWorkerToRendererMessage({
        getLvglGroupByName: { name }
    });
}

function getLvglStyleByName(wasmModuleId: number, name: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    return WasmFlowRuntime.postWorkerToRendererMessage({
        getLvglStyleByName: { name }
    });
}

function getLvglImageByName(wasmModuleId: number, name: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    return WasmFlowRuntime.postWorkerToRendererMessage({
        getLvglImageByName: { name }
    });
}

function lvglObjAddStyle(
    wasmModuleId: number,
    targetObj: number,
    styleIndex: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglObjAddStyle: { targetObj, styleIndex }
    });
}

function lvglObjRemoveStyle(
    wasmModuleId: number,
    targetObj: number,
    styleIndex: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglObjRemoveStyle: { targetObj, styleIndex }
    });
}

function lvglSetColorTheme(wasmModuleId: number, themeName: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglSetColorTheme: { themeName }
    });
}

function lvglCreateScreen(wasmModuleId: number, screenIndex: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglCreateScreen: { screenIndex }
    });
}

function lvglDeleteScreen(wasmModuleId: number, screenIndex: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglDeleteScreen: { screenIndex }
    });
}

function lvglScreenTick(wasmModuleId: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglScreenTick: {}
    });
}

function lvglOnEventHandler(
    wasmModuleId: number,
    obj: number,
    eventCode: number,
    event: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    WasmFlowRuntime.postWorkerToRendererMessage({
        lvglOnEventHandler: {
            obj,
            eventCode,
            event
        }
    });
}

////////////////////////////////////////////////////////////////////////////////

(global as any).startToDebuggerMessage = startToDebuggerMessage;
(global as any).writeDebuggerBuffer = writeDebuggerBuffer;
(global as any).finishToDebuggerMessage = finishToDebuggerMessage;
(global as any).executeDashboardComponent = executeDashboardComponent;
(global as any).operationJsonGet = operationJsonGet;
(global as any).operationJsonSet = operationJsonSet;
(global as any).operationJsonArrayLength = operationJsonArrayLength;
(global as any).operationJsonArraySlice = operationJsonArraySlice;
(global as any).operationJsonArrayAppend = operationJsonArrayAppend;
(global as any).operationJsonArrayInsert = operationJsonArrayInsert;
(global as any).operationJsonArrayRemove = operationJsonArrayRemove;
(global as any).operationJsonClone = operationJsonClone;
(global as any).operationJsonMake = operationJsonMake;
(global as any).operationStringFormat = operationStringFormat;
(global as any).operationStringFormatPrefix = operationStringFormatPrefix;
(global as any).convertFromJson = convertFromJson;
(global as any).convertToJson = convertToJson;
(global as any).getObjectVariableMemberValue = getObjectVariableMemberValue;
(global as any).operationBlobToString = operationBlobToString;
(global as any).dashboardObjectValueIncRef = dashboardObjectValueIncRef;
(global as any).dashboardObjectValueDecRef = dashboardObjectValueDecRef;
(global as any).onObjectArrayValueFree = onObjectArrayValueFree;
(global as any).getBitmapAsDataURL = getBitmapAsDataURL;
(global as any).setDashboardColorTheme = setDashboardColorTheme;
(global as any).executeScpi = executeScpi;
(global as any).getLvglScreenByName = getLvglScreenByName;
(global as any).getLvglObjectByName = getLvglObjectByName;
(global as any).getLvglGroupByName = getLvglGroupByName;
(global as any).getLvglStyleByName = getLvglStyleByName;
(global as any).getLvglImageByName = getLvglImageByName;
(global as any).lvglObjAddStyle = lvglObjAddStyle;
(global as any).lvglObjRemoveStyle = lvglObjRemoveStyle;
(global as any).lvglSetColorTheme = lvglSetColorTheme;
(global as any).lvglCreateScreen = lvglCreateScreen;
(global as any).lvglDeleteScreen = lvglDeleteScreen;
(global as any).lvglScreenTick = lvglScreenTick;
(global as any).lvglOnEventHandler = lvglOnEventHandler;

////////////////////////////////////////////////////////////////////////////////

export function createWasmWorker(
    wasmModuleId: number,
    debuggerMessageSubsciptionFilter: number,
    postWorkerToRenderMessage: (data: WorkerToRenderMessage) => void,
    lvglVersion: "8.3" | "9.0" | undefined,
    displayWidth: number,
    displayHeight: number,
    darkTheme: boolean,
    screensLifetimeSupport: boolean,
    getClassByName: (className: string) => any,
    readSettings: (key: string) => any,
    writeSettings: (key: string, value: any) => any,
    hasWidgetHandle: (
        flowStateIndex: number,
        componentIndex: number
    ) => boolean,
    getWidgetHandle: (flowStateIndex: number, componentIndex: number) => number,
    getWidgetHandleInfo: (widgetHandle: number) =>
        | {
              flowStateIndex: number;
              componentIndex: number;
          }
        | undefined
) {
    let WasmFlowRuntime: IWasmFlowRuntime;

    if (lvglVersion != undefined) {
        WasmFlowRuntime = getLvglWasmFlowRuntimeConstructor(lvglVersion)(
            postWorkerToRenderMessage
        );
    } else {
        WasmFlowRuntime = eez_flow_runtime_constructor(
            postWorkerToRenderMessage
        );
    }

    WasmFlowRuntime.wasmModuleId = wasmModuleId;

    WasmFlowRuntime.getClassByName = getClassByName;
    WasmFlowRuntime.readSettings = readSettings;
    WasmFlowRuntime.writeSettings = writeSettings;
    WasmFlowRuntime.hasWidgetHandle = hasWidgetHandle;
    WasmFlowRuntime.getWidgetHandle = getWidgetHandle;
    WasmFlowRuntime.getWidgetHandleInfo = getWidgetHandleInfo;

    wasmFlowRuntimes.set(wasmModuleId, WasmFlowRuntime);

    function initObjectGlobalVariableValues(
        WasmFlowRuntime: IWasmFlowRuntime,
        globalVariables: IGlobalVariable[]
    ) {
        for (const globalVariable of globalVariables) {
            const valuePtr = createWasmValue(
                WasmFlowRuntime,
                globalVariable.value
            );
            WasmFlowRuntime._setGlobalVariable(
                globalVariable.globalVariableIndex,
                valuePtr
            );
            WasmFlowRuntime._valueFree(valuePtr);
        }
    }

    function updateObjectGlobalVariableValues(
        WasmFlowRuntime: IWasmFlowRuntime,
        globalVariables: IGlobalVariable[]
    ) {
        for (const globalVariable of globalVariables) {
            const valuePtr = createWasmValue(
                WasmFlowRuntime,
                globalVariable.value
            );
            WasmFlowRuntime._updateGlobalVariable(
                globalVariable.globalVariableIndex,
                valuePtr
            );

            WasmFlowRuntime._valueFree(valuePtr);
        }
    }

    const savedPropertyValues = new Map<number, IPropertyValue>();

    function isPropertyValueChanged(newPropertyValue: IPropertyValue) {
        const oldPropertyValue = savedPropertyValues.get(
            newPropertyValue.propertyValueIndex
        );

        function equal(oldValue: any, newValue: any) {
            if (
                oldValue instanceof Uint8Array &&
                newValue instanceof Uint8Array
            ) {
                if (oldValue.length != newValue.length) {
                    console.log("diff size");
                    return false;
                }
                for (let i = 0; i < oldValue.length; i++) {
                    if (newValue[i] != oldValue[i]) {
                        console.log("diff elem");
                        return false;
                    }
                }
                return true;
            }

            if (typeof oldValue !== typeof newValue) {
                return false;
            }

            if (typeof oldValue == "string" || typeof oldValue == "number") {
                return oldValue == newValue;
            }

            if (isArray(oldValue) && isArray(newValue)) {
                if (oldValue.length != newValue.length) {
                    return false;
                }
            }

            return deepEqual(oldValue, newValue);
        }

        if (
            oldPropertyValue &&
            oldPropertyValue.valueWithType.valueType ==
                newPropertyValue.valueWithType.valueType &&
            equal(
                oldPropertyValue.valueWithType.value,
                newPropertyValue.valueWithType.value
            )
        ) {
            // not changed
            return false;
        }

        // changed
        savedPropertyValues.set(
            newPropertyValue.propertyValueIndex,
            newPropertyValue
        );
        return true;
    }

    let stopScriptCalled = false;

    const postRendererToWorkerMessage = async function (
        rendererToWorkerMessage: RendererToWorkerMessage
    ) {
        if (stopScriptCalled) {
            return;
        }

        if (rendererToWorkerMessage.scpiResult) {
            let errorMessagePtr = 0;
            let resultPtr = 0;
            let resultLen = 0;
            let blob = 0;

            if (rendererToWorkerMessage.scpiResult.errorMessage) {
                errorMessagePtr = WasmFlowRuntime.allocateUTF8(
                    rendererToWorkerMessage.scpiResult.errorMessage
                );
            } else {
                let result = rendererToWorkerMessage.scpiResult.result!;
                if (result instanceof Uint8Array) {
                    resultPtr = WasmFlowRuntime._malloc(result.length);
                    WasmFlowRuntime.HEAPU8.set(result, resultPtr);
                    resultLen = result.length;
                    blob = 1;
                } else {
                    const resultArr = new Uint8Array(result);
                    resultPtr = WasmFlowRuntime._malloc(resultArr.length + 1);
                    WasmFlowRuntime.HEAPU8.set(resultArr, resultPtr);
                    WasmFlowRuntime.HEAPU8[resultPtr + resultArr.length] = 0;
                    resultLen = resultArr.length;
                }
            }

            WasmFlowRuntime._onScpiResult(
                errorMessagePtr,
                resultPtr,
                resultLen,
                blob
            );

            //WasmFlowRuntime._mainLoop();

            return;
        }

        if (rendererToWorkerMessage.messageFromDebugger) {
            const messageFromDebugger = new Uint8Array(
                rendererToWorkerMessage.messageFromDebugger
            );
            var ptr = WasmFlowRuntime._malloc(messageFromDebugger.length);
            WasmFlowRuntime.HEAPU8.set(messageFromDebugger, ptr);

            WasmFlowRuntime._onMessageFromDebugger(
                ptr,
                messageFromDebugger.length
            );

            WasmFlowRuntime._free(ptr);

            //WasmFlowRuntime._mainLoop();

            return;
        }

        if (rendererToWorkerMessage.executeWidgetAction) {
            const { flowStateIndex, componentIndex, outputIndex, arrayValue } =
                rendererToWorkerMessage.executeWidgetAction;

            const valuePtr = createWasmValue(WasmFlowRuntime, arrayValue);

            WasmFlowRuntime._propagateValue(
                flowStateIndex,
                componentIndex,
                outputIndex,
                valuePtr
            );

            WasmFlowRuntime._valueFree(valuePtr);

            return;
        }

        if (rendererToWorkerMessage.stopScript) {
            WasmFlowRuntime._stopScript();
            stopScriptCalled = true;
            return;
        }

        if (rendererToWorkerMessage.init) {
            console.log(rendererToWorkerMessage.init);

            WasmFlowRuntime.assetsMap = rendererToWorkerMessage.init.assetsMap;

            //
            const assets = rendererToWorkerMessage.init.assetsData;
            var ptr = WasmFlowRuntime._malloc(assets.length);
            WasmFlowRuntime.HEAPU8.set(assets, ptr);

            WasmFlowRuntime._init(
                wasmModuleId,
                debuggerMessageSubsciptionFilter,
                ptr,
                assets.length,
                displayWidth,
                displayHeight,
                darkTheme,
                -(new Date().getTimezoneOffset() / 60) * 100,
                screensLifetimeSupport
            );

            WasmFlowRuntime._free(ptr);

            initObjectGlobalVariableValues(
                WasmFlowRuntime,
                rendererToWorkerMessage.init.globalVariableValues
            );
        }

        if (rendererToWorkerMessage.wheel) {
            if (rendererToWorkerMessage.wheel.updated) {
                WasmFlowRuntime._onMouseWheelEvent(
                    rendererToWorkerMessage.wheel.deltaY,
                    rendererToWorkerMessage.wheel.pressed
                );
            }
        }

        if (rendererToWorkerMessage.pointerEvents) {
            for (
                let i = 0;
                i < rendererToWorkerMessage.pointerEvents.length;
                i++
            ) {
                const pointerEvent = rendererToWorkerMessage.pointerEvents[i];
                WasmFlowRuntime._onPointerEvent(
                    pointerEvent.x,
                    pointerEvent.y,
                    pointerEvent.pressed
                );
            }
        }

        if (rendererToWorkerMessage.keysPressed) {
            for (
                let i = 0;
                i < rendererToWorkerMessage.keysPressed.length;
                i++
            ) {
                const key = rendererToWorkerMessage.keysPressed[i];
                WasmFlowRuntime._onKeyPressed(key);
            }
        }

        if (rendererToWorkerMessage.updateGlobalVariableValues) {
            updateObjectGlobalVariableValues(
                WasmFlowRuntime,
                rendererToWorkerMessage.updateGlobalVariableValues
            );
        }

        const workerToRenderMessage: WorkerToRenderMessage = {};

        let propertyValues: IPropertyValue[] | undefined;
        if (rendererToWorkerMessage.evalProperties) {
            const MAX_ITERATORS = 4;
            const iteratorsPtr = WasmFlowRuntime._malloc(MAX_ITERATORS * 4);
            const iteratorsOffset = iteratorsPtr >> 2;

            rendererToWorkerMessage.evalProperties.forEach(evalProperty => {
                const {
                    flowStateIndex,
                    componentIndex,
                    propertyIndex,
                    propertyValueIndex,
                    indexes
                } = evalProperty;

                let iteratorsPtrTemp = 0;
                if (indexes) {
                    for (let i = 0; i < indexes.length; i++) {
                        WasmFlowRuntime.HEAP32[iteratorsOffset + i] =
                            indexes[i];
                    }

                    for (let i = indexes.length; i < MAX_ITERATORS; i++) {
                        WasmFlowRuntime.HEAP32[iteratorsOffset + i] = 0;
                    }
                    iteratorsPtrTemp = iteratorsPtr;
                }

                const valuePtr = WasmFlowRuntime._evalProperty(
                    flowStateIndex,
                    componentIndex,
                    propertyIndex,
                    iteratorsPtrTemp,
                    true
                );

                let propertyValue: IPropertyValue;

                if (!valuePtr) {
                    propertyValue = {
                        propertyValueIndex,
                        valueWithType: {
                            valueType: "undefined",
                            value: undefined
                        }
                    };
                } else {
                    const valueWithType = getValue(WasmFlowRuntime, valuePtr);

                    WasmFlowRuntime._valueFree(valuePtr);

                    propertyValue = {
                        propertyValueIndex,
                        valueWithType
                    };
                }

                if (isPropertyValueChanged(propertyValue)) {
                    if (!propertyValues) {
                        propertyValues = [];
                    }
                    propertyValues.push(propertyValue);
                }
            });

            if (iteratorsPtr) {
                WasmFlowRuntime._free(iteratorsPtr);
            }
        } else {
            savedPropertyValues.clear();
        }

        workerToRenderMessage.propertyValues = propertyValues;

        var buf_addr = WasmFlowRuntime._getSyncedBuffer();
        if (buf_addr != 0) {
            workerToRenderMessage.screen = new Uint8ClampedArray(
                WasmFlowRuntime.HEAPU8.subarray(
                    buf_addr,
                    buf_addr +
                        WasmFlowRuntime.assetsMap.displayWidth *
                            WasmFlowRuntime.assetsMap.displayHeight *
                            4
                )
            );
        }

        workerToRenderMessage.isRTL = WasmFlowRuntime._isRTL();

        let messageToDebugger = wasmModuleToMessageToDebugger.get(wasmModuleId);
        if (messageToDebugger != undefined) {
            workerToRenderMessage.messageToDebugger = messageToDebugger;
            wasmModuleToMessageToDebugger.delete(wasmModuleId);
        }

        postWorkerToRenderMessage(workerToRenderMessage);
    };

    return {
        wasm: WasmFlowRuntime,
        postMessage: postRendererToWorkerMessage,
        terminate: () => {
            wasmFlowRuntimes.delete(wasmModuleId);
            fireTerminateEvent(WasmFlowRuntime);
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

type WasmFlowRuntimeTerminateCallback = (
    WasmFlowRuntime: IWasmFlowRuntime
) => void;

const wasmFlowRuntimeTerminateCallbacks: WasmFlowRuntimeTerminateCallback[] =
    [];

export function onWasmFlowRuntimeTerminate(
    callback: WasmFlowRuntimeTerminateCallback
) {
    wasmFlowRuntimeTerminateCallbacks.push(callback);
}

export function offWasmFlowRuntimeTerminate(
    callback: WasmFlowRuntimeTerminateCallback
) {
    const i = wasmFlowRuntimeTerminateCallbacks.indexOf(callback);
    if (i != -1) {
        wasmFlowRuntimeTerminateCallbacks.splice(i, 1);
    }
}

function fireTerminateEvent(WasmFlowRuntime: IWasmFlowRuntime) {
    for (const callback of wasmFlowRuntimeTerminateCallbacks) {
        callback(WasmFlowRuntime);
    }
}

////////////////////////////////////////////////////////////////////////////////

export function sendMqttEvent(
    wasmModuleId: number,
    connectionID: number,
    eventName: string,
    eventData:
        | null
        | string
        | {
              topic: string;
              payload: string;
          }
) {
    // console.log(
    //     "sendMqttEvent",
    //     wasmModuleId,
    //     connectionID,
    //     eventName,
    //     eventData
    // );

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    const EEZ_MQTT_EVENT_CONNECT = 0;
    const EEZ_MQTT_EVENT_RECONNECT = 1;
    const EEZ_MQTT_EVENT_CLOSE = 2;
    const EEZ_MQTT_EVENT_DISCONNECT = 3;
    const EEZ_MQTT_EVENT_OFFLINE = 4;
    const EEZ_MQTT_EVENT_END = 5;
    const EEZ_MQTT_EVENT_ERROR = 6;
    const EEZ_MQTT_EVENT_MESSAGE = 7;

    let eventType = -1;
    if (eventName == "connect") {
        eventType = EEZ_MQTT_EVENT_CONNECT;
    } else if (eventName == "reconnect") {
        eventType = EEZ_MQTT_EVENT_RECONNECT;
    } else if (eventName == "close") {
        eventType = EEZ_MQTT_EVENT_CLOSE;
    } else if (eventName == "disconnect") {
        eventType = EEZ_MQTT_EVENT_DISCONNECT;
    } else if (eventName == "offline") {
        eventType = EEZ_MQTT_EVENT_OFFLINE;
    } else if (eventName == "error") {
        eventType = EEZ_MQTT_EVENT_ERROR;
    } else if (eventName == "message") {
        eventType = EEZ_MQTT_EVENT_MESSAGE;
    } else if (eventName == "end") {
        eventType = EEZ_MQTT_EVENT_END;
    }
    if (eventType == -1) {
        return;
    }

    let eventDataPtr1;
    let eventDataPtr2;
    if (eventData != null) {
        if (typeof eventData == "string") {
            eventDataPtr1 = WasmFlowRuntime.allocateUTF8(eventData);
            eventDataPtr2 = 0;
        } else {
            eventDataPtr1 = WasmFlowRuntime.allocateUTF8(eventData.topic);
            eventDataPtr2 = WasmFlowRuntime.allocateUTF8(eventData.payload);
        }
    } else {
        eventDataPtr1 = 0;
        eventDataPtr2 = 0;
    }

    WasmFlowRuntime._onMqttEvent(
        connectionID,
        eventType,
        eventDataPtr1,
        eventDataPtr2
    );

    if (eventDataPtr1) {
        WasmFlowRuntime._free(eventDataPtr1);
    }

    if (eventDataPtr2) {
        WasmFlowRuntime._free(eventDataPtr2);
    }
}
