import { createTransformer } from "mobx-utils";

import { formatNumber } from "eez-studio-shared/util";
import {
    writeTextFile,
    writeBinaryData
} from "eez-studio-shared/util-electron";
import { _map } from "eez-studio-shared/algorithm";
import { underscore } from "eez-studio-shared/string";

import {
    getProjectFeatures,
    BuildResult
} from "project-editor/core/extensions";
import {
    IEezObject,
    isArray,
    getProperty,
    IMessage,
    getArrayAndObjectProperties,
    getPropertyInfo,
    getClassInfo
} from "project-editor/core/object";
import { Section, Type } from "project-editor/core/output";
import { DocumentStoreClass } from "project-editor/core/store";

import { BuildConfiguration, getProject } from "project-editor/project/project";
import {
    extensionDefinitionAnythingToBuild,
    extensionDefinitionBuild
} from "project-editor/features/extension-definitions/build";

////////////////////////////////////////////////////////////////////////////////

export const TAB = "    ";

////////////////////////////////////////////////////////////////////////////////

export enum NamingConvention {
    UnderscoreUpperCase,
    UnderscoreLowerCase
}

export function getName<
    T extends {
        name: string;
    }
>(
    prefix: string,
    objectOrName: T | string,
    namingConvention: NamingConvention
) {
    let name;
    if (typeof objectOrName == "string") {
        name = objectOrName;
    } else {
        const project = getProject(objectOrName);
        name = project.namespace
            ? project.namespace + "_" + objectOrName.name
            : objectOrName.name;
    }
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
    const NUMBERS_PER_LINE = 16;
    let result = "";
    _map(data, value => "0x" + formatNumber(value, 16, 2)).forEach(
        (value, index) => {
            if (result.length > 0) {
                result += ",";
            }
            if (index % NUMBERS_PER_LINE == 0) {
                result += "\n" + TAB;
            } else {
                result += " ";
            }
            result += value;
        }
    );
    result += "\n";
    return result;
}

////////////////////////////////////////////////////////////////////////////////

function showCheckResult(DocumentStore: DocumentStoreClass) {
    const OutputSections = DocumentStore.OutputSectionsStore;

    let outputSection = OutputSections.getSection(Section.OUTPUT);

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

    OutputSections.write(Section.OUTPUT, Type.INFO, checkResultMassage);
}

class BuildException {
    constructor(
        public message: string,
        public object?: IEezObject | undefined
    ) {}
}

