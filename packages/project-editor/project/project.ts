import { observable, computed, extendObservable } from "mobx";
import * as mobx from "mobx";

import { getExtensionsByCategory } from "project-editor/core/extensions";
import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    IEezObject,
    EezObject,
    EezArrayObject,
    PropertyType,
    getProperty,
    getClassInfo
} from "project-editor/core/object";
import { loadObject, objectToJson } from "project-editor/core/serialization";
import * as output from "project-editor/core/output";

import { ProjectStore } from "project-editor/core/store";

import { SettingsNavigation } from "project-editor/project/SettingsNavigation";

import "project-editor/project/builtInFeatures";

import { Action } from "project-editor/features/action/action";
import { DataItem } from "project-editor/features/data/data";

import { MenuNavigation } from "project-editor/components/MenuNavigation";

////////////////////////////////////////////////////////////////////////////////

export class BuildConfiguration extends EezObject {
    @observable
    name: string;
    @observable
    description: string;
    @observable
    properties: string;
    @observable
    screenOrientation: "landscape" | "portrait";

    static classInfo: ClassInfo = {
        properties: [
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
            },
            {
                name: "screenOrientation",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "landscape"
                    },
                    {
                        id: "portrait"
                    }
                ]
            }
        ],
        newItem: (parent: IEezObject) => {
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

registerClass(BuildConfiguration);

////////////////////////////////////////////////////////////////////////////////

export class BuildFile extends EezObject {
    @observable fileName: string;
    @observable description?: string;
    @observable template: string;

    static classInfo: ClassInfo = {
        label: (buildFile: BuildFile) => {
            return buildFile.fileName;
        },
        properties: [
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
        newItem: (parent: IEezObject) => {
            return Promise.resolve({
                fileName: "file",
                template: ""
            });
        },
        showInNavigation: true
    };
}

registerClass(BuildFile);

////////////////////////////////////////////////////////////////////////////////

function isFilesPropertyEnumerable() {
    return (
        (ProjectStore.project as any).gui ||
        ProjectStore.project.actions ||
        ProjectStore.project.data
    );
}

export class Build extends EezObject {
    @observable
    configurations: EezArrayObject<BuildConfiguration>;

    @observable
    files: EezArrayObject<BuildFile>;

    @observable
    destinationFolder?: string;

    static classInfo: ClassInfo = {
        label: () => "Build",
        properties: [
            {
                name: "configurations",
                type: PropertyType.Array,
                typeClass: BuildConfiguration,
                hideInPropertyGrid: true,
                showOnlyChildrenInTree: false
            },
            {
                name: "files",
                type: PropertyType.Array,
                typeClass: BuildFile,
                hideInPropertyGrid: true,
                enumerable: isFilesPropertyEnumerable
            },
            {
                name: "destinationFolder",
                type: PropertyType.RelativeFolder
            }
        ],
        showInNavigation: true
    };
}

registerClass(Build);

////////////////////////////////////////////////////////////////////////////////

export class General extends EezObject {
    @observable
    projectVersion: "v1" | "v2";

    @observable
    scpiDocFolder?: string;

    @observable
    masterProject: string;

    static classInfo: ClassInfo = {
        label: () => "General",
        properties: [
            {
                name: "projectVersion",
                type: PropertyType.Enum,
                enumItems: [{ id: "v1" }, { id: "v2" }]
            },
            {
                name: "scpiDocFolder",
                displayName: "SCPI documentation folder",
                type: PropertyType.RelativeFolder,
                hideInPropertyGrid: () => !(ProjectStore.project as any).scpi
            },
            {
                name: "masterProject",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            }
        ],
        showInNavigation: true
    };
}

registerClass(General);

////////////////////////////////////////////////////////////////////////////////

export class Settings extends EezObject {
    @observable general: General;
    @observable build: Build;
    @observable scpiHelpFolder?: string;

    static classInfo: ClassInfo = {
        label: () => "Settings",
        properties: [
            {
                name: "general",
                type: PropertyType.Object,
                typeClass: General,
                hideInPropertyGrid: true
            },
            {
                name: "build",
                type: PropertyType.Object,
                typeClass: Build,
                hideInPropertyGrid: true,
                enumerable: (object: IEezObject, propertyInfo: PropertyInfo) => {
                    return !ProjectStore.masterProjectEnabled;
                }
            }
        ],
        hideInProperties: true,
        navigationComponent: SettingsNavigation,
        navigationComponentId: "settings",
        icon: "settings"
    };
}

registerClass(Settings);

////////////////////////////////////////////////////////////////////////////////

let projectClassInfo: ClassInfo;
let numProjectFeatures = 0;
let builtinProjectProperties: PropertyInfo[] = [
    {
        name: "settings",
        type: PropertyType.Object,
        typeClass: Settings,
        hideInPropertyGrid: true
    }
];
let projectProperties = builtinProjectProperties;

function getProjectClassInfo() {
    if (!projectClassInfo) {
        projectClassInfo = {
            label: () => "Project",
            properties: projectProperties,
            navigationComponent: MenuNavigation,
            navigationComponentId: "project",
            defaultNavigationKey: "settings"
        };
    }

    let projectFeatures = getExtensionsByCategory("project-feature");
    if (numProjectFeatures != projectFeatures.length) {
        numProjectFeatures = projectFeatures.length;

        let projectFeatureProperties: PropertyInfo[] = projectFeatures.map(projectFeature => {
            return {
                name: projectFeature.eezStudioExtension.implementation.projectFeature.key,
                displayName:
                    projectFeature.eezStudioExtension.implementation.projectFeature.displayName,
                type: projectFeature.eezStudioExtension.implementation.projectFeature.type,
                typeClass:
                    projectFeature.eezStudioExtension.implementation.projectFeature.typeClass,
                isOptional: !projectFeature.eezStudioExtension.implementation.projectFeature
                    .mandatory,
                hideInPropertyGrid: true,
                check: projectFeature.eezStudioExtension.implementation.projectFeature.check
            };
        });

        projectProperties.splice(
            0,
            projectProperties.length,
            ...builtinProjectProperties.concat(projectFeatureProperties)
        );
    }

    return projectClassInfo;
}

export class Project extends EezObject {
    @observable settings: Settings;
    @observable data: EezArrayObject<DataItem>;
    @observable actions: EezArrayObject<Action>;

    @computed
    get dataItemsMap() {
        const map = new Map<String, DataItem>();
        this.data.forEach(dataItem => map.set(dataItem.name, dataItem));
        return map;
    }

    @computed
    get actionsMap() {
        const map = new Map<String, Action>();
        this.actions.forEach(action => map.set(action.name, action));
        return map;
    }

    static get classInfo(): ClassInfo {
        return getProjectClassInfo();
    }

    callExtendObservableForAllOptionalProjectFeatures() {
        let optionalFeatures: any = {};

        getClassInfo(this).properties.forEach(propertyInfo => {
            if (propertyInfo.isOptional && !(propertyInfo.name in this)) {
                optionalFeatures[propertyInfo.name] = getProperty(this, propertyInfo.name);
            }
        });

        extendObservable(this, optionalFeatures);
    }
}

registerClass(Project);

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

    return loadObject(undefined, project as Project, Project) as Project;
}

export async function load(filePath: string) {
    return new Promise<Project>((resolve, reject) => {
        const fs = EEZStudio.electron.remote.require("fs");
        fs.readFile(filePath, "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                let projectJs = JSON.parse(data);
                console.time("load");
                let project = loadObject(undefined, projectJs, Project) as Project;
                console.timeEnd("load");

                (window as any).EEZStudio.project = project;
                (window as any).EEZStudio.mobx = mobx;

                resolve(project);
            }
        });
    });
}

export function save(filePath: string) {
    const toJsHook = (jsObject: any) => {
        let projectFeatures = getExtensionsByCategory("project-feature");
        for (let projectFeature of projectFeatures) {
            if (projectFeature.eezStudioExtension.implementation.projectFeature.toJsHook) {
                projectFeature.eezStudioExtension.implementation.projectFeature.toJsHook(jsObject);
            }
        }
    };

    //console.time("save");
    const json = objectToJson(ProjectStore.project, 2, toJsHook);
    //console.timeEnd("save");

    return new Promise((resolve, reject) => {
        const fs = EEZStudio.electron.remote.require("fs");
        fs.writeFile(filePath, json, "utf8", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
