import { ipcRenderer } from "electron";
import { dialog, getCurrentWindow } from "@electron/remote";
import path from "path";
import fs from "fs";
import mobx from "mobx";
import {
    makeObservable,
    observable,
    computed,
    action,
    reaction,
    autorun,
    runInAction
} from "mobx";
import type { FSWatcher } from "chokidar";

import { confirmSave } from "eez-studio-shared/util-renderer";

import * as notification from "eez-studio-ui/notification";

import {
    IEezObject,
    PropertyType,
    getParent,
    getKey,
    isEezObject,
    EezObject,
    PropertyInfo,
    setParent
} from "project-editor/core/object";
import type { CurrentSearch } from "project-editor/core/search";

import type { DataContext } from "project-editor/features/variable/variable";

import type { RuntimeBase } from "project-editor/flow/runtime/runtime";

import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Project } from "project-editor/project/project";

import {
    findPropertyByNameInObject,
    getClassInfo,
    getObjectFromPath,
    getObjectFromStringPath
} from "project-editor/store/helper";

import { NavigationStore } from "project-editor/store/navigation";
import { EditorsStore } from "project-editor/store/editor";
import { LayoutModels } from "project-editor/store/layout-models";
import { UIStateStore } from "project-editor/store/ui-state";
import { RuntimeSettings } from "project-editor/store/runtime-settings";
import { UndoManager } from "project-editor/store/undo-manager";
import { OutputSections, Section } from "project-editor/store/output-sections";
import {
    createObject,
    loadProject,
    objectToJson
} from "project-editor/store/serialization";
import { TypesStore } from "project-editor/store//types";

import {
    addObject,
    addObjects,
    deleteObject,
    deleteObjects,
    insertObject,
    insertObjectAfter,
    insertObjectBefore,
    replaceObject,
    replaceObjects,
    updateObject
} from "project-editor/store/commands";

import { objectsToClipboardData } from "project-editor/store/clipboard";
import { getProjectFeatures } from "./features";
import { RuntimeType } from "project-editor/project/project-type-traits";
import { IExtension } from "eez-studio-shared/extensions/extension";
import { installExtension } from "eez-studio-shared/extensions/extensions";
import type { InstrumentObject } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

export * from "project-editor/store/helper";
export * from "project-editor/store/navigation";
export * from "project-editor/store/editor";
export * from "project-editor/store/layout-models";
export * from "project-editor/store/undo-manager";
export * from "project-editor/store/output-sections";
export * from "project-editor/store/commands";
export * from "project-editor/store/serialization";
export * from "project-editor/store/clipboard";

////////////////////////////////////////////////////////////////////////////////

export class ProjectStore {
    project: Project;

    undoManager = new UndoManager(this);
    navigationStore = new NavigationStore(this);
    layoutModels = new LayoutModels(this);
    editorModeEditorsStore = new EditorsStore(
        this,
        () => this.layoutModels.editorModeEditors,
        LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID
    );
    runtimeModeEditorsStore = new EditorsStore(
        this,
        () => this.layoutModels.runtimeModeEditors,
        LayoutModels.RUNTIME_MODE_EDITORS_TABSET_ID
    );
    uiStateStore = new UIStateStore(this);
    runtimeSettings = new RuntimeSettings(this);
    outputSectionsStore = new OutputSections(this);
    typesStore = new TypesStore(this);

    runtime: RuntimeBase | undefined;

    modified: boolean = false;

    filePath: string | undefined;
    backgroundCheckEnabled = true;

    dataContext: DataContext;

    currentSearch: CurrentSearch;

    objects = new Map<string, IEezObject>();
    lastChildId = 0;

    externalProjects = new Map<string, Project>();
    mapExternalProjectToAbsolutePath = new Map<Project, string>();
    externalProjectsLoading = new Map<string, boolean>();

    dispose1: mobx.IReactionDisposer;
    dispose2: mobx.IReactionDisposer;
    dispose3: mobx.IReactionDisposer;
    dispose4: mobx.IReactionDisposer;
    dispose5: mobx.IReactionDisposer;
    dispose6: mobx.IReactionDisposer;

    watcher: FSWatcher | undefined = undefined;

    dashboardInstrument?: InstrumentObject;

