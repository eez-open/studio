import React from "react";
import {
    computed,
    action,
    observable,
    runInAction,
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    MessageType,
    PropertyProps
} from "project-editor/core/object";
import {
    getChildOfObject,
    Message,
    propertyInvalidValueMessage,
    propertyNotSetMessage,
    createObject
} from "project-editor/store";
import {
    isDashboardProject,
    hasFlowSupport,
    isLVGLProject,
    isAppletProject
} from "project-editor/project/project-type-traits";
import type { Project } from "project-editor/project/project";
import type {
    IDataContext,
    IVariable
} from "project-editor/flow/flow-interfaces";
import { getProjectStore } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { humanize } from "eez-studio-shared/string";
import { evalConstantExpression } from "project-editor/flow//expression";
import { _difference } from "eez-studio-shared/algorithm";
import { Icon } from "eez-studio-ui/icon";
import {
    variableTypeProperty,
    migrateType,
    VariableTypeFieldComponent,
    isObjectType,
    isIntegerVariable,
    isEnumVariable,
    getEnumValues,
    isValueTypeOf,
    ValueType,
    getObjectVariableTypeFromType,
    IObjectVariableValue,
    getObjectType,
    SYSTEM_STRUCTURES,
    isValidType
} from "project-editor/features/variable/value-type";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { parseIdentifier } from "project-editor/flow/expression/helper";

////////////////////////////////////////////////////////////////////////////////

const VariableIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="icon icon-tabler icon-tabler-variable"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M5 4c-2.5 5 -2.5 10 0 16m14 -16c2.5 5 2.5 10 0 16m-10 -11h1c1 0 1 1 2.016 3.527c.984 2.473 .984 3.473 1.984 3.473h1" />
        <path d="M8 16c1.5 0 3 -2 4 -3.5s2.5 -3.5 4 -3.5" />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export const RenderVariableStatus = observer(
    ({
        variable,
        value,
        onClick,
        onClear
    }: {
        variable: IVariable;
        value?: IObjectVariableValue;
        onClick: () => void;
        onClear?: () => void;
    }) => {
        const image = value?.status?.image;
        const color = value?.status?.color;
        const error = value?.status?.error != undefined;
        const title = value?.status?.error;

        let label;
        let hint;
        if (onClear) {
            if (value?.constructorParams != null) {
                label = value.status.label;
            } else {
                hint = `Select ${getObjectType(variable.type)}`;
            }
        } else {
            label = variable.description || humanize(variable.name);
        }

        const element = (
            <div
                className={classNames("EezStudio_CustomVariableStatus", {
                    "form-control": onClear
                })}
                onClick={!onClear ? onClick : undefined}
                title={title}
            >
                {image &&
                    (typeof image == "string" ? (
                        <img
                            src={
                                image.trim().startsWith("<svg")
                                    ? "data:image/svg+xml;charset=utf-8," +
                                      image.trim()
                                    : image
                            }
                            draggable={false}
                        />
                    ) : (
                        image
                    ))}
                {color && (
                    <span
                        className="status"
                        style={{
                            backgroundColor: color
                        }}
                    />
                )}
                <span className="label">{label}</span>
                <span className="hint">{hint}</span>
                {error && (
                    <Icon className="text-danger" icon="material:error" />
                )}
            </div>
        );

        if (!onClear) {
            return element;
        }

        return (
            <div className="input-group mb-3">
                {element}
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={onClick}
                >
                    &hellip;
                </button>
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={onClear}
                    disabled={!value}
                >
                    {"\u2715"}
                </button>
            </div>
        );
    }
);

