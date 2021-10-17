import React from "react";
import { computed, action, observable } from "mobx";
import { observer } from "mobx-react";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    NavigationComponent,
    MessageType
} from "project-editor/core/object";
import {
    getChildOfObject,
    Message,
    propertyInvalidValueMessage,
    propertyNotSetMessage
} from "project-editor/core/store";
import type { Project } from "project-editor/project/project";
import {
    ListNavigation,
    ListNavigationWithProperties
} from "project-editor/components/ListNavigation";
import { build } from "project-editor/features/variable/build";
import { metrics } from "project-editor/features/variable/metrics";
import type {
    IDataContext,
    IVariable
} from "project-editor/flow/flow-interfaces";
import { getDocumentStore } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import { Splitter } from "eez-studio-ui/splitter";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";
import { MenuNavigation } from "project-editor/components/MenuNavigation";
import { humanize } from "eez-studio-shared/string";
import { evalConstantExpression } from "project-editor/flow/expression/expression";
import { _difference } from "eez-studio-shared/algorithm";
import { Icon } from "eez-studio-ui/icon";
import {
    variableTypeProperty,
    variableTypeUIProperty,
    migrateType,
    VariableTypeFieldComponent,
    isObjectType,
    isIntegerVariable,
    isEnumVariable,
    getEnumValues,
    isValueTypeOf,
    ValueType
} from "project-editor/features/variable/value-type";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import { ProjectEditor } from "project-editor/project-editor-interface";

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

export class Variable extends EezObject {
    @observable name: string;
    @observable description?: string;

    @observable type: ValueType;

    @observable defaultValue: string;
    @observable defaultValueList: string;
    @observable defaultMinValue: number;
    @observable defaultMaxValue: number;

    @observable usedIn?: string[];

    @observable persistent: boolean;

    static classInfo: ClassInfo = {
        properties: [
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
            variableTypeUIProperty,
            {
                name: "defaultValue",
                type: PropertyType.MultilineText
            },
            {
                name: "defaultValueList",
                type: PropertyType.MultilineText
            },
            {
                name: "defaultMinValue",
                type: PropertyType.Number
            },
            {
                name: "defaultMaxValue",
                type: PropertyType.Number
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: (object: IEezObject) =>
                    getDocumentStore(object).project.isDashboardProject
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: (object: IEezObject) =>
                    getDocumentStore(object).project.isDashboardProject
            },
            {
                name: "persistent",
                type: PropertyType.Boolean,
                hideInPropertyGrid: (variable: Variable) =>
                    !isObjectType(variable.type)
            }
        ],
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
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
                            validators: [validators.required]
                        }
                    ]
                },
                values: {},
                dialogContext: ProjectEditor.getProject(parent)
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    type: result.values.type,
                    defaultValue: result.values.defaultValue
                });
            });
        },
        navigationComponent: ListNavigationWithProperties,
        navigationComponentId: "global-variables",
        icon: VariableIcon,
        check: (variable: Variable) => {
            let messages: Message[] = [];

            if (!variable.type) {
                messages.push(
                    propertyNotSetMessage(variable, "variableTypeUI")
                );
            }

            if (!variable.defaultValue) {
                messages.push(propertyNotSetMessage(variable, "defaultValue"));
            } else {
                const DocumentStore = getDocumentStore(variable);
                if (
                    DocumentStore.project.isAppletProject ||
                    DocumentStore.project.isDashboardProject
                ) {
                    try {
                        const value = evalConstantExpression(
                            DocumentStore.project,
                            variable.defaultValue
                        );

                        const error = isValueTypeOf(
                            DocumentStore.project,
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
    @observable runtimeValues: Map<string, any>;

    constructor(
        project: Project,
        parentDataContext?: DataContext,
        defaultValueOverrides?: any,
        localVariables?: Map<string, IVariable>
    ) {
        this.project = project;
        this.parentDataContext = parentDataContext;
        this.defaultValueOverrides = defaultValueOverrides;

        this.runtimeValues = new Map<string, any>();

        this.localVariables = localVariables;
        if (this.localVariables) {
            this.localVariables.forEach(variable => {
                try {
                    const value = evalConstantExpression(
                        project,
                        variable.defaultValue
                    );
                    this.runtimeValues.set(variable.name, value);
                } catch (err) {
                    if (project._DocumentStore.runtime) {
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
            this.project.variables.globalVariables.forEach(variable => {
                try {
                    const value = evalConstantExpression(
                        this.project,
                        variable.defaultValue
                    );
                    this.runtimeValues.set(variable.name, value);
                } catch (err) {
                    if (this.project._DocumentStore.runtime) {
                        throw err;
                    }
                    if (
                        !this.project.isAppletProject &&
                        !this.project.isDashboardProject
                    ) {
                        const value = this.project.allAssets.get(
                            variable.defaultValue
                        );
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

    @action
    clear() {
        this.runtimeValues.clear();
        this.initGlobalVariables();
    }

    @action
    set(variableName: string, value: any) {
        this.setRuntimeValue(variableName, value);
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
}

////////////////////////////////////////////////////////////////////////////////

export class StructureField extends EezObject {
    @observable name: string;
    @observable type: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            variableTypeProperty,
            variableTypeUIProperty
        ],
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        defaultValue: {},
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Structure Field",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
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
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    type: result.values.type
                });
            });
        }
    };
}

registerClass("StructureField", StructureField);

////////////////////////////////////////////////////////////////////////////////

@observer
export class StructureNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    render() {
        let structures = this.context.project.variables.structures;

        let selectedStructure =
            this.context.navigationStore.getNavigationSelectedObject(
                structures
            ) as Structure;

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={structures}
                />
                <PropertiesPanel object={selectedStructure} />
            </Splitter>
        );
    }
}

export class Structure extends EezObject {
    @observable name: string;
    @observable fields: StructureField[];

    static classInfo: ClassInfo = {
        label: (structure: Structure) => {
            return `${structure.name} (${structure.fields
                .map(field => field.name)
                .join(" | ")})`;
        },
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
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Structure",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: StructureNavigation,
        navigationComponentId: "project-variables-structures",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon icon-tabler icon-tabler-columns"
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
                <line x1="4" y1="6" x2="9.5" y2="6" />
                <line x1="4" y1="10" x2="9.5" y2="10" />
                <line x1="4" y1="14" x2="9.5" y2="14" />
                <line x1="4" y1="18" x2="9.5" y2="18" />
                <line x1="14.5" y1="6" x2="20" y2="6" />
                <line x1="14.5" y1="10" x2="20" y2="10" />
                <line x1="14.5" y1="14" x2="20" y2="14" />
                <line x1="14.5" y1="18" x2="20" y2="18" />
            </svg>
        )
    };

    @computed({ keepAlive: false })
    get fieldsMap() {
        const fieldsMap = new Map<string, StructureField>();
        this.fields.forEach(field => fieldsMap.set(field.name, field));
        return fieldsMap;
    }
}

registerClass("Structure", Structure);

////////////////////////////////////////////////////////////////////////////////

export class EnumMember extends EezObject {
    @observable name: string;
    @observable value: number;

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
        defaultValue: {},
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Enum Member",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        }
    };
}

registerClass("EnumMember", EnumMember);

////////////////////////////////////////////////////////////////////////////////

@observer
export class EnumNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    render() {
        let enums = this.context.project.variables.enums;

        let selectedEnum =
            this.context.navigationStore.getNavigationSelectedObject(
                enums
            ) as Enum;

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation id={this.props.id} navigationObject={enums} />
                <PropertiesPanel object={selectedEnum} />
            </Splitter>
        );
    }
}

export class Enum extends EezObject {
    @observable name: string;
    @observable members: EnumMember[];

    static classInfo: ClassInfo = {
        label: (enumDef: Enum) => {
            return `${enumDef.name} (${enumDef.members
                .map(member => member.name)
                .join(" | ")})`;
        },
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
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Enum",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: EnumNavigation,
        navigationComponentId: "project-variables-enums",
        icon: "format_list_numbered"
    };

    @computed get membersMap() {
        const map = new Map<string, EnumMember>();
        for (const member of this.members) {
            map.set(member.name, member);
        }
        return map;
    }
}

registerClass("Enum", Enum);

////////////////////////////////////////////////////////////////////////////////

@observer
export class ProjectVariablesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={this.context.project.variables}
            />
        );
    }
}

