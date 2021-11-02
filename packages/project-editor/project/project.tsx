import React from "react";
import { observable, computed, runInAction, action } from "mobx";
import { observer } from "mobx-react";
import css from "css";

import {
    fileExistsSync,
    getFileNameWithoutExtension
} from "eez-studio-shared/util-electron";
import { _map, _keys, _filter, _max, _min } from "eez-studio-shared/algorithm";
import { humanize, pascalCase } from "eez-studio-shared/string";

import {
    showGenericDialog,
    FieldComponent
} from "eez-studio-ui/generic-dialog";
import { Tree } from "eez-studio-ui/tree";
import { BootstrapButton } from "project-editor/components/BootstrapButton";

import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    PropertyProps,
    getProperty,
    getRootObject,
    getParent,
    ProjectType,
    MessageType
} from "project-editor/core/object";
import {
    getChildOfObject,
    getObjectFromPath,
    findPropertyByNameInObject,
    getAncestorOfType,
    Message,
    propertyNotSetMessage,
    propertyNotFoundMessage,
    propertyInvalidValueMessage,
    DocumentStoreClass,
    getDocumentStore,
    hideInPropertyGridIfDashboardOrApplet,
    hideInPropertyGridIfNotDashboard
} from "project-editor/core/store";

import { SettingsNavigation } from "project-editor/project/SettingsNavigation";

import type { Action } from "project-editor/features/action/action";
import type {
    ProjectVariables,
    Variable
} from "project-editor/features/variable/variable";
import type { Scpi } from "project-editor/features/scpi/scpi";
import type { Shortcuts } from "project-editor/features/shortcuts/project-shortcuts";
import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import {
    usage,
    startSearch,
    SearchCallbackMessage
} from "project-editor/core/search";
import { Color, Theme } from "project-editor/features/style/theme";
import { guid } from "eez-studio-shared/guid";
import { Page } from "project-editor/features/page/page";
import type { Style } from "project-editor/features/style/style";
import type { Font } from "project-editor/features/font/font";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import { Flow } from "project-editor/flow/flow";
import { FlowEditor } from "project-editor/flow/editor/editor";
import {
    ContainerWidget,
    LayoutViewWidget
} from "project-editor/flow/components/widgets";
import { Widget } from "project-editor/flow/component";
import { PagesNavigation } from "project-editor/features/page/PagesNavigation";
import { ProjectEditor } from "project-editor/project-editor-interface";

export { ProjectType } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

export const NAMESPACE_PREFIX = "::";

////////////////////////////////////////////////////////////////////////////////

export class BuildConfiguration extends EezObject {
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
        check: (object: BuildConfiguration) => {
            let messages: Message[] = [];

            if (object.properties) {
                try {
                    JSON.parse(object.properties);
                } catch (err) {
                    messages.push(
                        propertyInvalidValueMessage(object, "properties")
                    );
                }
            }

            return messages;
        }
    };
}

registerClass("BuildConfiguration", BuildConfiguration);

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

registerClass("BuildFile", BuildFile);

////////////////////////////////////////////////////////////////////////////////

function isFilesPropertyEnumerable(object: IEezObject): boolean {
    const project: Project = getProject(object);
    return !!(
        project.pages ||
        project.actions ||
        (project.variables && project.variables.globalVariables)
    );
}

