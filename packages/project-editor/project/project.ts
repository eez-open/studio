import { observable, extendObservable } from "mobx";

import { getExtensionsByCategory } from "project-editor/core/extensions";
import { loadObject, objectToJson, ProjectStore, getProperty } from "project-editor/core/store";
import {
    PropertyMetaData,
    registerMetaData,
    EezObject,
    EezArrayObject
} from "project-editor/core/metaData";
import * as output from "project-editor/core/output";

import { BuildFileEditor } from "project-editor/project/BuildFileEditor";
import { SettingsNavigation } from "project-editor/project/SettingsNavigation";

import "project-editor/project/builtInFeatures";

import { ActionProperties } from "project-editor/project/features/action/action";
import { DataItemProperties } from "project-editor/project/features/data/data";

import { MenuNavigation } from "project-editor/project/MenuNavigation";

let fs = EEZStudio.electron.remote.require("fs");

////////////////////////////////////////////////////////////////////////////////

export class BuildConfigurationProperties extends EezObject {
    @observable
    name: string;
    @observable
    description: string;
    @observable
    properties: string;

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

export const buildConfigurationMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return BuildConfigurationProperties;
    },
    className: "BuildConfiguration",
    label: (buildConfiguration: BuildConfigurationProperties) => {
        return buildConfiguration.name;
    },
    properties: () => [
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text"
        },
        {
            name: "properties",
            type: "json"
        }
    ],
    newItem: (parent: EezObject) => {
        return Promise.resolve({
            name: "Configuration"
        });
    },
    showInNavigation: true
});

////////////////////////////////////////////////////////////////////////////////

export class BuildFileProperties extends EezObject {
    @observable
    fileName: string;
    @observable
    description?: string;
    @observable
    template: string;
}

export const buildFileMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return BuildFileProperties;
    },
    className: "BuildFile",
    label: (buildFile: BuildFileProperties) => {
        return buildFile.fileName;
    },
    properties: () => [
        {
            name: "fileName",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text"
        },
        {
            name: "template",
            type: "string",
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
});

////////////////////////////////////////////////////////////////////////////////

export class BuildProperties extends EezObject {
    @observable
    configurations: EezArrayObject<BuildConfigurationProperties>;

    @observable
    files: EezArrayObject<BuildFileProperties>;

    @observable
    destinationFolder?: string;
}

export const buildMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return BuildProperties;
    },
    className: "Build",
    label: () => "Build",
    properties: () => [
        {
            name: "configurations",
            type: "array",
            typeMetaData: buildConfigurationMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "files",
            type: "array",
            typeMetaData: buildFileMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "destinationFolder",
            type: "project-relative-folder"
        }
    ],
    showInNavigation: true
});

////////////////////////////////////////////////////////////////////////////////

export class GeneralProperties extends EezObject {
    @observable
    scpiDocFolder?: string;
}

export const generalMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return GeneralProperties;
    },
    className: "General",
    label: () => "General",
    properties: () => [
        {
            name: "scpiDocFolder",
            displayName: "SCPI documentation folder",
            type: "project-relative-folder"
        }
    ],
    showInNavigation: true
});

////////////////////////////////////////////////////////////////////////////////

export class SettingsProperties extends EezObject {
    @observable
    general: GeneralProperties;
    @observable
    build: BuildProperties;
    @observable
    scpiHelpFolder?: string;
}

export const settingsMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return SettingsProperties;
    },
    className: "Settings",
    label: () => "Settings",
    properties: () => [
        {
            name: "general",
            type: "object",
            typeMetaData: generalMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "build",
            type: "object",
            typeMetaData: buildMetaData,
            hideInPropertyGrid: true
        }
    ],
    hideInProperties: true,
    navigationComponent: SettingsNavigation,
    navigationComponentId: "settings",
    icon: "settings"
});

////////////////////////////////////////////////////////////////////////////////

let numProjectFeatures = 0;
let projectProperties: PropertyMetaData[];

export class ProjectProperties extends EezObject {
    @observable
    settings: SettingsProperties;

    @observable
    data: EezArrayObject<DataItemProperties>;

    @observable
    actions: EezArrayObject<ActionProperties>;

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

export const projectMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return ProjectProperties;
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
                    type: "object",
                    typeMetaData: settingsMetaData,
                    hideInPropertyGrid: true
                }
            ];

            let projectFeatureProperties: PropertyMetaData[] = projectFeatures.map(
                projectFeature => {
                    return {
                        name: projectFeature.eezStudioExtension.implementation.projectFeature.key,
                        displayName:
                            projectFeature.eezStudioExtension.implementation.projectFeature
                                .displayName,
                        type: projectFeature.eezStudioExtension.implementation.projectFeature.type,
                        typeMetaData:
                            projectFeature.eezStudioExtension.implementation.projectFeature
                                .metaData,
                        isOptional: !projectFeature.eezStudioExtension.implementation.projectFeature
                            .mandatory,
                        hideInPropertyGrid: true,
                        check: projectFeature.eezStudioExtension.implementation.projectFeature.check
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
});

////////////////////////////////////////////////////////////////////////////////

export function getNewProject(): ProjectProperties {
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
        project as ProjectProperties,
        projectMetaData
    ) as ProjectProperties;
}

export async function load(filePath: string) {
    return new Promise<ProjectProperties>((resolve, reject) => {
        fs.readFile(filePath, "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                let projectJs = JSON.parse(data);

                let project = loadObject(
                    undefined,
                    projectJs,
                    projectMetaData
                ) as ProjectProperties;

                resolve(project);
            }
        });
    });
}

export function save(filePath: string) {
    return new Promise((resolve, reject) => {
        fs.writeFile(
            filePath,
            objectToJson(ProjectStore.projectProperties, 2),
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
