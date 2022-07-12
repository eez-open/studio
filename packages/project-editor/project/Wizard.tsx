import { ipcRenderer } from "electron";
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
    computed
} from "mobx";
import { observer } from "mobx-react";

import {
    getHomePath,
    isDev,
    readJsObjectFromFile
} from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";

import { BootstrapDialog, showDialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";
import { ITreeNode, Tree } from "eez-studio-ui/tree";

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
                        Browse...
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
                        Browse...
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

const RESOURCE_PROJECT_NAME = "MicroPython resource";

const NewProjectWizard = observer(
    class NewProjectWizard extends React.Component {
        open = true;

        disableButtons: boolean = false;

        step: number = 0;

        type: string = "firmware";

        name: string | undefined;
        nameError: string | undefined;

        location: string | undefined = getHomePath("eez-projects");
        locationError: string | undefined;

        createDirectory: boolean = false;

        bb3ProjectOption: "download" | "local" = "download";
        bb3ProjectFileDownloadError: string | undefined;
        bb3ProjectFile: string | undefined;
        bb3ProjectFileError: string | undefined;

        projectVersion: string = "v3";

        templateProjects: TemplateProject[] = [];

        projectCreationError: React.ReactNode | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                open: observable,
                disableButtons: observable,
                step: observable,
                type: observable,
                name: observable,
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
                selectedTemplateProject: computed,
                validateName: action,
                validateLocation: action,
                validateBB3ProjectFile: action
            });

            const optionsJSON = window.localStorage.getItem("project-wizard");
            if (optionsJSON) {
                try {
                    const options = JSON.parse(optionsJSON);
                    if (options.version == 1) {
                        this.type = options.type;
                        this.location = options.location;
                        this.createDirectory = options.createDirectory;
                        this.bb3ProjectOption = options.bb3ProjectOption;
                        this.bb3ProjectFile = options.bb3ProjectFile;
                        this.projectVersion = options.projectVersion;
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            reaction(
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
        }

        componentDidMount() {
            fetch(
                "https://envox.hr/gitea/api/v1/repos/search?q=eez-flow-template&topic=true"
            )
                .then(response => response.json())
                .then(data => {
                    runInAction(() => {
                        console.log(data.data);
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

        saveOptions() {
            window.localStorage.setItem(
                "project-wizard",
                JSON.stringify({
                    version: 1,
                    type: this.type,
                    location: this.location,
                    createDirectory: this.createDirectory,
                    bb3ProjectOption: this.bb3ProjectOption,
                    bb3ProjectFile: this.bb3ProjectFile,
                    projectVersion: this.projectVersion
                })
            );
        }

        get projectTypes(): ITreeNode {
            return {
                id: "_root",
                label: "Root",
                children: [
                    {
                        id: "_standard",
                        label: "Builtin templates",
                        children: [
                            {
                                id: "firmware",
                                label: "Firmware",
                                children: [],
                                selected: this.type === "firmware",
                                expanded: false,
                                data: undefined
                            },
                            {
                                id: "dashboard",
                                label: "Dashboard",
                                children: [],
                                selected: this.type === "dashboard",
                                expanded: false,
                                data: undefined
                            },
                            {
                                id: "applet",
                                label: "Applet",
                                children: [],
                                selected: this.type === "applet",
                                expanded: false,
                                data: undefined
                            },
                            {
                                id: "resource",
                                label: RESOURCE_PROJECT_NAME,
                                children: [],
                                selected: this.type === "resource",
                                expanded: false,
                                data: undefined
                            },
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
                            </span>
                        ),
                        children: this.templateProjects.map(
                            templateProject => ({
                                id: templateProject.clone_url,
                                label: templateProject.name.startsWith(
                                    "eez-flow-template-"
                                )
                                    ? templateProject.name.substring(
                                          "eez-flow-template-".length
                                      )
                                    : templateProject.name,
                                children: [],
                                selected:
                                    this.type === templateProject.clone_url,
                                expanded: false,
                                data: templateProject
                            })
                        ),
                        selected: false,
                        expanded: true,
                        data: undefined
                    }
                ],
                selected: false,
                expanded: false,
                data: undefined
            };
        }

        get selectedTemplateProject(): TemplateProject | undefined {
            return this.templateProjects.find(
                templateProject => templateProject.clone_url == this.type
            );
        }

        get numSteps() {
            if (this.type == "applet") {
                return 2;
            }
            if (this.type == "resource") {
                return 3;
            }
            return 1;
        }

        async loadProjectTemplate() {
            const relativePath = `project-templates/${this.type}.eez-project`;

            const json = await fs.promises.readFile(
                isDev
                    ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                    : `${process.resourcesPath!}/${relativePath}`,
                "utf8"
            );

            return JSON.parse(json);
        }

        get uiStateSrc() {
            const relativePath = `project-templates/${this.type}.eez-project-ui-state`;
            return isDev
                ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                : `${process.resourcesPath!}/${relativePath}`;
        }

        get uiStateDst() {
            return `${this.projectDirPath}/${this.name}.eez-project-ui-state`;
        }

        async loadGuiProjectTemplate() {
            const relativePath = `project-templates/gui.eez-project`;

            const json = await fs.promises.readFile(
                isDev
                    ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                    : `${process.resourcesPath!}/${relativePath}`,
                "utf8"
            );

            return JSON.parse(json);
        }

        get guiProjectSrc() {
            const relativePath = `project-templates/gui.eez-project`;
            return isDev
                ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                : `${process.resourcesPath!}/${relativePath}`;
        }

        get guiProjectDst() {
            return `${this.projectDirPath}/${this.name}-gui.eez-project`;
        }

        get guiProjectStateSrc() {
            const relativePath = `project-templates/gui.eez-project-ui-state`;
            return isDev
                ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                : `${process.resourcesPath!}/${relativePath}`;
        }

        get guiProjectStateDst() {
            return `${this.projectDirPath}/${this.name}-gui.eez-project-ui-state`;
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

            if (this.selectedTemplateProject || this.createDirectory) {
                if (fs.existsSync(this.projectDirPath!)) {
                    this.locationError = `Folder "${this.projectDirPath}" already exists.`;
                    return;
                }
            } else {
                if (fs.existsSync(this.projectFilePath!)) {
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

        postSDL(
            dir: string,
            params: {
                name: string;
            }
        ) {}

        onOk = async () => {
            if (this.disableButtons) {
                return;
            }

            runInAction(() => {
                this.disableButtons = true;
                this.projectCreationError = undefined;
            });

            try {
                if (this.step == 0) {
                    this.validateName();
                    this.validateLocation();

                    if (this.nameError || this.locationError) {
                        return;
                    }
                } else if (this.step == 1) {
                    this.validateBB3ProjectFile();

                    if (this.bb3ProjectFileError) {
                        return;
                    }
                }

                let projectFilePath;

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
                        return;
                    }

                    const projectDirPath =
                        this.projectDirPath! + "/" + this.name;

                    // do git stuff
                    const { simpleGit } = await import("simple-git");

                    await simpleGit().clone(
                        this.selectedTemplateProject.html_url,
                        projectDirPath,
                        {
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

                    // get projectFilePath from manifest.json
                    const manifestJson = await readJsObjectFromFile(
                        projectDirPath + "/template/manifest.json"
                    );
                    projectFilePath =
                        projectDirPath + "/" + manifestJson["eez-project-path"];

                    projectFilePath = projectFilePath.replace(
                        /(\/|\\\\)/g,
                        path.sep
                    );
                } else {
                    if (this.step + 1 < this.numSteps) {
                        runInAction(() => this.step++);
                        return;
                    }

                    try {
                        await fs.promises.mkdir(this.projectDirPath!, {
                            recursive: true
                        });
                    } catch (err) {
                        runInAction(() => {
                            this.step = 0;
                            this.locationError = err.toString();
                        });
                        return;
                    }

                    projectFilePath = this.projectFilePath!;

                    const projectTemplate = await this.loadProjectTemplate();

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
                                    this.step = 1;
                                    this.bb3ProjectFileDownloadError =
                                        err.toString();
                                });
                                return;
                            }
                            projectTemplate.settings.general.masterProject =
                                "." +
                                path.sep +
                                "modular-psu-firmware.eez-project";
                        } else {
                            projectTemplate.settings.general.masterProject =
                                path.relative(
                                    projectFilePath,
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
                    } else if (this.type == "firmware") {
                        projectTemplate.settings.general.imports[0].projectFilePath = `${this.name}-gui.eez-project`;
                    }

                    try {
                        await fs.promises.writeFile(
                            projectFilePath,
                            JSON.stringify(projectTemplate, undefined, 2),
                            "utf8"
                        );

                        fs.promises.copyFile(this.uiStateSrc, this.uiStateDst);
                    } catch (err) {
                        runInAction(() => {
                            this.step = 0;
                            this.nameError = err.toString();
                        });
                        return;
                    }

                    if (this.type == "firmware") {
                        try {
                            const guiProjectTemplate =
                                await this.loadGuiProjectTemplate();

                            await fs.promises.writeFile(
                                projectFilePath,
                                JSON.stringify(projectTemplate, undefined, 2),
                                "utf8"
                            );
                            guiProjectTemplate.settings.general.imports[0].projectFilePath = `${this.name}.eez-project`;

                            await fs.promises.writeFile(
                                this.guiProjectDst,
                                JSON.stringify(
                                    guiProjectTemplate,
                                    undefined,
                                    2
                                ),
                                "utf8"
                            );
                        } catch (err) {
                            runInAction(() => {
                                this.step = 0;
                                this.nameError = err.toString();
                            });
                            return;
                        }

                        try {
                            fs.promises.copyFile(
                                this.guiProjectStateSrc,
                                this.guiProjectStateDst
                            );
                        } catch (err) {
                            runInAction(() => {
                                this.step = 0;
                                this.nameError = err.toString();
                            });
                            return;
                        }
                    }
                }

                runInAction(() => (this.open = false));

                ipcRenderer.send("open-file", projectFilePath);

                this.saveOptions();
            } catch (err) {
                console.error(err);
                this.projectCreationError = "Failed to create a new project!";
            } finally {
                runInAction(() => (this.disableButtons = false));
            }
        };

        onCancel = action(() => {
            if (this.disableButtons) {
                return;
            }

            if (this.step > 0) {
                this.step--;
            } else {
                this.open = false;
            }
        });

        render() {
            return (
                <BootstrapDialog
                    modal={true}
                    open={this.open}
                    title={
                        "New Project" +
                        (this.numSteps > 1
                            ? ` - Step ${this.step + 1} of ${this.numSteps}`
                            : "")
                    }
                    size={"large"}
                    onSubmit={this.onOk}
                    onCancel={this.onCancel}
                    cancelDisabled={this.disableButtons}
                    okEnabled={() => !this.disableButtons}
                    disableButtons={this.disableButtons}
                    backdrop="static"
                    buttons={[
                        {
                            id: "cancel",
                            type: "secondary",
                            position: "right",
                            onClick: this.onCancel,
                            disabled: this.disableButtons,
                            style: {},
                            text: this.step == 0 ? "Cancel" : "Back"
                        },
                        {
                            id: "ok",
                            type: "primary",
                            position: "right",
                            onClick: this.onOk,
                            disabled: this.disableButtons,
                            style: {},
                            text: this.step + 1 == this.numSteps ? "OK" : "Next"
                        }
                    ]}
                    additionalFooterControl={
                        this.disableButtons ? (
                            <Loader />
                        ) : this.projectCreationError ? (
                            <div
                                className="alert alert-danger"
                                style={{ flex: 1 }}
                            >
                                {this.projectCreationError}
                            </div>
                        ) : undefined
                    }
                >
                    {this.step == 0 && (
                        <div className="d-flex flex-row">
                            <div className="pe-3">
                                <Tree
                                    rootNode={this.projectTypes}
                                    selectNode={action(node => {
                                        if (node.id.startsWith("_")) {
                                            return;
                                        }
                                        this.type = node.id;
                                    })}
                                    showOnlyChildren={true}
                                    className="overflow-auto border rounded-1"
                                    style={{ width: 240, height: 480 }}
                                />
                            </div>

                            <div className="flex-fill">
                                {this.selectedTemplateProject && (
                                    <div className="mb-3 row">
                                        <img
                                            className="col-sm-12"
                                            src={
                                                this.selectedTemplateProject
                                                    ._image_url
                                            }
                                        />
                                    </div>
                                )}

                                {this.selectedTemplateProject && (
                                    <div className="mb-3 row">
                                        <label className="col-sm-3 col-form-label">
                                            Description
                                        </label>
                                        <div className="col-sm-9">
                                            <div className="form-control">
                                                {
                                                    this.selectedTemplateProject
                                                        .description
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mb-3 row">
                                    <label className="col-sm-3 col-form-label">
                                        Name
                                    </label>
                                    <div className="col-sm-9">
                                        <NameInput
                                            value={this.name || ""}
                                            onChange={action(
                                                (value: string | undefined) =>
                                                    (this.name = value)
                                            )}
                                        />
                                        {this.nameError && (
                                            <div className="text-danger">
                                                {this.nameError}
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
                                            value={this.location || ""}
                                            onChange={action(
                                                (value: string | undefined) =>
                                                    (this.location = value)
                                            )}
                                        />
                                        {this.locationError && (
                                            <div className="text-danger">
                                                {this.locationError}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!this.selectedTemplateProject && (
                                    <div className="mb-3 row">
                                        <div className="col-sm-3"></div>
                                        <div className="col-sm-9">
                                            <div className="form-check">
                                                <input
                                                    id="new-project-wizard-create-directory-checkbox"
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={
                                                        this.createDirectory
                                                    }
                                                    onChange={action(
                                                        event =>
                                                            (this.createDirectory =
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
                                        {this.selectedTemplateProject
                                            ? "Project folder path"
                                            : "Project file path"}
                                    </label>
                                    <div className="col-sm-9">
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={
                                                this.selectedTemplateProject
                                                    ? this.projectDirPath
                                                    : this.projectFilePath || ""
                                            }
                                            onChange={() => {}}
                                            readOnly
                                            spellCheck={false}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {this.step == 1 && (
                        <>
                            <div className="mb-3 row">
                                <h6>
                                    {this.type == "applet"
                                        ? "Applet"
                                        : RESOURCE_PROJECT_NAME}{" "}
                                    project requires BB3 project file. We have
                                    the following options:
                                </h6>
                            </div>

                            <div className="mb-1 row">
                                <label className="col-sm-2 col-form-label"></label>
                                <div className="col-sm-10 d-flex align-items-center">
                                    <div className="form-check form-check-inline">
                                        <input
                                            id="new-project-wizard-bb3-project-download"
                                            className="form-check-input"
                                            type="radio"
                                            name="new-project-wizard-bb3-project"
                                            value={"download"}
                                            checked={
                                                this.bb3ProjectOption ==
                                                "download"
                                            }
                                            onChange={action(
                                                event =>
                                                    (this.bb3ProjectOption =
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
                                </div>
                            </div>
                            <div className="mb-3 row">
                                <label className="col-sm-2 col-form-label"></label>
                                <div className="col-sm-10 d-flex align-items-center">
                                    <div className="form-check form-check-inline">
                                        <input
                                            id="new-project-wizard-bb3-project-local"
                                            className="form-check-input"
                                            type="radio"
                                            name="new-project-wizard-bb3-project"
                                            value={1}
                                            checked={
                                                this.bb3ProjectOption == "local"
                                            }
                                            onChange={action(
                                                event =>
                                                    (this.bb3ProjectOption =
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

                            {this.bb3ProjectOption == "download" &&
                                this.bb3ProjectFileDownloadError && (
                                    <div className="mb-3 row">
                                        <div className="col-sm-2"></div>
                                        <div className="col-sm-10">
                                            <div className="text-danger">
                                                {
                                                    this
                                                        .bb3ProjectFileDownloadError
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )}

                            {this.bb3ProjectOption == "local" && (
                                <div className="mb-3 row">
                                    <label className="col-sm-2 col-form-label">
                                        BB3 project file
                                    </label>
                                    <div className="col-sm-10">
                                        <FileBrowserInput
                                            value={this.bb3ProjectFile}
                                            onChange={action(
                                                (value: string | undefined) =>
                                                    (this.bb3ProjectFile =
                                                        value)
                                            )}
                                        />
                                        {this.bb3ProjectFileError && (
                                            <div className="text-danger">
                                                {this.bb3ProjectFileError}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {this.step == 2 && (
                        <>
                            <div className="mb-3 row">
                                <h6>
                                    Which BB3 firmware version is your target?
                                </h6>
                            </div>

                            <div className="mb-1 row">
                                <label className="col-sm-2 col-form-label"></label>
                                <div className="col-sm-10 d-flex align-items-center">
                                    <div className="form-check form-check-inline">
                                        <input
                                            id="new-project-wizard-bb3-target-version-v3"
                                            className="form-check-input"
                                            type="radio"
                                            name="new-project-wizard-bb3-target"
                                            value={"v3"}
                                            checked={
                                                this.projectVersion == "v3"
                                            }
                                            onChange={action(
                                                event =>
                                                    (this.projectVersion = event
                                                        .target.checked
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
                                </div>
                            </div>
                            <div className="mb-3 row">
                                <label className="col-sm-2 col-form-label"></label>
                                <div className="col-sm-10 d-flex align-items-center">
                                    <div className="form-check form-check-inline">
                                        <input
                                            id="new-project-wizard-bb3-target-version-v2"
                                            className="form-check-input"
                                            type="radio"
                                            name="new-project-wizard-bb3-target"
                                            value={"v2"}
                                            checked={
                                                this.projectVersion == "v2"
                                            }
                                            onChange={action(
                                                event =>
                                                    (this.projectVersion = event
                                                        .target.checked
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
                        </>
                    )}
                </BootstrapDialog>
            );
        }
    }
);

export function showNewProjectWizard() {
    showDialog(<NewProjectWizard />);
}

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}
