import { observable, extendObservable, computed, action, toJS, reaction, autorun } from "mobx";

import { confirmSave } from "eez-studio-shared/util";
import { humanize } from "eez-studio-shared/string";
import { _each, _isArray, _map, _uniqWith } from "eez-studio-shared/algorithm";

import { showGenericDialog, TableField } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";

import {
    EezObject,
    ClassInfo,
    PropertyInfo,
    findClass,
    EezValueObject,
    EezArrayObject,
    PropertyType
} from "project-editor/core/metaData";
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

interface Panel {
    selectedObject: EezObject | undefined;
}

type NavigationItem = EezObject | TreeObjectAdapter;

class NavigationStoreClass {
    @observable
    navigationMap = new Map<string, NavigationItem>();
    @observable
    selectedPanel: Panel | undefined;

    load(map: { [stringPath: string]: string }) {
        let navigationMap = new Map<string, NavigationItem>();

        for (let stringPath in map) {
            let navigationObject = getObjectFromStringPath(stringPath);
            if (navigationObject) {
                let navigationItemStr = map[stringPath];
                if (navigationItemStr === stringPath) {
                    continue;
                }
                let navigationItem: NavigationItem | undefined;
                if (typeof navigationItemStr == "string") {
                    navigationItem = getObjectFromStringPath(navigationItemStr);
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
            let navigationObject = getObjectFromObjectId(id);
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
    setSelectedPanel(selectedPanel: Panel | undefined) {
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
            item = getObjectFromObjectId(item._id);
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

export interface EditorState {
    loadState(state: any): void;
    saveState(): any;
    selectObject(object: EezObject): void;
}

export class Editor {
    @observable
    object: EezObject;
    @observable
    active: boolean;
    @observable
    permanent: boolean;
    @observable
    state: EditorState | undefined;

    @computed
    get id() {
        return this.object._id;
    }

    @computed
    get title() {
        if (isArrayElement(this.object)) {
            return `${this.object.constructor.name}: ${objectToString(this.object)}`;
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
                        object = getObjectFromPath(editor.object);
                    } else {
                        object = getObjectFromStringPath(editor.object);
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
    splitters = new Map<string, number>();
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

    loadSplitters(splitters: any) {
        this.splitters.clear();
        _each(splitters, (value: any, name: any) => {
            this.splitters.set(name, value);
        });
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
        this.loadSplitters(uiState.splitters);
        this.features = observable(uiState.features || {});
        this.loadObjects(uiState.objects);
    }

    @computed
    get splittersJS() {
        let map: any = {};
        for (var [name, value] of this.splitters) {
            map[name] = value;
        }
        return map;
    }

    @computed
    get featuresJS() {
        return toJS(this.features);
    }

    @computed
    get objectsJS() {
        let map: any = {};
        for (var [objectPath, value] of this.objects) {
            if (getObjectFromStringPath(objectPath)) {
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
            splitters: this.splittersJS,
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

interface Command {
    execute(): void;
    undo(): void;
    description: string;
}

interface UndoItem {
    commands: Command[];
    selectionBefore: any;
    selectionAfter: any;
}

export class UndoManagerClass {
    @observable
    undoStack: UndoItem[] = [];
    @observable
    redoStack: UndoItem[] = [];
    @observable
    commands: Command[] = [];

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
    executeCommand(command: Command) {
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

    static getCommandsDescription(commands: Command[]) {
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
        return this._project as Project;
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
}

////////////////////////////////////////////////////////////////////////////////

function getChildId(parent: EezObject | undefined) {
    let id;
    if (parent) {
        if (parent._lastChildId === undefined) {
            parent._lastChildId = 1;
        } else {
            parent._lastChildId++;
        }

        id = parent._id + "." + parent._lastChildId;
    } else {
        id = "1";
    }

    return id;
}

function loadArrayObject(arrayObject: any, parent: any, propertyInfo: PropertyInfo) {
    const eezArray = new EezArrayObject<any>();

    eezArray._id = getChildId(parent);
    eezArray._parent = parent;
    eezArray._key = propertyInfo.name;
    eezArray._propertyInfo = propertyInfo;

    eezArray._array = arrayObject.map((object: any) =>
        loadObject(eezArray, object, propertyInfo.typeClassInfo as ClassInfo)
    );

    return eezArray;
}

export function loadObject(
    parent: EezObject | EezObject[] | undefined,
    jsObjectOrString: any | string,
    classInfo: ClassInfo,
    key?: string
): EezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string" ? JSON.parse(jsObjectOrString) : jsObjectOrString;

    if (Array.isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClassInfo: classInfo
        });
    }

    let object = new (classInfo.getClass(jsObject))();
    classInfo = object._classInfo;

    object._id = getChildId(parent as EezObject);
    object._parent = parent as EezObject;

    let properties = classInfo.properties(jsObject);
    for (let i = 0; i < properties.length; i++) {
        let propertyInfo = properties[i];

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: EezObject | undefined;

            if (value) {
                childObject = loadObject(object, value, propertyInfo.typeClassInfo as ClassInfo);
            } else if (!propertyInfo.isOptional) {
                let typeClassInfo = propertyInfo.typeClassInfo as ClassInfo;
                childObject = loadObject(object, typeClassInfo.defaultValue, typeClassInfo);
            }

            if (childObject) {
                childObject._key = propertyInfo.name;
                object[propertyInfo.name] = childObject;
            }
        } else if (propertyInfo.type === PropertyType.Array) {
            if (!value && !propertyInfo.isOptional) {
                value = [];
            }

            if (value) {
                object[propertyInfo.name] = loadArrayObject(value, object, propertyInfo);
            }
        } else {
            object[propertyInfo.name] = value;
        }
    }

    return object;
}

export function objectToJson(object: EezObject | EezObject[], space?: number) {
    return JSON.stringify(
        toJS(object),
        (key: string | number, value: any) => {
            if (value && typeof value === "object" && "_array" in value) {
                return value.array;
            }
            if (typeof key === "string" && key[0] === "_") {
                return undefined;
            }
            return value;
        },
        space
    );
}

export function objectToJS(object: EezObject | EezObject[]): any {
    return JSON.parse(objectToJson(object));
}

export function cloneObject(parent: EezObject | undefined, obj: EezObject) {
    return loadObject(parent, objectToJson(obj), obj._classInfo);
}

////////////////////////////////////////////////////////////////////////////////

export const EEZ_STUDIO_DATA_TYPE = "text/eez-studio-project-editor-data";

export interface SerializedData {
    objectClassName: string;
    classInfo?: ClassInfo;
    object?: EezObject;
    objects?: EezObject[];
}

export function objectToClipboardData(object: EezObject): string {
    return JSON.stringify({
        objectClassName: object.constructor.name,
        object: objectToJson(object)
    });
}

export function objectsToClipboardData(objects: EezObject[]): string {
    return JSON.stringify({
        objectClassName: objects[0].constructor.name,
        objects: objects.map(object => objectToJson(object))
    });
}

export function clipboardDataToObject(data: string) {
    let serializedData: SerializedData = JSON.parse(data);

    const aClass = findClass(serializedData.objectClassName);
    if (aClass) {
        const classInfo = aClass.classInfo;
        if (serializedData.object) {
            serializedData.object = loadObject(undefined, serializedData.object, classInfo);
        } else if (serializedData.objects) {
            serializedData.objects = serializedData.objects.map(object =>
                loadObject(undefined, object, classInfo)
            );
        }
    }

    return serializedData;
}

let clipboardData: string;

export function setClipboardData(event: any, value: string) {
    clipboardData = value;
    event.dataTransfer.setData(EEZ_STUDIO_DATA_TYPE, clipboardData);
}

export function getEezStudioDataFromDragEvent(event: any) {
    let data = event.dataTransfer.getData(EEZ_STUDIO_DATA_TYPE);
    if (!data) {
        data = clipboardData;
    }
    if (data) {
        return clipboardDataToObject(data);
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export function isEqual(object1: EezObject, object2: EezObject) {
    if (isValue(object1)) {
        if (!isValue(object1)) {
            return false;
        }
        return object1._parent == object2._parent && object1._key == object2._key;
    } else {
        if (isValue(object1)) {
            return false;
        }
        return object1 == object2;
    }
}

export function isValue(object: EezObject | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function isObject(object: EezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isArray(object: EezObject | undefined) {
    return !!object && !isValue(object) && object instanceof EezArrayObject;
}

export function asArray(object: EezObject) {
    return (object as EezArrayObject<EezObject>)._array;
}

export function getChildren(parent: EezObject): EezObject[] {
    if (isArray(parent)) {
        return asArray(parent);
    } else {
        let properties = parent._classInfo
            .properties(parent)
            .filter(
                propertyInfo =>
                    (propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array) &&
                    !(propertyInfo.enumerable !== undefined && !propertyInfo.enumerable) &&
                    getProperty(parent, propertyInfo.name)
            );

        if (properties.length == 1 && properties[0].type === PropertyType.Array) {
            return asArray(getProperty(parent, properties[0].name));
        }

        return properties.map(propertyInfo => getProperty(parent, propertyInfo.name));
    }
}

export function getChildOfObject(
    object: EezObject,
    key: PropertyInfo | string | number
): EezObject | undefined {
    let propertyInfo: PropertyInfo | undefined;

    if (isArray(object)) {
        let elementIndex: number | undefined = undefined;

        if (typeof key == "string") {
            elementIndex = parseInt(key);
        } else if (typeof key == "number") {
            elementIndex = key;
        }

        const array = asArray(object);

        if (elementIndex !== undefined && elementIndex >= 0 && elementIndex < array.length) {
            return array[elementIndex];
        } else {
            console.error("invalid array index");
        }
    } else {
        if (typeof key == "string") {
            propertyInfo = findPropertyByName(object, key);
        } else if (typeof key == "number") {
            console.error("invalid key type");
        } else {
            propertyInfo = key;
        }
    }

    if (propertyInfo) {
        let childObjectOrValue = getProperty(object, propertyInfo.name);
        if (propertyInfo.typeClassInfo) {
            return childObjectOrValue;
        } else {
            return EezValueObject.create(object, propertyInfo, childObjectOrValue);
        }
    }

    return undefined;
}

export function getObjectPropertyAsObject(object: EezObject, propertyInfo: PropertyInfo) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
}

export function getObjectFromObjectId(objectID: string): EezObject | undefined {
    function getDescendantObjectFromId(object: EezObject, id: string): EezObject | undefined {
        if (object._id == id) {
            return object;
        }

        if (isArray(object)) {
            let childObject = asArray(object).find(
                child => id == child._id || id.startsWith(child._id + ".")
            );
            if (childObject) {
                if (childObject._id == id) {
                    return childObject;
                }
                return getDescendantObjectFromId(childObject, id);
            }
        } else {
            let properties = object._classInfo.properties(object);

            for (let i = 0; i < properties.length; i++) {
                let propertyInfo = properties[i];
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let childObject = getChildOfObject(object, propertyInfo);
                    if (childObject) {
                        if (childObject._id == id) {
                            return childObject;
                        }
                        if (id.startsWith(childObject._id + ".")) {
                            return getDescendantObjectFromId(childObject, id);
                        }
                    }
                }
            }
        }

        return undefined;
    }

    return getDescendantObjectFromId(ProjectStore.project, objectID as string);
}

export function getProperty(object: EezObject, name: string) {
    return (object as any)[name];
}

export function check(object: EezObject) {
    if (isArray(object)) {
        const check = object._propertyInfo!.check;
        if (check) {
            return check(object);
        }
    } else {
        if ((object as any).check) {
            return (object as any).check();
        }
    }
    return [];
}

export function extendContextMenu(
    object: EezObject,
    objects: EezObject[],
    menuItems: Electron.MenuItem[]
) {
    if ((object as any).extendContextMenu) {
        return (object as any).extendContextMenu(objects, menuItems);
    }
}

export function hasAncestor(object: EezObject, ancestor: EezObject): boolean {
    if (object == undefined || ancestor == undefined) {
        return false;
    }

    if (object == ancestor) {
        return true;
    }

    let parent = object._parent;
    return !!parent && hasAncestor(parent, ancestor);
}

export function hasProperAncestor(object: EezObject, ancestor: EezObject) {
    if (object == undefined || object == ancestor) {
        return false;
    }

    let parent = object._parent;
    return !!parent && hasAncestor(parent, ancestor);
}

function uniqueTop(objects: EezObject[]): EezObject[] {
    return _uniqWith(
        objects,
        (a: EezObject, b: EezObject) => hasAncestor(a, b) || hasAncestor(b, a)
    );
}

function getParents(objects: EezObject[]): EezObject[] {
    return uniqueTop(objects
        .map(object => object._parent)
        .filter(object => !!object) as EezObject[]);
}

export function reduceUntilCommonParent(objects: EezObject[]): EezObject[] {
    let uniqueTopObjects = uniqueTop(objects);

    let parents = getParents(uniqueTopObjects);

    if (parents.length == 1) {
        return uniqueTopObjects;
    }

    if (parents.length > 1) {
        return reduceUntilCommonParent(parents);
    }

    return [];
}

export function isArrayElement(object: EezObject) {
    return object._parent instanceof EezArrayObject;
}

export function isSameInstanceTypeAs(object1: EezObject, object2: EezObject) {
    if (!object1 || !object2) {
        return false;
    }

    return object1._classInfo === object2._classInfo;
}

export function objectToString(object: EezObject) {
    let label: string;

    if (isValue(object)) {
        label = getProperty(object._parent!, object._key!);
    } else if (isArray(object)) {
        let propertyInfo = findPropertyByName(object._parent!, object._key!);
        label = (propertyInfo && propertyInfo.displayName) || humanize(object._key);
    } else {
        object = object;

        const objectLabel = object._classInfo.label;
        if (objectLabel) {
            label = objectLabel(object);
        } else {
            let name = getProperty(object, "name");
            if (name) {
                label = humanize(name);
            }

            label = object._id;
        }
    }

    if (
        object &&
        object._parent &&
        object._parent instanceof EezArrayObject &&
        object._parent!._parent &&
        object._parent!._key
    ) {
        let propertyInfo = findPropertyByName(object._parent!._parent!, object._parent!._key!);
        if (propertyInfo && propertyInfo.childLabel) {
            label = propertyInfo.childLabel(object, label);
        }
    }

    return label;
}

export function getAncestorOfType(object: EezObject, classInfo: ClassInfo): EezObject | undefined {
    if (object) {
        if (object._classInfo === classInfo) {
            return object;
        }
        return object._parent && getAncestorOfType(object._parent!, classInfo);
    }
    return undefined;
}

export function getObjectPath(object: EezObject): (string | number)[] {
    let parent = object._parent;
    if (parent) {
        if (isArrayElement(object)) {
            return getObjectPath(parent).concat(asArray(parent).indexOf(object as EezObject));
        } else {
            return getObjectPath(parent).concat(object._key as string);
        }
    }
    return [];
}

export function getObjectFromPath(path: string[]) {
    let object: EezObject = ProjectStore.project;

    for (let i = 0; i < path.length && object; i++) {
        object = getChildOfObject(object, path[i]) as EezObject;
    }

    return object;
}

export function getObjectPathAsString(object: EezObject) {
    return "/" + getObjectPath(object).join("/");
}

export function getObjectFromStringPath(stringPath: string) {
    if (stringPath == "/") {
        return ProjectStore.project;
    }
    return getObjectFromPath(stringPath.split("/").slice(1));
}

export function getAncestors(
    object: EezObject,
    ancestor?: EezObject,
    showSingleArrayChild?: boolean
): EezObject[] {
    if (!ancestor) {
        ancestor = ProjectStore.project;
    }

    if (isValue(object)) {
        object = object._parent as EezObject;
    }

    if (isArray(ancestor)) {
        let possibleAncestor = asArray(ancestor).find(
            possibleAncestor =>
                object == possibleAncestor || object._id.startsWith(possibleAncestor._id + ".")
        );
        if (possibleAncestor) {
            if (possibleAncestor == object) {
                if (showSingleArrayChild) {
                    return [ancestor, object];
                } else {
                    return [object];
                }
            } else {
                if (showSingleArrayChild) {
                    return [ancestor as EezObject].concat(getAncestors(object, possibleAncestor));
                } else {
                    return getAncestors(object, possibleAncestor);
                }
            }
        }
    } else {
        let properties = ancestor._classInfo.properties(ancestor);

        let numObjectOrArrayProperties = 0;
        for (let i = 0; i < properties.length; i++) {
            let propertyInfo = properties[i];
            if (
                propertyInfo.type === PropertyType.Object ||
                propertyInfo.type === PropertyType.Array
            ) {
                numObjectOrArrayProperties++;
            }
        }

        if (numObjectOrArrayProperties > 0) {
            for (let i = 0; i < properties.length; i++) {
                let propertyInfo = properties[i];
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let possibleAncestor: EezObject = (ancestor as any)[propertyInfo.name];

                    if (possibleAncestor === object) {
                        return [];
                    }

                    if (possibleAncestor && object._id.startsWith(possibleAncestor._id + ".")) {
                        return [ancestor].concat(
                            getAncestors(object, possibleAncestor, numObjectOrArrayProperties > 1)
                        );
                    }
                }
            }
        }
    }
    return [];
}

export function getHumanReadableObjectPath(object: EezObject) {
    let ancestors = getAncestors(object);
    return ancestors
        .slice(1)
        .map(object => objectToString(object))
        .join(" / ");
}

export function getObjectPropertiesInfo(object: EezObject) {
    return object._classInfo.properties(object);
}

export function getInheritedValue(object: EezObject, propertyName: string) {
    const getInheritedValue = object._classInfo.getInheritedValue;
    if (getInheritedValue) {
        return getInheritedValue(object, propertyName);
    }
    return undefined;
}

export function getPropertyAsString(object: EezObject, propertyInfo: PropertyInfo) {
    let value = getProperty(object, propertyInfo.name);
    if (value) {
        if (value instanceof EezObject) {
            return objectToString(value);
        }
        return value.toString();
    }
}

export function isObjectExists(object: EezObject) {
    let parent = object._parent;
    if (parent) {
        if (isArray(parent)) {
            if (asArray(parent).indexOf(object) === -1) {
                return false;
            }
        } else {
            const key = object._key;
            if (key && (parent as any)[key] !== object) {
                return false;
            }
        }
    }
    return true;
}

export function canAdd(object: EezObject) {
    return (isArrayElement(object) || isArray(object)) && object._classInfo.newItem != undefined;
}

export function canDuplicate(object: EezObject) {
    return isArrayElement(object);
}

export function getProperties(object: EezObject) {
    return object._classInfo.properties(object);
}

export function findPropertyByName(object: EezObject, propertyName: string) {
    return getProperties(object).find(propertyInfo => propertyInfo.name == propertyName);
}

export function humanizePropertyName(object: EezObject, propertyName: string) {
    const property = findPropertyByName(object, propertyName);
    if (property && property.displayName) {
        return property.displayName;
    }
    return humanize(propertyName);
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
    let properties = getProperties(object);

    for (let i = 0; i < properties.length; i++) {
        let propertyInfo = properties[i];
        if (propertyInfo.type === PropertyType.Array || propertyInfo.type === PropertyType.Object) {
            return true;
        }
    }

    return false;
}

export function findPastePlaceInside(
    object: EezObject,
    classInfo: ClassInfo,
    isSingleObject: boolean
) {
    if (isArray(object) && object._classInfo === classInfo) {
        return object;
    }

    if (isObject(object)) {
        const findPastePlaceInside = object._classInfo.findPastePlaceInside;
        if (findPastePlaceInside) {
            return findPastePlaceInside(object, classInfo, isSingleObject);
        }
    }

    let properties = getProperties(object);

    // first, find among array properties
    for (let i = 0; i < properties.length; i++) {
        let propertyInfo = properties[i];
        if (propertyInfo.type === PropertyType.Array && propertyInfo.typeClassInfo === classInfo) {
            let collectionObject = getChildOfObject(object, propertyInfo);
            if (collectionObject) {
                return collectionObject;
            }
        }
    }

    // then, find among object properties
    for (let i = 0; i < properties.length; i++) {
        let propertyInfo = properties[i];
        if (
            propertyInfo.type == PropertyType.Object &&
            propertyInfo.typeClassInfo == classInfo &&
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

function findPastePlaceInsideAndOutside(object: EezObject, serializedData: SerializedData) {
    if (!serializedData.classInfo) {
        return undefined;
    }

    let place = findPastePlaceInside(object, serializedData.classInfo, !!serializedData.object);
    if (place) {
        return place;
    }

    let parent = object._parent;
    return (
        parent && findPastePlaceInside(parent, serializedData.classInfo, !!serializedData.object)
    );
}

export function checkClipboard(object: EezObject) {
    let text = EEZStudio.electron.remote.clipboard.readText();
    if (text) {
        let serializedData = clipboardDataToObject(atob(text));
        if (serializedData) {
            let pastePlace = findPastePlaceInsideAndOutside(object, serializedData);
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

export function canPaste(object: EezObject) {
    try {
        return checkClipboard(object);
    } catch (e) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

function getUniquePropertyValue(existingObjects: EezObject[], key: string, value: string) {
    while (true) {
        if (!existingObjects.find(object => getProperty(object, key) == value)) {
            return value;
        }

        var groups = value.match(/(.+) \((\d+)\)/);
        if (groups) {
            value = groups[1] + " (" + (parseInt(groups[2]) + 1) + ")";
        } else {
            value += " (1)";
        }
    }
}

// ensure that unique properties are unique inside parent
function ensureUniqueProperties(parentObject: EezObject, objects: EezObject[]) {
    let existingObjects = asArray(parentObject).map((object: EezObject) => object);
    objects.forEach(object => {
        for (let propertyInfo of object._classInfo.properties(object)) {
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

function onObjectModified(object: EezObject) {
    object._modificationTime = new Date().getTime();
    if (object._parent) {
        onObjectModified(object._parent);
    }
}

////////////////////////////////////////////////////////////////////////////////

export let addObject = action((parentObject: EezObject, object: EezObject) => {
    object = loadObject(parentObject, object, parentObject._classInfo);
    ensureUniqueProperties(parentObject, [object]);

    UndoManager.executeCommand({
        execute: action(() => {
            asArray(parentObject).push(object);
            onObjectModified(parentObject);
        }),

        undo: action(() => {
            asArray(parentObject).pop();
        }),

        get description() {
            return "Added: " + getHumanReadableObjectPath(object);
        }
    });

    NavigationStore.setSelection([object]);

    return object;
});

export let addObjects = action((parentObject: EezObject, objects: EezObject[]) => {
    objects = objects.map(object => loadObject(parentObject, object, parentObject._classInfo));
    ensureUniqueProperties(parentObject, objects);

    UndoManager.executeCommand({
        execute: action(() => {
            asArray(parentObject).push.apply(parentObject, objects);
            onObjectModified(parentObject);
        }),

        undo: action(() => {
            for (let i = 0; i < objects.length; i++) {
                asArray(parentObject).pop();
            }
            onObjectModified(parentObject);
        }),

        get description() {
            return "Added: " + objects.map(object => getHumanReadableObjectPath(object)).join(", ");
        }
    });

    NavigationStore.setSelection(objects);
});

export let insertObject = action((parentObject: EezObject, index: number, object: EezObject) => {
    object = loadObject(parentObject, object, parentObject._classInfo);
    ensureUniqueProperties(parentObject, [object]);

    UndoManager.executeCommand({
        execute: action(() => {
            asArray(parentObject).splice(index, 0, object);
            onObjectModified(parentObject);
        }),

        undo: action(() => {
            asArray(parentObject).splice(index, 1);
            onObjectModified(parentObject);
        }),

        get description() {
            return "Inserted: " + getHumanReadableObjectPath(object);
        }
    });

    NavigationStore.setSelection([object]);
});

class UpdateCommand implements Command {
    private oldValues: any = {};
    private newValues: any = {};

    constructor(public object: EezObject, private values: any, lastCommand?: UpdateCommand) {
        if (lastCommand) {
            this.oldValues = lastCommand.oldValues;
        }

        for (let propertyName in values) {
            let propertyInfo = findPropertyByName(object, propertyName);
            if (propertyInfo) {
                if (!lastCommand) {
                    this.oldValues[propertyName] = getProperty(object, propertyName);
                }

                let value = values[propertyName];

                if (propertyInfo.type == PropertyType.Number) {
                    if (value !== undefined) {
                        this.newValues[propertyName] = +value;
                    } else {
                        this.newValues[propertyName] = undefined;
                    }
                } else {
                    this.newValues[propertyName] = values[propertyName];
                }
            }
        }
    }

    static assignValues(dest: any, src: any) {
        for (let propertyName in src) {
            dest[propertyName] = src[propertyName];
        }
    }

    @action
    execute() {
        UpdateCommand.assignValues(this.object, this.newValues);
        onObjectModified(this.object);
    }

    @action
    undo() {
        UpdateCommand.assignValues(this.object, this.oldValues);
        onObjectModified(this.object);
    }

    @computed
    get description() {
        return (
            `Changed (${_map(this.values, (value, name) => humanize(name)).join(", ")}): ` +
            getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((object: EezObject, values: any) => {
    let previousCommand;

    if (UndoManager.combineCommands && UndoManager.commands.length > 0) {
        let command = UndoManager.commands[UndoManager.commands.length - 1];
        if (command instanceof UpdateCommand && command.object == object) {
            // merge with previous command
            UndoManager.commands.pop();
            previousCommand = command;
        }
    }

    UndoManager.executeCommand(new UpdateCommand(object, values, previousCommand));
});

export let deleteObject = action((object: any) => {
    if (isArrayElement(object)) {
        const parent = object._parent!;
        const array = asArray(parent);
        const index = array.indexOf(object);

        UndoManager.executeCommand({
            execute: action(() => {
                array.splice(index, 1);
                onObjectModified(parent);
            }),

            undo: action(() => {
                array.splice(index, 0, object);
                onObjectModified(parent);
            }),

            get description() {
                return "Deleted: " + getHumanReadableObjectPath(object);
            }
        });

        if (array.length > 0) {
            if (index == array.length) {
                NavigationStore.setSelection([array[index - 1]]);
            } else {
                NavigationStore.setSelection([array[index]]);
            }
        } else {
            NavigationStore.setSelection([parent]);
        }
    } else {
        updateObject(object, {
            [object._key as string]: undefined
        });
    }
});

export let deleteObjects = action((objects: EezObject[]) => {
    let undoIndexes: number[];

    UndoManager.executeCommand({
        execute: action(() => {
            undoIndexes = [];
            for (let i = 0; i < objects.length; i++) {
                let object = objects[i];
                let parent = object._parent!;

                if (isArrayElement(object)) {
                    const array = asArray(parent!);
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                } else {
                    undoIndexes.push(-1);
                    (parent as any)[object._key as string] = undefined;
                }

                onObjectModified(parent);
            }
        }),

        undo: action(() => {
            for (let i = objects.length - 1; i >= 0; i--) {
                let object = objects[i];
                let parent = object._parent!;
                if (isArrayElement(object)) {
                    const array = asArray(parent);
                    let index = undoIndexes[i];
                    array.splice(index, 0, object);
                } else {
                    (parent as any)[object._key as string] = object;
                }
                onObjectModified(parent);
            }
        }),

        get description() {
            return (
                "Deleted: " + objects.map(object => getHumanReadableObjectPath(object)).join(", ")
            );
        }
    });
});

export let replaceObject = action((object: EezObject, replaceWithObject: EezObject) => {
    replaceWithObject._id = object._id;
    replaceWithObject._key = object._key;
    replaceWithObject._parent = object._parent;

    let parent = object._parent!;
    if (isArrayElement(object)) {
        const array = asArray(parent);

        let index = array.indexOf(object);

        UndoManager.executeCommand({
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

        NavigationStore.setSelection([replaceWithObject]);
    } else {
        updateObject(parent as any, {
            [object._key!]: replaceWithObject
        });
    }
});

export let replaceObjects = action((objects: EezObject[], replaceWithObject: EezObject) => {
    const parent = objects[0]._parent;
    const array = asArray(parent!);
    const index = array.indexOf(objects[0]);

    replaceWithObject._id = objects[0]._id;
    replaceWithObject._key = objects[0]._key;
    replaceWithObject._parent = parent;

    let undoIndexes: number[];

    UndoManager.executeCommand({
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
                "Replaced: " + objects.map(object => getHumanReadableObjectPath(object)).join(", ")
            );
        }
    });

    NavigationStore.setSelection([replaceWithObject]);
});

////////////////////////////////////////////////////////////////////////////////

export function insertObjectBefore(object: EezObject, objectToInsert: EezObject) {
    const parent = object._parent!;
    const array = asArray(parent);
    const index = array.indexOf(object);
    insertObject(parent, index, objectToInsert);
}

export function insertObjectAfter(object: EezObject, objectToInsert: EezObject) {
    const parent = object._parent!;
    const array = asArray(parent);
    const index = array.indexOf(object);
    insertObject(parent, index + 1, objectToInsert);
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
                        addObject(parent, object);
                    } else {
                        console.log(`Canceled adding ${parent.constructor.name}`);
                    }
                })
                .catch(err =>
                    notification.error(`Adding ${parent.constructor.name} failed: ${err}!`)
                );
        }
    }
}

export function pasteItem(object: EezObject) {
    try {
        let c = checkClipboard(object);
        if (c) {
            if (typeof c.pastePlace === "string") {
                updateObject(object, {
                    [c.pastePlace]: c.serializedData.object
                });
            } else {
                if (c.serializedData.object) {
                    addObject(c.pastePlace as EezObject, c.serializedData.object);
                } else if (c.serializedData.objects) {
                    addObjects(c.pastePlace as EezObject, c.serializedData.objects);
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
    addObject(parent, duplicate);
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
        deleteObjects(objects);
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

export let ProjectStore = new ProjectStoreClass();
export let NavigationStore = new NavigationStoreClass();
export let EditorsStore = new EditorsStoreClass();
export let OutputSectionsStore = new OutputSections();
export let UIStateStore = new UIStateStoreClass();
export let UndoManager = new UndoManagerClass();

(<any>window).EezStudio = {
    NavigationStore,
    EditorsStore,
    OutputSectionsStore,
    UIStateStore,
    UndoManager,
    ProjectStore
};
