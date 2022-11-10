import type {
    IDashboardComponentContext,
    ValueType,
    IWasmFlowRuntime
} from "eez-studio-types";
import {
    createWasmValue,
    getValue
} from "project-editor/flow/runtime/wasm-value";

let nextWidgetMessageId = 0;

export class DashboardComponentContext implements IDashboardComponentContext {
    constructor(
        public WasmFlowRuntime: IWasmFlowRuntime,
        public flowStateIndex: number,
        public componentIndex: number
    ) {}

    getFlowIndex(): number {
        return this.WasmFlowRuntime._getFlowIndex(this.flowStateIndex);
    }

    getComponentIndex(): number {
        return this.componentIndex;
    }

    getComponentExecutionState<T>() {
        const wasmState = this.WasmFlowRuntime._getComponentExecutionState(
            this.flowStateIndex,
            this.componentIndex
        );
        return wasmToComponentExecutionState<T>(wasmState);
    }

    setComponentExecutionState<T>(state: T | undefined) {
        const wasmState = componentExecutionStateToWasm<T>(state);
        this.WasmFlowRuntime._setComponentExecutionState(
            this.flowStateIndex,
            this.componentIndex,
            wasmState
        );
    }

    getUint32Param(offset: number) {
        return this.WasmFlowRuntime._getUint32Param(
            this.flowStateIndex,
            this.componentIndex,
            offset
        );
    }

    getStringParam(offset: number) {
        const ptr = this.WasmFlowRuntime._getStringParam(
            this.flowStateIndex,
            this.componentIndex,
            offset
        );
        return this.WasmFlowRuntime.UTF8ToString(ptr);
    }

    getExpressionListParam(offset: number) {
        const ptr = this.WasmFlowRuntime._getExpressionListParam(
            this.flowStateIndex,
            this.componentIndex,
            offset
        );

        const values: any[] = [];

        if (ptr) {
            const count = this.WasmFlowRuntime.HEAPU32[(ptr >> 2) + 0];
            for (let i = 0; i < count; i++) {
                let offset = ptr + 8 + 16 * i;
                values.push(getValue(this.WasmFlowRuntime, offset).value);
            }

            this.WasmFlowRuntime._freeExpressionListParam(ptr);
        }

        return values;
    }

    getListParamSize(offset: number) {
        return this.WasmFlowRuntime._getListParamSize(
            this.flowStateIndex,
            this.componentIndex,
            offset
        );
    }

    evalListParamElementExpression<T = any>(
        listOffset: number,
        elementIndex: number,
        expressionOffset: number,
        errorMesssage: string,
        expectedTypes?: ValueType | ValueType[]
    ) {
        const errorMessagePtr =
            this.WasmFlowRuntime.allocateUTF8(errorMesssage);

        const valuePtr = this.WasmFlowRuntime._evalListParamElementExpression(
            this.flowStateIndex,
            this.componentIndex,
            listOffset,
            elementIndex,
            expressionOffset,
            errorMessagePtr
        );

        this.WasmFlowRuntime._free(errorMessagePtr);

        if (!valuePtr) {
            return undefined;
        }

        const result = getValue(this.WasmFlowRuntime, valuePtr);

        this.WasmFlowRuntime._valueFree(valuePtr);

        if (
            expectedTypes &&
            (Array.isArray(expectedTypes)
                ? expectedTypes.indexOf(result.valueType) == -1
                : expectedTypes != result.valueType)
        ) {
            return undefined;
        }

        return result.value as any as T;
    }

    getInputValue<T = any>(inputName: string, expectedTypes?: ValueType[]) {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const inputIndex = component.inputIndexes[inputName];
        if (inputIndex == undefined) {
            this.throwError(`Input "${inputName}" not found`);
            return undefined;
        }

        const valuePtr = this.WasmFlowRuntime._getInputValue(
            this.flowStateIndex,
            inputIndex
        );
        if (!valuePtr) {
            return undefined;
        }
        const result = getValue(this.WasmFlowRuntime, valuePtr);
        if (expectedTypes && expectedTypes.indexOf(result.valueType) == -1) {
            return undefined;
        }
        return result.value as any as T;
    }

    clearInputValue(inputName: string) {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const inputIndex = component.inputIndexes[inputName];
        if (inputIndex == undefined) {
            this.throwError(`Input "${inputName}" not found`);
            return;
        }

        this.WasmFlowRuntime._clearInputValue(this.flowStateIndex, inputIndex);
    }

    evalProperty<T = any>(
        propertyName: string,
        expectedTypes?: ValueType | ValueType[]
    ) {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const propertyIndex = component.propertyIndexes[propertyName];
        if (propertyIndex == undefined) {
            this.throwError(`Property "${propertyName}" not found`);
        }

        const valuePtr = this.WasmFlowRuntime._evalProperty(
            this.flowStateIndex,
            this.componentIndex,
            propertyIndex,
            0,
            false
        );

        if (!valuePtr) {
            return undefined;
        }

        const result = getValue(this.WasmFlowRuntime, valuePtr);

        this.WasmFlowRuntime._valueFree(valuePtr);

        if (
            expectedTypes &&
            (Array.isArray(expectedTypes)
                ? expectedTypes.indexOf(result.valueType) == -1
                : expectedTypes != result.valueType)
        ) {
            return undefined;
        }

        return result.value as any as T;
    }

