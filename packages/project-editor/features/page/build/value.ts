import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import {
    isArrayVariable,
    isEnumVariable,
    isStructVariable,
    Variable
} from "project-editor/features/variable/variable";
import { evalConstantExpression } from "project-editor/flow/expression";

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
export const FLOW_VALUE_TYPE_ASSETS_STRING = 15;

export interface FlowValue {
    type: number;
    value: any;
}

export function getFlowValueType(value: any) {
    if (typeof value === "boolean") {
        return FLOW_VALUE_TYPE_BOOLEAN;
    } else if (typeof value === "number") {
        return FLOW_VALUE_TYPE_DOUBLE;
    } else if (typeof value === "string") {
        return FLOW_VALUE_TYPE_ASSETS_STRING;
    } else if (typeof value === "undefined") {
        return FLOW_VALUE_TYPE_UNDEFINED;
    }
    return FLOW_VALUE_TYPE_NULL;
}

export function getFlowValue(assets: Assets, variable: Variable) {
    let type;

    if (variable.type == "boolean") {
        type = FLOW_VALUE_TYPE_BOOLEAN;
    } else if (variable.type == "integer") {
        type = FLOW_VALUE_TYPE_INT32;
    } else if (variable.type == "float") {
        type = FLOW_VALUE_TYPE_FLOAT;
    } else if (variable.type == "double") {
        type = FLOW_VALUE_TYPE_DOUBLE;
    } else if (variable.type == "string") {
        type = FLOW_VALUE_TYPE_ASSETS_STRING;
    } else if (isEnumVariable(variable)) {
        type = FLOW_VALUE_TYPE_INT32;
    } else if (isStructVariable(variable)) {
        type = FLOW_VALUE_TYPE_NULL;
    } else if (isArrayVariable(variable)) {
        type = FLOW_VALUE_TYPE_NULL;
    } else {
        type = FLOW_VALUE_TYPE_UINT32;
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

export function buildFlowValue(dataBuffer: DataBuffer, flowValue: FlowValue) {
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
    } else if (flowValue.type == FLOW_VALUE_TYPE_ASSETS_STRING) {
        dataBuffer.writeObjectOffset(() => {
            dataBuffer.writeString(flowValue.value);
        });
        dataBuffer.writeUint32(0);
    } else {
        dataBuffer.writeUint64(0);
    }
}
