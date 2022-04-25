require("project-editor/flow/runtime/flow_runtime.js");

import deepEqual from "deep-equal";

import type {
    RendererToWorkerMessage,
    WorkerToRenderMessage,
    IPropertyValue,
    IGlobalVariable
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import { init as initExecuteFunctions } from "project-editor/flow/runtime/wasm-execute-functions-init";
import { actionConmponentExecuteFunctions } from "project-editor/flow/runtime/wasm-execute-functions";
import {
    getValue,
    getArrayValue,
    createWasmValue
} from "project-editor/flow/runtime/wasm-value";
import { DashboardComponentContext } from "project-editor/flow/runtime/worker-dashboard-component-context";

function startToDebuggerMessage() {}

function writeDebuggerBuffer(arr: any) {
    const data: WorkerToRenderMessage = {
        messageToDebugger: new Uint8Array(arr)
    };

    postMessage(data);
}

function finishToDebuggerMessage() {}

function executeScpi(instrumentPtr: number, arr: any, isQuery: number) {
    const result = getArrayValue(instrumentPtr, ["object:Instrument"]);
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

    postMessage(data);
}

function executeDashboardComponent(
    componentType: number,
    flowStateIndex: number,
    componentIndex: number
) {
    const dashboardComponentContext = new DashboardComponentContext(
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

(global as any).startToDebuggerMessage = startToDebuggerMessage;
(global as any).writeDebuggerBuffer = writeDebuggerBuffer;
(global as any).finishToDebuggerMessage = finishToDebuggerMessage;
(global as any).executeDashboardComponent = executeDashboardComponent;
(global as any).executeScpi = executeScpi;

function initObjectGlobalVariableValues(globalVariables: IGlobalVariable[]) {
    for (const globalVariable of globalVariables) {
        const valuePtr = createWasmValue(globalVariable.value);
        WasmFlowRuntime._setGlobalVariable(
            globalVariable.globalVariableIndex,
            valuePtr
        );
        WasmFlowRuntime._valueFree(valuePtr);
    }
}

function updateObjectGlobalVariableValues(globalVariables: IGlobalVariable[]) {
    for (const globalVariable of globalVariables) {
        const valuePtr = createWasmValue(globalVariable.value);
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

let displayWidth = 480;
let displayHeight = 272;

onmessage = async function (e: { data: RendererToWorkerMessage }) {
    if (e.data.scpiResult) {
        let errorMessagePtr = 0;
        let resultPtr = 0;
        let resultLen = 0;
        let blob = 0;

        if (e.data.scpiResult.errorMessage) {
            errorMessagePtr = WasmFlowRuntime.allocateUTF8(
                e.data.scpiResult.errorMessage
            );
        } else {
            let result = e.data.scpiResult.result!;
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

    if (e.data.messageFromDebugger) {
        const messageFromDebugger = new Uint8Array(e.data.messageFromDebugger);
        var ptr = WasmFlowRuntime._malloc(messageFromDebugger.length);
        WasmFlowRuntime.HEAPU8.set(messageFromDebugger, ptr);

        WasmFlowRuntime._onMessageFromDebugger(ptr, messageFromDebugger.length);

        WasmFlowRuntime._free(ptr);

        WasmFlowRuntime._mainLoop();

        return;
    }

    if (e.data.executeWidgetAction) {
        const { flowStateIndex, componentIndex, outputIndex, arrayValue } =
            e.data.executeWidgetAction;

        const valuePtr = createWasmValue(arrayValue);

        WasmFlowRuntime._propagateValue(
            flowStateIndex,
            componentIndex,
            outputIndex,
            valuePtr
        );

        WasmFlowRuntime._valueFree(valuePtr);

        return;
    }

    if (e.data.resultToWorker) {
        const callback = componentMessageCallbacks.get(
            e.data.resultToWorker.messageId
        );
        if (callback) {
            callback(e.data.resultToWorker.result);
            if (e.data.resultToWorker.finalResult) {
                componentMessageCallbacks.delete(
                    e.data.resultToWorker.messageId
                );
            }
        } else {
            console.error("Unexpected: there is no worker callback");
        }
        return;
    }

    if (e.data.init) {
        console.log(e.data.init);

        await initExecuteFunctions(e.data.init.nodeModuleFolders);

        WasmFlowRuntime.assetsMap = e.data.init.assetsMap;

        //
        const assets = e.data.init.assetsData;
        var ptr = WasmFlowRuntime._malloc(assets.length);
        WasmFlowRuntime.HEAPU8.set(assets, ptr);

        displayWidth = e.data.init.displayWidth;
        displayHeight = e.data.init.displayHeight;

        WasmFlowRuntime._init(
            ptr,
            assets.length,
            e.data.init.displayWidth,
            e.data.init.displayHeight
        );

        WasmFlowRuntime._free(ptr);

        initObjectGlobalVariableValues(e.data.init.globalVariableValues);

        WasmFlowRuntime._startFlow();
    }

    if (e.data.wheel) {
        if (e.data.wheel.deltaY != 0 || e.data.wheel.clicked != 0) {
            WasmFlowRuntime._onMouseWheelEvent(
                e.data.wheel.deltaY,
                e.data.wheel.clicked
            );
        }
    }

    if (e.data.pointerEvents) {
        for (let i = 0; i < e.data.pointerEvents.length; i++) {
            const pointerEvent = e.data.pointerEvents[i];
            WasmFlowRuntime._onPointerEvent(
                pointerEvent.x,
                pointerEvent.y,
                pointerEvent.pressed
            );
        }
    }

    if (e.data.updateGlobalVariableValues) {
        updateObjectGlobalVariableValues(e.data.updateGlobalVariableValues);
    }

    if (e.data.assignProperties) {
        e.data.assignProperties.forEach(assignProperty => {
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
                    arr[i] = indexes.length < MAX_ITERATORS ? indexes[i] : 0;
                }
                iteratorsPtr = WasmFlowRuntime._malloc(MAX_ITERATORS * 4);
                WasmFlowRuntime.HEAP32.set(arr, iteratorsPtr >> 2);
            }

            const valuePtr = createWasmValue(value);

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
    if (e.data.evalProperties) {
        e.data.evalProperties.forEach(evalProperty => {
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
                    arr[i] = indexes.length < MAX_ITERATORS ? indexes[i] : 0;
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
                const valueWithType = getValue(valuePtr);

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

    const data: WorkerToRenderMessage = {
        propertyValues
    };

    if (WasmFlowRuntime.componentMessages) {
        const componentMessages: IMessageFromWorker[] = [];
        data.componentMessages = componentMessages;

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
        data.screen = new Uint8ClampedArray(
            WasmFlowRuntime.HEAPU8.subarray(
                buf_addr,
                buf_addr + displayWidth * displayHeight * 4
            )
        );
    }

    postMessage(data);
};
