require("project-editor/flow/runtime/flow_runtime.js");

import type {
    RendererToWorkerMessage,
    WorkerToRenderMessage
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import { actionConmponentExecuteFunctions } from "project-editor/flow/components/actions/execute";
import {
    FLOW_VALUE_TYPE_ARRAY,
    FLOW_VALUE_TYPE_ARRAY_REF,
    FLOW_VALUE_TYPE_BOOLEAN,
    FLOW_VALUE_TYPE_DOUBLE,
    FLOW_VALUE_TYPE_FLOAT,
    FLOW_VALUE_TYPE_INT16,
    FLOW_VALUE_TYPE_INT32,
    FLOW_VALUE_TYPE_INT64,
    FLOW_VALUE_TYPE_INT8,
    FLOW_VALUE_TYPE_NULL,
    FLOW_VALUE_TYPE_STRING,
    FLOW_VALUE_TYPE_STRING_REF,
    FLOW_VALUE_TYPE_UINT16,
    FLOW_VALUE_TYPE_UINT32,
    FLOW_VALUE_TYPE_UINT64,
    FLOW_VALUE_TYPE_UINT8,
    FLOW_VALUE_TYPE_UNDEFINED
} from "project-editor/build/value-types";
import type { ArrayValue } from "project-editor/flow/expression/type";
import type { AssetsMap } from "project-editor/build/assets";

let allDebuggerMessages: Uint8Array | undefined;
let currentDebuggerMessage: Uint8Array | undefined;

function mergeArray(arrayOne: Uint8Array | undefined, arrayTwo: Uint8Array) {
    if (arrayOne) {
        var mergedArray = new Uint8Array(arrayOne.length + arrayTwo.length);
        mergedArray.set(arrayOne);
        mergedArray.set(arrayTwo, arrayOne.length);
        return mergedArray;
    } else {
        return arrayTwo;
    }
}

function startToDebuggerMessage() {
    finishToDebuggerMessage();
}

function writeDebuggerBuffer(arr: any) {
    currentDebuggerMessage = mergeArray(
        currentDebuggerMessage,
        new Uint8Array(arr)
    );
}

function finishToDebuggerMessage() {
    if (currentDebuggerMessage) {
        allDebuggerMessages = mergeArray(
            allDebuggerMessages,
            currentDebuggerMessage
        );
        currentDebuggerMessage = undefined;
    }
}

let assetsMap: AssetsMap;

function getValue(offset: number) {
    const type = WasmFlowRuntime.HEAPU8[offset];
    offset += 8;
    if (type == FLOW_VALUE_TYPE_UNDEFINED) {
        return undefined;
    } else if (type == FLOW_VALUE_TYPE_NULL) {
        return null;
    } else if (type == FLOW_VALUE_TYPE_BOOLEAN) {
        return WasmFlowRuntime.HEAP32[offset >> 2] ? true : false;
    } else if (type == FLOW_VALUE_TYPE_INT8) {
        return WasmFlowRuntime.HEAP8[offset];
    } else if (type == FLOW_VALUE_TYPE_UINT8) {
        return WasmFlowRuntime.HEAPU8[offset];
    } else if (type == FLOW_VALUE_TYPE_INT16) {
        return WasmFlowRuntime.HEAP16[offset >> 1];
    } else if (type == FLOW_VALUE_TYPE_UINT16) {
        return WasmFlowRuntime.HEAPU16[offset >> 1];
    } else if (type == FLOW_VALUE_TYPE_INT32) {
        return WasmFlowRuntime.HEAP32[offset >> 2];
    } else if (type == FLOW_VALUE_TYPE_UINT32) {
        return WasmFlowRuntime.HEAPU32[offset >> 2];
    } else if (type == FLOW_VALUE_TYPE_INT64) {
        // TODO
        return null;
    } else if (type == FLOW_VALUE_TYPE_UINT64) {
        // TODO
        return null;
    } else if (type == FLOW_VALUE_TYPE_FLOAT) {
        return WasmFlowRuntime.HEAPF32[offset >> 2];
    } else if (type == FLOW_VALUE_TYPE_DOUBLE) {
        return WasmFlowRuntime.HEAPF64[offset >> 3];
    } else if (type == FLOW_VALUE_TYPE_STRING) {
        const ptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return WasmFlowRuntime.AsciiToString(ptr);
    } else if (type == FLOW_VALUE_TYPE_ARRAY) {
        const ptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return getArrayValue(ptr);
    } else if (type == FLOW_VALUE_TYPE_STRING_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = WasmFlowRuntime.HEAP32[(refPtr >> 2) + 2];
        return WasmFlowRuntime.AsciiToString(ptr);
    } else if (type == FLOW_VALUE_TYPE_ARRAY_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = refPtr + 8;
        return getArrayValue(ptr);
    }

    console.error("Unknown type from WASM: ", type);
    return undefined;
}

function getArrayValue(offset: number): { arrayType: number; fields: any[] } {
    const arraySize = WasmFlowRuntime.HEAPU32[offset >> 2];
    const arrayType = WasmFlowRuntime.HEAPU32[(offset >> 2) + 1];
    const fields = [];
    for (let i = 0; i < arraySize; i++) {
        fields.push(getValue(offset + 8 + i * 16));
    }

    return {
        arrayType,
        fields
    };
}

function executeScpi(instrumentPtr: number, arr: any) {
    const instrument = getArrayValue(instrumentPtr);

    if (
        assetsMap.valueTypes[instrument.arrayType] !=
        "dynamic:@object:Instrument"
    ) {
        WasmFlowRuntime._onScpiResult(
            WasmFlowRuntime.allocateUTF8("Invalid instrument"),
            0,
            0
        );
        return;
    }

    const dynamicType = assetsMap.dynamicTypes["@object:Instrument"];
    if (!dynamicType) {
        WasmFlowRuntime._onScpiResult(
            WasmFlowRuntime.allocateUTF8("Unexpected"),
            0,
            0
        );
        return;
    }

    let instrumentId;
    for (let i = 0; i < dynamicType.fields.length; i++) {
        if (dynamicType.fields[i].name == "id") {
            instrumentId = instrument.fields[i];
            break;
        }
    }

    if (typeof instrumentId != "string") {
        WasmFlowRuntime._onScpiResult(
            WasmFlowRuntime.allocateUTF8("Instrument id is not string"),
            0,
            0
        );
        return;
    }

    postMessage({
        scpiCommand: {
            instrumentId,
            command: new Uint8Array(arr)
        }
    });
}

export class DashboardComponentContext {
    context: number = 0;

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
        assetsMap.dashboardComponentTypeToNameMap[componentType];

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

function createArrayValue(arrayValue: ArrayValue) {
    const arraySize = arrayValue.values.length;
    const arrayValuePtr = WasmFlowRuntime._arrayValueAlloc(
        arraySize,
        arrayValue.valueTypeIndex
    );
    for (let i = 0; i < arraySize; i++) {
        const value = arrayValue.values[i];
        if (typeof value == "number") {
            if (Number.isInteger(value)) {
                WasmFlowRuntime._arrayValueSetElementInt(
                    arrayValuePtr,
                    i,
                    value
                );
            } else {
                WasmFlowRuntime._arrayValueSetElementDouble(
                    arrayValuePtr,
                    i,
                    value
                );
            }
        } else if (typeof value == "boolean") {
            WasmFlowRuntime._arrayValueSetElementBool(arrayValuePtr, i, value);
        } else if (typeof value == "string") {
            const valuePtr = WasmFlowRuntime.allocateUTF8(value);
            WasmFlowRuntime._arrayValueSetElementString(
                arrayValuePtr,
                i,
                valuePtr
            );
            WasmFlowRuntime._free(arrayValuePtr);
        } else if (value == null) {
            WasmFlowRuntime._arrayValueSetElementNull(arrayValuePtr, i);
        } else {
            const valuePtr = createArrayValue(value);
            WasmFlowRuntime._arrayValueSetElementValue(
                arrayValuePtr,
                i,
                valuePtr
            );
            WasmFlowRuntime._valueFree(valuePtr);
        }
    }
    return arrayValuePtr;
}

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

    if (e.data.init) {
        //console.log(e.data.init);

        assetsMap = e.data.init.assetsMap;

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
            const valuePtr = createArrayValue(
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

    if (e.data.messageFromDebugger) {
        const messageFromDebugger = new Uint8Array(e.data.messageFromDebugger);
        var ptr = WasmFlowRuntime._malloc(messageFromDebugger.length);
        WasmFlowRuntime.HEAPU8.set(messageFromDebugger, ptr);

        WasmFlowRuntime._onMessageFromDebugger(ptr, messageFromDebugger.length);

        WasmFlowRuntime._free(ptr);
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

    if (allDebuggerMessages) {
        data.messageToDebugger = allDebuggerMessages;
        allDebuggerMessages = undefined;
    }

    postMessage(data);
};
