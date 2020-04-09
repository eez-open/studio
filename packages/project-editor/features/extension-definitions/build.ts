import { toJS } from "mobx";

import { makeFolder } from "eez-studio-shared/util-electron";

import {
    buildInstrumentExtension,
    IdfProperties as InstrumentIdfProperties
} from "instrument/export";
import { getProperty } from "project-editor/core/object";
import { objectToJS } from "project-editor/core/serialization";
import { OutputSectionsStore } from "project-editor/core/store";
import { Section, Type } from "project-editor/core/output";

import { ProjectStore } from "project-editor/core/store";
import { getExtensionsByCategory } from "project-editor/core/extensions";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

function getInstrumentExtensionProperties(extensionDefinition: ExtensionDefinition) {
    const project = ProjectStore.project;

    let instrumentExtensionProperties: any = {};

    let projectFeatures = getExtensionsByCategory("project-feature");
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.eezStudioExtension.implementation.projectFeature
                .collectExtensionDefinitions &&
            getProperty(
                project,
                projectFeature.eezStudioExtension.implementation.projectFeature.key
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

function getExtensionsToBuild() {
    let extensionDefinitions = ProjectStore.project.extensionDefinitions;

    return (
        extensionDefinitions &&
        extensionDefinitions
            .filter(extensionDefinition => !extensionDefinition.doNotBuild)
            .filter(extensionDefinition => {
                const idfFromProject = toJS(extensionDefinition);
                const instrumentIdf: InstrumentIdfProperties = idfFromProject as any;
                return instrumentIdf.extensionName && instrumentIdf.idfGuid;
            })
    );
}

export function extensionDefinitionAnythingToBuild() {
    return getExtensionsToBuild().length > 0;
}

export async function extensionDefinitionBuild() {
    const extensionsToBuild = getExtensionsToBuild();

    if (!extensionsToBuild) {
        return;
    }

    for (const extensionDefinition of extensionsToBuild) {
        const idfFromProject = toJS(extensionDefinition);

        const instrumentIdf: InstrumentIdfProperties = idfFromProject as any;

        // collect extension properties
        let properties: any = {};

        // from configuration
        const configuration = ProjectStore.project.settings.build.configurations.find(
            configuration => configuration.name == extensionDefinition.buildConfiguration
        );
        if (configuration && configuration.properties) {
            properties = Object.assign(properties, JSON.parse(configuration.properties));
        }

        // from extension definition
        if (idfFromProject.properties) {
            properties = Object.assign(properties, JSON.parse(idfFromProject.properties));
        }

        // from other project extensions
        properties = Object.assign(
            {
                properties
            },
            getInstrumentExtensionProperties(idfFromProject)
        );

        if (configuration) {
            properties.moreDescription = configuration.description;
        }

        if (instrumentIdf.extensionName && instrumentIdf.idfGuid) {
            let idfFileName = `${instrumentIdf.extensionName}-${instrumentIdf.idfRevisionNumber}.zip`;

            let idfFilePath;
            if (extensionDefinition.buildFolder) {
                let buildFolderPath = ProjectStore.getAbsoluteFilePath(
                    extensionDefinition.buildFolder
                );

                try {
                    await makeFolder(buildFolderPath);
                } catch (err) {
                    console.error(err);
                }

                idfFilePath = buildFolderPath + "/" + idfFileName;
            } else {
                idfFilePath = ProjectStore.getAbsoluteFilePath(idfFileName);
            }

            const scpi = ProjectStore.project.scpi;
            const subsystems = objectToJS(scpi.subsystems);
            const enums = objectToJS(scpi.enums);

            await buildInstrumentExtension(
                instrumentIdf,

                subsystems,

                enums,

                idfFilePath,

                instrumentIdf.image && ProjectStore.getAbsoluteFilePath(instrumentIdf.image),

                ProjectStore.project.settings.general.scpiDocFolder &&
                    ProjectStore.getAbsoluteFilePath(
                        ProjectStore.project.settings.general.scpiDocFolder
                    ),

                properties
            );

            OutputSectionsStore.write(
                Section.OUTPUT,
                Type.INFO,
                `Instrument definition file "${idfFileName}" builded.`
            );
        }
    }
}
