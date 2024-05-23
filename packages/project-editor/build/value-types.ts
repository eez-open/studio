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
export const FLOW_VALUE_TYPE_ERROR = 27;
export const FLOW_VALUE_TYPE_POINTER = 29;
export const FLOW_VALUE_TYPE_WIDGET = 34;
export const FLOW_VALUE_TYPE_JSON = 35;

export const basicFlowValueTypes: ValueType[] = [
    "undefined", // FLOW_VALUE_TYPE_UNDEFINED
    "null", // FLOW_VALUE_TYPE_NULL
    "boolean", // FLOW_VALUE_TYPE_BOOLEAN
    "int8", // FLOW_VALUE_TYPE_INT8
    "uint8", // FLOW_VALUE_TYPE_UINT8
    "int16", // FLOW_VALUE_TYPE_INT16
    "uint16", // FLOW_VALUE_TYPE_UINT16
    "integer", // FLOW_VALUE_TYPE_INT32
    "uint32", // FLOW_VALUE_TYPE_UINT32
    "int64", // FLOW_VALUE_TYPE_INT64
    "uint64", // FLOW_VALUE_TYPE_UINT64
    "float", // FLOW_VALUE_TYPE_FLOAT
    "double", // FLOW_VALUE_TYPE_DOUBLE
    "string", // FLOW_VALUE_TYPE_STRING
    "stringasset", // FLOW_VALUE_TYPE_STRING_ASSET
    "array:any", // FLOW_VALUE_TYPE_ARRAY
    "arrayasset", // FLOW_VALUE_TYPE_ARRAY_ASSET
    "string", // FLOW_VALUE_TYPE_STRING_REF
    "arrayref", // FLOW_VALUE_TYPE_ARRAY_REF
    "blob", // FLOW_VALUE_TYPE_BLOB_REF
    "stream", // FLOW_VALUE_TYPE_STREAM
    "date", // FLOW_VALUE_TYPE_DATE
    "widget", // FLOW_VALUE_TYPE_WIDGET
    "json" // FLOW_VALUE_TYPE_JSON
];
