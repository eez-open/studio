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
    property: string
) {
    let value = undefined;

    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (WasmFlowRuntime) {
        value = getJSObjectFromID(jsObjectID, wasmModuleId);
        const propertyParts = property.split(".");
        for (let i = 0; value && i < propertyParts.length; i++) {
            value = value[propertyParts[i]];
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

function getLvglImageByName(wasmModuleId: number, name: string) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }

    return WasmFlowRuntime.postWorkerToRendererMessage({
        getLvglImageByName: { name }
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
(global as any).operationJsonClone = operationJsonClone;
(global as any).dashboardObjectValueIncRef = dashboardObjectValueIncRef;
(global as any).dashboardObjectValueDecRef = dashboardObjectValueDecRef;
(global as any).onObjectArrayValueFree = onObjectArrayValueFree;
(global as any).executeScpi = executeScpi;
(global as any).getLvglImageByName = getLvglImageByName;

////////////////////////////////////////////////////////////////////////////////

export function createWasmWorker(
    wasmModuleId: number,
    debuggerMessageSubsciptionFilter: number,
    postWorkerToRenderMessage: (data: WorkerToRenderMessage) => void,
    lvglVersion: "8.3" | "9.0" | undefined,
    displayWidth: number,
    displayHeight: number,
    getClassByName: (className: string) => any,
    readSettings: (key: string) => any,
    writeSettings: (key: string, value: any) => any,
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

                for (let i = 0; i < oldValue.length; i++) {
                    if (
                        typeof newValue[i] == "object" &&
                        typeof oldValue[i] == "object"
                    ) {
                        // optimization: skip deep comparison of object elements
                        continue;
                    }
                    if (newValue[i] != oldValue[i]) {
                        return false;
                    }
                }

                return true;
            }

            const deepEqual =
                require("deep-equal") as typeof import("deep-equal");
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
                -(new Date().getTimezoneOffset() / 60) * 100
            );

            WasmFlowRuntime._free(ptr);

            initObjectGlobalVariableValues(
                WasmFlowRuntime,
                rendererToWorkerMessage.init.globalVariableValues
            );
        }

        if (rendererToWorkerMessage.wheel) {
            if (
                rendererToWorkerMessage.wheel.deltaY != 0 ||
                rendererToWorkerMessage.wheel.clicked != 0
            ) {
                WasmFlowRuntime._onMouseWheelEvent(
                    rendererToWorkerMessage.wheel.deltaY,
                    rendererToWorkerMessage.wheel.clicked
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

        if (rendererToWorkerMessage.updateGlobalVariableValues) {
            updateObjectGlobalVariableValues(
                WasmFlowRuntime,
                rendererToWorkerMessage.updateGlobalVariableValues
            );
        }

        const workerToRenderMessage: WorkerToRenderMessage = {};

        let propertyValues: IPropertyValue[] | undefined;
        if (rendererToWorkerMessage.evalProperties) {
            rendererToWorkerMessage.evalProperties.forEach(evalProperty => {
                const {
                    flowStateIndex,
                    componentIndex,
                    propertyIndex,
                    propertyValueIndex,
                    indexes
                } = evalProperty;

                let iteratorsPtr = 0;
                if (indexes) {
                    const MAX_ITERATORS = 4;

                    const arr = new Uint32Array(MAX_ITERATORS);
                    for (let i = 0; i < MAX_ITERATORS; i++) {
                        arr[i] =
                            indexes.length < MAX_ITERATORS ? indexes[i] : 0;
                    }
                    iteratorsPtr = WasmFlowRuntime._malloc(MAX_ITERATORS * 4);
                    WasmFlowRuntime.HEAP32.set(arr, iteratorsPtr >> 2);
                }

                const valuePtr = WasmFlowRuntime._evalProperty(
                    flowStateIndex,
                    componentIndex,
                    propertyIndex,
                    iteratorsPtr,
                    true
                );

                if (iteratorsPtr) {
                    WasmFlowRuntime._free(iteratorsPtr);
                }

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
