import React from "react";
import { observable, computed, action, makeObservable } from "mobx";
import css from "css";
import * as FlexLayout from "flexlayout-react";

import {
    fileExistsSync,
    getFileNameWithoutExtension
} from "eez-studio-shared/util-electron";
import { pascalCase } from "eez-studio-shared/string";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    ProjectType,
    MessageType,
    IMessage,
    PropertyProps
} from "project-editor/core/object";
import {
    getChildOfObject,
    Message,
    propertyNotSetMessage,
    propertyInvalidValueMessage,
    ProjectStore,
    getProjectStore,
    LayoutModels,
    createObject,
    updateObject
} from "project-editor/store";
import {
    isLVGLProject,
    isNotDashboardProject,
    isNotLVGLProject,
    isNotV1Project
} from "project-editor/project/project-type-traits";

import type { Action } from "project-editor/features/action/action";
import type { ProjectVariables } from "project-editor/features/variable/variable";
import type { Scpi } from "project-editor/features/scpi/scpi";
import type { InstrumentCommands } from "project-editor/features/instrument-commands/instrument-commands";
import type { Shortcuts } from "project-editor/features/shortcuts/project-shortcuts";
import type { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";
import type { MicroPython } from "project-editor/features/micropython/micropython";

import { visitObjects } from "project-editor/core/search";
import {
    Color,
    Theme,
    getProjectWithThemes
} from "project-editor/features/style/theme";
import type { Page } from "project-editor/features/page/page";
import type { Style } from "project-editor/features/style/style";
import type { Font } from "project-editor/features/font/font";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Texts } from "project-editor/features/texts";
import { Readme } from "project-editor/features/readme";
import { Changes } from "project-editor/features/changes";
import { validators } from "eez-studio-shared/validation";
import { createProjectTypeTraits } from "./project-type-traits";
import type { LVGLStyle, LVGLStyles } from "project-editor/lvgl/style";
import { Assets } from "project-editor/project/assets";
import { getProject } from "project-editor/project/helper";
import { ImportDirectiveCustomUI } from "project-editor/project/ui/AssetsUsage";
import { observer } from "mobx-react";
import { extensions } from "eez-studio-shared/extensions/extensions";
import { Button } from "eez-studio-ui/button";
import { showSelectProjectExtensionDialog } from "home/extensions-manager/select-project-extension-dialog";

export { ProjectType } from "project-editor/core/object";

import { isArray } from "eez-studio-shared/util";
import type { CommandsProtocolType } from "eez-studio-shared/extensions/extension";

