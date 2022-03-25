require("project-editor/flow/runtime/flow_runtime.js");

import type {
    RendererToWorkerMessage,
    WorkerToRenderMessage
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import { actionConmponentExecuteFunctions } from "project-editor/flow/components/actions/execute";
import {
    createWasmArrayValue,
    getValue,
    getArrayValue
} from "project-editor/flow/runtime/wasm-value";
import type { ValueType } from "eez-studio-types";

function startToDebuggerMessage() {}

function writeDebuggerBuffer(arr: any) {
    const data: WorkerToRenderMessage = {
        messageToDebugger: new Uint8Array(arr)
    };

    postMessage(data);
}

function finishToDebuggerMessage() {}

function executeScpi(instrumentPtr: number, arr: any) {
    const result = getArrayValue(instrumentPtr, ["object:Instrument"]);
    if (!result) {
        WasmFlowRuntime._onScpiResult(
            WasmFlowRuntime.allocateUTF8("Invalid instrument"),
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
            command: new Uint8Array(arr)
        }
    };

    postMessage(data);
}

export class DashboardComponentContext {
    context: number = 0;

    evalProperty<T>(propertyIndex: number, expectedTypes?: ValueType[]) {
        const valuePtr = WasmFlowRuntime._DashboardContext_evalProperty(
            this.context,
            propertyIndex
        );

        if (!valuePtr) {
            return undefined;
        }

        const result = getValue(valuePtr);

        WasmFlowRuntime._valueFree(valuePtr);

        if (expectedTypes && expectedTypes.indexOf(result.valueType) == -1) {
            return undefined;
        }

        return result.value as any as T;
    }

    getStringParam(offset: number) {
        const ptr = WasmFlowRuntime._DashboardContext_getStringParam(
            this.context,
            offset
        );
        return WasmFlowRuntime.AsciiToString(ptr);
    }

    getExpressionListParam(offset: number) {
        const ptr = WasmFlowRuntime._DashboardContext_getExpressionListParam(
            this.context,
            offset
        );

        const values: any[] = [];

        if (ptr) {
            const count = WasmFlowRuntime.HEAPU32[(ptr >> 2) + 0];
            for (let i = 0; i < count; i++) {
                let offset = ptr + 8 + 16 * i;
                values.push(getValue(offset));
            }

            WasmFlowRuntime._DashboardContext_freeExpressionListParam(
                this.context,
                ptr
            );
        }

        return values;
    }

    propagateValue(outputIndex: number, value: any) {
        if (typeof value == "number") {
            if (Number.isInteger(value)) {
                WasmFlowRuntime._DashboardContext_propagateIntValue(
                    this.context,
                    outputIndex,
                    value
                );
            } else {
                WasmFlowRuntime._DashboardContext_propagateDoubleValue(
                    this.context,
                    outputIndex,
                    value
                );
            }
        } else if (typeof value == "boolean") {
            WasmFlowRuntime._DashboardContext_propagateBooleanValue(
                this.context,
                outputIndex,
                value
            );
        } else if (typeof value == "string") {
            const valuePtr = WasmFlowRuntime.allocateUTF8(value);
            WasmFlowRuntime._DashboardContext_propagateStringValue(
                this.context,
                outputIndex,
                valuePtr
            );
            WasmFlowRuntime._free(valuePtr);
        }
    }

    propagateValueThroughSeqout(): void {
        WasmFlowRuntime._DashboardContext_propagateValueThroughSeqout(
            this.context
        );
    }

    throwError(errorMessage: string) {
        const errorMessagePtr = WasmFlowRuntime.allocateUTF8(errorMessage);
        WasmFlowRuntime._DashboardContext_throwError(
            this.context,
            errorMessagePtr
        );
        WasmFlowRuntime._free(errorMessagePtr);
    }
}
const dashboardComponentContext = new DashboardComponentContext();

function executeDashboardComponent(componentType: number, context: number) {
    dashboardComponentContext.context = context;

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

onmessage = function (e: { data: RendererToWorkerMessage }) {
    if (e.data.scpiResult) {
        let errorMessagePtr = 0;
        if (e.data.scpiResult.errorMessage) {
            errorMessagePtr = WasmFlowRuntime.allocateUTF8(
                e.data.scpiResult.errorMessage
            );
        }

        let resultPtr = 0;
        let resultLen = 0;
        if (e.data.scpiResult.result) {
            const resultArr = new Uint8Array(e.data.scpiResult.result);
            resultPtr = WasmFlowRuntime._malloc(resultArr.length);
            WasmFlowRuntime.HEAPU8.set(resultArr, resultPtr);
            resultLen = resultArr.length;
        }

        WasmFlowRuntime._onScpiResult(errorMessagePtr, resultPtr, resultLen);

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

    if (e.data.init) {
        WasmFlowRuntime.assetsMap = e.data.init.assetsMap;

        //
        const assets = e.data.init.assetsData;
        var ptr = WasmFlowRuntime._malloc(assets.length);
        WasmFlowRuntime.HEAPU8.set(assets, ptr);

        WasmFlowRuntime._init(ptr, assets.length);

        WasmFlowRuntime._free(ptr);

        //
        const objectGlobalVariableValues =
            e.data.init.objectGlobalVariableValues;
        for (let i = 0; i < objectGlobalVariableValues.length; i++) {
            const objectGlobalVariableValue = objectGlobalVariableValues[i];
            const valuePtr = createWasmArrayValue(
                objectGlobalVariableValue.arrayValue
            );
            WasmFlowRuntime._setGlobalVariable(
                objectGlobalVariableValue.globalVariableIndex,
                valuePtr
            );
            WasmFlowRuntime._valueFree(valuePtr);
        }

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

    WasmFlowRuntime._mainLoop();

    const WIDTH = 480;
    const HEIGHT = 272;

    const data: WorkerToRenderMessage = {};

    var buf_addr = WasmFlowRuntime._getSyncedBuffer();
    if (buf_addr != 0) {
        data.screen = new Uint8ClampedArray(
            WasmFlowRuntime.HEAPU8.subarray(
                buf_addr,
                buf_addr + WIDTH * HEIGHT * 4
            )
        );
    }

    postMessage(data);
};
