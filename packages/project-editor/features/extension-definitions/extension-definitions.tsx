import React from "react";
import { observable, makeObservable } from "mobx";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    MessageType,
    IMessage
} from "project-editor/core/object";
import {
    createObject,
    getChildOfObject,
    getProjectStore,
    Message,
    propertyInvalidValueMessage,
    propertyNotSetMessage,
    propertyNotUniqueMessage
} from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { fileExistsSync } from "eez-studio-shared/util-electron";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { isNotScpiProject } from "project-editor/project/project-type-traits";

////////////////////////////////////////////////////////////////////////////////

export class ExtensionDefinitionsTab extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <ListNavigation
                id={"extension-definitions"}
                navigationObject={this.context.project.extensionDefinitions}
                selectedObject={
                    this.context.navigationStore
                        .selectedExtensionDefinitionObject
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class UseDashboardProject extends EezObject {
    projectFilePath: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "projectFilePath",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                isOptional: false
            }
        ],
        defaultValue: {},
        check: (object: UseDashboardProject, messages: IMessage[]) => {
            if (object.projectFilePath) {
                if (
                    !fileExistsSync(
                        getProjectStore(object).getAbsoluteFilePath(
                            object.projectFilePath
                        )
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "projectFilePath")
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "projectFilePath"));
            }
        }
    };

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            projectFilePath: observable
        });
    }
}

registerClass("UseDashboardProject", UseDashboardProject);

////////////////////////////////////////////////////////////////////////////////

export class ExtensionDefinition extends EezObject {
    name: string;
    description: string;
    doNotBuild: boolean;
    buildConfiguration: string;
    buildFolder: string;
    image: string;
    extensionName: string;
    idn: string;

    properties: string;

    idfName: string;
    idfShortName: string;
    idfFirmwareVersion: string;
    idfGuid: string;
    idfRevisionNumber: string;
    idfDescription: string;
    idfSupportedModels: string;
    idfRevisionComments: string;
    idfAuthor: string;

    sdlFriendlyName: string;

    useDashboardProjects: UseDashboardProject[];

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
                referencedObjectCollectionPath: "settings/build/configurations",
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
                defaultValue: undefined,
                disabled: isNotScpiProject
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
                disabled: isNotScpiProject
            },
            {
                name: "idfShortName",
                displayName: "IDF short name",
                type: PropertyType.String,
                defaultValue: undefined,
                disabled: isNotScpiProject
            },
            {
                name: "idfFirmwareVersion",
                displayName: "IDF firmware version",
                type: PropertyType.String,
                defaultValue: undefined,
                disabled: isNotScpiProject
            },
            {
                name: "idfGuid",
                displayName: object =>
                    isNotScpiProject(object) ? "GUID" : "IDF GUID",
                type: PropertyType.GUID
            },
            {
                name: "idfRevisionNumber",
                displayName: object =>
                    isNotScpiProject(object)
                        ? "Extension version"
                        : "IDF revision number (extension version)",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfDescription",
                displayName: object =>
                    isNotScpiProject(object)
                        ? "Description"
                        : "IDF description",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "idfSupportedModels",
                displayName: "IDF supported models",
                type: PropertyType.String,
                defaultValue: undefined,
                disabled: isNotScpiProject
            },
            {
                name: "idfRevisionComments",
                displayName: "IDF revision comments",
                type: PropertyType.String,
                defaultValue: undefined,
                disabled: isNotScpiProject
            },
            {
                name: "idfAuthor",
                displayName: object =>
                    isNotScpiProject(object) ? "Author" : "IDF author",
                type: PropertyType.String,
                defaultValue: undefined
            },
            {
                name: "sdlFriendlyName",
                displayName: "SDL friendly name",
                type: PropertyType.String,
                defaultValue: undefined,
                disabled: isNotScpiProject
            },
            {
                name: "useDashboardProjects",
                displayName: "Dashboard projects",
                type: PropertyType.Array,
                typeClass: UseDashboardProject,
                defaultValue: []
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Instrument Definition File",
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
            });

            const projectStore = getProjectStore(parent);

            const extensionDefinitionProperties: Partial<ExtensionDefinition> =
                {
                    name: result.values.name
                };

            const extensionDefinition = createObject<ExtensionDefinition>(
                projectStore,
                extensionDefinitionProperties,
                ExtensionDefinition
            );

            return extensionDefinition;
        },
        hideInProperties: true,
        icon: "material:extension",
        check: (object: ExtensionDefinition, messages: IMessage[]) => {
            const projectStore = getProjectStore(object);

            if (!object.extensionName) {
                messages.push(propertyNotSetMessage(object, "extensionName"));
            }

            if (projectStore.isScpiInstrument && !object.idn) {
                messages.push(propertyNotSetMessage(object, "idn"));
            }

            if (!object.idfGuid) {
                messages.push(propertyNotSetMessage(object, "idfGuid"));
            }

            if (!object.idfRevisionNumber) {
                messages.push(
                    propertyNotSetMessage(object, "idfRevisionNumber")
                );
            }

            if (projectStore.isScpiInstrument && !object.idfName) {
                messages.push(propertyNotSetMessage(object, "idfName"));
            }

            if (projectStore.isScpiInstrument && !object.idfShortName) {
                messages.push(propertyNotSetMessage(object, "idfShortName"));
            }

            let extensionDefinitions =
                projectStore.project.extensionDefinitions;
            if (
                extensionDefinitions.find(
                    extensionDefinition =>
                        extensionDefinition !== object &&
                        extensionDefinition.idfGuid === object.idfGuid
                )
            ) {
                messages.push(propertyNotUniqueMessage(object, "idfGuid"));
            }

            if (object.properties) {
                try {
                    JSON.parse(object.properties);
                } catch (err) {
                    messages.push(
                        propertyInvalidValueMessage(object, "properties")
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            name: observable,
            description: observable,
            doNotBuild: observable,
            buildConfiguration: observable,
            buildFolder: observable,
            image: observable,
            extensionName: observable,
            idn: observable,
            properties: observable,
            idfName: observable,
            idfShortName: observable,
            idfFirmwareVersion: observable,
            idfGuid: observable,
            idfRevisionNumber: observable,
            idfDescription: observable,
            idfSupportedModels: observable,
            idfRevisionComments: observable,
            idfAuthor: observable,
            sdlFriendlyName: observable,
            useDashboardProjects: observable
        });
    }
}

registerClass("ExtensionDefinition", ExtensionDefinition);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-extension-definitions",
    version: "0.1.0",
    description:
        "This feature adds support for IEXT definitions into your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "IEXT defs",
    mandatory: false,
    key: "extensionDefinitions",
    type: PropertyType.Array,
    typeClass: ExtensionDefinition,
    icon: "material:extension",
    create: () => {
        return [];
    }
};

export default feature;
