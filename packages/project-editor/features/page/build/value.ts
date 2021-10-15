import type {
    Assets,
    DataBuffer
} from "project-editor/features/page/build/assets";
import type { Variable } from "project-editor/features/variable/variable";
import {
    isArrayType,
    isEnumType,
    isStructType
} from "project-editor/features/variable/value-type";
import { evalConstantExpression } from "project-editor/flow/expression/expression";
import { Section } from "project-editor/core/store";
import { MessageType } from "project-editor/core/object";

export const FLOW_VALUE_TYPE_UNDEFINED = 0;
export const FLOW_VALUE_TYPE_NULL = 1;
export const FLOW_VALUE_TYPE_BOOLEAN = 2;
export const FLOW_VALUE_TYPE_INT8 = 3;
export const FLOW_VALUE_TYPE_UINT8 = 4;
export const FLOW_VALUE_TYPE_INT16 = 5;
export const FLOW_VALUE_TYPE_UINT16 = 6;
export const FLOW_VALUE_TYPE_INT32 = 7;
export const FLOW_VALUE_TYPE_UINT32 = 8;
export const FLOW_VALUE_TYPE_INT64 = 9;
export const FLOW_VALUE_TYPE_UINT64 = 10;
export const FLOW_VALUE_TYPE_FLOAT = 11;
export const FLOW_VALUE_TYPE_DOUBLE = 12;
export const FLOW_VALUE_TYPE_STRING = 13;
export const FLOW_VALUE_TYPE_ARRAY = 14;

export interface FlowValue {
    type: number;
    value: any;
}

function getValueType(valueType: string) {
    if (valueType == "boolean") {
        return FLOW_VALUE_TYPE_BOOLEAN;
    } else if (valueType == "integer") {
        return FLOW_VALUE_TYPE_INT32;
    } else if (valueType == "float") {
        return FLOW_VALUE_TYPE_FLOAT;
    } else if (valueType == "double") {
        return FLOW_VALUE_TYPE_DOUBLE;
    } else if (valueType == "string") {
        return FLOW_VALUE_TYPE_STRING;
    } else if (isEnumType(valueType)) {
        return FLOW_VALUE_TYPE_INT32;
    } else if (isArrayType(valueType) || isStructType(valueType)) {
        return FLOW_VALUE_TYPE_ARRAY;
    } else {
        return FLOW_VALUE_TYPE_UINT32;
    }
}

export function getConstantFlowValueType(value: any, valueType?: string) {
    if (value === null) {
        return FLOW_VALUE_TYPE_NULL;
    }

    if (valueType) {
        return getValueType(valueType);
    }

    if (typeof value === "boolean") {
        return FLOW_VALUE_TYPE_BOOLEAN;
    } else if (typeof value === "number") {
        return FLOW_VALUE_TYPE_DOUBLE;
    } else if (typeof value === "string") {
        return FLOW_VALUE_TYPE_STRING;
    } else if (typeof value === "object") {
        return FLOW_VALUE_TYPE_ARRAY;
    } else if (typeof value === "undefined") {
        return FLOW_VALUE_TYPE_UNDEFINED;
    }

    return FLOW_VALUE_TYPE_NULL;
}

export function getVariableFlowValue(assets: Assets, variable: Variable) {
    let type;

    if (variable.type) {
        type = getValueType(variable.type);
    } else {
        assets.DocumentStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            "Variable type not set",
            variable
        );
        type = FLOW_VALUE_TYPE_UNDEFINED;
    }

    let value = evalConstantExpression(
        assets.rootProject,
        variable.defaultValue
    );

    return {
        type,
        value
    };
}

export function buildConstantFlowValue(
    dataBuffer: DataBuffer,
    flowValue: FlowValue
) {
    buildFlowValue(dataBuffer, flowValue);
}

export function buildVariableFlowValue(
    dataBuffer: DataBuffer,
    flowValue: FlowValue
) {
    buildFlowValue(dataBuffer, flowValue);
}

function buildFlowValue(dataBuffer: DataBuffer, flowValue: FlowValue) {
    dataBuffer.writeUint8(flowValue.type); // type_
    dataBuffer.writeUint8(0); // unit_
    dataBuffer.writeUint16(0); // options_
    dataBuffer.writeUint32(0); // reserved_
    // union
    if (flowValue.type == FLOW_VALUE_TYPE_BOOLEAN) {
        dataBuffer.writeUint32(flowValue.value);
        dataBuffer.writeUint32(0);
    } else if (flowValue.type == FLOW_VALUE_TYPE_INT32) {
        dataBuffer.writeInt32(flowValue.value);
        dataBuffer.writeUint32(0);
    } else if (flowValue.type == FLOW_VALUE_TYPE_FLOAT) {
        dataBuffer.writeFloat(flowValue.value);
        dataBuffer.writeUint32(0);
    } else if (flowValue.type == FLOW_VALUE_TYPE_DOUBLE) {
        dataBuffer.writeDouble(flowValue.value);
    } else if (flowValue.type == FLOW_VALUE_TYPE_STRING) {
        dataBuffer.writeObjectOffset(() => {
            dataBuffer.writeString(flowValue.value);
        });
        dataBuffer.writeUint32(0);
    } else if (flowValue.type == FLOW_VALUE_TYPE_ARRAY) {
        dataBuffer.writeObjectOffset(() => {
            let elements: FlowValue[];
            if (Array.isArray(flowValue.value)) {
                elements = flowValue.value.map((element: any) => ({
                    type: getConstantFlowValueType(element),
                    value: element
                }));
            } else {
                elements = [];
                const sortedKeys = Object.keys(flowValue.value).sort();
                for (const key of sortedKeys) {
                    const element = flowValue.value[key];
                    elements.push({
                        type: getConstantFlowValueType(element),
                        value: element
                    });
                }
            }

            dataBuffer.writeUint32(elements.length); // arraySize
            dataBuffer.writeUint32(0); // reserved
            elements.forEach(element => buildFlowValue(dataBuffer, element));
        }, 8);
        dataBuffer.writeUint32(0);
    } else {
        dataBuffer.writeUint64(0);
    }
}
