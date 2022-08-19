import deepEqual from "deep-equal";

import type {
    RendererToWorkerMessage,
    WorkerToRenderMessage,
    IPropertyValue,
    IGlobalVariable
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import { init as initExecuteFunctions } from "project-editor/flow/runtime/wasm-execute-functions-init";
import {
    actionConmponentExecuteFunctions,
    wasmFlowRuntimeTerminateCallbacks
} from "project-editor/flow/runtime/wasm-execute-functions";
import {
    getValue,
    getArrayValue,
    createWasmValue
} from "project-editor/flow/runtime/wasm-value";
import { DashboardComponentContext } from "project-editor/flow/runtime/worker-dashboard-component-context";
import { IWasmFlowRuntime } from "eez-studio-types";

const flow_runtime_constructor = require("project-editor/flow/runtime/flow_runtime.js");

////////////////////////////////////////////////////////////////////////////////

const wasmFlowRuntimes = new Map<number, IWasmFlowRuntime>();

function getWasmFlowRuntime(wasmModuleId: number) {
    return wasmFlowRuntimes.get(wasmModuleId)!;
}

function startToDebuggerMessage(wasmModuleId: number) {}

function writeDebuggerBuffer(wasmModuleId: number, arr: any) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);
    if (!WasmFlowRuntime) {
        return;
    }
    const data: WorkerToRenderMessage = {
        messageToDebugger: new Uint8Array(arr)
    };

    WasmFlowRuntime.postWorkerToRendererMessage(data);
}

function finishToDebuggerMessage(wasmModuleId: number) {}

function executeScpi(
    wasmModuleId: number,
    instrumentPtr: number,
    arr: any,
    isQuery: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);

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
            isQuery: isQuery ? true : false
        }
    };

    WasmFlowRuntime.postWorkerToRendererMessage(data);
}

function executeDashboardComponent(
    wasmModuleId: number,
    componentType: number,
    flowStateIndex: number,
    componentIndex: number
) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);

    const dashboardComponentContext = new DashboardComponentContext(
        WasmFlowRuntime,
        flowStateIndex,
        componentIndex
    );

    const componentName =
        WasmFlowRuntime.assetsMap.dashboardComponentTypeToNameMap[
            componentType
        ];

    const executeFunction = actionConmponentExecuteFunctions[componentName];
    if (executeFunction) {
        executeFunction(dashboardComponentContext);
    } else {
        dashboardComponentContext.throwError(
            `Unknown component ${componentName}`
        );
    }
}

function onArrayValueFree(wasmModuleId: number, ptr: number) {
    const WasmFlowRuntime = getWasmFlowRuntime(wasmModuleId);

    const arrayValue = getArrayValue(WasmFlowRuntime, ptr);
    const data: WorkerToRenderMessage = {
        freeArrayValue: arrayValue
    };
    WasmFlowRuntime.postWorkerToRendererMessage(data);
}

function getCurrentWorkingDirectory() {
    return process.cwd();
}

(global as any).startToDebuggerMessage = startToDebuggerMessage;
(global as any).writeDebuggerBuffer = writeDebuggerBuffer;
(global as any).finishToDebuggerMessage = finishToDebuggerMessage;
(global as any).executeDashboardComponent = executeDashboardComponent;
(global as any).onArrayValueFree = onArrayValueFree;
(global as any).executeScpi = executeScpi;
(global as any).getCurrentWorkingDirectory = getCurrentWorkingDirectory;

////////////////////////////////////////////////////////////////////////////////

