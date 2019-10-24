import { createTransformer } from "mobx-utils";

import { formatNumber } from "eez-studio-shared/util";
import { writeTextFile } from "eez-studio-shared/util-electron";
import { _map } from "eez-studio-shared/algorithm";
import { underscore } from "eez-studio-shared/string";

import { getExtensionsByCategory, BuildResult } from "project-editor/core/extensions";
import {
    EezObject,
    isArray,
    asArray,
    getProperty,
    IMessage,
    getArrayAndObjectProperties
} from "project-editor/core/object";
import { OutputSectionsStore } from "project-editor/core/store";
import { Section, Type } from "project-editor/core/output";

import { ProjectStore } from "project-editor/core/store";

import { BuildFile, BuildConfiguration } from "project-editor/project/project";
import {
    extensionDefinitionAnythingToBuild,
    extensionDefinitionBuild
} from "project-editor/features/extension-definitions/build";

const fs = EEZStudio.electron.remote.require("fs");

////////////////////////////////////////////////////////////////////////////////

export const TAB = "    ";

////////////////////////////////////////////////////////////////////////////////

export enum NamingConvention {
    UnderscoreUpperCase,
    UnderscoreLowerCase
}

export function getName(prefix: string, name: string, namingConvention: NamingConvention) {
    name = name.replace(/[^a-zA-Z_0-9]/g, " ");

    if (namingConvention == NamingConvention.UnderscoreUpperCase) {
        name = underscore(name).toUpperCase();
    } else if (namingConvention == NamingConvention.UnderscoreLowerCase) {
        name = underscore(name).toLowerCase();
    }

    name = prefix + name;

    return name;
}

////////////////////////////////////////////////////////////////////////////////

export function dumpData(data: number[] | Buffer) {
    let result = "";
    _map(data, value => "0x" + formatNumber(value, 16, 2)).forEach((value, index) => {
        if (result.length > 0) {
            result += ",";
        }
        if (index % 16 == 0) {
            result += "\n" + TAB;
        } else {
            result += " ";
        }
        result += value;
    });
    result += "\n";
    return result;
}

////////////////////////////////////////////////////////////////////////////////

function showCheckResult() {
    let outputSection = OutputSectionsStore.getSection(Section.OUTPUT);

    let checkResultMassage: string;

    if (outputSection.numErrors == 0) {
        checkResultMassage = "No error";
    } else if (outputSection.numErrors == 1) {
        checkResultMassage = "1 error";
    } else {
        checkResultMassage = `${outputSection.numErrors} errors`;
    }

    checkResultMassage += " and ";

    if (outputSection.numWarnings == 0) {
        checkResultMassage += " no warning";
    } else if (outputSection.numWarnings == 1) {
        checkResultMassage += " 1 warning";
    } else {
        checkResultMassage += ` ${outputSection.numWarnings} warnings`;
    }

    checkResultMassage += " detected";

    OutputSectionsStore.write(Section.OUTPUT, Type.INFO, checkResultMassage);
}

class BuildException {
    constructor(public message: string, public object?: EezObject | undefined) {}
}

async function getBuildResults(
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined
) {
    const project = ProjectStore.project;

    let buildResults: BuildResult[] = [];

    let projectFeatures = getExtensionsByCategory("project-feature");
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.eezStudioExtension.implementation.projectFeature.build &&
            getProperty(
                project,
                projectFeature.eezStudioExtension.implementation.projectFeature.key
            )
        ) {
            buildResults.push(
                await projectFeature.eezStudioExtension.implementation.projectFeature.build(
                    project,
                    sectionNames,
                    buildConfiguration
                )
            );
        }
    }

    return buildResults;
}

const sectionNamesRegexp = /\/\/\$\{eez-studio (.*)\}/g;

function getSectionNames(): string[] {
    const project = ProjectStore.project;

    const sectionNames: string[] = [];

    project.settings.build.files.forEach(buildFile => {
        let result;
        while ((result = sectionNamesRegexp.exec(buildFile.template)) !== null) {
            sectionNames.push(result[1]);
        }
    });

    return sectionNames;
}

async function generateFile(buildResults: BuildResult[], buildFile: BuildFile, filePath: string) {
    let parts: any = {};
    for (const buildResult of buildResults) {
        parts = Object.assign(parts, buildResult);
    }

    let buildFileContent = buildFile.template.replace(sectionNamesRegexp, (_1, part) => {
        return parts[part];
    });

    await writeTextFile(filePath, buildFileContent);

    OutputSectionsStore.write(Section.OUTPUT, Type.INFO, `File "${filePath}" builded`);
}

async function generateFiles(
    destinationFolderPath: string,
    configurationBuildResults: {
        [configurationName: string]: BuildResult[];
    }
) {
    const build = ProjectStore.project.settings.build;

    for (const buildFile of asArray(build.files)) {
        if (buildFile.fileName.indexOf("<configuration>") !== -1) {
            for (const configuration of asArray(build.configurations)) {
                await generateFile(
                    configurationBuildResults[configuration.name],
                    buildFile,
                    destinationFolderPath +
                        "/" +
                        buildFile.fileName.replace("<configuration>", configuration.name)
                );
            }
        } else {
            generateFile(
                configurationBuildResults[
                    ProjectStore.selectedBuildConfiguration
                        ? ProjectStore.selectedBuildConfiguration.name
                        : "default"
                ],
                buildFile,
                destinationFolderPath + "/" + buildFile.fileName
            );
        }
    }
}

