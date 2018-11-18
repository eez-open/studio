import { observable, extendObservable } from "mobx";

import { getExtensionsByCategory } from "project-editor/core/extensions";
import { loadObject, objectToJson, ProjectStore, getProperty } from "project-editor/core/store";
import {
    PropertyMetaData,
    registerMetaData,
    EezObject,
    EezArrayObject,
    PropertyType
} from "project-editor/core/metaData";
import * as output from "project-editor/core/output";

import { BuildFileEditor } from "project-editor/project/BuildFileEditor";
import { SettingsNavigation } from "project-editor/project/SettingsNavigation";

import "project-editor/project/builtInFeatures";

import { Action } from "project-editor/project/features/action/action";
import { DataItem } from "project-editor/project/features/data/data";

import { MenuNavigation } from "project-editor/project/MenuNavigation";

let fs = EEZStudio.electron.remote.require("fs");

////////////////////////////////////////////////////////////////////////////////

export class BuildConfiguration extends EezObject {
    @observable
    name: string;
    @observable
    description: string;
    @observable
    properties: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return BuildConfiguration;
        },
        className: "BuildConfiguration",
        label: (buildConfiguration: BuildConfiguration) => {
            return buildConfiguration.name;
        },
        properties: () => [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "properties",
                type: PropertyType.JSON
            }
        ],
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                name: "Configuration"
            });
        },
        showInNavigation: true
    };

    check() {
        let messages: output.Message[] = [];

        if (this.properties) {
            try {
                JSON.parse(this.properties);
            } catch (err) {
                messages.push(output.propertyInvalidValueMessage(this, "properties"));
            }
        }

        return messages;
    }
}

registerMetaData(BuildConfiguration.metaData);

////////////////////////////////////////////////////////////////////////////////

export class BuildFile extends EezObject {
    @observable
    fileName: string;
    @observable
    description?: string;
    @observable
    template: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return BuildFile;
        },
        className: "BuildFile",
        label: (buildFile: BuildFile) => {
            return buildFile.fileName;
        },
        properties: () => [
            {
                name: "fileName",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "template",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                fileName: "file",
                template: ""
            });
        },
        editorComponent: BuildFileEditor
    };
}

registerMetaData(BuildFile.metaData);

////////////////////////////////////////////////////////////////////////////////

export class Build extends EezObject {
    @observable
    configurations: EezArrayObject<BuildConfiguration>;

    @observable
    files: EezArrayObject<BuildFile>;

    @observable
    destinationFolder?: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return Build;
        },
        className: "Build",
        label: () => "Build",
        properties: () => [
            {
                name: "configurations",
                type: PropertyType.Array,
                typeMetaData: BuildConfiguration.metaData,
                hideInPropertyGrid: true
            },
            {
                name: "files",
                type: PropertyType.Array,
                typeMetaData: BuildFile.metaData,
                hideInPropertyGrid: true
            },
            {
                name: "destinationFolder",
                type: PropertyType.ProjectRelativeFolder
            }
        ],
        showInNavigation: true
    };
}

registerMetaData(Build.metaData);

////////////////////////////////////////////////////////////////////////////////

export class General extends EezObject {
    @observable
    scpiDocFolder?: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return General;
        },
        className: "General",
        label: () => "General",
        properties: () => [
            {
                name: "scpiDocFolder",
                displayName: "SCPI documentation folder",
                type: PropertyType.ProjectRelativeFolder
            }
        ],
        showInNavigation: true
    };
}

registerMetaData(General.metaData);

////////////////////////////////////////////////////////////////////////////////

export class Settings extends EezObject {
    @observable
    general: General;
    @observable
    build: Build;
    @observable
    scpiHelpFolder?: string;

    static metaData = {
        getClass: function(jsObject: any) {
            return Settings;
        },
        className: "Settings",
        label: () => "Settings",
        properties: () => [
            {
                name: "general",
                type: PropertyType.Object,
                typeMetaData: General.metaData,
                hideInPropertyGrid: true
            },
            {
                name: "build",
                type: PropertyType.Object,
                typeMetaData: Build.metaData,
                hideInPropertyGrid: true
            }
        ],
        hideInProperties: true,
        navigationComponent: SettingsNavigation,
        navigationComponentId: "settings",
        icon: "settings"
    };
}

registerMetaData(Settings.metaData);

////////////////////////////////////////////////////////////////////////////////

let numProjectFeatures = 0;
let projectProperties: PropertyMetaData[];

export class Project extends EezObject {
    @observable
    settings: Settings;

    @observable
    data: EezArrayObject<DataItem>;

    @observable
    actions: EezArrayObject<Action>;

    static metaData = {
        getClass: function(jsObject: any) {
            return Project;
        },
        className: "Project",
        label: () => "Project",
        properties: () => {
            let projectFeatures = getExtensionsByCategory("project-feature");
            if (!projectProperties || numProjectFeatures != projectFeatures.length) {
                numProjectFeatures = projectFeatures.length;

                let builtinProjectProperties: PropertyMetaData[] = [
                    {
                        name: "settings",
                        type: PropertyType.Object,
                        typeMetaData: Settings.metaData,
                        hideInPropertyGrid: true
                    }
                ];

                let projectFeatureProperties: PropertyMetaData[] = projectFeatures.map(
                    projectFeature => {
                        return {
                            name:
                                projectFeature.eezStudioExtension.implementation.projectFeature.key,
                            displayName:
                                projectFeature.eezStudioExtension.implementation.projectFeature
                                    .displayName,
                            type:
                                projectFeature.eezStudioExtension.implementation.projectFeature
                                    .type,
                            typeMetaData:
                                projectFeature.eezStudioExtension.implementation.projectFeature
                                    .metaData,
                            isOptional: !projectFeature.eezStudioExtension.implementation
                                .projectFeature.mandatory,
                            hideInPropertyGrid: true,
                            check:
                                projectFeature.eezStudioExtension.implementation.projectFeature
                                    .check
                        };
                    }
                );

                projectProperties = builtinProjectProperties.concat(projectFeatureProperties);
            }

            return projectProperties;
        },
        navigationComponent: MenuNavigation,
        navigationComponentId: "project",
        defaultNavigationKey: "settings"
    };

    callExtendObservableForAllOptionalProjectFeatures() {
        let optionalFeatures: any = {};

        this._metaData.properties(this).forEach(propertyMetaData => {
            if (propertyMetaData.isOptional && !(propertyMetaData.name in this)) {
                optionalFeatures[propertyMetaData.name] = getProperty(this, propertyMetaData.name);
            }
        });

        extendObservable(this, optionalFeatures);
    }
}

registerMetaData(Project.metaData);

////////////////////////////////////////////////////////////////////////////////

export function getNewProject(): Project {
    let project: any = {
        settings: {
            general: {},
            build: {
                configurations: [
                    {
                        name: "Default"
                    }
                ],
                files: []
            }
        }
    };

    return loadObject(
        undefined,
        project as Project,
        Project.metaData
    ) as Project;
}

export async function load(filePath: string) {
    return new Promise<Project>((resolve, reject) => {
        fs.readFile(filePath, "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                let projectJs = JSON.parse(data);

                let project = loadObject(
                    undefined,
                    projectJs,
                    Project.metaData
                ) as Project;

                resolve(project);
            }
        });
    });
}

export function save(filePath: string) {
    return new Promise((resolve, reject) => {
        fs.writeFile(
            filePath,
            objectToJson(ProjectStore.project, 2),
            "utf8",
            (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}
