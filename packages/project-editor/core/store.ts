import React from "react";
import * as mobx from "mobx";
import {
    observable,
    extendObservable,
    computed,
    action,
    toJS,
    reaction,
    autorun,
    runInAction
} from "mobx";
import type { FSWatcher } from "chokidar";

import {
    _each,
    _isArray,
    _map,
    _uniqWith,
    _find
} from "eez-studio-shared/algorithm";

import * as notification from "eez-studio-ui/notification";

import { confirmSave } from "eez-studio-shared/util";
import { confirm } from "project-editor/core/util";

import { showGenericDialog, TableField } from "eez-studio-ui/generic-dialog";

import {
    IEezObject,
    PropertyInfo,
    PropertyType,
    IEditorState,
    IEditor,
    getProperty,
    isValue,
    isArray,
    isArrayElement,
    getObjectPathAsString,
    objectToString,
    isObjectExists,
    findPropertyByNameInObject,
    getObjectFromPath,
    getObjectFromStringPath,
    isPropertyEnumerable,
    isPartOfNavigation,
    getParent,
    getKey,
    getId,
    getClass,
    getClassInfo,
    getEditorComponent,
    isEezObject,
    getRootObject,
    getAncestorOfType,
    makeDerivedClassInfo,
    EezClass,
    registerClassByName,
    specificGroup
} from "project-editor/core/object";
import {
    checkClipboard,
    objectToClipboardData,
    copyToClipboard,
    objectsToClipboardData
} from "project-editor/core/clipboard";
import {
    ICommand,
    addObject,
    addObjects,
    insertObject,
    updateObject,
    deleteObject,
    deleteObjects,
    replaceObject,
    replaceObjects,
    insertObjectBefore,
    insertObjectAfter
} from "project-editor/core/commands";
import {
    loadObject,
    objectToJS,
    objectToJson
} from "project-editor/core/serialization";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { OutputSections, OutputSection } from "project-editor/core/output";

import { getProjectFeatures } from "project-editor/core/extensions";

import * as SearchModule from "project-editor/core/search";
import {
    DataContext,
    RenderVariableStatus,
    VariableType
} from "project-editor/features/variable/variable";
import { CurrentSearch } from "project-editor/core/search";
import { Project, getFlow, ProjectType } from "project-editor/project/project";

import {
    build as buildProject,
    backgroundCheck,
    buildExtensions
} from "project-editor/project/build";
import { getAllMetrics } from "project-editor/project/metrics";
import {
    ActionComponent,
    Component,
    CustomInput,
    CustomOutput
} from "project-editor/flow/component";
import { Page } from "project-editor/features/page/page";
import { ConnectionLine, Flow, FlowFragment } from "project-editor/flow/flow";

import { Section } from "project-editor/core/output";
import { isWebStudio } from "eez-studio-shared/util-electron";
import { RuntimeBase } from "project-editor/flow/runtime";
import { theme } from "eez-studio-ui/theme";
import { evalExpression } from "project-editor/flow/expression/expression";
import { validators } from "eez-studio-shared/validation";
import { LocalRuntime } from "project-editor/flow/local-runtime";
import { RemoteRuntime } from "project-editor/flow/remote-runtime";

