import { toJS } from "mobx";

import { makeFolder } from "eez-studio-shared/util-electron";

import type { IdfProperties as InstrumentIdfProperties } from "instrument/export";
import { getProperty, MessageType } from "project-editor/core/object";
import { objectToJS, Section } from "project-editor/store";
import type { ProjectEditorStore } from "project-editor/store";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";
import { ProjectEditor } from "project-editor/project-editor-interface";

function getInstrumentExtensionProperties(
    projectEditorStore: ProjectEditorStore,
    extensionDefinition: ExtensionDefinition
) {
    const project = projectEditorStore.project;

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

function getExtensionsToBuild(projectEditorStore: ProjectEditorStore) {
    let extensionDefinitions = projectEditorStore.project.extensionDefinitions;

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
    projectEditorStore: ProjectEditorStore
) {
    return getExtensionsToBuild(projectEditorStore).length > 0;
}

export async function extensionDefinitionBuild(
    projectEditorStore: ProjectEditorStore
) {
    const extensionsToBuild = getExtensionsToBuild(projectEditorStore);

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
            projectEditorStore.project.settings.build.configurations.find(
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
            getInstrumentExtensionProperties(projectEditorStore, idfFromProject)
        );

        if (configuration) {
            properties.moreDescription = configuration.description;
        }

        if (instrumentIdf.extensionName && instrumentIdf.idfGuid) {
            let idfFileName = `${instrumentIdf.extensionName}-${instrumentIdf.idfRevisionNumber}.zip`;

            let idfFilePath;
            if (extensionDefinition.buildFolder) {
                let buildFolderPath = projectEditorStore.getAbsoluteFilePath(
                    extensionDefinition.buildFolder
                );

                try {
                    await makeFolder(buildFolderPath);
                } catch (err) {
                    console.error(err);
                }

                idfFilePath = buildFolderPath + "/" + idfFileName;
            } else {
                idfFilePath =
                    projectEditorStore.getAbsoluteFilePath(idfFileName);
            }

            const scpi = projectEditorStore.project.scpi;
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
                    projectEditorStore.getAbsoluteFilePath(instrumentIdf.image),

                projectEditorStore.project.settings.general.scpiDocFolder &&
                    projectEditorStore.getAbsoluteFilePath(
                        projectEditorStore.project.settings.general
                            .scpiDocFolder
                    ),

                projectEditorStore.getAbsoluteFilePath("."),

                properties
            );

            projectEditorStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.INFO,
                `Instrument definition file "${idfFileName}" builded.`
            );
        }
    }
}
