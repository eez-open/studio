import { Stream } from "stream";
import React from "react";
import {
    action,
    observable,
    autorun,
    runInAction,
    makeObservable,
    IReactionDisposer,
    computed
} from "mobx";
import { observer } from "mobx-react";

import { humanize } from "eez-studio-shared/string";
import { _difference } from "eez-studio-shared/algorithm";

import { FieldComponent } from "eez-studio-ui/generic-dialog";

import type {
    IObjectVariableType,
    IObjectVariableValue,
    ValueType
} from "eez-studio-types";

import {
    PropertyType,
    PropertyInfo,
    PropertyProps
} from "project-editor/core/object";
import type { Project } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { getPropertyValue } from "project-editor/ui-components/PropertyGrid/utils";
import type {
    IFlowContext,
    IVariable
} from "project-editor/flow/flow-interfaces";

import type {
    IStructure,
    IStructureField
} from "project-editor/features/variable/variable";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import type { ProjectStore } from "project-editor/store";

export type {
    IObjectVariableValueConstructorParams,
    IObjectVariableValue,
    IObjectVariableType,
    BasicType,
    ValueType
} from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

export const BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date",
    "blob",
    "stream",
    "any"
];

export const FIRMWARE_BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date",
    "any"
];

export const LVGL_BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string"
];

export const LVGL_FLOW_BASIC_TYPE_NAMES = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date",
    "any"
];

////////////////////////////////////////////////////////////////////////////////

export const CLICK_EVENT_STRUCT_NAME = "$ClickEvent";
export const CHECKBOX_CHANGE_EVENT_STRUCT_NAME = "$CheckboxChangeEvent";
export const TEXT_INPUT_CHANGE_EVENT_STRUCT_NAME = "$TextInputChangeEvent";
export const DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME =
    "$DropDownListChangeEvent";
export const SCROLLBAR_STATE_STRUCT_NAME = "$ScrollbarState";

class SystemStructure implements IStructure {
    name: string;
    fields: IStructureField[];

    constructor(structure: Omit<IStructure, "fieldsMap">) {
        Object.assign(this, structure);

        makeObservable(this, {
            name: observable,
            fields: observable,
            fieldsMap: computed
        });
    }

    get fieldsMap() {
        return new Map<string, IStructureField>(
            this.fields.map(field => [field.name, field])
        );
    }
}

export const SYSTEM_STRUCTURES: IStructure[] = [
    new SystemStructure({
        name: CLICK_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            }
        ]
    }),
    new SystemStructure({
        name: CHECKBOX_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "value",
                type: "boolean"
            }
        ]
    }),
    new SystemStructure({
        name: TEXT_INPUT_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "value",
                type: "string"
            }
        ]
    }),
    new SystemStructure({
        name: DROP_DOWN_LIST_CHANGE_EVENT_STRUCT_NAME,
        fields: [
            {
                name: "index",
                type: "integer"
            },
            {
                name: "indexes",
                type: "array:integer"
            },
            {
                name: "selectedIndex",
                type: "integer"
            }
        ]
    }),
    new SystemStructure({
        name: SCROLLBAR_STATE_STRUCT_NAME,
        fields: [
            {
                name: "numItems",
                type: "integer"
            },
            {
                name: "itemsPerPage",
                type: "integer"
            },
            {
                name: "positionIncrement",
                type: "integer"
            },
            {
                name: "position",
                type: "integer"
            }
        ]
    })
];

export function registerSystemStructure(
    structure: Omit<IStructure, "fieldsMap">
) {
    SYSTEM_STRUCTURES.push(new SystemStructure(structure));
}

////////////////////////////////////////////////////////////////////////////////

export function humanizeVariableType(type: string): string {
    if (isObjectType(type)) {
        return getObjectType(type) ?? "";
    }
    if (isEnumType(type)) {
        return getEnumTypeNameFromType(type) ?? "";
    }
    if (isStructType(type)) {
        return getStructTypeNameFromType(type) ?? "";
    }
    if (isArrayType(type)) {
        return `Array of ${humanizeVariableType(
            getArrayElementTypeFromType(type) ?? ""
        )}`;
    }
    return humanize(type);
}

