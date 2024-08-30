import type { ValueType } from "eez-studio-types";

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
export const FLOW_VALUE_TYPE_STRING_ASSET = 14;
export const FLOW_VALUE_TYPE_ARRAY = 15;
export const FLOW_VALUE_TYPE_ARRAY_ASSET = 16;
export const FLOW_VALUE_TYPE_STRING_REF = 17;
export const FLOW_VALUE_TYPE_ARRAY_REF = 18;
export const FLOW_VALUE_TYPE_BLOB_REF = 19;
export const FLOW_VALUE_TYPE_STREAM = 20;
export const FLOW_VALUE_TYPE_DATE = 21;
export const FLOW_VALUE_TYPE_VERSIONED_STRING = 22;
export const FLOW_VALUE_TYPE_VALUE_PTR = 23;
export const FLOW_VALUE_TYPE_ARRAY_ELEMENT_VALUE = 24;
export const FLOW_VALUE_TYPE_FLOW_OUTPUT = 25;
export const FLOW_VALUE_TYPE_NATIVE_VARIABLE = 26;
export const FLOW_VALUE_TYPE_ERROR = 27;
export const FLOW_VALUE_TYPE_RANGE = 28;
export const FLOW_VALUE_TYPE_POINTER = 29;
export const FLOW_VALUE_TYPE_ENUM = 30;
export const FLOW_VALUE_TYPE_IP_ADDRESS = 31;
export const FLOW_VALUE_TYPE_TIME_ZONE = 32;
export const FLOW_VALUE_TYPE_YT_DATA_GET_VALUE_FUNCTION_POINTER = 33;
export const FLOW_VALUE_TYPE_WIDGET = 34;
export const FLOW_VALUE_TYPE_JSON = 35;
export const FLOW_VALUE_TYPE_JSON_MEMBER_VALUE = 36;
export const FLOW_VALUE_TYPE_EVENT = 37;

export const basicFlowValueTypes: ValueType[] = [
    "undefined", // FLOW_VALUE_TYPE_UNDEFINED: 0
    "null", // FLOW_VALUE_TYPE_NULL: 1
    "boolean", // FLOW_VALUE_TYPE_BOOLEAN: 2
    "int8", // FLOW_VALUE_TYPE_INT8: 3
    "uint8", // FLOW_VALUE_TYPE_UINT8: 4
    "int16", // FLOW_VALUE_TYPE_INT16: 5
    "uint16", // FLOW_VALUE_TYPE_UINT16: 6
    "integer", // FLOW_VALUE_TYPE_INT32: 7
    "uint32", // FLOW_VALUE_TYPE_UINT32: 8
    "int64", // FLOW_VALUE_TYPE_INT64: 9
    "uint64", // FLOW_VALUE_TYPE_UINT64: 10
    "float", // FLOW_VALUE_TYPE_FLOAT: 11
    "double", // FLOW_VALUE_TYPE_DOUBLE: 12
    "string", // FLOW_VALUE_TYPE_STRING: 13
    "stringasset", // FLOW_VALUE_TYPE_STRING_ASSET: 14
    "array:any", // FLOW_VALUE_TYPE_ARRAY: 15
    "arrayasset", // FLOW_VALUE_TYPE_ARRAY_ASSET: 16
    "_t0", // FLOW_VALUE_TYPE_STRING_REF: 17
    "arrayref", // FLOW_VALUE_TYPE_ARRAY_REF: 18
    "blob", // FLOW_VALUE_TYPE_BLOB_REF: 19
    "stream", // FLOW_VALUE_TYPE_STREAM: 20
    "date", // FLOW_VALUE_TYPE_DATE: 21
    "_t1" as any, // FLOW_VALUE_TYPE_VERSIONED_STRING: 22
    "_t2" as any, // FLOW_VALUE_TYPE_VALUE_PTR: 23
    "_t3" as any, // FLOW_VALUE_TYPE_ARRAY_ELEMENT_VALUE: 24
    "_t4" as any, // FLOW_VALUE_TYPE_FLOW_OUTPUT: 25
    "_t5" as any, // FLOW_VALUE_TYPE_NATIVE_VARIABLE: 26
    "_t6" as any, // FLOW_VALUE_TYPE_ERROR: 27
    "_t7" as any, // FLOW_VALUE_TYPE_POINTER: 28
    "_t8" as any, // FLOW_VALUE_TYPE_POINTER: 29
    "_t9" as any, // FLOW_VALUE_TYPE_ENUM: 30
    "_t10" as any, // FLOW_VALUE_TYPE_IP_ADDRESS: 31
    "_t11" as any, // FLOW_VALUE_TYPE_TIME_ZONE: 32
    "_t12" as any, // FLOW_VALUE_TYPE_YT_DATA_GET_VALUE_FUNCTION_POINTER: 33
    "widget", // FLOW_VALUE_TYPE_WIDGET: 34
    "json", // FLOW_VALUE_TYPE_JSON: 35
    "_t13" as any, // FLOW_VALUE_TYPE_JSON_MEMBER_VALUE: 36
    "event" // FLOW_VALUE_TYPE_EVENT: 37
];
