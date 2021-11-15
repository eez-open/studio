import * as fs from "fs";
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
import { confirmSave } from "eez-studio-shared/util";
import { humanize } from "eez-studio-shared/string";
import { guid } from "eez-studio-shared/guid";

import { Icon } from "eez-studio-ui/icon";
import * as notification from "eez-studio-ui/notification";
import { showGenericDialog, TableField } from "eez-studio-ui/generic-dialog";

import { confirm } from "project-editor/core/util";

import {
    IEezObject,
    PropertyInfo,
    PropertyType,
    IEditorState,
    IEditor,
    getProperty,
    isPropertyEnumerable,
    getParent,
    getKey,
    getId,
    isEezObject,
    getRootObject,
    EezClass,
    EezObject,
    isSubclassOf,
    ClassInfo,
    findClass,
    PropertyProps,
    PropertyValueSourceInfo,
    isPropertyHidden,
    EditorComponent,
    getPropertyInfo,
    getAncestors,
    getObjectPropertyDisplayName,
    registerClass,
    setId,
    setKey,
    setParent,
    setPropertyInfo,
    MessageType,
    IMessage,
    getClassByName,
    SerializedData
} from "project-editor/core/object";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import type { CurrentSearch } from "project-editor/core/search";

import type { DataContext } from "project-editor/features/variable/variable";

import type { Component } from "project-editor/flow/component";

import type { RuntimeBase } from "project-editor/flow/runtime";

import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Project } from "project-editor/project/project";
import type { IObjectVariableValue } from "project-editor/features/variable/value-type";
import { IVariable } from "project-editor/flow/flow-interfaces";

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

    showObject(
        objectToShow: IEezObject,
        options?: {
            selectInEditor?: boolean;
        }
    ) {
        this.setSelection([objectToShow]);

        const selectInEditor = !options || (options.selectInEditor ?? true);
        if (selectInEditor) {
            for (
                let object: IEezObject | undefined = objectToShow;
                object;
                object = getParent(object)
            ) {
                if (getEditorComponent(object)) {
                    const editor =
                        this.DocumentStore.editorsStore.openEditor(object);
                    if (editor) {
                        const editorState = editor.state;
                        if (editorState) {
                            setTimeout(() => {
                                editorState.selectObject(
                                    isValue(objectToShow)
                                        ? getParent(objectToShow)
                                        : objectToShow
                                );
                                setTimeout(() => {
                                    editorState.ensureSelectionVisible();
                                }, 50);
                            }, 50);
                        }
                    }
                    break;
                }
            }
        }
    }

    _settingsNavigationObjectAdapter: TreeObjectAdapter;

    getSettingsNavigationObjectAdapter(construct: () => TreeObjectAdapter) {
        if (!this._settingsNavigationObjectAdapter) {
            if (this.DocumentStore.project) {
                this._settingsNavigationObjectAdapter = construct();
            }
        }
        return this._settingsNavigationObjectAdapter;
    }

    loadSettingsNavigationState(settingsNavigationState: any) {
        if (settingsNavigationState) {
            if (this._settingsNavigationObjectAdapter) {
                this._settingsNavigationObjectAdapter.loadState(
                    settingsNavigationState
                );
            }
        }
    }

    @computed
    get settingsNavigationStateToJS() {
        if (this._settingsNavigationObjectAdapter) {
            return this._settingsNavigationObjectAdapter.saveState();
        }
        return {};
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
        if (this.DocumentStore.runtime) {
            const flow = ProjectEditor.getFlow(this.object);
            if (flow) {
                this.DocumentStore.runtime.selectFlowStateForFlow(flow);
            }
        }
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

    getUIStateFilePath() {
        if (this.DocumentStore.filePath) {
            return this.DocumentStore.filePath + "-ui-state";
        }
        return undefined;
    }

    async load() {
        const filePath = this.getUIStateFilePath();
        if (!filePath) {
            return;
        }

        let uiState: any = {};
        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            try {
                uiState = JSON.parse(data);
            } catch (err) {
                console.error(err);
            }
        } catch (err) {}

        runInAction(() => {
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
                    const component =
                        this.DocumentStore.getObjectFromStringPath(
                            key
                        ) as Component;
                    if (component) {
                        this.breakpoints.set(
                            component,
                            uiState.breakpoints[key]
                        );
                    }
                }
            }

            if (uiState.watchExpressions) {
                this.watchExpressions = uiState.watchExpressions;
            } else {
                this.watchExpressions = [];
            }
        });
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
            ),
            watchExpressions: toJS(this.watchExpressions)
        };

        state.objects = this.objectsJS;

        return state;
    }

    async save() {
        const filePath = this.getUIStateFilePath();
        if (!filePath) {
            return;
        }

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(this.toJS, undefined, 2),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save UI state: " + err);
        }
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
    @observable selectedBreakpoint = observable.box<Component | undefined>(
        undefined
    );

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

    ////////////////////////////////////////
    // WATCH EXPRESSIONS

    @observable watchExpressions: string[] = [];
}

////////////////////////////////////////////////////////////////////////////////

class RuntimeSettings {
    @observable settings: any = {};

    constructor(public DocumentStore: DocumentStoreClass) {}

    getVariableValue(variable: IVariable) {
        const persistentVariables: any =
            this.settings.__persistentVariables || {};

        let value = persistentVariables[variable.name];

        const objectVariableType = ProjectEditor.getObjectVariableTypeFromType(
            variable.type
        );
        if (objectVariableType) {
            const constructorParams = value;
            if (value) {
                return objectVariableType.constructorFunction(
                    constructorParams,
                    !!this.DocumentStore.runtime
                );
            }
        }
        return value;
    }

    setVariableValue(variable: IVariable, value: any) {
        runInAction(() => {
            if (!this.settings.__persistentVariables) {
                this.settings.__persistentVariables = {};
            }
            this.settings.__persistentVariables[variable.name] = value;
        });
    }

