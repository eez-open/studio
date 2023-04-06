import { ipcRenderer } from "electron";
import React from "react";
import {
    observable,
    computed,
    runInAction,
    action,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import css from "css";
import * as FlexLayout from "flexlayout-react";

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

import * as notification from "eez-studio-ui/notification";
import { Button } from "eez-studio-ui/button";

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
    ProjectStore,
    getProjectStore,
    LayoutModels,
    propertyNotUniqueMessage,
    createObject
} from "project-editor/store";
import {
    isLVGLProject,
    isNotDashboardProject,
    isNotLVGLProject,
    isNotV1Project
} from "project-editor/project/project-type-traits";

import type { Action } from "project-editor/features/action/action";
import type {
    ProjectVariables,
    Variable
} from "project-editor/features/variable/variable";
import type { Scpi } from "project-editor/features/scpi/scpi";
import type { Shortcuts } from "project-editor/features/shortcuts/project-shortcuts";
import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";
import type { MicroPython } from "project-editor/features/micropython/micropython";

import {
    usage,
    startSearch,
    SearchCallbackMessage,
    visitObjects
} from "project-editor/core/search";
import { Color, Theme } from "project-editor/features/style/theme";
import { Page } from "project-editor/features/page/page";
import type { Style } from "project-editor/features/style/style";
import type { Font } from "project-editor/features/font/font";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import { Flow } from "project-editor/flow/flow";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Texts } from "project-editor/features/texts";
import { Readme } from "project-editor/features/readme";
import { Changes } from "project-editor/features/changes";
import { validators } from "eez-studio-shared/validation";
import { createProjectTypeTraits } from "./project-type-traits";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { LVGLStyles } from "project-editor/lvgl/style";

export { ProjectType } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

export const NAMESPACE_PREFIX = "::";

////////////////////////////////////////////////////////////////////////////////

export class BuildConfiguration extends EezObject {
    name: string;
    description: string;
    properties: string;
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
                ],
                hideInPropertyGrid: isNotV1Project
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Configuration",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const buildConfigurationProperties: Partial<BuildConfiguration> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const buildConfiguration = createObject<BuildConfiguration>(
                project._store,
                buildConfigurationProperties,
                BuildConfiguration
            );

            return buildConfiguration;
        },
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

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            description: observable,
            properties: observable,
            screenOrientation: observable
        });
    }
}

registerClass("BuildConfiguration", BuildConfiguration);

////////////////////////////////////////////////////////////////////////////////

export class BuildFile extends EezObject {
    fileName: string;
    description?: string;
    template: string;

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
        newItem: async (parent: IEezObject) => {
            const buildFileProperties: Partial<BuildFile> = {
                fileName: "file",
                template: ""
            };

            const project = ProjectEditor.getProject(parent);

            const buildFile = createObject<BuildFile>(
                project._store,
                buildFileProperties,
                BuildFile
            );

            return buildFile;
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            fileName: observable,
            description: observable,
            template: observable
        });
    }
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
    configurations: BuildConfiguration[];
    files: BuildFile[];
    destinationFolder?: string;
    lvglInclude: string;

    static classInfo: ClassInfo = {
        label: () => "Build",
        properties: [
            {
                name: "configurations",
                type: PropertyType.Array,
                typeClass: BuildConfiguration,
                enumerable: object => !isLVGLProject(object),
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
            },
            {
                name: "lvglInclude",
                displayName: "LVGL include",
                type: PropertyType.String,
                hideInPropertyGrid: isNotLVGLProject
            }
        ],

        beforeLoadHook: (object: Build, jsObject: Partial<Build>) => {
            if (!jsObject.lvglInclude) {
                jsObject.lvglInclude = "lvgl/lvgl.h";
            }
        },

        updateObjectValueHook: (build: Build, values: Partial<Build>) => {
            const projectStore = getProjectStore(build);
            if (
                projectStore.projectTypeTraits.isLVGL &&
                values.lvglInclude != undefined &&
                build.lvglInclude != values.lvglInclude
            ) {
                ProjectEditor.rebuildLvglFonts(
                    projectStore,
                    values.lvglInclude
                );
            }
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            configurations: observable,
            files: observable,
            destinationFolder: observable,
            lvglInclude: observable
        });
    }
}