export * from "project-editor/project/assets";
export * from "project-editor/project/helper";

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
                disabled: isNotV1Project
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
        check: (object: BuildConfiguration, messages: IMessage[]) => {
            if (object.properties) {
                try {
                    JSON.parse(object.properties);
                } catch (err) {
                    messages.push(
                        propertyInvalidValueMessage(object, "properties")
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

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
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New File",
                    fields: [
                        {
                            name: "fileName",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.filePath,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            });

            const buildFileProperties: Partial<BuildFile> = {
                fileName: result.values.fileName,
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

    override makeEditable() {
        super.makeEditable();

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
    generateSourceCodeForEezFramework: boolean;
    compressFlowDefinition: boolean;
    executionQueueSize: number;
    expressionEvaluatorStackSize: number;

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
                disabled: isNotLVGLProject
            },
            {
                name: "generateSourceCodeForEezFramework",
                displayName:
                    "Generate source code for EEZ Flow engine (eez-framework)",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: object =>
                    isNotLVGLProject(object) ||
                    !getProject(object).projectTypeTraits.hasFlowSupport
            },
            {
                name: "compressFlowDefinition",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: (object: Build) =>
                    isNotLVGLProject(object) ||
                    !getProject(object).projectTypeTraits.hasFlowSupport ||
                    !object.generateSourceCodeForEezFramework
            },
            {
                name: "executionQueueSize",
                type: PropertyType.Number,
                disabled: (object: Build) =>
                    isNotLVGLProject(object) ||
                    !getProject(object).projectTypeTraits.hasFlowSupport ||
                    !object.generateSourceCodeForEezFramework
            },
            {
                name: "expressionEvaluatorStackSize",
                type: PropertyType.Number,
                disabled: (object: Build) =>
                    isNotLVGLProject(object) ||
                    !getProject(object).projectTypeTraits.hasFlowSupport ||
                    !object.generateSourceCodeForEezFramework
            }
        ],

        beforeLoadHook: (object: Build, jsObject: Partial<Build>) => {
            if (!jsObject.lvglInclude) {
                jsObject.lvglInclude = "lvgl/lvgl.h";
            }

            if (jsObject.generateSourceCodeForEezFramework == undefined) {
                jsObject.generateSourceCodeForEezFramework = false;
            }

            if (jsObject.compressFlowDefinition == undefined) {
                jsObject.compressFlowDefinition = false;
            }

            if (jsObject.executionQueueSize == undefined) {
                jsObject.executionQueueSize = 1000;
            }

            if (jsObject.expressionEvaluatorStackSize == undefined) {
                jsObject.expressionEvaluatorStackSize = 20;
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
                    projectStore.project.settings.general.lvglVersion,
                    values.lvglInclude
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            configurations: observable,
            files: observable,
            destinationFolder: observable,
            lvglInclude: observable,
            generateSourceCodeForEezFramework: observable,
            compressFlowDefinition: observable,
            executionQueueSize: observable,
            expressionEvaluatorStackSize: observable
        });
    }
}

registerClass("Build", Build);

////////////////////////////////////////////////////////////////////////////////

export class ImportDirective extends EezObject {
    projectFilePath: string;
    importAs: string;

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
                name: "importAs",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "customUI",
                displayName: "Actions",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: ImportDirectiveCustomUI,
                skipSearch: true,
                hideInPropertyGrid: (importObject: ImportDirective) =>
                    !importObject.project
            }
        ],
        listLabel: (importDirective: ImportDirective, collapsed: boolean) => {
            if (!collapsed) return "";
            if (importDirective.importAs) {
                return `"${importDirective.projectFilePath}" As ${importDirective.importAs}`;
            }
            return importDirective.projectFilePath;
        },
        defaultValue: {},
        check: (object: ImportDirective, messages: IMessage[]) => {
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
        }
        /*
        ,getImportedProject: (importDirective: ImportDirective) => ({
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
        */
    };

    constructor() {
        super();

        makeObservable(this, {
            project: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            projectFilePath: observable,
            importAs: observable
        });
    }

    get project(): Project | undefined {
        const projectStore = getProjectStore(this);
        return this.projectFilePath
            ? projectStore.openProjectsManager.getImportDirectiveProject(this)
            : undefined;
    }
}

registerClass("ImportDirective", ImportDirective);

////////////////////////////////////////////////////////////////////////////////

export const ExtensionDirectiveCustomUI = observer((props: PropertyProps) => {
    if (props.objects.length != 1) {
        return null;
    }
    const extensionDirective = props.objects[0] as ExtensionDirective;
    return extensions.get(extensionDirective.extensionName) ? null : (
        <Button
            color="primary"
            size="small"
            onClick={() => {}}
            style={{ marginTop: 10 }}
        >
            Install
        </Button>
    );
});

export class ExtensionDirective extends EezObject {
    extensionName: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "extensionName",
                type: PropertyType.String,
                disableSpellcheck: true,