    get editorsStore() {
        return this.runtime
            ? this.runtimeModeEditorsStore
            : this.editorModeEditorsStore;
    }

    get projectTypeTraits() {
        return this.project.projectTypeTraits;
    }

    static async create() {
        return new ProjectStore();
    }

    constructor() {
        makeObservable<ProjectStore>(this, {
            runtime: observable,
            project: observable,
            modified: observable,
            filePath: observable,
            backgroundCheckEnabled: observable,
            externalProjects: observable,
            mapExternalProjectToAbsolutePath: observable,
            selectedBuildConfiguration: computed,
            masterProjectEnabled: computed,
            masterProject: computed,
            isModified: computed,
            setModified: action,
            setProject: action,
            setEditorMode: action,
            onSetEditorMode: action
        });

        this.currentSearch = new ProjectEditor.documentSearch.CurrentSearch(
            this
        );
    }

    mount() {
        this.dispose1 = autorun(
            () => {
                this.updateProjectWindowState();
            },
            {
                delay: 100
            }
        );

        this.dispose2 = autorun(
            () => {
                if (this.filePath) {
                    this.updateMruFilePath();
                }
            },
            {
                delay: 100
            }
        );

        this.watch();
    }

    async watch() {
        const chokidarModuleName = "chokidar";
        const { watch } = require(chokidarModuleName);
        this.dispose3 = autorun(() => {
            if (this.watcher) {
                this.watcher.close();
            }
            if (this.project) {
                const importedProjectFiles =
                    this.project.settings.general.imports
                        .filter(
                            importDirective => !!importDirective.projectFilePath
                        )
                        .map(importDirective =>
                            this.getAbsoluteFilePath(
                                importDirective.projectFilePath
                            )
                        );
                this.watcher = watch(importedProjectFiles) as FSWatcher;
                this.watcher.on("change", path => {
                    const project = this.externalProjects.get(path);
                    if (project) {
                        runInAction(() => {
                            this.externalProjects.delete(path);
                            this.mapExternalProjectToAbsolutePath.delete(
                                project
                            );
                            this.loadExternalProject(path);
                        });
                    }
                });
            }
        });
    }

    unmount() {
        this.project.settings.general.imports.forEach(importDirective => {
            if (
                importDirective.project &&
                importDirective.project._store != this
            ) {
                importDirective.project._store.unmount();
            }
        });

        this.editorsStore.unmount();
        this.uiStateStore.unmount();
        this.navigationStore.unmount();
        this.layoutModels.unmount();

        this.dispose1();
        this.dispose2();
        if (this.dispose3) {
            this.dispose3();
        }
        if (this.watcher) {
            this.watcher.close();
        }
        if (this.dispose4) {
            this.dispose4();
        }
        if (this.dispose5) {
            this.dispose5();
        }
        if (this.dispose6) {
            this.dispose6();
        }
    }

    async loadMasterProject() {
        const project = this.project!;

        if (project.settings.general.masterProject) {
            try {
                await project.loadMasterProject();
            } catch (err) {
                notification.error(
                    `Failed to load project ${project.settings.general.masterProject}`
                );
            }
        }
    }

    async loadAllExternalProjects() {
        const project = this.project!;

        // load master project
        await this.loadMasterProject();

        // load imported projects
        for (let i = 0; i < project.settings.general.imports.length; i++) {
            try {
                await project.settings.general.imports[i].loadProject();
            } catch (err) {
                notification.error(
                    `Failed to load project ${project.settings.general.imports[i].projectFilePath}`
                );
            }
        }

        this.dispose5 = reaction(
            () => this.project.settings.general.masterProject,
            masterProject => {
                this.loadMasterProject();
            }
        );
    }

    startBackgroundCheck() {
        this.dispose6 = autorun(() => this.typesStore.reset());

        this.dispose4 = autorun(
            () => {
                // check the project in the background
                if (
                    this.project &&
                    this.project._store.backgroundCheckEnabled
                ) {
                    ProjectEditor.build.backgroundCheck(this);
                }
            },
            {
                delay: 100
            }
        );
    }

    get title() {
        if (this.filePath) {
            if (this.filePath.endsWith(".eez-project")) {
                return path.basename(this.filePath, ".eez-project");
            } else {
                return (
                    path.basename(this.filePath, ".eez-dashboard") +
                    " dashboard"
                );
            }
        } else {
            return "Untitled project";
        }
    }

