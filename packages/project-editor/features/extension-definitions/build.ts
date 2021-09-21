import { toJS } from "mobx";

import { makeFolder } from "eez-studio-shared/util-electron";

import {
    buildInstrumentExtension,
    IdfProperties as InstrumentIdfProperties
} from "instrument/export";
import { getProperty } from "project-editor/core/object";
import { objectToJS } from "project-editor/core/serialization";
import { Section, Type } from "project-editor/core/output";
import type { DocumentStoreClass } from "project-editor/core/store";

import { getProjectFeatures } from "project-editor/core/extensions";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

function getInstrumentExtensionProperties(
    DocumentStore: DocumentStoreClass,
    extensionDefinition: ExtensionDefinition
) {
    const project = DocumentStore.project;

    let instrumentExtensionProperties: any = {};

    let projectFeatures = getProjectFeatures();
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
                Type.INFO,
                `Instrument definition file "${idfFileName}" builded.`
            );
        }
    }
}
