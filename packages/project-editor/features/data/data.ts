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
import {
    findReferencedObject,
    getProject,
    Project,
    ProjectType
} from "project-editor/project/project";
import { ListNavigationWithProperties } from "project-editor/components/ListNavigation";
import { build } from "project-editor/features/data/build";
import { metrics } from "project-editor/features/data/metrics";
import type { IDataContext } from "project-editor/flow/flow-interfaces";

////////////////////////////////////////////////////////////////////////////////

export class DataItem extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable type:
        | "integer"
        | "float"
        | "boolean"
        | "string"
        | "enum"
        | "list"
        | "struct";
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
                    }
                ]
            },
            {
                name: "enumItems",
                type: PropertyType.JSON,
                hideInPropertyGrid: (object: DataItem) => {
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
                    getProject(object).settings.general.projectType ===
                    ProjectType.DASHBOARD
            }
        ],
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Data Item",
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
        navigationComponentId: "data-items",
        icon: "dns"
    };
}

registerClass(DataItem);

////////////////////////////////////////////////////////////////////////////////

export function findDataItem(project: Project, dataItemName: string) {
    return findReferencedObject(project, "data", dataItemName) as
        | DataItem
        | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class DataContext implements IDataContext {
    @observable localVariables: Map<string, any> | undefined = undefined;
    @observable dataItemValues: Map<string, any>;

    constructor(
        public project: Project,
        public parentDataContext?: DataContext,
        public defaultValueOverrides?: any,
        localVariables?: Map<string, any>
    ) {
        this.localVariables = localVariables;
        if (!parentDataContext) {
            this.dataItemValues = new Map<string, any>();
        }
    }

    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext {
        return new DataContext(this.project, this, defaultValueOverrides);
    }

    createWithLocalVariables() {
        return new DataContext(
            this.project,
            this,
            undefined,
            new Map<string, any>()
        );
    }

    getDataItemValue(
        dataItemId: string
    ): {
        dataItem: DataItem | undefined;
        hasValue: boolean;
        value: any;
    } {
        if (this.parentDataContext) {
            return this.parentDataContext.getDataItemValue(dataItemId);
        }

        const dataItem = findDataItem(this.project, dataItemId);
        if (dataItem) {
            return {
                dataItem,
                hasValue: this.dataItemValues.has(dataItemId),
                value: this.dataItemValues.get(dataItemId)
            };
        } else {
            return { dataItem: undefined, hasValue: false, value: undefined };
        }
    }

    @action
    setDataItemValue(dataItemId: string, value: any) {
        if (this.parentDataContext) {
            this.parentDataContext.setDataItemValue(dataItemId, value);
        } else {
            const dataItem = findDataItem(this.project, dataItemId);
            if (dataItem) {
                this.dataItemValues.set(dataItemId, value);
            } else {
                throw `variable "${dataItemId}" not found`;
            }
        }
    }

    @action
    set(dataItemId: string, value: any) {
        if (this.localVariables && this.localVariables.has(dataItemId)) {
            this.localVariables.set(dataItemId, value);
        } else {
            this.setDataItemValue(dataItemId, value);
        }
    }

    @action
    declare(variableName: string, value: any) {
        const localVariables = this.localVariables;

        if (!localVariables) {
            throw "data context without local variables";
        }

        localVariables.set(variableName, value);
    }

    findDataItemDefaultValue(dataItemId: string): any {
        if (this.defaultValueOverrides) {
            const defaultValue = this.defaultValueOverrides[dataItemId];
            if (defaultValue != undefined) {
                return defaultValue;
            }
        }
        if (this.parentDataContext) {
            return this.parentDataContext.findDataItemDefaultValue(dataItemId);
        }
        return undefined;
    }

    findDataItem(dataItemId: string) {
        let dataItem = findDataItem(this.project, dataItemId);
        if (dataItem) {
            const defaultValue = this.findDataItemDefaultValue(dataItemId);
            if (defaultValue != undefined) {
                return { ...dataItem, defaultValue };
            }
        }
        return dataItem;
    }

    get(dataItemId: string): any {
        if (!dataItemId) {
            return undefined;
        }

        const parts = dataItemId.split(".");
        dataItemId = parts[0];

        if (dataItemId === undefined) {
            return undefined;
        }

        let value: any = undefined;

        if (this.localVariables && this.localVariables.has(dataItemId)) {
            value = this.localVariables.get(dataItemId);
        } else {
            const { dataItem, hasValue, value: value_ } = this.getDataItemValue(
                dataItemId
            );

            if (dataItem) {
                if (hasValue) {
                    value = value_;
                } else {
                    if (dataItem.defaultValue !== undefined) {
                        if (
                            dataItem.type == "integer" ||
                            dataItem.type == "enum"
                        ) {
                            value = parseInt(dataItem.defaultValue);
                            if (isNaN(value)) {
                                value = dataItem.defaultValue;
                                if (dataItem.enumItems.indexOf(value) == -1) {
                                    console.error(
                                        "Invalid integer default value",
                                        dataItem
                                    );
                                }
                            }
                        } else if (dataItem.type == "float") {
                            value = parseFloat(dataItem.defaultValue);
                            if (isNaN(value)) {
                                value = dataItem.defaultValue;
                                console.error(
                                    "Invalid float default value",
                                    dataItem
                                );
                            } else {
                                value = dataItem.defaultValue;
                            }
                        } else if (dataItem.type == "boolean") {
                            let defaultValue = dataItem.defaultValue
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
                                value = false;
                                console.error(
                                    "Invalid boolean default value",
                                    dataItem
                                );
                            }
                        } else if (dataItem.type == "list") {
                            try {
                                value =
                                    typeof dataItem.defaultValue === "string"
                                        ? JSON.parse(dataItem.defaultValue)
                                        : dataItem.defaultValue;
                            } catch (err) {
                                value = [];
                                console.error(
                                    "Invalid list default value",
                                    dataItem,
                                    err
                                );
                            }
                        } else {
                            value = dataItem.defaultValue;
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

    getBool(dataItemId: string): boolean {
        let value = this.get(dataItemId);

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number" && Number.isInteger(value)) {
            return value ? true : false;
        }

        return false;
    }

    getEnumValue(dataItemId: string): number {
        let value = this.get(dataItemId);

        if (typeof value === "boolean") {
            return value ? 1 : 0;
        } else if (typeof value === "number" && Number.isInteger(value)) {
            return value;
        } else if (typeof value === "string") {
            let dataItem = this.findDataItem(dataItemId);
            if (dataItem && dataItem.type == "enum") {
                value = dataItem.enumItems.indexOf(value);
                if (value == -1) {
                    console.error("Invalid enum value", dataItem);
                    return 0;
                } else {
                    return value;
                }
            }
        }

        return 0;
    }

    getMin(dataItemId: string): number {
        let dataItem = this.findDataItem(dataItemId);
        if (dataItem) {
            return dataItem.defaultMinValue;
        }

        return 0;
    }

    getMax(dataItemId: string): number {
        let dataItem = this.findDataItem(dataItemId);
        if (dataItem) {
            return dataItem.defaultMaxValue;
        }

        return 1;
    }

    getValueList(dataItemId: string): string[] {
        let dataItem = this.findDataItem(dataItemId);
        if (dataItem) {
            try {
                return JSON.parse(dataItem.defaultValueList);
            } catch (err) {
                console.error("Invalid value list", dataItem, err);
                return [];
            }
        }

        return [];
    }
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-data",
    version: "0.1.0",
    description: "Project data",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Data",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "data",
                type: PropertyType.Array,
                typeClass: DataItem,
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
                                "Max. 32000 data items are supported",
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