registerClass("Build", Build);

////////////////////////////////////////////////////////////////////////////////

class UsageTreeNode {
    id: string;
    label: string;
    children: UsageTreeNode[];
    selected: boolean;
    expanded: boolean;

    constructor(label: string, children?: (string | UsageTreeNode)[]) {
        makeObservable(this, {
            selected: observable,
            expanded: observable
        });

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

const UsageTreeField = observer(
    class UsageTreeField extends FieldComponent {
        selectedNode: UsageTreeNode | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedNode: observable,
                rootNode: computed
            });
        }

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
);

class BuildAssetsUssage {
    assets: {
        [path: string]: Set<string>;
    } = {};

    assetsUsage: IAssetsUsage = {
        assets: {},
        selectedAsset: undefined
    };

    constructor(private importDirective: ImportDirective) {
        makeObservable(this, {
            assetsUsage: observable
        });
    }

    onMessage(message: SearchCallbackMessage) {
        if (message.type == "value") {
            const path =
                message.valueObject.propertyInfo
                    .referencedObjectCollectionPath!;

            const importedProject = this.importDirective.project!;

            const assetName = message.valueObject.value;
            if (
                !importedProject._assetsMap["name"].assetCollectionPaths.has(
                    path
                )
            ) {
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

    const projectStore = getProjectStore(importDirective);

    usage(projectStore, message => buildAssetsUsage.onMessage(message));

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
                    projectStore.uiStateStore.searchPattern =
                        assetsUsage.selectedAsset;
                    projectStore.uiStateStore.searchMatchCase = true;
                    projectStore.uiStateStore.searchMatchWholeWord = true;
                    startSearch(
                        projectStore,
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
    const projectStore = getProjectStore(importDirective);
    ipcRenderer.send(
        "open-file",
        projectStore.getAbsoluteFilePath(importDirective.projectFilePath)
    );
}

const ImportDirectiveCustomUI = observer((props: PropertyProps) => {
    return (
        <div className="EezStudio_ImportDirectiveCustomUIContainer">
            <Button
                color="primary"
                size="small"
                onClick={() => showUsage(props.objects[0] as ImportDirective)}
            >
                Usage
            </Button>

            <Button
                color="primary"
                size="small"
                onClick={() => openProject(props.objects[0] as ImportDirective)}
            >
                Open
            </Button>
        </div>
    );
});

export class ImportDirective extends EezObject {
    projectFilePath: string;

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
                        getProjectStore(object).getAbsoluteFilePath(
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

    constructor() {
        super();

        makeObservable(this, {
            projectFilePath: observable,
            project: computed({ keepAlive: true }),
            namespace: computed
        });
    }

    get projectAbsoluteFilePath() {
        const projectStore = getProjectStore(this);
        return projectStore.getAbsoluteFilePath(
            this.projectFilePath,
            getProject(this)
        );
    }

    async loadProject() {
        const projectStore = getProjectStore(this);
        await projectStore.loadExternalProject(this.projectAbsoluteFilePath);
    }

    get project(): Project | undefined {
        const projectStore = getProjectStore(this);

        if (this.projectAbsoluteFilePath == projectStore.filePath) {
            return projectStore.project;
        }

        return this.projectFilePath
            ? projectStore.externalProjects.get(this.projectAbsoluteFilePath)
            : undefined;
    }

    get namespace() {
        return this.project?.namespace;
    }
}

registerClass("ImportDirective", ImportDirective);

////////////////////////////////////////////////////////////////////////////////

export type ProjectVersion = "v1" | "v2" | "v3";

export class General extends EezObject {
    projectVersion: ProjectVersion = "v3";
    projectType: ProjectType;
    scpiDocFolder?: string;
    namespace: string;
    masterProject: string;
    imports: ImportDirective[];
    flowSupport: boolean;
    displayWidth: number;
    displayHeight: number;
    //css: string;

    icon: string;
    title: string;

    static classInfo: ClassInfo = {
        label: () => "General",
        properties: [
            {
                name: "projectVersion",
                type: PropertyType.Enum,
                enumItems: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
                hideInPropertyGrid: (general: General) =>
                    general.projectType != ProjectType.FIRMWARE &&
                    general.projectType != ProjectType.FIRMWARE_MODULE &&
                    general.projectType != ProjectType.RESOURCE
            },
            {
                name: "projectType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: ProjectType.FIRMWARE },
                    { id: ProjectType.FIRMWARE_MODULE },
                    { id: ProjectType.RESOURCE },
                    { id: ProjectType.APPLET, label: "BB3 Applet" },
                    { id: ProjectType.DASHBOARD },
                    { id: ProjectType.LVGL, label: "LVGL" }
                ],
                readOnlyInPropertyGrid: (general: General) =>
                    general.projectType != ProjectType.FIRMWARE &&
                    general.projectType != ProjectType.FIRMWARE_MODULE &&
                    general.projectType != ProjectType.RESOURCE
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
                hideInPropertyGrid: (general: General) => {
                    return !(
                        general.projectType == ProjectType.FIRMWARE_MODULE
                    );
                }
            },
            {
                name: "masterProject",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                hideInPropertyGrid: (general: General) => {
                    return !(
                        general.projectType == ProjectType.RESOURCE ||
                        general.projectType == ProjectType.APPLET
                    );
                }
            },
            {
                name: "imports",
                type: PropertyType.Array,
                typeClass: ImportDirective,
                defaultValue: [],
                hideInPropertyGrid: (general: General) => {
                    const projectStore = getProjectStore(general);
                    return (
                        !!getProject(general).masterProject ||
                        projectStore.projectTypeTraits.isDashboard ||
                        projectStore.projectTypeTraits.isApplet ||
                        projectStore.projectTypeTraits.isLVGL
                    );
                }
            },
            /*
            {
                name: "css",
                type: PropertyType.CSS
            },
            */
            {
                name: "displayWidth",
                type: PropertyType.Number,
                hideInPropertyGrid: (general: General) =>
                    !ProjectEditor.getProject(general).projectTypeTraits
                        .hasDisplaySizeProperty
            },
            {
                name: "displayHeight",
                type: PropertyType.Number,
                hideInPropertyGrid: (general: General) =>
                    !ProjectEditor.getProject(general).projectTypeTraits
                        .hasDisplaySizeProperty
            },
            {
                name: "flowSupport",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: (general: General) => {
                    return (
                        general.projectType != ProjectType.FIRMWARE &&
                        general.projectType != ProjectType.FIRMWARE_MODULE &&
                        general.projectType != ProjectType.LVGL
                    );
                }
            },
            {
                name: "title",
                type: PropertyType.String,
                hideInPropertyGrid: isNotDashboardProject
            },
            {
                name: "icon",
                type: PropertyType.Image,
                embeddedImage: true,
                hideInPropertyGrid: isNotDashboardProject
            }
        ],
        check: (general: General) => {
            let messages: Message[] = [];

            if (general.masterProject) {
                const projectStore = getProjectStore(general);
                if (
                    !fileExistsSync(
                        projectStore.getAbsoluteFilePath(general.masterProject)
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "File doesn't exists",
                            getChildOfObject(general, "masterProject")
                        )
                    );
                }
            }

            const projectStore = getProjectStore(general);

            if (
                projectStore.projectTypeTraits.isFirmware &&
                projectStore.projectTypeTraits.hasFlowSupport
            ) {
                if (general.displayWidth < 1 || general.displayWidth > 1280) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Display width must be between 1 and 1280 `,
                            getChildOfObject(general, "displayWidth")
                        )
                    );
                }

                if (general.displayHeight < 1 || general.displayHeight > 1280) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Display height must be between 1 and 1280 `,
                            getChildOfObject(general, "displayHeight")
                        )
                    );
                }
            }

            return messages;
        },
        beforeLoadHook(object: IEezObject, jsObject: any) {
            if (!jsObject.projectType) {
                if (jsObject.projectVersion === "v1") {
                    jsObject.projectType = ProjectType.FIRMWARE;
                } else {
                    if (!jsObject.projectVersion) {
                        jsObject.projectVersion = "v3";
                    }

                    if (jsObject.masterProject) {
                        jsObject.projectType = ProjectType.RESOURCE;
                    } else if (jsObject.namespace) {
                        jsObject.projectType = ProjectType.FIRMWARE_MODULE;
                    } else {
                        jsObject.projectType = ProjectType.FIRMWARE;
                    }
                }
            } else {
                if (jsObject.projectType == "master") {
                    jsObject.projectType = ProjectType.FIRMWARE;
                }
            }

            if (jsObject.projectType == "firmware") {
                if (jsObject.displayWidth == undefined) {
                    jsObject.displayWidth = 480;
                }

                if (jsObject.displayHeight == undefined) {
                    jsObject.displayHeight = 272;
                }
            }
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            projectVersion: observable,
            projectType: observable,
            scpiDocFolder: observable,
            namespace: observable,
            masterProject: observable,
            imports: observable,
            flowSupport: observable,
            displayWidth: observable,
            displayHeight: observable
        });
    }
}

