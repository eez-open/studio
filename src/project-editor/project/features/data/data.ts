import { observable } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-shared/ui/generic-dialog";

import { registerMetaData, EezObject } from "project-editor/core/metaData";
import { ProjectStore, asArray } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import * as output from "project-editor/core/output";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import { build } from "project-editor/project/features/data/build";
import { metrics } from "project-editor/project/features/data/metrics";

////////////////////////////////////////////////////////////////////////////////

export class DataItemProperties extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    type: "integer" | "float" | "boolean" | "string" | "enum" | "list";
    @observable
    enumItems: string;
    @observable
    defaultValue: string;
    @observable
    defaultValueList: string;
    @observable
    defaultMinValue: number;
    @observable
    defaultMaxValue: number;
    @observable
    usedIn: string[] | undefined;
}

export const dataItemMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return DataItemProperties;
    },
    className: "DataItem",
    label: (dataItem: DataItemProperties) => {
        return dataItem.name;
    },
    properties: () => [
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text"
        },
        {
            name: "type",
            type: "enum",
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
            type: "multiline-text"
        },
        {
            name: "defaultValue",
            type: "multiline-text"
        },
        {
            name: "defaultValueList",
            type: "multiline-text"
        },
        {
            name: "defaultMinValue",
            type: "number"
        },
        {
            name: "defaultMaxValue",
            type: "number"
        },
        {
            name: "usedIn",
            type: "configuration-references"
        }
    ],
    newItem: (parent: EezObject) => {
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
    navigationComponent: ListNavigationWithContent,
    navigationComponentId: "data-items",
    icon: "dns"
});

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("data", {
    projectFeature: {
        mandatory: false,
        key: "data",
        type: "array",
        metaData: dataItemMetaData,
        create: () => {
            return [];
        },
        check: (object: EezObject) => {
            let messages: output.Message[] = [];

            if (asArray(object).length >= 65534) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Max. 254 data items are supported",
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

export function findDataItem(dataItemName: string) {
    let dataItems = ProjectStore.projectProperties.data as DataItemProperties[];
    for (let i = 0; i < dataItems.length; i++) {
        let dataItem = dataItems[i];
        if (dataItem.name == dataItemName) {
            return dataItem;
        }
    }
    return undefined;
}

export function findDataItemIndex(dataItemName: string) {
    let dataItems = (ProjectStore.projectProperties as any).data;
    for (let i = 0; i < dataItems.length; i++) {
        if (dataItems[i].name == dataItemName) {
            return i;
        }
    }
    return -1;
}

////////////////////////////////////////////////////////////////////////////////

export function count(dataItemId: string): number {
    let dataItem = findDataItem(dataItemId);
    if (dataItem) {
        if (dataItem.type != "list") {
            console.error("Count for non-list data attempted", dataItem);
            return 0;
        }

        let list: any[];
        try {
            list = JSON.parse(dataItem.defaultValue);
        } catch (err) {
            list = [];
            console.error("Invalid list default value", dataItem, err);
        }

        return list.length;
    }

    console.error(`Data item '${dataItemId}' not found`);

    return 0;
}

export function get(dataItemId: string): any {
    let dataItem = findDataItem(dataItemId);
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
                let defaultValue = dataItem.defaultValue
                    .toString()
                    .trim()
                    .toLowerCase();
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
                    value = JSON.parse(dataItem.defaultValue);
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

    console.error(`Data item '${dataItemId}' not found`);

    return "ERR!";
}

export function getBool(dataItemId: string): boolean {
    let value = get(dataItemId);

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number" && Number.isInteger(value)) {
        return value ? true : false;
    }

    console.error(`Data item '${dataItemId}' is not boolean or integer`);
    return false;
}

export function getEnumValue(dataItemId: string): number {
    let value = get(dataItemId);

    if (typeof value === "boolean") {
        return value ? 1 : 0;
    } else if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    } else if (typeof value === "string") {
        let dataItem = findDataItem(dataItemId);
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

    console.error(`Data item '${dataItemId}' is not boolean or integer or enum`);

    return 0;
}

export function getMin(dataItemId: string): number {
    let dataItem = findDataItem(dataItemId);
    if (dataItem) {
        return dataItem.defaultMinValue;
    }

    console.error(`Data item '${dataItemId}' not found`);

    return 0;
}

export function getMax(dataItemId: string): number {
    let dataItem = findDataItem(dataItemId);
    if (dataItem) {
        return dataItem.defaultMaxValue;
    }

    console.error(`Data item '${dataItemId}' not found`);

    return 1;
}

export function getValueList(dataItemId: string): string[] {
    let dataItem = findDataItem(dataItemId);
    if (dataItem) {
        try {
            return JSON.parse(dataItem.defaultValueList);
        } catch (err) {
            console.error("Invalid value list", dataItem, err);
            return [];
        }
    }

    console.error(`Data item '${dataItemId}' not found`);

    return [];
}
