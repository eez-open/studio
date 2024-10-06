import type { AssetsMap } from "eez-studio-types";
import type { ArrayValue } from "project-editor/flow/runtime/wasm-value";

////////////////////////////////////////////////////////////////////////////////

// message data sent from renderer to WASM worker
export interface RendererToWorkerMessage {
    // response to init message from WASM worker
    init?: {
        assetsData: Uint8Array;
        assetsMap: AssetsMap;
        globalVariableValues: IGlobalVariable[];
        displayWidth: number;
        displayHeight: number;
    };

    // mouse data from Canvas
    wheel?: {
        updated: boolean;
        deltaY: number;
        pressed: number;
    };
    pointerEvents?: {
        x: number;
        y: number;
        pressed: number;
    }[];

    // keyboard data from Canvas
    keysPressed?: number[];

    updateGlobalVariableValues?: IGlobalVariable[];

    // request to worker to evaluate some property values
    evalProperties?: IEvalProperty[];

    // result of SCPI command execution
    scpiResult?: ScpiResult;

    // message from Studio debugger to worker
    messageFromDebugger?: ArrayBuffer;

    // request to worker to execute widget action
    executeWidgetAction?: {
        flowStateIndex: number;
        componentIndex: number;
        outputIndex: number;
        arrayValue: ArrayValue;
    };

    stopScript?: boolean;
}

////////////////////////////////////////////////////////////////////////////////

interface IGlobalVariableBase {
    globalVariableIndex: number;
}

interface IBasicGlobalVariable extends IGlobalVariableBase {
    kind: "basic";
    value: null | undefined | number | boolean | string;
}

interface IArrayGlobalVariable extends IGlobalVariableBase {
    kind: "array";
    value: ArrayValue | null;
}

export type IGlobalVariable = IBasicGlobalVariable | IArrayGlobalVariable;

////////////////////////////////////////////////////////////////////////////////

export interface IEvalProperty {
    flowStateIndex: number;
    componentIndex: number;
    propertyIndex: number;
    propertyValueIndex: number;
    indexes: number[];
}

////////////////////////////////////////////////////////////////////////////////

export interface IAssignProperty {
    flowStateIndex: number;
    componentIndex: number;
    propertyIndex: number;
    indexes: number[];
    value: any;
}

////////////////////////////////////////////////////////////////////////////////

export interface ScpiResult {
    errorMessage?: string;
    result?: ArrayBuffer | Uint8Array;
}