registerClass("General", General);

////////////////////////////////////////////////////////////////////////////////

export class Settings extends EezObject {
    general: General;
    build: Build;
    scpiHelpFolder?: string;

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
                    const projectStore = getProjectStore(object);
                    return (
                        !projectStore.projectTypeTraits.isDashboard &&
                        !projectStore.masterProjectEnabled
                    );
                }
            }
        ],
        hideInProperties: true,
        icon: "material:settings"
    };

    constructor() {
        super();

        makeObservable(this, {
            general: observable,
            build: observable,
            scpiHelpFolder: observable
        });
    }
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
        partOfNavigation: false,
        hideInPropertyGrid: true
    },
    {
        name: "themes",
        type: PropertyType.Array,
        typeClass: Theme,
        partOfNavigation: false,
        hideInPropertyGrid: true
    }
];
let projectProperties = builtinProjectProperties;

function getProjectClassInfo() {
    if (!projectClassInfo) {
        projectClassInfo = {
            label: () => "Project",
            properties: projectProperties,
            beforeLoadHook: (project: Project, projectJs: any) => {
                if (
                    projectJs.settings.general.projectType == ProjectType.LVGL
                ) {
                    delete projectJs.styles;
                    delete projectJs.texts;
                }

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

                if (projectJs.settings.general.css) {
                    let ast;

                    try {
                        ast = css.parse(projectJs.settings.general.css);

                        if (ast.stylesheet) {
                            const rules = [];
                            for (const stylesheetRule of ast.stylesheet.rules) {
                                if (stylesheetRule.type == "rule") {
                                    const rule = stylesheetRule as css.Rule;
                                    if (rule.selectors) {
                                        let declarations = "";
                                        rule.declarations?.forEach(
                                            declarationOrComment => {
                                                if (
                                                    declarationOrComment.type ==
                                                    "declaration"
                                                ) {
                                                    const declaration =
                                                        declarationOrComment as css.Declaration;
                                                    declarations += `${declaration.property}: ${declaration.value};\n`;
                                                }
                                            }
                                        );

                                        if (!projectJs.styles) {
                                            projectJs.styles = [
                                                {
                                                    name: "default"
                                                }
                                            ];
                                        }

                                        for (const selector of rule.selectors) {
                                            const parts = selector.split(/\s+/);

                                            let styleName = parts[0];
                                            if (styleName.startsWith(".")) {
                                                styleName = styleName.slice(1);
                                            }

                                            const style = projectJs.styles.find(
                                                (style: any) =>
                                                    style.name == styleName
                                            );

                                            let css;
                                            if (parts.length > 1) {
                                                css = `${parts
                                                    .slice(1)
                                                    .join(
                                                        ""
                                                    )} { ${declarations} }`;
                                            } else {
                                                css = declarations;
                                            }

                                            if (style) {
                                                if (style.css) {
                                                    style.css += "\n" + css;
                                                } else {
                                                    style.css += css;
                                                }
                                            } else {
                                                projectJs.styles.push({
                                                    name: styleName,
                                                    css: declarations,
                                                    inheritFrom: ""
                                                });
                                            }
                                        }
                                        continue;
                                    }
                                }

                                rules.push(stylesheetRule);
                            }
                            ast.stylesheet.rules = rules;
                        }

                        //console.log(ast);
                        //projectJs.settings.general.css = css.stringify(ast);
                    } catch (err) {
                        console.error(err);
                    }

                    delete projectJs.settings.general.css;
                }
            }
        };
    }

    let projectFeatures = ProjectEditor.extensions;
    if (numProjectFeatures != projectFeatures.length) {
        numProjectFeatures = projectFeatures.length;

        let projectFeatureProperties = projectFeatures.map(projectFeature => {
            return {
                name: projectFeature.key,
                displayName: projectFeature.displayName,
                type: projectFeature.type,
                typeClass: projectFeature.typeClass,
                isOptional: (project: Project) => {
                    if (
                        project.settings.general.projectType == ProjectType.LVGL
                    ) {
                        if (
                            projectFeature.key == "fonts" ||
                            projectFeature.key == "bitmaps" ||
                            projectFeature.key == "lvglStyles"
                        ) {
                            return false;
                        }
                        if (
                            projectFeature.key == "styles" ||
                            projectFeature.key == "texts" ||
                            projectFeature.key == "micropython" ||
                            projectFeature.key == "extensionDefinitions" ||
                            projectFeature.key == "scpi" ||
                            projectFeature.key == "shortcuts"
                        ) {
                            return true;
                        }
                    } else {
                        if (projectFeature.key == "lvglStyles") {
                            return true;
                        }
                    }
                    return !projectFeature.mandatory;
                },
                hideInPropertyGrid: true,
                check: projectFeature.check,
                enumerable: projectFeature.enumerable
            } as PropertyInfo;
        });

        projectProperties.splice(
            0,
            projectProperties.length,
            ...builtinProjectProperties.concat(projectFeatureProperties)
        );
    }

    return projectClassInfo;
}