async function getBuildResults(
    DocumentStore: DocumentStoreClass,
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined
) {
    const project = DocumentStore.project;

    let buildResults: BuildResult[] = [];

    let projectFeatures = getProjectFeatures();
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.eezStudioExtension.implementation.projectFeature
                .build &&
            getProperty(
                project,
                projectFeature.eezStudioExtension.implementation.projectFeature
                    .key
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

function getSectionNames(DocumentStore: DocumentStoreClass): string[] {
    if (DocumentStore.masterProject) {
        return ["GUI_ASSETS_DATA", "GUI_ASSETS_DATA_MAP"];
    }

    const project = DocumentStore.project;

    const sectionNames: string[] = [];

    project.settings.build.files.forEach(buildFile => {
        let result;
        while (
            (result = sectionNamesRegexp.exec(buildFile.template)) !== null
        ) {
            sectionNames.push(result[1]);
        }
    });

    return sectionNames;
}

async function generateFile(
    DocumentStore: DocumentStoreClass,
    buildResults: BuildResult[],
    template: string | undefined,
    filePath: string
) {
    let parts: any = {};
    for (const buildResult of buildResults) {
        parts = Object.assign(parts, buildResult);
    }

    if (template) {
        let buildFileContent = template.replace(
            sectionNamesRegexp,
            (_1, part) => {
                return parts[part];
            }
        );

        await writeTextFile(filePath, buildFileContent);
    } else {
        await writeBinaryData(filePath, parts["GUI_ASSETS_DATA"]);
        if (parts["GUI_ASSETS_DATA_MAP"]) {
            await writeBinaryData(
                filePath + ".map",
                parts["GUI_ASSETS_DATA_MAP"]
            );

            DocumentStore.OutputSectionsStore.write(
                Section.OUTPUT,
                Type.INFO,
                `File "${filePath}.map" builded`
            );
        }
    }

    DocumentStore.OutputSectionsStore.write(
        Section.OUTPUT,
        Type.INFO,
        `File "${filePath}" builded`
    );
}

async function generateFiles(
    DocumentStore: DocumentStoreClass,
    destinationFolderPath: string,
    configurationBuildResults: {
        [configurationName: string]: BuildResult[];
    }
) {
    const path = EEZStudio.remote.require("path");

    if (DocumentStore.masterProject) {
        generateFile(
            DocumentStore,
            configurationBuildResults[
                DocumentStore.selectedBuildConfiguration
                    ? DocumentStore.selectedBuildConfiguration.name
                    : "default"
            ],
            undefined,
            destinationFolderPath +
                "/" +
                path.basename(DocumentStore.filePath, ".eez-project") +
                (DocumentStore.isAppletProject ? ".app" : ".res")
        );
    } else {
        const build = DocumentStore.project.settings.build;

        for (const buildFile of build.files) {
            if (buildFile.fileName.indexOf("<configuration>") !== -1) {
                for (const configuration of build.configurations) {
                    try {
                        await generateFile(
                            DocumentStore,
                            configurationBuildResults[configuration.name],
                            buildFile.template,
                            destinationFolderPath +
                                "/" +
                                buildFile.fileName.replace(
                                    "<configuration>",
                                    configuration.name
                                )
                        );
                    } catch (err) {
                        await new Promise(resolve => setTimeout(resolve, 10));

                        await generateFile(
                            DocumentStore,
                            configurationBuildResults[configuration.name],
                            buildFile.template,
                            destinationFolderPath +
                                "/" +
                                buildFile.fileName.replace(
                                    "<configuration>",
                                    configuration.name
                                )
                        );
                    }
                }
            } else {
                generateFile(
                    DocumentStore,
                    configurationBuildResults[
                        DocumentStore.selectedBuildConfiguration
                            ? DocumentStore.selectedBuildConfiguration.name
                            : "default"
                    ],
                    buildFile.template,
                    destinationFolderPath + "/" + buildFile.fileName
                );
            }
        }
    }
}

function anythingToBuild(DocumentStore: DocumentStoreClass) {
    return (
        DocumentStore.project.settings.build.files.length > 0 ||
        DocumentStore.masterProject
    );
}

export async function build(
    DocumentStore: DocumentStoreClass,
    { onlyCheck }: { onlyCheck: boolean }
) {
    const timeStart = new Date().getTime();

    const OutputSections = DocumentStore.OutputSectionsStore;

    OutputSections.setActiveSection(Section.OUTPUT);
    OutputSections.clear(Section.OUTPUT);

    if (!anythingToBuild(DocumentStore)) {
        OutputSections.write(Section.OUTPUT, Type.INFO, `Nothing to build!`);
        return;
    }

    OutputSections.setLoading(Section.OUTPUT, true);

    // give some time for loader to start
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        let sectionNames: string[] | undefined = undefined;

        let destinationFolderPath;
        if (!onlyCheck) {
            destinationFolderPath = DocumentStore.getAbsoluteFilePath(
                DocumentStore.project.settings.build.destinationFolder || "."
            );
            const fs = EEZStudio.remote.require("fs");
            if (!fs.existsSync(destinationFolderPath)) {
                throw new BuildException("Cannot find destination folder.");
            }

            sectionNames = getSectionNames(DocumentStore);
        }

        let configurationBuildResuts: {
            [configurationName: string]: BuildResult[];
        } = {};

        if (
            DocumentStore.project.settings.general.projectVersion !== "v1" &&
            DocumentStore.project.settings.build.configurations.length > 0 &&
            !DocumentStore.masterProject
        ) {
            for (const configuration of DocumentStore.project.settings.build
                .configurations) {
                OutputSections.write(
                    Section.OUTPUT,
                    Type.INFO,
                    `Building ${configuration.name} configuration`
                );
                configurationBuildResuts[configuration.name] =
                    await getBuildResults(
                        DocumentStore,
                        sectionNames,
                        configuration
                    );
            }
        } else {
            const selectedBuildConfiguration =
                DocumentStore.selectedBuildConfiguration ||
                DocumentStore.project.settings.build.configurations[0];
            if (selectedBuildConfiguration) {
                OutputSections.write(
                    Section.OUTPUT,
                    Type.INFO,
                    `Building ${selectedBuildConfiguration.name} configuration`
                );
                configurationBuildResuts[selectedBuildConfiguration.name] =
                    await getBuildResults(
                        DocumentStore,
                        sectionNames,
                        selectedBuildConfiguration
                    );
            } else {
                configurationBuildResuts["default"] = await getBuildResults(
                    DocumentStore,
                    sectionNames,
                    undefined
                );
            }
        }

        showCheckResult(DocumentStore);

        if (onlyCheck) {
            return;
        }

        await generateFiles(
            DocumentStore,
            destinationFolderPath,
            configurationBuildResuts
        );

        OutputSections.write(
            Section.OUTPUT,
            Type.INFO,
            `Build duration: ${
                (new Date().getTime() - timeStart) / 1000
            } seconds`
        );

        OutputSections.write(
            Section.OUTPUT,
            Type.INFO,
            `Build successfully finished at ${new Date().toLocaleString()}`
        );
    } finally {
        // catch (err) {
        //     if (err instanceof BuildException) {
        //         OutputSections.write(
        //             Section.OUTPUT,
        //             Type.ERROR,
        //             err.message,
        //             err.object
        //         );
        //     } else {
        //         OutputSections.write(
        //             Section.OUTPUT,
        //             Type.ERROR,
        //             `Module build error: ${err}`
        //         );
        //     }

        //     showCheckResult(DocumentStore);
        // }
        OutputSections.setLoading(Section.OUTPUT, false);
    }
}

export async function buildExtensions(DocumentStore: DocumentStoreClass) {
    const timeStart = new Date().getTime();

    const OutputSections = DocumentStore.OutputSectionsStore;

    OutputSections.setActiveSection(Section.OUTPUT);
    OutputSections.clear(Section.OUTPUT);

    if (!extensionDefinitionAnythingToBuild(DocumentStore)) {
        OutputSections.write(Section.OUTPUT, Type.INFO, `Nothing to build!`);
        return;
    }

    OutputSections.setLoading(Section.OUTPUT, true);

    // give some time for loader to start
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        let destinationFolderPath = DocumentStore.getAbsoluteFilePath(
            DocumentStore.project.settings.build.destinationFolder || "."
        );
        const fs = EEZStudio.remote.require("fs");
        if (!fs.existsSync(destinationFolderPath)) {
            throw new BuildException("Cannot find destination folder.");
        }

        showCheckResult(DocumentStore);

        await extensionDefinitionBuild(DocumentStore);

        OutputSections.write(
            Section.OUTPUT,
            Type.INFO,
            `Build duration: ${
                (new Date().getTime() - timeStart) / 1000
            } seconds`
        );

        OutputSections.write(
            Section.OUTPUT,
            Type.INFO,
            `Build successfully finished at ${new Date().toLocaleString()}`
        );
    } finally {
        // catch (err) {
        //     if (err instanceof BuildException) {
        //         OutputSections.write(
        //             Section.OUTPUT,
        //             Type.ERROR,
        //             err.message,
        //             err.object
        //         );
        //     } else {
        //         OutputSections.write(
        //             Section.OUTPUT,
        //             Type.ERROR,
        //             `Module build error: ${err}`
        //         );
        //     }

        //     showCheckResult(DocumentStore);
        // }
        OutputSections.setLoading(Section.OUTPUT, false);
    }
}

////////////////////////////////////////////////////////////////////////////////

var checkTransformer: (object: IEezObject) => IMessage[] = createTransformer(
    (object: IEezObject): IMessage[] => {
        let messages: IMessage[] = [];

        // call check method of the object
        if (!isArray(object)) {
            const classCheckMethod = getClassInfo(object).check;
            if (classCheckMethod) {
                messages = messages.concat(classCheckMethod(object));
            }
        }

        // call check from property definition
        const propertyCheckMethod =
            getPropertyInfo(object) && getPropertyInfo(object).check;
        if (propertyCheckMethod) {
            messages = messages.concat(propertyCheckMethod(object));
        }

        if (isArray(object)) {
            // check array elements
            for (const childObject of object) {
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

let setMessagesTimeoutId: any;

export function backgroundCheck(DocumentStore: DocumentStoreClass) {
    //console.time("backgroundCheck");

    const messages = checkTransformer(DocumentStore.project);

    if (setMessagesTimeoutId) {
        clearTimeout(setMessagesTimeoutId);
    }

    setMessagesTimeoutId = setTimeout(() => {
        DocumentStore.OutputSectionsStore.setMessages(Section.CHECKS, messages);
    }, 100);

    //console.timeEnd("backgroundCheck");
}