export class Build extends EezObject {
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
                showOnlyChildrenInTree: false,
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

registerClass("Build", Build);

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
                  typeof child == "string"
                      ? new UsageTreeNode(child, [])
                      : child
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
        let assetsUsage: IAssetsUsage =
            this.props.values[this.props.fieldProperties.name];
        return new UsageTreeNode(
            "",
            _keys(assetsUsage.assets)
                .sort()
                .map(key => {
                    return new UsageTreeNode(
                        humanize(key),
                        assetsUsage.assets[key].split(", ")
                    );
                })
        );
    }

    selectNode = action((node: UsageTreeNode) => {
        if (this.selectedNode) {
            this.selectedNode.selected = false;
        }

        this.selectedNode = node;

        let assetsUsage: IAssetsUsage =
            this.props.values[this.props.fieldProperties.name];
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
            <Tree
                showOnlyChildren={true}
                rootNode={this.rootNode}
                selectNode={this.selectNode}
            />
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
            const path =
                message.valueObject.propertyInfo
                    .referencedObjectCollectionPath!;

            const importedProject = this.importDirective.project!;

            const assetName = message.valueObject.value;
            if (!importedProject.assetCollectionPaths.has(path)) {
                // console.log("NOT INTERESTED", path, assetName);
                return true;
            }

            const collection = getObjectFromPath(
                importedProject,
                path.split("/")
            ) as EezObject[];
            const object =
                collection &&
                collection.find(
                    object => assetName == getProperty(object, "name")
                );

            if (object) {
                // console.log("FOUND", path, assetName, object);
                const set = this.assets[path] ?? new Set<string>();
                set.add(assetName);
                this.assets[path] = set;
                runInAction(
                    () =>
                        (this.assetsUsage.assets[path] =
                            Array.from(set).join(", "))
                );
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

    const DocumentStore = getDocumentStore(importDirective);

    usage(DocumentStore, message => buildAssetsUsage.onMessage(message));

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
                    DocumentStore.uiStateStore.searchPattern =
                        assetsUsage.selectedAsset;
                    DocumentStore.uiStateStore.searchMatchCase = true;
                    DocumentStore.uiStateStore.searchMatchWholeWord = true;
                    startSearch(
                        DocumentStore,
                        assetsUsage.selectedAsset,
                        true,
                        true
                    );
                }
            })
        )
        .catch(() => {});
}

function openProject(importDirective: ImportDirective) {
    const DocumentStore = getDocumentStore(importDirective);
    EEZStudio.electron.ipcRenderer.send(
        "open-file",
        DocumentStore.getAbsoluteFilePath(importDirective.projectFilePath)
    );
}

const ImportDirectiveCustomUI = observer((props: PropertyProps) => {
    return (
        <div className="EezStudio_ImportDirectiveCustomUIContainer">
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
        </div>
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
                displayName: "Actions",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: ImportDirectiveCustomUI,
                hideInPropertyGrid: (importObject: ImportDirective) =>
                    !importObject.project
            }
        ],
        defaultValue: {},
        check: (object: ImportDirective) => {
            let messages: Message[] = [];

            if (object.projectFilePath) {
                if (
                    !fileExistsSync(
                        getDocumentStore(object).getAbsoluteFilePath(
                            object.projectFilePath
                        )
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "projectFilePath")
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "projectFilePath"));
            }

            return messages;
        },

        getImportedProject: (importDirective: ImportDirective) => ({
            findReferencedObject: (
                root: IEezObject,
                referencedObjectCollectionPath: string,
                referencedObjectName: string
            ) => {
                const object = findReferencedObject(
                    root as Project,
                    referencedObjectCollectionPath,
                    referencedObjectName
                );
                if (object && getProject(object) == importDirective.project) {
                    return object;
                }
                return undefined;
            }
        })
    };

    get projectAbsoluteFilePath() {
        const DocumentStore = getDocumentStore(this);
        return DocumentStore.getAbsoluteFilePath(
            this.projectFilePath,
            getProject(this)
        );
    }

    async loadProject() {
        const DocumentStore = getDocumentStore(this);
        await DocumentStore.loadExternalProject(this.projectAbsoluteFilePath);
    }

    @computed({ keepAlive: true })
    get project(): Project | undefined {
        const DocumentStore = getDocumentStore(this);

        if (this.projectAbsoluteFilePath == DocumentStore.filePath) {
            return DocumentStore.project;
        }

        return this.projectFilePath
            ? DocumentStore.externalProjects.get(this.projectAbsoluteFilePath)
            : undefined;
    }

    @computed
    get namespace() {
        return this.project?.namespace;
    }
}

registerClass("ImportDirective", ImportDirective);

////////////////////////////////////////////////////////////////////////////////

export class General extends EezObject {
    @observable projectVersion: "v1" | "v2" | "v3" = "v3";
    @observable projectType: ProjectType;
    @observable scpiDocFolder?: string;
    @observable namespace: string;
    @observable masterProject: string;
    @observable imports: ImportDirective[];
    @observable css: string;