class BuildAssetsMap<T extends IEezObject> {
    assets = new Map<string, T[]>();

    addAsset(path: string, object: T) {
        let asset = this.assets.get(path);
        if (!asset) {
            this.assets.set(path, [object]);
        } else {
            asset.push(object);
        }
    }
}

type AssetType =
    | "variables/globalVariables"
    | "actions"
    | "pages"
    | "styles"
    | "fonts"
    | "bitmaps"
    | "colors";

class AssetsMap {
    constructor(public project: Project, public key: "name" | "id") {
        makeObservable(this, {
            allAssetsMaps: computed,
            assetCollectionPaths: computed,
            localAssets: computed,
            importedAssets: computed,
            masterAssets: computed,
            allAssets: computed,
            globalVariablesMap: computed,
            actionsMap: computed,
            pagesMap: computed,
            stylesMap: computed,
            fontsMap: computed,
            bitmapsMap: computed,
            colorsMap: computed
        });
    }

    get allAssetsMaps(): {
        path: AssetType;
        map: Map<string, IEezObject[]>;
    }[] {
        return [
            {
                path: "variables/globalVariables",
                map: this.globalVariablesMap
            },
            { path: "actions", map: this.actionsMap },
            { path: "pages", map: this.pagesMap },
            { path: "styles", map: this.stylesMap },
            { path: "fonts", map: this.fontsMap },
            { path: "bitmaps", map: this.bitmapsMap },
            { path: "colors", map: this.colorsMap }
        ];
    }