export const RenderVariableStatusPropertyUI = observer(
    class RenderVariableStatusPropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        objectVariableValue: IObjectVariableValue | undefined;

        constructor(props: PropertyProps) {
            super(props);

            makeObservable(this, {
                objectVariableValue: observable
            });
        }

        async updateObjectVariableValue() {
            const variable = this.props.objects[0] as Variable;

            const value =
                this.context.runtimeSettings.getVariableValue(variable);

            runInAction(() => (this.objectVariableValue = value));
        }

        componentDidMount() {
            this.updateObjectVariableValue();
        }

        componentDidUpdate(prevProps: PropertyProps) {
            if (this.props.objects[0] != prevProps.objects[0]) {
                this.updateObjectVariableValue();
            }
        }

        render() {
            const variable = this.props.objects[0] as Variable;

            const objectVariableType = getObjectVariableTypeFromType(
                variable.type
            );
            if (!objectVariableType) {
                return null;
            }

            const objectVariableValue = this.objectVariableValue;

            return (
                <RenderVariableStatus
                    key={variable.name}
                    variable={variable}
                    value={objectVariableValue}
                    onClick={async () => {
                        const constructorParams =
                            await objectVariableType.editConstructorParams!(
                                variable,
                                objectVariableValue?.constructorParams
                            );
                        if (constructorParams !== undefined) {
                            this.context.runtimeSettings.setVariableValue(
                                variable,
                                constructorParams
                            );
                            this.updateObjectVariableValue();
                        }
                    }}
                    onClear={async () => {
                        this.context.runtimeSettings.setVariableValue(
                            variable,
                            undefined
                        );
                        this.updateObjectVariableValue();
                    }}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

function isGlobalVariable(variable: Variable) {
    return !ProjectEditor.getFlow(variable);
}

////////////////////////////////////////////////////////////////////////////////

export class Variable extends EezObject {
    id: number | undefined;
    name: string;
    description?: string;

    type: ValueType;

    defaultValue: string;
    defaultValueList: string;
    defaultMinValue: number;
    defaultMaxValue: number;

    usedIn?: string[];

    persistent: boolean;

    native: boolean;

    constructor() {
        super();

        makeObservable(this, {
            id: observable,
            name: observable,
            description: observable,
            type: observable,
            defaultValue: observable,
            defaultValueList: observable,
            defaultMinValue: observable,
            defaultMaxValue: observable,
            usedIn: observable,
            persistent: observable,
            native: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "id",
                type: PropertyType.Number,
                isOptional: true,
                unique: true,
                propertyGridGroup: generalGroup,
                hideInPropertyGrid: (variable: Variable) =>
                    !isGlobalVariable(variable) || isLVGLProject(variable)
            },
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            variableTypeProperty,
            {
                name: "native",
                type: PropertyType.Boolean,
                hideInPropertyGrid: (variable: Variable) =>
                    !isGlobalVariable(variable) ||
                    isDashboardProject(variable) ||
                    !hasFlowSupport(variable)
            },
            {
                name: "defaultValue",
                type: PropertyType.MultilineText,
                monospaceFont: true,
                disableSpellcheck: true,
                hideInPropertyGrid: object => {
                    const project = ProjectEditor.getProject(object);
                    return (
                        project.projectTypeTraits.isLVGL &&
                        !project.projectTypeTraits.hasFlowSupport
                    );
                }
            },
            {
                name: "defaultValueList",
                type: PropertyType.MultilineText,
                hideInPropertyGrid: object =>
                    isDashboardProject(object) ||
                    isLVGLProject(object) ||
                    isAppletProject(object),
                monospaceFont: true,
                disableSpellcheck: true
            },
            {
                name: "defaultMinValue",
                type: PropertyType.Number,
                hideInPropertyGrid: object =>
                    isDashboardProject(object) ||
                    isLVGLProject(object) ||
                    isAppletProject(object)
            },
            {
                name: "defaultMaxValue",
                type: PropertyType.Number,
                hideInPropertyGrid: object =>
                    isDashboardProject(object) ||
                    isLVGLProject(object) ||
                    isAppletProject(object)
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: object =>
                    isDashboardProject(object) || isLVGLProject(object)
            },
            {
                name: "persistent",
                type: PropertyType.Boolean,
                hideInPropertyGrid: (variable: Variable) =>
                    isLVGLProject(variable) ||
                    !isGlobalVariable(variable) ||
                    variable.native ||
                    (isObjectType(variable.type) &&
                        !getObjectVariableTypeFromType(variable.type)
                            ?.editConstructorParams)
            },
            {
                name: "persistedValue",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: RenderVariableStatusPropertyUI,
                hideInPropertyGrid: (variable: Variable) =>
                    isLVGLProject(variable) ||
                    !variable.persistent ||
                    !isObjectType(variable.type) ||
                    !isGlobalVariable(variable) ||
                    !getObjectVariableTypeFromType(variable.type)
                        ?.editConstructorParams
            }
        ],
        listLabel: (variable: Variable) => {
            return (
                <>
                    {variable.native && <span>[NATIVE] </span>}
                    {variable.persistent && <span>[PERSISTENT] </span>}
                    <span>{variable.name} </span>
                    <em style={{ opacity: 0.5 }}>{variable.type}</em>
                </>
            );
        },
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        newItem: async (parent: IEezObject) => {
            const project = ProjectEditor.getProject(parent);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: ProjectEditor.getFlow(parent)
                        ? "New Local Variable"
                        : "New Global Variable",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                identifierValidator,
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        },
                        {
                            name: "defaultValue",
                            type: "string",
                            validators: [validators.required],
                            visible: () =>
                                !project.projectTypeTraits.isLVGL ||
                                project.projectTypeTraits.hasFlowSupport
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            let persistent =
                !ProjectEditor.getFlow(parent) &&
                isObjectType(result.values.type);

            const variableProperties: Partial<Variable> = {
                name: result.values.name,
                type: result.values.type,
                defaultValue: result.values.defaultValue,
                persistent
            };

            const variable = createObject<Variable>(
                project._store,
                variableProperties,
                Variable
            );

            return variable;
        },
        check: (variable: Variable) => {
            let messages: Message[] = [];

            const projectStore = getProjectStore(variable);

            if (isGlobalVariable(variable)) {
                ProjectEditor.checkAssetId(
                    projectStore,
                    "variables/globalVariables",
                    variable,
                    messages
                );
            }

            if (!variable.type) {
                messages.push(propertyNotSetMessage(variable, "type"));
            }

            // if (
            //     projectStore.projectTypeTraits.hasFlowSupport &&
            //     (variable.type === "any" || variable.type === "array:any")
            // ) {
            //     messages.push(
            //         new Message(MessageType.WARNING, `Any type used`, variable)
            //     );
            // }

            if (!isValidType(projectStore.project, variable.type)) {
                messages.push(
                    new Message(MessageType.ERROR, `Invalid type`, variable)
                );
            }

            if (!variable.defaultValue) {
                messages.push(propertyNotSetMessage(variable, "defaultValue"));
            } else {
                if (projectStore.projectTypeTraits.hasFlowSupport) {
                    try {
                        const { value } = evalConstantExpression(
                            projectStore.project,
                            variable.defaultValue
                        );

                        const error = isValueTypeOf(
                            projectStore.project,
                            value,
                            variable.type
                        );
                        if (error) {
                            messages.push(
                                new Message(
                                    MessageType.ERROR,
                                    error,
                                    getChildOfObject(variable, "defaultValue")
                                )
                            );
                        }
                    } catch (err) {
                        messages.push(
                            propertyInvalidValueMessage(
                                variable,
                                "defaultValue"
                            )
                        );
                    }
                }
            }

            return messages;
        }
    };
}

registerClass("Variable", Variable);

////////////////////////////////////////////////////////////////////////////////

export class DataContext implements IDataContext {
    project: Project;
    parentDataContext: DataContext | undefined;
    defaultValueOverrides: any;
    localVariables: Map<string, IVariable> | undefined = undefined;
    runtimeValues: Map<string, any>;

    constructor(
        project: Project,
        parentDataContext?: DataContext,
        defaultValueOverrides?: any,
        localVariables?: Map<string, IVariable>
    ) {
        makeObservable(this, {
            runtimeValues: observable,
            clear: action
        });

        this.project = project;
        this.parentDataContext = parentDataContext;
        this.defaultValueOverrides = defaultValueOverrides;

        this.runtimeValues = new Map<string, any>();

        this.localVariables = localVariables;
        if (this.localVariables) {
            this.localVariables.forEach(variable => {
                try {
                    const { value } = evalConstantExpression(
                        project,
                        variable.defaultValue
                    );
                    this.runtimeValues.set(variable.name, value);
                } catch (err) {
                    if (project._store.runtime) {
                        throw err;
                    }
                    this.runtimeValues.set(variable.name, undefined);
                }
            });
        }

        if (!this.parentDataContext) {
            this.initGlobalVariables();
        }
    }

    initGlobalVariables() {
        if (this.project.variables) {
            this.project.allGlobalVariables.forEach(variable => {
                try {
                    const { value } = evalConstantExpression(
                        this.project,
                        variable.defaultValue
                    );
                    this.runtimeValues.set(variable.name, value);
                } catch (err) {
                    if (this.project._store.runtime) {
                        throw err;
                    }
                    if (!this.project.projectTypeTraits.hasFlowSupport) {
                        const value = this.project._assetsMap[
                            "name"
                        ].allAssets.get(variable.defaultValue);
                        if (value) {
                            this.runtimeValues.set(variable.name, value);
                        } else {
                            this.runtimeValues.set(
                                variable.name,
                                variable.defaultValue
                            );
                        }
                    } else {
                        this.runtimeValues.set(variable.name, null);
                    }
                }
            });
        }
    }

    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext {
        return new DataContext(this.project, this, defaultValueOverrides);
    }

    createWithLocalVariables(variablesArray: IVariable[]) {
        const localVariables = new Map<string, any>();
        variablesArray.forEach(variable => {
            localVariables.set(variable.name, variable);
        });
        return new DataContext(this.project, this, undefined, localVariables);
    }

    getRuntimeValue(variable: IVariable | undefined): {
        hasValue: boolean;
        value: any;
    } {
        if (variable) {
            if (this.defaultValueOverrides) {
                const value = this.defaultValueOverrides[variable.name];
                if (value != undefined) {
                    return {
                        hasValue: true,
                        value
                    };
                }
            }

            if (this.runtimeValues.has(variable.name)) {
                return {
                    hasValue: this.runtimeValues.has(variable.name),
                    value: this.runtimeValues.get(variable.name)
                };
            }

            if (this.parentDataContext) {
                return this.parentDataContext.getRuntimeValue(variable);
            }
        }

        return { hasValue: false, value: undefined };
    }

    setRuntimeValue(variableName: string, value: any) {
        if (this.localVariables && this.localVariables.has(variableName)) {
            this.runtimeValues.set(variableName, value);
        } else {
            if (this.parentDataContext) {
                this.parentDataContext.setRuntimeValue(variableName, value);
            } else {
                const variable = findVariable(this.project, variableName);
                if (variable) {
                    this.runtimeValues.set(variableName, value);
                } else {
                    throw `variable "${variableName}" not found`;
                }
            }
        }
    }

    clear() {
        this.runtimeValues.clear();
        this.initGlobalVariables();
    }

    set(variableName: string, value: any) {
        const oldValue = this.get(variableName);
        if (oldValue) {
            const variable = this.findVariable(variableName);
            if (variable) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType) {
                    objectVariableType.destroyValue(oldValue);
                }
            }
        }

        runInAction(() => this.setRuntimeValue(variableName, value));
    }

    findVariableDefaultValue(variableName: string): any {
        if (this.defaultValueOverrides) {
            const defaultValue = this.defaultValueOverrides[variableName];
            if (defaultValue != undefined) {
                return defaultValue;
            }
        }
        if (this.parentDataContext) {
            return this.parentDataContext.findVariableDefaultValue(
                variableName
            );
        }
        return undefined;
    }

    findVariable(variableName: string): IVariable | undefined {
        let variable: IVariable | undefined;

        // find local variable
        if (this.localVariables && this.localVariables.has(variableName)) {
            variable = this.localVariables.get(variableName);
        }

        if (!variable) {
            if (this.parentDataContext) {
                return this.parentDataContext.findVariable(variableName);
            }
        }

        if (!variable) {
            // find global variable
            variable = findVariable(this.project, variableName);
        }

        if (variableName === FLOW_ITERATOR_INDEX_VARIABLE) {
            return {
                name: FLOW_ITERATOR_INDEX_VARIABLE,
                type: "integer",
                defaultValue: 0,
                defaultMinValue: undefined,
                defaultMaxValue: undefined,
                defaultValueList: undefined,
                persistent: false
            };
        } else if (variableName === FLOW_ITERATOR_INDEXES_VARIABLE) {
            return {
                name: FLOW_ITERATOR_INDEXES_VARIABLE,
                type: "array:integer",
                defaultValue: null,
                defaultMinValue: undefined,
                defaultMaxValue: undefined,
                defaultValueList: undefined,
                persistent: false
            };
        }

        return variable;
    }

    has(variableName: string) {
        return !!this.findVariable(variableName);
    }

    get(variableName: string): any {
        if (!variableName) {
            return undefined;
        }

        if (variableName === undefined) {
            return undefined;
        }

        let value: any = undefined;

        const variable = this.findVariable(variableName);
        const { hasValue, value: value_ } = this.getRuntimeValue(variable);

        if (variable) {
            if (hasValue) {
                value = value_;
            } else {
                let defaultValue = this.findVariableDefaultValue(variableName);
                if (defaultValue == undefined) {
                    defaultValue = variable.defaultValue;
                }

                if (defaultValue !== undefined) {
                    if (isIntegerVariable(variable)) {
                        value = parseInt(defaultValue);
                        if (isNaN(value)) {
                            console.error(
                                "Invalid integer default value",
                                variable
                            );
                        }
                    } else if (isEnumVariable(variable)) {
                        // TODO this is invalid check
                        value = defaultValue;
                        if (getEnumValues(variable).indexOf(value) == -1) {
                            console.error(
                                "Invalid enum default value",
                                variable
                            );
                        }
                    } else if (variable.type == "float") {
                        value = parseFloat(defaultValue);
                        if (isNaN(value)) {
                            value = defaultValue;
                            console.error(
                                "Invalid float default value",
                                variable
                            );
                        }
                    } else if (variable.type == "boolean") {
                        defaultValue = defaultValue
                            .toString()
                            .trim()
                            .toLowerCase();
                        if (defaultValue == "1" || defaultValue == "true") {
                            value = true;
                        } else if (
                            defaultValue == "0" ||
                            defaultValue == "false"
                        ) {
                            value = false;
                        } else {
                            value = undefined;
                        }
                    } else if (variable.type == "array") {
                        try {
                            value =
                                typeof defaultValue === "string"
                                    ? JSON.parse(defaultValue)
                                    : defaultValue;
                        } catch (err) {
                            value = [];
                            console.error(
                                "Invalid array default value",
                                variable,
                                err
                            );
                        }
                    } else {
                        value = defaultValue;
                    }
                } else {
                    value = undefined;
                }
            }
        }

        return value;
    }

    getBool(variableName: string): boolean {
        let value = this.get(variableName);

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number" && Number.isInteger(value)) {
            return value ? true : false;
        }

        return false;
    }

    getEnumValue(variableName: string): number {
        let value = this.get(variableName);

        if (typeof value === "boolean") {
            return value ? 1 : 0;
        } else if (typeof value === "number" && Number.isInteger(value)) {
            return value;
        } else if (typeof value === "string") {
            let variable = this.findVariable(variableName);
            if (variable && isEnumVariable(variable)) {
                // TODO this is invalid check
                value = getEnumValues(variable).indexOf(value);
                if (value == -1) {
                    console.error("Invalid enum value", variable);
                    return 0;
                } else {
                    return value;
                }
            }
        }

        return 0;
    }

    getMin(variableName: string): number {
        let variable = this.findVariable(variableName);
        if (variable) {
            return variable.defaultMinValue;
        }

        return 0;
    }

    getMax(variableName: string): number {
        let variable = this.findVariable(variableName);
        if (variable) {
            return variable.defaultMaxValue;
        }

        return 1;
    }

    getValueList(variableName: string): string[] {
        let variable = this.findVariable(variableName);
        if (variable) {
            try {
                return JSON.parse(variable.defaultValueList);
            } catch (err) {
                console.error("Invalid value list", variable, err);
                return [];
            }
        }

        return [];
    }

    get debugInfo(): any {
        const runtimeValues: any = {};
        for (const [name, value] of this.runtimeValues) {
            try {
                const valueJS = toJS(value);
                JSON.stringify(valueJS);
                runtimeValues[name] = valueJS;
            } catch (err) {}
        }

        return {
            runtimeValues
        };
    }

    set debugInfo(debugInfo: any) {
        runInAction(() => {
            for (const name in debugInfo.runtimeValues) {
                this.runtimeValues.set(name, debugInfo.runtimeValues[name]);
            }
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IStructureField {
    name: string;
    type: ValueType;
}

export class StructureField extends EezObject implements IStructureField {
    name: string;
    type: ValueType;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            variableTypeProperty
        ],
        check: (structureField: StructureField) => {
            let messages: Message[] = [];

            if (!structureField.name) {
                messages.push(propertyNotSetMessage(structureField, "name"));
            }

            if (!structureField.type) {
                messages.push(propertyNotSetMessage(structureField, "type"));
            }

            // if (
            //     structureField.type === "any" ||
            //     structureField.type === "array:any"
            // ) {
            //     messages.push(
            //         new Message(
            //             MessageType.WARNING,
            //             `Any type used`,
            //             getChildOfObject(structureField, "type")
            //         )
            //     );
            // }

            const projectStore = getProjectStore(structureField);
            if (!isValidType(projectStore.project, structureField.type)) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid type`,
                        structureField
                    )
                );
            }

            return messages;
        },
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        defaultValue: {},
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Structure Field",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                identifierValidator,
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            });

            const structureFieldProperties: Partial<StructureField> = {
                name: result.values.name,
                type: result.values.type
            };

            const project = ProjectEditor.getProject(parent);

            const structureField = createObject<StructureField>(
                project._store,
                structureFieldProperties,
                StructureField
            );

            return structureField;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            type: observable
        });
    }
}

registerClass("StructureField", StructureField);

////////////////////////////////////////////////////////////////////////////////

export interface IStructure {
    name: string;
    fields: IStructureField[];
    fieldsMap: Map<string, IStructureField>;
}

export class Structure extends EezObject implements IStructure {
    name: string;
    fields: StructureField[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "fields",
                type: PropertyType.Array,
                typeClass: StructureField
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Structure",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                identifierValidator,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const structureProperties: Partial<Structure> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const structure = createObject<Structure>(
                project._store,
                structureProperties,
                Structure
            );

            return structure;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            fields: observable,
            fieldsMap: computed({ keepAlive: true })
        });
    }

    get fieldsMap() {
        const fieldsMap = new Map<string, IStructureField>();
        this.fields.forEach(field => fieldsMap.set(field.name, field));
        return fieldsMap;
    }
}

registerClass("Structure", Structure);

////////////////////////////////////////////////////////////////////////////////

export class EnumMember extends EezObject {
    name: string;
    value: number;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "value",
                type: PropertyType.Number
            }
        ],
        check: (enumMember: EnumMember) => {
            let messages: Message[] = [];

            if (!enumMember.name) {
                messages.push(propertyNotSetMessage(enumMember, "name"));
            }

            if (enumMember.value == undefined) {
                messages.push(propertyNotSetMessage(enumMember, "value"));
            }

            return messages;
        },
        defaultValue: {},
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Enum Member",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                identifierValidator,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const enumMemberProperties: Partial<EnumMember> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const enumMember = createObject<EnumMember>(
                project._store,
                enumMemberProperties,
                EnumMember
            );

            return enumMember;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            value: observable
        });
    }
}

registerClass("EnumMember", EnumMember);

////////////////////////////////////////////////////////////////////////////////

export class Enum extends EezObject {
    name: string;
    members: EnumMember[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "members",
                type: PropertyType.Array,
                typeClass: EnumMember
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Enum",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                identifierValidator,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const enumProperties: Partial<Enum> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const enumObject = createObject<Enum>(
                project._store,
                enumProperties,
                Enum
            );

            return enumObject;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            members: observable,
            membersMap: computed
        });
    }

    get membersMap() {
        const map = new Map<string, EnumMember>();
        for (const member of this.members) {
            map.set(member.name, member);
        }
        return map;
    }
}

registerClass("Enum", Enum);

export class ProjectVariables extends EezObject {
    globalVariables: Variable[];
    structures: Structure[];
    enums: Enum[];

    static classInfo: ClassInfo = {
        label: () => "Variables",
        properties: [
            {
                name: "globalVariables",
                type: PropertyType.Array,
                typeClass: Variable,
                hideInPropertyGrid: true
            },
            {
                name: "structures",
                type: PropertyType.Array,
                typeClass: Structure,
                hideInPropertyGrid: true
            },
            {
                name: "enums",
                type: PropertyType.Array,
                typeClass: Enum,
                hideInPropertyGrid: true
            }
        ],
        icon: VariableIcon,
        defaultValue: {
            globalVariables: [],
            structures: [],
            enums: []
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            globalVariables: observable,
            structures: observable,
            enums: observable,
            enumsMap: computed({ keepAlive: true }),
            structsMap: computed({ keepAlive: true })
        });
    }

    get enumsMap() {
        const map = new Map<string, Enum>();
        for (const enumDef of this.enums) {
            map.set(enumDef.name, enumDef);
        }
        return map;
    }

    get structsMap() {
        const map = new Map<string, IStructure>();
        for (const structure of this.structures) {
            map.set(structure.name, structure);
        }
        for (const structure of SYSTEM_STRUCTURES) {
            map.set(structure.name, structure);
        }
        return map;
    }
}

registerClass("ProjectVariables", ProjectVariables);

////////////////////////////////////////////////////////////////////////////////

export function findVariable(project: Project, variableName: string) {
    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "variables/globalVariables",
        variableName
    ) as Variable | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-variables",
    version: "0.1.0",
    description: "Variables, Structures and Enums",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "Variables",
    mandatory: true,
    key: "variables",
    type: PropertyType.Object,
    typeClass: ProjectVariables,
    icon: VariableIcon,
    create: () => {
        return {
            globalVariables: [],
            structures: [],
            enums: []
        };
    },
    check: (object: EezObject[]) => {
        let messages: Message[] = [];

        if (object.length > 32000) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    "Max. 32000 global variables are supported",
                    object
                )
            );
        }

        return messages;
    }
};

////////////////////////////////////////////////////////////////////////////////

const VALIDATION_MESSAGE_INVALID_IDENTIFIER =
    "Not a valid identifier. Identifier starts with a letter or an underscore (_), followed by zero or more letters, digits, or underscores. Spaces are not allowed.";

const identifierValidator = (object: any, ruleName: string) => {
    const value = object[ruleName];
    if (!parseIdentifier(value) || value.startsWith("$")) {
        return VALIDATION_MESSAGE_INVALID_IDENTIFIER;
    }
    return null;
};
