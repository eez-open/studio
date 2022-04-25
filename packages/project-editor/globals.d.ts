/// <reference path="../eez-studio-shared/globals.d.ts"/>

declare const opentype: {
    parse(arg: any): any;
};

declare const ace: {
    edit(arg: any): any;
    acequire(arg: any): any;
};

declare module "jspanel4";

//

type IIndexes = { [key: string]: number };

interface IField {
    name: string;
    valueType: ValueType;
}

interface ITypeBase {
    kind: "object" | "array";
    valueType: ValueType;
}

interface IObjectType {
    kind: "object";
    valueType: ValueType;
    fields: IField[];
    fieldIndexes: IIndexes;
    open: boolean;
}

interface IArrayType {
    kind: "array";
    valueType: ValueType;
    elementType: IType;
}

interface IBasicType {
    kind: "basic";
    valueType: ValueType;
}

type IType = IArrayType | IObjectType | IBasicType;

interface AssetsMap {
    flows: {
        flowIndex: number;
        path: string;
        readablePath: string;
        components: {
            componentIndex: number;
            path: string;
            readablePath: string;
            inputIndexes: {
                [inputName: string]: number;
            };
            outputs: {
                outputName: string;
                valueTypeIndex: number;
                connectionLines: {
                    targetComponentIndex: number;
                    targetInputIndex: number;
                }[];
            }[];
            outputIndexes: {
                [outputName: string]: number;
            };
            properties: {
                valueTypeIndex: number;
            }[];
            propertyIndexes: {
                [propertyName: string]: number;
            };
        }[];
        componentIndexes: { [path: string]: number };
        componentInputs: {
            inputIndex: number;
            componentIndex: number;
            inputName: string;
            inputType: string;
        }[];
        localVariables: {
            index: number;
            name: string;
        }[];
        widgetDataItems: {
            widgetDataItemIndex: number;
            flowIndex: number;
            componentIndex: number;
            propertyValueIndex: number;
        }[];
        widgetActions: {
            widgetActionIndex: number;
            flowIndex: number;
            componentIndex: number;
            outputIndex: number;
        }[];
    }[];
    flowIndexes: { [path: string]: number };
    actionFlowIndexes: { [actionName: string]: number };
    constants: any[];
    globalVariables: {
        index: number;
        name: string;
    }[];
    dashboardComponentTypeToNameMap: {
        [componentType: number]: string;
    };
    types: IType[];
    typeIndexes: IIndexes;
}

interface IMessageFromWorker {
    id: number;
    flowStateIndex: number;
    componentIndex: number;
    message: any;
    callback?: (result: any) => void;
}

// prettier-ignore
declare const WasmFlowRuntime: {
    // emscripten API
    HEAP8: Uint8Array;
    HEAPU8: Uint8Array;
    HEAP16: Uint8Array;
    HEAPU16: Uint8Array;
    HEAP32: Uint32Array;
    HEAPU32: Uint32Array;

    HEAPF32: Float32Array;
    HEAPF64: Float64Array;

    allocateUTF8(str: string): number;
    UTF8ToString(ptr: number): string;
    AsciiToString(ptr: number): string;

    _malloc(size: number): number;
    _free(ptr: number): void;

    //
    assetsMap: AssetsMap;
    componentMessages: IMessageFromWorker[] | undefined;

    // eez framework API
    _init(assets: number, assetsSize: number, displayWidth: number, displayHeight: number);
    _startFlow();
    _mainLoop();
    _getSyncedBuffer(): number;
    _onMouseWheelEvent(wheelDeltaY: number, wheelClicked: number);
    _onPointerEvent(x: number, y: number, pressed: number);
    _onMessageFromDebugger(messageData: number, messageDataSize: number);

    // eez flow API for Dashboard projects

    _createUndefinedValue(): number;
    _createNullValue(): number;
    _createIntValue(value: number): number;
    _createDoubleValue(value: number): number;
    _createBooleanValue(value: number): number;
    _createStringValue(value: number): number;
    _createArrayValue(arraySize: number, arrayType: number): number;
    _createStreamValue(value: number): number;
    _createDateValue(value: number): number;

    _arrayValueSetElementValue(arrayValuePtr: number, elementIndex: number, value: number): void;

    _valueFree(valuePtr: number): void;

    _setGlobalVariable(globalVariableIndex: number, valuePtr: number);
    _updateGlobalVariable(globalVariableIndex: number, valuePtr: number);

    _getFlowIndex(flowStateIndex: number): number;

    _getComponentExecutionState(flowStateIndex: number, componentIndex: number): number;
    _setComponentExecutionState(flowStateIndex: number, componentIndex: number, state: number): void;

    _getStringParam(flowStateIndex: number, componentIndex: number, offset: number): number;
    _getExpressionListParam(flowStateIndex: number, componentIndex: number, offset: number): number;
    _freeExpressionListParam(ptr: number);

    _getInputValue(flowStateIndex: number, inputIndex: number): number;
    _clearInputValue(flowStateIndex: number, inputIndex: number);

    _evalProperty(flowStateIndex: number, componentIndex: number, propertyIndex: number, iteratorsPtr: number): number;
    _assignProperty(flowStateIndex: number, componentIndex: number, propertyIndex: number, iteratorsPtr: number, valuePtr: number): number;

    _setPropertyField(flowStateIndex: number, componentIndex: number, propertyIndex: number, fieldIndex: number, valuePtr: number);

    _propagateValue(flowStateIndex: number, componentIndex: number, outputIndex: number, valuePtr: number);
    _propagateValueThroughSeqout(flowStateIndex: number, componentIndex: number);

    _startAsyncExecution(flowStateIndex: number, componentIndex: number): number;
    _endAsyncExecution(flowStateIndex: number, componentIndex: number);

    _executeCallAction(flowStateIndex: number, componentIndex: number, flowIndex: number);

    _logInfo(flowStateIndex: number, componentIndex: number, infoMessage: number);
    _throwError(flowStateIndex: number, componentIndex: number, errorMessage: number);

    _onScpiResult(errorMessage: number, result: number, resultLen: number, resultIsBlob: number);

    _getFirstRootFlowState(): number;
    _getFirstChildFlowState(flowStateIndex: number): number;
    _getNextSiblingFlowState(flowStateIndex: number): number;

    _getFlowStateFlowIndex(flowStateIndex: number): number;
};