    updateProjectWindowState() {
        let title = "";

        if (this.project) {
            if (this.modified) {
                title += "\u25CF ";
            }
            title += this.title + " - ";
        }

        title += "EEZ Studio";

        if (title != document.title) {
            document.title = title;
        }

        ipcRenderer.send("windowSetState", {
            modified: this.modified,
            projectFilePath: this.filePath,
            undo:
                (this.undoManager &&
                    this.undoManager.canUndo &&
                    this.undoManager.undoDescription) ||
                null,
            redo:
                (this.undoManager &&
                    this.undoManager.canRedo &&
                    this.undoManager.redoDescription) ||
                null
        });
    }

    updateMruFilePath() {
        if (!this.dashboardInstrument) {
            ipcRenderer.send("setMruFilePath", {
                filePath: this.filePath,
                projectType: this.project?.settings?.general?.projectType
            });
        }
    }

    getFilePathRelativeToProjectPath(absoluteFilePath: string) {
        return path.relative(
            path.dirname(this.filePath || ""),
            absoluteFilePath
        );
    }

    getProjectFilePath(project: Project) {
        if (project == this.project) {
            return this.filePath;
        } else {
            return this.mapExternalProjectToAbsolutePath.get(project);
        }
    }

    getAbsoluteFilePath(relativeFilePath: string, project?: Project) {
        if (!relativeFilePath) {
            relativeFilePath = "";
        }
        const filePath = this.getProjectFilePath(project ?? this.project);
        return filePath
            ? path.resolve(
                  path.dirname(filePath),
                  relativeFilePath.replace(/(\\|\/)/g, path.sep)
              )
            : relativeFilePath;
    }

    getFolderPathRelativeToProjectPath(absoluteFolderPath: string) {
        let folder = path.relative(
            path.dirname(this.filePath || ""),
            absoluteFolderPath
        );
        if (folder == "") {
            folder = ".";
        }
        return folder;
    }

    getAbsoluteProjectFolderPath() {
        return path.dirname(this.filePath || "");
    }

    get selectedBuildConfiguration() {
        let configuration =
            this.project &&
            this.project.settings.build.configurations.find(
                configuration =>
                    configuration.name ==
                    this.uiStateStore.selectedBuildConfiguration
            );
        if (!configuration) {
            if (this.project.settings.build.configurations.length > 0) {
                configuration = this.project.settings.build.configurations[0];
            }
        }
        return configuration;
    }

    async doSave() {
        if (!this.project._isDashboardBuild) {
            await save(this, this.filePath!);
        }
        this.setModified(false);
    }

    async saveToFile(saveAs: boolean) {
        if (this.project) {
            if (!this.filePath || saveAs) {
                const result = await dialog.showSaveDialog(getCurrentWindow(), {
                    filters: [
                        {
                            name: "EEZ Project",
                            extensions: ["eez-project"]
                        },
                        { name: "All Files", extensions: ["*"] }
                    ]
                });
                let filePath = result.filePath;
                if (filePath) {
                    if (!filePath.toLowerCase().endsWith(".eez-project")) {
                        filePath += ".eez-project";
                    }
                    runInAction(() => {
                        this.filePath = filePath;
                    });
                    await this.doSave();
                    return true;
                } else {
                    return false;
                }
            } else {
                await this.doSave();
                return true;
            }
        }

        return true;
    }

    getNewProject(): Project {
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

        const features = getProjectFeatures();
        for (const feature of features) {
            if (feature.mandatory) {
                project[feature.key] = feature.create();
            }
        }

        return loadProject(this, project);
    }

    async newProject() {
        await this.setProject(this.getNewProject(), undefined);
    }

    async openFile(filePath: string) {
        this.filePath = filePath;
        const project = await load(this, filePath);
        await this.setProject(project, filePath);
    }

    async saveModified() {
        if (this.project._isDashboardBuild) {
            return true;
        }

        if (this.project && this.modified) {
            return new Promise<boolean>(resolve => {
                confirmSave({
                    saveCallback: async () => {
                        resolve(await this.saveToFile(false));
                    },
                    dontSaveCallback: () => resolve(true),
                    cancelCallback: () => resolve(false)
                });
            });
        }

        return true;
    }

