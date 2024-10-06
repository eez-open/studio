import { ipcRenderer } from "electron";
import { dialog, getCurrentWindow } from "@electron/remote";
import path from "path";
import fs from "fs";
import mobx, { toJS } from "mobx";
import {
    makeObservable,
    observable,
    computed,
    action,
    autorun,
    runInAction
} from "mobx";
import type * as MousetrapModule from "mousetrap";
import update, { Spec } from "immutability-helper";

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
    setParent,
    MessageType
} from "project-editor/core/object";
import { CurrentSearch, startNewSearch } from "project-editor/core/search";

import type { DataContext } from "project-editor/features/variable/variable";

import type { RuntimeBase } from "project-editor/flow/runtime/runtime";

import { ProjectEditor } from "project-editor/project-editor-interface";

import type {
    ExtensionDirective,
    Project
} from "project-editor/project/project";

import {
    findPropertyByNameInObject,
    getClassInfo,
    getObjectFromPath,
    getObjectFromStringPath,
    objectToString
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
import { RuntimeType } from "project-editor/project/project-type-traits";
import { IExtension } from "eez-studio-shared/extensions/extension";
import {
    extensions,
    installExtension
} from "eez-studio-shared/extensions/extensions";
import type { InstrumentObject } from "instrument/instrument-object";

import { LVGLIdentifiers } from "project-editor/lvgl/identifiers";
import { OpenProjectsManager } from "project-editor/store/open-projects-manager";
import { ActionComponent } from "project-editor/flow/component";
import {
    IActionComponentDefinition,
    IObjectVariableType
} from "eez-studio-types";
import {
    createObjectVariableType,
    objectVariableTypes
} from "project-editor/features/variable/value-type";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { isValidUrl } from "project-editor/core/util";
import { reflectLvglVersion } from "project-editor/lvgl/page-runtime";
import {
    canPasteWithDependencies,
    pasteWithDependencies
} from "project-editor/store/paste-with-dependencies";
import {
    getScrapbookItemTabTitle,
    isScrapbookItemFilePath,
    setScrapbookItemEezProject
} from "./scrapbook";
import { confirm } from "eez-studio-ui/dialog-electron";

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

interface ExtensionContent {
    extensionName: string;

    actionComponentClasses: {
        className: string;
        actionComponentClass: typeof ActionComponent;
    }[];

    objectVariableTypes: {
        name: string;
        type: IObjectVariableType;
    }[];
}

type ProjectStoreContext =
    | { type: "read-only" }
    | { type: "project-editor" }
    | { type: "run-tab" }
    | {
          type: "run-embedded";
          parentProjectStore: ProjectStore;
          dashboardPath: string;
      }
    | { type: "instrument-dashboard"; instrument: InstrumentObject }
    | { type: "standalone" };

export class ProjectStore {
    project: Project;

    undoManager: UndoManager;
    navigationStore: NavigationStore;
    layoutModels: LayoutModels;
    editorModeEditorsStore: EditorsStore;
    runtimeModeEditorsStore: EditorsStore;
    uiStateStore: UIStateStore;

    runtimeSettings = new RuntimeSettings(this);
    outputSectionsStore = new OutputSections(this);
    typesStore = new TypesStore(this);
    lvglIdentifiers = new LVGLIdentifiers(this);
    openProjectsManager = new OpenProjectsManager(this);

    runtime: RuntimeBase | undefined;

    savedRevision: symbol;
    lastRevision: symbol;
    lastRevisionStable: symbol;

    lastSuccessfulBuildRevision: symbol | undefined;

    filePath: string | undefined;
    backgroundCheckEnabled = true;

    dataContext: DataContext;

    currentSearch: CurrentSearch;

    objects = new Map<string, IEezObject>();
    lastChildId = 0;

    dispose1: mobx.IReactionDisposer;
    dispose2: mobx.IReactionDisposer;
    dispose3: mobx.IReactionDisposer;
    dispose4: mobx.IReactionDisposer;
    dispose5: mobx.IReactionDisposer;

    missingExtensionsResolved: boolean = false;

    extensionNames: string[];
    objectVariableTypes = new Map<string, IObjectVariableType>();
    importedActionComponentClasses = new Map<string, typeof ActionComponent>();

    get editorsStore() {
        return this.runtime
            ? this.runtimeModeEditorsStore
            : this.editorModeEditorsStore;
    }

    get projectTypeTraits() {
        return this.project.projectTypeTraits;
    }

    static create(context: ProjectStoreContext) {
        return new ProjectStore(context);
    }

    constructor(public context: ProjectStoreContext) {
        if (this.context.type == "project-editor") {
            this.savedRevision =
                this.lastRevision =
                this.lastRevisionStable =
                    Symbol();
            this.undoManager = new UndoManager(this);
            this.navigationStore = new NavigationStore(this);

            this.layoutModels = new LayoutModels(this);
            this.editorModeEditorsStore = new EditorsStore(
                this,
                () =>
                    this.projectTypeTraits.isIEXT
                        ? this.layoutModels.rootEditorForIEXT
                        : this.layoutModels.rootEditor,
                LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID
            );
            this.runtimeModeEditorsStore = new EditorsStore(
                this,
                () => this.layoutModels.rootRuntime,
                LayoutModels.RUNTIME_MODE_EDITORS_TABSET_ID
            );

            this.uiStateStore = new UIStateStore(this);
        }

        makeObservable<ProjectStore>(this, {
            runtime: observable,
            project: observable,
            filePath: observable,
            backgroundCheckEnabled: observable,
            selectedBuildConfiguration: computed,
            masterProjectEnabled: computed,
            masterProject: computed,
            savedRevision: observable,
            lastRevision: observable,
            lastRevisionStable: observable,
            lastSuccessfulBuildRevision: observable,
            isModified: computed,
            setModified: action,
            updateLastRevisionStable: action,
            setProject: action,
            setEditorMode: action,
            onSetEditorMode: action,
            missingExtensionsResolved: observable
        });

        this.currentSearch = new ProjectEditor.documentSearch.CurrentSearch(
            this
        );
    }

    mount() {
        if (this.context.type == "project-editor") {
            this.dispose1 = autorun(
                () => {
                    this.updateProjectWindowState();
                },
                {
                    delay: 100
                }
            );
        }

        if (this.context.type == "project-editor") {
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
        }
    }

    onActivate() {
        const Mousetrap = require("mousetrap") as typeof MousetrapModule;

        Mousetrap.reset();

        Mousetrap.bind("f5", () => {
            if (
                !this.project._isDashboardBuild &&
                this.projectTypeTraits.runtimeType != RuntimeType.NONE
            ) {
                if (this.runtime) {
                    if (this.runtime.isDebuggerActive) {
                        if (this.runtime.isPaused) {
                            this.runtime.resume();
                        } else {
                            this.onSetRuntimeMode();
                        }
                    }
                } else {
                    this.onSetRuntimeMode();
                }
            }
            return false;
        });

        Mousetrap.bind("shift+f5", () => {
            if (this.runtime) {
                this.onSetEditorMode();
            }
            return false;
        });

        Mousetrap.bind("ctrl+f5", () => {
            if (
                !this.project._isDashboardBuild &&
                this.projectTypeTraits.runtimeType != RuntimeType.NONE
            ) {
                if (!this.runtime || !this.runtime.isDebuggerActive) {
                    this.onSetDebuggerMode();
                }
            }
            return false;
        });

        Mousetrap.bind("f6", () => {
            if (
                this.runtime &&
                this.runtime.isDebuggerActive &&
                !this.runtime.isPaused
            ) {
                this.runtime.pause();
            }
            return false;
        });

        Mousetrap.bind("f10", () => {
            if (
                this.runtime &&
                this.runtime.isDebuggerActive &&
                this.runtime.isPaused
            ) {
                this.runtime.runSingleStep("step-over");
            }
            return false;
        });

        Mousetrap.bind("f11", () => {
            if (
                this.runtime &&
                this.runtime.isDebuggerActive &&
                this.runtime.isPaused
            ) {
                this.runtime.runSingleStep("step-into");
            }
            return false;
        });

        Mousetrap.bind("shift+f11", () => {
            if (
                this.runtime &&
                this.runtime.isDebuggerActive &&
                this.runtime.isPaused
            ) {
                this.runtime.runSingleStep("step-out");
            }
            return false;
        });
    }

    onDeactivate() {
        const Mousetrap = require("mousetrap") as typeof MousetrapModule;

        Mousetrap.reset();
    }

    unmount() {
        this.project?.settings.general.imports.forEach(importDirective => {
            if (
                importDirective.project &&
                importDirective.project._store != this
            ) {
                importDirective.project._store.unmount();
            }
        });

        this.editorsStore?.unmount();
        this.uiStateStore?.unmount();
        this.navigationStore?.unmount();
        this.layoutModels?.unmount();

        if (this.dispose1) {
            this.dispose1();
        }
        if (this.dispose2) {
            this.dispose2();
        }
        if (this.dispose3) {
            this.dispose3();
        }
        if (this.dispose4) {
            this.dispose4();
        }
        if (this.dispose5) {
            this.dispose5();
        }

        this.openProjectsManager.unmount();

        if (this.changingRuntimeMode) {
            clearTimeout(this.changingRuntimeMode);
        }
    }

    startSearch() {
        startNewSearch(this, {
            type: "pattern",
            pattern: this.uiStateStore.searchPattern,
            matchCase: this.uiStateStore.searchMatchCase,
            matchWholeWord: this.uiStateStore.searchMatchWholeWord,
            replace: this.uiStateStore.replaceEnabled
                ? this.uiStateStore.replaceText
                : undefined,
            searchCallback: message => {
                if (message.type == "clear") {
                    this.outputSectionsStore.clear(Section.SEARCH);
                } else if (message.type == "start") {
                    this.outputSectionsStore.setLoading(Section.SEARCH, true);
                } else if (message.type == "value") {
                    this.outputSectionsStore.writeAsTree(
                        Section.SEARCH,
                        MessageType.SEARCH_RESULT,
                        objectToString(message.valueObject),
                        message.valueObject
                    );
                } else if (message.type == "finish") {
                    this.outputSectionsStore.setLoading(Section.SEARCH, false);
                }

                return true;
            }
        });
    }

    findAllReferences(object: IEezObject) {
        startNewSearch(this, {
            type: "object",
            object,
            searchCallback: message => {
                if (message.type == "clear") {
                    this.outputSectionsStore.clear(Section.REFERENCES);
                } else if (message.type == "start") {
                    this.layoutModels.selectTab(
                        this.layoutModels.root,
                        LayoutModels.REFERENCES_TAB_ID
                    );
                    this.outputSectionsStore.setLoading(
                        Section.REFERENCES,
                        true
                    );
                } else if (message.type == "value") {
                    this.outputSectionsStore.writeAsTree(
                        Section.REFERENCES,
                        MessageType.SEARCH_RESULT,
                        objectToString(message.valueObject),
                        message.valueObject
                    );
                } else if (message.type == "finish") {
                    this.outputSectionsStore.setLoading(
                        Section.REFERENCES,
                        false
                    );
                }

                return true;
            }
        });
    }

    startBackgroundCheck() {
        if (this.uiStateStore.searchPattern) {
            this.startSearch();
        }

        this.dispose5 = autorun(() => this.typesStore.reset());

        this.dispose3 = autorun(
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
            if (isScrapbookItemFilePath(this.filePath)) {
                return getScrapbookItemTabTitle(this.filePath);
            }

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
        if (this.context.type != "project-editor") {
            return;
        }

        ipcRenderer.send("windowSetState", {
            modified: this.isModified,
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
                null,
            isDebuggerActive: this.runtime && this.runtime.isDebuggerActive,
            hasExtensionDefinitions:
                this.project?.extensionDefinitions?.length > 0
        });
    }

    updateMruFilePath() {
        if (
            this.context.type != "project-editor" &&
            this.context.type != "run-tab"
        ) {
            return;
        }

        if (this.filePath && !isScrapbookItemFilePath(this.filePath)) {
            ipcRenderer.send("setMruFilePath", {
                filePath: this.filePath,
                projectType: this.project?.settings?.general?.projectType,
                hasFlowSupport:
                    this.project?.projectTypeTraits.hasFlowSupport ?? false
            });
        }
    }

    getFilePathRelativeToProjectPath(absoluteFilePath: string) {
        if (isValidUrl(absoluteFilePath)) {
            return absoluteFilePath;
        }
        return path.relative(
            path.dirname(this.filePath || ""),
            absoluteFilePath
        );
    }

    getProjectFilePath(project: Project) {
        if (project == this.project) {
            return this.filePath;
        } else {
            return this.openProjectsManager.getProjectFilePath(project);
        }
    }

    getAbsoluteFilePath(relativeFilePath: string, project?: Project) {
        if (!relativeFilePath) {
            relativeFilePath = "";
        }

        const filePath = this.getProjectFilePath(project ?? this.project);

        if (!filePath) {
            return relativeFilePath;
        }

        if (isValidUrl(filePath) || isValidUrl(relativeFilePath)) {
            return relativeFilePath;
        }

        return path.resolve(
            path.dirname(filePath),
            relativeFilePath.replace(/(\\|\/)/g, path.sep)
        );
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
                    this.uiStateStore?.selectedBuildConfiguration
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

        runInAction(() => {
            this.savedRevision = this.lastRevision;
        });
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

        const features = ProjectEditor.extensions;
        for (const feature of features) {
            if (feature.mandatory) {
                project[feature.key] = feature.create();
            }
        }

        return loadProject(this, project, true);
    }

    async newProject() {
        await this.setProject(this.getNewProject(), undefined);
    }

    async openFile(filePath: string) {
        this.filePath = filePath;

        const project = await this.openProjectsManager.openMainProject(
            filePath
        );

        await this.setProject(project, filePath);

        this.openProjectsManager.mount();

        if (this.projectTypeTraits.isLVGL) {
            reflectLvglVersion(this.project);
        }
    }

    async saveModified() {
        if (this.project._isDashboardBuild) {
            return true;
        }

        if (this.project && this.isModified) {
            return new Promise<boolean>(resolve => {
                confirmSave({
                    description: `Project "${this.title}" has been modified.\n`,
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
        if (this.projectTypeTraits.isIEXT) {
            this.buildExtensions();
            return;
        }

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
            runInAction(() => {
                this.lastSuccessfulBuildRevision = this.lastRevisionStable;
            });
            notification.info("Build successful.", { autoClose: 1000 });
        }
        return result;
    }

    buildAssets() {
        return ProjectEditor.build.buildProject(this, "buildAssets");
    }

    buildExtensions() {
        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.OUTPUT_TAB_ID
        );
        ProjectEditor.build.buildExtensions(this);
    }

    async buildAndInstallExtensions() {
        notification.info(`Building extensions ...`);

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

        if (this.uiStateStore) {
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
        return this.lastRevision != this.savedRevision;
    }

    setModified(revision: symbol) {
        const previousRevision = this.lastRevision;

        this.lastRevision = revision;

        if (this.undoManager && !this.undoManager.combineCommands) {
            this.lastRevisionStable = this.lastRevision;
        }

        return previousRevision;
    }

    updateLastRevisionStable() {
        this.lastRevisionStable = this.lastRevision;
    }

    async setProject(project: Project, projectFilePath: string | undefined) {
        this.project = project;
        this.filePath = projectFilePath;

        project._store = this;

        this.dataContext = new ProjectEditor.DataContextClass(project);

        if (this.undoManager) {
            this.undoManager.clear();
        }

        if (this.uiStateStore) {
            await this.uiStateStore.load();
        }

        await this.runtimeSettings.load();

        runInAction(() => {
            this.missingExtensionsResolved =
                this.project.missingExtensions.length == 0;
        });
    }

    canSave() {
        return this.isModified;
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
            const propertyNameParts = propertyName.split(".");

            if (inputValues.hasOwnProperty(propertyName)) {
                let propertyInfo = findPropertyByNameInObject(
                    object,
                    propertyNameParts[0]
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

                        if (propertyNameParts.length > 1) {
                            const currentValue = toJS(
                                (object as any)[propertyNameParts[0]]
                            );

                            const updateCmd: Spec<any, never> = {};

                            let x = updateCmd;

                            for (let i = 1; i < propertyNameParts.length; i++) {
                                if (i == propertyNameParts.length - 1) {
                                    x[propertyNameParts[i]] = {
                                        $set: value
                                    };
                                } else {
                                    const temp = {};
                                    x[propertyNameParts[i]] = temp;
                                    x = temp;
                                }
                            }

                            value = update(currentValue, updateCmd);
                        }

                        values[propertyNameParts[0]] = value;
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

    changingRuntimeMode: any;
    changingRuntimeModeNewMode: "editor" | "runtime" | "debugger" | undefined;
    static CONF_CHANGE_RUNTIME_MODE_DEBOUNCE_TIMEOUT = 300;

    debounceChangeRuntimeMode() {
        if (this.changingRuntimeMode) {
            return true;
        }
        this.changingRuntimeMode = setTimeout(() => {
            this.changingRuntimeMode = undefined;
            if (this.changingRuntimeModeNewMode != undefined) {
                if (this.changingRuntimeModeNewMode == "editor") {
                    this.onSetEditorMode();
                } else if (this.changingRuntimeModeNewMode == "runtime") {
                    this.onSetRuntimeMode();
                } else {
                    this.onSetDebuggerMode();
                }
                this.changingRuntimeModeNewMode = undefined;
            }
            this.changingRuntimeMode = false;
        }, ProjectStore.CONF_CHANGE_RUNTIME_MODE_DEBOUNCE_TIMEOUT);
        return false;
    }

    setRuntimeMode(isDebuggerActive: boolean) {
        if (this.debounceChangeRuntimeMode()) {
            return;
        }

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

        this.editorsStore?.refresh(true);
    }

    async setEditorMode(force: boolean = false) {
        if (this.debounceChangeRuntimeMode()) {
            if (force) {
                clearTimeout(this.changingRuntimeMode);
                this.changingRuntimeMode = undefined;
            } else {
                return;
            }
        }

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

            this.editorsStore?.refresh(true);
        }
    }

    onSetEditorMode = () => {
        if (this.changingRuntimeMode) {
            this.changingRuntimeModeNewMode = "editor";
            return;
        }

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
        if (this.changingRuntimeMode) {
            this.changingRuntimeModeNewMode = "runtime";
            return;
        }

        if (this.runtime) {
            if (this.runtime.isDebuggerActive) {
                this.runtime.toggleDebugger();
            }
        } else {
            this.setRuntimeMode(false);
        }
    };

    onSetDebuggerMode = () => {
        if (this.changingRuntimeMode) {
            this.changingRuntimeModeNewMode = "debugger";
            return;
        }

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

    buildImportedExtensions(project: Project) {
        // build importedExtensionToExtensionContent
        const importedExtensionToExtensionContent = new Map<
            ExtensionDirective,
            ExtensionContent
        >();

        const extensionDirectives = project.settings?.general?.extensions;
        if (extensionDirectives) {
            for (const extensionDirective of extensionDirectives) {
                if (extensionDirective.extensionName) {
                    const extension = extensions.get(
                        extensionDirective.extensionName
                    );

                    if (!extension) {
                        continue;
                    }

                    if (!extension.eezFlowExtensionInit) {
                        continue;
                    }

                    try {
                        const extensionContent: ExtensionContent = {
                            extensionName: extension.name,
                            actionComponentClasses: [],
                            objectVariableTypes: []
                        };

                        extension.eezFlowExtensionInit({
                            registerActionComponent: (
                                actionComponentDefinition: IActionComponentDefinition
                            ) => {
                                const { className, actionComponentClass } =
                                    ProjectEditor.createActionComponentClass(
                                        actionComponentDefinition,
                                        `${extension.name}/${actionComponentDefinition.name}`
                                    );

                                extensionContent.actionComponentClasses.push({
                                    className,
                                    actionComponentClass
                                });
                            },

                            registerObjectVariableType: (
                                name: string,
                                objectVariableType: IObjectVariableType
                            ) => {
                                extensionContent.objectVariableTypes.push({
                                    name: `${extension.name}/${name}`,
                                    type: createObjectVariableType(
                                        objectVariableType
                                    )
                                });
                            },

                            showGenericDialog,

                            validators: {
                                required: validators.required,
                                rangeInclusive: validators.rangeInclusive
                            }
                        });

                        importedExtensionToExtensionContent.set(
                            extensionDirective,
                            extensionContent
                        );
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

        //
        // build objectVariableTypes
        //
        this.objectVariableTypes = new Map<string, IObjectVariableType>();

        const globalObjectVariableTypes = objectVariableTypes;

        // insert global object variable types
        for (const [name, objectVariableType] of globalObjectVariableTypes) {
            this.objectVariableTypes.set(name, objectVariableType);
        }

        // insert object variable types from imported extensions
        for (const extensionContent of importedExtensionToExtensionContent.values()) {
            for (const objectVariableType of extensionContent.objectVariableTypes) {
                this.objectVariableTypes.set(
                    objectVariableType.name,
                    objectVariableType.type
                );
            }
        }

        //
        // build importedActionComponentClasses
        //
        this.importedActionComponentClasses = new Map<
            string,
            typeof ActionComponent
        >();

        // insert action component classes from imported extensions
        for (const extensionContent of importedExtensionToExtensionContent.values()) {
            for (const actionComponentClass of extensionContent.actionComponentClasses) {
                this.importedActionComponentClasses.set(
                    actionComponentClass.className,
                    actionComponentClass.actionComponentClass
                );
            }
        }
    }

    getClassByName(className: string) {
        return this.importedActionComponentClasses.get(className);
    }

    reloadProject() {
        ProjectEditor.homeTabs?.reloadProject(this);
    }

    get isScpiInstrument() {
        return this.project.scpi != undefined;
    }

    get canCut() {
        return (
            this.navigationStore.selectedPanel &&
            this.navigationStore.selectedPanel.cutSelection &&
            this.navigationStore.selectedPanel.canCut!()
        );
    }

    cut = () => {
        if (
            this.navigationStore.selectedPanel &&
            this.navigationStore.selectedPanel.cutSelection
        ) {
            this.navigationStore.selectedPanel.cutSelection();
        }
    };

    get canCopy() {
        return (
            this.navigationStore.selectedPanel &&
            this.navigationStore.selectedPanel.copySelection &&
            this.navigationStore.selectedPanel.canCopy!()
        );
    }

    copy = () => {
        if (!this.canCopy) {
            return;
        }
        if (
            this.navigationStore.selectedPanel &&
            this.navigationStore.selectedPanel.copySelection
        ) {
            this.navigationStore.selectedPanel.copySelection();
        }
    };

    get canPaste() {
        return (
            canPasteWithDependencies(this) ||
            (this.navigationStore.selectedPanel &&
                this.navigationStore.selectedPanel.pasteSelection &&
                this.navigationStore.selectedPanel.canPaste!())
        );
    }

    paste = () => {
        const pasteToSelectedPanel = () => {
            if (
                this.navigationStore.selectedPanel &&
                this.navigationStore.selectedPanel.pasteSelection
            ) {
                this.navigationStore.selectedPanel.pasteSelection();
            }
        };

        if (canPasteWithDependencies(this)) {
            confirm(
                "Do you want to paste with all the dependencies?",
                "Clipboard content is from the different project.",
                () => pasteWithDependencies(this),
                () => pasteToSelectedPanel()
            );
        } else {
            pasteToSelectedPanel();
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

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

    if (isScrapbookItemFilePath(filePath)) {
        return new Promise<void>((resolve, reject) => {
            try {
                setScrapbookItemEezProject(filePath, json);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

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
