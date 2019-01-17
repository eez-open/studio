import { observable } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    EezObject,
    EezArrayObject,
    PropertyType,
    getProperty,
    asArray
} from "eez-studio-shared/model/object";
import * as output from "eez-studio-shared/model/output";

import { ProjectStore } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { ExtensionDefinitionsNavigation } from "project-editor/project/features/extension-definitions/navigation";
import { metrics } from "project-editor/project/features/extension-definitions/metrics";

////////////////////////////////////////////////////////////////////////////////

export class ExtensionDefinition extends EezObject {
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

    static classInfo: ClassInfo = {
        listLabel: (extensionDefinition: ExtensionDefinition) => {
            return (
                extensionDefinition.name +
                (extensionDefinition.doNotBuild ? " (build disabled)" : "")
            );
        },
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText,
                defaultValue: undefined
            },
            {
                name: "doNotBuild",
                type: PropertyType.Boolean,
                defaultValue: false
            },
            {
                name: "buildConfiguration",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["settings", "build", "configurations"],
                defaultValue: undefined
            },
            {
                name: "buildFolder",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "extensionName",
                displayName: "IEXT name",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "image",
                type: PropertyType.Image,
                defaultValue: undefined
            },
            {
                name: "idn",
                displayName: "IDN",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "properties",
                type: PropertyType.JSON,
                defaultValue: undefined
            },
            {
                name: "idfName",
                displayName: "IDF name",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfShortName",
                displayName: "IDF short name",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfFirmwareVersion",
                displayName: "IDF firmware version",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfGuid",
                displayName: "IDF GUID",
                type: PropertyType.GUID,
                defaultValue: undefined
            },
            {
                name: "idfRevisionNumber",
                displayName: "IDF revision number (extension version)",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfDescription",
                displayName: "IDF description",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfSupportedModels",
                displayName: "IDF supported models",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfRevisionComments",
                displayName: "IDF revision comments",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfAuthor",
                displayName: "IDF author",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "sdlFriendlyName",
                displayName: "SDL friendly name",
                type: PropertyType.String,
                defaultValue: undefined
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Instrument Definition File",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
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
        navigationComponent: ExtensionDefinitionsNavigation,
        hideInProperties: true,
        navigationComponentId: "extension-definitions",
        icon: "extension"
    };

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
            ProjectStore.project,
            "extensionDefinitions"
        ) as EezArrayObject<ExtensionDefinition>;
        if (
            extensionDefinitions._array.find(
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

registerClass(ExtensionDefinition);

export function findExtensionDefinition(name: string) {
    let extensionDefinitions = getProperty(
        ProjectStore.project,
        "extensionDefinitions"
    ) as EezArrayObject<ExtensionDefinition>;
    for (const extensionDefinition of extensionDefinitions._array) {
        if (extensionDefinition.name == name) {
            return extensionDefinition;
        }
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("extension-definitions", {
    projectFeature: {
        mandatory: false,
        key: "extensionDefinitions",
        displayName: "Extension definitions",
        type: PropertyType.Array,
        typeClass: ExtensionDefinition,
        create: () => {
            return [];
        },
        check: (object: EezObject) => {
            return [];
        },
        metrics: metrics
    }
});