export function getDefaultValueForType(project: Project, type: string): string {
    if (isObjectType(type)) {
        return "null";
    }
    if (isEnumType(type)) {
        const enumTypeName = getEnumTypeNameFromType(type);
        if (enumTypeName) {
            const enumType = project.variables.enumsMap.get(enumTypeName);
            if (enumType) {
                if (enumType.members.length > 0) {
                    return `${enumTypeName}.${enumType.members[0].name}`;
                }
            }
        }
        return "0";
    }
    if (isStructType(type)) {
        return "null";
    }
    if (isArrayType(type)) {
        return "null";
    }
    if (type == "string") {
        return '""';
    }
    if (type == "boolean") {
        return "false";
    }
    if (type == "integer" || type == "float" || type == "double") {
        return "0";
    }
    return "null";
}

export function getValueLabel(
    project: Project,
    value: any,
    type: string | null
) {
    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    if (type) {
        if (isEnumType(type)) {
            const enumTypeName = getEnumTypeNameFromType(type);
            if (enumTypeName) {
                const enumType = project.variables.enumsMap.get(enumTypeName);
                if (enumType) {
                    const enumMember = enumType.members.find(
                        member => member.value == value
                    );
                    if (enumMember) {
                        return enumMember.name;
                    }
                }
            }
        }
    }

    if (Array.isArray(value) || value instanceof Uint8Array) {
        return `${value.length} element(s)`;
    }

    if (value instanceof Date) {
        return value.toString();
    }

    if (typeof value == "object") {
        return "";
        // try {
        //     return JSON.stringify(value);
        // } catch (err) {
        //     return "[object]";
        // }
    }

    if (typeof value == "string") {
        return JSON.stringify(value);
    }

    if (value instanceof Stream) {
        return "stream";
    }

    return value.toString();
}

////////////////////////////////////////////////////////////////////////////////

const VariableTypeSelect = observer(
    React.forwardRef<
        HTMLSelectElement,
        {
            value: string;
            onChange: (value: string) => void;
            project: Project;
        }
    >((props, ref) => {
        const allTypes = new Set<string>();

        function addType(type: string) {
            allTypes.add(type);
            return type;
        }

        const { value, onChange, project } = props;

        const basicTypeNames = props.project.projectTypeTraits.isLVGL
            ? props.project.projectTypeTraits.hasFlowSupport
                ? LVGL_FLOW_BASIC_TYPE_NAMES
                : LVGL_BASIC_TYPE_NAMES
            : props.project.projectTypeTraits.isDashboard
            ? BASIC_TYPE_NAMES
            : FIRMWARE_BASIC_TYPE_NAMES;

        const basicTypes = basicTypeNames.map(basicTypeName => {
            return (
                <option key={basicTypeName} value={addType(basicTypeName)}>
                    {humanizeVariableType(basicTypeName)}
                </option>
            );
        });
        basicTypes.unshift(<option key="__empty" value={addType("")} />);

        const objectTypes =
            props.project.projectTypeTraits.hasFlowSupport &&
            !props.project.projectTypeTraits.isLVGL
                ? [...project._store.objectVariableTypes.keys()].map(name => {
                      return (
                          <option key={name} value={addType(`object:${name}`)}>
                              {humanizeVariableType(`object:${name}`)}
                          </option>
                      );
                  })
                : [];

        const enums = project.variables.enums.map(enumDef => (
            <option key={enumDef.name} value={addType(`enum:${enumDef.name}`)}>
                {humanizeVariableType(`enum:${enumDef.name}`)}
            </option>
        ));

        const structureTypes = [
            ...project.variables.structures,
            ...(props.project.projectTypeTraits.isLVGL ? [] : SYSTEM_STRUCTURES)
        ];

        const structures = props.project.projectTypeTraits.hasFlowSupport
            ? structureTypes.map(struct => (
                  <option
                      key={struct.name}
                      value={addType(`struct:${struct.name}`)}
                  >
                      {humanizeVariableType(`struct:${struct.name}`)}
                  </option>
              ))
            : [];

        const arrayOfBasicTypes =
            !props.project.projectTypeTraits.isLVGL ||
            props.project.projectTypeTraits.hasFlowSupport
                ? basicTypeNames.map(basicTypeName => {
                      return (
                          <option
                              key={`array:${basicTypeName}`}
                              value={addType(`array:${basicTypeName}`)}
                          >
                              {humanizeVariableType(`array:${basicTypeName}`)}
                          </option>
                      );
                  })
                : [];

        const arrayOfObjects =
            props.project.projectTypeTraits.hasFlowSupport &&
            !props.project.projectTypeTraits.isLVGL
                ? [...project._store.objectVariableTypes.keys()].map(name => {
                      return (
                          <option
                              key={name}
                              value={addType(`array:object:${name}`)}
                          >
                              {humanizeVariableType(`array:object:${name}`)}
                          </option>
                      );
                  })
                : [];

        const arrayOfEnums = props.project.projectTypeTraits.hasFlowSupport
            ? project.variables.enums.map(enumDef => (
                  <option
                      key={enumDef.name}
                      value={addType(`array:enum:${enumDef.name}`)}
                  >
                      {humanizeVariableType(`array:enum:${enumDef.name}`)}
                  </option>
              ))
            : [];

        const arrayOfStructures = props.project.projectTypeTraits.hasFlowSupport
            ? structureTypes.map(struct => (
                  <option
                      key={struct.name}
                      value={addType(`array:struct:${struct.name}`)}
                  >
                      {humanizeVariableType(`array:struct:${struct.name}`)}
                  </option>
              ))
            : [];

        if (!allTypes.has(value)) {
            basicTypes.splice(
                1,
                0,
                <option key="__notfound" value={value} className="error">
                    [Not found!] {value}
                </option>
            );
        }

        return (
            <select
                ref={ref}
                className="form-select"
                value={value}
                onChange={event => onChange(event.target.value)}
            >
                {basicTypes}

                {objectTypes.length > 0 && (
                    <optgroup label="Objects">{objectTypes}</optgroup>
                )}

                {enums.length > 0 && (
                    <optgroup label="Enumerations">{enums}</optgroup>
                )}

                {structures.length > 0 && (
                    <optgroup label="Structures">{structures}</optgroup>
                )}

                {arrayOfBasicTypes.length > 0 && (
                    <optgroup label="Arrays">{arrayOfBasicTypes}</optgroup>
                )}

                {arrayOfObjects.length > 0 && (
                    <optgroup label="Array of Objects">
                        {arrayOfObjects}
                    </optgroup>
                )}

                {arrayOfEnums.length > 0 && (
                    <optgroup label="Array of Enumerations">
                        {arrayOfEnums}
                    </optgroup>
                )}

                {arrayOfStructures.length > 0 && (
                    <optgroup label="Array of Structures">
                        {arrayOfStructures}
                    </optgroup>
                )}
            </select>
        );
    })
);