export class ProjectVariables extends EezObject {
    @observable globalVariables: Variable[];
    @observable structures: Structure[];
    @observable enums: Enum[];

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
        navigationComponent: ProjectVariablesNavigation,
        navigationComponentId: "projectVariables",
        defaultNavigationKey: "globalVariables",
        icon: VariableIcon,
        defaultValue: {
            globalVariables: [],
            structures: [],
            enums: []
        }
    };

    @computed({ keepAlive: false }) get enumsMap() {
        const map = new Map<string, Enum>();
        for (const enumDef of this.enums) {
            map.set(enumDef.name, enumDef);
        }
        return map;
    }

    @computed({ keepAlive: false }) get structsMap() {
        const map = new Map<string, Structure>();
        for (const structure of this.structures) {
            map.set(structure.name, structure);
        }
        return map;
    }
}

registerClass("ProjectVariables", ProjectVariables);

////////////////////////////////////////////////////////////////////////////////

export const RenderVariableStatus = observer(
    ({
        variable,
        image,
        color,
        error,
        title,
        onClick
    }: {
        variable: IVariable;
        image?: React.ReactNode;
        color: string;
        error?: boolean;
        title?: string;
        onClick: () => void;
    }) => {
        return (
            <div
                className="EezStudio_CustomVariableStatus"
                onClick={onClick}
                title={title}
            >
                {image &&
                    (typeof image == "string" ? (
                        <img src={image} draggable={false} />
                    ) : (
                        image
                    ))}
                <span className="label">
                    {variable.description || humanize(variable.name)}
                </span>
                <span
                    className="status"
                    style={{
                        backgroundColor: color
                    }}
                />
                {error && (
                    <Icon className="text-danger" icon="material:error" />
                )}
            </div>
        );
    }
);

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
    eezStudioExtension: {
        displayName: "Variables",
        implementation: {
            projectFeature: {
                mandatory: false,
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
                check: (object: IEezObject[]) => {
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
                },
                build: build,
                metrics: metrics
            }
        }
    }
};
