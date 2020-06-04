import React from "react";
import { observable, computed, runInAction, action } from "mobx";
import { observer } from "mobx-react";

import { fileExistsSync, getFileNameWithoutExtension } from "eez-studio-shared/util-electron";
import { _map, _keys, _filter } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import { showGenericDialog, FieldComponent } from "eez-studio-ui/generic-dialog";
import { Tree } from "eez-studio-ui/tree";
import { BootstrapButton } from "project-editor/components/BootstrapButton";

import { getExtensionsByCategory } from "project-editor/core/extensions";
import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    getChildOfObject,
    PropertyProps,
    getObjectFromPath,
    getProperty,
    findPropertyByNameInObject,
    getRootObject
} from "project-editor/core/object";
import { loadObject, objectToJson } from "project-editor/core/serialization";
import * as output from "project-editor/core/output";

import { DocumentStore, ProjectStore, UIStateStore } from "project-editor/core/store";

import { SettingsNavigation } from "project-editor/project/SettingsNavigation";

import "project-editor/project/builtInFeatures";

import { Action, IAction } from "project-editor/features/action/action";
import { DataItem, IDataItem } from "project-editor/features/data/data";
import { Gui, IGui } from "project-editor/features/gui/gui";
import { Scpi, IScpi } from "project-editor/features/scpi/scpi";
import { Shortcuts, IShortcuts } from "project-editor/features/shortcuts/shortcuts";
import {
    ExtensionDefinition,
    IExtensionDefinition
} from "project-editor/features/extension-definitions/extension-definitions";

import { MenuNavigation } from "project-editor/components/MenuNavigation";

import { usage, startSearch, SearchCallbackMessage } from "project-editor/core/search";

////////////////////////////////////////////////////////////////////////////////

export const NAMESPACE_PREFIX = "::";

////////////////////////////////////////////////////////////////////////////////

export interface IBuildConfiguration {
    name: string;
    description: string;
    properties: string;
    screenOrientation: "landscape" | "portrait";
}
export class BuildConfiguration extends EezObject implements IBuildConfiguration {
    @observable name: string;
    @observable description: string;
    @observable properties: string;
    @observable screenOrientation: "landscape" | "portrait";

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
        showInNavigation: true,
        check: (object: IBuildConfiguration) => {
            let messages: output.Message[] = [];

            if (object.properties) {
                try {
                    JSON.parse(object.properties);
                } catch (err) {
                    messages.push(output.propertyInvalidValueMessage(object, "properties"));
                }
            }

            return messages;
        }
    };
}

registerClass(BuildConfiguration);

////////////////////////////////////////////////////////////////////////////////

export interface IBuildFile {
    fileName: string;
    description?: string;
    template: string;
}

export class BuildFile extends EezObject implements IBuildFile {
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

export interface IBuild {
    files: IBuildFile[];
    configurations: IBuildConfiguration[];
}

export class Build extends EezObject implements IBuild {
    @observable configurations: BuildConfiguration[];
    @observable files: BuildFile[];
    @observable destinationFolder?: string;

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

class UsageTreeNode {
    id: string;
    label: string;
    children: UsageTreeNode[];
    @observable selected: boolean;
    @observable expanded: boolean;

    constructor(label: string, children?: (string | UsageTreeNode)[]) {
        this.id = label;
        this.label = label;
        this.children = children
            ? children.map(child =>
                  typeof child == "string" ? new UsageTreeNode(child, []) : child
              )
            : [];
        this.selected = false;
        this.expanded = children ? children.length > 0 : false;
    }
}

interface IAssetsUsage {
    assets: {
        [path: string]: string;
    };
    selectedAsset: string | undefined;
}

@observer
class UsageTreeField extends FieldComponent {
    @observable selectedNode: UsageTreeNode | undefined;

    @computed
    get rootNode() {
        let assetsUsage: IAssetsUsage = this.props.values[this.props.fieldProperties.name];
        return new UsageTreeNode(
            "",
            _keys(assetsUsage.assets)
                .sort()
                .map(key => {
                    return new UsageTreeNode(humanize(key), assetsUsage.assets[key].split(", "));
                })
        );
    }

