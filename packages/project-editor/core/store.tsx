import React from "react";
import { observable, computed, action, autorun } from "mobx";

import { confirmSave } from "eez-studio-shared/util";
import { PropertyInfo, PropertyType } from "eez-studio-shared/model/object";
import {
    DocumentStore,
    UndoManager,
    UIStateStore,
    setUIElementsFactory,
    IMenuItemConfig,
    IMenu,
    IMenuItem,
    IMenuPopupOptions,
    IMenuAnchorPosition
} from "eez-studio-shared/model/store";
import { showGenericDialog, TableField } from "eez-studio-ui/generic-dialog";

import {
    Project,
    save as saveProject,
    load as loadProject,
    getNewProject
} from "project-editor/project/project";
import { build as buildProject, backgroundCheck } from "project-editor/project/build";
import { getAllMetrics } from "project-editor/project/metrics";
import { confirm } from "project-editor/core/util";

import { ConfigurationReferencesPropertyValue } from "project-editor/components/ConfigurationReferencesPropertyValue";
import { Icon } from "eez-studio-ui/icon";
import { BootstrapDialog } from "eez-studio-ui/dialog";

const ipcRenderer = EEZStudio.electron.ipcRenderer;
const { Menu, MenuItem } = EEZStudio.electron.remote;
const path = EEZStudio.electron.remote.require("path");
const fs = EEZStudio.electron.remote.require("fs");

////////////////////////////////////////////////////////////////////////////////

function getUIStateFilePath(projectFilePath: string) {
    return projectFilePath + "-ui-state";
}

////////////////////////////////////////////////////////////////////////////////

class ProjectStoreClass {
    @observable
    filePath: string | undefined;

    constructor() {
        autorun(() => {
            this.updateProjectWindowState();

            if (this.filePath) {
                this.updateMruFilePath();
            }

            // check the project in the background
            if (this.project) {
                backgroundCheck();
            }
        });
    }