    async loadPersistentVariables() {
        const DocumentStore = this.DocumentStore;
        const globalVariables = DocumentStore.project.variables.globalVariables;
        const dataContext = DocumentStore.dataContext;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.getVariableValue(variable);
                if (value !== undefined) {
                    dataContext.set(variable.name, value);
                }
            }
        }
    }

    async savePersistentVariables() {
        const globalVariables =
            this.DocumentStore.project.variables.globalVariables;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.DocumentStore.dataContext.get(variable.name);
                if (value != null) {
                    const objectVariableType =
                        ProjectEditor.getObjectVariableTypeFromType(
                            variable.type
                        );
                    if (objectVariableType) {
                        const objectVariableValue:
                            | IObjectVariableValue
                            | undefined = value;

                        const constructorParams =
                            objectVariableValue?.constructorParams ?? null;

                        this.setVariableValue(variable, constructorParams);
                    } else {
                        this.setVariableValue(variable, value);
                    }
                }
            }
        }
    }

    getSettingsFilePath() {
        if (this.DocumentStore.filePath) {
            return this.DocumentStore.filePath + "-runtime-settings";
        }
        return undefined;
    }

    async load() {
        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            runInAction(() => {
                try {
                    this.settings = JSON.parse(data);
                } catch (err) {
                    console.error(err);
                    this.settings = {};
                }
            });
        } catch (err) {}
    }

    async save() {
        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(toJS(this.settings), undefined, "  "),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save runtime settings: " + err);
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

export async function load(
    DocumentStore: DocumentStoreClass,
    filePath: string
) {
    const response = await fetch(filePath);

    if (!response.ok) {
        throw new Error("File read error " + response.status);
    }

    const isDashboardBuild = filePath.endsWith(".eez-dashboard");

    let projectJs;
    if (filePath.endsWith(".eez-dashboard")) {
        const decompress = require("decompress");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const files = await decompress(buffer);
        projectJs = files[0].data.toString("utf8");
    } else {
        projectJs = await response.json();
    }

    const project: Project = loadObject(
        DocumentStore,
        undefined,
        projectJs,
        ProjectEditor.ProjectClass
    ) as Project;

    project._isDashboardBuild = isDashboardBuild;

    return project;
}

export function getJSON(
    DocumentStore: DocumentStoreClass,
    tabWidth: number = 2
) {
    const toJsHook = (jsObject: any, object: IEezObject) => {
        let projectFeatures = ProjectEditor.extensions;
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

    const json = objectToJson(DocumentStore.project, tabWidth, toJsHook);

    DocumentStore.project._DocumentStore = DocumentStore;

    return json;
}

export function save(DocumentStore: DocumentStoreClass, filePath: string) {
    const json = getJSON(DocumentStore);

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

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH
}

export class Message implements IMessage {
    id: string = guid();
    @observable selected: boolean = false;

    constructor(
        public type: MessageType,
        public text: string,
        public object?: IEezObject
    ) {}
}

////////////////////////////////////////////////////////////////////////////////

export function propertyNotSetMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": not set.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyNotUniqueMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": is not unique.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertySetButNotUsedMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": set but not used.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyNotFoundMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": not found.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyInvalidValueMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": invalid value.`,
        getChildOfObject(object, propertyName)
    );
}

export class OutputSection implements IPanel {
    permanent: boolean = true;

    @observable loading = false;

    @observable messages: Message[] = [];
    @observable selectedMessage: Message | undefined;

    constructor(
        public DocumentStore: DocumentStoreClass,
        public id: number,
        public name: string,
        public scrollToBottom: boolean
    ) {}

    @computed get active() {
        return this.DocumentStore.uiStateStore.activeOutputSection === this.id;
    }

    @computed
    get title(): string | React.ReactNode {
        if (this.id == Section.CHECKS) {
            return (
                <React.Fragment>
                    <span className="title">{this.name}</span>

                    {this.numErrors > 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:error" className="error" />
                            <span>{this.numErrors}</span>
                        </React.Fragment>
                    )}

                    {this.numWarnings > 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:warning" className="warning" />
                            <span>{this.numWarnings}</span>
                        </React.Fragment>
                    )}

                    {this.numErrors === 0 && this.numWarnings === 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:check" className="info" />
                        </React.Fragment>
                    )}
                </React.Fragment>
            );
        }

        if (
            this.id == Section.SEARCH &&
            (this.DocumentStore.uiStateStore.searchPattern ||
                this.messages.length > 0)
        ) {
            return `${this.name} (${this.messages.length})`;
        }

        return this.name;
    }

    @computed
    get numErrors() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.ERROR) {
                n++;
            }
        }
        return n;
    }

    @computed
    get numWarnings() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.WARNING) {
                n++;
            }
        }
        return n;
    }

    @action
    clear() {
        this.messages = [];
        this.selectedMessage = undefined;
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.selectedMessage &&
            this.messages.indexOf(this.selectedMessage) !== -1
            ? this.selectedMessage.object
            : undefined;
    }

    cutSelection() {
        // TODO
    }

    copySelection() {
        // TODO
    }

    pasteSelection() {
        // TODO
    }

    deleteSelection() {
        // TODO
    }

    @action
    selectMessage(message: Message) {
        if (this.selectedMessage !== message) {
            if (this.selectedMessage) {
                this.selectedMessage.selected = false;
            }
            message.selected = true;
            this.selectedMessage = message;
        }
    }

    makeActive(): void {
        this.DocumentStore.outputSectionsStore.setActiveSection(this.id);
    }
}

export class OutputSections {
    sections: OutputSection[] = [];

    constructor(public DocumentStore: DocumentStoreClass) {
        this.sections[Section.CHECKS] = new OutputSection(
            DocumentStore,
            Section.CHECKS,
            "Checks",
            false
        );
        this.sections[Section.OUTPUT] = new OutputSection(
            DocumentStore,
            Section.OUTPUT,
            "Output",
            true
        );
        this.sections[Section.SEARCH] = new OutputSection(
            DocumentStore,
            Section.SEARCH,
            "Search results",
            false
        );
        // this.sections[Section.DEBUG] = new OutputSection(
        //     DocumentStore,
        //     Section.DEBUG,
        //     "Debug",
        //     false
        // );
    }

