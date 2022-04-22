import type {
    BasicType,
    IObjectVariableValueFieldDescription,
    ValueType
} from "eez-studio-types";

import type { Structure } from "project-editor/features/variable/variable";
import type { DocumentStoreClass } from "project-editor/store";
import {
    getStructureFromType,
    isObjectType,
    isStructType,
    getObjectVariableTypeFromType,
    objectVariableTypes,
    isArrayType,
    getArrayElementTypeFromType,
    basicTypeNames,
    SYSTEM_STRUCTURES
} from "project-editor/features/variable/value-type";
import { computed, makeObservable, observable, runInAction } from "mobx";
import { basicFlowValueTypes } from "project-editor/build/value-types";

function getFieldIndexes(fields: IField[]): IIndexes {
    const fieldIndexes: IIndexes = {};
    fields.forEach((field, i) => (fieldIndexes[field.name] = i));
    return fieldIndexes;
}

export class TypesStore {
    _types: IType[] = [];
    _typeIndexes: IIndexes = {};
    _numDynamicTypes: number = 0;
    lastChangeTime: number;

    constructor(public DocumentStore: DocumentStoreClass) {
        makeObservable(this, {
            allValueTypes: computed,
            lastChangeTime: observable
        });
    }

    reset() {
        this._types = [];
        this._typeIndexes = {};
        this._numDynamicTypes = 0;

        basicFlowValueTypes.forEach(valueType =>
            this._addType({
                kind: "basic",
                valueType
            })
        );

        SYSTEM_STRUCTURES.forEach(structure =>
            this.getTypeFromValueType(`struct:${structure.name}`)
        );

        basicTypeNames.forEach((basicTypeName: BasicType) => {
            this.getTypeFromValueType(`array:${basicTypeName}`);
        });

        this.allValueTypes.forEach(valueType =>
            this.getTypeFromValueType(valueType)
        );

        runInAction(() => {
            this.lastChangeTime = Date.now();
        });
    }

    get allValueTypes() {
        this.lastChangeTime;

        const allValueTypes: ValueType[] = [];

        allValueTypes.push(`undefined`);
        allValueTypes.push(`null`);

        objectVariableTypes.forEach((_, objectVariableTypeName) => {
            allValueTypes.push(`object:${objectVariableTypeName}`);
            allValueTypes.push(`array:object:${objectVariableTypeName}`);
        });

        basicTypeNames.forEach((basicTypeName: BasicType) => {
            allValueTypes.push(basicTypeName);
            allValueTypes.push(`array:${basicTypeName}`);
        });

        this.DocumentStore.project.variables.structsMap.forEach(structure => {
            allValueTypes.push(`struct:${structure.name}`);
            allValueTypes.push(`array:struct:${structure.name}`);
        });

        this.DocumentStore.project.variables.enumsMap.forEach(enumDef => {
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
        const valueType: ValueType = `dynamic:${this._numDynamicTypes++}`;
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
        this.lastChangeTime;

        const type = this.getTypeFromValueType(valueType);
        if (!type) {
            return undefined;
        }
        return this._typeIndexes[type.valueType];
    }

    getType(valueType: ValueType) {
        this.lastChangeTime;
        return this.getTypeFromValueType(valueType);
    }

    getFieldType(
        valueType: ValueType,
        fieldName: string
    ): ValueType | undefined {
        this.lastChangeTime;

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
        this.lastChangeTime;

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
        if (!this._typeIndexes[type.valueType]) {
            this._typeIndexes[type.valueType] = this._types.length;
        }
        this._types.push(type);
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

            const elementType = this.getTypeFromValueType(
                elementValueType as ValueType
            );
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
                this.DocumentStore.project,
                valueType
            );
            if (structure) {
                const type = this.structureToType(structure);
                this._addType(type);
                return type;
            }
        }

        if (isObjectType(valueType)) {
            const objectVariableType = getObjectVariableTypeFromType(valueType);
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

    private structureToType(structure: Structure): IType {
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
        const valueType: ValueType = `dynamic:${this._numDynamicTypes++}`;
        const type = this.objectVariableFieldDescriptionsToType(
            valueType,
            valueFieldDescriptions
        );
        this._addType(type);
        return valueType;
    }
}