    updateProjectWindowState() {
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
            undo: (UndoManager && UndoManager.canUndo && UndoManager.undoDescription) || null,
            redo: (UndoManager && UndoManager.canRedo && UndoManager.redoDescription) || null
        });
    }

    get project() {
        return DocumentStore.document as Project;
    }

    updateMruFilePath() {
        ipcRenderer.send("setMruFilePath", this.filePath);
    }

    getFilePathRelativeToProjectPath(absoluteFilePath: string) {
        return path.relative(path.dirname(this.filePath), absoluteFilePath);
    }

    getAbsoluteFilePath(relativeFilePath: string) {
        return this.filePath
            ? path.resolve(
                  path.dirname(this.filePath),
                  relativeFilePath.replace(/(\\|\/)/g, path.sep)
              )
            : relativeFilePath;
    }

    getFolderPathRelativeToProjectPath(absoluteFolderPath: string) {
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
            this.project.settings.build.configurations._array.find(
                configuration => configuration.name == UIStateStore.selectedBuildConfiguration
            );
        if (!configuration) {
            if (this.project.settings.build.configurations._array.length > 0) {
                configuration = this.project.settings.build.configurations._array[0];
            }
        }
        return configuration;
    }

    changeProject(projectFilePath: string | undefined, project?: Project, uiState?: Project) {
        if (project) {
            project.callExtendObservableForAllOptionalProjectFeatures();
        }

        action(() => {
            this.filePath = projectFilePath;
        })();

        DocumentStore.changeDocument(project, uiState);
    }

    doSave(callback: (() => void) | undefined) {
        if (this.filePath) {
            saveProject(this.filePath)
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

    saveToFile(saveAs: boolean, callback: (() => void) | undefined) {
        if (this.project) {
            if (!this.filePath || saveAs) {
                EEZStudio.electron.remote.dialog.showSaveDialog(
                    EEZStudio.electron.remote.getCurrentWindow(),
                    {
                        filters: [
                            { name: "EEZ Project", extensions: ["eez-project"] },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    },
                    (filePath: any) => this.savedAsFilePath(filePath, callback)
                );
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
        if (this.filePath && UIStateStore.isModified) {
            fs.writeFile(
                getUIStateFilePath(this.filePath),
                UIStateStore.save(),
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
        loadProject(filePath)
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
        buildProject(true);
    }

    build() {
        buildProject(false);
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
}

////////////////////////////////////////////////////////////////////////////////

export function init() {
    EEZStudio.electron.ipcRenderer.on("newProject", () => ProjectStore.newProject());

    EEZStudio.electron.ipcRenderer.on("open", (sender: any, filePath: any) =>
        ProjectStore.open(sender, filePath)
    );

    EEZStudio.electron.ipcRenderer.on("save", () => ProjectStore.save());
    EEZStudio.electron.ipcRenderer.on("saveAs", () => ProjectStore.saveAs());

    EEZStudio.electron.ipcRenderer.on("check", () => ProjectStore.check());
    EEZStudio.electron.ipcRenderer.on("build", () => ProjectStore.build());

    EEZStudio.electron.ipcRenderer.on("undo", () => UndoManager.undo());
    EEZStudio.electron.ipcRenderer.on("redo", () => UndoManager.redo());

    // EEZStudio.electron.ipcRenderer.on('cut', () => ProjectStore.selection.cutSelection());
    // EEZStudio.electron.ipcRenderer.on('copy', () => ProjectStore.selection.copySelection());
    // EEZStudio.electron.ipcRenderer.on('paste', () => ProjectStore.selection.pasteSelection());
    // EEZStudio.electron.ipcRenderer.on('delete', () => ProjectStore.selection.deleteSelection());

    // EEZStudio.electron.ipcRenderer.on('goBack', () => ProjectStore.selection.selectionGoBack());
    // EEZStudio.electron.ipcRenderer.on('goForward', () => ProjectStore.selection.selectionGoForward());

    EEZStudio.electron.ipcRenderer.on(
        "toggleNavigation",
        action(
            () =>
                (UIStateStore.viewOptions.navigationVisible = !UIStateStore.viewOptions
                    .navigationVisible)
        )
    );
    EEZStudio.electron.ipcRenderer.on(
        "toggleOutput",
        action(
            () => (UIStateStore.viewOptions.outputVisible = !UIStateStore.viewOptions.outputVisible)
        )
    );
    EEZStudio.electron.ipcRenderer.on(
        "toggleProperties",
        action(
            () =>
                (UIStateStore.viewOptions.propertiesVisible = !UIStateStore.viewOptions
                    .propertiesVisible)
        )
    );
    EEZStudio.electron.ipcRenderer.on(
        "toggleDebug",
        action(
            () => (UIStateStore.viewOptions.debugVisible = !UIStateStore.viewOptions.debugVisible)
        )
    );

    EEZStudio.electron.ipcRenderer.on("showProjectMetrics", () => ProjectStore.showMetrics());

    if (window.location.search == "?mru") {
        let mruFilePath = ipcRenderer.sendSync("getMruFilePath");
        if (mruFilePath) {
            ProjectStore.openFile(mruFilePath);
        } else {
            ProjectStore.newProject();
        }
    } else if (window.location.search.startsWith("?open=")) {
        let ProjectStorePath = decodeURIComponent(
            window.location.search.substring("?open=".length)
        );
        ProjectStore.openFile(ProjectStorePath);
    } else if (window.location.search.startsWith("?new")) {
        ProjectStore.newProject();
    } else {
        ProjectStore.noProject();
    }
}

////////////////////////////////////////////////////////////////////////////////

setUIElementsFactory({
    Dialog: BootstrapDialog,

    createMenuItem(config: IMenuItemConfig) {
        return new MenuItem(config);
    },

    createMenu(): IMenu {
        const menu = new Menu();
        return {
            append(menuItem: IMenuItem) {
                menu.append(new MenuItem(menuItem));
            },

            popup(options: IMenuPopupOptions, position: IMenuAnchorPosition) {
                menu.popup(options);
            }
        };
    },

    confirm(message: string, detail: string | undefined, callback: () => void): void {
        return confirm(message, detail, callback);
    },

    renderProperty(propertyInfo: PropertyInfo, value: any, onChange: (value: any) => void) {
        if (propertyInfo.type === PropertyType.ConfigurationReference) {
            return <ConfigurationReferencesPropertyValue value={value} onChange={onChange} />;
        } else if (propertyInfo.type === PropertyType.RelativeFolder) {
            let clearButton: JSX.Element | undefined;

            if (value !== undefined) {
                clearButton = (
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => onChange(undefined)}
                    >
                        <Icon icon="material:close" size={14} />
                    </button>
                );
            }

            return (
                <div className="input-group">
                    <input
                        ref="input"
                        type="text"
                        className="form-control"
                        value={value}
                        readOnly
                    />
                    <div className="input-group-append">
                        {clearButton}
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => {
                                EEZStudio.electron.remote.dialog.showOpenDialog(
                                    {
                                        properties: ["openDirectory"]
                                    },
                                    filePaths => {
                                        if (filePaths[0]) {
                                            onChange(
                                                ProjectStore.getFolderPathRelativeToProjectPath(
                                                    filePaths[0]
                                                )
                                            );
                                        }
                                    }
                                );
                            }}
                        >
                            &hellip;
                        </button>
                    </div>
                </div>
            );
        } else if (propertyInfo.type === PropertyType.Image) {
            return (
                <div>
                    <div className="input-group">
                        <input
                            ref="input"
                            type="text"
                            className="form-control"
                            value={value}
                            readOnly
                        />
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => {
                                    EEZStudio.electron.remote.dialog.showOpenDialog(
                                        {
                                            properties: ["openFile"],
                                            filters: [
                                                {
                                                    name: "Image files",
                                                    extensions: ["png", "jpg", "jpeg"]
                                                },
                                                { name: "All Files", extensions: ["*"] }
                                            ]
                                        },
                                        filePaths => {
                                            if (filePaths[0]) {
                                                onChange(
                                                    ProjectStore.getFilePathRelativeToProjectPath(
                                                        filePaths[0]
                                                    )
                                                );
                                            }
                                        }
                                    );
                                }}
                            >
                                &hellip;
                            </button>
                        </div>
                    </div>
                    {value && (
                        <img
                            src={ProjectStore.getAbsoluteFilePath(value)}
                            style={{
                                display: "block",
                                maxWidth: "100%",
                                margin: "auto",
                                paddingTop: "5px"
                            }}
                        />
                    )}
                </div>
            );
        }
        return null;
    }
});

////////////////////////////////////////////////////////////////////////////////

DocumentStore.clipboardDataId = "text/eez-studio-project-editor-data";

////////////////////////////////////////////////////////////////////////////////

export const ProjectStore = new ProjectStoreClass();
