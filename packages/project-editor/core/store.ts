import { observable, extendObservable, computed, action, toJS, reaction, autorun } from "mobx";

import { confirmSave } from "eez-studio-shared/util";
import { _each, _isArray, _map, _uniqWith } from "eez-studio-shared/algorithm";

import { showGenericDialog, TableField } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";

import {
    EezObject,
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
    findPropertyByName,
    getObjectFromPath,
    getObjectFromStringPath,
    getObjectFromObjectId,
    cloneObject
} from "project-editor/core/object";
import { checkClipboard, objectToClipboardData } from "project-editor/core/clipboard";
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
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { findAllReferences, isReferenced } from "project-editor/core/search";
import { OutputSections, OutputSection } from "project-editor/core/output";
import { confirm } from "project-editor/core/util";

import {
    Project,
    save as saveProject,
    load as loadProject,
    getNewProject
} from "project-editor/project/project";
import { build as buildProject, backgroundCheck } from "project-editor/project/build";
import { getAllMetrics } from "project-editor/project/metrics";

const { Menu, MenuItem } = EEZStudio.electron.remote;
const path = EEZStudio.electron.remote.require("path");
const ipcRenderer = EEZStudio.electron.ipcRenderer;
const fs = EEZStudio.electron.remote.require("fs");

////////////////////////////////////////////////////////////////////////////////

interface IPanel {
    selectedObject: EezObject | undefined;
}

type NavigationItem = EezObject | TreeObjectAdapter;

class NavigationStoreClass {
    @observable
    navigationMap = new Map<string, NavigationItem>();

    @observable
    selectedPanel: IPanel | undefined;

    load(map: { [stringPath: string]: string }) {
        let navigationMap = new Map<string, NavigationItem>();

        for (let stringPath in map) {
            let navigationObject = ProjectStore.getObjectFromStringPath(stringPath);
            if (navigationObject) {
                let navigationItemStr = map[stringPath];
                if (navigationItemStr === stringPath) {
                    continue;
                }
                let navigationItem: NavigationItem | undefined;
                if (typeof navigationItemStr == "string") {
                    navigationItem = ProjectStore.getObjectFromStringPath(navigationItemStr);
                } else {
                    let navigationObjectAdapter = new TreeObjectAdapter(navigationObject);
                    setTimeout(() => {
                        navigationObjectAdapter.loadState(navigationItemStr);
                    }, 0);
                    navigationItem = navigationObjectAdapter;
                }

                if (navigationItem) {
                    navigationMap.set(navigationObject._id, navigationItem);
                }
            }
        }

        this.navigationMap = navigationMap;
    }

