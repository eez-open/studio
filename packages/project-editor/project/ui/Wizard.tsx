import { dialog, getCurrentWindow } from "@electron/remote";
import fs from "fs";
import { rmdir } from "fs/promises";
import path, { resolve } from "path";
import React from "react";
import ReactDOM from "react-dom";
import { SimpleGitProgressEvent } from "simple-git";
import classNames from "classnames";
import {
    action,
    reaction,
    observable,
    runInAction,
    makeObservable,
    computed,
    IReactionDisposer,
    IObservableValue,
    autorun
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import {
    getHomePath,
    isDev,
    readJsObjectFromFile
} from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";
import { guid } from "eez-studio-shared/guid";
import { stringCompare } from "eez-studio-shared/string";

import { showDialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { SearchInput } from "eez-studio-ui/search-input";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { Icon } from "eez-studio-ui/icon";

import { homeLayoutModels } from "home/home-layout-models";
import { openProject } from "home/open-project";

import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    LVGL_PROJECT_ICON,
    LVGL_WITH_FLOW_PROJECT_ICON,
    MICROPYTHON_ICON,
    APPLET_ICON,
    IEXT_PROJECT_ICON
} from "project-editor/ui-components/icons";
import {
    EEZ_PROJECT_EXAMPLES_REPOSITORY,
    examplesCatalog
} from "project-editor/store/examples-catalog";

import {
    PROJECT_TYPE_NAMES,
    ProjectType
} from "project-editor/project/project";

// from https://envox.hr/gitea
interface TemplateProject {
    clone_url: string;
    html_url: string;

    full_name: string;
    name: string;

    _image_url: string;

    _projectType: string;
    _description: string;
    _keywords?: string;
    _displayWidth?: number;
    _displayHeight?: number;
    _targetPlatform?: string;
    _targetPlatformLink?: string;
}

export interface ExampleProject {
    repository: string;
    eezProjectPath: string;
    folder: string;
    projectName: string;

    projectType: string;
    description: string;
    image: string;
    keywords: string;
    displayWidth?: number;
    displayHeight?: number;
    targetPlatform?: string;
    targetPlatformLink?: string;
    resourceFiles: string[];
}

interface IProjectType {
    id: string;

    repository?: string;
    eezProjectPath?: string;
    folder?: string;

    projectName: string;
    defaultProjectName?: string;

    projectType: string;
    description: string;
    image: React.ReactNode;
    keywords?: string;
    displayWidth?: number;
    displayHeight?: number;
    targetPlatform?: string;
    targetPlatformLink?: string;
    language?: string;
    resourceFiles?: string[];
}

const SAVED_OPTIONS_VERSION = 11;

enum SaveOptionsFlags {
    All,
    View
}

class WizardModel {
    section: "templates" | "examples" = "templates";
    folder: string | undefined = "_allTemplates";
    type: string | undefined = "dashboard";

    lastTemplatesFolder: string | undefined = "_standard";
    lastTemplatesType: string | undefined = "dashboard";

    lastExamplesFolder: string | undefined = "_allExamples";
    lastExamplesType: string | undefined;

    _name: string | undefined;
    get name() {
        if (this._name != undefined) {
            return this._name;
        }

        return this.selectedProjectType
            ? this.selectedProjectType.defaultProjectName
            : undefined;
    }
    set name(value: string | undefined) {
        runInAction(() => {
            this._name = value;
        });
    }

    nameError: string | undefined;

    location: string | undefined = getHomePath("eez-projects");
    locationError: string | undefined;

    createDirectory: boolean = true;

    bb3ProjectOption: "download" | "local" = "download";
    bb3ProjectFileDownloadError: string | undefined;
    bb3ProjectFile: string | undefined;
    bb3ProjectFileError: string | undefined;

    projectVersion: string = "v3";

    createProjectInProgress: boolean = false;

    templateProjects: TemplateProject[] = [];

    projectCreationError: React.ReactNode | undefined;

    gitClone: boolean = true;
    gitInit: boolean = true;

    progress: string = "";

    searchText: string = "";

    dispose1: IReactionDisposer;
    dispose2: IReactionDisposer;

    lastOptions: {
        location: string | undefined;
        createDirectory: boolean;
        bb3ProjectOption: "download" | "local";
        bb3ProjectFile: string | undefined;
        projectVersion: string;
        gitClone: boolean;
        gitInit: boolean;
    };

    constructor() {
        makeObservable(this, {
            createProjectInProgress: observable,
            section: observable,
            folder: observable,
            lastTemplatesFolder: observable,
            lastTemplatesType: observable,
            lastExamplesFolder: observable,
            lastExamplesType: observable,
            type: observable,
            _name: observable,
            nameError: observable,
            location: observable,
            locationError: observable,
            createDirectory: observable,
            bb3ProjectOption: observable,
            bb3ProjectFileDownloadError: observable,
            bb3ProjectFile: observable,
            bb3ProjectFileError: observable,
            projectVersion: observable,
            templateProjects: observable,
            projectCreationError: observable,
            gitClone: observable,
            gitInit: observable,
            selectedTemplateProject: computed,
            validateName: action,
            validateLocation: action,
            validateBB3ProjectFile: action,
            progress: observable,
            searchText: observable,
            onSearchChange: action.bound,
            standardProjectTypes: computed,
            bb3ProjectTypes: computed,
            templateProjectTypes: computed,
            allTemplateProjectTypes: computed,
            switchToTemplates: action.bound,
            switchToExamples: action.bound,
            changeFolder: action.bound,
            changeType: action.bound,
            exampleProjectTypes: computed,
            exampleFolders: computed,
            projectTypes: computed,
            selectedProjectType: computed
        });

        this.loadOptions();

        examplesCatalog.onNewCatalog = () => {
            if (this.exampleProjectTypes.get("_newExamples")!.length > 0) {
                runInAction(() => {
                    this.section = "examples";
                    this.folder = "_newExamples";
                    this.type = this.projectTypes[0].id;
                });
            }
        };
    }

    loadOptions() {
        const optionsJSON = window.localStorage.getItem("project-wizard");
        if (optionsJSON) {
            try {
                const options = JSON.parse(optionsJSON);
                if (options.version == SAVED_OPTIONS_VERSION) {
                    this.section = options.section;
                    this.folder = options.folder;
                    this.type = options.type;
                    this.lastTemplatesFolder = options.lastTemplatesFolder;
                    this.lastTemplatesType = options.lastTemplatesType;
                    this.lastExamplesFolder = options.lastExamplesFolder;
                    this.lastExamplesType = options.lastExamplesType;

                    this.location = options.location;
                    this.createDirectory = options.createDirectory;
                    this.bb3ProjectOption = options.bb3ProjectOption;
                    this.bb3ProjectFile = options.bb3ProjectFile;
                    this.projectVersion = options.projectVersion;
                    this.gitClone = options.gitClone;
                    this.gitInit = options.gitInit;
                }
            } catch (err) {
                console.error(err);
            }
        }

        this.lastOptions = {
            location: this.location,
            createDirectory: this.createDirectory,
            bb3ProjectOption: this.bb3ProjectOption,
            bb3ProjectFile: this.bb3ProjectFile,
            projectVersion: this.projectVersion,
            gitClone: this.gitClone,
            gitInit: this.gitInit
        };
    }

    saveOptions(flags: SaveOptionsFlags) {
        if (flags == SaveOptionsFlags.All) {
            window.localStorage.setItem(
                "project-wizard",
                JSON.stringify({
                    version: SAVED_OPTIONS_VERSION,

                    section: this.section,
                    type: this.type,
                    folder: this.folder,
                    lastTemplatesFolder: this.lastTemplatesFolder,
                    latsTemplatesType: this.lastTemplatesType,
                    lastExamplesFolder: this.lastExamplesFolder,
                    lastExamplesType: this.lastExamplesType,

                    location: this.location,
                    createDirectory: this.createDirectory,
                    bb3ProjectOption: this.bb3ProjectOption,
                    bb3ProjectFile: this.bb3ProjectFile,
                    projectVersion: this.projectVersion,
                    gitClone: this.gitClone,
                    gitInit: this.gitInit
                })
            );

            this.lastOptions = {
                location: this.location,
                createDirectory: this.createDirectory,
                bb3ProjectOption: this.bb3ProjectOption,
                bb3ProjectFile: this.bb3ProjectFile,
                projectVersion: this.projectVersion,
                gitClone: this.gitClone,
                gitInit: this.gitInit
            };
        } else {
            window.localStorage.setItem(
                "project-wizard",
                JSON.stringify({
                    version: SAVED_OPTIONS_VERSION,

                    section: this.section,
                    type: this.type,
                    folder: this.folder,
                    lastTemplatesFolder: this.lastTemplatesFolder,
                    latsTemplatesType: this.lastTemplatesType,
                    lastExamplesFolder: this.lastExamplesFolder,
                    lastExamplesType: this.lastExamplesType,

                    location: this.lastOptions.location,
                    createDirectory: this.lastOptions.createDirectory,
                    bb3ProjectOption: this.lastOptions.bb3ProjectOption,
                    bb3ProjectFile: this.lastOptions.bb3ProjectFile,
                    projectVersion: this.lastOptions.projectVersion,
                    gitClone: this.lastOptions.gitClone,
                    gitInit: this.lastOptions.gitInit
                })
            );
        }
    }

    async fetchTemplateProjects() {
        const result = await fetch(
            "https://envox.hr/gitea/api/v1/repos/search?q=eez-flow-template&topic=true"
        );
        const data = await result.json();
        const templateProjects = data.data.map(
            (templateProject: TemplateProject) =>
                Object.assign({}, templateProject, {
                    _image_url:
                        templateProject.html_url +
                        "/raw/branch/master/template/image.png"
                })
        );

        for (const templateProject of this.templateProjects) {
            templateProject._projectType = "";
        }

        runInAction(() => {
            this.templateProjects = templateProjects;
        });

        for (const templateProject of this.templateProjects) {
            try {
                const manifestJsonUrl =
                    templateProject.html_url +
                    "/raw/branch/master/template/manifest.json";

                const manifestJson = await (
                    await fetch(manifestJsonUrl)
                ).json();

                const eezProjectUrl =
                    templateProject.html_url +
                    "/raw/branch/master/" +
                    manifestJson["eez-project-path"].replace(
                        "{{projectName}}",
                        templateProject.name
                    );

                const eezProjectJson = await (
                    await fetch(eezProjectUrl, { cache: "no-store" })
                ).json();

                const general = eezProjectJson.settings?.general;

                if (general) {
                    runInAction(() => {
                        templateProject._projectType =
                            PROJECT_TYPE_NAMES[
                                general.projectType as ProjectType
                            ];
                        templateProject._description = general.description;
                        templateProject._keywords = general.keywords;
                        templateProject._displayWidth = general.displayWidth;
                        templateProject._displayHeight = general.displayHeight;
                        templateProject._targetPlatform =
                            general.targetPlatform;
                        templateProject._targetPlatformLink =
                            general.targetPlatformLink;
                    });
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    mount() {
        runInAction(() => {
            this.name = undefined;
            this.nameError = undefined;
            this.locationError = undefined;
            this.bb3ProjectFileDownloadError = undefined;
            this.bb3ProjectFileError = undefined;

            this.createProjectInProgress = false;
            this.projectCreationError = undefined;
            this.progress = "";

            this.searchText = "";
        });

        wizardModel.fetchTemplateProjects();

        examplesCatalog.load();

        this.dispose1 = reaction(
            () => ({
                name: this.name,
                location: this.location,
                bb3ProjectFile: this.bb3ProjectFile
            }),
            () => {
                if (this.nameError) {
                    this.validateName();
                }
                if (this.locationError) {
                    this.validateLocation();
                }
                if (this.bb3ProjectFileError) {
                    this.validateBB3ProjectFile();
                }
            }
        );

        this.dispose2 = autorun(() => this.saveOptions(SaveOptionsFlags.View));
    }

    unmount() {
        this.dispose1();
        this.dispose2();
    }

    get exampleProjectTypes() {
        const map = new Map<string, IProjectType[]>();

        const _allExamples: IProjectType[] = [];
        map.set("_allExamples", _allExamples);

        const _newExamples: IProjectType[] = [];
        map.set("_newExamples", _newExamples);

        const examples = examplesCatalog.catalog
            .slice()
            .sort((a, b) => stringCompare(a.projectName, b.projectName));

        examples.forEach(example => {
            const eezProjectDownloadUrl =
                example.repository.replace(
                    "github.com",
                    "raw.githubusercontent.com"
                ) +
                "/master/" +
                example.eezProjectPath;

            const projectType: IProjectType = {
                id: eezProjectDownloadUrl,
                repository: example.repository,
                eezProjectPath: example.eezProjectPath,
                folder: example.folder,
                projectType:
                    PROJECT_TYPE_NAMES[example.projectType as ProjectType],
                defaultProjectName: example.projectName,
                projectName: example.projectName,
                description: example.description,
                image: example.image,
                keywords: example.keywords,
                displayWidth: example.displayWidth,
                displayHeight: example.displayHeight,
                targetPlatform: example.targetPlatform,
                targetPlatformLink: example.targetPlatformLink,
                resourceFiles: example.resourceFiles
            };

            if (!this.searchFilter(projectType)) {
                return;
            }

            const folderId = "_example_" + example.folder;

            let projectTypes = map.get(folderId);
            if (!projectTypes) {
                projectTypes = [];
                map.set(folderId, projectTypes);
            }
            projectTypes.push(projectType);

            _allExamples.push(projectType);

            if (
                !examplesCatalog.catalogAtStart.find(exampleAtStart => {
                    const eezProjectDownloadUrlAtStart =
                        exampleAtStart.repository.replace(
                            "github.com",
                            "raw.githubusercontent.com"
                        ) +
                        "/master/" +
                        exampleAtStart.eezProjectPath;

                    return (
                        eezProjectDownloadUrlAtStart == eezProjectDownloadUrl
                    );
                })
            ) {
                _newExamples.push(projectType);
            }
        });

        return map;
    }

    get exampleFolders(): ITreeNode {
        const rootNode: ITreeNode = {
            id: "_root",
            label: "Root",
            children: [],
            selected: false,
            expanded: true
        };

        if (this.exampleProjectTypes.get("_newExamples")!.length > 0) {
            rootNode.children.push({
                id: "_newExamples",
                label: "New Examples",
                children: [],
                selected: this.folder == "_newExamples",
                expanded: true
            });
        }

        rootNode.children.push({
            id: "_allExamples",
            label: "All Examples",
            children: [],
            selected: this.folder == "_allExamples",
            expanded: true
        });

        this.exampleProjectTypes.get("_allExamples")!.forEach(example => {
            const parts = example.folder!.split("/");

            let nodes = rootNode.children;
            let id = "_example_";

            for (const part of parts) {
                const childNodeId = id + part;

                let childNode = nodes.find(
                    childNode => childNode.id == childNodeId
                );

                if (!childNode) {
                    childNode = {
                        id: childNodeId,
                        label: part,
                        children: [],
                        selected: this.folder == childNodeId,
                        expanded: true
                    };

                    nodes.push(childNode);
                }

                nodes = childNode.children;
                id = childNodeId + "/";
            }
        });

        const exampleProjectTypes = this.exampleProjectTypes;

        function sortChildren(node: ITreeNode) {
            node.children.sort((a, b) => {
                if (a.id == "_newExamples") {
                    return -1;
                }
                if (b.id == "_newExamples") {
                    return 1;
                }

                if (a.id == "_allExamples") {
                    return -1;
                }
                if (b.id == "_allExamples") {
                    return 1;
                }

                return stringCompare(a.label as string, b.label as string);
            });

            const toRemove = [];

            for (const child of node.children) {
                const projectTypes = exampleProjectTypes.get(child.id);
                if (projectTypes) {
                    if (projectTypes.length == 0) {
                        toRemove.push(child);
                        continue;
                    }
                    child.label = (
                        <Count
                            label={child.label as string}
                            count={projectTypes.length}
                            attention={child.id == "_newExamples"}
                        />
                    );
                }

                sortChildren(child);
            }

            for (const child of toRemove) {
                node.children.splice(node.children.indexOf(child), 1);
            }
        }

        sortChildren(rootNode);

        return rootNode;
    }

    get standardProjectTypes(): IProjectType[] {
        return [
            {
                id: "dashboard",
                projectType: PROJECT_TYPE_NAMES[ProjectType.DASHBOARD],
                image: DASHBOARD_PROJECT_ICON(128),
                projectName: "Dashboard",
                description:
                    "Start your new Dashboard project development here."
            },
            {
                id: "firmware",
                projectType: PROJECT_TYPE_NAMES[ProjectType.FIRMWARE],
                image: EEZ_GUI_PROJECT_ICON(128),
                projectName: "EEZ-GUI",
                description: "Start your new EEZ-GUI project development here."
            },
            {
                id: "LVGL",
                projectType: PROJECT_TYPE_NAMES[ProjectType.LVGL],
                image: LVGL_PROJECT_ICON(128),
                projectName: "LVGL",
                description: "Start your new LVGL project development here."
            },
            {
                id: "LVGL with EEZ Flow",
                projectType: PROJECT_TYPE_NAMES[ProjectType.LVGL],
                image: LVGL_WITH_FLOW_PROJECT_ICON(128),
                projectName: "LVGL with EEZ Flow",
                description:
                    "Start your new LVGL with EEZ Flow project development here."
            },
            {
                id: "IEXT",
                projectType: PROJECT_TYPE_NAMES[ProjectType.IEXT],
                image: IEXT_PROJECT_ICON(128),
                projectName: "IEXT",
                description: "Start your new IEXT project development here."
            }
        ].filter(projectType => this.searchFilter(projectType));
    }

    get bb3ProjectTypes(): IProjectType[] {
        return [
            {
                id: "applet",
                projectType: PROJECT_TYPE_NAMES[ProjectType.APPLET],
                image: APPLET_ICON(128),
                projectName: "BB3 Applet",
                description:
                    "Start your new BB3 Applet project development here."
            },
            {
                id: "resource",
                projectType: PROJECT_TYPE_NAMES[ProjectType.RESOURCE],
                image: MICROPYTHON_ICON(128),
                projectName: "BB3 MicroPython Script",
                description:
                    "Start your new BB3 MicroPython project development here."
            }
        ].filter(projectType => this.searchFilter(projectType));
    }

    get templateProjectTypes(): IProjectType[] {
        return this.templateProjects
            .map(templateProject => ({
                id: templateProject.clone_url,
                repository: templateProject.html_url,
                projectType: templateProject._projectType,
                image: templateProject._image_url,
                projectName: templateProject.name.startsWith(
                    "eez-flow-template-"
                )
                    ? templateProject.name.substring(
                          "eez-flow-template-".length
                      )
                    : templateProject.name,
                description: templateProject._description,
                keywords: templateProject._keywords,
                displayWidth: templateProject._displayWidth,
                displayHeight: templateProject._displayHeight,
                targetPlatform: templateProject._targetPlatform,
                targetPlatformLink: templateProject._targetPlatformLink
            }))
            .filter(projectType => this.searchFilter(projectType));
    }

    get allTemplateProjectTypes(): IProjectType[] {
        return [
            ...this.standardProjectTypes,
            ...this.bb3ProjectTypes,
            ...this.templateProjectTypes
        ];
    }

    get folders(): ITreeNode {
        if (this.section == "templates") {
            const children = [];

            if (this.allTemplateProjectTypes.length > 0) {
                children.push({
                    id: "_allTemplates",
                    label: (
                        <Count
                            label="All Templates"
                            count={this.allTemplateProjectTypes.length}
                            attention={false}
                        ></Count>
                    ),
                    children: [],
                    selected: this.folder == "_allTemplates",
                    expanded: true,
                    data: undefined
                });
            }

            if (this.standardProjectTypes.length > 0) {
                children.push({
                    id: "_standard",
                    label: (
                        <Count
                            label="Builtin Templates"
                            count={this.standardProjectTypes.length}
                            attention={false}
                        ></Count>
                    ),
                    children: [],
                    selected: this.folder == "_standard",
                    expanded: true,
                    data: undefined
                });
            }

            if (this.bb3ProjectTypes.length > 0) {
                children.push({
                    id: "_bb3",
                    label: (
                        <Count
                            label="BB3 Script Templates"
                            count={this.bb3ProjectTypes.length}
                            attention={false}
                        ></Count>
                    ),
                    children: [],
                    selected: this.folder == "_bb3",
                    expanded: true,
                    data: undefined
                });
            }

            if (this.templateProjectTypes.length > 0) {
                children.push({
                    id: "_templates",
                    label: (
                        <Count
                            label="From envox.hr/gitea"
                            count={this.templateProjectTypes.length}
                            attention={false}
                        ></Count>
                    ),
                    children: [],
                    selected: this.folder == "_templates",
                    expanded: true,
                    data: undefined
                });
            }

            // children.push({
            //     id: "_advanced",
            //     label: "Advanced",
            //     children: [
            //         {
            //             id: "empty",
            //             label: "Empty",
            //             children: [],
            //             selected: this.type === "empty",
            //             expanded: false,
            //             data: undefined
            //         }
            //     ],
            //     selected: false,
            //     expanded: false,
            //     data: undefined
            // });

            return {
                id: "_root",
                label: "Root",
                children,
                selected: false,
                expanded: false,
                data: undefined
            };
        } else {
            return this.exampleFolders;
        }
    }

    get projectTypes(): IProjectType[] {
        if (this.section == "templates") {
            if (this.folder == "_allTemplates") {
                return this.allTemplateProjectTypes;
            } else if (this.folder == "_standard") {
                return this.standardProjectTypes;
            } else if (this.folder == "_bb3") {
                return this.bb3ProjectTypes;
            } else {
                return this.templateProjectTypes;
            }
        } else {
            return this.folder
                ? this.exampleProjectTypes.get(this.folder) || []
                : [];
        }
    }

    get selectedProjectType(): IProjectType | undefined {
        return this.projectTypes.find(
            projectType => projectType.id == this.type
        );
    }

    get selectedTemplateProject(): TemplateProject | undefined {
        return this.templateProjects.find(
            templateProject => templateProject.clone_url == this.type
        );
    }

    hasFolder(folder: string) {
        function hasFolder(treeNode: ITreeNode) {
            if (treeNode.id == folder) {
                return true;
            }
            for (const child of treeNode.children) {
                if (child.id == folder) {
                    return true;
                }

                if (hasFolder(child)) {
                    return true;
                }
            }
            return false;
        }
        return hasFolder(this.folders);
    }

    hasType(type: string) {
        for (const projectType of this.projectTypes) {
            if (projectType.id == type) {
                return true;
            }
        }
        return false;
    }

    switchToTemplates() {
        this.section = "templates";

        if (
            this.lastTemplatesFolder != undefined &&
            this.hasFolder(this.lastTemplatesFolder)
        ) {
            this.folder = this.lastTemplatesFolder;
        } else {
            this.folder = this.folders.children[0].id;
        }

        if (
            this.lastTemplatesType != undefined &&
            this.hasType(this.lastTemplatesType)
        ) {
            this.type = this.lastTemplatesType;
        } else {
            this.type =
                this.projectTypes.length > 0
                    ? this.projectTypes[0].id
                    : undefined;
        }

        this.name = undefined;
    }

    switchToExamples() {
        this.section = "examples";

        if (
            this.lastExamplesFolder != undefined &&
            this.hasFolder(this.lastExamplesFolder)
        ) {
            this.folder = this.lastExamplesFolder;
        } else {
            this.folder = this.folders.children[0].id;
        }

        if (
            this.lastExamplesType != undefined &&
            this.hasType(this.lastExamplesType)
        ) {
            this.type = this.lastExamplesType;
        } else {
            this.type =
                this.projectTypes.length > 0
                    ? this.projectTypes[0].id
                    : undefined;
        }

        this.name = undefined;
    }

    changeFolder(folder: string) {
        this.folder = folder;

        if (this.section == "templates") {
            this.lastTemplatesFolder = this.folder;

            if (
                this.lastTemplatesType != undefined &&
                this.hasType(this.lastTemplatesType)
            ) {
                this.type = this.lastTemplatesType;
            } else {
                this.type =
                    this.projectTypes.length > 0
                        ? this.projectTypes[0].id
                        : undefined;
            }

            this.lastTemplatesType = this.type;
        } else {
            this.lastExamplesFolder = this.folder;

            if (
                this.lastExamplesType != undefined &&
                this.hasType(this.lastExamplesType)
            ) {
                this.type = this.lastExamplesType;
            } else {
                this.type =
                    this.projectTypes.length > 0
                        ? this.projectTypes[0].id
                        : undefined;
            }

            this.lastExamplesType = this.type;

            this.name = undefined;
        }
    }

    changeType(type: string) {
        this.type = type;

        if (this.section == "templates") {
            this.lastTemplatesType = this.type;
        } else {
            this.lastExamplesType = this.type;

            this.name = undefined;
        }
    }

    async loadEezProject() {
        if (this.section == "templates") {
            const relativePath = `project-templates/${this.type}.eez-project`;

            const json = await fs.promises.readFile(
                isDev
                    ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                    : `${process.resourcesPath!}/${relativePath}`,
                "utf8"
            );

            return JSON.parse(json);
        } else {
            return new Promise<any>((resolve, reject) => {
                const projectFileUrl = this.type!;

                let req = new XMLHttpRequest();
                req.responseType = "json";
                req.open("GET", projectFileUrl);

                req.addEventListener("load", async () => {
                    if (req.readyState == 4) {
                        if (req.status != 200 || !req.response) {
                            reject("Download failed!");
                            return;
                        }
                        try {
                            resolve(req.response);
                        } catch (err) {
                            reject(err);
                        }
                    }
                });

                req.addEventListener("error", error => {
                    reject("Network error");
                });

                req.send();
            });
        }
    }

    async loadResourceFile(resourceFileRelativePath: string) {
        return new Promise<any>((resolve, reject) => {
            const resourceFileUrl =
                path.dirname(this.type!) + "/" + resourceFileRelativePath;

            let req = new XMLHttpRequest();
            req.responseType = "arraybuffer";
            req.open("GET", resourceFileUrl);

            req.addEventListener("load", async () => {
                if (req.readyState == 4) {
                    if (req.status != 200 || !req.response) {
                        reject("Download failed!");
                        return;
                    }
                    try {
                        resolve(Buffer.from(req.response));
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            req.addEventListener("error", error => {
                reject("Network error");
            });

            req.send();
        });
    }

    get projectFolderPath() {
        if (!this.location || !this.name) {
            return undefined;
        }
        if (this.selectedTemplateProject || this.createDirectory) {
            return `${this.location}${path.sep}${this.name}`;
        } else {
            return this.location;
        }
    }

    get projectFilePath() {
        if (!this.projectFolderPath) {
            return undefined;
        }
        return `${this.projectFolderPath}${path.sep}${this.name}.eez-project`;
    }

    getResourceFilePath(resourceFileRelativePath: string) {
        return `${this.projectFolderPath}${path.sep}${resourceFileRelativePath}`;
    }

    validateName() {
        const name = this.name?.trim();
        if (!name) {
            this.nameError = "This field is required.";
            return;
        }

        if (!name.match(/[a-zA-Z_\-][a-zA-Z_\-0-9]*/)) {
            this.nameError = "Invalid project name";
        }

        this.nameError = undefined;
        return true;
    }

    validateLocation() {
        const location = this.location?.trim();
        if (!location) {
            this.locationError = "This field is required.";
            return;
        }

        if (
            this.selectedTemplateProject ||
            (this.createDirectory && this.section == "templates")
        ) {
            if (fs.existsSync(this.projectFolderPath!)) {
                this.locationError = `Folder "${this.projectFolderPath}" already exists.`;
                return;
            }
        } else {
            if (
                fs.existsSync(this.projectFilePath!) &&
                this.section == "templates"
            ) {
                this.locationError =
                    "Project with the same name already exists at this location.";
                return;
            }
        }

        this.locationError = undefined;
        return true;
    }

    validateBB3ProjectFile() {
        this.bb3ProjectFileDownloadError = undefined;

        if (this.bb3ProjectOption == "download") {
            this.bb3ProjectFileError = undefined;
            return true;
        }

        const bb3ProjectFile = this.bb3ProjectFile?.trim();
        if (!bb3ProjectFile) {
            this.bb3ProjectFileError = "This field is required.";
            return;
        }

        if (!fs.existsSync(bb3ProjectFile)) {
            this.bb3ProjectFileError = "File does not exists.";
            return;
        }

        this.bb3ProjectFileError = undefined;
        return true;
    }

    downloadBB3ProjectFile() {
        return new Promise<void>((resolve, reject) => {
            const bb3ProjectFileUrl =
                this.projectVersion == "v3"
                    ? "https://raw.githubusercontent.com/eez-open/modular-psu-firmware/master/modular-psu-firmware.eez-project"
                    : "https://raw.githubusercontent.com/eez-open/modular-psu-firmware/1.7.3/modular-psu-firmware.eez-project";

            let req = new XMLHttpRequest();
            req.responseType = "json";
            req.open("GET", bb3ProjectFileUrl);

            req.addEventListener("load", async () => {
                if (req.readyState == 4) {
                    if (req.status != 200 || !req.response) {
                        reject("Download failed!");
                        return;
                    }
                    try {
                        await fs.promises.writeFile(
                            this.projectFolderPath +
                                path.sep +
                                "modular-psu-firmware.eez-project",
                            JSON.stringify(req.response, undefined, 2),
                            "utf8"
                        );

                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            req.addEventListener("error", error => {
                reject("Network error");
            });

            req.send();
        });
    }

    createProject = async (modalDialog: IObservableValue<any>) => {
        if (this.createProjectInProgress) {
            return false;
        }

        try {
            modalDialog.get()?.setControlStatus("close", "disable");
            runInAction(() => {
                this.createProjectInProgress = true;
                this.projectCreationError = undefined;
            });

            try {
                this.validateName();
                this.validateLocation();

                if (this.nameError || this.locationError) {
                    return false;
                }

                if (
                    this.section == "templates" &&
                    (this.type == "applet" || this.type == "resource")
                ) {
                    this.validateBB3ProjectFile();

                    if (this.bb3ProjectFileError) {
                        return false;
                    }
                }

                let projectFilePath: string;

                if (
                    this.selectedTemplateProject ||
                    (this.isSelectedExampleWithGitRepository && this.gitClone)
                ) {
                    const commandExists = require("command-exists").sync;
                    if (!commandExists("git")) {
                        this.projectCreationError = (
                            <div>
                                Git not installed. Install Git from{" "}
                                <a
                                    href="#"
                                    onClick={event => {
                                        event.preventDefault();
                                        openLink(
                                            "https://git-scm.com/downloads"
                                        );
                                    }}
                                >
                                    git-scm.com/downloads
                                </a>
                                .
                            </div>
                        );
                        return false;
                    }

                    const projectDirPath = this.projectFolderPath!;

                    if (this.isSelectedExampleWithGitRepository) {
                        if (fs.existsSync(projectDirPath)) {
                            if (
                                !(await confirmOverwrite(
                                    `Folder already exists:\n${projectDirPath}`
                                ))
                            ) {
                                return false;
                            }
                            await rmdir(projectDirPath, { recursive: true });
                        }
                    }

                    // do git stuff
                    const { simpleGit } = await import("simple-git");

                    runInAction(
                        () => (this.progress = "Cloning repository ...")
                    );

                    const onGitProgress = ({
                        method,
                        stage,
                        progress
                    }: SimpleGitProgressEvent) => {
                        runInAction(
                            () =>
                                (this.progress = `git.${method} ${stage} stage ${progress}% complete`)
                        );
                    };

                    await simpleGit({ progress: onGitProgress }).clone(
                        this.gitCloneUrl!,
                        projectDirPath,
                        this.gitInit && !this.isSelectedExampleWithGitRepository
                            ? {}
                            : {
                                  "--recurse-submodules": null
                              }
                    );

                    if (!this.isSelectedExampleWithGitRepository) {
                        await fs.promises.rm(projectDirPath + "/.git", {
                            recursive: true,
                            force: true
                        });
                    }

                    // execute template post processing
                    if (this.selectedTemplateProject) {
                        const postProcessing = require(projectDirPath +
                            "/template/post.js");
                        await postProcessing({
                            projectDirPath: projectDirPath,
                            projectName: this.name,
                            renameFile: async (
                                fileSrcRelativePath: string,
                                fileDstRelativePath: string
                            ) => {
                                await fs.promises.rename(
                                    projectDirPath + "/" + fileSrcRelativePath,
                                    projectDirPath + "/" + fileDstRelativePath
                                );
                            },
                            replaceInFile: async (
                                fileRelativePath: string,
                                searchValue: string,
                                newValue: string
                            ) => {
                                let content = await fs.promises.readFile(
                                    projectDirPath + "/" + fileRelativePath,
                                    "utf-8"
                                );

                                function escapeRegExp(str: string) {
                                    return str.replace(
                                        /[.*+?^${}()|[\]\\]/g,
                                        "\\$&"
                                    ); // $& means the whole matched string
                                }

                                content = content.replace(
                                    new RegExp(escapeRegExp(searchValue), "g"),
                                    newValue
                                );

                                await fs.promises.writeFile(
                                    projectDirPath + "/" + fileRelativePath,
                                    content,
                                    "utf-8"
                                );
                            }
                        });
                    }

                    // git init
                    const manifestJson = this.isSelectedExampleWithGitRepository
                        ? {}
                        : await readJsObjectFromFile(
                              projectDirPath + "/template/manifest.json"
                          );

                    if (
                        this.gitInit &&
                        !this.isSelectedExampleWithGitRepository
                    ) {
                        runInAction(() => (this.progress = "Git init ..."));
                        if (manifestJson["submodules"] != undefined) {
                            const submodules: {
                                name: string;
                                repository: string;
                                path: string;
                                branch?: string;
                            }[] = manifestJson["submodules"];

                            const git = simpleGit({
                                baseDir: projectDirPath,
                                progress: onGitProgress
                            });

                            await git.init();

                            for (const submodule of submodules) {
                                runInAction(
                                    () =>
                                        (this.progress = `Adding submodule ${submodule.name} ...`)
                                );

                                await fs.promises.rm(
                                    projectDirPath + "/" + submodule.path,
                                    {
                                        recursive: true,
                                        force: true
                                    }
                                );

                                if (submodule.branch) {
                                    await git.subModule([
                                        "add",
                                        "-b",
                                        submodule.branch,
                                        submodule.repository,
                                        submodule.path
                                    ]);
                                } else {
                                    await git.submoduleAdd(
                                        submodule.repository,
                                        submodule.path
                                    );
                                }
                            }

                            await git.add(".").commit("Inital commit");
                        } else {
                            runInAction(
                                () =>
                                    (this.progress = `Adding submodule eez-framework ...`)
                            );

                            await fs.promises.rm(
                                projectDirPath +
                                    "/" +
                                    manifestJson["eez-framework-location"],
                                {
                                    recursive: true,
                                    force: true
                                }
                            );

                            await simpleGit({
                                baseDir: projectDirPath,
                                progress: onGitProgress
                            })
                                .init()
                                .submoduleAdd(
                                    "https://github.com/eez-open/eez-framework",
                                    manifestJson["eez-framework-location"]
                                )
                                .add(".")
                                .commit("Inital commit");
                        }
                    }

                    if (this.isSelectedExampleWithGitRepository) {
                        projectFilePath =
                            projectDirPath +
                            "/" +
                            this.selectedProjectType!.eezProjectPath!;
                    } else {
                        // get projectFilePath from manifest.json
                        projectFilePath =
                            projectDirPath +
                            "/" +
                            manifestJson["eez-project-path"];

                        projectFilePath = projectFilePath.replace(
                            /(\/|\\\\)/g,
                            path.sep
                        );
                    }
                } else {
                    try {
                        await fs.promises.mkdir(this.projectFolderPath!, {
                            recursive: true
                        });
                    } catch (err) {
                        runInAction(() => {
                            this.locationError = err.toString();
                        });
                        return false;
                    }

                    projectFilePath = this.projectFilePath!;

                    // if (fs.existsSync(projectFilePath)) {
                    //     if (
                    //         !(await confirmOverwrite(
                    //             `File already exists:\n${projectFilePath}`
                    //         ))
                    //     ) {
                    //         return false;
                    //     }
                    // }

                    let projectTemplate;

                    try {
                        projectTemplate = await this.loadEezProject();
                    } catch (err) {
                        runInAction(() => {
                            this.projectCreationError = err.toString();
                        });
                        return false;
                    }

                    // set projectVersion
                    projectTemplate.settings.general.projectVersion =
                        this.type == "resource" ? this.projectVersion : "v3";

                    if (this.type == "applet" || this.type == "resource") {
                        // set masterProject
                        if (this.bb3ProjectOption == "download") {
                            try {
                                await this.downloadBB3ProjectFile();
                            } catch (err) {
                                runInAction(() => {
                                    this.bb3ProjectFileDownloadError =
                                        err.toString();
                                });
                                return false;
                            }
                            projectTemplate.settings.general.masterProject =
                                "." +
                                path.sep +
                                "modular-psu-firmware.eez-project";
                        } else {
                            projectTemplate.settings.general.masterProject =
                                path.relative(
                                    path.dirname(projectFilePath),
                                    this.bb3ProjectFile!
                                );
                        }

                        // set title bar text
                        if (this.type == "applet") {
                            projectTemplate.pages[0].components[1].widgets[1].data = `"${this.name}"`;
                        } else {
                            projectTemplate.pages[0].components[1].widgets[1].text =
                                this.name;

                            projectTemplate.micropython.code =
                                projectTemplate.micropython.code.replace(
                                    "Scripts/resource.res",
                                    `Scripts/${this.name}.res`
                                );
                        }
                    }

                    let projectTemplateStr = JSON.stringify(
                        projectTemplate,
                        undefined,
                        2
                    );

                    if (this.type == "IEXT") {
                        projectTemplateStr = projectTemplateStr.replace(
                            new RegExp(/\{\{iext-name\}\}/, "g"),
                            this.name!
                        );
                        projectTemplateStr = projectTemplateStr.replace(
                            new RegExp(/\{\{iext-build-configuration\}\}/, "g"),
                            this.name!
                        );
                        projectTemplateStr = projectTemplateStr.replace(
                            new RegExp(/\{\{iext-extension-name\}\}/, "g"),
                            this.name!
                        );
                        projectTemplateStr = projectTemplateStr.replace(
                            new RegExp(/\{\{iext-guid\}\}/, "g"),
                            guid()
                        );
                        projectTemplateStr = projectTemplateStr.replace(
                            new RegExp(/\{\{iext-sdl-friendly-name\}\}/, "g"),
                            ""
                        );
                    }

                    if (this.type == "firmware") {
                        const fontFileName = "Oswald-Medium.ttf";
                        const fontFileRelativePath = `project-templates/${fontFileName}`;
                        const fontFileSrcPath = isDev
                            ? resolve(
                                  `${sourceRootDir()}/../resources/${fontFileRelativePath}`
                              )
                            : `${process.resourcesPath!}/${fontFileRelativePath}`;
                        const fontFileDestPath = `${this.projectFolderPath}/${fontFileName}`;
                        await fs.promises.copyFile(
                            fontFileSrcPath,
                            fontFileDestPath
                        );
                    }

                    try {
                        await fs.promises.writeFile(
                            projectFilePath,
                            projectTemplateStr,
                            "utf8"
                        );
                    } catch (err) {
                        runInAction(() => {
                            this.nameError = err.toString();
                        });
                        return false;
                    }

                    const resourceFiles =
                        this.selectedProjectType?.resourceFiles;
                    if (resourceFiles && resourceFiles.length > 0) {
                        for (const resourceFile of resourceFiles) {
                            const resourceFileContent =
                                await this.loadResourceFile(resourceFile);

                            try {
                                const resourceFilePath =
                                    this.getResourceFilePath(resourceFile);

                                try {
                                    await fs.promises.mkdir(
                                        path.dirname(resourceFilePath),
                                        {
                                            recursive: true
                                        }
                                    );
                                } catch (err) {
                                    runInAction(() => {
                                        this.locationError = err.toString();
                                    });
                                    return false;
                                }

                                await fs.promises.mkdir(
                                    path.dirname(resourceFilePath),
                                    {
                                        recursive: true
                                    }
                                );

                                await fs.promises.writeFile(
                                    resourceFilePath,
                                    resourceFileContent,
                                    "binary"
                                );
                            } catch (err) {
                                runInAction(() => {
                                    this.nameError = err.toString();
                                });
                                return false;
                            }
                        }
                    }
                }

                this.saveOptions(SaveOptionsFlags.All);

                openProject(projectFilePath);

                runInAction(() => {
                    this.name = undefined;
                });

                return true;
            } catch (err) {
                console.error(err);
                this.projectCreationError = `Failed to create a new project${
                    this.progress ? ' at: "' + this.progress + '"' : ""
                }!`;
            } finally {
                runInAction(() => {
                    this.progress = "";
                });
            }

            return false;
        } finally {
            runInAction(() => {
                this.createProjectInProgress = false;
            });
            modalDialog.get()?.setControlStatus("close", "enable");
        }
    };

    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;

        this.changeFolder(
            this.section == "templates" ? "_allTemplates" : "_allExamples"
        );

        if (
            this.section == "templates" &&
            this.templateProjectTypes.length == 0 &&
            this.exampleProjectTypes.get("_allExamples")!.length > 0
        ) {
            this.section = "examples";
        } else if (
            this.section == "examples" &&
            this.exampleProjectTypes.get("_allExamples")!.length == 0 &&
            this.templateProjectTypes.length > 0
        ) {
            this.section = "templates";
        }
    }

    isGitProject(projectType: IProjectType) {
        return (
            projectType.repository &&
            projectType.repository != EEZ_PROJECT_EXAMPLES_REPOSITORY
        );
    }

    get isSelectedExampleWithGitRepository() {
        return (
            wizardModel.section == "examples" &&
            wizardModel.selectedProjectType &&
            wizardModel.isGitProject(wizardModel.selectedProjectType)
        );
    }

    get gitCloneUrl() {
        if (this.selectedTemplateProject) {
            return this.selectedTemplateProject.html_url;
        }

        return this.selectedProjectType?.repository;
    }

    searchFilter(projectType: IProjectType) {
        const parts = this.searchText.trim().toLowerCase().split("+");
        if (parts.length == 0) {
            return true;
        }

        const searchTargets = [
            projectType.projectName,
            projectType.projectType,
            projectType.description,
            projectType.keywords,
            projectType.language,
            projectType.targetPlatform,
            this.isGitProject(projectType) ? "git" : ""
        ]
            .filter(target => target && target.trim().length > 0)
            .join(", ")
            .toLowerCase();

        return !parts.find(part => searchTargets.indexOf(part) == -1);
    }
}

const wizardModel = new WizardModel();

const FoldersTree = observer(
    class FoldersTree extends React.Component {
        render() {
            return (
                <Tree
                    rootNode={wizardModel.folders}
                    selectNode={node => {
                        wizardModel.changeFolder(node.id);
                    }}
                    showOnlyChildren={true}
                    style={{ height: "100%", overflow: "auto" }}
                />
            );
        }
    }
);

const ProjectTypesList = observer(
    class ProjectTypesList extends React.Component {
        myRef = React.createRef<HTMLDivElement>();

        componentDidMount(): void {
            this.myRef.current
                ?.querySelector(
                    ".EezStudio_NewProjectWizard_ProjectType.selected"
                )
                ?.scrollIntoView({ block: "center" });
        }

        componentDidUpdate(): void {
            this.myRef.current
                ?.querySelector(
                    ".EezStudio_NewProjectWizard_ProjectType.selected"
                )
                ?.scrollIntoView({ block: "nearest" });
        }

        onKeyDown = (event: any) => {
            let focusedItemId = $(event.target)
                .find(".EezStudio_NewProjectWizard_ProjectType.selected")
                .attr("data-object-id");

            if (!focusedItemId) {
                return;
            }

            let $focusedItem = $(event.target).find(
                `.EezStudio_NewProjectWizard_ProjectType[data-object-id="${focusedItemId}"]`
            );

            if (
                event.keyCode == 38 ||
                event.keyCode == 40 ||
                event.keyCode == 33 ||
                event.keyCode == 34 ||
                event.keyCode == 36 ||
                event.keyCode == 35
            ) {
                let $rows = $(event.target).find(
                    ".EezStudio_NewProjectWizard_ProjectType"
                );
                let index = $rows.index($focusedItem);

                let pageSize = Math.floor(
                    $(event.target).parent().height()! /
                        $($rows[0]).outerHeight()!
                );

                if (event.keyCode == 38) {
                    // up
                    index--;
                } else if (event.keyCode == 40) {
                    // down
                    index++;
                } else if (event.keyCode == 33) {
                    // page up
                    index -= pageSize;
                } else if (event.keyCode == 34) {
                    // page down
                    index += pageSize;
                } else if (event.keyCode == 36) {
                    // home
                    index = 0;
                } else if (event.keyCode == 35) {
                    // end
                    index = $rows.length - 1;
                }

                if (index < 0) {
                    index = 0;
                } else if (index >= $rows.length) {
                    index = $rows.length - 1;
                }

                let newFocusedItemId = $($rows[index]).attr("data-object-id");
                if (newFocusedItemId) {
                    wizardModel.changeType(newFocusedItemId);
                    ($rows[index] as Element).scrollIntoView({
                        block: "nearest",
                        behavior: "auto"
                    });
                }

                event.preventDefault();
            }
        };

        render() {
            return (
                <div
                    className="EezStudio_NewProjectWizard_ProjectTypes"
                    ref={this.myRef}
                    tabIndex={0}
                    onKeyDown={this.onKeyDown}
                >
                    {wizardModel.projectTypes.map(projectType => (
                        <ProjectTypeComponent
                            key={projectType.id}
                            projectType={projectType}
                        />
                    ))}
                </div>
            );
        }
    }
);

const ProjectTypeComponent = observer(
    class ProjectTypeComponent extends React.Component<{
        projectType: IProjectType;
    }> {
        zoomed: boolean = false;

        constructor(props: any) {
            super(props);

            makeObservable(this, { zoomed: observable });
        }

        render() {
            const { projectType } = this.props;

            const selected = wizardModel.type == projectType.id;

            let zoomedImage;
            if (this.zoomed) {
                zoomedImage = ReactDOM.createPortal(
                    <div
                        className="EezStudio_NewProjectWizard_ProjectType_Image_Zoomed_Container"
                        onClick={action(() => (this.zoomed = false))}
                    >
                        <div className="EezStudio_NewProjectWizard_ProjectType_Image_Zoomed_Backface"></div>
                        <div className="EezStudio_NewProjectWizard_ProjectType_Image_Zoomed_Image">
                            <Icon icon={projectType.image} size={128} />
                        </div>
                    </div>,
                    document.body
                );
            }

            const imageZoomEnabled =
                selected && wizardModel.section == "examples";

            return (
                <div
                    key={projectType.id}
                    className={classNames(
                        "EezStudio_NewProjectWizard_ProjectType",
                        {
                            selected
                        }
                    )}
                    data-object-id={projectType.id}
                    onClick={() => {
                        wizardModel.changeType(projectType.id);
                    }}
                >
                    <div
                        className={classNames(
                            "EezStudio_NewProjectWizard_ProjectType_Image",
                            { imageZoomEnabled }
                        )}
                    >
                        <Icon
                            icon={projectType.image}
                            size={128}
                            onClick={
                                imageZoomEnabled
                                    ? action(() => (this.zoomed = true))
                                    : undefined
                            }
                        />
                    </div>
                    {zoomedImage}
                    <div className="EezStudio_NewProjectWizard_ProjectType_Details">
                        <div className="EezStudio_NewProjectWizard_ProjectType_Details_Title">
                            <h6>{projectType.projectName}</h6>
                            {projectType.repository &&
                                projectType.repository !=
                                    EEZ_PROJECT_EXAMPLES_REPOSITORY && (
                                    <a
                                        href="#"
                                        onClick={event => {
                                            event.preventDefault();
                                            openLink(projectType.repository!);
                                        }}
                                        title="Project Github Repository"
                                    >
                                        INFO
                                    </a>
                                )}
                        </div>
                        {projectType.keywords && (
                            <div className="EezStudio_NewProjectWizard_ProjectType_Details_Keywords">
                                {projectType.keywords
                                    .split(" ")
                                    .map(keyword => (
                                        <span
                                            key={keyword}
                                            className="badge bg-info"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                            </div>
                        )}
                        <div className="EezStudio_NewProjectWizard_ProjectType_Details_Description">
                            {projectType.description}
                        </div>

                        <ProjectTypeInfo
                            infoList={{
                                Type: projectType.projectType,
                                Language: projectType.language,
                                Resolution:
                                    projectType.displayWidth != undefined &&
                                    projectType.displayHeight != undefined
                                        ? `${projectType.displayWidth} x ${projectType.displayHeight}`
                                        : undefined,
                                "LVGL version":
                                    projectType.projectType ==
                                    PROJECT_TYPE_NAMES[ProjectType.LVGL]
                                        ? "8.3"
                                        : undefined
                            }}
                        />
                    </div>
                </div>
            );
        }
    }
);

function ProjectTypeInfo(props: {
    infoList: {
        [key: string]: string | undefined;
    };
}) {
    const infoList: string[] = Object.keys(props.infoList).filter(
        infoName => props.infoList[infoName] != undefined
    );

    return (
        <div className="EezStudio_NewProjectWizard_ProjectType_Details_InfoList">
            {infoList.map((infoName: string, i: number) => (
                <span key={infoName}>
                    <span className="lighter">{infoName}: </span>
                    <span className="bolder">{props.infoList[infoName]}</span>
                    {i < infoList.length - 1 && (
                        <span className="lighter"> | </span>
                    )}
                </span>
            ))}
        </div>
    );
}

const ProjectProperties = observer(
    class ProjectProperties extends React.Component<{
        modalDialog: IObservableValue<any>;
    }> {
        onOk = async () => {
            const success = await wizardModel.createProject(
                this.props.modalDialog
            );
            if (success) {
                this.props.modalDialog.get()?.close();
            }
        };

        render() {
            if (wizardModel.type == undefined) {
                return null;
            }

            if (wizardModel.createProjectInProgress) {
                return (
                    <div className="EezStudio_NewProjectWizard_CreateProjectProgress">
                        <h6>Creating project ...</h6>
                        <Loader />
                        <div>{wizardModel.progress || <span>&nbsp;</span>}</div>
                    </div>
                );
            }

            return (
                <div className="EezStudio_NewProjectWizard_ProjectProperties">
                    <PlatformDescription />

                    <div className="EezStudio_NewProjectWizard_ProjectProperties_Section">
                        <h6>Project Settings</h6>
                        <div>
                            <div className="mb-3">
                                <label
                                    htmlFor="new-project-wizard-name-input"
                                    className="form-label"
                                >
                                    Name
                                </label>
                                <NameInput
                                    id="new-project-wizard-name-input"
                                    value={wizardModel.name || ""}
                                    onChange={action(
                                        (value: string | undefined) =>
                                            (wizardModel.name = value)
                                    )}
                                />
                                {wizardModel.nameError && (
                                    <div className="form-text text-danger">
                                        {wizardModel.nameError}
                                    </div>
                                )}
                            </div>

                            <div className="mb-3">
                                <label
                                    htmlFor="new-project-wizard-location-input"
                                    className="col-form-label"
                                >
                                    Location
                                </label>
                                <DirectoryBrowserInput
                                    value={wizardModel.location || ""}
                                    onChange={action(
                                        (value: string | undefined) =>
                                            (wizardModel.location = value)
                                    )}
                                />
                                {wizardModel.locationError && (
                                    <div className="form-text text-danger">
                                        {wizardModel.locationError}
                                    </div>
                                )}
                            </div>

                            {!(
                                wizardModel.selectedTemplateProject ||
                                (wizardModel.isSelectedExampleWithGitRepository &&
                                    wizardModel.gitClone)
                            ) && (
                                <div className="mb-3 form-check">
                                    <input
                                        id="new-project-wizard-create-directory-checkbox"
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={wizardModel.createDirectory}
                                        onChange={action(
                                            event =>
                                                (wizardModel.createDirectory =
                                                    event.target.checked)
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-create-directory-checkbox"
                                    >
                                        Create directory
                                    </label>
                                </div>
                            )}

                            <div className="mb-3">
                                <label
                                    htmlFor="new-project-wizard-project-path-static"
                                    className="form-label"
                                >
                                    {wizardModel.selectedTemplateProject ||
                                    (wizardModel.isSelectedExampleWithGitRepository &&
                                        wizardModel.gitClone)
                                        ? "Project folder path"
                                        : "Project file path"}
                                </label>
                                <div
                                    id="new-project-wizard-project-path-static"
                                    className="form-control EezStudio_NewProjectWizard_StaticField"
                                >
                                    {(wizardModel.selectedTemplateProject ||
                                    (wizardModel.isSelectedExampleWithGitRepository &&
                                        wizardModel.gitClone)
                                        ? wizardModel.projectFolderPath
                                        : wizardModel.projectFilePath) || (
                                        <span>&nbsp;</span>
                                    )}
                                </div>
                            </div>

                            {wizardModel.isSelectedExampleWithGitRepository && (
                                <div className="mb-3 form-check">
                                    <input
                                        id="new-project-wizard-git-clone-checkbox"
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={wizardModel.gitClone}
                                        onChange={action(
                                            event =>
                                                (wizardModel.gitClone =
                                                    event.target.checked)
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-git-clone-checkbox"
                                    >
                                        Clone Git repository
                                    </label>
                                    <div className="form-text">
                                        Check this if you want to download the
                                        entire repository not only eez-project
                                        file and its dependencies.
                                    </div>
                                </div>
                            )}

                            {wizardModel.selectedTemplateProject && (
                                <div className="mb-3 form-check">
                                    <input
                                        id="new-project-wizard-git-init-checkbox"
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={wizardModel.gitInit}
                                        onChange={action(
                                            event =>
                                                (wizardModel.gitInit =
                                                    event.target.checked)
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-git-init-checkbox"
                                    >
                                        Initialize as Git repository
                                    </label>
                                </div>
                            )}

                            {wizardModel.section == "templates" &&
                                (wizardModel.type == "applet" ||
                                    wizardModel.type == "resource") && (
                                    <>
                                        <div className="mb-3">
                                            <label className="form-label">
                                                BB3 project file option
                                            </label>

                                            <div className="form-check ms-4">
                                                <input
                                                    id="new-project-wizard-bb3-project-download"
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="new-project-wizard-bb3-project"
                                                    value={"download"}
                                                    checked={
                                                        wizardModel.bb3ProjectOption ==
                                                        "download"
                                                    }
                                                    onChange={action(
                                                        event =>
                                                            (wizardModel.bb3ProjectOption =
                                                                event.target
                                                                    .checked
                                                                    ? "download"
                                                                    : "local")
                                                    )}
                                                />

                                                <label
                                                    className="form-check-label"
                                                    htmlFor="new-project-wizard-bb3-project-download"
                                                >
                                                    Download from GitHub
                                                </label>

                                                {wizardModel.bb3ProjectOption ==
                                                    "download" &&
                                                    wizardModel.bb3ProjectFileDownloadError && (
                                                        <div className="form-text text-danger">
                                                            {
                                                                wizardModel.bb3ProjectFileDownloadError
                                                            }
                                                        </div>
                                                    )}
                                            </div>

                                            <div className="form-check ms-4">
                                                <input
                                                    id="new-project-wizard-bb3-project-local"
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="new-project-wizard-bb3-project"
                                                    value={1}
                                                    checked={
                                                        wizardModel.bb3ProjectOption ==
                                                        "local"
                                                    }
                                                    onChange={action(
                                                        event =>
                                                            (wizardModel.bb3ProjectOption =
                                                                event.target
                                                                    .checked
                                                                    ? "local"
                                                                    : "download")
                                                    )}
                                                />

                                                <label
                                                    className="form-check-label"
                                                    htmlFor="new-project-wizard-bb3-project-local"
                                                >
                                                    I already have a local copy
                                                </label>
                                            </div>
                                        </div>

                                        {wizardModel.bb3ProjectOption ==
                                            "local" && (
                                            <div className="mb-3">
                                                <label
                                                    htmlFor="new-project-wizard-bb3-project-file-path-input"
                                                    className="form-label"
                                                >
                                                    BB3 project file path
                                                </label>
                                                <FileBrowserInput
                                                    id="new-project-wizard-bb3-project-file-path-input"
                                                    value={
                                                        wizardModel.bb3ProjectFile
                                                    }
                                                    onChange={action(
                                                        (
                                                            value:
                                                                | string
                                                                | undefined
                                                        ) =>
                                                            (wizardModel.bb3ProjectFile =
                                                                value)
                                                    )}
                                                />
                                                {wizardModel.bb3ProjectFileError && (
                                                    <div className="form-text text-danger">
                                                        {
                                                            wizardModel.bb3ProjectFileError
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                            {wizardModel.section == "templates" &&
                                wizardModel.type == "resource" && (
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Target BB3 firmware
                                        </label>

                                        <div className="form-check ms-4">
                                            <input
                                                id="new-project-wizard-bb3-target-version-v3"
                                                className="form-check-input"
                                                type="radio"
                                                name="new-project-wizard-bb3-target"
                                                value={"v3"}
                                                checked={
                                                    wizardModel.projectVersion ==
                                                    "v3"
                                                }
                                                onChange={action(
                                                    event =>
                                                        (wizardModel.projectVersion =
                                                            event.target.checked
                                                                ? "v3"
                                                                : "v2")
                                                )}
                                            />
                                            <label
                                                className="form-check-label"
                                                htmlFor="new-project-wizard-bb3-target-version-v3"
                                            >
                                                1.8 or newer
                                            </label>
                                        </div>

                                        <div className="form-check ms-4">
                                            <input
                                                id="new-project-wizard-bb3-target-version-v2"
                                                className="form-check-input"
                                                type="radio"
                                                name="new-project-wizard-bb3-target"
                                                value={"v2"}
                                                checked={
                                                    wizardModel.projectVersion ==
                                                    "v2"
                                                }
                                                onChange={action(
                                                    event =>
                                                        (wizardModel.projectVersion =
                                                            event.target.checked
                                                                ? "v2"
                                                                : "v3")
                                                )}
                                            />
                                            <label
                                                className="form-check-label"
                                                htmlFor="new-project-wizard-bb3-target-version-v2"
                                            >
                                                1.7.X or older
                                            </label>
                                        </div>
                                    </div>
                                )}

                            <div className="d-flex justify-content-end">
                                <button
                                    className="btn btn-success"
                                    onClick={this.onOk}
                                    disabled={
                                        wizardModel.createProjectInProgress
                                    }
                                >
                                    Create Project
                                </button>
                            </div>

                            {wizardModel.projectCreationError && (
                                <div className="EezStudio_NewProjectWizard_CreationStatus">
                                    <div
                                        className="alert alert-danger"
                                        style={{ flex: 1 }}
                                    >
                                        {wizardModel.projectCreationError}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    }
);

function PlatformDescription() {
    if (!wizardModel.selectedProjectType) {
        return null;
    }

    if (!wizardModel.selectedProjectType.targetPlatform) {
        return null;
    }

    const showdown = require("showdown");
    const converter = new showdown.Converter();
    const html = {
        __html: converter.makeHtml(
            wizardModel.selectedProjectType.targetPlatform || ""
        )
    };

    const targetPlatformLink =
        wizardModel.selectedProjectType.targetPlatformLink;

    return (
        <div className="EezStudio_NewProjectWizard_ProjectProperties_Section">
            <h6>
                <span>
                    {wizardModel.selectedProjectType.projectType == "IEXT"
                        ? "Instrument"
                        : "Platform"}{" "}
                    Description
                </span>
            </h6>
            <div>
                <div className="markdown" dangerouslySetInnerHTML={html} />
                {targetPlatformLink && (
                    <div className="mt-2">
                        <a
                            href="#"
                            onClick={event => {
                                event.preventDefault();
                                openLink(targetPlatformLink);
                            }}
                        >
                            Find more on the platform web site ...
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export const NewProjectWizard = observer(
    class NewProjectWizard extends React.Component<{
        modalDialog: IObservableValue<any>;
    }> {
        constructor(props: any) {
            super(props);
        }

        componentDidMount() {
            wizardModel.mount();
        }

        componentWillUnmount() {
            wizardModel.unmount();
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "FoldersTree") {
                return <FoldersTree />;
            }

            if (component === "ProjectTypesList") {
                return <ProjectTypesList />;
            }

            if (component === "ProjectProperties") {
                return (
                    <ProjectProperties modalDialog={this.props.modalDialog} />
                );
            }

            return null;
        };

        render() {
            return (
                <div
                    className={classNames("EezStudio_NewProjectWizard", {
                        disabled: wizardModel.createProjectInProgress
                    })}
                >
                    <div className="EezStudio_NewProjectWizard_Navigation">
                        <div
                            className={classNames(
                                "EezStudio_NewProjectWizard_NavigationItem",
                                { selected: wizardModel.section == "templates" }
                            )}
                            onClick={wizardModel.switchToTemplates}
                        >
                            <Count
                                label="Templates"
                                count={
                                    wizardModel.searchText
                                        ? wizardModel.allTemplateProjectTypes
                                              .length
                                        : undefined
                                }
                                attention={false}
                            />
                        </div>
                        <div
                            className={classNames(
                                "EezStudio_NewProjectWizard_NavigationItem",
                                { selected: wizardModel.section == "examples" }
                            )}
                            onClick={wizardModel.switchToExamples}
                        >
                            <Count
                                label="Examples"
                                count={
                                    wizardModel.searchText
                                        ? wizardModel.exampleProjectTypes.get(
                                              "_allExamples"
                                          )!.length
                                        : undefined
                                }
                                attention={
                                    wizardModel.exampleProjectTypes.get(
                                        "_newExamples"
                                    )!.length > 0
                                }
                            />
                        </div>
                    </div>

                    <SearchInput
                        searchText={wizardModel.searchText}
                        onClear={action(() => {
                            wizardModel.searchText = "";
                        })}
                        onChange={wizardModel.onSearchChange}
                    />

                    <div className="EezStudio_NewProjectWizard_Body">
                        {wizardModel.folders.children.length > 0 ? (
                            <FlexLayoutContainer
                                model={
                                    this.props.modalDialog.get()
                                        ? homeLayoutModels.newProjectWizardDialog
                                        : homeLayoutModels.newProjectWizard
                                }
                                factory={this.factory}
                            />
                        ) : (
                            <div className="EezStudio_NewProjectWizard_NoProjects">
                                No{" "}
                                {wizardModel.section == "templates"
                                    ? "templates"
                                    : "examples"}{" "}
                                found
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

export function showNewProjectWizard() {
    const modalDialogObservable = observable.box<any>();

    const [modalDialog] = showDialog(
        <NewProjectWizard modalDialog={modalDialogObservable} />,
        {
            jsPanel: {
                id: "new-project-wizard",
                title: "New Project",
                width: 1280,
                height: 800
            }
        }
    );

    modalDialogObservable.set(modalDialog);
}

class NameInput extends React.Component<{
    id?: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    render() {
        return (
            <input
                type="text"
                id={this.props.id}
                className="form-control"
                value={this.props.value || ""}
                onChange={event => this.props.onChange(event.target.value)}
                spellCheck={false}
            />
        );
    }
}

class DirectoryBrowserInput extends React.Component<{
    id?: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    onSelect = async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openDirectory"]
        });

        if (result.filePaths && result.filePaths[0]) {
            this.props.onChange(result.filePaths[0]);
        }
    };

    render() {
        return (
            <div className="input-group">
                <input
                    type="text"
                    id={this.props.id}
                    className="form-control"
                    value={this.props.value || ""}
                    onChange={event => this.props.onChange(event.target.value)}
                    spellCheck={false}
                />
                <>
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={this.onSelect}
                    >
                        &hellip;
                    </button>
                </>
            </div>
        );
    }
}

class FileBrowserInput extends React.Component<{
    id?: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    onSelect = async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [
                { name: "EEZ Project", extensions: ["eez-project"] },
                { name: "All Files", extensions: ["*"] }
            ]
        });

        if (result.filePaths && result.filePaths[0]) {
            this.props.onChange(result.filePaths[0]);
        }
    };

    render() {
        return (
            <div className="input-group">
                <input
                    type="text"
                    id={this.props.id}
                    className="form-control"
                    value={this.props.value || ""}
                    onChange={event => this.props.onChange(event.target.value)}
                    spellCheck={false}
                />
                <>
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={this.onSelect}
                    >
                        &hellip;
                    </button>
                </>
            </div>
        );
    }
}

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}

export async function confirmOverwrite(description: string) {
    const yesButton = {
        label: "Yes",
        result: true
    };
    const noButton = { label: "No", result: false };

    const os = require("os");

    const buttons: any[] = [];
    if (os.platform() == "win32") {
        buttons.push(yesButton, noButton);
    } else if (os.platform() == "linux") {
        buttons.push(noButton, yesButton);
    } else {
        buttons.push(yesButton, noButton);
    }

    let opts: Electron.MessageBoxOptions = {
        type: "warning",
        title: "EEZ Studio",
        message: "Overwite?",
        detail: description,
        noLink: true,
        buttons: buttons.map(b => b.label),
        defaultId: os.platform() == "linux" ? 0 : 1,
        cancelId: buttons.indexOf(noButton)
    };

    const result = await dialog.showMessageBox(getCurrentWindow(), opts);
    const buttonIndex = result.response;
    return buttons[buttonIndex].result;
}

const Count = observer(
    ({
        label,
        count,
        attention
    }: {
        label: string;
        count: number | undefined;
        attention: boolean;
    }) => {
        return (
            <>
                <span>
                    {label}{" "}
                    {attention && (
                        <div className="EezStudio_AttentionContainer">
                            <div className="EezStudio_AttentionDiv" />
                        </div>
                    )}
                </span>
                {count != undefined && (
                    <span
                        className={classNames(
                            "badge rounded-pill bg-secondary"
                        )}
                    >
                        {count}
                    </span>
                )}
            </>
        );
    }
);
