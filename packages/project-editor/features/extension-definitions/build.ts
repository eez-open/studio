import { toJS } from "mobx";

import { makeFolder } from "eez-studio-shared/util-electron";

import {
    buildInstrumentExtension,
    IdfProperties as InstrumentIdfProperties
} from "instrument/export";
import { getProperty, MessageType } from "project-editor/core/object";
import { objectToJS, Section } from "project-editor/core/store";
import type { DocumentStoreClass } from "project-editor/core/store";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";
import { ProjectEditor } from "project-editor/project-editor-interface";

function getInstrumentExtensionProperties(
    DocumentStore: DocumentStoreClass,
    extensionDefinition: ExtensionDefinition
) {
    const project = DocumentStore.project;

    let instrumentExtensionProperties: any = {};

    let projectFeatures = ProjectEditor.extensions;
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.eezStudioExtension.implementation.projectFeature
                .collectExtensionDefinitions &&
            getProperty(
                project,
                projectFeature.eezStudioExtension.implementation.projectFeature
                    .key
            )
        ) {
            projectFeature.eezStudioExtension.implementation.projectFeature.collectExtensionDefinitions(
                project,
                extensionDefinition,
                instrumentExtensionProperties
            );
        }
    }

    return instrumentExtensionProperties;
}

function getExtensionsToBuild(DocumentStore: DocumentStoreClass) {
    let extensionDefinitions = DocumentStore.project.extensionDefinitions;

    return (
        extensionDefinitions &&
        extensionDefinitions
            .filter(extensionDefinition => !extensionDefinition.doNotBuild)
            .filter(extensionDefinition => {
                const idfFromProject = toJS(extensionDefinition);
                const instrumentIdf: InstrumentIdfProperties =
                    idfFromProject as any;
                return instrumentIdf.extensionName && instrumentIdf.idfGuid;
            })
    );
}

export function extensionDefinitionAnythingToBuild(
    DocumentStore: DocumentStoreClass
) {
    return getExtensionsToBuild(DocumentStore).length > 0;
}

export async function extensionDefinitionBuild(
    DocumentStore: DocumentStoreClass
) {
    const extensionsToBuild = getExtensionsToBuild(DocumentStore);

    if (!extensionsToBuild) {
        return;
    }

    for (const extensionDefinition of extensionsToBuild) {
        const idfFromProject = toJS(extensionDefinition);

        const instrumentIdf: InstrumentIdfProperties = idfFromProject as any;

        // collect extension properties
        let properties: any = {};

        // from configuration
        const configuration =
            DocumentStore.project.settings.build.configurations.find(
                configuration =>
                    configuration.name == extensionDefinition.buildConfiguration
            );
        if (configuration && configuration.properties) {
            properties = Object.assign(
                properties,
                JSON.parse(configuration.properties)
            );
        }

        // from extension definition
        if (idfFromProject.properties) {
            properties = Object.assign(
                properties,
                JSON.parse(idfFromProject.properties)
            );
        }

        // from other project extensions
        properties = Object.assign(
            {
                properties
            },
            getInstrumentExtensionProperties(DocumentStore, idfFromProject)
        );

        if (configuration) {
            properties.moreDescription = configuration.description;
        }

        if (instrumentIdf.extensionName && instrumentIdf.idfGuid) {
            let idfFileName = `${instrumentIdf.extensionName}-${instrumentIdf.idfRevisionNumber}.zip`;

            let idfFilePath;
            if (extensionDefinition.buildFolder) {
                let buildFolderPath = DocumentStore.getAbsoluteFilePath(
                    extensionDefinition.buildFolder
                );

                try {
                    await makeFolder(buildFolderPath);
                } catch (err) {
                    console.error(err);
                }

                idfFilePath = buildFolderPath + "/" + idfFileName;
            } else {
                idfFilePath = DocumentStore.getAbsoluteFilePath(idfFileName);
            }

            const scpi = DocumentStore.project.scpi;
            const subsystems = objectToJS(scpi.subsystems);
            const enums = objectToJS(scpi.enums);

            await buildInstrumentExtension(
                instrumentIdf,

                subsystems,

                enums,

                idfFilePath,

                instrumentIdf.image &&
                    DocumentStore.getAbsoluteFilePath(instrumentIdf.image),

                DocumentStore.project.settings.general.scpiDocFolder &&
                    DocumentStore.getAbsoluteFilePath(
                        DocumentStore.project.settings.general.scpiDocFolder
                    ),

                properties
            );

            DocumentStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.INFO,
                `Instrument definition file "${idfFileName}" builded.`
            );
        }
    }
}
