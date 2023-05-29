import { dialog } from "@electron/remote";
import fs from "fs";
import path, { resolve } from "path";

import React from "react";
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

import { showDialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { SearchInput } from "eez-studio-ui/search-input";

import { SimpleGitProgressEvent } from "simple-git";
import { openProject } from "home/open-project";
import classNames from "classnames";
import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    MICROPYTHON_ICON
} from "project-editor/ui-components/icons";
import { Icon } from "eez-studio-ui/icon";
import { examplesCatalog } from "project-editor/store/examples-catalog";
import { stringCompare } from "eez-studio-shared/string";

class NameInput extends React.Component<{
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    render() {
        return (
            <input
                type="text"
                className="form-control"
                value={this.props.value || ""}
                onChange={event => this.props.onChange(event.target.value)}
                spellCheck={false}
            />
        );
    }
}

class DirectoryBrowserInput extends React.Component<{
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
                        Browse ...
                    </button>
                </>
            </div>
        );
    }
}

class FileBrowserInput extends React.Component<{
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
                        Browse ...
                    </button>
                </>
            </div>
        );
    }
}

interface TemplateProject {
    clone_url: string;
    description: string;
    full_name: string;
    html_url: string;
    name: string;
    _image_url: string;
}

const SAVED_OPTIONS_VERSION = 10;

enum SaveOptionsFlags {
    All,
    View
}

interface IProjectType {
    id: string;
    icon: React.ReactNode;
    label: string;
    defaultName?: string;
}

class WizardModel {
    section: "templates" | "examples" = "templates";
    category: string | undefined = "_standard";
    type: string | undefined = "dashboard";

    lastTemplatesCategory: string | undefined = "_standard";
    lastTemplatesType: string | undefined = "dashboard";

    lastExamplesCategory: string | undefined = "_allExamples";
    lastExamplesType: string | undefined;

    _name: string | undefined;
    get name() {
        if (this._name) {
            return this._name;
        }
        return this.projectType ? this.projectType.defaultName : undefined;
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
        gitInit: boolean;
    };

    constructor() {
        makeObservable(this, {
            createProjectInProgress: observable,
            section: observable,
            category: observable,
            lastTemplatesCategory: observable,
            lastTemplatesType: observable,
            lastExamplesCategory: observable,
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
            allProjectTypes: computed,
            switchToTemplates: action.bound,
            switchToExamples: action.bound,
            changeCategory: action.bound,
            changeType: action.bound
        });

        this.loadOptions();
    }

