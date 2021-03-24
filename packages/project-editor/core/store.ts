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
    getLabel,
    registerClass,
    makeDerivedClassInfo
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
import {
    TreeObjectAdapter,
    ITreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { OutputSections, OutputSection } from "project-editor/core/output";

import { getProjectFeatures } from "project-editor/core/extensions";

import * as SearchModule from "project-editor/core/search";
import { DataContext } from "project-editor/features/data/data";
import { CurrentSearch } from "project-editor/core/search";
import { Project } from "project-editor/project/project";

import {
    build as buildProject,
    backgroundCheck,
    buildExtensions
} from "project-editor/project/build";
import { getAllMetrics } from "project-editor/project/metrics";
import { ActionNode, Widget } from "project-editor/features/gui/widget";
import {
    InputActionNode,
    OutputActionNode
} from "project-editor/features/gui/action-nodes";
import {
    ConnectionLine,
    Page,
    PageFragment
} from "project-editor/features/gui/page";

import { Section } from "project-editor/core/output";
import { findAction } from "project-editor/features/action/action";
import { isBrowser } from "eez-studio-shared/util-electron";

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

interface ObjectNavigationItem {
    type: "object";
    object: IEezObject;
}

interface ObjectAdapterNavigationItem {
    type: "objectAdapter";
    objectAdapter: ITreeObjectAdapter;
}

type NavigationItem = ObjectNavigationItem | ObjectAdapterNavigationItem;

export function isObjectNavigationItem(
    navigationItem: NavigationItem
): navigationItem is ObjectNavigationItem {
    return navigationItem && navigationItem.type == "object";
}

export function createObjectNavigationItem(
    object: IEezObject | undefined
): ObjectNavigationItem | undefined {
    return object
        ? {
              type: "object",
              object
          }
        : undefined;
}

export function createObjectAdapterNavigationItem(
    objectAdapter: ITreeObjectAdapter | undefined
): ObjectAdapterNavigationItem | undefined {
    return objectAdapter
        ? {
              type: "objectAdapter",
              objectAdapter
          }
        : undefined;
}

export function getObjectFromNavigationItem(
    navigationItem: NavigationItem | undefined
) {
    return navigationItem
        ? isObjectNavigationItem(navigationItem)
            ? navigationItem.object
            : navigationItem.objectAdapter.object
        : undefined;
}

export function compareNavigationItem(
    navigationItem: NavigationItem | undefined,
    object: IEezObject
) {
    return getObjectFromNavigationItem(navigationItem) == object;
}

export interface INavigationStore {
    selectedPanel?: IPanel;
    selectedObject?: IEezObject;
    getNavigationSelectedItem(
        navigationObject: IEezObject
    ): NavigationItem | undefined;
    getNavigationSelectedItemAsObject(
        navigationObject: IEezObject
    ): IEezObject | undefined;
    setNavigationSelectedItem(
        navigationObject: IEezObject,
        navigationSelectedItem: NavigationItem
    ): void;
    setSelectedPanel(selectedPanel: IPanel | undefined): void;
    editable: boolean;
}

export class SimpleNavigationStoreClass implements INavigationStore {
    @observable selectedItem: NavigationItem | undefined;

    constructor(
        selectedObject: IEezObject | undefined,
        public editable = true
    ) {
        this.selectedItem = createObjectNavigationItem(selectedObject);
    }

    get selectedObject(): IEezObject | undefined {
        return getObjectFromNavigationItem(this.selectedItem);
    }

    getNavigationSelectedItem(navigationObject: IEezObject) {
        return this.selectedItem;
    }

    getNavigationSelectedItemAsObject(navigationObject: IEezObject) {
        return this.selectedObject;
    }

    @action
    setNavigationSelectedItem(
        navigationObject: IEezObject,
        navigationSelectedItem: NavigationItem
    ) {
        this.selectedItem = navigationSelectedItem;
    }

    setSelectedPanel(selectedPanel: IPanel | undefined) {}
}

class NavigationStoreClass implements INavigationStore {
    @observable navigationMap = new Map<string, NavigationItem>();
    @observable selectedPanel: IPanel | undefined;

    editable = true;

    constructor(public DocumentStore: DocumentStoreClass) {}

    load(map: { [stringPath: string]: string }) {
        let navigationMap = new Map<string, NavigationItem>();

        for (let stringPath in map) {
            let navigationObject = this.DocumentStore.getObjectFromStringPath(
                stringPath
            );
            if (navigationObject) {
                let navigationItemStr = map[stringPath];
                if (navigationItemStr === stringPath) {
                    continue;
                }
                let navigationItem: NavigationItem | undefined;
                if (typeof navigationItemStr == "string") {
                    navigationItem = createObjectNavigationItem(
                        this.DocumentStore.getObjectFromStringPath(
                            navigationItemStr
                        )
                    );
                } else {
                    let navigationObjectAdapter = new TreeObjectAdapter(
                        navigationObject
                    );
                    setTimeout(() => {
                        navigationObjectAdapter.loadState(navigationItemStr);
                    }, 0);
                    navigationItem = createObjectAdapterNavigationItem(
                        navigationObjectAdapter
                    );
                }

                if (navigationItem) {
                    navigationMap.set(getId(navigationObject), navigationItem);
                }
            }
        }

        this.navigationMap = navigationMap;
    }

    @computed
    get toJS() {
        let map: any = {};
        for (var [id, navigationItem] of this.navigationMap) {
            let navigationObject = this.DocumentStore.getObjectFromObjectId(id);
            if (navigationObject) {
                let navigationObjectPath = getObjectPathAsString(
                    navigationObject
                );
                if (isObjectNavigationItem(navigationItem)) {
                    map[navigationObjectPath] = getObjectPathAsString(
                        navigationItem.object
                    );
                } else {
                    map[
                        navigationObjectPath
                    ] = navigationItem.objectAdapter.saveState();
                }
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
            let child = this.getNavigationSelectedItem(object);
            if (!child) {
                return object;
            }
            if (!isObjectNavigationItem(child)) {
                return child.objectAdapter.selectedObject;
            }
            object = child.object;
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

        for (
            let ancestor = getParent(object);
            ancestor;
            ancestor = getParent(ancestor)
        ) {
            let navigationItem = this.getNavigationSelectedItem(ancestor);
            if (navigationItem && !isObjectNavigationItem(navigationItem)) {
                navigationItem.objectAdapter.selectObjects(selection);
                return;
            }
        }

        let iterObject = object;
        let parent = getParent(iterObject);
        while (iterObject && parent) {
            let grandparent = getParent(parent);
            if (!isArray(grandparent)) {
                let navigationItem = this.getNavigationSelectedItem(parent);
                if (navigationItem && !isObjectNavigationItem(navigationItem)) {
                    navigationItem.objectAdapter.selectObjects(selection);
                } else {
                    this.setNavigationSelectedItem(
                        parent,
                        createObjectNavigationItem(iterObject)!
                    );
                }
            }

            iterObject = parent;
            parent = getParent(iterObject);
        }
    }

    isSelected(object: IEezObject) {
        let iterObject = object;
        let parent = getParent(iterObject);
        while (iterObject && parent) {
            if (getClassInfo(parent).navigationComponent) {
                let grandparent = getParent(parent);
                if (!isArray(grandparent)) {
                    let navigationItem = this.getNavigationSelectedItem(parent);
                    if (
                        navigationItem &&
                        !isObjectNavigationItem(navigationItem)
                    ) {
                        if (
                            navigationItem.objectAdapter.selectedObject !=
                            object
                        ) {
                            return false;
                        }
                    } else {
                        if (navigationItem?.object != iterObject) {
                            return false;
                        }
                    }
                }
            }
            iterObject = parent;
            parent = getParent(iterObject);
        }

        return true;
    }

    getNavigationSelectedItem(
        navigationObject: IEezObject
    ): NavigationItem | undefined {
        let item = this.navigationMap.get(getId(navigationObject));

        if (item && isObjectNavigationItem(item)) {
            // is this maybe deleted object?
            item = createObjectNavigationItem(
                this.DocumentStore.getObjectFromObjectId(getId(item.object))
            );
        }

        if (!item) {
            let defaultNavigationKey = getClassInfo(navigationObject)
                .defaultNavigationKey;
            if (defaultNavigationKey) {
                item = createObjectNavigationItem(
                    getProperty(navigationObject, defaultNavigationKey)
                );
            }
        }
        return item;
    }

    getNavigationSelectedItemAsObject(
        navigationObject: IEezObject
    ): IEezObject | undefined {
        let navigationItem = this.getNavigationSelectedItem(navigationObject);
        if (!navigationItem) {
            return undefined;
        }
        if (!isObjectNavigationItem(navigationItem)) {
            console.error("TreeObjectAdapter is not expected");
            return undefined;
        }
        return navigationItem.object;
    }

    getNavigationSelectedItemAsObjectAdapter(
        navigationObject: IEezObject
    ): ITreeObjectAdapter | undefined {
        let navigationItem = this.getNavigationSelectedItem(navigationObject);
        if (navigationItem && isObjectNavigationItem(navigationItem)) {
            console.error("TreeObjectAdapter is expected");
            return undefined;
        }
        return navigationItem?.objectAdapter;
    }

    @action
    setNavigationSelectedItem(
        navigationObject: IEezObject,
        navigationSelectedItem: NavigationItem
    ) {
        this.navigationMap.set(getId(navigationObject), navigationSelectedItem);

        if (!isPartOfNavigation(navigationObject)) {
            return;
        }

        let parent = getParent(navigationObject);
        if (parent) {
            this.setNavigationSelectedItem(
                parent,
                createObjectNavigationItem(navigationObject)!
            );
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
                const editor = this.DocumentStore.EditorsStore.openEditor(
                    object
                );
                setTimeout(() => {
                    if (editor && editor.state) {
                        editor.state.selectObject(
                            isValue(objectToShow)
                                ? getParent(objectToShow)
                                : objectToShow
                        );
                    }
                }, 0);
                break;
            }
        }
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
        this.DocumentStore.EditorsStore.activateEditor(this);
    }

    @action
    makePermanent() {
        this.permanent = true;
    }

    close() {
        this.DocumentStore.EditorsStore.closeEditor(this);
    }
}

class EditorsStoreClass {
    @observable editors: Editor[] = [];

    constructor(public DocumentStore: DocumentStoreClass) {
        // open editor when navigation selection has changed
        autorun(() => {
            let object = DocumentStore.NavigationStore.selectedObject;
            while (object) {
                let navigationItem = DocumentStore.NavigationStore.getNavigationSelectedItem(
                    object
                );
                while (navigationItem) {
                    if (isObjectNavigationItem(navigationItem)) {
                        if (
                            !isArray(navigationItem.object) &&
                            getEditorComponent(navigationItem.object)
                        ) {
                            this.openEditor(navigationItem.object);
                        }
                        navigationItem = DocumentStore.NavigationStore.getNavigationSelectedItem(
                            navigationItem.object
                        );
                    } else {
                        let object =
                            navigationItem.objectAdapter.selectedObject;
                        if (
                            object &&
                            !isArray(object) &&
                            getEditorComponent(object)
                        ) {
                            this.openEditor(object);
                        } else if (
                            getEditorComponent(
                                navigationItem.objectAdapter.object
                            )
                        ) {
                            this.openEditor(
                                navigationItem.objectAdapter.object
                            );
                        }
                        return;
                    }
                }

                object = getParent(object);
            }
        });

        // close non-permanent editor if editor object is not selected
        // autorun(() => {
        //     for (let i = 0; i < this.editors.length; i++) {
        //         if (!this.editors[i].permanent) {
        //             if (!NavigationStore.isSelected(this.editors[i].object)) {
        //                 this.closeEditor(this.editors[i]);
        //             }
        //             break;
        //         }
        //     }
        // });

        // close editor if editor object doesn't exists anymore
        autorun(() => {
            this.editors.slice().forEach(editor => {
                if (!isObjectExists(editor.object)) {
                    this.closeEditor(editor);
                }
            });
        });
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
                        const createEditorState = getClassInfo(object)
                            .createEditorState;
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

class UIStateStoreClass {
    @observable viewOptions: ViewOptions = new ViewOptions();
    @observable selectedBuildConfiguration: string;
    @observable features: any;
    @observable objects = new Map<string, any>();
    @observable savedState: any;
    @observable searchPattern: string;
    @observable searchMatchCase: boolean;
    @observable searchMatchWholeWord: boolean;
    @observable activeOutputSection = Section.CHECKS;

    constructor(public DocumentStore: DocumentStoreClass) {
        autorun(() => {
            this.savedState = this.toJS;
        });

        // react when selected panel or selected message in output window has changed
        reaction(
            () => ({
                message: this.DocumentStore.OutputSectionsStore?.activeSection
                    .selectedMessage,
                panel: this.DocumentStore.NavigationStore.selectedPanel
            }),
            arg => {
                if (
                    arg.panel instanceof OutputSection &&
                    arg.message &&
                    arg.message.object
                ) {
                    this.DocumentStore.NavigationStore.showObject(
                        arg.message.object
                    );
                }
            },
            {
                delay: 100
            }
        );
    }

    loadObjects(objects: any) {
        this.objects.clear();
        _each(objects, (value: any, objectPath: any) => {
            this.objects.set(objectPath, value);
        });
    }

    @action
    load(uiState: any) {
        this.viewOptions.load(uiState.viewOptions);
        this.DocumentStore.NavigationStore.load(uiState.navigationMap);
        this.DocumentStore.EditorsStore.load(uiState.editors);
        this.selectedBuildConfiguration =
            uiState.selectedBuildConfiguration || "Default";
        this.features = observable(uiState.features || {});
        this.activeOutputSection =
            uiState.activeOutputSection ?? Section.CHECKS;
        this.loadObjects(uiState.objects);
    }

    @computed
    get featuresJS() {
        return toJS(this.features);
    }

    @computed
    get objectsJS() {
        let map: any = {};
        for (var [objectPath, value] of this.objects) {
            if (this.DocumentStore.getObjectFromStringPath(objectPath)) {
                map[objectPath] = value;
            }
        }
        return map;
    }

    @computed
    get toJS() {
        return {
            viewOptions: this.viewOptions.toJS,
            navigationMap: this.DocumentStore.NavigationStore.toJS,
            editors: this.DocumentStore.EditorsStore.toJS,
            selectedBuildConfiguration: this.selectedBuildConfiguration,
            features: this.featuresJS,
            objects: this.objectsJS,
            activeOutputSection: this.activeOutputSection
        };
    }

    @computed
    get isModified() {
        return !!this.savedState;
    }

    @action
    save(): string {
        let result = JSON.stringify(this.savedState, null, 2);
        this.savedState = undefined;
        return result;
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

    getObjectUIState(object: IEezObject) {
        return this.objects.get(getObjectPathAsString(object));
    }

    updateObjectUIState(object: IEezObject, changes: any) {
        const path = getObjectPathAsString(object);
        let objectUIState = this.objects.get(path);
        if (objectUIState) {
            Object.assign(objectUIState, changes);
        } else {
            this.objects.set(path, changes);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IUndoItem {
    commands: ICommand[];
    selectionBefore: any;
    selectionAfter: any;
}

export class UndoManagerClass {
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
            let selectionAfter = this.DocumentStore.NavigationStore.getSelection();
            this.undoStack.push({
                commands: this.commands,
                selectionBefore: this.selectionBeforeFirstCommand,
                selectionAfter: selectionAfter
            });

            this.commands = [];
            this.selectionBeforeFirstCommand = this.DocumentStore.NavigationStore.getSelection();
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
            this.selectionBeforeFirstCommand = this.DocumentStore.NavigationStore.getSelection();
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
            return UndoManagerClass.getCommandsDescription(commands);
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

            this.DocumentStore.NavigationStore.setSelection(
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
            return UndoManagerClass.getCommandsDescription(commands);
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

            this.DocumentStore.NavigationStore.setSelection(
                redoItem.selectionAfter
            );

            this.undoStack.push(redoItem);

            this.DocumentStore.setModified(true);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DebugStoreClass {
    @observable isActive = false;
    page: Page | undefined;

    constructor(public DocumentStore: DocumentStoreClass) {}

    executeAction(actionName: string) {
        const action = findAction(this.DocumentStore.project, actionName);
        if (action && action.page) {
            this.executePage(action.page);
        }
    }

    executePage(page: Page) {
        this.page = page;
        const inputActionNode = page.widgets.find(
            widget => widget instanceof InputActionNode
        ) as ActionNode;
        if (inputActionNode) {
            this.executeActionNode(inputActionNode);
        }
    }

    executeActionNode(actionNode: ActionNode) {
        console.log(`Execute action: ${getLabel(actionNode)}`);
        actionNode.execute();
        if (actionNode instanceof OutputActionNode) {
            console.log("Execute action done!");
            this.page = undefined;
        }
    }

    getConnectionline(wireID: string) {
        if (this.page) {
            return this.page.connectionLines.find(
                connectionLine => connectionLine.source === wireID
            );
        }
        return undefined;
    }

    executeWire(wireID: string) {
        if (this.page) {
            const connectionLine = this.getConnectionline(wireID);
            if (connectionLine) {
                const actionNode = this.page.wiredWidgets.get(
                    connectionLine.target
                ) as ActionNode;
                this.executeActionNode(actionNode);
            }
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
    UndoManager = new UndoManagerClass(this);
    NavigationStore = new NavigationStoreClass(this);
    EditorsStore = new EditorsStoreClass(this);
    UIStateStore = new UIStateStoreClass(this);
    OutputSectionsStore = new OutputSections(this);
    DebugStore = new DebugStoreClass(this);

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

    static async create() {
        await initExtensions();
        return new DocumentStoreClass();
    }

    constructor() {
        autorun(
            () => {
                this.updateProjectWindowState();
            },
            {
                delay: 100
            }
        );

        autorun(
            () => {
                if (this.filePath) {
                    this.updateMruFilePath();
                }
            },
            {
                delay: 100
            }
        );

        if (!isBrowser()) {
            this.watch();
        }
    }

    async watch() {
        const chokidarModuleName = "chokidar";
        const { watch } = await import(chokidarModuleName);
        let watcher: FSWatcher | undefined = undefined;
        autorun(() => {
            if (watcher) {
                watcher.close();
            }
            if (this.project) {
                const importedProjectFiles = this.project.settings.general.imports
                    .filter(
                        importDirective => !!importDirective.projectFilePath
                    )
                    .map(importDirective =>
                        this.getAbsoluteFilePath(
                            importDirective.projectFilePath
                        )
                    );
                watcher = watch(importedProjectFiles) as FSWatcher;
                watcher!.on("change", path => {
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

    async waitUntilready() {
        while (true) {
            const project = this.project;
            if (project) {
                let i;
                for (i = 0; i < project.settings.general.imports.length; i++) {
                    if (
                        project.settings.general.imports[i].project ===
                        undefined
                    ) {
                        break;
                    }
                }
                if (i == project.settings.general.imports.length) {
                    break;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }

        autorun(() => {
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
        if (isBrowser()) {
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
                (this.UndoManager &&
                    this.UndoManager.canUndo &&
                    this.UndoManager.undoDescription) ||
                null,
            redo:
                (this.UndoManager &&
                    this.UndoManager.canRedo &&
                    this.UndoManager.redoDescription) ||
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
        if (isBrowser()) {
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
                    this.UIStateStore.selectedBuildConfiguration
            );
        if (!configuration) {
            if (this.project.settings.build.configurations.length > 0) {
                configuration = this.project.settings.build.configurations[0];
            }
        }
        return configuration;
    }

    doSave(callback: (() => void) | undefined) {
        if (this.filePath) {
            save(this, this.filePath)
                .then(() => {
                    this.setModified(false);

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

    async saveToFile(saveAs: boolean, callback: (() => void) | undefined) {
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

                    this.savedAsFilePath(filePath, callback);
                }
            } else {
                this.doSave(callback);
            }
        }
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
        if (isBrowser()) {
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
                        resolve(JSON.parse(data));
                    }
                }
            );
        });
    }

    saveUIState() {
        return new Promise<void>(resolve => {
            if (this.filePath && this.UIStateStore.isModified) {
                const fs = EEZStudio.remote.require("fs");
                fs.writeFile(
                    getUIStateFilePath(this.filePath),
                    this.UIStateStore.save(),
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

    saveModified(callback: any) {
        this.saveUIState();

        if (this.project && this.modified) {
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
        buildProject(this, { onlyCheck: true });
    }

    build() {
        buildProject(this, { onlyCheck: false });
    }

    buildExtensions() {
        buildExtensions(this);
    }

    closeWindow() {
        return new Promise<void>(resolve => {
            if (this.project) {
                this.saveModified(() => {
                    this.changeProject(undefined);
                    resolve();
                });
            } else {
                resolve();
            }
        });
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

    loadExternalProject(filePath: string) {
        if (filePath == this.filePath) {
            return this.project;
        }

        const project = this.externalProjects.get(filePath);
        if (project) {
            return project;
        }

        if (!this.externalProjectsLoading.get(filePath)) {
            this.externalProjectsLoading.set(filePath, true);

            (async () => {
                const project = await load(this, filePath);

                project._isReadOnly = true;
                project._DocumentStore = this;

                runInAction(() => {
                    this.externalProjects.set(filePath, project);
                    this.mapExternalProjectToAbsolutePath.set(
                        project,
                        filePath
                    );
                });

                this.externalProjectsLoading.set(filePath, false);
            })();
        }

        return undefined;
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
        this.UIStateStore.load(uiState || {});
        this.UndoManager.clear();
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

        return addObject(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            parentObject,
            object
        );
    }

    addObjects(parentObject: IEezObject, objects: any[]) {
        return addObjects(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            parentObject,
            objects
        );
    }

    insertObject(parentObject: IEezObject, index: number, object: any) {
        return insertObject(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            parentObject,
            index,
            object
        );
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

        updateObject(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            object,
            values
        );

        const afterUpdateObjectHook = getClassInfo(object)
            .afterUpdateObjectHook;
        if (afterUpdateObjectHook) {
            afterUpdateObjectHook(object, inputValues, oldValues);
        }
    }

    deleteObject(object: IEezObject) {
        const commandContext = {
            undoManager: this.UndoManager,
            selectionManager: this.NavigationStore
        };
        let closeCombineCommands = false;

        if (object instanceof Widget) {
            if (!this.UndoManager.combineCommands) {
                this.UndoManager.setCombineCommands(true);
                closeCombineCommands = true;
            }

            const page = getAncestorOfType(object, Page.classInfo) as Page;
            page.deleteConnectionLines(commandContext, object);
        }

        deleteObject(commandContext, object);

        if (closeCombineCommands) {
            this.UndoManager.setCombineCommands(false);
        }
    }

    deleteObjects(objects: IEezObject[]) {
        if (objects.length === 1) {
            this.deleteObject(objects[0]);
        } else {
            const commandContext = {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            };
            let closeCombineCommands = false;

            objects.forEach(object => {
                if (object instanceof Widget) {
                    if (!this.UndoManager.combineCommands) {
                        this.UndoManager.setCombineCommands(true);
                        closeCombineCommands = true;
                    }
                    const page = getAncestorOfType(
                        object,
                        Page.classInfo
                    ) as Page;
                    page.deleteConnectionLines(commandContext, object);
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

            deleteObjects(
                {
                    undoManager: this.UndoManager,
                    selectionManager: this.NavigationStore
                },
                objects
            );

            if (closeCombineCommands) {
                this.UndoManager.setCombineCommands(false);
            }
        }
    }

    replaceObject(object: IEezObject, replaceWithObject: IEezObject) {
        if (getParent(object) !== getParent(replaceWithObject)) {
            console.error("assert failed");
        }

        return replaceObject(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            object,
            replaceWithObject
        );
    }

    replaceObjects(objects: IEezObject[], replaceWithObject: IEezObject) {
        if (getParent(objects[0]) !== getParent(replaceWithObject)) {
            console.error("assert failed");
        }

        return replaceObjects(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            objects,
            replaceWithObject
        );
    }

    insertObjectBefore(object: IEezObject, objectToInsert: any) {
        return insertObjectBefore(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            object,
            objectToInsert
        );
    }

    insertObjectAfter(object: IEezObject, objectToInsert: any) {
        return insertObjectAfter(
            {
                undoManager: this.UndoManager,
                selectionManager: this.NavigationStore
            },
            object,
            objectToInsert
        );
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const page = getAncestorOfType(objects[0], Page.classInfo) as Page;
        if (page) {
            return page.objectsToClipboardData(objects);
        }
        return objectsToClipboardData(objects);
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

function canDuplicate(object: IEezObject) {
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
                            c.serializedData.objectClassName == "PageFragment"
                        ) {
                            const page = getAncestorOfType(
                                c.pastePlace,
                                Page.classInfo
                            ) as Page;
                            if (page) {
                                return page.pastePageFragment(
                                    c.serializedData.object as PageFragment
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
                    const {
                        findAllReferences
                    } = require("project-editor/core/search") as typeof SearchModule;
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
    const {
        isReferenced
    } = require("project-editor/core/search") as typeof SearchModule;

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
                    extension.eezFlowExtensionInit({
                        React,
                        mobx,
                        registerClass,
                        PropertyType,
                        makeDerivedClassInfo,
                        ActionNode
                    });
                }
            });
        }

        const extensionsModule = await import("project-editor/core/extensions");
        await extensionsModule.loadExtensions();
    }
}
