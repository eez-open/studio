import { observable } from "mobx";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType
} from "project-editor/core/object";
import { ProjectStore } from "project-editor/core/store";
import * as output from "project-editor/core/output";
import { findReferencedObject, Project } from "project-editor/project/project";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import { ListNavigationWithProperties } from "project-editor/components/ListNavigation";
import { build } from "project-editor/features/data/build";
import { metrics } from "project-editor/features/data/metrics";

////////////////////////////////////////////////////////////////////////////////

export interface IDataItem {
    name: string;
    description?: string;
    type: "integer" | "float" | "boolean" | "string" | "enum" | "list";
    enumItems: string;
    defaultValue: string;
    defaultValueList: string;
    defaultMinValue: number;
    defaultMaxValue: number;
    usedIn?: string[];
}

export class DataItem extends EezObject implements IDataItem {
    @observable name: string;
    @observable description?: string;
    @observable type: "integer" | "float" | "boolean" | "string" | "enum" | "list";
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
                referencedObjectCollectionPath: "settings/build/configurations"
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
                            validators: [validators.required, validators.unique({}, parent)]
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

registerFeatureImplementation("data", {
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
});

////////////////////////////////////////////////////////////////////////////////

export function findDataItem(dataItemName: string, project?: Project) {
    return findReferencedObject(project ?? ProjectStore.project, "data", dataItemName) as
        | DataItem
        | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class DataContext {
    constructor(public parentDataContext?: DataContext, public defaultValueOverrides?: any) {}

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
        let dataItem = findDataItem(dataItemId);
        if (dataItem) {
            const defaultValue = this.findDataItemDefaultValue(dataItemId);
            if (defaultValue != undefined) {
                return { ...dataItem, defaultValue };
            }
        }
        return dataItem;
    }

    get(dataItemId: string): any {
        if (dataItemId === undefined) {
            return undefined;
        }

        let dataItem = this.findDataItem(dataItemId);
        if (dataItem) {
            let value: any;

            if (dataItem.defaultValue !== undefined) {
                if (dataItem.type == "integer" || dataItem.type == "enum") {
                    value = parseInt(dataItem.defaultValue);
                    if (isNaN(value)) {
                        value = dataItem.defaultValue;
                        if (dataItem.enumItems.indexOf(value) == -1) {
                            console.error("Invalid integer default value", dataItem);
                        }
                    }
                } else if (dataItem.type == "float") {
                    value = parseFloat(dataItem.defaultValue);
                    if (isNaN(value)) {
                        value = dataItem.defaultValue;
                        console.error("Invalid float default value", dataItem);
                    } else {
                        value = dataItem.defaultValue;
                    }
                } else if (dataItem.type == "boolean") {
                    let defaultValue = dataItem.defaultValue.toString().trim().toLowerCase();
                    if (defaultValue == "1" || defaultValue == "true") {
                        value = true;
                    } else if (defaultValue == "0" || defaultValue == "false") {
                        value = false;
                    } else {
                        value = false;
                        console.error("Invalid boolean default value", dataItem);
                    }
                } else if (dataItem.type == "list") {
                    try {
                        value =
                            typeof dataItem.defaultValue === "string"
                                ? JSON.parse(dataItem.defaultValue)
                                : dataItem.defaultValue;
                    } catch (err) {
                        value = [];
                        console.error("Invalid list default value", dataItem, err);
                    }
                } else {
                    value = dataItem.defaultValue;
                }
            } else {
                console.error("Undefined default value", dataItem);
            }

            return value;
        }

        return "ERR!";
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

    executeAction(action: string) {}
}

export const dataContext = new DataContext();
