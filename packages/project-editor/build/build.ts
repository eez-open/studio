import path from "path";
import fs from "fs";
import { createTransformer } from "mobx-utils";

import {
    writeTextFile,
    writeBinaryData,
    makeFolder
} from "eez-studio-shared/util-electron";

import type { BuildResult } from "project-editor/store/features";
import {
    IEezObject,
    IMessage,
    getPropertyInfo,
    MessageType
} from "project-editor/core/object";
import {
    ProjectStore,
    isEezObjectArray,
    getArrayAndObjectProperties,
    getClassInfo,
    Section,
    getJSON,
    Message,
    getLabel
} from "project-editor/store";

import type { BuildConfiguration } from "project-editor/project/project";
import {
    extensionDefinitionAnythingToBuild,
    extensionDefinitionBuild
} from "project-editor/features/extension-definitions/build";

import { buildAssets } from "project-editor/build/assets";
import { buildScpi } from "project-editor/build/scpi";
import { generateSourceCodeForEezFramework } from "project-editor/lvgl/build";

////////////////////////////////////////////////////////////////////////////////

function showCheckResult(projectStore: ProjectStore) {
    const OutputSections = projectStore.outputSectionsStore;

    let outputSection = OutputSections.getSection(Section.OUTPUT);

    let checkResultMassage: string;

    if (outputSection.numErrors == 0) {
        checkResultMassage = "No error";
    } else if (outputSection.numErrors == 1) {
        checkResultMassage = "1 error";
    } else {
        checkResultMassage = `${outputSection.numErrors} errors`;
    }

    checkResultMassage += " and";

    if (outputSection.numWarnings == 0) {
        checkResultMassage += " no warning";
    } else if (outputSection.numWarnings == 1) {
        checkResultMassage += " 1 warning";
    } else {
        checkResultMassage += ` ${outputSection.numWarnings} warnings`;
    }

    checkResultMassage += " detected";

    OutputSections.write(Section.OUTPUT, MessageType.INFO, checkResultMassage);
}

class BuildException {
    constructor(
        public message: string,
        public object?: IEezObject | undefined
    ) {}
}

async function getBuildResults(
    projectStore: ProjectStore,
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined,
    option: "check" | "buildAssets" | "buildFiles"
) {
    const project = projectStore.project;

    let buildResults: BuildResult[] = [];

    buildResults.push(
        await buildAssets(project, sectionNames, buildConfiguration, option)
    );

    if (project.scpi) {
        buildResults.push(
            await buildScpi(project, sectionNames, buildConfiguration)
        );
    }

    return buildResults;
}

const sectionNamesRegexp = /\/\/\$\{eez-studio (\w*)\s*(\w*)\}/g;

function getSectionNames(projectStore: ProjectStore): string[] {
    if (projectStore.masterProject) {
        return ["GUI_ASSETS_DATA", "GUI_ASSETS_DATA_MAP"];
    }

    const project = projectStore.project;

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
    projectStore: ProjectStore,
    configurationBuildResults: {
        [configurationName: string]: BuildResult[];
    },
    defaultConfigurationName: string,
    template: string | undefined,
    filePath: string
): Promise<any> {
    let parts: any;

    if (template != undefined) {
        let buildFileContent = template.replace(
            sectionNamesRegexp,
            (_1, part, configurationName) => {
                const buildResults =
                    configurationBuildResults[
                        configurationName || defaultConfigurationName
                    ];

                parts = {};
                for (const buildResult of buildResults) {
                    parts = Object.assign(parts, buildResult);
                }

                return parts[part];
            }
        );

        await writeTextFile(filePath, buildFileContent);
    } else {
        const buildResults =
            configurationBuildResults[defaultConfigurationName];

        parts = {};
        for (const buildResult of buildResults) {
            parts = Object.assign(parts, buildResult);
        }

        await writeBinaryData(filePath, parts["GUI_ASSETS_DATA"]);
        if (parts["GUI_ASSETS_DATA_MAP"]) {
            await writeBinaryData(
                filePath + ".map",
                parts["GUI_ASSETS_DATA_MAP"]
            );

            projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.INFO,
                `File "${filePath}.map" built`
            );
        }
    }

    projectStore.outputSectionsStore.write(
        Section.OUTPUT,
        MessageType.INFO,
        `File "${filePath}" built`
    );

    return parts;
}