    @computed
    get toJS() {
        let map: any = {};
        for (var [id, navigationItem] of this.navigationMap) {
            let navigationObject = ProjectStore.getObjectFromObjectId(id);
            if (navigationObject) {
                let navigationObjectPath = getObjectPathAsString(navigationObject);
                if (navigationItem instanceof TreeObjectAdapter) {
                    map[navigationObjectPath] = navigationItem.saveState();
                } else {
                    map[navigationObjectPath] = getObjectPathAsString(navigationItem);
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
    get selectedObject(): EezObject | undefined {
        let object: EezObject = ProjectStore.project;
        if (!object) {
            return undefined;
        }

        while (true) {
            let child = this.getNavigationSelectedItem(object);
            if (!child) {
                return object;
            }
            if (child instanceof TreeObjectAdapter) {
                return child.selectedObject;
            }
            object = child;
        }
    }

    getSelection(): EezObject[] | undefined {
        // TODO
        return undefined;
    }

    @action
    setSelection(selection: EezObject[] | undefined) {
        if (!selection || selection.length == 0) {
            return;
        }

        let object = selection[0];

        let iterObject = object;
        let parent = iterObject._parent;
        while (iterObject && parent) {
            if (parent._classInfo.navigationComponent) {
                let grandparent = parent._parent;
                if (!isArray(grandparent)) {
                    let navigationItem = this.getNavigationSelectedItem(parent);
                    if (navigationItem && navigationItem instanceof TreeObjectAdapter) {
                        navigationItem.selectObject(object);
                    } else {
                        this.setNavigationSelectedItem(parent, iterObject);
                    }
                }
            }
            iterObject = parent;
            parent = iterObject._parent;
        }
    }

    isSelected(object: EezObject) {
        let iterObject = object;
        let parent = iterObject._parent;
        while (iterObject && parent) {
            if (parent._classInfo.navigationComponent) {
                let grandparent = parent._parent;
                if (!isArray(grandparent)) {
                    let navigationItem = this.getNavigationSelectedItem(parent);
                    if (navigationItem && navigationItem instanceof TreeObjectAdapter) {
                        if (navigationItem.selectedObject != object) {
                            return false;
                        }
                    } else {
                        if (navigationItem != iterObject) {
                            return false;
                        }
                    }
                }
            }
            iterObject = parent;
            parent = iterObject._parent;
        }

        return true;
    }

    getNavigationSelectedItem(navigationObject: EezObject): NavigationItem | undefined {
        let item = this.navigationMap.get(navigationObject._id);

        if (item && !(item instanceof TreeObjectAdapter)) {
            // is this maybe deleted object?
            item = ProjectStore.getObjectFromObjectId(item._id);
        }

        if (!item) {
            let defaultNavigationKey = navigationObject._classInfo.defaultNavigationKey;
            if (defaultNavigationKey) {
                item = getProperty(navigationObject, defaultNavigationKey);
            }
        }
        return item;
    }

    getNavigationSelectedItemAsObject(navigationObject: EezObject): EezObject | undefined {
        let navigationItem = this.getNavigationSelectedItem(navigationObject);
        if (navigationItem instanceof TreeObjectAdapter) {
            console.error("TreeObjectAdapter is not expected");
            return undefined;
        }
        return navigationItem;
    }

    getNavigationSelectedItemAsObjectAdapter(
        navigationObject: EezObject
    ): TreeObjectAdapter | undefined {
        let navigationItem = this.getNavigationSelectedItem(navigationObject);
        if (navigationItem && !(navigationItem instanceof TreeObjectAdapter)) {
            console.error("TreeObjectAdapter is expected");
            return undefined;
        }
        return navigationItem;
    }

    @action
    setNavigationSelectedItem(navigationObject: EezObject, navigationItem: NavigationItem) {
        this.navigationMap.set(navigationObject._id, navigationItem);
        let parent = navigationObject._parent;
        if (parent) {
            if (!this.getNavigationSelectedItem(parent)) {
                this.setNavigationSelectedItem(parent, navigationObject);
            }
        }
    }

    showObject(objectToShow: EezObject) {
        this.setSelection([objectToShow]);
        for (let object: EezObject | undefined = objectToShow; object; object = object._parent) {
            if (object._classInfo.editorComponent) {
                const editor = EditorsStore.openEditor(object);
                setTimeout(() => {
                    if (editor && editor.state) {
                        editor.state.selectObject(
                            isValue(objectToShow)
                                ? (objectToShow._parent as EezObject)
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
    @observable
    object: EezObject;
    @observable
    active: boolean;
    @observable
    permanent: boolean;
    @observable
    state: IEditorState | undefined;

    @computed
    get id() {
        return this.object._id;
    }

    @computed
    get title() {
        if (isArrayElement(this.object)) {
            return `${this.object._class.name}: ${objectToString(this.object)}`;
        } else {
            return objectToString(this.object);
        }
    }

    @action
    makeActive() {
        EditorsStore.activateEditor(this);
    }

    @action
    makePermanent() {
        this.permanent = true;
    }

    close() {
        EditorsStore.closeEditor(this);
    }
}

class EditorsStoreClass {
    @observable
    editors: Editor[] = [];

    constructor() {
        // open editor when navigation selection has changed
        autorun(() => {
            let object = NavigationStore.selectedObject;
            while (object) {
                let navigationItem = NavigationStore.getNavigationSelectedItem(object);
                while (navigationItem) {
                    if (navigationItem instanceof TreeObjectAdapter) {
                        let object = navigationItem.selectedObject;
                        if (object && !isArray(object) && object._classInfo.editorComponent) {
                            this.openEditor(object);
                        } else if (navigationItem.object._classInfo.editorComponent) {
                            this.openEditor(navigationItem.object);
                        }
                        return;
                    } else {
                        if (!isArray(navigationItem) && navigationItem._classInfo.editorComponent) {
                            this.openEditor(navigationItem);
                        }
                        navigationItem = NavigationStore.getNavigationSelectedItem(navigationItem);
                    }
                }

                object = object._parent;
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
                        object = ProjectStore.getObjectFromPath(editor.object);
                    } else {
                        object = ProjectStore.getObjectFromStringPath(editor.object);
                    }
                    if (object) {
                        let newEditor = new Editor();
                        newEditor.object = object;
                        newEditor.active = editor.active;
                        newEditor.permanent = editor.permanent;
                        const createEditorState = object._classInfo.createEditorState;
                        if (createEditorState) {
                            newEditor.state = createEditorState(object);
                            if (editor.state) {
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
    openEditor(object: EezObject, openAsPermanentEditor: boolean = false) {
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
            nonPermanentEditor = new Editor();
            this.editors.push(nonPermanentEditor);
        }
        nonPermanentEditor.permanent = openAsPermanentEditor;
        nonPermanentEditor.object = object;
        nonPermanentEditor.active = true;
        const createEditorState = object._classInfo.createEditorState;
        if (createEditorState) {
            nonPermanentEditor.state = createEditorState(object);
        } else {
            nonPermanentEditor.state = undefined;
        }

        return nonPermanentEditor;
    }

    @action
    openPermanentEditor(object: EezObject) {
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
    @observable
    navigationVisible: boolean = true;

    @observable
    outputVisible: boolean = true;

    @observable
    propertiesVisible: boolean = true;

    @observable
    debugVisible: boolean = false;

    @action
    load(viewOptions: any) {
        if (viewOptions) {
            this.navigationVisible = viewOptions.navigationVisible;
            this.outputVisible = viewOptions.outputVisible;
            this.propertiesVisible = viewOptions.propertiesVisible;
            this.debugVisible = viewOptions.debugVisible;
        } else {
            this.navigationVisible = true;
            this.outputVisible = true;
            this.propertiesVisible = true;
            this.debugVisible = false;
        }
    }

    @computed
    get toJS() {
        return toJS(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

class UIStateStoreClass {
    @observable
    viewOptions: ViewOptions = new ViewOptions();

    @observable
    selectedBuildConfiguration: string;

    @observable
    features: any;

    @observable
    objects = new Map<string, any>();

    @observable
    savedState: any;

    constructor() {
        autorun(() => {
            this.savedState = this.toJS;
        });

        // react when selected panel or selected message in output window has changed
        reaction(
            () => ({
                message: OutputSectionsStore.activeSection.selectedMessage,
                panel: NavigationStore.selectedPanel
            }),
            arg => {
                if (arg.panel instanceof OutputSection && arg.message && arg.message.object) {
                    NavigationStore.showObject(arg.message.object);
                }
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
        NavigationStore.load(uiState.navigationMap);
        EditorsStore.load(uiState.editors);
        this.selectedBuildConfiguration = uiState.selectedBuildConfiguration || "Default";
        this.features = observable(uiState.features || {});
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
            if (ProjectStore.getObjectFromStringPath(objectPath)) {
                map[objectPath] = value;
            }
        }
        return map;
    }

    @computed
    get toJS() {
        return {
            viewOptions: this.viewOptions.toJS,
            navigationMap: NavigationStore.toJS,
            editors: EditorsStore.toJS,
            selectedBuildConfiguration: this.selectedBuildConfiguration,
            features: this.featuresJS,
            objects: this.objectsJS
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
    getFeatureParam<T>(extensionName: string, paramName: string, defaultValue: T): T {
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

    getObjectUIState(object: EezObject) {
        return this.objects.get(getObjectPathAsString(object));
    }

    updateObjectUIState(object: EezObject, changes: any) {
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
    @observable
    undoStack: IUndoItem[] = [];
    @observable
    redoStack: IUndoItem[] = [];
    @observable
    commands: ICommand[] = [];

    private selectionBeforeFirstCommand: any;
    public combineCommands: boolean = false;

    @action
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    @action
    pushToUndoStack() {
        if (this.commands.length > 0) {
            let selectionAfter = NavigationStore.getSelection();
            this.undoStack.push({
                commands: this.commands,
                selectionBefore: this.selectionBeforeFirstCommand,
                selectionAfter: selectionAfter
            });

            this.commands = [];
            this.selectionBeforeFirstCommand = NavigationStore.getSelection();
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
            this.selectionBeforeFirstCommand = NavigationStore.getSelection();
        } else {
            if (!this.combineCommands) {
                this.pushToUndoStack();
            }
        }

        command.execute();
        this.commands.push(command);

        this.redoStack = [];

        ProjectStore.setModified(true);
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

            NavigationStore.setSelection(undoItem.selectionBefore);

            this.redoStack.push(undoItem);
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

            NavigationStore.setSelection(redoItem.selectionAfter);

            this.undoStack.push(redoItem);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function getUIStateFilePath(projectFilePath: string) {
    return projectFilePath + "-ui-state";
}

class ProjectStoreClass {
    @observable
    private _project: Project | undefined;

    @observable
    filePath: string | undefined;

    @observable
    modified: boolean = false;

    constructor() {
        autorun(() => {
            this.updateProjectWindowState();
        });

        // check the project in the background
        autorun(() => {
            if (this._project) {
                backgroundCheck();
            }
        });
    }

    updateProjectWindowState() {
        let title = "";

        if (this._project) {
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
            undo: (UndoManager && UndoManager.canUndo && UndoManager.undoDescription) || null,
            redo: (UndoManager && UndoManager.canRedo && UndoManager.redoDescription) || null
        });
    }

    @computed
    get isOpen() {
        return this._project != undefined;
    }

    @computed
    get project(): Project {
        return this._project!;
    }

    getObjectFromPath(path: string[]) {
        return getObjectFromPath(this.project, path);
    }

    getObjectFromStringPath(objectID: string) {
        return getObjectFromStringPath(this.project, objectID);
    }

    getObjectFromObjectId(objectID: string) {
        return getObjectFromObjectId(this.project, objectID);
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

    @computed
    get isModified() {
        return this.modified;
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

    @action
    setModified(modified_: boolean) {
        this.modified = modified_;
    }

    updateMruFilePath() {
        ipcRenderer.send("setMruFilePath", this.filePath);
    }

    changeProject(projectFilePath: string | undefined, project?: Project, uiState?: Project) {
        if (project) {
            project.callExtendObservableForAllOptionalProjectFeatures();
        }

        action(() => {
            this.filePath = projectFilePath;
            this._project = project;
        })();

        UIStateStore.load(uiState || {});

        if (this.filePath) {
            this.updateMruFilePath();
        }

        UndoManager.clear();
    }

    doSave(callback: (() => void) | undefined) {
        if (this.filePath) {
            saveProject(this.filePath)
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
            this.updateMruFilePath();
            this.doSave(() => {
                this.saveUIState();
                if (callback) {
                    callback();
                }
            });
        }
    }

    saveToFile(saveAs: boolean, callback: (() => void) | undefined) {
        if (this._project) {
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
        if (!this._project || (!this.filePath && !this.modified)) {
            this.openFile(filePath);
        }
    }

    saveModified(callback: any) {
        this.saveUIState();

        if (this._project && this.modified) {
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

    canSave() {
        return this.modified;
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
        if (this.isOpen) {
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

    addObject(parentObject: EezObject, object: EezObject) {
        return addObject(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            parentObject,
            object
        );
    }

    addObjects(parentObject: EezObject, objects: EezObject[]) {
        return addObjects(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            parentObject,
            objects
        );
    }

    insertObject(parentObject: EezObject, index: number, object: EezObject) {
        return insertObject(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            parentObject,
            index,
            object
        );
    }

    updateObject(object: EezObject, values: any) {
        return updateObject(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            object,
            values
        );
    }

    deleteObject(object: EezObject) {
        return deleteObject(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            object
        );
    }

    deleteObjects(objects: EezObject[]) {
        return deleteObjects(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            objects
        );
    }

    replaceObject(object: EezObject, replaceWithObject: EezObject) {
        return replaceObject(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            object,
            replaceWithObject
        );
    }

    replaceObjects(objects: EezObject[], replaceWithObject: EezObject) {
        return replaceObjects(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            objects,
            replaceWithObject
        );
    }

    insertObjectBefore(object: EezObject, objectToInsert: EezObject) {
        return insertObjectBefore(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            object,
            objectToInsert
        );
    }

    insertObjectAfter(object: EezObject, objectToInsert: EezObject) {
        return insertObjectAfter(
            {
                undoManager: UndoManager,
                selectionManager: NavigationStore
            },
            object,
            objectToInsert
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function extendContextMenu(
    object: EezObject,
    objects: EezObject[],
    menuItems: Electron.MenuItem[]
) {
    if ((object as any).extendContextMenu) {
        return (object as any).extendContextMenu(objects, menuItems);
    }
}

export function canAdd(object: EezObject) {
    return (isArrayElement(object) || isArray(object)) && object._classInfo.newItem != undefined;
}

function canDuplicate(object: EezObject) {
    return isArrayElement(object);
}

function isOptional(object: EezObject) {
    let parent = object._parent;
    if (!parent) {
        return false;
    }

    let property: PropertyInfo | undefined = findPropertyByName(parent, object._key!);

    if (property == undefined) {
        return false;
    }

    return property.isOptional;
}

export function canDelete(object: EezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canCut(object: EezObject) {
    return canCopy(object) && canDelete(object);
}

export function canCopy(object: EezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canContainChildren(object: EezObject) {
    for (const propertyInfo of object._classInfo.properties) {
        if (propertyInfo.type === PropertyType.Array || propertyInfo.type === PropertyType.Object) {
            return true;
        }
    }

    return false;
}

export function canPaste(object: EezObject) {
    try {
        return checkClipboard(object);
    } catch (e) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function addItem(object: EezObject) {
    const parent = isArray(object) ? object : object._parent;
    if (parent) {
        const parentClassInfo = parent._classInfo;
        if (parentClassInfo.newItem) {
            parentClassInfo
                .newItem(parent)
                .then(object => {
                    if (object) {
                        ProjectStore.addObject(parent, object);
                    } else {
                        console.log(`Canceled adding ${parent._class.name}`);
                    }
                })
                .catch(err => notification.error(`Adding ${parent._class.name} failed: ${err}!`));
        }
    }
}

export function pasteItem(object: EezObject) {
    try {
        let c = checkClipboard(object);
        if (c) {
            if (typeof c.pastePlace === "string") {
                ProjectStore.updateObject(object, {
                    [c.pastePlace]: c.serializedData.object
                });
            } else {
                if (c.serializedData.object) {
                    ProjectStore.addObject(c.pastePlace as EezObject, c.serializedData.object);
                } else if (c.serializedData.objects) {
                    ProjectStore.addObjects(c.pastePlace as EezObject, c.serializedData.objects);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

export function deleteItem(object: EezObject) {
    deleteItems([object]);
}

export function cutItem(object: EezObject) {
    let clipboardText = btoa(objectToClipboardData(object));

    deleteItems([object], () => {
        EEZStudio.electron.remote.clipboard.write({
            text: clipboardText
        });
    });
}

export function copyItem(object: EezObject) {
    EEZStudio.electron.remote.clipboard.write({
        text: btoa(objectToClipboardData(object))
    });
}

function duplicateItem(object: EezObject) {
    let parent = object._parent as EezObject;
    let duplicate = cloneObject(parent, object);
    ProjectStore.addObject(parent, duplicate);
}

export function showContextMenu(object: EezObject) {
    let menuItems: Electron.MenuItem[] = [];

    if (canAdd(object)) {
        menuItems.push(
            new MenuItem({
                label: "Add",
                click: () => {
                    addItem(object);
                }
            })
        );
    }

    if (canDuplicate(object)) {
        menuItems.push(
            new MenuItem({
                label: "Duplicate",
                click: () => {
                    duplicateItem(object);
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

    if (canPaste(object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Paste",
                click: () => {
                    pasteItem(object);
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

    extendContextMenu(object, [object], menuItems);

    if (menuItems.length > 0) {
        const menu = new Menu();
        menuItems.forEach(menuItem => menu.append(menuItem));
        menu.popup({});
    }
}

////////////////////////////////////////////////////////////////////////////////

export function deleteItems(objects: EezObject[], callback?: () => void) {
    function doDelete() {
        ProjectStore.deleteObjects(objects);
        if (callback) {
            callback();
        }
    }

    if (objects.length === 1) {
        if (isReferenced(objects[0])) {
            confirm(
                "Are you sure you want to delete this item?",
                "It is used in project.",
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
                "Some of them are used in project.",
                doDelete
            );
        } else {
            doDelete();
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

export const ProjectStore = new ProjectStoreClass();
export const NavigationStore = new NavigationStoreClass();
export const EditorsStore = new EditorsStoreClass();
export const OutputSectionsStore = new OutputSections();
export const UIStateStore = new UIStateStoreClass();
export const UndoManager = new UndoManagerClass();