    save() {
        return this.saveToFile(false);
    }

    saveAs() {
        return this.saveToFile(true);
    }

    check() {
        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.CHECKS_TAB_ID
        );
        ProjectEditor.build.buildProject(this, "check");
    }

    async build() {
        const result = await ProjectEditor.build.buildProject(
            this,
            "buildFiles"
        );
        if (this.outputSectionsStore.getSection(Section.OUTPUT).numErrors > 0) {
            this.layoutModels.selectTab(
                this.layoutModels.root,
                LayoutModels.OUTPUT_TAB_ID
            );
        } else {
            notification.info("Build done.");
        }
        return result;
    }

    buildAssets() {
        return ProjectEditor.build.buildProject(this, "buildAssets");
    }

    buildExtensions() {
        ProjectEditor.build.buildExtensions(this);
    }

    async buildAndInstallExtensions() {
        const extensionFilePaths = await ProjectEditor.build.buildExtensions(
            this
        );

        for (const extensionFilePath of extensionFilePaths) {
            try {
                const extension = await installExtension(extensionFilePath, {
                    notFound() {
                        notification.info(
                            "This is not a valid extension package file.",
                            undefined
                        );
                    },
                    async confirmReplaceNewerVersion(
                        newExtension: IExtension,
                        existingExtension: IExtension
                    ) {
                        return true;
                    },
                    async confirmReplaceOlderVersion(
                        newExtension: IExtension,
                        existingExtension: IExtension
                    ) {
                        return true;
                    },
                    async confirmReplaceTheSameVersion(
                        newExtension: IExtension,
                        existingExtension: IExtension
                    ) {
                        return true;
                    }
                });

                if (extension) {
                    notification.success(
                        `Extension "${
                            extension.displayName || extension.name
                        }" installed`
                    );
                }
            } catch (err) {
                notification.error(err.toString());
            }
        }
    }

    async closeWindow() {
        if (this.runtime) {
            await this.runtime.stopRuntime(false);
            this.dataContext.clear();
        }
        await this.runtimeSettings.save();

        if (!this.project._isDashboardBuild) {
            await this.uiStateStore.save();
        }

        if (this.project) {
            return await this.saveModified();
        }

        return true;
    }

    get masterProjectEnabled() {
        return !!this.project.settings.general.masterProject;
    }

    get masterProject() {
        return this.project.masterProject;
    }

    async loadExternalProject(filePath: string) {
        if (
            filePath == this.filePath ||
            this.externalProjects.get(filePath) ||
            this.externalProjectsLoading.get(filePath)
        ) {
            // already loaded or loading
            return;
        }

        this.externalProjectsLoading.set(filePath, true);

        const project = await load(this, filePath);

        project._isReadOnly = true;
        project._store = this;

        runInAction(() => {
            this.externalProjects.set(filePath, project);
            this.mapExternalProjectToAbsolutePath.set(project, filePath);
        });

        this.externalProjectsLoading.set(filePath, false);
    }

    getChildId() {
        return (++this.lastChildId).toString();
    }

    getObjectFromPath(path: string[]) {
        return getObjectFromPath(this.project, path);
    }

    getObjectFromStringPath(objectID: string) {
        return getObjectFromStringPath(this.project, objectID);
    }

    getObjectFromObjectId(objectID: string) {
        return this.objects.get(objectID);
    }

    get isModified() {
        return this.modified;
    }

    setModified(modified_: boolean) {
        this.modified = modified_;
    }

    async setProject(project: Project, projectFilePath: string | undefined) {
        this.project = project;
        this.filePath = projectFilePath;

        project._store = this;

        this.dataContext = new ProjectEditor.DataContextClass(project);

        this.undoManager.clear();

        await this.uiStateStore.load();
        await this.runtimeSettings.load();
    }

    canSave() {
        return this.modified;
    }

    addObject(parentObject: IEezObject, object: EezObject) {
        const undoManager = this.undoManager;

        let closeCombineCommands = false;

        if (getParent(parentObject) && getKey(parentObject)) {
            const propertyInfo = findPropertyByNameInObject(
                getParent(parentObject),
                getKey(parentObject)
            );
            if (propertyInfo && propertyInfo.interceptAddObject) {
                if (!undoManager.combineCommands) {
                    undoManager.setCombineCommands(true);
                    closeCombineCommands = true;
                }

                object = propertyInfo.interceptAddObject(parentObject, object);
            }
        }

        const eezObject = addObject(parentObject, object);

        if (closeCombineCommands) {
            undoManager.setCombineCommands(false);
        }

        return eezObject;
    }

    addObjects(parentObject: IEezObject, objects: EezObject[]) {
        return addObjects(parentObject, objects);
    }

    insertObject(parentObject: IEezObject, index: number, object: EezObject) {
        return insertObject(parentObject, index, object);
    }

    updateObject(object: IEezObject, inputValues: any) {
        // make sure that plain JavaScript objects to EezObject's
        let values: any = {};

        for (let propertyName in inputValues) {
            if (inputValues.hasOwnProperty(propertyName)) {
                let propertyInfo = findPropertyByNameInObject(
                    object,
                    propertyName
                );

                if (propertyInfo) {
                    if (
                        propertyInfo.computed !== true ||
                        propertyInfo.modifiable
                    ) {
                        let value = inputValues[propertyName];
                        if (
                            (propertyInfo.type === PropertyType.Object ||
                                propertyInfo.type === PropertyType.Array) &&
                            value !== undefined
                        ) {
                            if (!isEezObject(value)) {
                                // make an EezObject
                                value = createObject(
                                    this,
                                    value,
                                    propertyInfo.typeClass!
                                );
                            }

                            setParent(value, object);
                        }

                        values[propertyName] = value;
                    } else {
                        console.warn("ignored computed property", propertyName);
                    }
                } else {
                    console.error("ignored unknown property", propertyName);
                }
            }
        }

        updateObject(object, values);
    }

    deleteObject(
        object: IEezObject,
        options?: { dropPlace?: IEezObject | PropertyInfo }
    ) {
        let closeCombineCommands = false;
        if (!this.undoManager.combineCommands) {
            this.undoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        const classInfo = getClassInfo(object);
        if (classInfo.deleteObjectRefHook) {
            classInfo.deleteObjectRefHook(object, options);
        }

        deleteObject(object);

        if (closeCombineCommands) {
            this.undoManager.setCombineCommands(false);
        }
    }

    deleteObjects(objects: IEezObject[]) {
        if (objects.length == 0) {
            return;
        }

        if (objects.length === 1) {
            this.deleteObject(objects[0]);
        } else {
            let closeCombineCommands = false;
            if (!this.undoManager.combineCommands) {
                this.undoManager.setCombineCommands(true);
                closeCombineCommands = true;
            }

            objects.forEach(object => {
                const classInfo = getClassInfo(object);
                if (classInfo.deleteObjectRefHook) {
                    classInfo.deleteObjectRefHook(object);
                }
            });

            objects = objects.filter(object => {
                const classInfo = getClassInfo(object);
                if (classInfo.deleteObjectFilterHook) {
                    return classInfo.deleteObjectFilterHook(object);
                }
                return true;
            });

            deleteObjects(objects);

            if (closeCombineCommands) {
                this.undoManager.setCombineCommands(false);
            }
        }
    }

    replaceObject(
        object: IEezObject,
        replaceWithObject: EezObject,
        newParent?: IEezObject
    ) {
        return replaceObject(object, replaceWithObject, newParent);
    }

    replaceObjects(
        objects: IEezObject[],
        replaceWithObject: EezObject,
        newParent?: IEezObject
    ) {
        return replaceObjects(objects, replaceWithObject, newParent);
    }

    insertObjectBefore(object: IEezObject, objectToInsert: any) {
        return insertObjectBefore(object, objectToInsert);
    }

    insertObjectAfter(object: IEezObject, objectToInsert: any) {
        return insertObjectAfter(object, objectToInsert);
    }

    objectsToClipboardData(objects: EezObject[]) {
        for (const object of objects) {
            const classInfo = getClassInfo(object);
            if (classInfo.objectsToClipboardData) {
                return classInfo.objectsToClipboardData(objects);
            }
        }
        return objectsToClipboardData(this, objects);
    }

    setRuntimeMode(isDebuggerActive: boolean) {
        let runtime: RuntimeBase;

        if (this.projectTypeTraits.runtimeType == RuntimeType.WASM) {
            runtime = new ProjectEditor.WasmRuntimeClass(this);
        } else if (this.projectTypeTraits.runtimeType == RuntimeType.REMOTE) {
            runtime = new ProjectEditor.RemoteRuntimeClass(this);
        } else {
            return;
        }

        runInAction(() => (this.runtime = runtime));

        try {
            runtime.startRuntime(isDebuggerActive);
        } catch (err) {
            notification.error(err.toString());
            runInAction(() => (this.runtime = undefined));
        }

        this.editorsStore.refresh(true);
    }

    async setEditorMode() {
        if (this.runtime) {
            if (this.runtime.isDebuggerActive) {
                const editorState = this.editorsStore.activeEditor?.state;
                if (editorState && editorState.selectObjects) {
                    editorState.selectObjects([]);
                }
            }

            await this.runtime.stopRuntime(false);
            this.dataContext.clear();

            runInAction(() => {
                this.runtime = undefined;
            });

            this.editorsStore.refresh(true);
        }
    }

    onSetEditorMode = () => {
        if (this.runtime && !this.runtime.isStopped) {
            this.runtime.stop();
        } else {
            this.setEditorMode();
            this.layoutModels.selectTab(
                this.layoutModels.root,
                LayoutModels.PROPERTIES_TAB_ID
            );
        }
    };

    onSetRuntimeMode = async () => {
        if (this.runtime) {
            if (this.runtime.isDebuggerActive) {
                this.runtime.toggleDebugger();
            }
        } else {
            this.setRuntimeMode(false);
        }
    };

    onSetDebuggerMode = () => {
        if (!this.runtime) {
            this.setRuntimeMode(true);
        } else {
            if (!this.runtime.isDebuggerActive) {
                this.editorsStore.openEditor(this.runtime.selectedPage);
                this.runtime.toggleDebugger();
            }
        }

        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.DEBUGGER_TAB_ID
        );

        if (
            this.navigationStore.selectedRootObject.get() !=
                this.project.pages ||
            this.navigationStore.selectedRootObject.get() !=
                this.project.actions
        ) {
            runInAction(() => {
                this.navigationStore.selectedRootObject.set(this.project.pages);
            });
        }
    };

    onRestart = () => {
        this.setRuntimeMode(false);
    };

    onRestartRuntimeWithDebuggerActive = () => {
        this.onSetEditorMode();
        this.setRuntimeMode(true);
    };

    loadDebugInfo(filePath: string) {
        if (this.runtime) {
            this.runtime.stopRuntime(false);
            this.dataContext.clear();
        }

        const runtime = new ProjectEditor.DebugInfoRuntimeClass(this);
        runtime.startRuntime(true);
        runtime.loadDebugInfo(filePath);
        runInAction(() => (this.runtime = runtime));
        this.editorsStore.refresh(true);
    }
}