const { Menu, MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export interface IPanel {
    selectedObject: IEezObject | undefined;
    selectedObjects?: IEezObject[];
    cutSelection(): void;
    copySelection(): void;
    pasteSelection(): void;
    deleteSelection(): void;
}

export interface INavigationStore {
    selectedPanel?: IPanel;
    selectedObject?: IEezObject;
    getNavigationSelectedObject(
        navigationObject: IEezObject
    ): IEezObject | undefined;
    setNavigationSelectedObject(
        navigationObject: IEezObject,
        navigationSelectedObject: IEezObject
    ): void;
    setSelectedPanel(selectedPanel: IPanel | undefined): void;
    editable: boolean;
}

export class SimpleNavigationStoreClass implements INavigationStore {
    @observable selectedObject: IEezObject | undefined;

    constructor(
        selectedObject: IEezObject | undefined,
        public editable = true
    ) {
        this.selectedObject = selectedObject;
    }

    getNavigationSelectedObject(navigationObject: IEezObject) {
        return this.selectedObject;
    }

    @action
    setNavigationSelectedObject(
        navigationObject: IEezObject,
        navigationSelectedObject: IEezObject
    ) {
        this.selectedObject = navigationSelectedObject;
    }

    setSelectedPanel(selectedPanel: IPanel | undefined) {}
}

class NavigationStore implements INavigationStore {
    @observable navigationMap = new Map<string, IEezObject>();
    @observable selectedPanel: IPanel | undefined;

    editable = true;

    constructor(public DocumentStore: DocumentStoreClass) {}

    loadNavigationMap(map: { [stringPath: string]: string }) {
        let navigationMap = new Map<string, IEezObject>();

        for (let stringPath in map) {
            if (typeof stringPath != "string") {
                continue;
            }

            let navigationObject =
                this.DocumentStore.getObjectFromStringPath(stringPath);
            if (navigationObject) {
                let navigationSubobjectStr = map[stringPath];

                if (typeof navigationSubobjectStr != "string") {
                    continue;
                }

                if (navigationSubobjectStr === stringPath) {
                    continue;
                }
                const navigationSubobject =
                    this.DocumentStore.getObjectFromStringPath(
                        navigationSubobjectStr
                    );

                if (navigationSubobject) {
                    navigationMap.set(
                        getId(navigationObject),
                        navigationSubobject
                    );
                }
            }
        }

        this.navigationMap = navigationMap;
    }

    loadSettingsNavigationState(settingsNavigationState: any) {
        if (settingsNavigationState) {
            if (this.settingsNavigationObjectAdapter) {
                this.settingsNavigationObjectAdapter.loadState(
                    settingsNavigationState
                );
            }
        }
    }

    @computed
    get navigationMapToJS() {
        let map: any = {};
        for (var [id, navigationSubobject] of this.navigationMap) {
            let navigationObject = this.DocumentStore.getObjectFromObjectId(id);
            if (navigationObject) {
                let navigationObjectPath =
                    getObjectPathAsString(navigationObject);
                map[navigationObjectPath] =
                    getObjectPathAsString(navigationSubobject);
            }
        }
        return map;
    }

    @computed
    get settingsNavigationStateToJS() {
        if (this.settingsNavigationObjectAdapter) {
            return this.settingsNavigationObjectAdapter.saveState();
        }
        return {};
    }

    @action
    setSelectedPanel(selectedPanel: IPanel | undefined) {
        this.selectedPanel = selectedPanel;
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        let object: IEezObject = this.DocumentStore.project;
        if (!object) {
            return undefined;
        }

        while (true) {
            let child = this.getNavigationSelectedObject(object);
            if (!child) {
                return object;
            }
            object = child;
        }
    }

    isSelected(object: IEezObject) {
        let iterObject = object;
        let parent = getParent(iterObject);
        while (iterObject && parent) {
            if (getClassInfo(parent).navigationComponent) {
                let grandparent = getParent(parent);
                if (!isArray(grandparent)) {
                    let selectedObject =
                        this.getNavigationSelectedObject(parent);
                    if (selectedObject != iterObject) {
                        return false;
                    }
                }
            }
            iterObject = parent;
            parent = getParent(iterObject);
        }

        return true;
    }

    getNavigationSelectedObject(
        navigationObject: IEezObject
    ): IEezObject | undefined {
        let item = this.navigationMap.get(getId(navigationObject));

        if (!item) {
            let defaultNavigationKey =
                getClassInfo(navigationObject).defaultNavigationKey;
            if (defaultNavigationKey) {
                item = getProperty(navigationObject, defaultNavigationKey);
            }
        }
        return item;
    }

    @action
    setNavigationSelectedObject(
        navigationObject: IEezObject,
        navigationSelectedObject: IEezObject
    ) {
        this.navigationMap.set(
            getId(navigationObject),
            navigationSelectedObject
        );

        if (!isPartOfNavigation(navigationObject)) {
            return;
        }

        let parent = getParent(navigationObject);
        if (parent) {
            this.setNavigationSelectedObject(parent, navigationObject);
        }
    }

    getSelection(): IEezObject[] | undefined {
        // TODO
        return undefined;
    }

    @action
    setSelection(selection: IEezObject[] | undefined) {
        if (!selection || selection.length == 0) {
            return;
        }

        let object = selection[0];

        let iterObject = object;
        let parent = getParent(iterObject);
        while (iterObject && parent) {
            let grandparent = getParent(parent);
            if (!isArray(grandparent)) {
                this.setNavigationSelectedObject(parent, iterObject);
            }

            iterObject = parent;
            parent = getParent(iterObject);
        }
    }

    showObject(objectToShow: IEezObject) {
        this.setSelection([objectToShow]);

        for (
            let object: IEezObject | undefined = objectToShow;
            object;
            object = getParent(object)
        ) {
            if (getEditorComponent(object)) {
                const editor =
                    this.DocumentStore.editorsStore.openEditor(object);
                if (editor && editor.state) {
                    editor.state.selectObject(
                        isValue(objectToShow)
                            ? getParent(objectToShow)
                            : objectToShow
                    );
                }
                break;
            }
        }
    }

    _settingsNavigationObjectAdapter: TreeObjectAdapter;

    get settingsNavigationObjectAdapter() {
        if (!this._settingsNavigationObjectAdapter) {
            if (this.DocumentStore.project) {
                this._settingsNavigationObjectAdapter = new TreeObjectAdapter(
                    this.DocumentStore.project.settings
                );
            }
        }
        return this._settingsNavigationObjectAdapter;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Editor implements IEditor {
    @observable object: IEezObject;
    @observable active: boolean;
    @observable permanent: boolean;
    @observable state: IEditorState | undefined;

    loading = false;

    constructor(public DocumentStore: DocumentStoreClass) {}

    @computed
    get id() {
        return getId(this.object);
    }

    @computed
    get title() {
        // if (isArrayElement(this.object)) {
        //     return `${getClass(this.object).name}: ${objectToString(this.object)}`;
        // } else {
        //     return objectToString(this.object);
        // }
        return objectToString(this.object);
    }

    @action
    makeActive() {
        this.DocumentStore.editorsStore.activateEditor(this);
    }

    @action
    makePermanent() {
        this.permanent = true;
    }

    close() {
        this.DocumentStore.editorsStore.closeEditor(this);
        if (this.state) {
            this.state.saveState();
        }
    }
}

class EditorsStore {
    @observable editors: Editor[] = [];

    dispose1: mobx.IReactionDisposer;
    dispose2: mobx.IReactionDisposer;

    constructor(public DocumentStore: DocumentStoreClass) {
        // open editor when navigation selection has changed
        this.dispose1 = autorun(() => {
            let object = DocumentStore.navigationStore.selectedObject;
            while (object) {
                let selectedObject =
                    DocumentStore.navigationStore.getNavigationSelectedObject(
                        object
                    );

                while (selectedObject) {
                    if (
                        !isArray(selectedObject) &&
                        getEditorComponent(selectedObject)
                    ) {
                        this.openEditor(selectedObject);
                    }

                    selectedObject =
                        DocumentStore.navigationStore.getNavigationSelectedObject(
                            selectedObject
                        );
                }

                object = getParent(object);
            }
        });

        // close editor if editor object doesn't exists anymore
        this.dispose2 = autorun(() => {
            this.editors.slice().forEach(editor => {
                if (!isObjectExists(editor.object)) {
                    this.closeEditor(editor);
                }
            });
        });
    }

    unmount() {
        this.dispose1();
        this.dispose2();
    }

    load(editors: any[]) {
        if (editors) {
            this.editors = editors
                .map((editor: any) => {
                    let object;
                    if (_isArray(editor.object)) {
                        object = this.DocumentStore.getObjectFromPath(
                            editor.object
                        );
                    } else {
                        object = this.DocumentStore.getObjectFromStringPath(
                            editor.object
                        );
                    }
                    if (object) {
                        let newEditor = new Editor(this.DocumentStore);
                        newEditor.object = object;
                        newEditor.active = editor.active;
                        newEditor.permanent = editor.permanent;
                        const createEditorState =
                            getClassInfo(object).createEditorState;
                        if (createEditorState) {
                            newEditor.state = createEditorState(object);
                            if (editor.state && newEditor.state) {
                                newEditor.state.loadState(editor.state);
                            }
                        }
                        return newEditor;
                    }
                    return undefined;
                })
                .filter((editor: Editor | undefined) => !!editor) as Editor[];
        } else {
            this.editors = [];
        }
    }

    @computed
    get toJS() {
        return this.editors.map(editor => ({
            object: getObjectPathAsString(editor.object),
            active: editor.active,
            permanent: editor.permanent,
            state: editor.state && editor.state.saveState()
        }));
    }

    @computed
    get activeEditor() {
        for (let i = 0; i < this.editors.length; i++) {
            let editor = this.editors[i];
            if (editor.active) {
                return editor;
            }
        }
        return undefined;
    }

    @action
    activateEditor(editor: Editor) {
        if (editor.active) {
            return;
        }

        let activeEditor = this.activeEditor;
        if (activeEditor) {
            activeEditor.active = false;
        }

        editor.active = true;

        this.DocumentStore.navigationStore.setSelection([editor.object]);

        setTimeout(() => {
            const el = document.querySelector(
                "#eez-project-active-editor [tabindex]"
            );
            if (el && el instanceof HTMLElement) {
                el.focus();
            }
        }, 0);
    }

    @action
    openEditor(object: IEezObject, openAsPermanentEditor: boolean = false) {
        let nonPermanentEditor: Editor | undefined;

        let editorFound: Editor | undefined;

        for (let i = 0; i < this.editors.length; i++) {
            if (this.editors[i].object == object) {
                this.editors[i].active = true;
                editorFound = this.editors[i];
            } else {
                if (this.editors[i].active) {
                    this.editors[i].active = false;
                }
                if (!openAsPermanentEditor && !this.editors[i].permanent) {
                    nonPermanentEditor = this.editors[i];
                }
            }
        }

        if (editorFound) {
            return editorFound;
        }

        if (!nonPermanentEditor) {
            nonPermanentEditor = new Editor(this.DocumentStore);
            this.editors.push(nonPermanentEditor);
        }
        nonPermanentEditor.permanent = openAsPermanentEditor;
        nonPermanentEditor.object = object;
        nonPermanentEditor.active = true;

        if (nonPermanentEditor.state) {
            nonPermanentEditor.state.saveState();
        }

        const createEditorState = getClassInfo(object).createEditorState;
        if (createEditorState) {
            nonPermanentEditor.state = createEditorState(object);
        } else {
            nonPermanentEditor.state = undefined;
        }

        return nonPermanentEditor;
    }

    @action
    openPermanentEditor(object: IEezObject) {
        this.openEditor(object, true);
    }

    @action
    makeActiveEditorPermanent() {
        for (let i = 0; i < this.editors.length; i++) {
            if (this.editors[i].active) {
                this.editors[i].permanent = true;
                return;
            }
        }
    }

    @action
    closeEditor(editor: Editor) {
        let index = this.editors.indexOf(editor);
        if (index != -1) {
            this.editors.splice(index, 1);
            if (editor.active) {
                if (index < this.editors.length) {
                    this.activateEditor(this.editors[index]);
                } else if (this.editors.length > 0) {
                    this.activateEditor(this.editors[this.editors.length - 1]);
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ViewOptions {
    @observable outputVisible: boolean = true;
    @observable themesVisible: boolean = true;

    @action
    load(viewOptions: any) {
        if (viewOptions) {
            this.outputVisible = viewOptions.outputVisible;
            this.themesVisible = viewOptions.themesVisible;
        } else {
            this.outputVisible = true;
            this.themesVisible = true;
        }
    }

    @computed
    get toJS() {
        return toJS(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

class UIStateStore {
    @observable viewOptions: ViewOptions = new ViewOptions();
    @observable selectedBuildConfiguration: string;
    @observable features: any;
    @observable savedState: any;
    @observable searchPattern: string;
    @observable searchMatchCase: boolean;
    @observable searchMatchWholeWord: boolean;
    @observable activeOutputSection = Section.CHECKS;
    @observable pageEditorFrontFace: boolean = false;
    @observable pageRuntimeFrontFace: boolean = true;
    @observable showCommandPalette: boolean = false;

    objectUIStates = new Map<string, any>();

    dispose1: mobx.IReactionDisposer;

    constructor(public DocumentStore: DocumentStoreClass) {
        // react when selected panel or selected message in output window has changed
        this.dispose1 = reaction(
            () => ({
                message:
                    this.DocumentStore.outputSectionsStore?.activeSection
                        .selectedMessage,
                panel: this.DocumentStore.navigationStore.selectedPanel
            }),
            arg => {
                if (
                    arg.panel instanceof OutputSection &&
                    arg.message &&
                    arg.message.object
                ) {
                    this.DocumentStore.navigationStore.showObject(
                        arg.message.object
                    );
                }
            },
            {
                delay: 100
            }
        );
    }

    unmount() {
        this.dispose1();
    }

    loadObjects(objects: any) {
        this.objectUIStates.clear();
        _each(objects, (value: any, objectPath: any) => {
            this.objectUIStates.set(objectPath, value);
        });
    }

    @action
    load(uiState: any) {
        this.viewOptions.load(uiState.viewOptions);

        this.DocumentStore.navigationStore.loadNavigationMap(
            uiState.navigationMap
        );
        this.DocumentStore.navigationStore.loadSettingsNavigationState(
            uiState.settingsNavigationState
        );

        this.loadObjects(uiState.objects);

        this.DocumentStore.editorsStore.load(uiState.editors);

        this.selectedBuildConfiguration =
            uiState.selectedBuildConfiguration || "Default";
        this.features = observable(uiState.features || {});
        this.activeOutputSection =
            uiState.activeOutputSection ?? Section.CHECKS;
        this.pageEditorFrontFace = uiState.pageEditorFrontFace;
        this.pageRuntimeFrontFace = uiState.pageRuntimeFrontFace;

        if (uiState.breakpoints) {
            for (const key in uiState.breakpoints) {
                const component = this.DocumentStore.getObjectFromStringPath(
                    key
                ) as Component;
                if (component) {
                    this.breakpoints.set(component, uiState.breakpoints[key]);
                }
            }
        }
    }

    get featuresJS() {
        return toJS(this.features);
    }

    get objectsJS() {
        let map: any = {};
        for (let [key, value] of this.objectUIStates) {
            const i = key.indexOf("[");
            let objectPath;
            if (i != -1) {
                objectPath = key.substring(0, i);
            } else {
                objectPath = key;
            }
            if (this.DocumentStore.getObjectFromStringPath(objectPath)) {
                map[key] = value;
            }
        }
        return map;
    }

    get toJS() {
        const state = {
            viewOptions: this.viewOptions.toJS,
            navigationMap: this.DocumentStore.navigationStore.navigationMapToJS,
            settingsNavigationState:
                this.DocumentStore.navigationStore.settingsNavigationStateToJS,
            editors: this.DocumentStore.editorsStore.toJS,
            selectedBuildConfiguration: this.selectedBuildConfiguration,
            features: this.featuresJS,
            objects: this.objectsJS,
            activeOutputSection: this.activeOutputSection,
            pageEditorFrontFace: this.pageEditorFrontFace,
            pageRuntimeFrontFace: this.pageRuntimeFrontFace,
            breakpoints: Array.from(this.breakpoints).reduce(
                (obj, [key, value]) =>
                    Object.assign(obj, {
                        [getObjectPathAsString(key)]: value
                    }),
                {}
            )
        };

        state.objects = this.objectsJS;

        return state;
    }

    @action
    getFeatureParam<T>(
        extensionName: string,
        paramName: string,
        defaultValue: T
    ): T {
        let extension = this.features[extensionName];
        if (!extension) {
            extension = observable({});
            extendObservable(this.features, {
                [extensionName]: extension
            });
        }
        let paramValue = extension[paramName];
        if (!paramValue) {
            extendObservable(extension, {
                [paramName]: defaultValue
            });
            return defaultValue;
        }
        return paramValue as T;
    }

    @action
    setSelectedBuildConfiguration(selectedBuildConfiguration: string) {
        this.selectedBuildConfiguration = selectedBuildConfiguration;
    }

    getObjectUIState(object: IEezObject, option: string) {
        const key = getObjectPathAsString(object) + `[${option}]`;
        return this.objectUIStates.get(key);
    }

    updateObjectUIState(object: IEezObject, option: string, changes: any) {
        const key = getObjectPathAsString(object) + `[${option}]`;
        let objectUIState = this.objectUIStates.get(key);
        if (objectUIState) {
            Object.assign(objectUIState, changes);
        } else {
            this.objectUIStates.set(key, changes);
        }
    }

    ////////////////////////////////////////
    // BREAKPOINTS

    @observable breakpoints = new Map<Component, boolean>();

    isBreakpointAddedForComponent(component: Component) {
        return this.breakpoints.has(component);
    }

    isBreakpointEnabledForComponent(component: Component) {
        return this.breakpoints.get(component) == true;
    }

    @action
    addBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointAdded(component);
        }
    }

    @action
    removeBreakpoint(component: Component) {
        this.breakpoints.delete(component);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointRemoved(component);
        }
    }

    @action
    enableBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointEnabled(component);
        }
    }

    @action
    disableBreakpoint(component: Component) {
        this.breakpoints.set(component, false);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointDisabled(component);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IUndoItem {
    commands: ICommand[];
    selectionBefore: any;
    selectionAfter: any;
}

export class UndoManager {
    @observable undoStack: IUndoItem[] = [];
    @observable redoStack: IUndoItem[] = [];
    @observable commands: ICommand[] = [];

    private selectionBeforeFirstCommand: any;
    public combineCommands: boolean = false;

    constructor(public DocumentStore: DocumentStoreClass) {}

    @action
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    @action
    pushToUndoStack() {
        if (this.commands.length > 0) {
            let selectionAfter =
                this.DocumentStore.navigationStore.getSelection();
            this.undoStack.push({
                commands: this.commands,
                selectionBefore: this.selectionBeforeFirstCommand,
                selectionAfter: selectionAfter
            });

            this.commands = [];
            this.selectionBeforeFirstCommand =
                this.DocumentStore.navigationStore.getSelection();
        }
    }

    @action
    setCombineCommands(value: boolean) {
        this.pushToUndoStack();
        this.combineCommands = value;
    }

    @action
    executeCommand(command: ICommand) {
        if (this.commands.length == 0) {
            this.selectionBeforeFirstCommand =
                this.DocumentStore.navigationStore.getSelection();
        } else {
            if (!this.combineCommands) {
                this.pushToUndoStack();
            }
        }

        command.execute();
        this.commands.push(command);

        this.redoStack = [];

        this.DocumentStore.setModified(true);
    }

    static getCommandsDescription(commands: ICommand[]) {
        return commands[commands.length - 1].description;
    }

    @computed
    get canUndo() {
        return this.undoStack.length > 0 || this.commands.length > 0;
    }

    @computed
    get undoDescription() {
        let commands;
        if (this.commands.length > 0) {
            commands = this.commands;
        } else if (this.undoStack.length > 0) {
            commands = this.undoStack[this.undoStack.length - 1].commands;
        }
        if (commands) {
            return UndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    @action
    undo() {
        this.pushToUndoStack();

        let undoItem = this.undoStack.pop();
        if (undoItem) {
            for (let i = undoItem.commands.length - 1; i >= 0; i--) {
                undoItem.commands[i].undo();
            }

            this.DocumentStore.navigationStore.setSelection(
                undoItem.selectionBefore
            );

            this.redoStack.push(undoItem);

            this.DocumentStore.setModified(true);
        }
    }

    @computed
    get canRedo() {
        return this.redoStack.length > 0;
    }

    @computed
    get redoDescription() {
        let commands;
        if (this.redoStack.length > 0) {
            commands = this.redoStack[this.redoStack.length - 1].commands;
        }
        if (commands) {
            return UndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    @action
    redo() {
        let redoItem = this.redoStack.pop();
        if (redoItem) {
            for (let i = 0; i < redoItem.commands.length; i++) {
                redoItem.commands[i].execute();
            }

            this.DocumentStore.navigationStore.setSelection(
                redoItem.selectionAfter
            );

            this.undoStack.push(redoItem);

            this.DocumentStore.setModified(true);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function getUIStateFilePath(projectFilePath: string) {
    return projectFilePath + "-ui-state";
}

export async function load(
    DocumentStore: DocumentStoreClass,
    filePath: string
) {
    await initExtensions();

    return new Promise<Project>((resolve, reject) => {
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error("HTTP error " + response.status);
                }
                return response.json();
            })
            .then(projectJs => {
                let project = loadObject(
                    DocumentStore,
                    undefined,
                    projectJs,
                    Project
                ) as Project;
                resolve(project);
                //console.timeEnd("load");
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

export function save(DocumentStore: DocumentStoreClass, filePath: string) {
    const toJsHook = (jsObject: any, object: IEezObject) => {
        let projectFeatures = getProjectFeatures();
        for (let projectFeature of projectFeatures) {
            if (
                projectFeature.eezStudioExtension.implementation.projectFeature
                    .toJsHook
            ) {
                projectFeature.eezStudioExtension.implementation.projectFeature.toJsHook(
                    jsObject,
                    object
                );
            }
        }
    };

    (DocumentStore.project as any)._DocumentStore = undefined;

    const json = objectToJson(DocumentStore.project, 2, toJsHook);

    DocumentStore.project._DocumentStore = DocumentStore;

    return new Promise<void>((resolve, reject) => {
        const fs = EEZStudio.remote.require("fs");
        fs.writeFile(filePath, json, "utf8", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

////////////////////////////////////////////////////////////////////////////////

export class DocumentStoreClass {
    undoManager = new UndoManager(this);
    navigationStore = new NavigationStore(this);
    editorsStore = new EditorsStore(this);
    uiStateStore = new UIStateStore(this);
    outputSectionsStore = new OutputSections(this);

    @observable runtime: RuntimeBase | undefined;

    @observable private _project: Project | undefined;
    @observable modified: boolean = false;

    @observable filePath: string | undefined;
    @observable backgroundCheckEnabled = true;

    dataContext!: DataContext;

    currentSearch = new CurrentSearch(this);

    objects = new Map<string, IEezObject>();
    lastChildId = 0;

    @observable externalProjects = new Map<string, Project>();
    @observable mapExternalProjectToAbsolutePath = new Map<Project, string>();
    externalProjectsLoading = new Map<string, boolean>();

    dispose1: mobx.IReactionDisposer;
    dispose2: mobx.IReactionDisposer;
    dispose3: mobx.IReactionDisposer;
    dispose4: mobx.IReactionDisposer;

    watcher: FSWatcher | undefined = undefined;

    static async create() {
        await initExtensions();
        return new DocumentStoreClass();
    }

    constructor() {
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

        if (!isWebStudio()) {
            this.watch();
        }
    }

    async watch() {
        const chokidarModuleName = "chokidar";
        const { watch } = await import(chokidarModuleName);
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
                        });
                    }
                });
            }
        });
    }

    unmount() {
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
    }

    async loadAllExternalProjects() {
        const project = this.project!;

        // load master project
        if (project.settings.general.masterProject) {
            await project.loadMasterProject();
        }

        // load imported projects
        for (let i = 0; i < project.settings.general.imports.length; i++) {
            await project.settings.general.imports[i].loadProject();
        }
    }

    startBackgroundCheck() {
        this.dispose4 = autorun(() => {
            // check the project in the background
            if (
                this.project &&
                this.project._DocumentStore.backgroundCheckEnabled
            ) {
                backgroundCheck(this);
            }
        });
    }

    updateProjectWindowState() {
        if (isWebStudio()) {
            return;
        }

        const path = EEZStudio.remote.require("path");

        let title = "";

        if (this.project) {
            if (this.modified) {
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
        EEZStudio.electron.ipcRenderer.send("setMruFilePath", this.filePath);
    }

    getFilePathRelativeToProjectPath(absoluteFilePath: string) {
        const path = EEZStudio.remote.require("path");
        return path.relative(path.dirname(this.filePath), absoluteFilePath);
    }

    getProjectFilePath(project: Project) {
        if (project == this.project) {
            return this.filePath;
        } else {
            return this.mapExternalProjectToAbsolutePath.get(project);
        }
    }

    getAbsoluteFilePath(relativeFilePath: string, project?: Project) {
        if (isWebStudio()) {
            return relativeFilePath;
        }

        const path = EEZStudio.remote.require("path");
        const filePath = this.getProjectFilePath(project ?? this.project);
        return filePath
            ? path.resolve(
                  path.dirname(filePath),
                  relativeFilePath.replace(/(\\|\/)/g, path.sep)
              )
            : relativeFilePath;
    }

    getFolderPathRelativeToProjectPath(absoluteFolderPath: string) {
        const path = EEZStudio.remote.require("path");
        let folder = path.relative(
            path.dirname(this.filePath),
            absoluteFolderPath
        );
        if (folder == "") {
            folder = ".";
        }
        return folder;
    }

    @computed
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
        await save(this, this.filePath!);
        this.saveUIState();
        this.setModified(false);
    }

    async saveToFile(saveAs: boolean) {
        if (this.project) {
            if (!this.filePath || saveAs) {
                const result = await EEZStudio.remote.dialog.showSaveDialog(
                    EEZStudio.remote.getCurrentWindow(),
                    {
                        filters: [
                            {
                                name: "EEZ Project",
                                extensions: ["eez-project"]
                            },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    }
                );
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

        return loadObject(
            this,
            undefined,
            project as Project,
            Project
        ) as Project;
    }

    newProject() {
        this.changeProject(undefined, this.getNewProject());
    }

    loadUIState(projectFilePath: string) {
        if (isWebStudio()) {
            return {} as any;
        }

        return new Promise<any>((resolve, reject) => {
            const fs = EEZStudio.remote.require("fs");
            fs.readFile(
                getUIStateFilePath(projectFilePath),
                "utf8",
                (err: any, data: string) => {
                    if (err) {
                        resolve({});
                    } else {
                        try {
                            resolve(JSON.parse(data));
                        } catch (err) {
                            console.error("Invalid UI state file", err);
                            resolve({});
                        }
                    }
                }
            );
        });
    }

    saveUIState() {
        return new Promise<void>(resolve => {
            if (this.filePath) {
                const fs = EEZStudio.remote.require("fs");
                fs.writeFile(
                    getUIStateFilePath(this.filePath),
                    JSON.stringify(this.uiStateStore.toJS, undefined, 2),
                    "utf8",
                    (err: any) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log("UI state saved");
                        }
                        resolve();
                    }
                );
            }
        });
    }

    async openFile(filePath: string) {
        const project = await load(this, filePath);
        const uiState = await this.loadUIState(filePath);
        this.changeProject(filePath, project, uiState);
    }

    async saveModified() {
        this.saveUIState();

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
        buildProject(this, { onlyCheck: true });
    }

    async build() {
        return await buildProject(this, { onlyCheck: false });
    }

    buildExtensions() {
        buildExtensions(this);
    }

    async closeWindow() {
        if (this.runtime) {
            await this.runtime.stopRuntime(false);
        }

        if (this.project) {
            return await this.saveModified();
        }
        return true;
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
                    metrics: getAllMetrics(this)
                },
                showOkButton: false
            }).catch(() => {});
        }
    }

    @computed
    get masterProjectEnabled() {
        return !!this.project.settings.general.masterProject;
    }

    @computed
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
        project._DocumentStore = this;

        runInAction(() => {
            this.externalProjects.set(filePath, project);
            this.mapExternalProjectToAbsolutePath.set(project, filePath);
        });

        this.externalProjectsLoading.set(filePath, false);
    }

    getChildId() {
        return (++this.lastChildId).toString();
    }

    get project() {
        return this._project!;
    }

    get isDashboardProject() {
        return (
            this.project.settings.general.projectType === ProjectType.DASHBOARD
        );
    }

    get isAppletProject() {
        return this.project.settings.general.projectType === ProjectType.APPLET;
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

    @computed
    get isModified() {
        return this.modified;
    }

    @action
    setModified(modified_: boolean) {
        this.modified = modified_;
    }

    @action
    changeProject(
        projectFilePath: string | undefined,
        project?: Project,
        uiState?: Project
    ) {
        this.filePath = projectFilePath;

        if (project) {
            project._DocumentStore = this;
            this.dataContext = new DataContext(project);
        } else {
            this.dataContext = undefined as any;
        }

        this._project = project;
        if (!project) {
            this.objects.clear();
            this.lastChildId = 0;
        }
        this.uiStateStore.load(uiState || {});
        this.undoManager.clear();

        if (!project) {
            this.editorsStore.unmount();
            this.uiStateStore.unmount();
            this.unmount();
        }
    }

    canSave() {
        return this.modified;
    }

    addObject(parentObject: IEezObject, object: any) {
        if (getParent(parentObject) && getKey(parentObject)) {
            const propertyInfo = findPropertyByNameInObject(
                getParent(parentObject),
                getKey(parentObject)
            );
            if (propertyInfo && propertyInfo.interceptAddObject) {
                object = propertyInfo.interceptAddObject(parentObject, object);
            }
        }

        return addObject(parentObject, object);
    }

    addObjects(parentObject: IEezObject, objects: any[]) {
        return addObjects(parentObject, objects);
    }

    insertObject(parentObject: IEezObject, index: number, object: any) {
        return insertObject(parentObject, index, object);
    }

    updateObject(object: IEezObject, inputValues: any) {
        // make sure that plain JavaScript objects to EezObject's
        let values: any = {};

        let oldValues: any;
        if (getClassInfo(object).afterUpdateObjectHook) {
            oldValues = {};
        }

        for (let propertyName in inputValues) {
            if (inputValues.hasOwnProperty(propertyName)) {
                if (getClassInfo(object).afterUpdateObjectHook) {
                    oldValues[propertyName] = getProperty(object, propertyName);
                }

                let propertyInfo = findPropertyByNameInObject(
                    object,
                    propertyName
                );

                if (propertyInfo) {
                    if (propertyInfo.computed !== true) {
                        const value = inputValues[propertyName];
                        if (
                            (propertyInfo.type === PropertyType.Object ||
                                propertyInfo.type === PropertyType.Array) &&
                            value !== undefined &&
                            !isEezObject(value)
                        ) {
                            // convert to EezObject
                            values[propertyName] = loadObject(
                                this,
                                object,
                                inputValues[propertyName],
                                propertyInfo.typeClass!
                            );
                        } else {
                            // use as is
                            values[propertyName] = value;
                        }
                    } else {
                        console.warn("ignored computed property", propertyName);
                    }
                } else {
                    console.error("ignored unknown property", propertyName);
                }
            }
        }

        updateObject(object, values);

        const afterUpdateObjectHook =
            getClassInfo(object).afterUpdateObjectHook;
        if (afterUpdateObjectHook) {
            afterUpdateObjectHook(object, inputValues, oldValues);
        }
    }

    deleteObject(object: IEezObject, options?: { dropPlace?: IEezObject }) {
        let closeCombineCommands = false;

        if (object instanceof Component) {
            const flow = getFlow(object);

            let keepConnectionLines =
                options &&
                options.dropPlace &&
                flow == getAncestorOfType(options.dropPlace, Flow.classInfo);

            if (!keepConnectionLines) {
                if (!this.undoManager.combineCommands) {
                    this.undoManager.setCombineCommands(true);
                    closeCombineCommands = true;
                }

                flow.deleteConnectionLines(object);
            }
        }

        if (object instanceof CustomInput) {
            if (!this.undoManager.combineCommands) {
                this.undoManager.setCombineCommands(true);
                closeCombineCommands = true;
            }

            const component = getAncestorOfType<Component>(
                object,
                Component.classInfo
            ) as Component;

            getFlow(component).deleteConnectionLinesToInput(
                component,
                object.name
            );
        }

        if (object instanceof CustomOutput) {
            if (!this.undoManager.combineCommands) {
                this.undoManager.setCombineCommands(true);
                closeCombineCommands = true;
            }

            const component = getAncestorOfType<Component>(
                object,
                Component.classInfo
            ) as Component;

            getFlow(component).deleteConnectionLinesFromOutput(
                component,
                object.name
            );
        }

        deleteObject(object);

        if (closeCombineCommands) {
            this.undoManager.setCombineCommands(false);
        }
    }

    deleteObjects(objects: IEezObject[]) {
        if (objects.length === 1) {
            this.deleteObject(objects[0]);
        } else {
            let closeCombineCommands = false;

            objects.forEach(object => {
                if (object instanceof Component) {
                    if (!this.undoManager.combineCommands) {
                        this.undoManager.setCombineCommands(true);
                        closeCombineCommands = true;
                    }
                    const flow = getAncestorOfType(
                        object,
                        Flow.classInfo
                    ) as Flow;
                    flow.deleteConnectionLines(object);
                }
            });

            objects = objects.filter(object => {
                if (object instanceof ConnectionLine) {
                    const page = getAncestorOfType(
                        object,
                        Page.classInfo
                    ) as Page;
                    return page.connectionLines.indexOf(object) != -1;
                }
                return true;
            });

            deleteObjects(objects);

            if (closeCombineCommands) {
                this.undoManager.setCombineCommands(false);
            }
        }
    }

    replaceObject(object: IEezObject, replaceWithObject: IEezObject) {
        if (getParent(object) !== getParent(replaceWithObject)) {
            console.error("assert failed");
        }

        return replaceObject(object, replaceWithObject);
    }

    replaceObjects(objects: IEezObject[], replaceWithObject: IEezObject) {
        if (getParent(objects[0]) !== getParent(replaceWithObject)) {
            console.error("assert failed");
        }

        return replaceObjects(objects, replaceWithObject);
    }

    insertObjectBefore(object: IEezObject, objectToInsert: any) {
        return insertObjectBefore(object, objectToInsert);
    }

    insertObjectAfter(object: IEezObject, objectToInsert: any) {
        return insertObjectAfter(object, objectToInsert);
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const flow = getAncestorOfType(objects[0], Flow.classInfo) as Flow;
        if (flow) {
            return flow.objectsToClipboardData(objects);
        }
        return objectsToClipboardData(objects);
    }

    setRuntimeMode(isDebuggerActive: boolean) {
        let runtime: RuntimeBase | undefined;

        if (this.isDashboardProject) {
            runtime = new LocalRuntime(this);
        } else {
            runtime = new RemoteRuntime(this);
        }

        runInAction(() => (this.runtime = runtime));

        runtime.startRuntime(isDebuggerActive);
    }

    @action
    setEditorMode() {
        if (this.runtime) {
            this.runtime.stopRuntime(false);
            this.runtime = undefined;
        }
    }

    @action
    onSetEditorMode = () => {
        this.setEditorMode();
    };

    onSetRuntimeMode = async () => {
        if (this.runtime && this.runtime.isDebuggerActive) {
            this.runtime.toggleDebugger();
        } else {
            this.setRuntimeMode(false);
        }
    };

    onSetDebuggerMode = () => {
        if (!this.runtime) {
            this.setRuntimeMode(true);
        } else {
            if (!this.runtime.isDebuggerActive) {
                this.navigationStore.setSelection([this.runtime.selectedPage]);
                this.runtime.toggleDebugger();
            }
        }
    };

    onRestartRuntimeWithDebuggerActive = () => {
        this.onSetEditorMode();
        this.setRuntimeMode(true);
    };
}

////////////////////////////////////////////////////////////////////////////////

export function extendContextMenu(
    context: IContextMenuContext,
    object: IEezObject,
    objects: IEezObject[],
    menuItems: Electron.MenuItem[]
) {
    const extendContextMenu = getClassInfo(object).extendContextMenu;
    if (extendContextMenu) {
        extendContextMenu(object, context, objects, menuItems);
    }
}

export function canAdd(object: IEezObject) {
    return (
        (isArrayElement(object) || isArray(object)) &&
        getClassInfo(object).newItem != undefined
    );
}

export function canDuplicate(object: IEezObject) {
    return isArrayElement(object);
}

function isOptional(object: IEezObject) {
    let parent = getParent(object);
    if (!parent) {
        return false;
    }

    let property: PropertyInfo | undefined = findPropertyByNameInObject(
        parent,
        getKey(object)
    );

    if (property == undefined) {
        return false;
    }

    return property.isOptional;
}

export function canDelete(object: IEezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canCut(object: IEezObject) {
    return canCopy(object) && canDelete(object);
}

export function canCopy(object: IEezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canContainChildren(object: IEezObject) {
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            isPropertyEnumerable(object, propertyInfo) &&
            (propertyInfo.type === PropertyType.Array ||
                propertyInfo.type === PropertyType.Object)
        ) {
            return true;
        }
    }

    return false;
}

export function canPaste(
    DocumentStore: DocumentStoreClass,
    object: IEezObject
) {
    try {
        return checkClipboard(DocumentStore, object);
    } catch (e) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getDocumentStore(object: IEezObject) {
    return (getRootObject(object) as Project)._DocumentStore;
}

export async function addItem(object: IEezObject) {
    const parent = isArray(object) ? object : getParent(object);
    if (!parent) {
        return null;
    }

    const parentClassInfo = getClassInfo(parent);
    if (!parentClassInfo.newItem) {
        return null;
    }

    let newObjectProperties;
    try {
        newObjectProperties = await parentClassInfo.newItem(parent);
    } catch (err) {
        if (err !== undefined) {
            notification.error(
                `Adding ${getClass(parent).name} failed: ${err}!`
            );
        }
        return null;
    }

    if (!newObjectProperties) {
        console.log(`Canceled adding ${getClass(parent).name}`);
        return null;
    }

    return getDocumentStore(object).addObject(parent, newObjectProperties);
}

export function pasteItem(object: IEezObject) {
    try {
        const DocumentStore = getDocumentStore(object);

        let c = checkClipboard(DocumentStore, object);
        if (c) {
            if (typeof c.pastePlace === "string") {
                DocumentStore.updateObject(object, {
                    [c.pastePlace]: c.serializedData.object
                });
            } else {
                if (c.serializedData.object) {
                    if (
                        isArray(c.pastePlace as IEezObject) &&
                        getParent(object) === (c.pastePlace as IEezObject)
                    ) {
                        return DocumentStore.insertObject(
                            c.pastePlace as IEezObject,
                            (c.pastePlace as IEezObject[]).indexOf(object) + 1,
                            objectToJS(c.serializedData.object)
                        );
                    } else {
                        if (
                            c.serializedData.objectClassName == "FlowFragment"
                        ) {
                            const flow = getAncestorOfType(
                                c.pastePlace,
                                Flow.classInfo
                            ) as Flow;
                            if (flow) {
                                return flow.pasteFlowFragment(
                                    c.serializedData.object as FlowFragment,
                                    object
                                );
                            }
                        }
                        return DocumentStore.addObject(
                            c.pastePlace as IEezObject,
                            objectToJS(c.serializedData.object)
                        );
                    }
                } else if (c.serializedData.objects) {
                    return DocumentStore.addObjects(
                        c.pastePlace as IEezObject,
                        objectToJS(c.serializedData.objects)
                    );
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    return undefined;
}

export function deleteItem(object: IEezObject) {
    deleteItems([object]);
}

export function cutItem(object: IEezObject) {
    let clipboardText = objectToClipboardData(object);

    deleteItems([object], () => {
        copyToClipboard(clipboardText);
    });
}

export function copyItem(object: IEezObject) {
    copyToClipboard(objectToClipboardData(object));
}

function duplicateItem(object: IEezObject) {
    let parent = getParent(object) as IEezObject;
    return getDocumentStore(object).addObject(parent, toJS(object));
}

export interface IContextMenuContext {
    selectObject(object: IEezObject): void;
    selectObjects(objects: IEezObject[]): void;
}

export function createContextMenu(
    context: IContextMenuContext,
    object: IEezObject
) {
    let menuItems: Electron.MenuItem[] = [];

    if (canAdd(object)) {
        menuItems.push(
            new MenuItem({
                label: "Add",
                click: async () => {
                    const aNewObject = await addItem(object);
                    if (aNewObject) {
                        context.selectObject(aNewObject);
                    }
                }
            })
        );
    }

    if (canDuplicate(object)) {
        menuItems.push(
            new MenuItem({
                label: "Duplicate",
                click: () => {
                    const aNewObject = duplicateItem(object);
                    if (aNewObject) {
                        context.selectObject(aNewObject);
                    }
                }
            })
        );
    }

    if (isArrayElement(object)) {
        if (menuItems.length > 0) {
            menuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }

        menuItems.push(
            new MenuItem({
                label: "Find All References",
                click: () => {
                    const { findAllReferences } =
                        require("project-editor/core/search") as typeof SearchModule;
                    findAllReferences(object);
                }
            })
        );
    }

    let clipboardMenuItems: Electron.MenuItem[] = [];

    if (canCut(object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Cut",
                click: () => {
                    cutItem(object);
                }
            })
        );
    }

    if (canCopy(object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Copy",
                click: () => {
                    copyItem(object);
                }
            })
        );
    }

    const DocumentStore = getDocumentStore(object);

    if (canPaste(DocumentStore, object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Paste",
                click: () => {
                    const aNewObject = pasteItem(object);
                    if (aNewObject) {
                        if (Array.isArray(aNewObject)) {
                            context.selectObjects(aNewObject);
                        } else {
                            context.selectObject(aNewObject);
                        }
                    }
                }
            })
        );
    }

    if (clipboardMenuItems.length > 0) {
        if (menuItems.length > 0) {
            menuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }
        menuItems = menuItems.concat(clipboardMenuItems);
    }

    if (canDelete(object)) {
        if (menuItems.length > 0) {
            menuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }

        menuItems.push(
            new MenuItem({
                label: "Delete",
                click: () => {
                    deleteItems([object]);
                }
            })
        );
    }

    extendContextMenu(context, object, [object], menuItems);

    if (menuItems.length > 0) {
        const menu = new Menu();
        menuItems.forEach(menuItem => menu.append(menuItem));
        return menu;
    }

    return undefined;
}

export function showContextMenu(
    context: IContextMenuContext,
    object: IEezObject
) {
    const menu = createContextMenu(context, object);

    if (menu) {
        menu.popup();
    }
}

////////////////////////////////////////////////////////////////////////////////

export function deleteItems(objects: IEezObject[], callback?: () => void) {
    const { isReferenced } =
        require("project-editor/core/search") as typeof SearchModule;

    function doDelete() {
        getDocumentStore(objects[0]).deleteObjects(objects);
        if (callback) {
            callback();
        }
    }

    if (objects.length === 1) {
        if (isReferenced(objects[0])) {
            confirm(
                "Are you sure you want to delete this item?",
                "It is used in other parts.",
                doDelete
            );
        } else {
            doDelete();
        }
    } else {
        let isAnyItemReferenced = false;

        for (let i = 0; i < objects.length; i++) {
            if (isReferenced(objects[i])) {
                isAnyItemReferenced = true;
                break;
            }
        }

        if (isAnyItemReferenced) {
            confirm(
                "Are you sure you want to delete this items?",
                "Some of them are used in other parts.",
                doDelete
            );
        } else {
            doDelete();
        }
    }
}

let extensionsInitialized = false;
async function initExtensions() {
    if (!extensionsInitialized) {
        extensionsInitialized = true;
        if (EEZStudio.electron) {
            const { extensions } = await import(
                "eez-studio-shared/extensions/extensions"
            );

            extensions.forEach(extension => {
                if (extension.eezFlowExtensionInit) {
                    try {
                        extension.eezFlowExtensionInit({
                            React,
                            mobx,
                            theme: theme(),
                            registerClass(aClass: EezClass) {
                                registerClassByName(
                                    `${extension.name}/${aClass.name}`,
                                    aClass
                                );
                            },
                            makeDerivedClassInfo,
                            ActionComponent,
                            VariableType,
                            getFlow,
                            showGenericDialog,
                            validators: {
                                required: validators.required,
                                rangeInclusive: validators.rangeInclusive
                            },
                            propertyGridGroups: {
                                specificGroup
                            },
                            RenderVariableStatus,
                            evalExpression: evalExpression
                        });
                    } catch (err) {
                        console.error(err);
                    }
                }
            });
        }

        const extensionsModule = await import("project-editor/core/extensions");
        extensionsModule.loadExtensions();
    }
}
