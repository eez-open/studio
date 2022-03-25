import type { ArrayValue } from "project-editor/flow/runtime/wasm-value";

export type ObjectGlobalVariableValues = {
    globalVariableIndex: number;
    arrayValue: ArrayValue;
}[];

export interface RendererToWorkerMessage {
    init?: {
        assetsData: Uint8Array;
        assetsMap: AssetsMap;
        objectGlobalVariableValues: ObjectGlobalVariableValues;
    };
    wheel?: {
        deltaY: number;
        clicked: number;
    };
    pointerEvents?: {
        x: number;
        y: number;
        pressed: number;
    }[];
    messageFromDebugger?: ArrayBuffer;
    scpiResult?: ScpiResult;
}

export interface WorkerToRenderMessage {
    init?: any;
    screen?: Uint8ClampedArray;
    messageToDebugger?: Uint8Array;
    scpiCommand?: ScpiCommand;
}

export interface ScpiCommand {
    instrumentId: string;
    command: Uint8Array;
}

export interface ScpiResult {
    errorMessage?: string;
    result?: ArrayBuffer;
}
