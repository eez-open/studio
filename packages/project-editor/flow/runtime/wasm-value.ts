import type {
    IObjectVariableType,
    IObjectVariableValueFieldDescription,
    ValueType
} from "eez-studio-types";
import {
    FLOW_VALUE_TYPE_ARRAY,
    FLOW_VALUE_TYPE_ARRAY_REF,
    FLOW_VALUE_TYPE_BOOLEAN,
    FLOW_VALUE_TYPE_DOUBLE,
    FLOW_VALUE_TYPE_FLOAT,
    FLOW_VALUE_TYPE_INT16,
    FLOW_VALUE_TYPE_INT32,
    FLOW_VALUE_TYPE_INT64,
    FLOW_VALUE_TYPE_INT8,
    FLOW_VALUE_TYPE_NULL,
    FLOW_VALUE_TYPE_STRING,
    FLOW_VALUE_TYPE_STRING_REF,
    FLOW_VALUE_TYPE_UINT16,
    FLOW_VALUE_TYPE_UINT32,
    FLOW_VALUE_TYPE_UINT64,
    FLOW_VALUE_TYPE_UINT8,
    FLOW_VALUE_TYPE_UNDEFINED
} from "project-editor/build/value-types";

type Values = (null | boolean | number | string | ArrayValue)[];

export const TYPE_ARRAY = 0xffffffff;

export type ArrayValue = {
    valueTypeIndex: number;
    values: Values;
};

export function createJsArrayValue(
    valueType: ValueType,
    value: any,
    assetsMap: AssetsMap,
    objectVariableType: IObjectVariableType | undefined
): ArrayValue | undefined {
    function createArrayValue(
        valueTypeIndex: number,
        value: any,
        valueFieldDescriptions:
            | IObjectVariableValueFieldDescription[]
            | undefined
    ): ArrayValue | undefined {
        const type = assetsMap.types[valueTypeIndex];
        return {
            valueTypeIndex,
            values: type.fields.map((field, i) => {
                const fieldValue = valueFieldDescriptions
                    ? valueFieldDescriptions[i].getFieldValue(value)
                    : value[field.name];

                const fieldValueTypeIndex =
                    assetsMap.typeIndexes[field.valueType];
                if (fieldValueTypeIndex != undefined) {
                    let fieldValueFieldDescriptions:
                        | IObjectVariableValueFieldDescription[]
                        | undefined;

                    if (valueFieldDescriptions) {
                        const temp = valueFieldDescriptions[i];
                        if (typeof temp.valueType != "string") {
                            fieldValueFieldDescriptions = temp.valueType;
                        }
                    }

                    return createArrayValue(
                        fieldValueTypeIndex,
                        fieldValue,
                        fieldValueFieldDescriptions
                    );
                }
                return fieldValue;
            })
        };
    }

    const valueTypeIndex = assetsMap.typeIndexes[valueType];
    if (valueTypeIndex == undefined) {
        return undefined;
    }

    return createArrayValue(
        valueTypeIndex,
        value,
        objectVariableType?.valueFieldDescriptions
    );
}

export function createWasmArrayValue(arrayValue: ArrayValue) {
    const arraySize = arrayValue.values.length;
    const arrayValuePtr = WasmFlowRuntime._arrayValueAlloc(
        arraySize,
        arrayValue.valueTypeIndex
    );
    for (let i = 0; i < arraySize; i++) {
        const value = arrayValue.values[i];
        if (typeof value == "number") {
            if (Number.isInteger(value)) {
                WasmFlowRuntime._arrayValueSetElementInt(
                    arrayValuePtr,
                    i,
                    value
                );
            } else {
                WasmFlowRuntime._arrayValueSetElementDouble(
                    arrayValuePtr,
                    i,
                    value
                );
            }
        } else if (typeof value == "boolean") {
            WasmFlowRuntime._arrayValueSetElementBool(arrayValuePtr, i, value);
        } else if (typeof value == "string") {
            const valuePtr = WasmFlowRuntime.allocateUTF8(value);
            WasmFlowRuntime._arrayValueSetElementString(
                arrayValuePtr,
                i,
                valuePtr
            );
            WasmFlowRuntime._free(arrayValuePtr);
        } else if (value == null) {
            WasmFlowRuntime._arrayValueSetElementNull(arrayValuePtr, i);
        } else {
            const valuePtr = createWasmArrayValue(value);
            WasmFlowRuntime._arrayValueSetElementValue(
                arrayValuePtr,
                i,
                valuePtr
            );
            WasmFlowRuntime._valueFree(valuePtr);
        }
    }
    return arrayValuePtr;
}

////////////////////////////////////////////////////////////////////////////////

type ValueWithType = {
    value: Value;
    valueType: ValueType;
};

type Value = null | undefined | boolean | number | string | ObjectOrArrayValue;