    @computed get activeSection() {
        return (
            this.sections[
                this.DocumentStore.uiStateStore.activeOutputSection
            ] ?? this.sections[Section.CHECKS]
        );
    }

    getSection(sectionType: Section) {
        return this.sections[sectionType];
    }

    @action
    setActiveSection(sectionType: Section) {
        this.DocumentStore.uiStateStore.activeOutputSection = sectionType;
        this.DocumentStore.uiStateStore.viewOptions.outputVisible = true;
    }

    @action
    setLoading(sectionType: Section, loading: boolean) {
        this.sections[sectionType].loading = loading;
    }

    @action
    clear(sectionType: Section) {
        this.sections[sectionType].clear();
    }

    @action
    write(
        sectionType: Section,
        type: MessageType,
        text: string,
        object?: IEezObject
    ) {
        let section = this.sections[sectionType];
        section.messages.push(new Message(type, text, object));
    }

    @action
    setMessages(sectionType: Section, messages: IMessage[]) {
        let section = this.sections[sectionType];
        section.messages = messages as Message[];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DocumentStoreClass {
    undoManager = new UndoManager(this);
    navigationStore = new NavigationStore(this);
    editorsStore = new EditorsStore(this);
    uiStateStore = new UIStateStore(this);
    runtimeSettings = new RuntimeSettings(this);
    outputSectionsStore = new OutputSections(this);

    @observable runtime: RuntimeBase | undefined;

    @observable private _project: Project | undefined;
    @observable modified: boolean = false;

    @observable filePath: string | undefined;
    @observable backgroundCheckEnabled = true;

    dataContext: DataContext;

    currentSearch: CurrentSearch;

    objects = new Map<string, IEezObject>();
    lastChildId = 0;

    @observable externalProjects = new Map<string, Project>();
    @observable mapExternalProjectToAbsolutePath = new Map<Project, string>();
    externalProjectsLoading = new Map<string, boolean>();

    dispose1: mobx.IReactionDisposer;
    dispose2: mobx.IReactionDisposer;
    dispose3: mobx.IReactionDisposer;
    dispose4: mobx.IReactionDisposer;
    dispose5: mobx.IReactionDisposer;

    watcher: FSWatcher | undefined = undefined;

    static async create() {
        return new DocumentStoreClass();
    }

    constructor() {
        this.currentSearch = new ProjectEditor.documentSearch.CurrentSearch(
            this
        );

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
        if (this.dispose5) {
            this.dispose5();
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
        this.dispose4 = autorun(() => {
            // check the project in the background
            if (
                this.project &&
                this.project._DocumentStore.backgroundCheckEnabled
            ) {
                ProjectEditor.build.backgroundCheck(this);
            }
        });
    }

    get title() {
        const path = EEZStudio.remote.require("path");

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

    getAbsoluteProjectFolderPath() {
        const path = EEZStudio.remote.require("path");
        return path.dirname(this.filePath);
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
        if (!this.project._isDashboardBuild) {
            await save(this, this.filePath!);
            await this.uiStateStore.save();
        }
        await this.runtimeSettings.save();
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
            ProjectEditor.ProjectClass
        ) as Project;
    }

    async newProject() {
        await this.changeProject(undefined, this.getNewProject());
    }

    async openFile(filePath: string) {
        const project = await load(this, filePath);
        await this.changeProject(filePath, project);
    }

    async saveModified() {
        if (this.project._isDashboardBuild) {
            await this.runtimeSettings.save();
            return true;
        }

        if (this.project && this.modified) {
            return new Promise<boolean>(resolve => {
                confirmSave({
                    saveCallback: async () => {
                        await this.uiStateStore.save();
                        await this.runtimeSettings.save();
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
        ProjectEditor.build.buildProject(this, { onlyCheck: true });
    }

    async build() {
        return await ProjectEditor.build.buildProject(this, {
            onlyCheck: false
        });
    }

    buildExtensions() {
        ProjectEditor.build.buildExtensions(this);
    }

    async closeWindow() {
        if (this.runtime) {
            await this.runtime.stopRuntime(false);
            this.dataContext.clear();
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
                    metrics: ProjectEditor.getAllMetrics(this)
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
    async changeProject(
        projectFilePath: string | undefined,
        project?: Project
    ) {
        if (!project) {
            this.project.settings.general.imports.forEach(importDirective => {
                if (importDirective.project) {
                    importDirective.project._DocumentStore.unmount();
                }
            });
        }

        this.filePath = projectFilePath;

        if (project) {
            project._DocumentStore = this;
            this.dataContext = new ProjectEditor.DataContextClass(project);
        } else {
            this.dataContext = undefined as any;
        }

        this._project = project;
        if (!project) {
            this.objects.clear();
            this.lastChildId = 0;
        }
        this.undoManager.clear();

        if (project) {
            await this.uiStateStore.load();
            await this.runtimeSettings.load();
        } else {
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
        const classInfo = getClassInfo(objects[0]);
        if (classInfo.objectsToClipboardData) {
            return classInfo.objectsToClipboardData(objects);
        }
        return objectsToClipboardData(objects);
    }

    setRuntimeMode(isDebuggerActive: boolean) {
        let runtime: RuntimeBase | undefined;

        if (this.project.isDashboardProject) {
            runtime = new ProjectEditor.LocalRuntimeClass(this);
        } else {
            runtime = new ProjectEditor.RemoteRuntimeClass(this);
        }

        runInAction(() => (this.runtime = runtime));

        runtime.startRuntime(isDebuggerActive);
    }

    @action
    setEditorMode() {
        if (this.runtime) {
            this.runtime.stopRuntime(false);
            this.dataContext.clear();

            if (this.runtime.isDebuggerActive) {
                const editorState = this.editorsStore.activeEditor?.state;
                if (editorState) {
                    editorState.selectObjects([]);
                }
            }

            this.runtime = undefined;
        }
    }

    @action
    onSetEditorMode = () => {
        this.setEditorMode();
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
                this.navigationStore.setSelection([this.runtime.selectedPage]);
                this.runtime.toggleDebugger();
            }
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
    }
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
                        const aClass = getClassByName(
                            c.serializedData.objectClassName
                        );

                        if (aClass && aClass.classInfo.pasteItemHook) {
                            return aClass.classInfo.pasteItemHook(object, c);
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

    const DocumentStore = getDocumentStore(object);

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
                    ProjectEditor.documentSearch.findAllReferences(object);
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
    const DocumentStore = getDocumentStore(objects[0]);

    function doDelete() {
        DocumentStore.deleteObjects(objects);
        if (callback) {
            callback();
        }
    }

    if (objects.length === 1) {
        if (ProjectEditor.documentSearch.isReferenced(objects[0])) {
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
            if (ProjectEditor.documentSearch.isReferenced(objects[i])) {
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

////////////////////////////////////////////////////////////////////////////////

const CLIPOARD_DATA_ID = "application/eez-studio-project-editor-data";

export function objectToClipboardData(object: IEezObject): string {
    return JSON.stringify({
        objectClassName: getClass(object).name,
        object: objectToJson(object)
    });
}

export function objectsToClipboardData(objects: IEezObject[]): string {
    return JSON.stringify({
        objectClassName: getClass(objects[0]).name,
        objects: objects.map(object => objectToJson(object))
    });
}

export function clipboardDataToObject(
    DocumentStore: DocumentStoreClass,
    data: string
) {
    let serializedData: SerializedData = JSON.parse(data);

    const aClass = findClass(serializedData.objectClassName);
    if (aClass) {
        serializedData.classInfo = aClass.classInfo;
        if (serializedData.object) {
            serializedData.object = loadObject(
                DocumentStore,
                undefined,
                serializedData.object,
                aClass
            );
        } else if (serializedData.objects) {
            serializedData.objects = serializedData.objects.map(object =>
                loadObject(DocumentStore, undefined, object, aClass)
            );
        }
    }

    return serializedData;
}

let clipboardData: string;

export function setClipboardData(event: any, value: string) {
    clipboardData = value;
    event.dataTransfer.setData(CLIPOARD_DATA_ID, clipboardData);
}

export function getEezStudioDataFromDragEvent(
    DocumentStore: DocumentStoreClass,
    event: any
) {
    let data = event.dataTransfer.getData(CLIPOARD_DATA_ID);
    if (!data) {
        data = clipboardData;
    }
    if (data) {
        return clipboardDataToObject(DocumentStore, data);
    }
    return undefined;
}

export function findPastePlaceInside(
    object: IEezObject,
    classInfo: ClassInfo,
    isSingleObject: boolean
) {
    if (isArray(object) && isSubclassOf(classInfo, getClassInfo(object))) {
        return object;
    }

    if (isObject(object)) {
        const findPastePlaceInside = getClassInfo(object).findPastePlaceInside;
        if (findPastePlaceInside) {
            return findPastePlaceInside(object, classInfo, isSingleObject);
        }
    }

    // first, find among array properties
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            propertyInfo.type === PropertyType.Array &&
            isSubclassOf(classInfo, propertyInfo.typeClass!.classInfo)
        ) {
            let collectionObject = getChildOfObject(object, propertyInfo);
            if (collectionObject) {
                return collectionObject;
            }
        }
    }

    // then, find among object properties
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            propertyInfo.type == PropertyType.Object &&
            isSubclassOf(classInfo, propertyInfo.typeClass!.classInfo) &&
            isSingleObject
        ) {
            let childObject = getChildOfObject(object, propertyInfo);
            if (!childObject) {
                return propertyInfo;
            }
        }
    }

    return undefined;
}

export function findPastePlaceInsideAndOutside(
    object: IEezObject,
    serializedData: SerializedData
): EezObject | undefined {
    if (!serializedData.classInfo) {
        return undefined;
    }

    let place = findPastePlaceInside(
        object,
        serializedData.classInfo,
        !!serializedData.object
    );
    if (place) {
        return place;
    }

    let parent = getParent(object);
    return parent && findPastePlaceInsideAndOutside(parent, serializedData);
}

export function checkClipboard(
    DocumentStore: DocumentStoreClass,
    object: IEezObject
) {
    let text = pasteFromClipboard();
    if (text) {
        let serializedData = clipboardDataToObject(DocumentStore, text);
        if (serializedData) {
            let pastePlace = findPastePlaceInsideAndOutside(
                object,
                serializedData
            );
            if (pastePlace) {
                return {
                    serializedData: serializedData,
                    pastePlace: pastePlace
                };
            }
        }
    }
    return undefined;
}

export function copyToClipboard(text: string) {
    EEZStudio.remote.clipboard.write({
        text
    });
}

export function pasteFromClipboard(): string | undefined {
    return EEZStudio.remote.clipboard.readText();
}

////////////////////////////////////////////////////////////////////////////////

export class EezValueObject extends EezObject {
    static classInfo: ClassInfo = {
        label: (object: EezValueObject) => {
            return object.value && object.value.toString();
        },
        properties: []
    };

    public propertyInfo: PropertyInfo;
    public value: any;

    static create(object: IEezObject, propertyInfo: PropertyInfo, value: any) {
        const valueObject = new EezValueObject();

        const DocumentStore = getDocumentStore(object);

        setId(DocumentStore.objects, valueObject, DocumentStore.getChildId());
        setKey(valueObject, propertyInfo.name);
        setParent(valueObject, object);

        valueObject.propertyInfo = propertyInfo;
        valueObject.value = value;

        return valueObject;
    }
}
registerClass("EezValueObject", EezValueObject);

////////////////////////////////////////////////////////////////////////////////

export function isValue(object: IEezObject | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function getChildOfObject(
    object: IEezObject,
    key: PropertyInfo | string | number
): IEezObject | undefined {
    let propertyInfo: PropertyInfo | undefined;

    if (isArray(object)) {
        let elementIndex: number | undefined = undefined;

        if (typeof key == "string") {
            elementIndex = parseInt(key);
        } else if (typeof key == "number") {
            elementIndex = key;
        }

        const array = object as IEezObject[];

        if (
            elementIndex !== undefined &&
            elementIndex >= 0 &&
            elementIndex < array.length
        ) {
            return array[elementIndex];
        } else {
            console.error("invalid array index");
        }
    } else {
        if (typeof key == "string") {
            propertyInfo = findPropertyByNameInObject(object, key);
        } else if (typeof key == "number") {
            console.error("invalid key type");
        } else {
            propertyInfo = key;
        }
    }

    if (propertyInfo) {
        let childObjectOrValue = getProperty(object, propertyInfo.name);
        if (propertyInfo.typeClass) {
            return childObjectOrValue;
        } else {
            return EezValueObject.create(
                object,
                propertyInfo,
                childObjectOrValue
            );
        }
    }

    return undefined;
}

export function getObjectPropertyAsObject(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
}

export function getObjectFromPath(rootObject: IEezObject, path: string[]) {
    let object = rootObject;

    for (let i = 0; i < path.length && object; i++) {
        object = getChildOfObject(object, path[i]) as IEezObject;
    }

    return object;
}

export function getObjectFromStringPath(
    rootObject: IEezObject,
    stringPath: string
) {
    if (stringPath == "/") {
        return rootObject;
    }
    return getObjectFromPath(rootObject, stringPath.split("/").slice(1));
}

export function objectToString(object: IEezObject) {
    let label: string;

    if (isValue(object)) {
        label = getProperty(getParent(object), getKey(object));
    } else if (isArray(object)) {
        let propertyInfo = findPropertyByNameInObject(
            getParent(object),
            getKey(object)
        );
        label =
            (propertyInfo &&
                getObjectPropertyDisplayName(object, propertyInfo)) ||
            humanize(getKey(object));
    } else {
        label = getLabel(object);
    }

    if (
        object &&
        getParent(object) &&
        isArray(getParent(object)) &&
        getParent(getParent(object)) &&
        getKey(getParent(object))
    ) {
        let propertyInfo = findPropertyByNameInObject(
            getParent(getParent(object)),
            getKey(getParent(object))
        );
        if (propertyInfo && propertyInfo.childLabel) {
            label = propertyInfo.childLabel(object, label);
        }
    }

    return label;
}

export function getPropertyAsString(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    let value = getProperty(object, propertyInfo.name);
    if (typeof value === "boolean") {
        return value.toString();
    }
    if (typeof value === "number") {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "undefined") {
        return "";
    }
    if (isArray(value)) {
        return (value as IEezObject[])
            .map(object => getLabel(object))
            .join(", ");
    }
    return objectToString(value);
}

export function getHumanReadableObjectPath(object: IEezObject) {
    let ancestors = getAncestors(object);
    return ancestors
        .slice(1)
        .map(object => objectToString(object))
        .join(" / ");
}

export function isObject(object: IEezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isArray(
    object: IEezObject | undefined
): object is IEezObject[] {
    return !!object && !isValue(object) && Array.isArray(object);
}

export function getChildren(parent: IEezObject): IEezObject[] {
    if (isArray(parent)) {
        return parent;
    } else {
        let properties = getClassInfo(parent).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array) &&
                isPropertyEnumerable(parent, propertyInfo) &&
                getProperty(parent, propertyInfo.name)
        );

        if (
            properties.length == 1 &&
            properties[0].type === PropertyType.Array &&
            !(properties[0].showOnlyChildrenInTree === false)
        ) {
            return getProperty(parent, properties[0].name);
        }

        return properties.map(propertyInfo =>
            getProperty(parent, propertyInfo.name)
        );
    }
}

export function getClass(object: IEezObject) {
    if (isArray(object)) {
        return getPropertyInfo(object).typeClass!;
    } else {
        return object.constructor as EezClass;
    }
}

export function getClassInfo(object: IEezObject): ClassInfo {
    return getClass(object).classInfo;
}

export function isObjectInstanceOf(
    object: IEezObject,
    baseClassInfo: ClassInfo
) {
    return isSubclassOf(getClassInfo(object), baseClassInfo);
}

export function getEditorComponent(
    object: IEezObject
): typeof EditorComponent | undefined {
    const isEditorSupported = getClassInfo(object).isEditorSupported;
    if (isEditorSupported && !isEditorSupported(object)) {
        return undefined;
    }
    return getClassInfo(object).editorComponent;
}

export function getLabel(object: IEezObject): string {
    if (typeof object === "string") {
        return object;
    }

    const label = getClassInfo(object).label;
    if (label) {
        return label(object);
    }

    let name = (object as any).name;
    if (name) {
        return name;
    }

    return getClass(object).name;
}

export function isArrayElement(object: IEezObject) {
    return isArray(getParent(object));
}

export function findPropertyByNameInObject(
    object: IEezObject,
    propertyName: string
) {
    return getClassInfo(object).properties.find(
        propertyInfo => propertyInfo.name == propertyName
    );
}

export function findPropertyByChildObject(
    object: IEezObject,
    childObject: IEezObject
) {
    return getClassInfo(object).properties.find(
        propertyInfo => getProperty(object, propertyInfo.name) === childObject
    );
}

export function getInheritedValue(object: IEezObject, propertyName: string) {
    const getInheritedValue = getClassInfo(object).getInheritedValue;
    if (getInheritedValue) {
        return getInheritedValue(object, propertyName);
    }
    return undefined;
}

export function humanizePropertyName(object: IEezObject, propertyName: string) {
    const property = findPropertyByNameInObject(object, propertyName);
    if (property && property.displayName) {
        if (typeof property.displayName == "string") {
            return property.displayName;
        }
        return property.displayName(object);
    }
    return humanize(propertyName);
}

export function getAncestorOfType<T>(
    object: IEezObject,
    classInfo: ClassInfo
): T | undefined {
    if (object) {
        if (isObjectInstanceOf(object, classInfo)) {
            return object as T;
        }
        return (
            getParent(object) && getAncestorOfType(getParent(object), classInfo)
        );
    }
    return undefined;
}

export function getObjectPath(object: IEezObject): (string | number)[] {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            return getObjectPath(parent).concat(
                parent.indexOf(object as IEezObject)
            );
        } else {
            return getObjectPath(parent).concat(getKey(object));
        }
    }
    return [];
}

export function getObjectPathAsString(object: IEezObject) {
    return "/" + getObjectPath(object).join("/");
}

export function isObjectExists(object: IEezObject) {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            if (parent.indexOf(object) === -1) {
                return false;
            }
        } else {
            const key = getKey(object);
            if (key && (parent as any)[key] !== object) {
                return false;
            }
        }
    }
    return true;
}

export function isShowOnlyChildrenInTree(object: IEezObject) {
    if (!getParent(object) || !getKey(object)) {
        return true;
    }

    const propertyInfo = findPropertyByNameInObject(
        getParent(object),
        getKey(object)
    );
    if (!propertyInfo) {
        return true;
    }

    return !(propertyInfo.showOnlyChildrenInTree === false);
}

export function isPartOfNavigation(object: IEezObject) {
    if (getParent(object)) {
        let propertyInfo = findPropertyByChildObject(getParent(object), object);
        if (propertyInfo && propertyInfo.partOfNavigation === false) {
            return false;
        }
    }
    return true;
}

export function getArrayAndObjectProperties(object: IEezObject) {
    if (!getClassInfo(object)._arrayAndObjectProperties) {
        getClassInfo(object)._arrayAndObjectProperties = getClassInfo(
            object
        ).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Array ||
                    propertyInfo.type === PropertyType.Object) &&
                getProperty(object, propertyInfo.name)
        );
    }
    return getClassInfo(object)._arrayAndObjectProperties!;
}

export function getCommonProperties(objects: IEezObject[]) {
    let properties = getClassInfo(objects[0]).properties;

    properties = properties.filter(
        propertyInfo =>
            !objects.find(
                object =>
                    isArray(object) || isPropertyHidden(object, propertyInfo)
            )
    );

    if (objects.length > 1) {
        // some property types are not supported in multi-objects property grid
        properties = properties.filter(
            propertyInfo =>
                propertyInfo.type !== PropertyType.Array &&
                !(
                    propertyInfo.type === PropertyType.String &&
                    propertyInfo.unique === true
                )
        );

        // show only common properties
        properties = properties.filter(
            propertyInfo =>
                !objects.find(
                    object =>
                        !getClassInfo(object).properties.find(
                            pi => pi === propertyInfo
                        )
                )
        );
    }

    return properties;
}

export function getPropertySourceInfo(
    props: PropertyProps
): PropertyValueSourceInfo {
    function getSourceInfo(
        object: IEezObject,
        propertyInfo: PropertyInfo
    ): PropertyValueSourceInfo {
        if (props.propertyInfo.propertyMenu) {
            return {
                source: ""
            };
        }

        let value = (object as any)[propertyInfo.name];

        if (propertyInfo.inheritable) {
            if (value === undefined) {
                let inheritedValue = getInheritedValue(
                    object,
                    propertyInfo.name
                );
                if (inheritedValue) {
                    return {
                        source: "inherited",
                        inheritedFrom: inheritedValue.source
                    };
                }
            }
        }

        if (value !== undefined) {
            return {
                source: "modified"
            };
        }

        return {
            source: "default"
        };
    }

    const sourceInfoArray = props.objects.map(object =>
        getSourceInfo(object, props.propertyInfo)
    );

    for (let i = 1; i < sourceInfoArray.length; i++) {
        if (sourceInfoArray[i].source !== sourceInfoArray[0].source) {
            return {
                source: "modified"
            };
        }
    }

    return sourceInfoArray[0];
}

export function isAnyPropertyModified(props: PropertyProps) {
    const properties = getCommonProperties(props.objects);
    for (let propertyInfo of properties) {
        const sourceInfo = getPropertySourceInfo({ ...props, propertyInfo });
        if (sourceInfo.source === "modified") {
            return true;
        }
    }
    return false;
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

export interface ICommand {
    execute(): void;
    undo(): void;
    description: string;
}

export interface IUndoManager {
    executeCommand(command: ICommand): void;
    combineCommands: boolean;
    commands: ICommand[];
}

////////////////////////////////////////////////////////////////////////////////

function getUniquePropertyValue(
    existingObjects: IEezObject[],
    key: string,
    value: string | number
) {
    if (value === undefined) {
        return value;
    }
    while (true) {
        if (
            !existingObjects.find(object => getProperty(object, key) == value)
        ) {
            return value;
        }

        if (typeof value == "number") {
            value++;
        } else {
            var groups = value.match(/(.+) \((\d+)\)/);
            if (groups) {
                value = groups[1] + " (" + (parseInt(groups[2]) + 1) + ")";
            } else {
                value += " (1)";
            }
        }
    }
}

// ensure that unique properties are unique inside parent
function ensureUniqueProperties(
    parentObject: IEezObject,
    objects: IEezObject[]
) {
    let existingObjects = (parentObject as IEezObject[]).map(
        (object: IEezObject) => object
    );
    objects.forEach(object => {
        for (const propertyInfo of getClassInfo(object).properties) {
            if (propertyInfo.unique) {
                (object as any)[propertyInfo.name] = getUniquePropertyValue(
                    existingObjects,
                    propertyInfo.name,
                    getProperty(object, propertyInfo.name)
                );
            }
        }
        existingObjects.push(object);
    });
}

////////////////////////////////////////////////////////////////////////////////

export let addObject = action(
    (parentObject: IEezObject, object: IEezObject) => {
        object = loadObject(
            getDocumentStore(parentObject),
            parentObject,
            object,
            getClass(parentObject)
        );
        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).push(object);
            }),

            undo: action(() => {
                (parentObject as IEezObject[]).pop();
            }),

            get description() {
                return "Added: " + getHumanReadableObjectPath(object);
            }
        });

        return object;
    }
);

export let addObjects = action(
    (parentObject: IEezObject, objects: IEezObject[]) => {
        objects = objects.map(object =>
            loadObject(
                getDocumentStore(parentObject),
                parentObject,
                object,
                getClass(parentObject)
            )
        );
        ensureUniqueProperties(parentObject, objects);

        getDocumentStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).push(...objects);
            }),