                onSelect: async (
                    object: IEezObject,
                    propertyInfo: PropertyInfo
                ) => {
                    const project = ProjectEditor.getProject(object);

                    const extensionName =
                        await showSelectProjectExtensionDialog(
                            project.settings.general.extensions.map(
                                extension => extension.extensionName
                            )
                        );

                    updateObject(object, {
                        extensionName
                    });
                }
            },
            {
                name: "customUI",
                displayName: " ",
                type: PropertyType.Any,
                computed: true,
                propertyGridRowComponent: ExtensionDirectiveCustomUI
            }
        ],
        listLabel: (object: ExtensionDirective, collapsed: boolean) => {
            if (!collapsed) return "";
            return object.extensionName;
        },
        defaultValue: {},
        check: (object: ExtensionDirective, messages: IMessage[]) => {
            if (object.extensionName) {
                if (!object.isInstalled) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Extension ${object.extensionName} is not installed`,
                            getChildOfObject(object, "extensionName")
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "extensionName"));
            }
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            isInstalled: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            extensionName: observable
        });
    }

    get isInstalled() {
        return (
            !this.extensionName ||
            extensions.get(this.extensionName) != undefined
        );
    }
}

registerClass("ExtensionDirective", ExtensionDirective);

////////////////////////////////////////////////////////////////////////////////

export class ResourceFile extends EezObject {
    filePath: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "filePath",
                type: PropertyType.RelativeFile,
                fileFilters: [{ name: "All Files", extensions: ["*"] }],
                isOptional: false
            }
        ],
        listLabel: (resourceFile: ResourceFile, collapsed: boolean) => {
            if (!collapsed) return "";
            return resourceFile.filePath;
        },
        defaultValue: {},
        check: (object: ResourceFile, messages: IMessage[]) => {
            if (object.filePath) {
                if (
                    !fileExistsSync(
                        getProjectStore(object).getAbsoluteFilePath(
                            object.filePath
                        )
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            "File doesn't exists",
                            getChildOfObject(object, "filePath")
                        )
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(object, "filePath"));
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            filePath: observable
        });
    }
}

registerClass("ResourceFile", ResourceFile);

////////////////////////////////////////////////////////////////////////////////

export type ProjectVersion = "v1" | "v2" | "v3";

export const PROJECT_TYPE_NAMES = {
    [ProjectType.UNDEFINED]: "Undefined",
    [ProjectType.FIRMWARE]: "EEZ-GUI",
    [ProjectType.FIRMWARE_MODULE]: "EEZ-GUI Library",
    [ProjectType.RESOURCE]: "BB3 MicroPython Script",
    [ProjectType.APPLET]: "BB3 Applet",
    [ProjectType.DASHBOARD]: "Dashboard",
    [ProjectType.LVGL]: "LVGL",
    [ProjectType.IEXT]: "IEXT"
};

export class General extends EezObject {
    projectVersion: ProjectVersion = "v3";
    projectType: ProjectType;
    commandsProtocol: CommandsProtocolType;
    lvglVersion: "8.3" | "9.0";
    commandsDocFolder?: string;
    masterProject: string;
    extensions: ExtensionDirective[];
    imports: ImportDirective[];
    flowSupport: boolean;
    displayWidth: number;
    displayHeight: number;
    circularDisplay: boolean;
    displayBorderRadius: number;
    darkTheme: boolean;
    colorFormat: string;
    //css: string;

    icon: string;
    title: string;

    description: string;
    image: string;
    keywords: string;
    targetPlatform: string;
    targetPlatformLink: string;
    author: string;
    authorLink: string;
    minStudioVersion: string;
    resourceFiles: ResourceFile[];

    lockedWidgetLinesOption: "visible" | "dimmed" | "hidden";
    dimmedLinesOpacity: number;

    static classInfo: ClassInfo = {
        label: () => "General",
        properties: [
            {
                name: "projectType",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: ProjectType.UNDEFINED,
                        label: PROJECT_TYPE_NAMES[ProjectType.UNDEFINED]
                    },
                    {
                        id: ProjectType.FIRMWARE,
                        label: PROJECT_TYPE_NAMES[ProjectType.FIRMWARE]
                    },
                    {
                        id: ProjectType.FIRMWARE_MODULE,
                        label: PROJECT_TYPE_NAMES[ProjectType.FIRMWARE_MODULE]
                    },
                    {
                        id: ProjectType.RESOURCE,
                        label: PROJECT_TYPE_NAMES[ProjectType.RESOURCE]
                    },
                    {
                        id: ProjectType.APPLET,
                        label: PROJECT_TYPE_NAMES[ProjectType.APPLET]
                    },
                    {
                        id: ProjectType.DASHBOARD,
                        label: PROJECT_TYPE_NAMES[ProjectType.DASHBOARD]
                    },
                    {
                        id: ProjectType.LVGL,
                        label: PROJECT_TYPE_NAMES[ProjectType.LVGL]
                    },
                    {
                        id: ProjectType.IEXT,
                        label: PROJECT_TYPE_NAMES[ProjectType.IEXT]
                    }
                ],
                readOnlyInPropertyGrid: (general: General) =>
                    general.projectType != ProjectType.UNDEFINED
            },
            {
                name: "projectVersion",
                displayName: (object: General) => {
                    if (object.projectType == ProjectType.RESOURCE) {
                        return "Target BB3 firmware";
                    }
                    return "Project version";
                },
                type: PropertyType.Enum,
                enumItems: (object: General) => {
                    if (object.projectType == ProjectType.RESOURCE) {
                        return [
                            { id: "v2", label: "1.7.X or older" },
                            { id: "v3", label: "1.8 or newer" }
                        ];
                    } else {
                        return [{ id: "v1" }, { id: "v2" }, { id: "v3" }];
                    }
                },
                disabled: (general: General) =>
                    general.projectType != ProjectType.UNDEFINED &&
                    general.projectType != ProjectType.RESOURCE &&
                    general.projectVersion == "v3"
            },
            {
                name: "commandsProtocol",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "SCPI", label: "SCPI" },
                    { id: "PROPRIETARY", label: "Proprietary" }
                ],
                enumDisallowUndefined: true,
                readOnlyInPropertyGrid: true,
                disabled: (general: General) =>
                    general.projectType != ProjectType.IEXT &&
                    general.projectType != ProjectType.FIRMWARE
            },
            {
                name: "lvglVersion",
                displayName: "LVGL version",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "8.3", label: "8.x" },
                    { id: "9.0", label: "9.x" }
                ],
                enumDisallowUndefined: true,
                disabled: (general: General) =>
                    general.projectType != ProjectType.LVGL
            },
            {
                name: "commandsDocFolder",
                displayName: (object: General) =>
                    getProject(object).scpi
                        ? "SCPI documentation folder"
                        : "Commands documentation folder",
                type: PropertyType.RelativeFolder,
                disabled: (object: IEezObject) => {
                    const project = getProject(object);
                    return !project.scpi && !project.instrumentCommands;
                }
            },
            {
                name: "masterProject",
                type: PropertyType.RelativeFile,
                fileFilters: [
                    { name: "EEZ Project", extensions: ["eez-project"] },
                    { name: "All Files", extensions: ["*"] }
                ],
                disabled: (general: General) => {
                    return !(
                        general.projectType == ProjectType.RESOURCE ||
                        general.projectType == ProjectType.APPLET
                    );
                }
            },
            {
                name: "extensions",
                type: PropertyType.Array,
                typeClass: ExtensionDirective,
                defaultValue: [],
                partOfNavigation: false,
                enumerable: false,
                formText:
                    "After adding an extension, you need to reload the project to see the changes. To reload the project select 'Reload Project' from the 'File' menu.",
                disabled: (general: General) =>
                    ProjectEditor.getProject(general).projectTypeTraits.isIEXT
            },
            {
                name: "imports",
                type: PropertyType.Array,
                typeClass: ImportDirective,
                defaultValue: [],
                disabled: (general: General) => {
                    const project = getProject(general);
                    return (
                        !!project.masterProject ||
                        project.projectTypeTraits.isApplet ||
                        project.projectTypeTraits.isIEXT
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
                disabled: (general: General) =>
                    !ProjectEditor.getProject(general).projectTypeTraits
                        .hasDisplaySizeProperty
            },
            {
                name: "displayHeight",
                type: PropertyType.Number,
                disabled: (general: General) =>
                    !ProjectEditor.getProject(general).projectTypeTraits
                        .hasDisplaySizeProperty
            },
            {
                name: "circularDisplay",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: isNotLVGLProject
            },
            {
                name: "displayBorderRadius",
                type: PropertyType.Number,
                disabled: (general: General) =>
                    isNotLVGLProject(general) || general.circularDisplay
            },
            {
                name: "darkTheme",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: isNotLVGLProject
            },
            {
                name: "colorFormat",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "RGB", label: "RGB" },
                    { id: "BGR", label: "BGR" }
                ],
                disabled: (general: General) => {
                    const project = getProject(general);
                    return !project.projectTypeTraits.isFirmware;
                }
            },
            {
                name: "flowSupport",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                disabled: (general: General) => {
                    return (
                        general.projectType != ProjectType.FIRMWARE &&
                        general.projectType != ProjectType.FIRMWARE_MODULE &&
                        general.projectType != ProjectType.LVGL
                    );
                }
            },
            {
                name: "lockedWidgetLinesOption",
                displayName: "Lines visibility for hidden widgets",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "visible", label: "Fully visible" },
                    { id: "dimmed", label: "Dimmed" },
                    { id: "hidden", label: "Hidden" }
                ],
                enumDisallowUndefined: true,
                disabled: (general: General) => {
                    return (
                        !general.flowSupport &&
                        general.projectType != ProjectType.DASHBOARD
                    );
                }
            },
            {
                name: "dimmedLinesOpacity",
                displayName: "Dimmed lines opacity (%)",
                type: PropertyType.Number,
                disabled: (general: General) => {
                    return (
                        (!general.flowSupport &&
                            general.projectType != ProjectType.DASHBOARD) ||
                        general.lockedWidgetLinesOption != "dimmed"
                    );
                }
            },
            {
                name: "title",
                type: PropertyType.String,
                disabled: isNotDashboardProject
            },
            {
                name: "icon",
                type: PropertyType.Image,
                embeddedImage: true,
                disabled: isNotDashboardProject
            },

            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "image",
                type: PropertyType.Image,
                embeddedImage: true
            },
            {
                name: "keywords",
                type: PropertyType.String
            },
            {
                name: "targetPlatform",
                displayName: (general: General) =>
                    general.projectType == ProjectType.IEXT
                        ? "Target instrument"
                        : "Target platform",
                type: PropertyType.MultilineText
            },
            {
                name: "targetPlatformLink",
                displayName: (general: General) =>
                    general.projectType == ProjectType.IEXT
                        ? "Target instrument link"
                        : "Target platform link",
                type: PropertyType.String
            },
            {
                name: "author",
                type: PropertyType.String
            },
            {
                name: "authorLink",
                type: PropertyType.String
            },
            {
                name: "minStudioVersion",
                displayName: "Min. studio version",
                type: PropertyType.String
            },
            {
                name: "resourceFiles",
                type: PropertyType.Array,
                typeClass: ResourceFile,
                defaultValue: [],
                partOfNavigation: false,
                enumerable: false,
                disabled: (general: General) =>
                    general.projectType == ProjectType.IEXT
            }
        ],
        check: (general: General, messages: IMessage[]) => {
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

            if (jsObject.projectType == "lvgl") {
                if (jsObject.lvglVersion == undefined) {
                    jsObject.lvglVersion = "8.3";
                }
            }

            if (jsObject.colorFormat == undefined) {
                if (
                    jsObject.projectType == ProjectType.FIRMWARE ||
                    jsObject.projectType == ProjectType.FIRMWARE_MODULE ||
                    jsObject.projectType == ProjectType.RESOURCE ||
                    jsObject.projectType == ProjectType.APPLET
                ) {
                    jsObject.colorFormat = jsObject.flowSupport ? "RGB" : "BGR";
                } else if (jsObject.projectType == ProjectType.LVGL) {
                    jsObject.colorFormat = "BGR";
                } else {
                    jsObject.colorFormat = "RGB";
                }
            }

            // MIGRATION TO LOW RES
            if ((window as any).__eezProjectMigration) {
                jsObject.displayWidth =
                    __eezProjectMigration.displayTargetWidth;
                jsObject.displayHeight =
                    __eezProjectMigration.displayTargetHeight;
            }

            if (jsObject.commandsDocFolder == undefined) {
                jsObject.commandsDocFolder = jsObject.scpiDocFolder;
            }

            if (
                jsObject.projectType == ProjectType.IEXT ||
                jsObject.projectType == ProjectType.FIRMWARE
            ) {
                if (jsObject.commandsProtocol == undefined) {
                    jsObject.commandsProtocol = "SCPI";
                }
            }

            if (jsObject.displayBorderRadius == undefined) {
                jsObject.displayBorderRadius = 0;
            }

            if (jsObject.lockedWidgetLinesOption == undefined) {
                jsObject.lockedWidgetLinesOption = "dimmed";
            }

            if (jsObject.dimmedLinesOpacity == undefined) {
                jsObject.dimmedLinesOpacity = "20";
            }
        },

        updateObjectValueHook: (general: General, values: Partial<General>) => {
            const projectStore = getProjectStore(general);
            if (
                projectStore.projectTypeTraits.isLVGL &&
                values.lvglVersion != undefined &&
                general.lvglVersion != values.lvglVersion
            ) {
                ProjectEditor.rebuildLvglFonts(
                    projectStore,
                    values.lvglVersion,
                    projectStore.project.settings.build.lvglInclude
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            projectVersion: observable,
            projectType: observable,
            lvglVersion: observable,
            commandsDocFolder: observable,
            masterProject: observable,
            extensions: observable,
            imports: observable,
            flowSupport: observable,
            displayWidth: observable,
            displayHeight: observable,
            circularDisplay: observable,
            displayBorderRadius: observable,
            darkTheme: observable,
            colorFormat: observable,
            description: observable,
            image: observable,
            keywords: observable,
            targetPlatform: observable,
            targetPlatformLink: observable,
            author: observable,
            authorLink: observable,
            minStudioVersion: observable,
            resourceFiles: observable,
            commandsProtocol: observable,
            lockedWidgetLinesOption: observable,
            dimmedLinesOpacity: observable
        });
    }
}

registerClass("General", General);

////////////////////////////////////////////////////////////////////////////////

export class Settings extends EezObject {
    general: General;
    build: Build;

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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            general: observable,
            build: observable
        });
    }
}

registerClass("Settings", Settings);

////////////////////////////////////////////////////////////////////////////////

let projectClassInfo: ClassInfo;
let numProjectFeatures = 0;
let builtinProjectProperties: PropertyInfo[];
let projectProperties: PropertyInfo[] = [];

function getProjectClassInfo() {
    if (!projectClassInfo) {
        builtinProjectProperties = [
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

                                if (isArray(enumItems)) {
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

                if (projectJs.pages) {
                    projectJs.userPages = projectJs.pages.filter(
                        (page: any) =>
                            !(
                                page.isUsedAsCustomWidget ||
                                page.isUsedAsUserWidget
                            )
                    );

                    projectJs.userWidgets = projectJs.pages.filter(
                        (page: any) =>
                            page.isUsedAsCustomWidget || page.isUsedAsUserWidget
                    );

                    delete projectJs.pages;
                }

                if (projectJs.styles) {
                    const rootStyles = [];
                    for (const style1 of projectJs.styles) {
                        if (!style1.childStyles) {
                            style1.childStyles = [];
                        }

                        if (style1.inheritFrom) {
                            let found = false;
                            for (const style2 of projectJs.styles) {
                                if (style2.name == style1.inheritFrom) {
                                    if (!style2.childStyles) {
                                        style2.childStyles = [style1];
                                    } else {
                                        style2.childStyles.push(style1);
                                    }
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                style1.useStyle = style1.inheritFrom;
                                rootStyles.push(style1);
                            }
                            delete style1.inheritFrom;
                        } else {
                            rootStyles.push(style1);
                        }
                    }
                    projectJs.styles = rootStyles;
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
                                                    css: declarations
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
                            projectFeature.key == "instrumentCommands" ||
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
                check: (object: IEezObject, messages: IMessage[]) => {
                    if (projectFeature.check) {
                        projectFeature.check(
                            getProjectStore(object),
                            object,
                            messages
                        );
                    }
                },
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

export class Project extends EezObject {
    _store!: ProjectStore;
    _isReadOnly: boolean = false;
    _isDashboardBuild: boolean = false;
    _fullyLoaded = false;
    _assets = new Assets(this);

    settings: Settings;
    variables: ProjectVariables;
    actions: Action[];
    userPages: Page[];
    userWidgets: Page[];
    styles: Style[];
    lvglStyles: LVGLStyles;
    bitmaps: Bitmap[];
    fonts: Font[];
    texts: Texts;
    readme: Readme;
    scpi: Scpi;
    instrumentCommands: InstrumentCommands;
    shortcuts: Shortcuts;
    micropython: MicroPython;
    extensionDefinitions: ExtensionDefinition[];
    changes: Changes;
    colors: Color[];
    themes: Theme[];

    constructor() {
        super();

        makeObservable(this, {
            _themeColors: observable,
            pages: computed,
            projectName: computed,
            importDirective: computed,
            masterProject: computed({ keepAlive: true }),
            allGlobalVariables: computed({ keepAlive: true }),
            allVisibleGlobalVariables: computed({ keepAlive: true }),
            importAsList: computed({ keepAlive: true }),
            colorToIndexMap: computed,
            buildColors: computed({ keepAlive: true }),
            projectTypeTraits: computed,
            _objectsMap: computed,
            missingExtensions: computed,
            allStyles: computed,
            allLvglStyles: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            _fullyLoaded: observable,
            settings: observable,
            variables: observable,
            actions: observable,
            userPages: observable,
            userWidgets: observable,
            styles: observable,
            fonts: observable,
            texts: observable,
            readme: observable,
            bitmaps: observable,
            scpi: observable,
            instrumentCommands: observable,
            shortcuts: observable,
            micropython: observable,
            extensionDefinitions: observable,
            changes: observable,
            colors: observable,
            themes: observable,

            setThemeColor: action
        });
    }

    get _objectsMap() {
        const objectsMap = new Map<string, EezObject>();

        for (const object of visitObjects(this)) {
            if (object instanceof EezObject) {
                objectsMap.set(object.objID, object);
            }
        }

        return objectsMap;
    }

    get pages() {
        return [...this.userPages, ...this.userWidgets];
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

    get masterProject(): Project | undefined {
        return this._store.openProjectsManager.getMasterProject(this);
    }

    get allGlobalVariables() {
        let allVariables = [];

        for (const project of this._store.openProjectsManager.projects) {
            if (project.variables) {
                allVariables.push(...project.variables.globalVariables);
            }
        }

        return allVariables;
    }

    get allVisibleGlobalVariables() {
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

    get importAsList() {
        return this.settings.general.imports
            .filter(importDirective => !!importDirective.importAs)
            .map(importDirective => importDirective.importAs);
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

        const projectWithThemes = getProjectWithThemes(this._store);

        for (const color of projectWithThemes.colors) {
            const id = color.id;
            if (id != undefined) {
                colors[id] = color;
            }
        }

        for (const color of projectWithThemes.colors) {
            const id = color.id;
            if (id == undefined) {
                let j;
                for (j = 0; j < colors.length; j++) {
                    if (colors[j] == undefined) {
                        colors[j] = color;
                        break;
                    }
                }
                if (j == colors.length) {
                    colors.push(color);
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

        function enableTabOnBorder(
            layoutModel: FlexLayout.Model,
            tabId: string,
            tabJson: FlexLayout.IJsonTabNode,
            borderLocation: FlexLayout.DockLocation,
            enabled: boolean
        ) {
            if (enabled) {
                if (!layoutModel.getNodeById(tabId)) {
                    const borderNode = layoutModel
                        .getBorderSet()
                        .getBorders()
                        .find(border => border.getLocation() == borderLocation);

                    if (borderNode) {
                        layoutModel.doAction(
                            FlexLayout.Actions.addNode(
                                tabJson,
                                borderNode.getId(),
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
            flowSupport =
                this.projectTypeTraits.hasFlowSupport &&
                !this.projectTypeTraits.isIEXT;
        }

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.STYLES_TAB_ID,
            LayoutModels.STYLES_TAB,
            FlexLayout.DockLocation.RIGHT,
            this.styles != undefined || this.lvglStyles != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.FONTS_TAB_ID,
            LayoutModels.FONTS_TAB,
            FlexLayout.DockLocation.RIGHT,
            this.fonts != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.BITMAPS_TAB_ID,
            LayoutModels.BITMAPS_TAB,
            FlexLayout.DockLocation.RIGHT,
            this.bitmaps != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.THEMES_TAB_ID,
            LayoutModels.THEMES_TAB,
            FlexLayout.DockLocation.RIGHT,
            !this.projectTypeTraits.isLVGL
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.TEXTS_TAB_ID,
            LayoutModels.TEXTS_TAB,
            FlexLayout.DockLocation.LEFT,
            this.texts != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.SCPI_TAB_ID,
            LayoutModels.SCPI_TAB,
            FlexLayout.DockLocation.LEFT,
            this.scpi != undefined
        );
        enableTabOnBorder(
            this._store.layoutModels.rootEditorForIEXT,
            LayoutModels.SCPI_TAB_ID,
            LayoutModels.SCPI_TAB,
            FlexLayout.DockLocation.LEFT,
            this.scpi != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.INSTRUMENT_COMMANDS_TAB_ID,
            LayoutModels.INSTRUMENT_COMMANDS_TAB,
            FlexLayout.DockLocation.LEFT,
            this.instrumentCommands != undefined
        );
        enableTabOnBorder(
            this._store.layoutModels.rootEditorForIEXT,
            LayoutModels.INSTRUMENT_COMMANDS_TAB_ID,
            LayoutModels.INSTRUMENT_COMMANDS_TAB,
            FlexLayout.DockLocation.LEFT,
            this.instrumentCommands != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.EXTENSION_DEFINITIONS_TAB_ID,
            LayoutModels.EXTENSION_DEFINITIONS_TAB,
            FlexLayout.DockLocation.LEFT,
            this.extensionDefinitions != undefined
        );

        enableTabOnBorder(
            this._store.layoutModels.rootEditor,
            LayoutModels.CHANGES_TAB_ID,
            LayoutModels.CHANGES_TAB,
            FlexLayout.DockLocation.LEFT,
            this.changes != undefined
        );
        enableTabOnBorder(
            this._store.layoutModels.rootEditorForIEXT,
            LayoutModels.CHANGES_TAB_ID,
            LayoutModels.CHANGES_TAB,
            FlexLayout.DockLocation.LEFT,
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

    get missingExtensions() {
        return this.settings.general.extensions.filter(
            extension => !extension.isInstalled
        );
    }

    get allStyles() {
        const styles: Style[] = [];

        function addStyles(style: Style) {
            styles.push(style);
            for (const childStyle of style.childStyles) {
                addStyles(childStyle);
            }
        }

        if (this.styles) {
            for (const style of this.styles) {
                addStyles(style);
            }
        }

        return styles;
    }

    get allLvglStyles() {
        const lvglStyles: LVGLStyle[] = [];

        function addStyles(style: LVGLStyle) {
            lvglStyles.push(style);
            for (const childStyle of style.childStyles) {
                addStyles(childStyle);
            }
        }

        if (this.lvglStyles) {
            for (const style of this.lvglStyles.styles) {
                addStyles(style);
            }
        }

        return lvglStyles;
    }
}

registerClass("Project", Project);

////////////////////////////////////////////////////////////////////////////////
