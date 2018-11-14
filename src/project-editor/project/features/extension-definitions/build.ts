import { toJS } from "mobx";

import { makeFolder } from "eez-studio-shared/util";

import {
    buildInstrumentExtension,
    IdfProperties as InstrumentIdfProperties
} from "instrument/export";
import { ProjectStore, OutputSectionsStore, getProperty } from "project-editor/core/store";
import { getExtensionsByCategory } from "project-editor/core/extensions";
import { Section, Type } from "project-editor/core/output";

import { ScpiProperties } from "project-editor/project/features/scpi/scpi";

import { ExtensionDefinitionProperties } from "project-editor/project/features/extension-definitions/extension-definitions";

function getInstrumentExtensionProperties(extensionDefinition: ExtensionDefinitionProperties) {
    const project = ProjectStore.projectProperties;

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

export async function extensionDefinitionBuild() {
    let extensionDefinitions = getProperty(
        ProjectStore.projectProperties,
        "extensionDefinitions"
    ) as ExtensionDefinitionProperties[];

    if (extensionDefinitions) {
        await Promise.all(
            extensionDefinitions
                .filter(extensionDefinition => !extensionDefinition.doNotBuild)
                .map(async extensionDefinition => {
                    const idfFromProject = toJS(extensionDefinition);

                    const instrumentIdf: InstrumentIdfProperties = idfFromProject as any;

                    // collect extension properties
                    let properties = {};

                    // from configuration
                    const configuration = ProjectStore.projectProperties.settings.build.configurations.find(
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
                        getInstrumentExtensionProperties(idfFromProject)
                    );

                    if (instrumentIdf.extensionName && instrumentIdf.idn && instrumentIdf.idfGuid) {
                        let idfFileName = `${instrumentIdf.extensionName}-${
                            instrumentIdf.idfRevisionNumber
                        }.zip`;

                        let idfFilePath;
                        if (extensionDefinition.buildFolder) {
                            let buildFolderPath = ProjectStore.getAbsoluteFilePath(
                                extensionDefinition.buildFolder
                            );
                            await makeFolder(buildFolderPath);
                            idfFilePath = buildFolderPath + "/" + idfFileName;
                        } else {
                            idfFilePath = ProjectStore.getAbsoluteFilePath(idfFileName);
                        }

                        await buildInstrumentExtension(
                            instrumentIdf,

                            (getProperty(ProjectStore.projectProperties, "scpi") as ScpiProperties)
                                .subsystems,

                            idfFilePath,

                            instrumentIdf.image &&
                                ProjectStore.getAbsoluteFilePath(instrumentIdf.image),

                            ProjectStore.projectProperties.settings.general.scpiDocFolder &&
                                ProjectStore.getAbsoluteFilePath(
                                    ProjectStore.projectProperties.settings.general.scpiDocFolder
                                ),

                            properties
                        );

                        OutputSectionsStore.write(
                            Section.OUTPUT,
                            Type.INFO,
                            `Instrument definition file "${idfFileName}" builded.`
                        );
                    }
                })
        );
    }
}
