import React from "react";
import { observable, computed, runInAction, action, autorun } from "mobx";
import { observer } from "mobx-react";
import chokidar from "chokidar";

import { confirmSave } from "eez-studio-shared/util";
import { fileExistsSync, getFileNameWithoutExtension } from "eez-studio-shared/util-electron";
import { _map, _keys, _filter } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import { showGenericDialog, FieldComponent, TableField } from "eez-studio-ui/generic-dialog";
import { Tree } from "eez-studio-ui/tree";
import { BootstrapButton } from "project-editor/components/BootstrapButton";
import { styled } from "eez-studio-ui/styled-components";

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

import { DocumentStore } from "project-editor/core/store";

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

import {
    build as buildProject,
    backgroundCheck,
    buildExtensions
} from "project-editor/project/build";
import { getAllMetrics } from "project-editor/project/metrics";

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
            const object =
                collection && collection.find(object => assetName == getProperty(object, "name"));

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
        okEnabled: result => {
            const assetsUsage: IAssetsUsage = result.values.assetsUsage;
            return !!assetsUsage.selectedAsset;
        }
    })
        .then(
            action(result => {
                const assetsUsage: IAssetsUsage = result.values.assetsUsage;
                if (assetsUsage.selectedAsset) {
                    DocumentStore.UIState.searchPattern = assetsUsage.selectedAsset;
                    DocumentStore.UIState.searchMatchCase = true;
                    DocumentStore.UIState.searchMatchWholeWord = true;
                    startSearch(assetsUsage.selectedAsset, true, true);
                }
            })
        )
        .catch(() => {});
}

function openProject(importDirective: ImportDirective) {
    EEZStudio.electron.ipcRenderer.send(
        "open-file",
        ProjectStore.getAbsoluteFilePath(importDirective.projectFilePath)
    );
}

const ImportDirectiveCustomUIContainer = styled.div`
    & > button {
        margin-right: 10px;
    }
`;