export function createWasmWorker(
    wasmModuleId: number,
    postWorkerToRenderMessage: (data: WorkerToRenderMessage) => void
) {
    const WasmFlowRuntime: IWasmFlowRuntime = flow_runtime_constructor(
        postWorkerToRenderMessage
    );

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

        if (
            oldPropertyValue &&
            oldPropertyValue.valueWithType.valueType ==
                newPropertyValue.valueWithType.valueType &&
            deepEqual(
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

    const componentMessageCallbacks = new Map<number, (result: any) => void>();

    const postRendererToWorkerMessage = async function (
        rendererToWorkerMessage: RendererToWorkerMessage
    ) {
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

            WasmFlowRuntime._mainLoop();

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

            WasmFlowRuntime._mainLoop();

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

        if (rendererToWorkerMessage.resultToWorker) {
            const callback = componentMessageCallbacks.get(
                rendererToWorkerMessage.resultToWorker.messageId
            );
            if (callback) {
                callback(rendererToWorkerMessage.resultToWorker.result);
                if (rendererToWorkerMessage.resultToWorker.finalResult) {
                    componentMessageCallbacks.delete(
                        rendererToWorkerMessage.resultToWorker.messageId
                    );
                }
            } else {
                console.error("Unexpected: there is no worker callback");
            }
            return;
        }

        if (rendererToWorkerMessage.stopScript) {
            WasmFlowRuntime._stopScript();
            return;
        }

        if (rendererToWorkerMessage.init) {
            console.log(rendererToWorkerMessage.init);

            await initExecuteFunctions(
                rendererToWorkerMessage.init.nodeModuleFolders
            );

            WasmFlowRuntime.assetsMap = rendererToWorkerMessage.init.assetsMap;

            //
            const assets = rendererToWorkerMessage.init.assetsData;
            var ptr = WasmFlowRuntime._malloc(assets.length);
            WasmFlowRuntime.HEAPU8.set(assets, ptr);

            WasmFlowRuntime._init(wasmModuleId, ptr, assets.length);

            WasmFlowRuntime._free(ptr);

            initObjectGlobalVariableValues(
                WasmFlowRuntime,
                rendererToWorkerMessage.init.globalVariableValues
            );

            WasmFlowRuntime._startFlow();
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

        if (rendererToWorkerMessage.assignProperties) {
            rendererToWorkerMessage.assignProperties.forEach(assignProperty => {
                const {
                    flowStateIndex,
                    componentIndex,
                    propertyIndex,
                    indexes,
                    value
                } = assignProperty;

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

                const valuePtr = createWasmValue(WasmFlowRuntime, value);

                if (valuePtr) {
                    WasmFlowRuntime._assignProperty(
                        flowStateIndex,
                        componentIndex,
                        propertyIndex,
                        iteratorsPtr,
                        valuePtr
                    );

                    WasmFlowRuntime._valueFree(valuePtr);
                }

                if (iteratorsPtr) {
                    WasmFlowRuntime._free(iteratorsPtr);
                }
            });
        }

        if (!WasmFlowRuntime._mainLoop()) {
            // flow is stopped
            return;
        }

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
                    iteratorsPtr
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

        const workerToRenderMessage: WorkerToRenderMessage = {
            propertyValues
        };

        if (WasmFlowRuntime.componentMessages) {
            const componentMessages: IMessageFromWorker[] = [];
            workerToRenderMessage.componentMessages = componentMessages;

            WasmFlowRuntime.componentMessages.forEach(componentMessage => {
                if (componentMessage.callback) {
                    componentMessageCallbacks.set(
                        componentMessage.id,
                        componentMessage.callback
                    );
                    componentMessage.callback = undefined;
                }
                componentMessages?.push(componentMessage);
            });

            WasmFlowRuntime.componentMessages = undefined;
        }

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

        postWorkerToRenderMessage(workerToRenderMessage);
    };

    return {
        postMessage: postRendererToWorkerMessage,
        terminate: () => {
            wasmFlowRuntimes.delete(wasmModuleId);
            fireTerminateEvent(WasmFlowRuntime);
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

function fireTerminateEvent(WasmFlowRuntime: IWasmFlowRuntime) {
    for (const callback of wasmFlowRuntimeTerminateCallbacks) {
        callback(WasmFlowRuntime);
    }
}