    selectNode = action((node: UsageTreeNode) => {
        if (this.selectedNode) {
            this.selectedNode.selected = false;
        }

        this.selectedNode = node;

        let assetsUsage: IAssetsUsage = this.props.values[this.props.fieldProperties.name];
        if (this.selectedNode && this.selectedNode.children.length === 0) {
            assetsUsage.selectedAsset = this.selectedNode.id;
        } else {
            assetsUsage.selectedAsset = undefined;
        }

        if (this.selectedNode) {
            this.selectedNode.selected = true;
        }
    });

    render() {
        return (
            <Tree showOnlyChildren={true} rootNode={this.rootNode} selectNode={this.selectNode} />
        );
    }
}

class BuildAssetsUssage {
    assets: {
        [path: string]: Set<string>;
    } = {};

    @observable
    assetsUsage: IAssetsUsage = {
        assets: {},
        selectedAsset: undefined
    };

    constructor(private importDirective: ImportDirective) {}

    onMessage(message: SearchCallbackMessage) {
        if (message.type == "value") {
            const path = message.valueObject.propertyInfo.referencedObjectCollectionPath!;

            const importedProject = this.importDirective.project!;

            const assetName = message.valueObject.value;
            if (!importedProject.assetCollectionPaths.has(path)) {
                // console.log("NOT INTERESTED", path, assetName);
                return true;
            }

            const collection = getObjectFromPath(importedProject, path.split("/")) as EezObject[];
            const object = collection.find(object => assetName == getProperty(object, "name"));

            if (object) {
                // console.log("FOUND", path, assetName, object);
                const set = this.assets[path] ?? new Set<string>();
                set.add(assetName);
                this.assets[path] = set;
                runInAction(() => (this.assetsUsage.assets[path] = Array.from(set).join(", ")));
            } else {
                // console.log("NOT FOUND", path, assetName);
            }
            return true;
        } else {
            // console.log("finish");
            return true;
        }
    }
}

function showUsage(importDirective: ImportDirective) {
    const buildAssetsUsage = new BuildAssetsUssage(importDirective);

    usage(message => buildAssetsUsage.onMessage(message));

    showGenericDialog({
        dialogDefinition: {
            title: "Imported Project Assets Usage",
            fields: [
                {
                    name: "assetsUsage",
                    fullLine: true,
                    type: UsageTreeField
                }
            ]
        },
        values: {
            assetsUsage: buildAssetsUsage.assetsUsage
        },
        okButtonText: "Search",
        okDisabled: result => {
            const assetsUsage: IAssetsUsage = result.values.assetsUsage;
            return !assetsUsage.selectedAsset;
        }
    })
        .then(
            action(result => {
                const assetsUsage: IAssetsUsage = result.values.assetsUsage;
                if (assetsUsage.selectedAsset) {
                    UIStateStore.searchPattern = assetsUsage.selectedAsset;
                    UIStateStore.searchMatchCase = true;
                    UIStateStore.searchMatchWholeWord = true;
                    startSearch(assetsUsage.selectedAsset, true, true);
                }
            })
        )
        .catch(() => {});
}

const ImportUsage = observer((props: PropertyProps) => {
    return (
        <BootstrapButton
            color="primary"
            size="small"
            onClick={() => showUsage(props.objects[0] as ImportDirective)}
        >
            Usage
        </BootstrapButton>
    );
});

export class ImportDirective {
    @observable projectFilePath: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "projectFilePath",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                isOptional: false
            },
            {
                name: "namespace",
                type: PropertyType.String,
                computed: true
            },
            {
                name: "customUI",
                displayName: "",
                type: PropertyType.Any,
                computed: true,
                propertyGridComponent: ImportUsage,
                hideInPropertyGrid: (importObject: ImportDirective) => !importObject.project
            }
        ],
        defaultValue: {},
        check: (object: ImportDirective) => {
            let messages: output.Message[] = [];

            if (object.projectFilePath) {
                if (!fileExistsSync(ProjectStore.getAbsoluteFilePath(object.projectFilePath))) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "projectFilePath")
                        )
                    );
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "projectFilePath"));
            }

            return messages;
        }
    };

    @computed({ keepAlive: true })
    get project() {
        return ProjectStore.loadExternalProject(
            ProjectStore.getAbsoluteFilePath(this.projectFilePath, getRootObject(this) as Project)
        );
    }

    @computed
    get namespace() {
        return this.project?.namespace;
    }
}

