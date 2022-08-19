import type {
    IDashboardComponentContext,
    IWasmFlowRuntime
} from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

export const actionConmponentExecuteFunctions: {
    [name: string]: (context: IDashboardComponentContext) => void;
} = {};

export function registerExecuteFunction(
    name: string,
    func: (context: IDashboardComponentContext) => void
) {
    actionConmponentExecuteFunctions[name] = func;
}

////////////////////////////////////////////////////////////////////////////////

type WasmFlowRuntimeTerminateCallback = (
    WasmFlowRuntime: IWasmFlowRuntime
) => void;

export const wasmFlowRuntimeTerminateCallbacks: WasmFlowRuntimeTerminateCallback[] =
    [];

export function onWasmFlowRuntimeTerminate(
    callback: WasmFlowRuntimeTerminateCallback
) {
    wasmFlowRuntimeTerminateCallbacks.push(callback);
}