            undo: action(() => {
                for (let i = 0; i < objects.length; i++) {
                    (parentObject as IEezObject[]).pop();
                }
            }),

            get description() {
                return (
                    "Added: " +
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return objects;
    }
);

export let insertObject = action(
    (parentObject: IEezObject, index: number, object: any) => {
        object = loadObject(
            getDocumentStore(parentObject),
            parentObject,
            object,
            getClass(parentObject)
        );
        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).splice(index, 0, object);
            }),

            undo: action(() => {
                (parentObject as IEezObject[]).splice(index, 1);
            }),

            get description() {
                return "Inserted: " + getHumanReadableObjectPath(object);
            }
        });

        return object;
    }
);

class UpdateCommand implements ICommand {
    private oldValues: any = {};
    private newValues: any = {};

    constructor(
        public object: IEezObject,
        private values: any,
        lastCommand?: UpdateCommand
    ) {
        if (lastCommand) {
            this.oldValues = lastCommand.oldValues;
        }

        for (let propertyName in values) {
            let propertyInfo = findPropertyByNameInObject(object, propertyName);

            if (propertyInfo) {
                if (!lastCommand) {
                    this.oldValues[propertyName] = getProperty(
                        object,
                        propertyName
                    );
                }
                this.newValues[propertyName] = values[propertyName];
            }
        }
    }

