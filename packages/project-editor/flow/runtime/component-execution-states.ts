export interface IComponentExecutionState {
    onDestroy?: () => void;
}

const wasmModuleExecutionStates = new Map<
    number,
    {
        wasmStateToDashboardState: Map<number, IComponentExecutionState>;
        dasboardStateToWasmState: Map<IComponentExecutionState, number>;
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

export function getDashboardState(wasmModuleId: number, wasmState: number) {
    let executionStates = wasmModuleExecutionStates.get(wasmModuleId);
    if (!executionStates) {
        return undefined;
    }

    return executionStates.wasmStateToDashboardState.get(wasmState);
}

export function releaseRuntimeDashboardStates(wasmModuleId: number) {
    let executionStates = wasmModuleExecutionStates.get(wasmModuleId);
    if (!executionStates) {
        return;
    }

    for (const dashboardState of executionStates.dasboardStateToWasmState.keys()) {
        if (dashboardState.onDestroy) {
            dashboardState.onDestroy();
        }
    }
}

function freeComponentExecutionState(wasmModuleId: number, wasmState: number) {
    let executionStates = wasmModuleExecutionStates.get(wasmModuleId);
    if (!executionStates) {
        return;
    }

    const dashboardState =
        executionStates.wasmStateToDashboardState.get(wasmState);
    if (dashboardState) {
        if (dashboardState.onDestroy) {
            dashboardState.onDestroy();
        }

        executionStates.wasmStateToDashboardState.delete(wasmState);
        executionStates.dasboardStateToWasmState.delete(dashboardState);
    }
}

(global as any).freeComponentExecutionState = freeComponentExecutionState;
