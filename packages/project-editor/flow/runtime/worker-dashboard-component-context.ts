import type {
    IDashboardComponentContext,
    ValueType,
    IWasmFlowRuntime,
    IType
} from "eez-studio-types";
import {
    createWasmValue,
    getValue
} from "project-editor/flow/runtime/wasm-value";
import {
    registerDashboardState,
    getDashboardState
} from "project-editor/flow/runtime/component-execution-states";

import { isArray } from "eez-studio-shared/util";

import { getObjectPathAsString } from "project-editor/store";
import type { Component } from "project-editor/flow/component";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import type { FlowState } from "project-editor/flow/runtime/runtime";

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
        return getDashboardState(
            this.WasmFlowRuntime.wasmModuleId,
            wasmState
        ) as T | undefined;
    }

    setComponentExecutionState<T>(state: T | undefined) {
        if (state) {
            const wasmState =
                this.WasmFlowRuntime._allocateDashboardComponentExecutionState(
                    this.flowStateIndex,
                    this.componentIndex
                );

            if (wasmState) {
                registerDashboardState(
                    this.WasmFlowRuntime.wasmModuleId,
                    wasmState,
                    state
                );
            }
        } else {
            this.WasmFlowRuntime._deallocateDashboardComponentExecutionState(
                this.flowStateIndex,
                this.componentIndex
            );
        }
    }

    getUint8Param(offset: number) {
        return this.WasmFlowRuntime._getUint8Param(
            this.flowStateIndex,
            this.componentIndex,
            offset
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
            (isArray(expectedTypes)
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
            (isArray(expectedTypes)
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

        const valuePtr = createWasmValue(
            this.WasmFlowRuntime,
            value,
            valueTypeIndex
        );

        this.WasmFlowRuntime._setPropertyField(
            this.flowStateIndex,
            this.componentIndex,
            propertyIndex,
            fieldIndex,
            valuePtr
        );

        this.WasmFlowRuntime._valueFree(valuePtr);
    }

    assignProperty(
        propertyName: string,
        value: any,
        iterators: number[] | undefined
    ) {
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

        const valuePtr = createWasmValue(
            this.WasmFlowRuntime,
            value,
            valueTypeIndex
        );

        let iteratorsPtr = 0;
        if (iterators) {
            iteratorsPtr = this.WasmFlowRuntime._malloc(iterators.length * 4);
            for (let i = 0; i < iterators.length; i++) {
                this.WasmFlowRuntime.HEAP32[iteratorsPtr >> 2] = iterators[i];
            }
        }

        this.WasmFlowRuntime._assignProperty(
            this.flowStateIndex,
            this.componentIndex,
            propertyIndex,
            iteratorsPtr,
            valuePtr
        );

        this.WasmFlowRuntime._valueFree(valuePtr);
    }

    getOutputType(outputName: string): IType | undefined {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const outputIndex = component.outputIndexes[outputName];
        if (outputIndex == undefined) {
            return undefined;
        }
        const output = component.outputs[outputIndex];

        const valueTypeIndex = output.valueTypeIndex;
        if (valueTypeIndex == -1) {
            return undefined;
        }

        return this.WasmFlowRuntime.assetsMap.types[valueTypeIndex];
    }

    propagateValue(outputName: string, value: any) {
        const flowIndex = this.getFlowIndex();
        const flow = this.WasmFlowRuntime.assetsMap.flows[flowIndex];
        if (!flow) {
            console.error(
                "Flow not found",
                flowIndex,
                this.getComponentIndex(),
                outputName,
                value,
                this
            );
            this.throwError("Flow not found");
            return;
        }
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        if (!component) {
            console.error(
                "Component not found",
                flowIndex,
                componentIndex,
                outputName,
                value,
                this
            );
            this.throwError("Component not found");
            return;
        }
        const outputIndex = component.outputIndexes[outputName];
        if (outputIndex == undefined) {
            this.throwError(`Output "${outputName}" not found`);
            return;
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

export function assignProperty(
    flowState: FlowState,
    component: Component,
    propertyName: string,
    value: any,
    iterators: number[] | undefined
) {
    const wasmRuntime = flowState.runtime as WasmRuntime;

    const flowStateIndex = wasmRuntime.flowStateToFlowIndexMap.get(flowState);
    if (flowStateIndex == undefined) {
        console.error("Unexpected!");
        return;
    }

    const assetsMap = wasmRuntime.assetsMap;

    const flowPath = getObjectPathAsString(flowState.flow);
    const flowIndex = assetsMap.flowIndexes[flowPath];
    if (flowIndex == undefined) {
        console.error("Unexpected!");
        return;
    }

    const componentPath = getObjectPathAsString(component);
    const componentIndex =
        assetsMap.flows[flowIndex].componentIndexes[componentPath];
    if (componentIndex == undefined) {
        console.error("Unexpected!");
        return;
    }

    const dashboardComponentContext = new DashboardComponentContext(
        wasmRuntime.worker.wasm,
        flowStateIndex,
        componentIndex
    );

    dashboardComponentContext.assignProperty(propertyName, value, iterators);
}