type ObjectOrArrayValueWithType = {
    value: ObjectOrArrayValue;
    valueType: ValueType;
};

type ObjectOrArrayValue = undefined | Value[] | { [fieldName: string]: Value };

export function getValue(offset: number): ValueWithType {
    const type = WasmFlowRuntime.HEAPU8[offset];
    offset += 8;
    if (type == FLOW_VALUE_TYPE_UNDEFINED) {
        return { value: undefined, valueType: "undefined" };
    } else if (type == FLOW_VALUE_TYPE_NULL) {
        return { value: null, valueType: "null" };
    } else if (type == FLOW_VALUE_TYPE_BOOLEAN) {
        return {
            value: WasmFlowRuntime.HEAP32[offset >> 2] ? true : false,
            valueType: "boolean"
        };
    } else if (type == FLOW_VALUE_TYPE_INT8) {
        return { value: WasmFlowRuntime.HEAP8[offset], valueType: "integer" };
    } else if (type == FLOW_VALUE_TYPE_UINT8) {
        return { value: WasmFlowRuntime.HEAPU8[offset], valueType: "integer" };
    } else if (type == FLOW_VALUE_TYPE_INT16) {
        return {
            value: WasmFlowRuntime.HEAP16[offset >> 1],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_UINT16) {
        return {
            value: WasmFlowRuntime.HEAPU16[offset >> 1],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_INT32) {
        return {
            value: WasmFlowRuntime.HEAP32[offset >> 2],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_UINT32) {
        return {
            value: WasmFlowRuntime.HEAPU32[offset >> 2],
            valueType: "integer"
        };
    } else if (type == FLOW_VALUE_TYPE_INT64) {
        // TODO
        return { value: undefined, valueType: "undefined" };
    } else if (type == FLOW_VALUE_TYPE_UINT64) {
        // TODO
        return { value: undefined, valueType: "undefined" };
    } else if (type == FLOW_VALUE_TYPE_FLOAT) {
        return {
            value: WasmFlowRuntime.HEAPF32[offset >> 2],
            valueType: "float"
        };
    } else if (type == FLOW_VALUE_TYPE_DOUBLE) {
        return {
            value: WasmFlowRuntime.HEAPF64[offset >> 3],
            valueType: "double"
        };
    } else if (type == FLOW_VALUE_TYPE_STRING) {
        const ptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return {
            value: WasmFlowRuntime.AsciiToString(ptr),
            valueType: "string"
        };
    } else if (type == FLOW_VALUE_TYPE_ARRAY) {
        const ptr = WasmFlowRuntime.HEAP32[offset >> 2];
        return getArrayValue(ptr);
    } else if (type == FLOW_VALUE_TYPE_STRING_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = WasmFlowRuntime.HEAP32[(refPtr >> 2) + 2];
        return {
            value: WasmFlowRuntime.AsciiToString(ptr),
            valueType: "string"
        };
    } else if (type == FLOW_VALUE_TYPE_ARRAY_REF) {
        const refPtr = WasmFlowRuntime.HEAP32[offset >> 2];
        const ptr = refPtr + 8;
        return getArrayValue(ptr);
    }

    console.error("Unknown type from WASM: ", type);
    return { value: undefined, valueType: "undefined" };
}

export function getArrayValue(
    offset: number,
    expectedTypes?: ValueType[]
): ObjectOrArrayValueWithType {
    const arraySize = WasmFlowRuntime.HEAPU32[offset >> 2];
    const arrayType = WasmFlowRuntime.HEAPU32[(offset >> 2) + 1];
    if (arrayType == TYPE_ARRAY) {
        if (
            expectedTypes &&
            !expectedTypes.find(valueType => valueType.startsWith("array:"))
        ) {
            return {
                value: undefined,
                valueType: "undefined" as ValueType
            };
        }

        const value: Value[] = [];
        for (let i = 0; i < arraySize; i++) {
            value.push(getValue(offset + 8 + i * 16).value);
        }
        return {
            value,
            valueType: "array:any" as ValueType
        };
    } else {
        const type = WasmFlowRuntime.assetsMap.types[arrayType];
        if (!type) {
            console.error("Invalid array value type");
            return {
                value: undefined,
                valueType: "undefined" as ValueType
            };
        }

        if (expectedTypes && expectedTypes.indexOf(type.valueType) == -1) {
            return {
                value: undefined,
                valueType: "undefined" as ValueType
            };
        }

        const value: { [fieldName: string]: Value } = {};

        for (let i = 0; i < type.fields.length; i++) {
            if (i >= arraySize) {
                console.error("Invalid array value size");
                break;
            }
            const field = type.fields[i];
            value[field.name] = getValue(offset + 8 + i * 16).value;
        }

        return {
            value,
            valueType: type.valueType
        };
    }
}