    @action
    execute() {
        Object.assign(this.object, this.newValues);
    }

    @action
    undo() {
        Object.assign(this.object, this.oldValues);
    }

    @computed
    get description() {
        return (
            `Changed (${_map(this.values, (value, name) => humanize(name)).join(
                ", "
            )}): ` + getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((object: IEezObject, values: any) => {
    const undoManager = getDocumentStore(object).undoManager;

    let closeCombineCommands = false;

    const updateObjectValueHook = getClassInfo(object).updateObjectValueHook;
    if (updateObjectValueHook) {
        if (!undoManager.combineCommands) {
            undoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        updateObjectValueHook(object, values);
    }

    let previousCommand;

    // TODO this should be moved to undoManager implementation
    // merge with previous command
    if (undoManager.combineCommands && undoManager.commands.length > 0) {
        let command = undoManager.commands[undoManager.commands.length - 1];
        if (command instanceof UpdateCommand && command.object == object) {
            undoManager.commands.pop();
            previousCommand = command;
        }
    }

    undoManager.executeCommand(
        new UpdateCommand(object, values, previousCommand)
    );

    if (closeCombineCommands) {
        undoManager.setCombineCommands(false);
    }
});

export let deleteObject = action((object: any) => {
    const parent = getParent(object);

    if (isArrayElement(object)) {
        const array = parent as IEezObject[];
        const index = array.indexOf(object);

        getDocumentStore(object).undoManager.executeCommand({
            execute: action(() => {
                array.splice(index, 1);
            }),

            undo: action(() => {
                array.splice(index, 0, object);
            }),

            get description() {
                return "Deleted: " + getHumanReadableObjectPath(object);
            }
        });
    } else {
        updateObject(parent, {
            [getKey(object)]: undefined
        });
    }
});

export let deleteObjects = action((objects: IEezObject[]) => {
    let undoIndexes: number[];

    getDocumentStore(objects[0]).undoManager.executeCommand({
        execute: action(() => {
            undoIndexes = [];
            for (let i = 0; i < objects.length; i++) {
                let object = objects[i];
                let parent = getParent(object);

                if (isArrayElement(object)) {
                    const array = parent as IEezObject[];
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                } else {
                    undoIndexes.push(-1);
                    (parent as any)[getKey(object)] = undefined;
                }
            }
        }),

        undo: action(() => {
            for (let i = objects.length - 1; i >= 0; i--) {
                let object = objects[i];
                let parent = getParent(object);
                if (isArrayElement(object)) {
                    const array = parent as IEezObject[];
                    let index = undoIndexes[i];
                    array.splice(index, 0, object);
                } else {
                    (parent as any)[getKey(object)] = object;
                }
            }
        }),

        get description() {
            return (
                "Deleted: " +
                objects
                    .map(object => getHumanReadableObjectPath(object))
                    .join(", ")
            );
        }
    });
});

export let replaceObject = action(
    (object: IEezObject, replaceWithObject: IEezObject) => {
        let parent = getParent(object);
        const undoManager = getDocumentStore(parent).undoManager;
        if (isArrayElement(object)) {
            const array = parent as IEezObject[];

            let index = array.indexOf(object);

            undoManager.executeCommand({
                execute: action(() => {
                    array[index] = replaceWithObject;
                }),

                undo: action(() => {
                    array[index] = object;
                }),

                get description() {
                    return "Replaced: " + getHumanReadableObjectPath(object);
                }
            });
        } else {
            updateObject(parent as any, {
                [getKey(object)]: replaceWithObject
            });
        }

        return replaceWithObject;
    }
);

export let replaceObjects = action(
    (objects: IEezObject[], replaceWithObject: IEezObject) => {
        if (objects.length === 1) {
            return replaceObject(objects[0], replaceWithObject);
        }

        const parent = getParent(objects[0]);
        const array = parent as IEezObject[];
        const index = array.indexOf(objects[0]);

        let undoIndexes: number[];

        getDocumentStore(parent).undoManager.executeCommand({
            execute: action(() => {
                array[index] = replaceWithObject;

                undoIndexes = [];
                for (let i = 1; i < objects.length; i++) {
                    let object = objects[i];
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                }
            }),

            undo: action(() => {
                for (let i = objects.length - 1; i >= 1; i--) {
                    let object = objects[i];
                    let index = undoIndexes[i - 1];
                    array.splice(index, 0, object);
                }

                array[index] = objects[0];
            }),

            get description() {
                return (
                    "Replaced: " +
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return replaceWithObject;
    }
);

////////////////////////////////////////////////////////////////////////////////

export function insertObjectBefore(object: IEezObject, objectToInsert: any) {
    const parent = getParent(object);
    const array = parent as IEezObject[];
    const index = array.indexOf(object);
    return insertObject(parent, index, objectToInsert);
}

export function insertObjectAfter(object: IEezObject, objectToInsert: any) {
    const parent = getParent(object);
    const array = parent as IEezObject[];
    const index = array.indexOf(object);
    return insertObject(parent, index + 1, objectToInsert);
}

////////////////////////////////////////////////////////////////////////////////

let CurrentDocumentStore: DocumentStoreClass | undefined;

function loadArrayObject(
    arrayObject: any,
    parent: any,
    propertyInfo: PropertyInfo
) {
    const eezArray: EezObject[] = observable([]);

    setId(
        CurrentDocumentStore!.objects,
        eezArray,
        CurrentDocumentStore!.getChildId()
    );
    setParent(eezArray, parent);
    setKey(eezArray, propertyInfo.name);
    setPropertyInfo(eezArray, propertyInfo);

    arrayObject.forEach((object: any) =>
        eezArray.push(
            loadObjectInternal(eezArray, object, propertyInfo.typeClass!)
        )
    );

    return eezArray;
}

export function loadObject(
    DocumentStore: DocumentStoreClass,
    parent: IEezObject | IEezObject[] | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): IEezObject {
    CurrentDocumentStore = DocumentStore;
    const result = loadObjectInternal(parent, jsObjectOrString, aClass, key);
    CurrentDocumentStore = undefined;
    return result;
}

function loadObjectInternal(
    parent: IEezObject | IEezObject[] | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): IEezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string"
            ? JSON.parse(jsObjectOrString)
            : jsObjectOrString;

    if (Array.isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClass: aClass
        });
    }

    let object: IEezObject;

    try {
        object = aClass.classInfo.getClass
            ? new (aClass.classInfo.getClass(jsObject, aClass))()
            : new aClass();
    } catch (err) {
        // TODO we need much better error recovery here
        console.error(err);
        return new EezObject();
    }

    const classInfo = getClassInfo(object);

    setId(
        CurrentDocumentStore!.objects,
        object,
        CurrentDocumentStore!.getChildId()
    );
    setParent(object, parent as IEezObject);

    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(object, jsObject);
    }

    for (const propertyInfo of classInfo.properties) {
        if (propertyInfo.computed === true) {
            continue;
        }

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: IEezObject | undefined;

            if (value) {
                childObject = loadObjectInternal(
                    object,
                    value,
                    propertyInfo.typeClass!
                );
            } else if (!propertyInfo.isOptional) {
                let typeClass = propertyInfo.typeClass!;
                childObject = loadObjectInternal(
                    object,
                    typeClass.classInfo.defaultValue,
                    typeClass
                );
            }

            if (childObject) {
                setKey(childObject, propertyInfo.name);
                (object as any)[propertyInfo.name] = childObject;
            }
        } else if (propertyInfo.type === PropertyType.Array) {
            if (!value && !propertyInfo.isOptional) {
                value = [];
            }

            if (value) {
                (object as any)[propertyInfo.name] = loadArrayObject(
                    value,
                    object,
                    propertyInfo
                );
            }
        } else {
            if (value !== undefined) {
                (object as any)[propertyInfo.name] = value;
            }
        }
    }

    return object;
}

////////////////////////////////////////////////////////////////////////////////

export function objectToJson(
    object: IEezObject | IEezObject[],
    space?: number,
    toJsHook?: (jsObject: any, object: IEezObject) => void
) {
    const saved = {
        _eez_parent: (object as any)._eez_parent,
        _eez_propertyInfo: (object as any)._eez_propertyInfo,
        _eez_id: (object as any)._eez_id,
        _eez_key: (object as any)._eez_key
    };
    delete (object as any)._eez_parent;
    delete (object as any)._eez_propertyInfo;
    delete (object as any)._eez_id;
    delete (object as any)._eez_key;

    let jsObject = toJS(object);

    Object.assign(object, saved);

    if (toJsHook) {
        toJsHook(jsObject, object);
    }

    return JSON.stringify(
        jsObject,
        (key: string | number, value: any) => {
            if (typeof key === "string" && key[0] === "_") {
                return undefined;
            }
            return value;
        },
        space
    );
}

export function objectToJS(object: IEezObject | IEezObject[]): any {
    return JSON.parse(objectToJson(object));
}

export function cloneObject(
    DocumentStore: DocumentStoreClass,
    obj: IEezObject
) {
    return loadObject(
        DocumentStore,
        undefined,
        objectToJson(obj),
        getClass(obj)
    );
}

export function hideInPropertyGridIfDashboard(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.isDashboardProject;
}

export function hideInPropertyGridIfNotDashboard(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return !documentStore.project.isDashboardProject;
}

export function hideInPropertyGridIfApplet(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.isAppletProject;
}

export function hideInPropertyGridIfDashboardOrApplet(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return (
        documentStore.project.isDashboardProject ||
        documentStore.project.isAppletProject
    );
}

export function hideInPropertyGridIfV1(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.settings.general.projectVersion === "v1";
}

export function hideInPropertyGridIfNotV1(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.settings.general.projectVersion !== "v1";
}
