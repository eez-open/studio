import { IEezObject, EezClass, PropertyType } from "project-editor/core/object";
import { Message } from "project-editor/core/output";
import { Project, BuildConfiguration } from "project-editor/project/project";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

export type BuildResult = { [key: string]: string };

interface ExtensionImplementation {
    projectFeature: {
        mandatory: boolean;
        key: string;
        displayName?: string;
        type: PropertyType;
        typeClass: EezClass;
        icon: string;
        create: () => any;
        check?: (object: IEezObject) => Message[];
        build?: (
            project: Project,
            sectionNames: string[] | undefined,
            buildConfiguration: BuildConfiguration | undefined
        ) => Promise<BuildResult>;
        collectExtensionDefinitions?: (
            project: Project,
            extensionDefinition: ExtensionDefinition,
            properties: any
        ) => void;
        metrics?: (project: Project) => { [key: string]: string | number };
        toJsHook?: (jsObject: any) => void;
    };
}

type Category = "project-feature";

export interface Extension {
    name: string;
    version: string;
    description: string;
    author: string;
    authorLogo: string;
    eezStudioExtension: {
        displayName: string;
        category: Category;
        implementation: ExtensionImplementation;
    };
}

////////////////////////////////////////////////////////////////////////////////

let implementations = new Map<string, ExtensionImplementation>();
let mapCategoryToExtensions = new Map<string, Extension[]>();

////////////////////////////////////////////////////////////////////////////////

export function registerExtensionImplementation(
    url: string,
    implementation: ExtensionImplementation
) {
    implementations.set(url, implementation);
}

export function registerFeatureImplementation(
    featureName: string,
    implementation: ExtensionImplementation
) {
    implementations.set("eez-studio://project/features/" + featureName, implementation);
}

export function loadExtensions(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let totalExtensions = 0;
        let numLoaded = 0;

        function sortExtensions() {
            // sort project-feature extensions such that mandatory extensions are before optional extensions
            var extensions = mapCategoryToExtensions.get("project-feature");
            if (extensions) {
                mapCategoryToExtensions.set(
                    "project-feature",
                    extensions.sort((a, b) => {
                        var aMandatory =
                            a.eezStudioExtension.implementation.projectFeature.mandatory;
                        var bMandatory =
                            b.eezStudioExtension.implementation.projectFeature.mandatory;
                        if (aMandatory && !bMandatory) {
                            return -1;
                        } else if (!aMandatory && bMandatory) {
                            return 1;
                        }
                        return a.name.localeCompare(b.name);
                    })
                );
            }
        }

        function loadExtensionFinished(extension?: Extension) {
            numLoaded++;

            if (extension) {
                var categoryExtensions = mapCategoryToExtensions.get(
                    extension.eezStudioExtension.category
                );
                if (!categoryExtensions) {
                    categoryExtensions = [];
                    mapCategoryToExtensions.set(
                        extension.eezStudioExtension.category,
                        categoryExtensions
                    );
                }
                categoryExtensions.push(extension);
            }

            if (numLoaded == totalExtensions) {
                sortExtensions();
                resolve();
            }
        }

        function loadExtensionFolder(folder: string) {
            const fs = EEZStudio.electron.remote.require("fs");
            const path = EEZStudio.electron.remote.require("path");

            totalExtensions++;

            fs.stat(folder, function (err: any, stats: any) {
                if (err) {
                    console.error(err);
                    loadExtensionFinished();
                } else if (stats.isDirectory) {
                    fs.readFile(path.join(folder, "package.json"), "utf-8", function (
                        err: any,
                        data: any
                    ) {
                        if (err) {
                            console.error(err);
                            loadExtensionFinished();
                        } else {
                            let extension = JSON.parse(data);
                            if (extension.eezStudioExtension) {
                                extension.eezStudioExtension.implementation = implementations.get(
                                    extension.eezStudioExtension.implementation
                                );
                                loadExtensionFinished(extension as Extension);
                            }
                        }
                    });
                } else {
                    loadExtensionFinished();
                }
            });
        }

        function processExtensionsFolder(folder: string, files: string[]) {
            const path = EEZStudio.electron.remote.require("path");
            for (let file of files) {
                loadExtensionFolder(path.join(folder, file));
            }
        }

        const fs = EEZStudio.electron.remote.require("fs");

        let extensionsFolder = __dirname + "/../features";
        fs.readdir(extensionsFolder, function (err: any, files: any) {
            if (err) {
                reject("Failed to load extensions!");
            } else {
                processExtensionsFolder(extensionsFolder, files);
            }
        });
    });
}

export function getExtensionsByCategory(category: Category) {
    return mapCategoryToExtensions.get(category) || [];
}
