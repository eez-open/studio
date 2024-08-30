import type { Assets, DataBuffer } from "project-editor/build/assets";
import type { Variable } from "project-editor/features/variable/variable";
import {
    getArrayElementTypeFromType,
    getEnumFromType,
    isArrayType,
    isEnumType,
    isObjectType,
    isStructType,
    ValueType
} from "project-editor/features/variable/value-type";
import { evalConstantExpression } from "project-editor/flow/expression";
import { Section } from "project-editor/store";
import { MessageType } from "project-editor/core/object";
import {
    FLOW_VALUE_TYPE_ARRAY_ASSET,
    FLOW_VALUE_TYPE_BOOLEAN,
    FLOW_VALUE_TYPE_DATE,
    FLOW_VALUE_TYPE_DOUBLE,
    FLOW_VALUE_TYPE_EVENT,
    FLOW_VALUE_TYPE_FLOAT,
    FLOW_VALUE_TYPE_INT32,
    FLOW_VALUE_TYPE_JSON,
    FLOW_VALUE_TYPE_NULL,
    FLOW_VALUE_TYPE_STRING_ASSET,
    FLOW_VALUE_TYPE_UINT32,
    FLOW_VALUE_TYPE_UNDEFINED,
    FLOW_VALUE_TYPE_WIDGET
} from "project-editor/build/value-types";
import { Project } from "project-editor/project/project";
import { isArray } from "eez-studio-shared/util";

export interface FlowValue {
    type: number;
    value: any;
    valueType: ValueType;
}

export function getValueType(valueType: ValueType) {
    if (valueType == "undefined") {
        return FLOW_VALUE_TYPE_UNDEFINED;
    } else if (valueType == "null") {
        return FLOW_VALUE_TYPE_NULL;
    } else if (valueType == "integer") {
        return FLOW_VALUE_TYPE_INT32;
    } else if (valueType == "float") {
        return FLOW_VALUE_TYPE_FLOAT;
    } else if (valueType == "double") {
        return FLOW_VALUE_TYPE_DOUBLE;
    } else if (valueType == "boolean") {
        return FLOW_VALUE_TYPE_BOOLEAN;
    } else if (valueType == "string") {
        return FLOW_VALUE_TYPE_STRING_ASSET;
    } else if (valueType == "date") {
        return FLOW_VALUE_TYPE_DATE;
    } else if (valueType == "widget") {
        return FLOW_VALUE_TYPE_WIDGET;
    } else if (valueType == "json") {
        return FLOW_VALUE_TYPE_JSON;
    } else if (valueType == "event") {
        return FLOW_VALUE_TYPE_EVENT;
    } else if (isEnumType(valueType)) {
        return FLOW_VALUE_TYPE_INT32;
    } else if (isArrayType(valueType) || isStructType(valueType)) {
        return FLOW_VALUE_TYPE_ARRAY_ASSET;
    } else {
        return FLOW_VALUE_TYPE_UINT32;
    }
}

function getVariableFlowValue(assets: Assets, variable: Variable): FlowValue {
    let type;

    if (variable.type) {
        type = getValueType(variable.type);
    } else {
        assets.projectStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            "Variable type not set",
            variable
        );
        type = FLOW_VALUE_TYPE_UNDEFINED;
    }

    try {
        let { value } = evalConstantExpression(
            assets.rootProject,
            variable.defaultValue
        );

        if (variable.type == "json") {
            if (value) {
                value = assets.registerJSONValue(value);
            }
        }

        return {
            type,
            value,
            valueType: variable.type
        };
    } catch (err) {
        assets.projectStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            err.toString(),
            variable
        );

        return {
            type,
            value: null,
            valueType: "null"
        };
    }
}

export function buildConstantFlowValue(
    assets: Assets,
    dataBuffer: DataBuffer,
    flowValue: FlowValue
) {
    buildFlowValue(assets, dataBuffer, flowValue);
}

