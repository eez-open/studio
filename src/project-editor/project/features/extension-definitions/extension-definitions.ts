import { observable } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-shared/ui/generic-dialog";

import { ProjectStore, getProperty } from "project-editor/core/store";
import { registerMetaData, EezObject } from "project-editor/core/metaData";
import * as output from "project-editor/core/output";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { ExtensionDefinitionsNavigation } from "project-editor/project/features/extension-definitions/navigation";
import { metrics } from "project-editor/project/features/extension-definitions/metrics";

////////////////////////////////////////////////////////////////////////////////

export class ExtensionDefinitionProperties extends EezObject {
    @observable name: string;
    @observable description: string;
    @observable doNotBuild: boolean;
    @observable buildConfiguration: string;
    @observable buildFolder: string;
    @observable image: string;
    @observable extensionName: string;
    @observable idn: string;

    @observable properties: string;

    @observable idfName: string;
    @observable idfShortName: string;
    @observable idfFirmwareVersion: string;
    @observable idfGuid: string;
    @observable idfRevisionNumber: string;
    @observable idfDescription: string;
    @observable idfSupportedModels: string;
    @observable idfRevisionComments: string;
    @observable idfAuthor: string;

    @observable sdlFriendlyName: string;

    check() {
        let messages: output.Message[] = [];

        if (!this.extensionName) {
            messages.push(output.propertyNotSetMessage(this, "extensionName"));
        }

        if (!this.idn) {
            messages.push(output.propertyNotSetMessage(this, "idn"));
        }

        if (!this.idfGuid) {
            messages.push(output.propertyNotSetMessage(this, "idfGuid"));
        }

        let extensionDefinitions = getProperty(
            ProjectStore.projectProperties,
            "extensionDefinitions"
        ) as ExtensionDefinitionProperties[];
        if (
            extensionDefinitions.find(
                extensionDefinition =>
                    extensionDefinition !== this && extensionDefinition.idfGuid === this.idfGuid
            )
        ) {
            messages.push(output.propertyNotUniqueMessage(this, "idfGuid"));
        }

        if (this.properties) {
            try {
                JSON.parse(this.properties);
            } catch (err) {
                messages.push(output.propertyInvalidValueMessage(this, "properties"));
            }
        }

        return messages;
    }
}

export function findExtensionDefinition(name: string) {
    let extensionDefinitions = getProperty(
        ProjectStore.projectProperties,
        "extensionDefinitions"
    ) as ExtensionDefinitionProperties[];
    for (let i = 0; i < extensionDefinitions.length; i++) {
        let extensionDefinition = extensionDefinitions[i];
        if (extensionDefinition.name == name) {
            return extensionDefinition;
        }
    }
    return undefined;
}

export const extensionDefinitionMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ExtensionDefinitionProperties;
    },
    className: "ExtensionDefinition",
    label: (extensionDefinition: ExtensionDefinitionProperties) => {
        return extensionDefinition.name;
    },
    listLabel: (extensionDefinition: ExtensionDefinitionProperties) => {
        return (
            extensionDefinition.name + (extensionDefinition.doNotBuild ? " (build disabled)" : "")
        );
    },
    properties: () => [
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text",
            defaultValue: undefined
        },
        {
            name: "doNotBuild",
            type: "boolean",
            defaultValue: false
        },
        {
            name: "buildConfiguration",
            type: "object-reference",
            referencedObjectCollectionPath: ["settings", "build", "configurations"],
            defaultValue: undefined
        },
        {
            name: "buildFolder",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "extensionName",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "image",
            type: "image",
            defaultValue: undefined
        },
        {
            name: "idn",
            displayName: "IDN",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "properties",
            type: "json",
            defaultValue: undefined
        },
        {
            name: "idfName",
            displayName: "IDF name",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfShortName",
            displayName: "IDF short name",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfFirmwareVersion",
            displayName: "IDF firmware version",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfGuid",
            displayName: "IDF GUID",
            type: "guid",
            defaultValue: undefined
        },
        {
            name: "idfRevisionNumber",
            displayName: "IDF revision number (extension version)",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfDescription",
            displayName: "IDF description",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfSupportedModels",
            displayName: "IDF supported models",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfRevisionComments",
            displayName: "IDF revision comments",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "idfAuthor",
            displayName: "IDF author",
            type: "string",
            defaultValue: undefined
        },
        {
            name: "sdlFriendlyName",
            displayName: "SDL friendly name",
            type: "string",
            defaultValue: undefined
        }
    ],
    newItem: (object: EezObject) => {
        return showGenericDialog({
            dialogDefinition: {
                title: "New Instrument Definition File",
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
    navigationComponent: ExtensionDefinitionsNavigation,
    hideInProperties: true,
    navigationComponentId: "extension-definitions",
    icon: "extension"
});

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("extension-definitions", {
    projectFeature: {
        mandatory: false,
        key: "extensionDefinitions",
        displayName: "Extension definitions",
        type: "array",
        metaData: extensionDefinitionMetaData,
        create: () => {
            return [];
        },
        check: (object: EezObject) => {
            return [];
        },
        metrics: metrics
    }
});
