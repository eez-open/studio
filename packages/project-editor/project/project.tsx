import { observable, computed, action, makeObservable } from "mobx";
import css from "css";
import * as FlexLayout from "flexlayout-react";

import {
    fileExistsSync,
    getFileNameWithoutExtension
} from "eez-studio-shared/util-electron";
import { _map, _filter, _max, _min } from "eez-studio-shared/algorithm";
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
    IMessage
} from "project-editor/core/object";
import {
    getChildOfObject,
    Message,
    propertyNotSetMessage,
    propertyInvalidValueMessage,
    ProjectStore,
    getProjectStore,
    LayoutModels,
    createObject
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
import type { LVGLStyles } from "project-editor/lvgl/style";
import { Assets } from "project-editor/project/assets";
import { getProject } from "project-editor/project/helper";
import { ImportDirectiveCustomUI } from "project-editor/project/ui/AssetsUsage";

export { ProjectType } from "project-editor/core/object";

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
                hideInPropertyGrid: (importObject: ImportDirective) =>
                    !importObject.project
            }
        ],
        listLabel: (importDirective: ImportDirective, collapsed: boolean) => {
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
            projectFilePath: observable,
            project: computed,
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

export type ProjectVersion = "v1" | "v2" | "v3";

export class General extends EezObject {
    projectVersion: ProjectVersion = "v3";
    projectType: ProjectType;
    scpiDocFolder?: string;
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
                name: "projectType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: ProjectType.UNDEFINED, label: "Undefined" },
                    { id: ProjectType.FIRMWARE, label: "EEZ-GUI" },
                    {
                        id: ProjectType.FIRMWARE_MODULE,
                        label: "EEZ-GUI Library"
                    },
                    {
                        id: ProjectType.RESOURCE,
                        label: "BB3 MicroPython Script"
                    },
                    { id: ProjectType.APPLET, label: "BB3 Applet" },
                    { id: ProjectType.DASHBOARD },
                    { id: ProjectType.LVGL, label: "LVGL" }
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
                hideInPropertyGrid: (general: General) =>
                    general.projectType != ProjectType.UNDEFINED &&
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
                arrayItemOrientation: "vertical",
                hideInPropertyGrid: (general: General) => {
                    const projectStore = getProjectStore(general);
                    return (
                        !!getProject(general).masterProject ||
                        projectStore.projectTypeTraits.isApplet
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

            /*
            // MIGRATION TO LOW RES
            jsObject.displayWidth = 480;
            jsObject.displayHeight = 272;
            */
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            projectVersion: observable,
            projectType: observable,
            scpiDocFolder: observable,
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
            masterProject: computed({ keepAlive: true }),
            allGlobalVariables: computed({ keepAlive: true }),
            allVisibleGlobalVariables: computed({ keepAlive: true }),
            importAsList: computed({ keepAlive: true }),
            _themeColors: observable,
            setThemeColor: action,
            colorToIndexMap: computed,
            buildColors: computed({ keepAlive: true }),
            projectTypeTraits: computed,
            _objectsMap: computed
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
            flowSupport = this.projectTypeTraits.hasFlowSupport;
        }

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