    get assetCollectionPaths() {
        const assetCollectionPaths = new Set<string>();
        this.allAssetsMaps.forEach(assetsMap =>
            assetCollectionPaths.add(assetsMap.path)
        );
        return assetCollectionPaths;
    }

    get localAssets() {
        const buildAssets = new BuildAssetsMap();

        this.allAssetsMaps.forEach(({ path, map }) => {
            if (map) {
                map.forEach((objects, key) =>
                    objects.forEach(object => {
                        buildAssets.addAsset(path + "/" + key, object);
                    })
                );
            }
        });

        return buildAssets.assets;
    }

    get importedAssets() {
        const buildAssets = new BuildAssetsMap();

        for (const importDirective of this.project.settings.general.imports) {
            const project = importDirective.project;
            if (project) {
                project._assetsMap[this.key].allAssetsMaps.forEach(
                    ({ path, map }) => {
                        if (map) {
                            map.forEach((objects, key) =>
                                objects.forEach(object =>
                                    buildAssets.addAsset(
                                        path +
                                            "/" +
                                            (project.namespace
                                                ? project.namespace +
                                                  NAMESPACE_PREFIX
                                                : "") +
                                            key,
                                        object
                                    )
                                )
                            );
                        }
                    }
                );
            }
        }

        return buildAssets.assets;
    }