    static classInfo: ClassInfo = {
        label: () => "General",
        properties: [
            {
                name: "projectVersion",
                type: PropertyType.Enum,
                enumItems: [{ id: "v1" }, { id: "v2" }, { id: "v3" }]
            },
            {
                name: "projectType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: ProjectType.MASTER_FIRMWARE },
                    { id: ProjectType.FIRMWARE_MODULE },
                    { id: ProjectType.RESOURCE },
                    { id: ProjectType.APPLET },
                    { id: ProjectType.DASHBOARD }
                ]
            },
            {
                name: "scpiDocFolder",
                displayName: "SCPI documentation folder",
                type: PropertyType.RelativeFolder,
                hideInPropertyGrid: (object: IEezObject) =>
                    !getProject(object).scpi
            },
            {
                name: "namespace",
                type: PropertyType.String,
                hideInPropertyGrid: hideInPropertyGridIfDashboardOrApplet
            },
            {
                name: "masterProject",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                hideInPropertyGrid: (general: General) => {
                    const documentStore = getDocumentStore(general);
                    return (
                        general.imports.length > 0 ||
                        documentStore.project.isDashboardProject
                    );
                }
            },
            {
                name: "imports",
                type: PropertyType.Array,
                typeClass: ImportDirective,
                defaultValue: [],
                hideInPropertyGrid: (general: General) => {
                    const documentStore = getDocumentStore(general);
                    return (
                        !!getProject(general).masterProject ||
                        documentStore.project.isDashboardProject ||
                        documentStore.project.isAppletProject
                    );
                }
            },
            {
                name: "css",
                type: PropertyType.CSS,
                hideInPropertyGrid: hideInPropertyGridIfNotDashboard
            }
        ],
        showInNavigation: true,
        check: (object: General) => {
            let messages: Message[] = [];

            if (object.masterProject) {
                const DocumentStore = getDocumentStore(object);
                if (
                    !fileExistsSync(
                        DocumentStore.getAbsoluteFilePath(object.masterProject)
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "masterProject")
                        )
                    );
                }
            }

            if (object.css) {
                try {
                    css.parse(object.css);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `CSS parse error: ${err}`,
                            getChildOfObject(object, "css")
                        )
                    );
                }
            }

            return messages;
        },
        beforeLoadHook(object: IEezObject, jsObject: any) {
            if (!jsObject.projectType) {
                if (jsObject.projectVersion === "v1") {
                    jsObject.projectType = ProjectType.MASTER_FIRMWARE;
                } else {
                    if (!jsObject.projectVersion) {
                        jsObject.projectVersion = "v3";
                    }

                    if (jsObject.masterProject) {
                        jsObject.projectType = ProjectType.RESOURCE;
                    } else if (jsObject.namespace) {
                        jsObject.projectType = ProjectType.FIRMWARE_MODULE;
                    } else {
                        jsObject.projectType = ProjectType.MASTER_FIRMWARE;
                    }
                }
            }
        }
    };

    getProjectTypeAsNumber() {
        switch (this.projectType) {
            case ProjectType.MASTER_FIRMWARE:
                return 1;
            case ProjectType.FIRMWARE_MODULE:
                return 2;
            case ProjectType.RESOURCE:
                return 3;
            case ProjectType.APPLET:
                return 4;
            case ProjectType.DASHBOARD:
                return 5;
        }
    }
}

registerClass("General", General);

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
                enumerable: (
                    object: IEezObject,
                    propertyInfo: PropertyInfo
                ) => {
                    const DocumentStore = getDocumentStore(object);
                    return (
                        !DocumentStore.project.isDashboardProject &&
                        !DocumentStore.masterProjectEnabled
                    );
                }
            }
        ],
        hideInProperties: true,
        navigationComponent: SettingsNavigation,
        navigationComponentId: "settings",
        icon: "settings"
    };
}

registerClass("Settings", Settings);

////////////////////////////////////////////////////////////////////////////////

let projectClassInfo: ClassInfo;
let numProjectFeatures = 0;
let builtinProjectProperties: PropertyInfo[] = [
    {
        name: "settings",
        type: PropertyType.Object,
        typeClass: Settings,
        hideInPropertyGrid: true
    },
    {
        name: "colors",
        type: PropertyType.Array,
        typeClass: Color,
        hideInPropertyGrid: true,
        partOfNavigation: false
    },
    {
        name: "themes",
        type: PropertyType.Array,
        typeClass: Theme,
        hideInPropertyGrid: true,
        partOfNavigation: false
    }
];
let projectProperties = builtinProjectProperties;