registerClass(ImportDirective);

////////////////////////////////////////////////////////////////////////////////

export interface IGeneral {
    projectVersion: "v1" | "v2";
    scpiDocFolder?: string;
    namespace: string;
    masterProject: string;
}

export class General extends EezObject implements IGeneral {
    @observable projectVersion: "v1" | "v2";
    @observable scpiDocFolder?: string;
    @observable namespace: string;
    @observable masterProject: string;
    @observable imports: ImportDirective[];

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
                name: "namespace",
                type: PropertyType.String
            },
            {
                name: "masterProject",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            },
            {
                name: "imports",
                type: PropertyType.Array,
                typeClass: ImportDirective,
                defaultValue: [],
                hideInPropertyGrid: () => !!ProjectStore.project.masterProject
            }
        ],
        showInNavigation: true,
        check: (object: General) => {
            let messages: output.Message[] = [];

            if (object.masterProject) {
                if (!fileExistsSync(ProjectStore.getAbsoluteFilePath(object.masterProject))) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "masterProject")
                        )
                    );
                }
            }

            return messages;
        }
    };
}

registerClass(General);

////////////////////////////////////////////////////////////////////////////////

export interface ISettings {
    build: IBuild;
    general: IGeneral;
    scpiHelpFolder?: string;
}

export class Settings extends EezObject implements ISettings {
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

export interface IProject {
    settings: ISettings;
    actions: IAction[];
    data: IDataItem[];
    scpi: IScpi;
    gui: IGui;
    shortcuts: IShortcuts;
    extensionDefinitions: IExtensionDefinition[];
}

class BuildAssetsMap {
    assets = new Map<string, IEezObject[]>();

    addAsset(path: string, object: IEezObject) {
        let asset = this.assets.get(path);
        if (!asset) {
            this.assets.set(path, [object]);
        } else {
            asset.push(object);
        }
    }
}

export class Project extends EezObject implements IProject {
    @observable settings: Settings;
    @observable data: DataItem[];
    @observable actions: Action[];
    @observable gui: Gui;
    @observable scpi: Scpi;
    @observable shortcuts: Shortcuts;
    @observable extensionDefinitions: ExtensionDefinition[];

    @computed
    get importDirective() {
        return ProjectStore.project.settings.general.imports.find(
            importDirective => importDirective.project === this
        );
    }

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

    @computed
    get namespace() {
        return this.settings.general.namespace;
    }

    @computed({ keepAlive: true })
    get masterProject() {
        return (
            this.settings.general.masterProject &&
            ProjectStore.loadExternalProject(
                ProjectStore.getAbsoluteFilePath(this.settings.general.masterProject)
            )
        );
    }

    @computed({ keepAlive: true })
    get allAssetsMaps() {
        return [
            { path: "data", map: this.dataItemsMap },
            { path: "actions", map: this.actionsMap },
            { path: "gui/pages", map: this.gui.pagesMap },
            { path: "gui/styles", map: this.gui.stylesMap },
            { path: "gui/fonts", map: this.gui.fontsMap },
            { path: "gui/bitmaps", map: this.gui.bitmapsMap },
            { path: "gui/colors", map: this.gui.colorsMap }
        ];
    }

    @computed({ keepAlive: true })
    get assetCollectionPaths() {
        const assetCollectionPaths = new Set<string>();
        ProjectStore.project.allAssetsMaps.forEach(assetsMap =>
            assetCollectionPaths.add(assetsMap.path)
        );
        return assetCollectionPaths;
    }

    @computed({ keepAlive: true })
    get localAssets() {
        const buildAssets = new BuildAssetsMap();

        this.allAssetsMaps.forEach(({ path, map }) => {
            map.forEach((object: IEezObject, key: string) =>
                buildAssets.addAsset(path + "/" + key, object)
            );
        });

        return buildAssets.assets;
    }