    get masterAssets() {
        const buildAssets = new BuildAssetsMap();

        if (this.project.masterProject) {
            this.project.masterProject._assetsMap[
                this.key
            ].allAssetsMaps.forEach(({ path, map }) => {
                if (map) {
                    map.forEach((objects, key) => {
                        objects.forEach(object => {
                            if ((object as any).id) {
                                buildAssets.addAsset(path + "/" + key, object);
                            }
                        });
                    });
                }
            });
        }

        return buildAssets.assets;
    }

    get allAssets() {
        return new Map([
            ...this.localAssets,
            ...this.masterAssets,
            ...this.importedAssets
        ]);
    }

    addToMap<
        T extends EezObject & {
            id: number | undefined;
            name: string;
        }
    >(map: BuildAssetsMap<T>, asset: T) {
        if (this.key == "name") {
            if (asset.name) {
                map.addAsset(asset.name, asset);
            }
        } else {
            if (asset.id != undefined) {
                map.addAsset(asset.id.toString(), asset);
            }
        }
    }

    get globalVariablesMap() {
        const buildAssets = new BuildAssetsMap<Variable>();
        if (this.project.variables && this.project.variables.globalVariables) {
            this.project.variables.globalVariables.forEach(globalVariable =>
                this.addToMap(buildAssets, globalVariable)
            );
        }
        return buildAssets.assets;
    }

    get actionsMap() {
        const buildAssets = new BuildAssetsMap<Action>();
        if (this.project.actions) {
            this.project.actions.forEach(action =>
                this.addToMap(buildAssets, action)
            );
        }
        return buildAssets.assets;
    }

    get pagesMap() {
        const buildAssets = new BuildAssetsMap<Page>();
        if (this.project.pages) {
            this.project.pages.forEach(page =>
                this.addToMap(buildAssets, page)
            );
        }
        return buildAssets.assets;
    }

    get stylesMap() {
        const buildAssets = new BuildAssetsMap<Style>();
        if (this.project.styles) {
            this.project.styles.forEach(style =>
                this.addToMap(buildAssets, style)
            );
        }
        return buildAssets.assets;
    }

    get fontsMap() {
        const buildAssets = new BuildAssetsMap<Font>();
        if (this.project.fonts) {
            this.project.fonts.forEach(font =>
                this.addToMap(buildAssets, font)
            );
        }
        return buildAssets.assets;
    }

    get bitmapsMap() {
        const buildAssets = new BuildAssetsMap<Bitmap>();
        if (this.project.bitmaps) {
            this.project.bitmaps.forEach(bitmap =>
                this.addToMap(buildAssets, bitmap)
            );
        }
        return buildAssets.assets;
    }

    get colorsMap() {
        const buildAssets = new BuildAssetsMap<Color>();
        this.project.colors.forEach(color => this.addToMap(buildAssets, color));
        return buildAssets.assets;
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
                (this.project._store.getObjectFromPath(
                    referencedObjectCollectionPath.split("/")
                ) as IEezObject[]) || []
            );
        }
    }
}

export class Project extends EezObject {
    _store!: ProjectStore;
    _isReadOnly: boolean = false;
    _isDashboardBuild: boolean = false;

    _fullyLoaded = false;

    _assetsMap = {
        name: new AssetsMap(this, "name"),
        id: new AssetsMap(this, "id")
    };

    get _objectsMap() {
        const objectsMap = new Map<string, EezObject>();

        for (const object of visitObjects(this)) {
            if (object instanceof EezObject) {
                objectsMap.set(object.objID, object);
            }
        }

        return objectsMap;
    }

    settings: Settings;
    variables: ProjectVariables;
    actions: Action[];
    pages: Page[];
    styles: Style[];
    fonts: Font[];
    texts: Texts;
    readme: Readme;
    bitmaps: Bitmap[];
    scpi: Scpi;
    shortcuts: Shortcuts;
    micropython: MicroPython;
    extensionDefinitions: ExtensionDefinition[];
    changes: Changes;

    colors: Color[];
    themes: Theme[];

    lvglStyles: LVGLStyles;

