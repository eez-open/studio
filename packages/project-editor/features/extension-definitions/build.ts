import { toJS } from "mobx";

import { makeFolder } from "eez-studio-shared/util-electron";

import type { IdfProperties as InstrumentIdfProperties } from "instrument/export";

import { getProperty, MessageType } from "project-editor/core/object";
import { objectToJS, Section } from "project-editor/store";
import type { ProjectStore } from "project-editor/store";
import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";
import { ProjectEditor } from "project-editor/project-editor-interface";

function getInstrumentExtensionProperties(
    projectStore: ProjectStore,
    extensionDefinition: ExtensionDefinition
) {
    const project = projectStore.project;

    let instrumentExtensionProperties: any = {};

    let projectFeatures = ProjectEditor.extensions;
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.collectExtensionDefinitions &&
            getProperty(project, projectFeature.key)
        ) {
            projectFeature.collectExtensionDefinitions(
                project,
                extensionDefinition,
                instrumentExtensionProperties
            );
        }
    }

    return instrumentExtensionProperties;
}

function getExtensionsToBuild(projectStore: ProjectStore) {
    let extensionDefinitions = projectStore.project.extensionDefinitions;

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

export function extensionDefinitionAnythingToBuild(projectStore: ProjectStore) {
    return getExtensionsToBuild(projectStore).length > 0;
}

export async function extensionDefinitionBuild(projectStore: ProjectStore) {
    const extensionsToBuild = getExtensionsToBuild(projectStore);

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
            projectStore.project.settings.build.configurations.find(
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
            getInstrumentExtensionProperties(projectStore, idfFromProject)
        );

        if (configuration) {
            properties.moreDescription = configuration.description;
        }

        if (instrumentIdf.extensionName && instrumentIdf.idfGuid) {
            let idfFileName = `${instrumentIdf.extensionName}-${instrumentIdf.idfRevisionNumber}.zip`;

            let idfFilePath;
            if (extensionDefinition.buildFolder) {
                let buildFolderPath = projectStore.getAbsoluteFilePath(
                    extensionDefinition.buildFolder
                );

                try {
                    await makeFolder(buildFolderPath);
                } catch (err) {
                    console.error(err);
                }

                idfFilePath = buildFolderPath + "/" + idfFileName;
            } else {
                idfFilePath = projectStore.getAbsoluteFilePath(idfFileName);
            }

            const scpi = projectStore.project.scpi;
            const subsystems = objectToJS(scpi.subsystems);
            const enums = objectToJS(scpi.enums);

            const { buildInstrumentExtension } = await import(
                "instrument/export"
            );

            await buildInstrumentExtension(
                instrumentIdf,

                subsystems,

                enums,

                idfFilePath,

                instrumentIdf.image &&
                    projectStore.getAbsoluteFilePath(instrumentIdf.image),

                projectStore.project.settings.general.scpiDocFolder &&
                    projectStore.getAbsoluteFilePath(
                        projectStore.project.settings.general.scpiDocFolder
                    ),

                projectStore.getAbsoluteFilePath("."),

                properties
            );

            projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.INFO,
                `Instrument definition file "${idfFileName}" builded.`
            );
        }
    }
}
