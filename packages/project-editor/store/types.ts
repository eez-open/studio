import type {
    BasicType,
    IField,
    IFieldIndexes,
    IIndexes,
    IObjectVariableValueFieldDescription,
    IType,
    ValueType
} from "eez-studio-types";

import type { IStructure } from "project-editor/features/variable/variable";
import type { ProjectStore } from "project-editor/store";
import {
    getStructureFromType,
    isObjectType,
    isStructType,
    getObjectVariableTypeFromType,
    isArrayType,
    getArrayElementTypeFromType,
    BASIC_TYPE_NAMES,
    SYSTEM_STRUCTURES,
    getSystemEnums
} from "project-editor/features/variable/value-type";
import { computed, makeObservable } from "mobx";
import { basicFlowValueTypes } from "project-editor/build/value-types";

function getFieldIndexes(fields: IField[]): IFieldIndexes {
    const fieldIndexes: IFieldIndexes = {};
    fields.forEach((field, i) => (fieldIndexes[field.name] = i));
    return fieldIndexes;
}

export class TypesStore {
    _types: { [key: string]: IType } = {};
    _typeIndexes: IIndexes = {};

    _basicTypeIndex: number = 0;
    _systemStructureTypeIndex: number = 0;
    _userStructureTypeIndex: number = 0;
    _systemEnumTypeIndex: number = 0;
    _userEnumTypeIndex: number = 0;
    _objectTypeIndex: number = 0;
    _dynamicTypeIndex: number = 0;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            allValueTypes: computed
        });
    }

    reset() {
        this.projectStore.lastRevision;

        this._types = {};
        this._typeIndexes = {};

        this._basicTypeIndex = 0;
        this._systemStructureTypeIndex = 0;
        this._userStructureTypeIndex = 0;
        this._systemEnumTypeIndex = 0;
        this._userEnumTypeIndex = 0;
        this._objectTypeIndex = 0;
        this._dynamicTypeIndex = 0;

        basicFlowValueTypes.forEach(valueType =>
            this._addType({
                kind: "basic",
                valueType
            })
        );

        SYSTEM_STRUCTURES.forEach(structure =>
            this.getTypeFromValueType(`struct:${structure.name}`)
        );

        const systemEnums = getSystemEnums(this.projectStore);
        systemEnums.forEach(enumDef =>
            this.getTypeFromValueType(`enum:${enumDef.name}`)
        );

        BASIC_TYPE_NAMES.forEach((basicTypeName: BasicType) => {
            this.getTypeFromValueType(`array:${basicTypeName}`);
        });

        this.allValueTypes.forEach(valueType =>
            this.getTypeFromValueType(valueType)
        );
    }

    get allValueTypes() {
        const allValueTypes: ValueType[] = [];

        allValueTypes.push(`undefined`);
        allValueTypes.push(`null`);

        this.projectStore.objectVariableTypes.forEach(
            (_, objectVariableTypeName) => {
                allValueTypes.push(`object:${objectVariableTypeName}`);
                allValueTypes.push(`array:object:${objectVariableTypeName}`);
            }
        );

        BASIC_TYPE_NAMES.forEach((basicTypeName: BasicType) => {
            allValueTypes.push(basicTypeName);
            allValueTypes.push(`array:${basicTypeName}`);
        });

        allValueTypes.push(`array:array:integer`);

        this.projectStore.project.variables.structsMap.forEach(structure => {
            allValueTypes.push(`struct:${structure.name}`);
            allValueTypes.push(`array:struct:${structure.name}`);
        });

        this.projectStore.project.variables.enumsMap.forEach(enumDef => {
            allValueTypes.push(`enum:${enumDef.name}`);
            allValueTypes.push(`array:enum:${enumDef.name}`);
        });

        return allValueTypes;
    }

    get types() {
        return JSON.parse(JSON.stringify(this._types));
    }

    get typeIndexes() {
        return JSON.parse(JSON.stringify(this._typeIndexes));
    }

    createOpenType() {
        const valueType: ValueType = `dynamic:${this._dynamicTypeIndex}`;
        const type: IType = {
            kind: "object",
            valueType,
            fields: [],
            fieldIndexes: {},
            open: true
        };
        this._addType(type);
        return valueType;
    }

    getValueTypeIndex(valueType: ValueType): number | undefined {
        const type = this.getTypeFromValueType(valueType);
        if (!type) {
            return undefined;
        }
        return +this._typeIndexes[type.valueType];
    }

    getType(valueType: ValueType) {
        return this.getTypeFromValueType(valueType);
    }

    getFieldType(
        valueType: ValueType,
        fieldName: string
    ): ValueType | undefined {
        const type = this.getTypeFromValueType(valueType);
        if (!type) {
            return undefined;
        }

        if (type.kind == "basic") {
            return undefined;
        }

        if (type.kind == "array") {
            return type.elementType.valueType;
        }

        let field: IField | undefined;

        let fieldIndex = type.fieldIndexes[fieldName];
        if (fieldIndex != undefined) {
            field = type.fields[fieldIndex];
        } else if (type.open) {
            field = {
                name: fieldName,
                valueType: "any"
            };
            type.fieldIndexes[fieldName] = type.fields.length;
            type.fields.push(field);
        }

        return field?.valueType;
    }

    getFieldIndex(valueType: ValueType, fieldName: string): number | undefined {
        const type = this.getTypeFromValueType(valueType);
        if (!type) {
            return undefined;
        }
        if (type.kind == "object") {
            return type.fieldIndexes[fieldName];
        }
        return undefined;
    }

    _addType(type: IType) {
        let index: number;

        let indexAsStr = this._typeIndexes[type.valueType];
        if (indexAsStr != undefined) {
            index = +indexAsStr;
        } else {
            const TYPE_MASK = 0x1fff;

            const CATEGORY_SHIFT = 13;
            const CATEGORY_MASK = 0x7;

            const CATEGORY_BASIC = 0;
            const CATEGORY_SYSTEM_STRUCTURE = 1;
            const CATEGORY_USER_STRUCTURE = 2;
            const CATEGORY_SYSTEM_ENUM = 3;
            const CATEGORY_USER_ENUM = 4;
            const CATEGORY_OBJECT = 5;
            const CATEGORY_DYNAMIC = 6;

            const ARRAY_MARK_SHIFT = 16;

            let T;
            let C;
            let A;

            if (type.kind == "basic") {
                T = this._basicTypeIndex++;
                C = CATEGORY_BASIC;
                A = 0;
            } else if (type.kind == "object") {
                if (type.valueType.startsWith("struct:")) {
                    if (type.valueType["struct:".length] == "$") {
                        T = this._systemStructureTypeIndex++;
                        C = CATEGORY_SYSTEM_STRUCTURE;
                    } else {
                        T = this._userStructureTypeIndex++;
                        C = CATEGORY_USER_STRUCTURE;
                    }
                } else if (type.valueType.startsWith("enum:")) {
                    if (type.valueType["enum:".length] == "$") {
                        T = this._systemEnumTypeIndex++;
                        C = CATEGORY_SYSTEM_ENUM;
                    } else {
                        T = this._userEnumTypeIndex++;
                        C = CATEGORY_USER_ENUM;
                    }
                } else if (type.valueType.startsWith("object:")) {
                    T = this._objectTypeIndex++;
                    C = CATEGORY_OBJECT;
                } else {
                    if (!type.valueType.startsWith("dynamic:")) {
                        throw "unexpected valueType";
                    }
                    T = this._dynamicTypeIndex++;
                    C = CATEGORY_DYNAMIC;
                }
                A = 0;
            } else {
                // array
                let index = this._addType(type.elementType);
                T = index & TYPE_MASK;
                C = (index >> CATEGORY_SHIFT) & CATEGORY_MASK;
                A = (index >> (ARRAY_MARK_SHIFT - 1)) | 0x1;
            }

            // aaaa aaaa aaaa aaaa ccct tttt tttt tttt

            index = (A << ARRAY_MARK_SHIFT) | (C << CATEGORY_SHIFT) | T;

            indexAsStr = index.toString();

            this._typeIndexes[type.valueType] = indexAsStr;
            this._types[indexAsStr] = type;
        }

        return index;
    }

    private getTypeFromValueType(valueType: ValueType): IType | undefined {
        const index = this._typeIndexes[valueType];
        if (index != undefined) {
            return this._types[index];
        }

        if (isArrayType(valueType)) {
            const elementValueType = getArrayElementTypeFromType(valueType);
            if (!elementValueType) {
                return undefined;
            }

            const elementType = this.getTypeFromValueType(elementValueType);
            if (!elementType) {
                return undefined;
            }

            const type: IType = {
                kind: "array",
                valueType,
                elementType
            };

            this._addType(type);

            return type;
        }

        if (isStructType(valueType)) {
            const structure = getStructureFromType(
                this.projectStore.project,
                valueType
            );
            if (!structure) {
                return undefined;
            }
            const type = this.structureToType(structure);
            this._addType(type);
            return type;
        }

        if (isObjectType(valueType)) {
            const objectVariableType = getObjectVariableTypeFromType(
                this.projectStore,
                valueType
            );
            if (objectVariableType) {
                const type = this.objectVariableFieldDescriptionsToType(
                    valueType,
                    objectVariableType.valueFieldDescriptions
                );
                this._addType(type);
                return type;
            }
        }

        const type: IType = {
            kind: "basic",
            valueType
        };
        this._addType(type);

        return type;
    }

    private structureToType(structure: IStructure): IType {
        const fields: IField[] = structure.fields.map(field => ({
            name: field.name,
            valueType: field.type
        }));

        return {
            kind: "object",
            valueType: `struct:${structure.name}`,
            fields,
            fieldIndexes: getFieldIndexes(fields),
            open: false
        };
    }

    private objectVariableFieldDescriptionsToType(
        valueType: ValueType,
        valueFieldDescriptions: IObjectVariableValueFieldDescription[]
    ): IType {
        const fields: IField[] = valueFieldDescriptions.map(
            valueFieldDescription => ({
                name: valueFieldDescription.name,
                valueType:
                    typeof valueFieldDescription.valueType == "string"
                        ? valueFieldDescription.valueType
                        : this._createDynamicTypeForObjectVariableValueFieldDescription(
                              valueFieldDescription.valueType
                          )
            })
        );

        return {
            kind: "object",
            valueType,
            fields,
            fieldIndexes: getFieldIndexes(fields),
            open: false
        };
    }

    _createDynamicTypeForObjectVariableValueFieldDescription(
        valueFieldDescriptions: IObjectVariableValueFieldDescription[]
    ): ValueType {
        const valueType: ValueType = `dynamic:${this._dynamicTypeIndex}`;
        const type = this.objectVariableFieldDescriptionsToType(
            valueType,
            valueFieldDescriptions
        );
        this._addType(type);
        return valueType;
    }
}