    get _lvglIdentifiers() {
        const widgetIdentifiers = new Map<
            string,
            { identifier: string; object: LVGLWidget | Page; index: number }
        >();

        let index = 0;

        for (const page of this.pages) {
            widgetIdentifiers.set(page.name, {
                identifier: page.name,
                object: page,
                index: index++
            });
        }

        for (const page of this.pages) {
            page._lvglWidgets.forEach(widget => {
                if (widget.identifier) {
                    if (!widgetIdentifiers.get(widget.identifier)) {
                        widgetIdentifiers.set(widget.identifier, {
                            identifier: widget.identifier,
                            object: widget,
                            index: index++
                        });
                    } else {
                        notification.error(
                            `Duplicate widget name: ${widget.identifier}`
                        );
                    }
                }
            });
        }

        return widgetIdentifiers;
    }

    constructor() {
        super();

        makeObservable(this, {
            _fullyLoaded: observable,
            settings: observable,
            variables: observable,
            actions: observable,
            pages: observable,
            styles: observable,
            fonts: observable,
            texts: observable,
            readme: observable,
            bitmaps: observable,
            scpi: observable,
            shortcuts: observable,
            micropython: observable,
            extensionDefinitions: observable,
            changes: observable,
            colors: observable,
            themes: observable,
            projectName: computed,
            importDirective: computed,
            namespace: computed,
            masterProject: computed({ keepAlive: true }),
            allGlobalVariables: computed({ keepAlive: true }),
            _themeColors: observable,
            setThemeColor: action,
            colorToIndexMap: computed,
            buildColors: computed({ keepAlive: true }),
            projectTypeTraits: computed,
            _objectsMap: computed,
            _lvglIdentifiers: computed({ keepAlive: true })
        });
    }

    get projectTypeTraits() {
        return createProjectTypeTraits(this);
    }

    get projectName() {
        if (this._store.project === this) {
            return this._store.filePath
                ? getFileNameWithoutExtension(this._store.filePath)
                : "<current project>";
        }

        if (this.importDirective) {
            return getFileNameWithoutExtension(
                this._store.getAbsoluteFilePath(
                    this.importDirective.projectFilePath
                )
            );
        }

        if (this._store.project.masterProject == this) {
            return getFileNameWithoutExtension(
                this._store.project.settings.general.masterProject
            );
        }

        throw "unknown project";
    }

    get importDirective() {
        return this._store.project.settings.general.imports.find(
            importDirective => importDirective.project === this
        );
    }

    static get classInfo(): ClassInfo {
        return getProjectClassInfo();
    }

    get namespace() {
        return this.settings.general.namespace;
    }

    get masterProjectAbsoluteFilePath() {
        return this._store.getAbsoluteFilePath(
            this.settings.general.masterProject
        );
    }

    async loadMasterProject() {
        await this._store.loadExternalProject(
            this.masterProjectAbsoluteFilePath
        );
    }

    get masterProject(): Project | undefined {
        return this.settings.general.masterProject
            ? this._store.externalProjects.get(
                  this.masterProjectAbsoluteFilePath
              )
            : undefined;
    }

    get allGlobalVariables() {
        let allVariables = this.variables
            ? [...this.variables.globalVariables]
            : [];
        for (const importDirective of this.settings.general.imports) {
            if (importDirective.project) {
                allVariables.push(
                    ...importDirective.project.variables.globalVariables
                );
            }
        }
        return allVariables;
    }

    get allActions() {
        let allActions = this.actions;
        for (const importDirective of this.settings.general.imports) {
            if (importDirective.project) {
                allActions.push(...importDirective.project.actions);
            }
        }
        return allActions;
    }

    _themeColors = new Map<string, string>();

    getThemeColor(themeId: string, colorId: string) {
        return this._themeColors.get(themeId + colorId) || "#000000";
    }

    setThemeColor(themeId: string, colorId: string, color: string) {
        this._themeColors.set(themeId + colorId, color);
    }

    get colorToIndexMap() {
        const map = new Map<String, number>();
        this.colors.forEach((color, i) => map.set(color.name, i));
        return map;
    }