function getProjectClassInfo() {
    if (!projectClassInfo) {
        projectClassInfo = {
            label: () => "Project",
            properties: projectProperties,
            beforeLoadHook: (project: Project, projectJs: any) => {
                if (projectJs.data) {
                    projectJs.globalVariables = projectJs.data;
                    delete projectJs.data;
                }

                if (projectJs.globalVariables) {
                    projectJs.variables = {
                        globalVariables: projectJs.globalVariables,
                        structures: []
                    };
                    delete projectJs.globalVariables;
                }

                if (projectJs.variables) {
                    if (!projectJs.variables.enums) {
                        projectJs.variables.enums = [];
                    }

                    const enums = projectJs.variables.enums as {
                        name: string;
                        members: {
                            name: string;
                            value: number;
                        }[];
                    }[];

                    for (const globalVariable of projectJs.variables
                        .globalVariables) {
                        if (globalVariable.enumItems) {
                            try {
                                const enumItems = JSON.parse(
                                    globalVariable.enumItems
                                );

                                if (Array.isArray(enumItems)) {
                                    const prefix = pascalCase(
                                        globalVariable.name
                                    );
                                    let name = prefix;

                                    let i = 0;
                                    while (true) {
                                        if (
                                            !enums.find(
                                                enumItem =>
                                                    enumItem.name == name
                                            )
                                        ) {
                                            break;
                                        }
                                        name = prefix + i++;
                                    }

                                    const members = enumItems.map(
                                        (name: string, value: number) => ({
                                            name,
                                            value
                                        })
                                    );

                                    enums.push({
                                        name,
                                        members
                                    });

                                    globalVariable.enum = name;
                                } else {
                                    globalVariable.enum =
                                        globalVariable.enumItems;
                                }
                            } catch (err) {
                                globalVariable.enum = globalVariable.enumItems;
                            }
                            delete globalVariable.enumItems;
                        }
                    }
                }

                if (projectJs.gui) {
                    Object.assign(projectJs, projectJs.gui);
                    delete projectJs.gui;
                }

                if (projectJs.colors) {
                    for (const color of projectJs.colors) {
                        color.id = guid();
                    }
                }

                if (projectJs.themes) {
                    for (const theme of projectJs.themes) {
                        theme.id = guid();
                        for (let i = 0; i < theme.colors.length; i++) {
                            project.setThemeColor(
                                theme.id,
                                projectJs.colors[i].id,
                                theme.colors[i]
                            );
                        }
                        delete theme.colors;
                    }
                }
            },
            defaultNavigationKey: "settings"
        };
    }

    let projectFeatures = ProjectEditor.extensions;
    if (numProjectFeatures != projectFeatures.length) {
        numProjectFeatures = projectFeatures.length;

        let projectFeatureProperties: PropertyInfo[] = projectFeatures.map(
            projectFeature => {
                return {
                    name: projectFeature.eezStudioExtension.implementation
                        .projectFeature.key,
                    displayName:
                        projectFeature.eezStudioExtension.implementation
                            .projectFeature.displayName,
                    type: projectFeature.eezStudioExtension.implementation
                        .projectFeature.type,
                    typeClass:
                        projectFeature.eezStudioExtension.implementation
                            .projectFeature.typeClass,
                    isOptional:
                        !projectFeature.eezStudioExtension.implementation
                            .projectFeature.mandatory,
                    hideInPropertyGrid: true,
                    check: projectFeature.eezStudioExtension.implementation
                        .projectFeature.check,
                    enumerable:
                        projectFeature.eezStudioExtension.implementation
                            .projectFeature.enumerable
                };
            }
        );

        projectProperties.splice(
            0,
            projectProperties.length,
            ...builtinProjectProperties.concat(projectFeatureProperties)
        );
    }

    return projectClassInfo;
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

export class Project extends EezObject {
    _DocumentStore!: DocumentStoreClass;
    _isReadOnly: boolean = false;

    @observable _fullyLoaded = false;

    @observable settings: Settings;
    @observable variables: ProjectVariables;
    @observable actions: Action[];
    @observable pages: Page[];
    @observable styles: Style[];
    @observable fonts: Font[];
    @observable bitmaps: Bitmap[];
    @observable scpi: Scpi;
    @observable shortcuts: Shortcuts;
    @observable extensionDefinitions: ExtensionDefinition[];
    @observable colors: Color[];
    @observable themes: Theme[];

    @computed get projectName() {
        if (this._DocumentStore.project === this) {
            return this._DocumentStore.filePath
                ? getFileNameWithoutExtension(this._DocumentStore.filePath)
                : "<current project>";
        }

        if (this.importDirective) {
            return getFileNameWithoutExtension(
                this._DocumentStore.getAbsoluteFilePath(
                    this.importDirective.projectFilePath
                )
            );
        }

        if (this._DocumentStore.project.masterProject == this) {
            return getFileNameWithoutExtension(
                this._DocumentStore.project.settings.general.masterProject
            );
        }

        throw "unknown project";
    }

    get isDashboardProject() {
        return this.settings.general.projectType === ProjectType.DASHBOARD;
    }

    get isAppletProject() {
        return this.settings.general.projectType === ProjectType.APPLET;
    }

    @computed
    get importDirective() {
        return this._DocumentStore.project.settings.general.imports.find(
            importDirective => importDirective.project === this
        );
    }

    @computed
    get globalVariablesMap() {
        const map = new Map<String, Variable>();
        this.variables.globalVariables.forEach(globalVariable =>
            map.set(globalVariable.name, globalVariable)
        );
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

    get masterProjectAbsoluteFilePath() {
        return this._DocumentStore.getAbsoluteFilePath(
            this.settings.general.masterProject
        );
    }

    async loadMasterProject() {
        await this._DocumentStore.loadExternalProject(
            this.masterProjectAbsoluteFilePath
        );
    }

    @computed({ keepAlive: true })
    get masterProject(): Project | undefined {
        return this.settings.general.masterProject
            ? this._DocumentStore.externalProjects.get(
                  this.masterProjectAbsoluteFilePath
              )
            : undefined;
    }

    @computed({ keepAlive: true })
    get allAssetsMaps() {
        return [
            {
                path: "variables/globalVariables",
                map:
                    this.variables &&
                    this.variables.globalVariables &&
                    this.globalVariablesMap
            },
            { path: "actions", map: this.actions && this.actionsMap },
            { path: "pages", map: this.pagesMap },
            { path: "styles", map: this.stylesMap },
            { path: "fonts", map: this.fontsMap },
            { path: "bitmaps", map: this.bitmapsMap },
            { path: "colors", map: this.colorsMap }
        ];
    }

    @computed({ keepAlive: true })
    get assetCollectionPaths() {
        const assetCollectionPaths = new Set<string>();
        this._DocumentStore.project.allAssetsMaps.forEach(assetsMap =>
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
        return new Map([
            ...this.localAssets,
            ...this.masterAssets,
            ...this.importedAssets
        ]);
    }

    getAllObjectsOfType(referencedObjectCollectionPath: string) {
        const isAssetType = this.assetCollectionPaths.has(
            referencedObjectCollectionPath
        );

        if (isAssetType) {
            return Array.from(this.allAssets.keys())
                .filter(key => key.startsWith(referencedObjectCollectionPath))
                .map(key => this.allAssets.get(key)!)
                .filter(assets => assets.length == 1)
                .map(assets => assets[0]);
        } else {
            return (
                (this._DocumentStore.getObjectFromPath(
                    referencedObjectCollectionPath.split("/")
                ) as IEezObject[]) || []
            );
        }
    }

    @computed({ keepAlive: true })
    get pagesMap() {
        const map = new Map<String, Page>();
        if (this.pages) {
            this.pages.forEach(page => map.set(page.name, page));
        }
        return map;
    }

    @computed({ keepAlive: true })
    get stylesMap() {
        const map = new Map<String, Style>();
        if (this.styles) {
            this.styles.forEach(style => map.set(style.name, style));
        }
        return map;
    }

    @computed({ keepAlive: true })
    get allStyleIdToStyleMap() {
        const map = new Map<number, Style[]>();

        this.stylesMap.forEach(style => {
            if (style.id != undefined) {
                map.set(style.id, (map.get(style.id) || []).concat([style]));
            }
        });

        for (const importDirective of getProject(this).settings.general
            .imports) {
            const project = importDirective.project;
            if (project) {
                project.stylesMap.forEach(style => {
                    if (style.id != undefined) {
                        map.set(
                            style.id,
                            (map.get(style.id) || []).concat([style])
                        );
                    }
                });
            }
        }

        return map;
    }

    @computed({ keepAlive: true })
    get fontsMap() {
        const map = new Map<String, Font>();
        if (this.fonts) {
            this.fonts.forEach(font => map.set(font.name, font));
        }
        return map;
    }

    @computed({ keepAlive: true })
    get bitmapsMap() {
        const map = new Map<String, Bitmap>();
        if (this.bitmaps) {
            this.bitmaps.forEach(bitmap => map.set(bitmap.name, bitmap));
        }
        return map;
    }

    @observable themeColors = new Map<string, string>();

    getThemeColor(themeId: string, colorId: string) {
        return this.themeColors.get(themeId + colorId) || "#000000";
    }

    @action
    setThemeColor(themeId: string, colorId: string, color: string) {
        this.themeColors.set(themeId + colorId, color);
    }

    @computed
    get colorToIndexMap() {
        const map = new Map<String, number>();
        this.colors.forEach((color, i) => map.set(color.name, i));
        return map;
    }

    @computed
    get colorsMap() {
        const map = new Map<String, Color>();
        this.colors.forEach((color, i) => map.set(color.name, color));
        return map;
    }
}

registerClass("Project", Project);

////////////////////////////////////////////////////////////////////////////////

export function findAllReferencedObjects(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    return project.allAssets.get(
        referencedObjectCollectionPath + "/" + referencedObjectName
    );
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
    messages: Message[],
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
            getProject(object),
            propertyInfo.referencedObjectCollectionPath,
            value
        );

        if (!objects || objects.length == 0) {
            messages.push(propertyNotFoundMessage(object, propertyName));
        } else if (objects.length > 1) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `Ambiguous, found in multiple projects: ${objects
                        .map(object => getProject(object).projectName)
                        .join(", ")}`,
                    getChildOfObject(object, propertyName)
                )
            );
        }
    } else {
        if (mandatory) {
            messages.push(propertyNotSetMessage(object, propertyName));
        }
    }
}

