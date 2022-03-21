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
    _mainLoop();
    _getSyncedBuffer(): number;
    _onMouseWheelEvent(wheelDeltaY: number, wheelClicked: number);
    _onPointerEvent(x: number, y: number, pressed: number);
    _onMessageFromDebugger(messageData: number, messageDataSize: number);

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
