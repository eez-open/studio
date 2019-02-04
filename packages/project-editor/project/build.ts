import { createTransformer } from "mobx-utils";

import { writeTextFile, formatNumber } from "eez-studio-shared/util";
import { _map } from "eez-studio-shared/algorithm";
import { underscore } from "eez-studio-shared/string";

import { getExtensionsByCategory, BuildResult } from "project-editor/core/extensions";
import {
    EezObject,
    PropertyInfo,
    PropertyType,
    isArray,
    asArray,
    getProperty,
    checkObject,
    IMessage
} from "eez-studio-shared/model/object";
import { OutputSectionsStore } from "eez-studio-shared/model/store";
import { Section, Type } from "eez-studio-shared/model/output";

import { ProjectStore } from "project-editor/core/store";

import { BuildFile } from "project-editor/project/project";
import {
    extensionDefinitionAnythingToBuild,
    extensionDefinitionBuild
} from "project-editor/project/features/extension-definitions/build";

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

async function getBuildResults(sectionNames: string[] | undefined) {
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
                    sectionNames
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

    project.settings.build.files._array.forEach(buildFile => {
        let result;
        while ((result = sectionNamesRegexp.exec(buildFile.template)) !== null) {
            sectionNames.push(result[1]);
        }
    });

    return sectionNames;
}

async function doBuild(destinationFolderPath: string, buildResults: BuildResult[]) {
    const project = ProjectStore.project;

    if (project.settings.build.files._array.length > 0) {
        let parts: any = {};
        for (let i = 0; i < buildResults.length; i++) {
            parts = Object.assign(parts, buildResults[i]);
        }

        await project.settings.build.files._array.forEach(async (buildFile: BuildFile) => {
            let buildFileContent = buildFile.template.replace(sectionNamesRegexp, (_1, part) => {
                return parts[part];
            });

            await writeTextFile(destinationFolderPath + "/" + buildFile.fileName, buildFileContent);
        });
    }
}

function anythingToBuild() {
    if (ProjectStore.project.settings.build.files._array.length > 0) {
        return true;
    }
    return extensionDefinitionAnythingToBuild();
}

export async function build(onlyCheck: boolean) {
    OutputSectionsStore.setActiveSection(Section.OUTPUT);
    OutputSectionsStore.clear(Section.OUTPUT);

    if (!anythingToBuild()) {
        OutputSectionsStore.write(Section.OUTPUT, Type.INFO, `Nothing to build!`);
        return;
    }

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

        let buildResults = await getBuildResults(sectionNames);

        showCheckResult();

        if (onlyCheck) {
            return;
        }

        await doBuild(destinationFolderPath, buildResults);

        await extensionDefinitionBuild();

        OutputSectionsStore.write(Section.OUTPUT, Type.INFO, "Build successfully finished.");
    } catch (err) {
        if (err instanceof BuildException) {
            OutputSectionsStore.write(Section.OUTPUT, Type.ERROR, err.message, err.object);
        } else {
            OutputSectionsStore.write(Section.OUTPUT, Type.ERROR, `Module build error: ${err}`);
        }

        showCheckResult();
    }
}

////////////////////////////////////////////////////////////////////////////////

var checkTransformer: (object: EezObject) => IMessage[] = createTransformer(
    (object: EezObject): IMessage[] => {
        const children = object._classInfo.properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Array ||
                    propertyInfo.type === PropertyType.Object) &&
                getProperty(object, propertyInfo.name)
        );

        const childrenMessages = children.reduce(
            (result: IMessage[], propertyInfo: PropertyInfo) => {
                const childObject = getProperty(object, propertyInfo.name);

                let childrenMessages: IMessage[];
                if (isArray(childObject)) {
                    childrenMessages = asArray(childObject).reduce<IMessage[]>(
                        (result: IMessage[], object: EezObject) => {
                            return result.concat(checkTransformer(object));
                        },
                        [] as IMessage[]
                    );
                } else {
                    childrenMessages = checkTransformer(childObject);
                }

                return result.concat(childrenMessages);
            },
            []
        );

        return checkObject(object).concat(childrenMessages);
    }
);

export function backgroundCheck() {
    OutputSectionsStore.setMessages(Section.CHECKS, checkTransformer(ProjectStore.project));
}