const ImportDirectiveCustomUI = observer((props: PropertyProps) => {
    return (
        <ImportDirectiveCustomUIContainer>
            <BootstrapButton
                color="primary"
                size="small"
                onClick={() => showUsage(props.objects[0] as ImportDirective)}
            >
                Usage
            </BootstrapButton>

            <BootstrapButton
                color="primary"
                size="small"
                onClick={() => openProject(props.objects[0] as ImportDirective)}
            >
                Open
            </BootstrapButton>
        </ImportDirectiveCustomUIContainer>
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
                propertyGridComponent: ImportDirectiveCustomUI,
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
        return this.projectFilePath
            ? ProjectStore.loadExternalProject(
                  ProjectStore.getAbsoluteFilePath(this.projectFilePath, getProject(this))
              )
            : undefined;
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
                ],
                hideInPropertyGrid: (general: General) => {
                    return general.imports.length > 0;
                }
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

    @computed get projectName() {
        if (ProjectStore.project === this) {
            return ProjectStore.filePath
                ? getFileNameWithoutExtension(ProjectStore.filePath)
                : "<current project>";
        }

        if (this.importDirective) {
            return getFileNameWithoutExtension(
                ProjectStore.getAbsoluteFilePath(this.importDirective.projectFilePath)
            );
        }

        throw "unknwon project";
    }

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
            { path: "data", map: this.data && this.dataItemsMap },
            { path: "actions", map: this.actions && this.actionsMap },
            { path: "gui/pages", map: this.gui && this.gui.pagesMap },
            { path: "gui/styles", map: this.gui && this.gui.stylesMap },
            { path: "gui/fonts", map: this.gui && this.gui.fontsMap },
            { path: "gui/bitmaps", map: this.gui && this.gui.bitmapsMap },
            { path: "gui/colors", map: this.gui && this.gui.colorsMap }
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
            if (map) {
                map.forEach((object: IEezObject, key: string) =>
                    buildAssets.addAsset(path + "/" + key, object)
                );
            }
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
                    if (map) {
                        map.forEach((object: IEezObject, key: string) =>
                            buildAssets.addAsset(
                                path +
                                    "/" +
                                    (project.namespace
                                        ? project.namespace + NAMESPACE_PREFIX
                                        : "") +
                                    key,
                                object
                            )
                        );
                    }
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
                if (map) {
                    map.forEach((object: IEezObject, key: string) => {
                        if ((object as any).id) {
                            buildAssets.addAsset(path + "/" + key, object);
                        }
                    });
                }
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

    return new Promise<void>((resolve, reject) => {
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
                        .map(object => getProject(object).projectName)
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

export function getProject(object: IEezObject) {
    return getRootObject(object) as Project;
}

export function isObjectReadOnly(object: IEezObject) {
    return getProject(object) != ProjectStore.project;
}

export function isAnyObjectReadOnly(objects: IEezObject[]) {
    return !!objects.find(isObjectReadOnly);
}

export function getNameProperty(object: IEezObject) {
    let name = getProperty(object, "name");
    const project = getProject(object);
    if (project != ProjectStore.project && project.namespace) {
        name = project.namespace + NAMESPACE_PREFIX + name;
    }
    return name;
}

function getUIStateFilePath(projectFilePath: string) {
    return projectFilePath + "-ui-state";
}

class ProjectStoreClass {
    @observable filePath: string | undefined;
    @observable backgroundCheckEnabled = true;

    constructor() {
        autorun(() => {
            this.updateProjectWindowState();
        });

        autorun(() => {
            if (this.filePath) {
                this.updateMruFilePath();
            }
        });

        let watcher: chokidar.FSWatcher | undefined = undefined;
        autorun(() => {
            if (watcher) {
                watcher.close();
            }

            if (this.project) {
                const importedProjectFiles = this.project.settings.general.imports
                    .filter(importDirective => !!importDirective.projectFilePath)
                    .map(importDirective =>
                        this.getAbsoluteFilePath(importDirective.projectFilePath)
                    );
                watcher = chokidar.watch(importedProjectFiles);
                watcher.on("change", path => {
                    const project = this.externalProjects.get(path);
                    if (project) {
                        runInAction(() => {
                            this.externalProjects.delete(path);
                            this.mapExternalProjectToAbsolutePath.delete(project);
                        });
                    }
                });
            }
        });
    }

    async waitUntilready() {
        while (true) {
            const project = this.project;
            if (project) {
                let i;
                for (i = 0; i < project.settings.general.imports.length; i++) {
                    if (project.settings.general.imports[i].project === undefined) {
                        break;
                    }
                }
                if (i == project.settings.general.imports.length) {
                    break;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }

        autorun(() => {
            // check the project in the background
            if (ProjectStore.project && ProjectStore.backgroundCheckEnabled) {
                backgroundCheck();
            }
        });
    }

    updateProjectWindowState() {
        const path = EEZStudio.electron.remote.require("path");

        let title = "";

        if (this.project) {
            if (DocumentStore.modified) {
                title += "\u25CF ";
            }

            if (this.filePath) {
                title += path.basename(this.filePath) + " - ";
            } else {
                title += "untitled - ";
            }
        }

        title += EEZStudio.title;

        if (title != document.title) {
            document.title = title;
        }

        EEZStudio.electron.ipcRenderer.send("windowSetState", {
            modified: DocumentStore.modified,
            projectFilePath: this.filePath,
            undo: (DocumentStore.UndoManager && DocumentStore.UndoManager.canUndo && DocumentStore.UndoManager.undoDescription) || null,
            redo: (DocumentStore.UndoManager && DocumentStore.UndoManager.canRedo && DocumentStore.UndoManager.redoDescription) || null
        });
    }

    get project() {
        return DocumentStore.document as Project;
    }

    updateMruFilePath() {
        EEZStudio.electron.ipcRenderer.send("setMruFilePath", this.filePath);
    }

    getFilePathRelativeToProjectPath(absoluteFilePath: string) {
        const path = EEZStudio.electron.remote.require("path");
        return path.relative(path.dirname(this.filePath), absoluteFilePath);
    }

    getProjectFilePath(project: Project) {
        if (project == this.project) {
            return this.filePath;
        } else {
            return this.mapExternalProjectToAbsolutePath.get(project);
        }
    }

    getAbsoluteFilePath(relativeFilePath: string, project?: Project) {
        const path = EEZStudio.electron.remote.require("path");
        const filePath = this.getProjectFilePath(project ?? this.project);
        return filePath
            ? path.resolve(path.dirname(filePath), relativeFilePath.replace(/(\\|\/)/g, path.sep))
            : relativeFilePath;
    }

    getFolderPathRelativeToProjectPath(absoluteFolderPath: string) {
        const path = EEZStudio.electron.remote.require("path");
        let folder = path.relative(path.dirname(this.filePath), absoluteFolderPath);
        if (folder == "") {
            folder = ".";
        }
        return folder;
    }

    @computed
    get selectedBuildConfiguration() {
        let configuration =
            this.project &&
            this.project.settings.build.configurations.find(
                configuration => configuration.name == DocumentStore.UIState.selectedBuildConfiguration
            );
        if (!configuration) {
            if (this.project.settings.build.configurations.length > 0) {
                configuration = this.project.settings.build.configurations[0];
            }
        }
        return configuration;
    }

    changeProject(projectFilePath: string | undefined, project?: Project, uiState?: Project) {
        action(() => {
            this.filePath = projectFilePath;
        })();

        DocumentStore.changeDocument(project, uiState);
    }

    doSave(callback: (() => void) | undefined) {
        if (this.filePath) {
            save(this.filePath)
                .then(() => {
                    DocumentStore.setModified(false);

                    if (callback) {
                        callback();
                    }
                })
                .catch(error => console.error("Save", error));
        }
    }

    @action
    savedAsFilePath(filePath: string, callback: (() => void) | undefined) {
        if (filePath) {
            this.filePath = filePath;
            this.doSave(() => {
                this.saveUIState();
                if (callback) {
                    callback();
                }
            });
        }
    }

    async saveToFile(saveAs: boolean, callback: (() => void) | undefined) {
        if (this.project) {
            if (!this.filePath || saveAs) {
                const result = await EEZStudio.electron.remote.dialog.showSaveDialog(
                    EEZStudio.electron.remote.getCurrentWindow(),
                    {
                        filters: [
                            { name: "EEZ Project", extensions: ["eez-project"] },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    }
                );
                let filePath = result.filePath;
                if (filePath) {
                    if (!filePath.toLowerCase().endsWith(".eez-project")) {
                        filePath += ".eez-project";
                    }

                    this.savedAsFilePath(filePath, callback);
                }
            } else {
                this.doSave(callback);
            }
        }
    }

    newProject() {
        this.changeProject(undefined, getNewProject());
    }

    loadUIState(projectFilePath: string) {
        return new Promise<any>((resolve, reject) => {
            const fs = EEZStudio.electron.remote.require("fs");
            fs.readFile(getUIStateFilePath(projectFilePath), "utf8", (err: any, data: string) => {
                if (err) {
                    resolve({});
                } else {
                    resolve(JSON.parse(data));
                }
            });
        });
    }

    saveUIState() {
        if (this.filePath && DocumentStore.UIState.isModified) {
            const fs = EEZStudio.electron.remote.require("fs");
            fs.writeFile(
                getUIStateFilePath(this.filePath),
                DocumentStore.UIState.save(),
                "utf8",
                (err: any) => {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log("UI state saved");
                    }
                }
            );
        }
    }

    openFile(filePath: string) {
        load(filePath)
            .then(project => {
                this.loadUIState(filePath)
                    .then(uiState => {
                        this.changeProject(filePath, project, uiState);
                    })
                    .catch(error => console.error(error));
            })
            .catch(error => console.error(error));
    }

    open(sender: any, filePath: any) {
        if (!this.project || (!this.filePath && !DocumentStore.modified)) {
            this.openFile(filePath);
        }
    }

    saveModified(callback: any) {
        this.saveUIState();

        if (this.project && DocumentStore.modified) {
            confirmSave({
                saveCallback: () => {
                    this.saveToFile(false, callback);
                },

                dontSaveCallback: () => {
                    callback();
                },

                cancelCallback: () => {}
            });
        } else {
            callback();
        }
    }

    save() {
        this.saveToFile(false, undefined);
    }

    saveAs() {
        this.saveToFile(true, undefined);
    }

    check() {
        buildProject({ onlyCheck: true });
    }

    build() {
        buildProject({ onlyCheck: false });
    }

    buildExtensions() {
        buildExtensions();
    }

    closeWindow() {
        if (this.project) {
            this.saveModified(() => {
                this.changeProject(undefined);
                EEZStudio.electron.ipcRenderer.send("readyToClose");
            });
        } else {
            EEZStudio.electron.ipcRenderer.send("readyToClose");
        }
    }

    noProject() {
        this.changeProject(undefined);
    }

    showMetrics() {
        const ID = "eez-project-editor-project-metrics";
        if (!document.getElementById(ID)) {
            showGenericDialog({
                dialogDefinition: {
                    id: ID,
                    title: "Project Metrics",
                    fields: [
                        {
                            name: "metrics",
                            fullLine: true,
                            type: TableField
                        }
                    ]
                },
                values: {
                    metrics: getAllMetrics()
                },
                showOkButton: false
            }).catch(() => {});
        }
    }

    @computed
    get masterProjectEnabled() {
        return !!this.project.settings.general.masterProject;
    }

    @computed
    get masterProject() {
        return this.project.masterProject;
    }

    @observable externalProjects = new Map<string, Project>();
    @observable mapExternalProjectToAbsolutePath = new Map<Project, string>();
    externalProjectsLoading = new Map<string, boolean>();

    loadExternalProject(filePath: string) {
        if (filePath == this.filePath) {
            return this.project;
        }

        const project = this.externalProjects.get(filePath);
        if (project) {
            return project;
        }

        if (!this.externalProjectsLoading.get(filePath)) {
            this.externalProjectsLoading.set(filePath, true);

            (async () => {
                const project = await load(filePath);

                runInAction(() => {
                    this.externalProjects.set(filePath, project);
                    this.mapExternalProjectToAbsolutePath.set(project, filePath);
                });

                this.externalProjectsLoading.set(filePath, false);
            })();
        }

        return undefined;
    }
}

export const ProjectStore = new ProjectStoreClass();
