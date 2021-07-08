import React from "react";
import { observable, computed, runInAction, action } from "mobx";
import { observer } from "mobx-react";

import {
    fileExistsSync,
    getFileNameWithoutExtension
} from "eez-studio-shared/util-electron";
import { _map, _keys, _filter, _max, _min } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    showGenericDialog,
    FieldComponent
} from "eez-studio-ui/generic-dialog";
import { Tree } from "eez-studio-ui/tree";
import { BootstrapButton } from "project-editor/components/BootstrapButton";
import { styled } from "eez-studio-ui/styled-components";

import { getProjectFeatures } from "project-editor/core/extensions";
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
    getRootObject,
    getAncestorOfType,
    getParent,
    ProjectType
} from "project-editor/core/object";
import {
    Message,
    propertyNotSetMessage,
    propertyNotFoundMessage,
    Type,
    propertyInvalidValueMessage
} from "project-editor/core/output";
import {
    DocumentStoreClass,
    getDocumentStore
} from "project-editor/core/store";

import { SettingsNavigation } from "project-editor/project/SettingsNavigation";

import "project-editor/project/builtInFeatures";

import { Action } from "project-editor/features/action/action";
import { DataItem } from "project-editor/features/data/data";
import { Scpi } from "project-editor/features/scpi/scpi";
import { Shortcuts } from "project-editor/features/shortcuts/shortcuts";
import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import {
    usage,
    startSearch,
    SearchCallbackMessage
} from "project-editor/core/search";
import { Color, Theme } from "project-editor/features/style/theme";
import { guid } from "eez-studio-shared/guid";
import { Page } from "project-editor/features/page/page";
import { Style } from "project-editor/features/style/style";
import { Font } from "project-editor/features/font/font";
import { Bitmap } from "project-editor/features/bitmap/bitmap";
import { Flow } from "project-editor/flow/flow";
import { FlowEditor } from "project-editor/flow/flow-editor/editor";
import { ContainerWidget, LayoutViewWidget } from "project-editor/flow/widgets";
import { Widget } from "project-editor/flow/component";
import { PagesNavigation } from "project-editor/features/page/PagesNavigation";

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

function isFilesPropertyEnumerable(object: IEezObject): boolean {
    const project: Project = getProject(object);
    return !!(project.pages || project.actions || project.data);
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
                    DocumentStore.UIStateStore.searchPattern =
                        assetsUsage.selectedAsset;
                    DocumentStore.UIStateStore.searchMatchCase = true;
                    DocumentStore.UIStateStore.searchMatchWholeWord = true;
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
                            Type.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "projectFilePath")
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "projectFilePath"));
            }

            return messages;
        }
    };

    @computed({ keepAlive: true })
    get project(): Project | undefined {
        const DocumentStore = getDocumentStore(this);

        return this.projectFilePath
            ? DocumentStore.loadExternalProject(
                  DocumentStore.getAbsoluteFilePath(
                      this.projectFilePath,
                      getProject(this)
                  )
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

export class General extends EezObject {
    @observable projectVersion: "v1" | "v2" | "v3";
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
                hideInPropertyGrid: (object: IEezObject) =>
                    !!getProject(object).masterProject
            },
            {
                name: "css",
                type: PropertyType.CSS,
                hideInPropertyGrid: (object: IEezObject) =>
                    !getDocumentStore(object).isDashboardProject
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
                            Type.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "masterProject")
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
                        jsObject.projectVersion = "v2";
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
                enumerable: (
                    object: IEezObject,
                    propertyInfo: PropertyInfo
                ) => {
                    const DocumentStore = getDocumentStore(object);
                    return (
                        !DocumentStore.isDashboardProject &&
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

    let projectFeatures = getProjectFeatures();
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
            ...projectFeatureProperties.concat(builtinProjectProperties)
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

    @observable settings: Settings;
    @observable data: DataItem[];
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

        throw "unknwon project";
    }

    @computed
    get importDirective() {
        return this._DocumentStore.project.settings.general.imports.find(
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
    get masterProject(): Project | undefined {
        return this.settings.general.masterProject
            ? this._DocumentStore.loadExternalProject(
                  this._DocumentStore.getAbsoluteFilePath(
                      this.settings.general.masterProject
                  )
              )
            : undefined;
    }

    @computed({ keepAlive: true })
    get allAssetsMaps() {
        return [
            { path: "data", map: this.data && this.dataItemsMap },
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

    @computed
    get pagesMap() {
        const map = new Map<String, Page>();
        this.pages.forEach(page => map.set(page.name, page));
        return map;
    }

    @computed
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

    @computed
    get fontsMap() {
        const map = new Map<String, Font>();
        if (this.fonts) {
            this.fonts.forEach(font => map.set(font.name, font));
        }
        return map;
    }

    @computed
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

registerClass(Project);

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
                    Type.ERROR,
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
        const selectedPanel = DocumentStore.NavigationStore.selectedPanel;
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
                            DocumentStore.UndoManager.setCombineCommands(true);

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

                            DocumentStore.UndoManager.setCombineCommands(false);
                        }
                    }
                })
                .catch(() => {});
        }
    }),

    new Command("Fit Size", (DocumentStore: DocumentStoreClass) => {
        const selectedPanel = DocumentStore.NavigationStore.selectedPanel;
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
        const selectedPanel = DocumentStore.NavigationStore.selectedPanel;
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
                        DocumentStore.UndoManager.setCombineCommands(true);

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

                        DocumentStore.UndoManager.setCombineCommands(false);
                    }
                })
                .catch(() => {});
        }
    }),

    new Command("Vertical Align", (DocumentStore: DocumentStoreClass) => {
        const selectedPanel = DocumentStore.NavigationStore.selectedPanel;
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
                        DocumentStore.UndoManager.setCombineCommands(true);

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

                        DocumentStore.UndoManager.setCombineCommands(false);
                    }
                })
                .catch(() => {});
        }
    })
];