async function generateFiles(
    projectStore: ProjectStore,
    destinationFolderPath: string,
    configurationBuildResults: {
        [configurationName: string]: BuildResult[];
    }
) {
    let parts: any = undefined;

    const project = projectStore.project;

    if (projectStore.masterProject) {
        parts = generateFile(
            projectStore,
            configurationBuildResults,
            projectStore.selectedBuildConfiguration
                ? projectStore.selectedBuildConfiguration.name
                : "default",
            undefined,
            destinationFolderPath +
                "/" +
                path.basename(projectStore.filePath || "", ".eez-project") +
                (project.projectTypeTraits.isApplet ? ".app" : ".res")
        );

        if (project.projectTypeTraits.isResource && project.micropython) {
            await writeTextFile(
                destinationFolderPath +
                    "/" +
                    path.basename(projectStore.filePath || "", ".eez-project") +
                    ".py",
                project.micropython.code
            );
        }
    } else {
        const build = project.settings.build;

        for (const buildFile of build.files) {
            if (buildFile.fileName.indexOf("<configuration>") !== -1) {
                for (const configuration of build.configurations) {
                    try {
                        parts = await generateFile(
                            projectStore,
                            configurationBuildResults,
                            configuration.name,
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

                        parts = await generateFile(
                            projectStore,
                            configurationBuildResults,
                            configuration.name,
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
                parts = generateFile(
                    projectStore,
                    configurationBuildResults,
                    projectStore.selectedBuildConfiguration
                        ? projectStore.selectedBuildConfiguration.name
                        : "default",
                    buildFile.template,
                    destinationFolderPath + "/" + buildFile.fileName
                );
            }
        }
    }

    return parts;
}

function anythingToBuild(projectStore: ProjectStore) {
    const project = projectStore.project;
    return (
        project.settings.build.files.length > 0 ||
        projectStore.masterProject ||
        project.projectTypeTraits.isDashboard ||
        project.projectTypeTraits.isLVGL
    );
}

export async function build(
    projectStore: ProjectStore,
    option: "check" | "buildAssets" | "buildFiles"
) {
    const timeStart = new Date().getTime();

    const OutputSections = projectStore.outputSectionsStore;

    OutputSections.clear(Section.OUTPUT);

    if (!anythingToBuild(projectStore)) {
        OutputSections.write(
            Section.OUTPUT,
            MessageType.INFO,
            `Nothing to build!`
        );
        return undefined;
    }

    OutputSections.setLoading(Section.OUTPUT, true);

    // give some time for loader to start
    await new Promise(resolve => setTimeout(resolve, 50));

    let parts: any = undefined;

    const project = projectStore.project;

    try {
        let sectionNames: string[] | undefined = undefined;

        let destinationFolderPath;
        if (option == "buildFiles") {
            destinationFolderPath = projectStore.getAbsoluteFilePath(
                project.settings.build.destinationFolder || "."
            );

            if (!fs.existsSync(destinationFolderPath)) {
                await makeFolder(destinationFolderPath);
            }

            if (!project.projectTypeTraits.isDashboard) {
                sectionNames = getSectionNames(projectStore);
            }
        }

        let configurationBuildResults: {
            [configurationName: string]: BuildResult[];
        } = {};

        if (
            project.settings.general.projectVersion !== "v1" &&
            project.settings.build.configurations.length > 0 &&
            !projectStore.masterProject
        ) {
            for (const configuration of project.settings.build.configurations) {
                OutputSections.openGroup(
                    Section.OUTPUT,
                    `Configuration: ${configuration.name}`
                );

                try {
                    configurationBuildResults[configuration.name] =
                        await getBuildResults(
                            projectStore,
                            sectionNames,
                            configuration,
                            option
                        );
                } finally {
                    OutputSections.closeGroup(Section.OUTPUT, false);
                }
            }
        } else {
            const selectedBuildConfiguration =
                projectStore.selectedBuildConfiguration ||
                project.settings.build.configurations[0];
            if (selectedBuildConfiguration) {
                OutputSections.openGroup(
                    Section.OUTPUT,
                    `Configuration: ${selectedBuildConfiguration.name}`
                );
                try {
                    configurationBuildResults[selectedBuildConfiguration.name] =
                        await getBuildResults(
                            projectStore,
                            sectionNames,
                            selectedBuildConfiguration,
                            option
                        );
                } finally {
                    OutputSections.closeGroup(Section.OUTPUT, false);
                }
            } else {
                configurationBuildResults["default"] = await getBuildResults(
                    projectStore,
                    sectionNames,
                    undefined,
                    option
                );
            }
        }

        showCheckResult(projectStore);

        if (option == "check") {
            return undefined;
        }

        if (option == "buildAssets") {
            const defaultConfiguration =
                project.settings.build.configurations[0];
            const buildResults =
                configurationBuildResults[defaultConfiguration.name];

            parts = {};
            for (const buildResult of buildResults) {
                parts = Object.assign(parts, buildResult);
            }

            OutputSections.write(
                Section.OUTPUT,
                MessageType.INFO,
                `Build duration: ${
                    (new Date().getTime() - timeStart) / 1000
                } seconds`
            );

            OutputSections.write(
                Section.OUTPUT,
                MessageType.INFO,
                `Build successfully finished at ${new Date().toLocaleString()}`
            );

            return parts;
        }

        if (!project.projectTypeTraits.isDashboard) {
            parts = await generateFiles(
                projectStore,
                destinationFolderPath || "",
                configurationBuildResults
            );

            if (project.projectTypeTraits.isLVGL) {
                await generateSourceCodeForEezFramework(
                    project,
                    destinationFolderPath || "",
                    configurationBuildResults["Default"]?.[0]?.[
                        "EEZ_FLOW_IS_USING_CRYPTO_SHA256"
                    ] as any as boolean
                );
            }
        } else {
            const baseName = path.basename(
                projectStore.filePath || "",
                ".eez-project"
            );

            const destinationFilePath =
                destinationFolderPath + "/" + baseName + ".eez-dashboard";

            const archiver = await import("archiver");

            await new Promise<void>((resolve, reject) => {
                var archive = archiver.default("zip", {
                    zlib: {
                        level: 9
                    }
                });

                var output = fs.createWriteStream(destinationFilePath);

                output.on("close", function () {
                    resolve();
                });

                archive.on("warning", function (err: any) {
                    reject(err);
                });

                archive.on("error", function (err: any) {
                    reject(err);
                });

                archive.pipe(output);

                const json = getJSON(projectStore, 0);
                archive.append(json, { name: baseName + ".eez-project" });

                archive.finalize();
            });

            {
                const destinationFilePath =
                    destinationFolderPath +
                    "/" +
                    baseName +
                    ".eez-project-build";

                const defaultConfiguration =
                    project.settings.build.configurations[0];
                const buildResults =
                    configurationBuildResults[defaultConfiguration.name];

                parts = {};
                for (const buildResult of buildResults) {
                    parts = Object.assign(parts, buildResult);
                }

                fs.writeFileSync(
                    destinationFilePath,
                    JSON.stringify({
                        GUI_ASSETS_DATA_MAP_JS: parts.GUI_ASSETS_DATA_MAP_JS,
                        GUI_ASSETS_DATA:
                            parts.GUI_ASSETS_DATA.toString("base64")
                    }),
                    "utf8"
                );
            }
        }

        OutputSections.write(
            Section.OUTPUT,
            MessageType.INFO,
            `Build duration: ${
                (new Date().getTime() - timeStart) / 1000
            } seconds`
        );

        OutputSections.write(
            Section.OUTPUT,
            MessageType.INFO,
            `Build successfully finished at ${new Date().toLocaleString()}`
        );
    } catch (err) {
        console.error(err);
        if (err instanceof BuildException) {
            OutputSections.write(
                Section.OUTPUT,
                MessageType.ERROR,
                err.message,
                err.object
            );
        } else {
            OutputSections.write(
                Section.OUTPUT,
                MessageType.ERROR,
                `Module build error: ${err}`
            );
        }

        showCheckResult(projectStore);
    } finally {
        OutputSections.setLoading(Section.OUTPUT, false);
    }

    return parts;
}

export async function buildExtensions(projectStore: ProjectStore) {
    const timeStart = new Date().getTime();

    const OutputSections = projectStore.outputSectionsStore;

    OutputSections.clear(Section.OUTPUT);

    if (!extensionDefinitionAnythingToBuild(projectStore)) {
        OutputSections.write(
            Section.OUTPUT,
            MessageType.INFO,
            `Nothing to build!`
        );
        return [];
    }

    OutputSections.setLoading(Section.OUTPUT, true);

    // give some time for loader to start
    await new Promise(resolve => setTimeout(resolve, 50));

    const project = projectStore.project;

    let extensionFilePaths: string[] = [];

    try {
        let destinationFolderPath = projectStore.getAbsoluteFilePath(
            project.settings.build.destinationFolder || "."
        );
        if (!fs.existsSync(destinationFolderPath)) {
            throw new BuildException("Cannot find destination folder.");
        }

        showCheckResult(projectStore);

        extensionFilePaths = await extensionDefinitionBuild(projectStore);

        OutputSections.write(
            Section.OUTPUT,
            MessageType.INFO,
            `Build duration: ${
                (new Date().getTime() - timeStart) / 1000
            } seconds`
        );

        OutputSections.write(
            Section.OUTPUT,
            MessageType.INFO,
            `Build successfully finished at ${new Date().toLocaleString()}`
        );
    } catch (err) {
        console.error(err);

        if (err instanceof BuildException) {
            OutputSections.write(
                Section.OUTPUT,
                MessageType.ERROR,
                err.message,
                err.object
            );
        } else {
            OutputSections.write(
                Section.OUTPUT,
                MessageType.ERROR,
                `Module build error: ${err}`
            );
        }

        showCheckResult(projectStore);
    } finally {
        OutputSections.setLoading(Section.OUTPUT, false);
    }

    return extensionFilePaths;
}

////////////////////////////////////////////////////////////////////////////////

var checkTransformer: (object: IEezObject) => IMessage[] = createTransformer(
    (object: IEezObject): IMessage[] => {
        let messages: IMessage[] = [];

        // call check method of the object
        if (!isEezObjectArray(object)) {
            const classCheckMethod = getClassInfo(object).check;
            if (classCheckMethod) {
                classCheckMethod(object, messages);
            }
        }

        // call check from property definition
        const propertyCheckMethod =
            getPropertyInfo(object) && getPropertyInfo(object).check;
        if (propertyCheckMethod) {
            propertyCheckMethod(object, messages);
        }

        if (isEezObjectArray(object)) {
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

        if (messages.length == 0) {
            return messages;
        }

        return [
            new Message(
                MessageType.GROUP,
                getLabel(object),
                object,
                messages as Message[]
            )
        ];
    }
);

let setMessagesTimeoutId: any;

export function backgroundCheck(projectStore: ProjectStore) {
    // console.time("backgroundCheck");

    projectStore.outputSectionsStore.setLoading(Section.CHECKS, true);

    const messages = checkTransformer(projectStore.project);

    if (setMessagesTimeoutId) {
        clearTimeout(setMessagesTimeoutId);
    }

    setMessagesTimeoutId = setTimeout(() => {
        projectStore.outputSectionsStore.setMessages(
            Section.CHECKS,
            messages.length == 1 ? messages[0].messages! : messages
        );
        projectStore.outputSectionsStore.setLoading(Section.CHECKS, false);
    }, 100);

    // console.timeEnd("backgroundCheck");
}
