import { action, observable } from "mobx";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import * as output from "project-editor/core/output";
import { findReferencedObject, Project } from "project-editor/project/project";
import { ListNavigationWithProperties } from "project-editor/components/ListNavigation";
import { build } from "project-editor/features/variable/build";
import { metrics } from "project-editor/features/variable/metrics";
import type {
    IDataContext,
    IVariable
} from "project-editor/flow/flow-interfaces";
import { getDocumentStore } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

export type VariableType =
    | "integer"
    | "float"
    | "boolean"
    | "string"
    | "enum"
    | "list"
    | "struct"
    | "date";

export class Variable extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable type: VariableType;
    @observable enumItems: string;
    @observable defaultValue: string;
    @observable defaultValueList: string;
    @observable defaultMinValue: number;
    @observable defaultMaxValue: number;
    @observable usedIn?: string[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                isAssetName: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "integer"
                    },
                    {
                        id: "float"
                    },
                    {
                        id: "boolean"
                    },
                    {
                        id: "string"
                    },
                    {
                        id: "enum"
                    },
                    {
                        id: "list"
                    },
                    {
                        id: "struct"
                    },
                    {
                        id: "date"
                    }
                ]
            },
            {
                name: "enumItems",
                type: PropertyType.JSON,
                hideInPropertyGrid: (object: Variable) => {
                    return object.type != "enum";
                }
            },
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
                    getDocumentStore(object).isDashboardProject
            }
        ],
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Global Variable",
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
        navigationComponent: ListNavigationWithProperties,
        navigationComponentId: "global-variables",
        icon: "dns"
    };
}

registerClass(Variable);

////////////////////////////////////////////////////////////////////////////////

export function findVariable(project: Project, variableName: string) {
    return findReferencedObject(project, "globalVariables", variableName) as
        | Variable
        | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class DataContext implements IDataContext {
    @observable localVariables: Map<string, any> | undefined = undefined;
    @observable runtimeValues: Map<string, any>;

    constructor(
        public project: Project,
        public parentDataContext?: DataContext,
        public defaultValueOverrides?: any,
        localVariables?: Map<string, any>
    ) {
        this.localVariables = localVariables;
        if (!parentDataContext) {
            this.runtimeValues = new Map<string, any>();
        }
    }

    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext {
        return new DataContext(this.project, this, defaultValueOverrides);
    }

    createWithLocalVariables(variables: IVariable[]) {
        const localVariables = new Map<string, any>();

        variables.forEach(variable =>
            localVariables.set(variable.name, undefined)
        );

        return new DataContext(this.project, this, undefined, localVariables);
    }

    getRuntimeValue(variable: Variable | undefined): {
        hasValue: boolean;
        value: any;
    } {
        if (this.parentDataContext) {
            return this.parentDataContext.getRuntimeValue(variable);
        }

        if (variable) {
            return {
                hasValue: this.runtimeValues.has(variable.name),
                value: this.runtimeValues.get(variable.name)
            };
        } else {
            return { hasValue: false, value: undefined };
        }
    }

    setRuntimeValue(variableName: string, value: any) {
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

    @action
    clearRuntimeValues() {
        this.runtimeValues.clear();
    }

    @action
    set(variableName: string, value: any) {
        if (this.localVariables && this.localVariables.has(variableName)) {
            this.localVariables.set(variableName, value);
        } else {
            this.setRuntimeValue(variableName, value);
        }
    }

    isVariableDeclared(variableName: string) {
        const parts = variableName.split(".");
        variableName = parts[0];

        if (this.localVariables && this.localVariables.has(variableName)) {
            return true;
        }

        if (findVariable(this.project, variableName)) {
            return true;
        }

        return false;
    }

    @action
    declare(variableName: string, value: any) {
        const localVariables = this.localVariables;

        if (!localVariables) {
            throw "data context without local variables";
        }

        localVariables.set(variableName, value);
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

    findVariable(variableName: string) {
        let variable = findVariable(this.project, variableName);
        if (variable) {
            const defaultValue = this.findVariableDefaultValue(variableName);
            if (defaultValue != undefined) {
                return { ...variable, defaultValue };
            }
        }
        return variable;
    }

    get(variableName: string): any {
        if (!variableName) {
            return undefined;
        }

        const parts = variableName.split(".");
        variableName = parts[0];

        if (variableName === undefined) {
            return undefined;
        }

        let value: any = undefined;

        if (this.localVariables && this.localVariables.has(variableName)) {
            value = this.localVariables.get(variableName);
        } else {
            const variable = this.findVariable(variableName);
            const { hasValue, value: value_ } = this.getRuntimeValue(variable);

            if (variable) {
                if (hasValue) {
                    value = value_;
                } else {
                    if (variable.defaultValue !== undefined) {
                        if (
                            variable.type == "integer" ||
                            variable.type == "enum"
                        ) {
                            value = parseInt(variable.defaultValue);
                            if (isNaN(value)) {
                                value = variable.defaultValue;
                                if (variable.enumItems.indexOf(value) == -1) {
                                    console.error(
                                        "Invalid integer default value",
                                        variable
                                    );
                                }
                            }
                        } else if (variable.type == "float") {
                            value = parseFloat(variable.defaultValue);
                            if (isNaN(value)) {
                                value = variable.defaultValue;
                                console.error(
                                    "Invalid float default value",
                                    variable
                                );
                            }
                        } else if (variable.type == "boolean") {
                            let defaultValue = variable.defaultValue
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
                        } else if (variable.type == "list") {
                            try {
                                value =
                                    typeof variable.defaultValue === "string"
                                        ? JSON.parse(variable.defaultValue)
                                        : variable.defaultValue;
                            } catch (err) {
                                value = [];
                                console.error(
                                    "Invalid list default value",
                                    variable,
                                    err
                                );
                            }
                        } else {
                            value = variable.defaultValue;
                        }
                    } else {
                        value = undefined;
                    }
                }
            }
        }

        for (let i = 1; i < parts.length; i++) {
            if (value == undefined) {
                return value;
            }

            value = value[parts[i]];
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
            if (variable && variable.type == "enum") {
                value = variable.enumItems.indexOf(value);
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

export default {
    name: "eezstudio-project-feature-variables",
    version: "0.1.0",
    description: "Variables support.",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Global Variables",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "globalVariables",
                type: PropertyType.Array,
                typeClass: Variable,
                icon: "dns",
                create: () => {
                    return [];
                },
                check: (object: IEezObject[]) => {
                    let messages: output.Message[] = [];

                    if (object.length > 32000) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
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
