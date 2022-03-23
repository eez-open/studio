/// <reference path="../eez-studio-shared/globals.d.ts"/>

declare const opentype: {
    parse(arg: any): any;
};

declare const ace: {
    edit(arg: any): any;
    acequire(arg: any): any;
};

declare module "jspanel4";

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

    _valueFree(valuePtr: number): void;

    _setGlobalVariable(globalVariableIndex: number, valuePtr: number);

    _DashboardContext_getStringParam(context: number, offset: number): number;

    _DashboardContext_getExpressionListParam(
        context: number,
        offset: number
    ): number;

    _DashboardContext_freeExpressionListParam(context: number, ptr: number);

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

    _DashboardContext_propagateValueThroughSeqout(context: number);

    _DashboardContext_throwError(context: number, errorMessage: number);
};