    loadOptions() {
        const optionsJSON = window.localStorage.getItem("project-wizard");
        if (optionsJSON) {
            try {
                const options = JSON.parse(optionsJSON);
                if (options.version == SAVED_OPTIONS_VERSION) {
                    this.section = options.section;
                    this.category = options.category;
                    this.type = options.type;
                    this.lastTemplatesCategory = options.lastTemplatesCategory;
                    this.lastTemplatesType = options.lastTemplatesType;
                    this.lastExamplesCategory = options.lastExamplesCategory;
                    this.lastExamplesType = options.lastExamplesType;

                    this.location = options.location;
                    this.createDirectory = options.createDirectory;
                    this.bb3ProjectOption = options.bb3ProjectOption;
                    this.bb3ProjectFile = options.bb3ProjectFile;
                    this.projectVersion = options.projectVersion;
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
                    category: this.category,
                    lastTemplatesCategory: this.lastTemplatesCategory,
                    latsTemplatesType: this.lastTemplatesType,
                    lastExamplesCategory: this.lastExamplesCategory,
                    lastExamplesType: this.lastExamplesType,

                    location: this.location,
                    createDirectory: this.createDirectory,
                    bb3ProjectOption: this.bb3ProjectOption,
                    bb3ProjectFile: this.bb3ProjectFile,
                    projectVersion: this.projectVersion,
                    gitInit: this.gitInit
                })
            );

            this.lastOptions = {
                location: this.location,
                createDirectory: this.createDirectory,
                bb3ProjectOption: this.bb3ProjectOption,
                bb3ProjectFile: this.bb3ProjectFile,
                projectVersion: this.projectVersion,
                gitInit: this.gitInit
            };
        } else {
            window.localStorage.setItem(
                "project-wizard",
                JSON.stringify({
                    version: SAVED_OPTIONS_VERSION,

                    section: this.section,
                    type: this.type,
                    category: this.category,
                    lastTemplatesCategory: this.lastTemplatesCategory,
                    latsTemplatesType: this.lastTemplatesType,
                    lastExamplesCategory: this.lastExamplesCategory,
                    lastExamplesType: this.lastExamplesType,

                    location: this.lastOptions.location,
                    createDirectory: this.lastOptions.createDirectory,
                    bb3ProjectOption: this.lastOptions.bb3ProjectOption,
                    bb3ProjectFile: this.lastOptions.bb3ProjectFile,
                    projectVersion: this.lastOptions.projectVersion,
                    gitInit: this.lastOptions.gitInit
                })
            );
        }
    }

    fetchTemplateProjects() {
        fetch(
            "https://envox.hr/gitea/api/v1/repos/search?q=eez-flow-template&topic=true"
        )
            .then(response => response.json())
            .then(data => {
                runInAction(() => {
                    this.templateProjects = data.data.map(
                        (templateProject: TemplateProject) =>
                            Object.assign({}, templateProject, {
                                _image_url:
                                    templateProject.html_url +
                                    "/raw/branch/master/template/image.png"
                            })
                    );
                });
            });
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

    get exampleCategoryProjectTypes() {
        const map = new Map<string, IProjectType[]>();

        const _allExamples: IProjectType[] = [];

        map.set("_allExamples", _allExamples);

        examplesCatalog.catalog.forEach(example => {
            const projectType: IProjectType = {
                id: example.path,
                defaultName: example.name,
                icon: example.image,
                label: example.name
            };

            const categoryId = "_example_" + path.dirname(example.path);

            let categoryProjectTypes = map.get(categoryId);
            if (!categoryProjectTypes) {
                categoryProjectTypes = [];
                map.set(categoryId, categoryProjectTypes);
            }
            categoryProjectTypes.push(projectType);

            _allExamples.push(projectType);
        });

        return map;
    }

    get exampleCategories(): ITreeNode {
        const rootNode: ITreeNode = {
            id: "_root",
            label: "Root",
            children: [
                {
                    id: "_allExamples",
                    label: "<All Examples>",
                    children: [],
                    selected: this.category == "_allExamples",
                    expanded: true
                }
            ],
            selected: false,
            expanded: true
        };

        examplesCatalog.catalog.forEach(example => {
            const examplePath = path.dirname(example.path).split("/");

            let nodes = rootNode.children;
            let id = "_example_";

            for (const part of examplePath) {
                const childNodeId = id + part;

                let childNode = nodes.find(
                    childNode => childNode.id == childNodeId
                );

                if (!childNode) {
                    childNode = {
                        id: childNodeId,
                        label: part,
                        children: [],
                        selected: this.category == childNodeId,
                        expanded: true
                    };

                    nodes.push(childNode);
                }

                nodes = childNode.children;
                id = childNodeId + "/";
            }
        });

        const exampleCategoryProjectTypes = this.exampleCategoryProjectTypes;

        function sortChildren(node: ITreeNode) {
            const projectTypes = exampleCategoryProjectTypes.get(node.id);
            if (projectTypes) {
                node.label = `${node.label} (${projectTypes.length})`;
            }

            node.children.sort((a, b) => {
                return stringCompare(a.label as string, b.label as string);
            });

            for (const child of node.children) {
                sortChildren(child);
            }
        }

        sortChildren(rootNode);

        return rootNode;
    }

    get categories(): ITreeNode {
        if (this.section == "templates") {
            return {
                id: "_root",
                label: "Root",
                children: [
                    {
                        id: "_allTemplates",
                        label: `<All Templates> (${this.allProjectTypes.length})`,
                        children: [],
                        selected: this.category == "_allTemplates",
                        expanded: true,
                        data: undefined
                    },
                    {
                        id: "_standard",
                        label: `Builtin Templates (${this.standardProjectTypes.length})`,
                        children: [],
                        selected: this.category == "_standard",
                        expanded: true,
                        data: undefined
                    },
                    {
                        id: "_bb3",
                        label: `BB3 Script Templates (${this.bb3ProjectTypes.length}) `,
                        children: [],
                        selected: this.category == "_bb3",
                        expanded: true,
                        data: undefined
                    },
                    {
                        id: "_templates",
                        label: (
                            <span>
                                Templates from{" "}
                                <a
                                    href="#"
                                    onClick={event => {
                                        event.preventDefault();
                                        openLink(
                                            "https://envox.hr/gitea/explore/repos?q=eez-flow-template&topic=1"
                                        );
                                    }}
                                >
                                    envox.hr/gitea
                                </a>
                                {` (${this.templateProjects.length})`}
                            </span>
                        ),
                        children: [],
                        selected: this.category == "_templates",
                        expanded: true,
                        data: undefined
                    }
                    /*,
                    {
                        id: "_advanced",
                        label: "Advanced",
                        children: [
                            {
                                id: "empty",
                                label: "Empty",
                                children: [],
                                selected: this.type === "empty",
                                expanded: false,
                                data: undefined
                            }
                        ],
                        selected: false,
                        expanded: false,
                        data: undefined
                    }
                    */
                ],
                selected: false,
                expanded: false,
                data: undefined
            };
        } else {
            return this.exampleCategories;
        }
    }

    get standardProjectTypes(): IProjectType[] {
        return [
            {
                id: "dashboard",
                icon: DASHBOARD_PROJECT_ICON(128),
                label: "Dashboard"
            },
            {
                id: "firmware",
                icon: EEZ_GUI_PROJECT_ICON(128),
                label: "EEZ-GUI"
            },
            {
                id: "LVGL",
                icon: "../eez-studio-ui/_images/eez-project-lvgl.png",
                label: "LVGL"
            }
        ];
    }

    get bb3ProjectTypes(): IProjectType[] {
        return [
            {
                id: "applet",
                icon: MICROPYTHON_ICON(128),
                label: "Applet"
            },
            {
                id: "resource",
                icon: EEZ_GUI_PROJECT_ICON(128),
                label: "MicroPython Script"
            }
        ];
    }

    get templateProjectTypes(): IProjectType[] {
        return this.templateProjects.map(templateProject => ({
            id: templateProject.clone_url,
            icon: templateProject._image_url,
            label: templateProject.name.startsWith("eez-flow-template-")
                ? templateProject.name.substring("eez-flow-template-".length)
                : templateProject.name
        }));
    }

    get allProjectTypes(): IProjectType[] {
        return [
            ...this.standardProjectTypes,
            ...this.bb3ProjectTypes,
            ...this.templateProjectTypes
        ];
    }

    get projectTypes(): IProjectType[] {
        if (this.section == "templates") {
            if (this.category == "_allTemplates") {
                return this.allProjectTypes;
            } else if (this.category == "_standard") {
                return this.standardProjectTypes;
            } else if (this.category == "_bb3") {
                return this.bb3ProjectTypes;
            } else {
                return this.templateProjectTypes;
            }
        } else {
            return this.category
                ? this.exampleCategoryProjectTypes.get(this.category) || []
                : [];
        }
    }

    get projectType() {
        for (const projectType of this.projectTypes) {
            if (projectType.id == this.type) {
                return projectType;
            }
        }
        return undefined;
    }

    get selectedTemplateProject(): TemplateProject | undefined {
        return this.templateProjects.find(
            templateProject => templateProject.clone_url == this.type
        );
    }

    hasCategory(category: string) {
        function hasCategory(treeNode: ITreeNode) {
            if (treeNode.id == category) {
                return true;
            }
            for (const child of treeNode.children) {
                if (child.id == category) {
                    return true;
                }

                if (hasCategory(child)) {
                    return true;
                }
            }
            return false;
        }
        return hasCategory(this.categories);
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
            this.lastTemplatesCategory != undefined &&
            this.hasCategory(this.lastTemplatesCategory)
        ) {
            this.category = this.lastTemplatesCategory;
        } else {
            this.category = this.categories.children[0].id;
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
    }

    switchToExamples() {
        this.section = "examples";

        if (
            this.lastExamplesCategory != undefined &&
            this.hasCategory(this.lastExamplesCategory)
        ) {
            this.category = this.lastExamplesCategory;
        } else {
            this.category = this.categories.children[0].id;
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
    }

    changeCategory(category: string) {
        this.category = category;

        if (this.section == "templates") {
            this.lastTemplatesCategory = this.category;

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
            this.lastExamplesCategory = this.category;

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
        }
    }

    changeType(type: string) {
        this.type = type;

        if (this.section == "templates") {
            this.lastTemplatesType = this.type;
        } else {
            this.lastExamplesType = this.type;
        }
    }

    async loadProjectTemplate() {
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
                const projectFileUrl =
                    "https://raw.githubusercontent.com/eez-open/eez-project-examples/master/examples/" +
                    this.type;

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
                    reject(error);
                });

                req.send();
            });
        }
    }

    get projectDirPath() {
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
        if (!this.projectDirPath) {
            return undefined;
        }
        return `${this.projectDirPath}${path.sep}${this.name}.eez-project`;
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
            if (fs.existsSync(this.projectDirPath!)) {
                this.locationError = `Folder "${this.projectDirPath}" already exists.`;
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
                            this.projectDirPath +
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
                reject(error);
            });

            req.send();
        });
    }

    createProject = async (modalDialog: IObservableValue<any>) => {
        if (this.createProjectInProgress) {
            return false;
        }

        try {
            modalDialog.get().setControlStatus("close", "disable");
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

                if (this.selectedTemplateProject) {
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

                    const projectDirPath = this.projectDirPath!;

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
                        this.selectedTemplateProject.html_url,
                        projectDirPath,
                        this.gitInit
                            ? {}
                            : {
                                  "--recurse-submodules": null
                              }
                    );

                    await fs.promises.rm(projectDirPath + "/.git", {
                        recursive: true,
                        force: true
                    });

                    // execute template post processing
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

                    // git init
                    const manifestJson = await readJsObjectFromFile(
                        projectDirPath + "/template/manifest.json"
                    );

                    if (this.gitInit) {
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

                    // get projectFilePath from manifest.json
                    projectFilePath =
                        projectDirPath + "/" + manifestJson["eez-project-path"];

                    projectFilePath = projectFilePath.replace(
                        /(\/|\\\\)/g,
                        path.sep
                    );
                } else {
                    try {
                        await fs.promises.mkdir(this.projectDirPath!, {
                            recursive: true
                        });
                    } catch (err) {
                        runInAction(() => {
                            this.locationError = err.toString();
                        });
                        return false;
                    }

                    projectFilePath = this.projectFilePath!;

                    let projectTemplate;

                    try {
                        projectTemplate = await this.loadProjectTemplate();
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

                    try {
                        await fs.promises.writeFile(
                            projectFilePath,
                            JSON.stringify(projectTemplate, undefined, 2),
                            "utf8"
                        );
                    } catch (err) {
                        runInAction(() => {
                            this.nameError = err.toString();
                        });
                        return false;
                    }
                }

                this.saveOptions(SaveOptionsFlags.All);

                openProject(projectFilePath);

                return true;
            } catch (err) {
                console.error(err);
                this.projectCreationError = `Failed to create a new project${
                    this.progress ? ' at: "' + this.progress : '"'
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
            modalDialog.get().setControlStatus("close", "enable");
        }
    };

    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
    }
}

const wizardModel = new WizardModel();

const CategoriesTree = observer(
    class CategoriesTree extends React.Component {
        render() {
            return (
                <Tree
                    rootNode={wizardModel.categories}
                    selectNode={node => {
                        wizardModel.changeCategory(node.id);
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
        render() {
            return (
                <div className="EezStudio_NewProjectWizard_ProjectTypes">
                    {wizardModel.projectTypes.map(projectType => (
                        <div
                            key={projectType.id}
                            className={classNames(
                                "EezStudio_NewProjectWizard_ProjectType",
                                {
                                    selected: wizardModel.type == projectType.id
                                }
                            )}
                            onClick={() => {
                                wizardModel.changeType(projectType.id);
                            }}
                        >
                            <Icon icon={projectType.icon} size={128} />
                            {projectType.label}
                        </div>
                    ))}
                </div>
            );
        }
    }
);

const ProjectProperties = observer(
    class ProjectProperties extends React.Component<{
        modalDialog: IObservableValue<any>;
    }> {
        onOk = async () => {
            const success = await wizardModel.createProject(
                this.props.modalDialog
            );
            if (success) {
                this.props.modalDialog.get().close();
            }
        };

        render() {
            if (wizardModel.type == undefined) {
                return null;
            }

            return (
                <div className="EezStudio_NewProjectWizard_ProjectProperties">
                    {wizardModel.selectedTemplateProject && (
                        <div className="mb-3 row">
                            <h6 className="col-sm-12">
                                {
                                    wizardModel.selectedTemplateProject
                                        .description
                                }
                            </h6>
                        </div>
                    )}

                    <div className="mb-3 row">
                        <label className="col-sm-3 col-form-label">Name</label>
                        <div className="col-sm-9">
                            <NameInput
                                value={wizardModel.name || ""}
                                onChange={action(
                                    (value: string | undefined) =>
                                        (wizardModel.name = value)
                                )}
                            />
                            {wizardModel.nameError && (
                                <div className="text-danger">
                                    {wizardModel.nameError}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mb-3 row">
                        <label className="col-sm-3 col-form-label">
                            Location
                        </label>
                        <div className="col-sm-9">
                            <DirectoryBrowserInput
                                value={wizardModel.location || ""}
                                onChange={action(
                                    (value: string | undefined) =>
                                        (wizardModel.location = value)
                                )}
                            />
                            {wizardModel.locationError && (
                                <div className="text-danger">
                                    {wizardModel.locationError}
                                </div>
                            )}
                        </div>
                    </div>

                    {!wizardModel.selectedTemplateProject && (
                        <div className="mb-3 row">
                            <div className="col-sm-3"></div>
                            <div className="col-sm-9">
                                <div className="form-check">
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
                            </div>
                        </div>
                    )}

                    <div className="mb-3 row">
                        <label className="col-sm-3 col-form-label">
                            {wizardModel.selectedTemplateProject
                                ? "Project folder path"
                                : "Project file path"}
                        </label>
                        <div className="col-sm-9">
                            <input
                                type="text"
                                className="form-control"
                                value={
                                    wizardModel.selectedTemplateProject
                                        ? wizardModel.projectDirPath || ""
                                        : wizardModel.projectFilePath || ""
                                }
                                onChange={() => {}}
                                readOnly
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {wizardModel.selectedTemplateProject && (
                        <div className="mb-3 row">
                            <div className="col-sm-3"></div>
                            <div className="col-sm-9">
                                <div className="form-check">
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
                            </div>
                        </div>
                    )}

                    {wizardModel.section == "templates" &&
                        (wizardModel.type == "applet" ||
                            wizardModel.type == "resource") && (
                            <>
                                <div className="mb-3 row">
                                    <label className="col-sm-3 col-form-label">
                                        BB3 project file option
                                    </label>
                                    <div className="col-sm-9 pt-2">
                                        <div className="form-check form-check-inline">
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
                                                            event.target.checked
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
                                        </div>
                                        <div className="form-check form-check-inline">
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
                                                            event.target.checked
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
                                </div>

                                {wizardModel.bb3ProjectOption == "download" &&
                                    wizardModel.bb3ProjectFileDownloadError && (
                                        <div className="mb-3 row">
                                            <div className="col-sm-2"></div>
                                            <div className="col-sm-10">
                                                <div className="text-danger">
                                                    {
                                                        wizardModel.bb3ProjectFileDownloadError
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                {wizardModel.bb3ProjectOption == "local" && (
                                    <div className="mb-3 row">
                                        <label className="col-sm-3 col-form-label">
                                            BB3 project file path
                                        </label>
                                        <div className="col-sm-9">
                                            <FileBrowserInput
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
                                                <div className="text-danger">
                                                    {
                                                        wizardModel.bb3ProjectFileError
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    {wizardModel.section == "templates" &&
                        wizardModel.type == "resource" && (
                            <div className="mb-3 row">
                                <label className="col-sm-3 col-form-label">
                                    Target BB3 firmware
                                </label>
                                <div className="col-sm-9 pt-2">
                                    <div className="form-check form-check-inline">
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
                                    <div className="form-check form-check-inline">
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
                            </div>
                        )}

                    <div>
                        <button
                            className="btn btn-primary"
                            onClick={this.onOk}
                            disabled={wizardModel.createProjectInProgress}
                        >
                            Create Project
                        </button>
                    </div>

                    <div className="EezStudio_NewProjectWizard_CreationStatus">
                        {wizardModel.createProjectInProgress ? (
                            <div
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center"
                                }}
                            >
                                <Loader />
                                <div style={{ paddingLeft: 10, flex: 1 }}>
                                    {wizardModel.progress}
                                </div>
                            </div>
                        ) : wizardModel.projectCreationError ? (
                            <div
                                className="alert alert-danger"
                                style={{ flex: 1 }}
                            >
                                {wizardModel.projectCreationError}
                            </div>
                        ) : undefined}
                    </div>
                </div>
            );
        }
    }
);

const NewProjectWizard = observer(
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

        get layoutModel() {
            return FlexLayout.Model.fromJson({
                global: {
                    borderEnableAutoHide: true,
                    splitterSize: 4,
                    splitterExtra: 4,
                    legacyOverflowMenu: false,
                    tabEnableRename: false
                },
                borders: [],
                layout: {
                    type: "row",
                    children: [
                        {
                            type: "tabset",
                            enableTabStrip: false,
                            enableDrag: false,
                            enableDrop: false,
                            enableClose: false,
                            weight: 20,
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "CategoriesTree",
                                    component: "CategoriesTree"
                                }
                            ]
                        },
                        {
                            type: "tabset",
                            enableTabStrip: false,
                            enableDrag: false,
                            enableDrop: false,
                            enableClose: false,
                            weight: 45,
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "ProjectTypesList",
                                    component: "ProjectTypesList"
                                }
                            ]
                        },
                        {
                            type: "tabset",
                            enableTabStrip: false,
                            enableDrag: false,
                            enableDrop: false,
                            enableClose: false,
                            weight: 35,
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "ProjectProperties",
                                    component: "ProjectProperties"
                                }
                            ]
                        }
                    ]
                }
            });
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "CategoriesTree") {
                return <CategoriesTree />;
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
                            Templates
                        </div>
                        <div
                            className={classNames(
                                "EezStudio_NewProjectWizard_NavigationItem",
                                { selected: wizardModel.section == "examples" }
                            )}
                            onClick={wizardModel.switchToExamples}
                        >
                            Examples
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
                        <FlexLayout.Layout
                            model={this.layoutModel}
                            factory={this.factory}
                            realtimeResize={true}
                            font={{
                                size: "small"
                            }}
                        />
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
                title: "New Project",
                width: 1280,
                height: 800
            }
        }
    );

    modalDialogObservable.set(modalDialog);
}

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}