    get buildColors() {
        const colors: Color[] = [];

        for (let i = 0; i < this.colors.length; i++) {
            const id = this.colors[i].id;
            if (id != undefined) {
                colors[id] = this.colors[i];
            }
        }

        for (let i = 0; i < this.colors.length; i++) {
            const id = this.colors[i].id;
            if (id == undefined) {
                let j;
                for (j = 0; j < colors.length; j++) {
                    if (colors[j] == undefined) {
                        colors[j] = this.colors[i];
                        break;
                    }
                }
                if (j == colors.length) {
                    colors.push(this.colors[i]);
                }
            }
        }

        for (let i = 0; i < colors.length; i++) {
            if (!colors[i]) {
                for (let j = 0; j < colors.length; j++) {
                    if (colors[j]) {
                        colors[i] = colors[j];
                        break;
                    }
                }
            }
        }

        return colors;
    }

    enableTabs(projectType?: ProjectType, flowSupport?: boolean) {
        function enableTab(
            layoutModel: FlexLayout.Model,
            tabId: string,
            tabJson: FlexLayout.IJsonTabNode,
            addNextToTabId: string,
            enabled: boolean
        ) {
            if (enabled) {
                if (!layoutModel.getNodeById(tabId)) {
                    const addNexToTab = layoutModel.getNodeById(
                        addNextToTabId
                    ) as FlexLayout.TabNode;

                    if (addNexToTab) {
                        layoutModel.doAction(
                            FlexLayout.Actions.addNode(
                                tabJson,
                                addNexToTab.getParent()!.getId(),
                                FlexLayout.DockLocation.CENTER,
                                -1,
                                false
                            )
                        );
                    }
                }
            } else {
                layoutModel.doAction(FlexLayout.Actions.deleteTab(tabId));
            }
        }

        if (projectType == undefined) {
            projectType = this.settings.general.projectType;
        }

        if (flowSupport == undefined) {
            flowSupport = this.projectTypeTraits.hasFlowSupport;
        }

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.FONTS_TAB_ID,
            LayoutModels.FONTS_TAB,
            LayoutModels.STYLES_TAB_ID,
            this.fonts != undefined
        );

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.BITMAPS_TAB_ID,
            LayoutModels.BITMAPS_TAB,
            LayoutModels.STYLES_TAB_ID,
            this.bitmaps != undefined
        );

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.TEXTS_TAB_ID,
            LayoutModels.TEXTS_TAB,
            LayoutModels.STYLES_TAB_ID,
            this.texts != undefined
        );

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.SCPI_TAB_ID,
            LayoutModels.SCPI_TAB,
            LayoutModels.STYLES_TAB_ID,
            this.scpi != undefined
        );

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.EXTENSION_DEFINITIONS_TAB_ID,
            LayoutModels.EXTENSION_DEFINITIONS_TAB,
            LayoutModels.STYLES_TAB_ID,
            this.extensionDefinitions != undefined
        );

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.CHANGES_TAB_ID,
            LayoutModels.CHANGES_TAB,
            LayoutModels.STYLES_TAB_ID,
            this.changes != undefined
        );

        enableTab(
            this._store.layoutModels.rootEditor,
            LayoutModels.BREAKPOINTS_TAB_ID,
            LayoutModels.BREAKPOINTS_TAB,
            LayoutModels.COMPONENTS_PALETTE_TAB_ID,
            flowSupport
        );
    }
}

registerClass("Project", Project);

////////////////////////////////////////////////////////////////////////////////

export function findAllReferencedObjects(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    return project._assetsMap["name"].allAssets.get(
        referencedObjectCollectionPath + "/" + referencedObjectName
    );
}

export function findReferencedObject(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    let objects = project._assetsMap["name"].allAssets.get(
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

export function checkAssetId(
    projectStore: ProjectStore,
    assetType: AssetType,
    asset: EezObject & {
        id: number | undefined;
    },
    messages: Message[],
    min: number = 1,
    max: number = 1000
) {
    if (asset.id != undefined) {
        if (!(asset.id >= min && asset.id <= max)) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `"Id": invalid value, should be between ${min} and ${max}.`,
                    getChildOfObject(asset, "id")
                )
            );
        } else {
            if (
                projectStore.project._assetsMap["id"].allAssets.get(
                    `${assetType}/${asset.id}`
                )!.length > 1
            ) {
                messages.push(propertyNotUniqueMessage(asset, "id"));
            }
        }
    }
}