export const VariableTypeUI = observer(
    class VariableTypeUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        ref = React.createRef<HTMLSelectElement>();

        _type: ValueType;
        updateCounter: number = 0;

        changeDocumentDisposer: IReactionDisposer;

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                _type: observable,
                updateCounter: observable,
                componentDidUpdate: action
            });
        }

        componentDidMount() {
            let el = this.ref.current;
            if (el) {
                $(el).on("focus", () => {
                    this.context.undoManager.setCombineCommands(true);
                });

                $(el).on("blur", () => {
                    this.context.undoManager.setCombineCommands(false);
                });
            }

            this.changeDocumentDisposer = autorun(() => {
                this.updateCounter;
                if (this.context.project) {
                    const getPropertyValueResultForType = getPropertyValue(
                        this.props.objects,
                        this.props.propertyInfo
                    );

                    let type = getPropertyValueResultForType
                        ? getPropertyValueResultForType.value
                        : "";

                    if (type == undefined) {
                        type = "";
                    }

                    runInAction(() => {
                        this._type = type;
                    });
                }
            });
        }

        componentDidUpdate() {
            this.updateCounter++;
        }

        componentWillUnmount() {
            this.changeDocumentDisposer();
        }

        onChange = (type: string) => {
            runInAction(() => (this._type = type as ValueType));

            this.props.updateObject({
                [this.props.propertyInfo.name]: type
            });
        };

        render() {
            return (
                <VariableTypeSelect
                    ref={this.ref}
                    value={this._type}
                    onChange={this.onChange}
                    project={this.context.project}
                />
            );
        }
    }
);