////////////////////////////////////////////////////////////////////////////////

export async function load(projectStore: ProjectStore, filePath: string) {
    let fileData: Buffer;
    try {
        fileData = await fs.promises.readFile(filePath);
    } catch (err) {
        throw new Error(`File read error: ${err.toString()}`);
    }

    const isDashboardBuild = filePath.endsWith(".eez-dashboard");

    let projectJs;
    if (isDashboardBuild) {
        const decompress = require("decompress");
        const files = await decompress(fileData);
        projectJs = files[0].data.toString("utf8");
    } else {
        projectJs = fileData.toString("utf8");
    }

    const project: Project = loadProject(projectStore, projectJs) as Project;

    project._isDashboardBuild = isDashboardBuild;

    return project;
}

export function getJSON(projectStore: ProjectStore, tabWidth: number = 2) {
    const toJsHook = (jsObject: any, object: IEezObject) => {
        let projectFeatures = ProjectEditor.extensions;
        for (let projectFeature of projectFeatures) {
            if (projectFeature.toJsHook) {
                projectFeature.toJsHook(jsObject, object);
            }
        }
    };

    (projectStore.project as any)._store = undefined;

    const json = objectToJson(projectStore.project, tabWidth, toJsHook);

    projectStore.project._store = projectStore;

    return json;
}

export function save(projectStore: ProjectStore, filePath: string) {
    const json = getJSON(projectStore);

    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, json, "utf8", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
