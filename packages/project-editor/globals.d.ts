/// <reference path="../eez-studio-shared/globals.d.ts"/>

declare const opentype: {
    parse(arg: any): any;
};

declare const ace: {
    edit(arg: any): any;
    acequire(arg: any): any;
};

declare module "jspanel4";

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
            outputs: {
                outputName: string;
                valueTypeIndex: number;
                connectionLines: {
                    targetComponentIndex: number;
                    targetInputIndex: number;
                }[];
            }[];
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

declare const WasmFlowRuntime: {
    allocateUTF8(str: string): number;
    AsciiToString(ptr: number): string;

    HEAP8: Uint8Array;
    HEAPU8: Uint8Array;
    HEAP16: Uint8Array;
    HEAPU16: Uint8Array;
    HEAP32: Uint32Array;
    HEAPU32: Uint32Array;

    HEAPF32: Float32Array;
    HEAPF64: Float64Array;

    _malloc(size: number): number;
    _free(ptr: number): void;

    _init(assets: number, assetsSize: number);
    _startFlow();
    _mainLoop();
    _getSyncedBuffer(): number;
    _onMouseWheelEvent(wheelDeltaY: number, wheelClicked: number);
    _onPointerEvent(x: number, y: number, pressed: number);
    _onMessageFromDebugger(messageData: number, messageDataSize: number);

    _onScpiResult(errorMessage: number, result: number, resultLen: number);

    _arrayValueAlloc(arraySize: number, arrayType: number): number;
    _arrayValueSetElementValue(
        arrayValuePtr: number,
        elementIndex: number,
        value: number
    ): void;
    _arrayValueSetElementInt(
        arrayValuePtr: number,
        elementIndex: number,
        value: number
    ): void;
    _arrayValueSetElementDouble(
        arrayValuePtr: number,
        elementIndex: number,
        value: number
    ): void;
    _arrayValueSetElementBool(
        arrayValuePtr: number,
        elementIndex: number,
        value: boolean
    ): void;
    _arrayValueSetElementString(
        arrayValuePtr: number,
        elementIndex: number,
        value: number
    ): void;
    _arrayValueSetElementNull(
        arrayValuePtr: number,
        elementIndex: number
    ): void;

    _evalProperty(
        flowStateIndex: number,
        componentIndex: number,
        propertyIndex: number,
        iteratorsPtr: number
    ): number;

    _propagateValue(
        flowStateIndex: number,
        componentIndex: number,
        outputIndex: number,
        valuePtr: number
    );

    _valueFree(valuePtr: number): void;

    _setGlobalVariable(globalVariableIndex: number, valuePtr: number);

    _DashboardContext_getFlowIndex(context: number): number;
    _DashboardContext_getComponentIndex(context: number): number;

    _DashboardContext_startAsyncExecution(context: number): number;
    _DashboardContext_endAsyncExecution(context: number);

    _DashboardContext_evalProperty(
        context: number,
        propertyIndex: number
    ): number;

    _DashboardContext_getStringParam(context: number, offset: number): number;

    _DashboardContext_getExpressionListParam(
        context: number,
        offset: number
    ): number;

    _DashboardContext_freeExpressionListParam(context: number, ptr: number);

    _DashboardContext_propagateValue(
        context: number,
        outputIndex: number,
        value: number
    );
    _DashboardContext_propagateIntValue(
        context: number,
        outputIndex: number,
        value: number
    );
    _DashboardContext_propagateDoubleValue(
        context: number,
        outputIndex: number,
        value: number
    );
    _DashboardContext_propagateBooleanValue(
        context: number,
        outputIndex: number,
        value: boolean
    );
    _DashboardContext_propagateStringValue(
        context: number,
        outputIndex: number,
        value: number
    );
    _DashboardContext_propagateUndefinedValue(
        context: number,
        outputIndex: number
    );
    _DashboardContext_propagateNullValue(context: number, outputIndex: number);

    _DashboardContext_propagateValueThroughSeqout(context: number);

    _DashboardContext_executeCallAction(context: number, flowIndex: number);

    _DashboardContext_throwError(context: number, errorMessage: number);

    assetsMap: AssetsMap;
};