function anythingToBuild() {
    if (ProjectStore.project.settings.build.files.length > 0) {
        return true;
    }
    return extensionDefinitionAnythingToBuild();
}

export async function build(onlyCheck: boolean) {
    const timeStart = new Date().getTime();

    OutputSectionsStore.setActiveSection(Section.OUTPUT);
    OutputSectionsStore.clear(Section.OUTPUT);

    if (!anythingToBuild()) {
        OutputSectionsStore.write(Section.OUTPUT, Type.INFO, `Nothing to build!`);
        return;
    }

    OutputSectionsStore.setLoading(Section.OUTPUT, true);

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        let sectionNames: string[] | undefined = undefined;

        let destinationFolderPath;
        if (!onlyCheck) {
            destinationFolderPath = ProjectStore.getAbsoluteFilePath(
                ProjectStore.project.settings.build.destinationFolder || "."
            );
            if (!fs.existsSync(destinationFolderPath)) {
                throw new BuildException("Cannot find destination folder.");
            }

            sectionNames = getSectionNames();
        }

        let configurationBuildResuts: {
            [configurationName: string]: BuildResult[];
        } = {};

        if (
            ProjectStore.project.settings.general.projectVersion !== "v1" &&
            ProjectStore.project.settings.build.configurations.length > 0
        ) {
            for (const configuration of asArray(
                ProjectStore.project.settings.build.configurations
            )) {
                OutputSectionsStore.write(
                    Section.OUTPUT,
                    Type.INFO,
                    `Building ${configuration.name} configuration`
                );
                configurationBuildResuts[configuration.name] = await getBuildResults(
                    sectionNames,
                    configuration
                );
            }
        } else {
            const selectedBuildConfiguration =
                ProjectStore.selectedBuildConfiguration ||
                asArray(ProjectStore.project.settings.build.configurations)[0];
            if (selectedBuildConfiguration) {
                OutputSectionsStore.write(
                    Section.OUTPUT,
                    Type.INFO,
                    `Building ${selectedBuildConfiguration.name} configuration`
                );
                configurationBuildResuts[selectedBuildConfiguration.name] = await getBuildResults(
                    sectionNames,
                    selectedBuildConfiguration
                );
            }
        }

        showCheckResult();

        if (onlyCheck) {
            return;
        }

        await generateFiles(destinationFolderPath, configurationBuildResuts);

        await extensionDefinitionBuild();

        OutputSectionsStore.write(
            Section.OUTPUT,
            Type.INFO,
            `Build successfully finished at ${new Date().toLocaleString()}.`
        );
    } catch (err) {
        if (err instanceof BuildException) {
            OutputSectionsStore.write(Section.OUTPUT, Type.ERROR, err.message, err.object);
        } else {
            OutputSectionsStore.write(Section.OUTPUT, Type.ERROR, `Module build error: ${err}`);
        }

        showCheckResult();
    } finally {
        OutputSectionsStore.setLoading(Section.OUTPUT, false);
    }

    console.log("Build time:", new Date().getTime() - timeStart);
}

////////////////////////////////////////////////////////////////////////////////

var enumTransformer: (object: EezObject) => EezObject[] = createTransformer(
    (object: EezObject): EezObject[] => {
        const objects = [object];

        if (isArray(object)) {
            // check array elements
            for (const childObject of asArray(object)) {
                objects.push(...enumTransformer(childObject));
            }
        } else {
            // check all child array and object properties
            for (const propertyInfo of getArrayAndObjectProperties(object)) {
                const childObject = (object as any)[propertyInfo.name];
                if (childObject) {
                    objects.push(...enumTransformer(childObject));
                }
            }
        }

        return objects;
    }
);

var checkTransformer: (object: EezObject) => IMessage[] = createTransformer(
    (object: EezObject): IMessage[] => {
        let messages: IMessage[] = [];

        // call check method of the object
        if ((object as any).check) {
            messages = messages.concat((object as any).check());
        }

        // call check from property definition
        if (object._propertyInfo && object._propertyInfo.check) {
            messages = messages.concat(object._propertyInfo.check(object));
        }

        if (isArray(object)) {
            // check array elements
            for (const childObject of asArray(object)) {
                messages = messages.concat(checkTransformer(childObject));
            }
        } else {
            // check all child array and object properties
            for (const propertyInfo of getArrayAndObjectProperties(object)) {
                const childObject = (object as any)[propertyInfo.name];
                if (childObject) {
                    messages = messages.concat(checkTransformer(childObject));
                }
            }
        }

        return messages;
    }
);

export function backgroundCheck() {
    //console.time("backgroundCheck");
    OutputSectionsStore.setMessages(Section.CHECKS, checkTransformer(ProjectStore.project));
    //console.timeEnd("backgroundCheck");
}