    @computed({ keepAlive: true })
    get importedAssets() {
        const buildAssets = new BuildAssetsMap();

        for (const importDirective of this.settings.general.imports) {
            const project = importDirective.project;
            if (project) {
                project.allAssetsMaps.forEach(({ path, map }) => {
                    map.forEach((object: IEezObject, key: string) =>
                        buildAssets.addAsset(
                            path +
                                "/" +
                                (project.namespace ? project.namespace + NAMESPACE_PREFIX : "") +
                                key,
                            object
                        )
                    );
                });
            }
        }

        return buildAssets.assets;
    }

    @computed({ keepAlive: true })
    get masterAssets() {
        const buildAssets = new BuildAssetsMap();

        if (this.masterProject) {
            this.masterProject.allAssetsMaps.forEach(({ path, map }) => {
                map.forEach((object: IEezObject, key: string) => {
                    if ((object as any).id) {
                        buildAssets.addAsset(path + "/" + key, object);
                    }
                });
            });
        }

        return buildAssets.assets;
    }

    @computed({ keepAlive: true })
    get allAssets() {
        return new Map([...this.localAssets, ...this.masterAssets, ...this.importedAssets]);
    }

    getAllObjectsOfType(referencedObjectCollectionPath: string) {
        const isAssetType = this.assetCollectionPaths.has(referencedObjectCollectionPath);

        if (isAssetType) {
            return Array.from(this.allAssets.keys())
                .filter(key => key.startsWith(referencedObjectCollectionPath))
                .map(key => this.allAssets.get(key)!)
                .filter(assets => assets.length == 1)
                .map(assets => assets[0]);
        } else {
            return (
                (DocumentStore.getObjectFromPath(
                    referencedObjectCollectionPath.split("/")
                ) as IEezObject[]) || []
            );
        }
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
                console.time("load");
                let projectJs = JSON.parse(data);
                let project = loadObject(undefined, projectJs, Project) as Project;
                console.timeEnd("load");

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

    const json = objectToJson(ProjectStore.project, 2, toJsHook);

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

export function findAllReferencedObjects(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    return project.allAssets.get(referencedObjectCollectionPath + "/" + referencedObjectName);
}

export function findReferencedObject(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    let objects = project.allAssets.get(
        referencedObjectCollectionPath + "/" + referencedObjectName
    );
    if (objects && objects.length === 1) {
        return objects[0];
    }
    return undefined;
}

function getProjectName(project: Project) {
    if (ProjectStore.project === project) {
        return ProjectStore.filePath
            ? getFileNameWithoutExtension(ProjectStore.filePath)
            : "<current project>";
    }

    if (project.importDirective) {
        return getFileNameWithoutExtension(
            ProjectStore.getAbsoluteFilePath(project.importDirective.projectFilePath)
        );
    }

    throw "unknwon project";
}

export function checkObjectReference(
    object: IEezObject,
    propertyName: string,
    messages: output.Message[],
    mandatory?: boolean
) {
    const value = getProperty(object, propertyName);
    if (value) {
        const propertyInfo = findPropertyByNameInObject(object, propertyName);
        if (!propertyInfo) {
            throw `unknow object property: ${propertyName}`;
        }
        if (!propertyInfo.referencedObjectCollectionPath) {
            throw `no referencedObjectCollectionPath for property: ${propertyName}`;
        }

        const objects = findAllReferencedObjects(
            ProjectStore.project,
            propertyInfo.referencedObjectCollectionPath,
            value
        );

        if (!objects || objects.length == 0) {
            messages.push(output.propertyNotFoundMessage(object, propertyName));
        } else if (objects.length > 1) {
            messages.push(
                new output.Message(
                    output.Type.ERROR,
                    `Ambiguous, found in multiple projects: ${objects
                        .map(object => getProjectName(getRootObject(object) as Project))
                        .join(", ")}`,
                    getChildOfObject(object, propertyName)
                )
            );
        }
    } else {
        if (mandatory) {
            messages.push(output.propertyNotSetMessage(object, propertyName));
        }
    }
}