export function getDefaultValueForType(project: Project, type: ValueType): any {
    if (
        type == "integer" ||
        type == "float" ||
        type == "double" ||
        type == "date"
    ) {
        return 0;
    }
    if (type == "boolean") {
        return false;
    }
    if (type == "string") {
        return "";
    }
    if (isObjectType(type)) {
        return null;
    }
    if (isEnumType(type)) {
        const enumType = getEnumFromType(project, type);
        if (enumType) {
            if (enumType.members.length > 0) {
                return enumType.members[0].value;
            }
        }
        return 0;
    }
    if (isStructType(type)) {
        return null;
    }
    if (isArrayType(type)) {
        return null;
    }
    return null;
}

export function buildVariableFlowValue(
    assets: Assets,
    dataBuffer: DataBuffer,
    variable: Variable
) {
    buildFlowValue(assets, dataBuffer, getVariableFlowValue(assets, variable));
}

function buildFlowValue(
    assets: Assets,
    dataBuffer: DataBuffer,
    flowValue: FlowValue
) {
    if (flowValue.value === undefined) {
        dataBuffer.writeUint8(FLOW_VALUE_TYPE_UNDEFINED); // type_
        dataBuffer.writeUint8(0); // unit_
        dataBuffer.writeUint16(0); // options_
        dataBuffer.writeUint32(0); // reserved_
        dataBuffer.writeUint32(0);
        dataBuffer.writeUint32(0);
    } else if (flowValue.value === null) {
        dataBuffer.writeUint8(FLOW_VALUE_TYPE_NULL); // type_
        dataBuffer.writeUint8(0); // unit_
        dataBuffer.writeUint16(0); // options_
        dataBuffer.writeUint32(0); // reserved_
        dataBuffer.writeUint32(0);
        dataBuffer.writeUint32(0);
    } else {
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
        } else if (flowValue.type == FLOW_VALUE_TYPE_STRING_ASSET) {
            dataBuffer.writeObjectOffset(() => {
                dataBuffer.writeString(flowValue.value);
            });
            dataBuffer.writeUint32(0);
        } else if (flowValue.type == FLOW_VALUE_TYPE_DATE) {
            if (flowValue.value instanceof Date) {
                dataBuffer.writeDouble(flowValue.value.getTime());
            } else if (typeof flowValue.value == "number") {
                dataBuffer.writeDouble(flowValue.value);
            } else {
                dataBuffer.writeDouble(0);
            }
        } else if (flowValue.type == FLOW_VALUE_TYPE_ARRAY_ASSET) {
            dataBuffer.writeObjectOffset(() => {
                let elements: FlowValue[];

                if (isArray(flowValue.value)) {
                    const elementType =
                        getArrayElementTypeFromType(flowValue.valueType) ||
                        "any";

                    elements = flowValue.value.map((element: any) => ({
                        type: getValueType(elementType),
                        value: element,
                        valueType: elementType
                    }));
                } else {
                    const elementType = assets.projectStore.typesStore.getType(
                        flowValue.valueType
                    );
                    if (elementType?.kind != "object") {
                        throw "elementType is not struct type";
                    }
                    elements = elementType.fields.map(field => ({
                        type: getValueType(field.valueType),
                        value:
                            flowValue.value[field.name] !== undefined
                                ? flowValue.value[field.name]
                                : getDefaultValueForType(
                                      assets.projectStore.project,
                                      field.valueType
                                  ),
                        valueType: field.valueType
                    }));
                }

                // arraySize
                dataBuffer.writeUint32(elements.length);

                // arrayType
                let arrayType = assets.getTypeIndex(flowValue.valueType);
                dataBuffer.writeUint32(arrayType);

                // values
                elements.forEach(element =>
                    buildFlowValue(assets, dataBuffer, element)
                );
            }, 8);
            dataBuffer.writeUint32(0);
        } else if (flowValue.type == FLOW_VALUE_TYPE_JSON) {
            dataBuffer.writeInt32(flowValue.value);
            dataBuffer.writeUint32(0);
        } else {
            dataBuffer.writeUint64(0);
        }
    }
}