export function getProject(object: IEezObject) {
    return getRootObject(object) as Project;
}

export function getFlow(object: IEezObject) {
    return getAncestorOfType(object, Flow.classInfo) as Flow;
}

export function isObjectReadOnly(object: IEezObject) {
    return getProject(object)._isReadOnly;
}

export function isAnyObjectReadOnly(objects: IEezObject[]) {
    return !!objects.find(isObjectReadOnly);
}

export function getNameProperty(object: IEezObject) {
    let name = getProperty(object, "name");
    const project = getProject(object);
    if (isObjectReadOnly(object) && project.namespace) {
        name = project.namespace + NAMESPACE_PREFIX + name;
    }
    return name;
}

////////////////////////////////////////////////////////////////////////////////

export class Command {
    constructor(
        public name: string,
        public callback: (DocumentStore: DocumentStoreClass) => void
    ) {}
}

export const commands = [
    new Command("Padding", (DocumentStore: DocumentStoreClass) => {
        const selectedPanel = DocumentStore.navigationStore.selectedPanel;
        if (
            !(selectedPanel instanceof FlowEditor) &&
            !(selectedPanel instanceof PagesNavigation)
        ) {
            return;
        }

        const selectedObject =
            selectedPanel.selectedObject ||
            (selectedPanel instanceof FlowEditor &&
                selectedPanel.flowContext.document.flow.object);

        if (
            selectedObject instanceof Page ||
            selectedObject instanceof ContainerWidget
        ) {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "padding",
                            type: "number"
                        }
                    ]
                },

                values: {
                    padding: 10
                }
            })
                .then(result => {
                    const padding = result.values.padding;

                    let widgets;

                    if (selectedObject instanceof Page) {
                        widgets = selectedObject.components.filter(
                            component => component instanceof Widget
                        );
                    } else {
                        widgets = selectedObject.widgets;
                    }

                    if (widgets.length > 0) {
                        const left = _min(widgets.map(widget => widget.left));

                        const top = _min(widgets.map(widget => widget.top));

                        const right = _max(
                            widgets.map(widget => widget.left + widget.width)
                        );

                        const bottom = _max(
                            widgets.map(widget => widget.top + widget.height)
                        );

                        if (
                            typeof left === "number" &&
                            typeof top === "number" &&
                            typeof right === "number" &&
                            typeof bottom === "number"
                        ) {
                            DocumentStore.undoManager.setCombineCommands(true);

                            widgets.forEach(widget => {
                                DocumentStore.updateObject(widget, {
                                    left: widget.left + padding - left,
                                    top: widget.top + padding - top
                                });
                            });

                            DocumentStore.updateObject(selectedObject, {
                                width: right - left + 2 * padding,
                                height: bottom - top + 2 * padding
                            });

                            DocumentStore.undoManager.setCombineCommands(false);
                        }
                    }
                })
                .catch(() => {});
        }
    }),

    new Command("Fit Size", (DocumentStore: DocumentStoreClass) => {
        const selectedPanel = DocumentStore.navigationStore.selectedPanel;
        if (
            !(selectedPanel instanceof FlowEditor) &&
            !(selectedPanel instanceof PagesNavigation)
        ) {
            return;
        }

        const selectedObject =
            selectedPanel.selectedObject ||
            (selectedPanel instanceof FlowEditor &&
                selectedPanel.flowContext.document.flow.object);

        if (selectedObject instanceof LayoutViewWidget) {
            if (!selectedObject.layoutPage) {
                return;
            }

            DocumentStore.updateObject(selectedObject, {
                width: selectedObject.layoutPage.width,
                height: selectedObject.layoutPage.height
            });
        } else if (
            selectedObject instanceof Page ||
            selectedObject instanceof ContainerWidget
        ) {
            let widgets;

            if (selectedObject instanceof Page) {
                widgets = selectedObject.components.filter(
                    component => component instanceof Widget
                );
            } else {
                widgets = selectedObject.widgets;
            }

            if (widgets.length > 0) {
                const width = _max(
                    widgets.map(widget => widget.left + widget.width)
                );
                const height = _max(
                    widgets.map(widget => widget.top + widget.height)
                );

                DocumentStore.updateObject(selectedObject, {
                    width: width,
                    height: height
                });
            }
        }
    }),

    new Command("Horizontal Align", (DocumentStore: DocumentStoreClass) => {
        const selectedPanel = DocumentStore.navigationStore.selectedPanel;
        if (
            !(selectedPanel instanceof FlowEditor) &&
            !(selectedPanel instanceof PagesNavigation)
        ) {
            return;
        }

        const selectedObjects = selectedPanel.selectedObjects;
        if (selectedObjects.length === 0) {
            return;
        }

        const parent = getParent(selectedObjects[0]);

        if (
            !selectedObjects.find(
                selectedObject =>
                    !(selectedObject instanceof Widget) ||
                    getParent(selectedObject) != parent
            )
        ) {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "gap",
                            type: "number"
                        }
                    ]
                },

                values: {
                    gap: 10
                }
            })
                .then(result => {
                    const gap = result.values.gap;

                    let widgets = selectedObjects as Widget[];

                    let left = _min(widgets.map(widget => widget.left));

                    const top = _min(widgets.map(widget => widget.top));

                    if (typeof left === "number" && typeof top === "number") {
                        DocumentStore.undoManager.setCombineCommands(true);

                        widgets
                            .slice()
                            .sort((a, b) => a.left - b.left)
                            .forEach(widget => {
                                DocumentStore.updateObject(widget, {
                                    left: left,
                                    top: top
                                });
                                left += widget.width + gap;
                            });

                        DocumentStore.undoManager.setCombineCommands(false);
                    }
                })
                .catch(() => {});
        }
    }),

    new Command("Vertical Align", (DocumentStore: DocumentStoreClass) => {
        const selectedPanel = DocumentStore.navigationStore.selectedPanel;
        if (
            !(selectedPanel instanceof FlowEditor) &&
            !(selectedPanel instanceof PagesNavigation)
        ) {
            return;
        }

        const selectedObjects = selectedPanel.selectedObjects;
        if (selectedObjects.length === 0) {
            return;
        }

        const parent = getParent(selectedObjects[0]);

        if (
            !selectedObjects.find(
                selectedObject =>
                    !(selectedObject instanceof Widget) ||
                    getParent(selectedObject) != parent
            )
        ) {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "gap",
                            type: "number"
                        }
                    ]
                },

                values: {
                    gap: 10
                }
            })
                .then(result => {
                    const gap = result.values.gap;

                    let widgets = selectedObjects as Widget[];

                    const left = _min(widgets.map(widget => widget.left));

                    let top = _min(widgets.map(widget => widget.top));

                    if (typeof left === "number" && typeof top === "number") {
                        DocumentStore.undoManager.setCombineCommands(true);

                        widgets
                            .slice()
                            .sort((a, b) => a.top - b.top)
                            .forEach(widget => {
                                DocumentStore.updateObject(widget, {
                                    left: left,
                                    top: top
                                });
                                top += widget.height + gap;
                            });

                        DocumentStore.undoManager.setCombineCommands(false);
                    }
                })
                .catch(() => {});
        }
    })
];