export const VariableTypeFieldComponent = observer(
    class VariableTypeFieldComponent extends FieldComponent {
        get project() {
            return this.props.dialogContext as Project;
        }

        render() {
            return (
                <VariableTypeSelect
                    value={
                        this.props.values[this.props.fieldProperties.name] ?? ""
                    }
                    onChange={(value: string) => {
                        runInAction(() => {
                            this.props.values["defaultValue"] =
                                getDefaultValueForType(this.project, value);
                        });
                        this.props.onChange(value);
                    }}
                    project={this.project}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const variableTypeProperty: PropertyInfo = {
    name: "type",
    type: PropertyType.String,
    propertyGridColumnComponent: VariableTypeUI
};

////////////////////////////////////////////////////////////////////////////////

export function migrateType(objectJS: any) {
    if (!objectJS.type) {
        return;
    }
    if (objectJS.type == "list") {
        objectJS.type = "array";
    } else if (objectJS.type.startsWith("custom:")) {
        objectJS.type = `object:${objectJS.type.substring("custom:".length)}`;
    } else if (objectJS.type == "struct") {
        objectJS.type = `struct:${objectJS.structure}`;
        delete objectJS.structure;
    } else if (objectJS.type == "enum") {
        objectJS.type = `enum:${objectJS.enum}`;
        delete objectJS.enum;
    } else if (objectJS.type == "struct:$ActionParams") {
        objectJS.type = "struct:$ClickEvent";
    } else if (objectJS.type == "struct:$CheckboxActionParams") {
        objectJS.type = "struct:$CheckboxChangeEvent";
    } else if (objectJS.type == "struct:$TextInputActionParams") {
        objectJS.type = "struct:$TextInputChangeEvent";
    } else if (objectJS.type == "struct:$DropDownListActionParams") {
        objectJS.type = "struct:$DropDownListChangeEvent";
    }
}

////////////////////////////////////////////////////////////////////////////////

const ENUM_TYPE_REGEXP = /^enum:(.*)/;
const STRUCT_TYPE_REGEXP = /^struct:(.*)/;
const DYNAMIC_TYPE_REGEXP = /^dynamic:(.*)/;
const ARRAY_TYPE_REGEXP = /^array:(.*)/;
const OBJECT_TYPE_REGEXP = /^object:(.*)/;

export function isIntegerType(type: string) {
    return type == "integer";
}

export function isBasicType(type: string) {
    return BASIC_TYPE_NAMES.indexOf(type) != -1;
}

export function isEnumType(type: string) {
    return type && type.match(ENUM_TYPE_REGEXP) != null;
}

export function isStructType(type: string) {
    return type && type.match(STRUCT_TYPE_REGEXP) != null;
}

export function isDynamicType(type: string) {
    return type && type.match(DYNAMIC_TYPE_REGEXP) != null;
}

export function isArrayType(type: string) {
    return type ? type.match(ARRAY_TYPE_REGEXP) != null : false;
}

export function isObjectType(type: string) {
    return type && type.match(OBJECT_TYPE_REGEXP) != null ? true : false;
}

export function getObjectType(type: string) {
    const result = type.match(OBJECT_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getArrayElementTypeFromType(type: string) {
    const result = type.match(ARRAY_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1] as ValueType;
}

export function getStructTypeNameFromType(type: string) {
    const result = type.match(STRUCT_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getStructureFromType(
    project: Project,
    type: string
): IStructure | undefined {
    const structTypeName = getStructTypeNameFromType(type);
    if (!structTypeName) {
        return undefined;
    }
    return project.variables.structsMap.get(structTypeName);
}

export function getDynamicTypeNameFromType(type: string) {
    const result = type.match(DYNAMIC_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getEnumTypeNameFromType(type: string) {
    const result = type.match(ENUM_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getObjectVariableTypeFromType(
    projectStore: ProjectStore,
    type: string
) {
    const result = type.match(OBJECT_TYPE_REGEXP);
    if (result == null) {
        return undefined;
    }

    const objectVariableTypeName = result[1];

    return projectStore.objectVariableTypes.get(objectVariableTypeName);
}

export function isIntegerVariable(variable: IVariable) {
    return isIntegerType(variable.type);
}

export function isEnumVariable(variable: IVariable) {
    return isEnumType(variable.type);
}

export function isStructVariable(variable: IVariable) {
    return isStructType(variable.type);
}

export function isArrayVariable(variable: IVariable) {
    return isArrayType(variable.type);
}

export function getEnumTypeNameFromVariable(variable: IVariable) {
    return getEnumTypeNameFromType(variable.type);
}

export function getEnumValues(variable: IVariable): any[] {
    return [];
}

export function isValueTypeOf(
    project: Project,
    value: any,
    type: string
): string | null {
    if (value == null) {
        return null;
    }
    if (type == "integer") {
        if (Number.isInteger(value)) return null;
    } else if (type == "float" || type == "double") {
        if (typeof value == "number") return null;
    } else if (type == "boolean") {
        if (typeof value == "boolean" || Number.isInteger(value)) return null;
    } else if (type == "string") {
        if (typeof value == "string") return null;
    } else if (type == "date") {
        return null;
    } else if (isArrayType(type)) {
        if (Array.isArray(value)) {
            const arrayElementType = getArrayElementTypeFromType(type);

            for (let i = 0; i < value.length; i++) {
                const result = isValueTypeOf(
                    project,
                    value[i],
                    arrayElementType!
                );
                if (result) {
                    return `${result} => array element ${
                        i + 1
                    } is not an ${type}`;
                }
            }

            return null;
        }
    } else if (isStructType(type)) {
        if (typeof value == "object") {
            const structure = getStructureFromType(project, type);
            if (!structure) {
                return `'${type}' not found`;
            }

            const keys = [];

            for (const key in value) {
                const field = structure.fieldsMap.get(key);
                if (!field) {
                    return `unknown field '${key}'`;
                }

                const result = isValueTypeOf(project, value[key], field.type);
                if (result) {
                    return `${result} => field '${key}' should be of type '${field.type}'`;
                }

                keys.push(key);
            }

            // const result = _difference(
            //     structure.fields.map(field => field.name),
            //     keys
            // );

            // if (result.length > 0) {
            //     return `missing field(s): ${result.join(",")}`;
            // }

            return null;
        }
    } else if (isEnumType(type)) {
        if (!Number.isInteger(value)) {
            return `not an integer`;
        }

        const enumTypeName = getEnumTypeNameFromType(type);
        if (!enumTypeName) {
            return "enum name expected";
        }

        const enumType = project.variables.enumsMap.get(enumTypeName);
        if (!enumType) {
            return `enum '${enumTypeName}' not found`;
        }

        if (!enumType.members.find(member => member.value == value)) {
            return `value not in enum '${enumTypeName}'`;
        }

        return null;
    }

    return `not a ${type}`;
}

export function isValidType(project: Project, valueType: ValueType): boolean {
    return project._store.typesStore.allValueTypes.indexOf(valueType) != -1;
}

////////////////////////////////////////////////////////////////////////////////

export const objectVariableTypes = new Map<string, IObjectVariableType>();

export function createObjectVariableType(
    objectVariableType: IObjectVariableType
) {
    const temp = Object.assign({}, objectVariableType);

    temp.valueFieldDescriptions = [
        ...temp.valueFieldDescriptions,
        {
            name: "status",
            valueType: [
                {
                    name: "label",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.label;
                    }
                },
                {
                    name: "image",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.image;
                    }
                },
                {
                    name: "color",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.color;
                    }
                },
                {
                    name: "error",
                    valueType: "string",
                    getFieldValue: (value: any): string => {
                        return value.error;
                    }
                }
            ],
            getFieldValue: (value: IObjectVariableValue) => {
                return value.status;
            }
        }
    ];

    return temp;
}

export function registerObjectVariableType(
    name: string,
    objectVariableType: IObjectVariableType
) {
    objectVariableTypes.set(name, createObjectVariableType(objectVariableType));
}

////////////////////////////////////////////////////////////////////////////////

interface ActionParamsValue {
    index: number;
    indexes: number[];
}

export function makeActionParamsValue(
    flowContext: IFlowContext
): ActionParamsValue {
    let actionParamsValue: ActionParamsValue;

    let indexes = flowContext.dataContext.get(FLOW_ITERATOR_INDEXES_VARIABLE);
    if (indexes) {
        actionParamsValue = {
            index: indexes[0],
            indexes
        };
    } else {
        actionParamsValue = {
            index: 0,
            indexes: [0]
        };
    }

    return actionParamsValue;
}

interface CheckboxActionParamsValue {
    index: number;
    indexes: number[];
    value: boolean;
}

export function makeCheckboxActionParamsValue(
    flowContext: IFlowContext,
    value: boolean
): CheckboxActionParamsValue {
    return { ...makeActionParamsValue(flowContext), value };
}

interface TextInputActionParamsValue {
    index: number;
    indexes: number[];
    value: string;
}

export function makeTextInputActionParamsValue(
    flowContext: IFlowContext,
    value: string
): TextInputActionParamsValue {
    return { ...makeActionParamsValue(flowContext), value };
}

interface DropDownListActionParamsValue {
    index: number;
    indexes: number[];
    selectedIndex: number;
}

export function makeDropDownListActionParamsValue(
    flowContext: IFlowContext,
    selectedIndex: number
): DropDownListActionParamsValue {
    return { ...makeActionParamsValue(flowContext), selectedIndex };
}
