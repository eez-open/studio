import { createTransformer } from "mobx-utils";

import { writeTextFile } from "shared/util";
import { underscore } from "shared/string";

import { getExtensionsByCategory, BuildResult } from "project-editor/core/extensions";
import { formatNumber } from "project-editor/core/util";
import {
    ProjectStore,
    OutputSectionsStore,
    getChildOfObject,
    isArray,
    asArray,
    getProperty,
    check,
    getMetaData
} from "project-editor/core/store";
import { EezObject, PropertyMetaData } from "project-editor/core/metaData";
import { Message, Section, Type } from "project-editor/core/output";

import { BuildFileProperties } from "project-editor/project/project";
import { extensionDefinitionBuild } from "project-editor/project/features/extension-definitions/build";

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

export function dumpData(data: number[]) {
    let result = "";
    data.map(value => "0x" + formatNumber(value, 16, 2)).forEach((value, index) => {
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

// Workaround for the "!!!" bug in Arduino Mega bootloader program. Three
// consecutive "!"" characters causes the bootloader to jump into a 'monitor mode'
// awaiting user monitor commands (which will never come) thus hanging the up load operation.
// If hex image contains three consecutive '!' characters (33 is ASCII code)
// then uploading hex image to the device will fail.
// Here we replace "!!!"" with "!! ", i.e. [33, 33, 33] with [33, 33, 32].
export function fixDataForMegaBootloader(data: any, object: EezObject) {
    let result: number[] = [];

    let threeExclamationsDetected = false;

    for (let i = 0; i < data.length; ++i) {
        if (i >= 2 && data[i - 2] == 33 && data[i - 1] == 33 && data[i] == 33) {
            threeExclamationsDetected = true;
            result.push(32);
        } else {
            result.push(data[i]);
        }
    }

    if (threeExclamationsDetected) {
        //OutputSectionsStore.write(Section.OUTPUT, Type.WARNING, `"!!!" detected and replaced with "!! " (Arduino Mega bootloader bug)`, object);
    }

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

async function getBuildResults() {
    const project = ProjectStore.projectProperties;

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
                await projectFeature.eezStudioExtension.implementation.projectFeature.build(project)
            );
        }
    }

    return buildResults;
}

async function doBuild(destinationFolderPath: string, buildResults: BuildResult[]) {
    const project = ProjectStore.projectProperties;

    if (project.settings.build.files.length > 0) {
        let parts: any = {};
        for (let i = 0; i < buildResults.length; ++i) {
            parts = Object.assign(parts, buildResults[i]);
        }

        await project.settings.build.files.forEach(async (buildFile: BuildFileProperties) => {
            let buildFileContent = buildFile.template.replace(
                /\/\/\$\{eez-studio (.*)\}/g,
                (_1, part) => {
                    return parts[part];
                }
            );

            await writeTextFile(destinationFolderPath + "/" + buildFile.fileName, buildFileContent);
        });
    }
}

export async function build(onlyCheck: boolean) {
    OutputSectionsStore.setActiveSection(Section.OUTPUT);
    OutputSectionsStore.clear(Section.OUTPUT);

    try {
        let buildResults = await getBuildResults();

        if (onlyCheck) {
            showCheckResult();
            return;
        }

        // get and validate destination folder
        const project = ProjectStore.projectProperties;
        if (!project.settings.build.destinationFolder) {
            throw new BuildException(
                "Destination folder is not specified.",
                getChildOfObject(project.settings.build, "destinationFolder")
            );
        }
        let destinationFolderPath = ProjectStore.getAbsoluteFilePath(
            project.settings.build.destinationFolder || "."
        );
        if (!fs.existsSync(destinationFolderPath)) {
            throw new BuildException("Cannot find destination folder.");
        }

        showCheckResult();

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

var checkTransformer: (object: EezObject) => Message[] = createTransformer(
    (object: EezObject): Message[] => {
        const children = getMetaData(object)
            .properties(object)
            .filter(
                propertyMetaData =>
                    (propertyMetaData.type === "array" || propertyMetaData.type === "object") &&
                    getProperty(object, propertyMetaData.name)
            );

        const childrenMessages = children.reduce(
            (result: Message[], propertyMetaData: PropertyMetaData) => {
                const childObject = getProperty(object, propertyMetaData.name);

                let childrenMessages: Message[];
                if (isArray(childObject)) {
                    childrenMessages = asArray(childObject).reduce<Message[]>(
                        (result: Message[], object: EezObject) => {
                            return result.concat(checkTransformer(object));
                        },
                        [] as Message[]
                    );
                } else {
                    childrenMessages = checkTransformer(childObject);
                }

                return result.concat(childrenMessages);
            },
            []
        );

        return check(object).concat(childrenMessages);
    }
);

export function backgroundCheck() {
    OutputSectionsStore.setMessages(
        Section.CHECKS,
        checkTransformer(ProjectStore.projectProperties)
    );
}