    setPropertyField(propertyName: string, fieldName: string, value: any) {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const propertyIndex = component.propertyIndexes[propertyName];
        if (propertyIndex == undefined) {
            this.throwError(`Property "${propertyName}" not found`);
        }
        const valueTypeIndex =
            component.properties[propertyIndex].valueTypeIndex;
        const type = this.WasmFlowRuntime.assetsMap.types[valueTypeIndex];
        if (type.kind != "object") {
            throw `property "${propertyName}" is not object`;
        }

        const fieldIndex = type.fieldIndexes[fieldName];
        if (fieldIndex == undefined) {
            throw `property "${propertyName}" has no field "${fieldName}"`;
        }

        const valuePtr = createWasmValue(this.WasmFlowRuntime, value);

        this.WasmFlowRuntime._setPropertyField(
            this.flowStateIndex,
            this.componentIndex,
            propertyIndex,
            fieldIndex,
            valuePtr
        );

        this.WasmFlowRuntime._valueFree(valuePtr);
    }

    propagateValue(outputName: string, value: any) {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const outputIndex = component.outputIndexes[outputName];
        if (outputIndex == undefined) {
            this.throwError(`Output "${outputName}" not found`);
        }
        const output = component.outputs[outputIndex];

        const valueTypeIndex = output.valueTypeIndex;
        if (valueTypeIndex == -1) {
            this.throwError("Invalid value");
            return;
        }

        let valuePtr = createWasmValue(
            this.WasmFlowRuntime,
            value,
            valueTypeIndex
        );

        if (!valuePtr) {
            this.throwError("Out of memory");
            return;
        }

        this.WasmFlowRuntime._propagateValue(
            this.flowStateIndex,
            this.componentIndex,
            outputIndex,
            valuePtr
        );
        this.WasmFlowRuntime._valueFree(valuePtr);
    }

    propagateValueThroughSeqout(): void {
        this.WasmFlowRuntime._propagateValueThroughSeqout(
            this.flowStateIndex,
            this.componentIndex
        );
    }

    startAsyncExecution() {
        this.WasmFlowRuntime._startAsyncExecution(
            this.flowStateIndex,
            this.componentIndex
        );

        return new DashboardComponentContext(
            this.WasmFlowRuntime,
            this.flowStateIndex,
            this.componentIndex
        );
    }

    endAsyncExecution() {
        this.WasmFlowRuntime._endAsyncExecution(
            this.flowStateIndex,
            this.componentIndex
        );
    }

    executeCallAction(flowIndex: number) {
        this.WasmFlowRuntime._executeCallAction(
            this.flowStateIndex,
            this.componentIndex,
            flowIndex
        );
    }

    sendMessageToComponent(message: any, callback?: (result: any) => void) {
        if (this.WasmFlowRuntime.componentMessages == undefined) {
            this.WasmFlowRuntime.componentMessages = [];
        }
        this.WasmFlowRuntime.componentMessages.push({
            id: nextWidgetMessageId++,
            flowStateIndex: this.flowStateIndex,
            componentIndex: this.componentIndex,
            message,
            callback
        });
    }

    logInfo(infoMessage: string) {
        const infoMessagePtr = this.WasmFlowRuntime.allocateUTF8(infoMessage);
        this.WasmFlowRuntime._logInfo(
            this.flowStateIndex,
            this.componentIndex,
            infoMessagePtr
        );
        this.WasmFlowRuntime._free(infoMessagePtr);
    }

    throwError(errorMessage: string) {
        const errorMessagePtr = this.WasmFlowRuntime.allocateUTF8(errorMessage);
        this.WasmFlowRuntime._throwError(
            this.flowStateIndex,
            this.componentIndex,
            errorMessagePtr
        );
        this.WasmFlowRuntime._free(errorMessagePtr);
    }
}

////////////////////////////////////////////////////////////////////////////////

const wasmStates = new Map<any, number>();
let nextWasmState = 0;
const states = new Map<number, any>();

function componentExecutionStateToWasm<T>(state: T | undefined) {
    if (state == undefined) {
        return -1;
    }
    let wasmState = wasmStates.get(state);
    if (wasmState == undefined) {
        wasmState = nextWasmState++;
        wasmStates.set(state, wasmState);
        states.set(wasmState, state);
    }
    return wasmState;
}

function wasmToComponentExecutionState<T>(wasmState: number) {
    if (wasmState == -1) {
        return undefined;
    }
    return states.get(wasmState);
}

function freeComponentExecutionState(wasmModuleId: number, wasmState: number) {
    const state = states.has(wasmState);
    if (state) {
        wasmStates.delete(state);
        states.delete(wasmState);
    }
}

(global as any).freeComponentExecutionState = freeComponentExecutionState;
