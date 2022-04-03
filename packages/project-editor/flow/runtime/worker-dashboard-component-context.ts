import type { IDashboardComponentContext, ValueType } from "eez-studio-types";
import {
    createJsArrayValue,
    createWasmArrayValue,
    getValue
} from "project-editor/flow/runtime/wasm-value";

let nextWidgetMessageId = 0;

export class DashboardComponentContext implements IDashboardComponentContext {
    constructor(public flowStateIndex: number, public componentIndex: number) {}

    getFlowIndex(): number {
        return WasmFlowRuntime._getFlowIndex(this.flowStateIndex);
    }

    getComponentIndex(): number {
        return this.componentIndex;
    }

    getStringParam(offset: number) {
        const ptr = WasmFlowRuntime._getStringParam(
            this.flowStateIndex,
            this.componentIndex,
            offset
        );
        return WasmFlowRuntime.AsciiToString(ptr);
    }

    getExpressionListParam(offset: number) {
        const ptr = WasmFlowRuntime._getExpressionListParam(
            this.flowStateIndex,
            this.componentIndex,
            offset
        );

        const values: any[] = [];

        if (ptr) {
            const count = WasmFlowRuntime.HEAPU32[(ptr >> 2) + 0];
            for (let i = 0; i < count; i++) {
                let offset = ptr + 8 + 16 * i;
                values.push(getValue(offset).value);
            }

            WasmFlowRuntime._freeExpressionListParam(ptr);
        }

        return values;
    }

    evalProperty<T = any>(propertyName: string, expectedTypes?: ValueType[]) {
        const flowIndex = this.getFlowIndex();
        const flow = WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const propertyIndex = component.propertyIndexes[propertyName];
        if (propertyIndex == undefined) {
            this.throwError(`Property "${propertyName}" not found`);
        }

        const valuePtr = WasmFlowRuntime._evalProperty(
            this.flowStateIndex,
            this.componentIndex,
            propertyIndex,
            0
        );

        if (!valuePtr) {
            return undefined;
        }

        const result = getValue(valuePtr);

        WasmFlowRuntime._valueFree(valuePtr);

        if (expectedTypes && expectedTypes.indexOf(result.valueType) == -1) {
            return undefined;
        }

        return result.value as any as T;
    }

    propagateValue(outputName: string, value: any) {
        const flowIndex = this.getFlowIndex();
        const flow = WasmFlowRuntime.assetsMap.flows[flowIndex];
        const componentIndex = this.getComponentIndex();
        const component = flow.components[componentIndex];
        const outputIndex = component.outputIndexes[outputName];
        if (outputIndex == undefined) {
            this.throwError(`Output "${outputName}" not found`);
        }

        if (typeof value == "number") {
            if (Number.isInteger(value)) {
                WasmFlowRuntime._propagateIntValue(
                    this.flowStateIndex,
                    this.componentIndex,
                    outputIndex,
                    value
                );
            } else {
                WasmFlowRuntime._propagateDoubleValue(
                    this.flowStateIndex,
                    this.componentIndex,
                    outputIndex,
                    value
                );
            }
        } else if (typeof value == "boolean") {
            WasmFlowRuntime._propagateBooleanValue(
                this.flowStateIndex,
                this.componentIndex,
                outputIndex,
                value
            );
        } else if (typeof value == "string") {
            const valuePtr = WasmFlowRuntime.allocateUTF8(value);
            WasmFlowRuntime._propagateStringValue(
                this.flowStateIndex,
                this.componentIndex,
                outputIndex,
                valuePtr
            );
            WasmFlowRuntime._free(valuePtr);
        } else if (value === undefined) {
            WasmFlowRuntime._propagateUndefinedValue(
                this.flowStateIndex,
                this.componentIndex,
                outputIndex
            );
        } else if (value === null) {
            WasmFlowRuntime._propagateNullValue(
                this.flowStateIndex,
                this.componentIndex,
                outputIndex
            );
        } else {
            const flowIndex = this.getFlowIndex();
            const flow = WasmFlowRuntime.assetsMap.flows[flowIndex];

            const componentIndex = this.getComponentIndex();
            const component = flow.components[componentIndex];

            const output = component.outputs[outputIndex];

            const valueTypeIndex = output.valueTypeIndex;
            if (valueTypeIndex == -1) {
                this.throwError("Invalid value");
            } else {
                const arrayValue = createJsArrayValue(
                    valueTypeIndex,
                    value,
                    WasmFlowRuntime.assetsMap,
                    undefined
                );

                if (arrayValue) {
                    const valuePtr = createWasmArrayValue(arrayValue);
                    WasmFlowRuntime._propagateValue(
                        this.flowStateIndex,
                        this.componentIndex,
                        outputIndex,
                        valuePtr
                    );
                    WasmFlowRuntime._valueFree(valuePtr);
                } else {
                    this.throwError("Invalid value");
                }
            }
        }
    }

    propagateValueThroughSeqout(): void {
        WasmFlowRuntime._propagateValueThroughSeqout(
            this.flowStateIndex,
            this.componentIndex
        );
    }

    startAsyncExecution() {
        WasmFlowRuntime._startAsyncExecution(
            this.flowStateIndex,
            this.componentIndex
        );

        return new DashboardComponentContext(
            this.flowStateIndex,
            this.componentIndex
        );
    }

    endAsyncExecution() {
        WasmFlowRuntime._endAsyncExecution(
            this.flowStateIndex,
            this.componentIndex
        );
    }

    executeCallAction(flowIndex: number) {
        WasmFlowRuntime._executeCallAction(
            this.flowStateIndex,
            this.componentIndex,
            flowIndex
        );
    }

    sendMessageToComponent(message: any, callback?: (result: any) => void) {
        if (WasmFlowRuntime.componentMessages == undefined) {
            WasmFlowRuntime.componentMessages = [];
        }
        WasmFlowRuntime.componentMessages.push({
            id: nextWidgetMessageId++,
            flowStateIndex: this.flowStateIndex,
            componentIndex: this.componentIndex,
            message,
            callback
        });
    }

    throwError(errorMessage: string) {
        const errorMessagePtr = WasmFlowRuntime.allocateUTF8(errorMessage);
        WasmFlowRuntime._throwError(
            this.flowStateIndex,
            this.componentIndex,
            errorMessagePtr
        );
        WasmFlowRuntime._free(errorMessagePtr);
    }
}
