const wasmModuleExecutionStates = new Map<
    number,
    {
        wasmStateToDashboardState: Map<number, any>;
        dasboardStateToWasmState: Map<any, number>;
    }
>();

export function registerDashboardState<T>(
    wasmModuleId: number,
    wasmState: number,
    dashboardState: any
) {
    let executionStates = wasmModuleExecutionStates.get(wasmModuleId);
    if (!executionStates) {
        executionStates = {
            wasmStateToDashboardState: new Map(),
            dasboardStateToWasmState: new Map()
        };
        wasmModuleExecutionStates.set(wasmModuleId, executionStates);
    }

    executionStates.wasmStateToDashboardState.set(wasmState, dashboardState);
    executionStates.dasboardStateToWasmState.set(dashboardState, wasmState);
}

export function getDashboardState<T>(
    wasmModuleId: number,
    wasmState: number
): T | undefined {
    let executionStates = wasmModuleExecutionStates.get(wasmModuleId);
    if (!executionStates) {
        return undefined;
    }

    return executionStates.wasmStateToDashboardState.get(wasmState);
}

export function releaseRuntimeDashboardStates(wasmModuleId: number) {
    wasmModuleExecutionStates.delete(wasmModuleId);
}

function freeComponentExecutionState(wasmModuleId: number, wasmState: number) {
    let executionStates = wasmModuleExecutionStates.get(wasmModuleId);
    if (!executionStates) {
        return;
    }

    const dashboardState =
        executionStates.wasmStateToDashboardState.get(wasmState);
    if (dashboardState) {
        executionStates.wasmStateToDashboardState.delete(wasmState);
        executionStates.dasboardStateToWasmState.delete(dashboardState);
    }
}

(global as any).freeComponentExecutionState = freeComponentExecutionState;
