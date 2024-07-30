import { dialog, getCurrentWindow } from "@electron/remote";
import fs from "fs";
import path from "path";
import React from "react";
import {
    action,
    computed,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import classNames from "classnames";
import Database from "better-sqlite3";
import { confirm } from "eez-studio-ui/dialog-electron";

import { getUserDataPath } from "eez-studio-shared/util-electron";
import { guid } from "eez-studio-shared/guid";

import { showDialog } from "eez-studio-ui/dialog";
import {
    copyObjects,
    getAllObjects,
    pasteWithDependencies
} from "./paste-with-dependencies";
import { getJSON, loadProject, ProjectStore } from "project-editor/store";
import { IconAction } from "eez-studio-ui/action";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import type { Project } from "project-editor/project/project";
import { Icon } from "eez-studio-ui/icon";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { SCRAPBOOK_ITEM_FILE_PREFIX } from "project-editor/core/util";
import { HOME_TAB_OPEN_ICON } from "project-editor/ui-components/icons";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { stringCompare } from "eez-studio-shared/string";
import { layoutModels } from "eez-studio-ui/side-dock";
import { ProjectEditorTab, tabs } from "home/tabs-store";

////////////////////////////////////////////////////////////////////////////////

const DEFAULT_SCRAPBOOK_FILE_PATH = getUserDataPath(
    `scrapbooks${path.sep}default.eez-scrapbook`
);

console.log(DEFAULT_SCRAPBOOK_FILE_PATH);

const DB_VERSION = 1;

////////////////////////////////////////////////////////////////////////////////

export class ScrapbookItem {
    id: string;
    name: string;
    description: string;
    eezProject: string;

    constructor() {
        makeObservable(this, {
            name: observable,
            description: observable,
            eezProject: observable,
            allObjects: computed
        });
    }

    get allObjects() {
        return getAllObjects(JSON.parse(this.eezProject) as Project);
    }
}

////////////////////////////////////////////////////////////////////////////////

class ScrapbookProject {
    items: ScrapbookItem[] = [];

    constructor() {
        makeObservable(this, {
            items: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ICommand {
    execute(): void;
    undo(): void;
    description: string;
}

interface IUndoItem {
    commands: ICommand[];
}

class ScrapbookUndoManager {
    undoStack: IUndoItem[] = [];
    redoStack: IUndoItem[] = [];
    commands: ICommand[] = [];

    combineCommands: boolean = false;

    constructor() {
        makeObservable(this, {
            undoStack: observable,
            redoStack: observable,
            commands: observable,
            clear: action,
            pushToUndoStack: action,
            setCombineCommands: action,
            executeCommand: action,
            canUndo: computed,
            undoDescription: computed,
            undo: action,
            canRedo: computed,
            redoDescription: computed,
            redo: action
        });
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    pushToUndoStack() {
        if (this.commands.length > 0) {
            this.undoStack.push({
                commands: this.commands
            });

            this.commands = [];
        }
    }

    setCombineCommands(value: boolean) {
        this.pushToUndoStack();
        this.combineCommands = value;
    }

    executeCommand(command: ICommand) {
        if (this.commands.length == 0) {
        } else {
            if (!this.combineCommands) {
                this.pushToUndoStack();
            }
        }

        command.execute();

        this.commands.push(command);

        this.redoStack = [];
    }

    static getCommandsDescription(commands: ICommand[]) {
        return commands[commands.length - 1].description;
    }

    get canUndo() {
        return this.undoStack.length > 0 || this.commands.length > 0;
    }

    get undoDescription() {
        let commands;
        if (this.commands.length > 0) {
            commands = this.commands;
        } else if (this.undoStack.length > 0) {
            commands = this.undoStack[this.undoStack.length - 1].commands;
        }
        if (commands) {
            return ScrapbookUndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    undo() {
        this.pushToUndoStack();

        let undoItem = this.undoStack.pop();
        if (undoItem) {
            for (let i = undoItem.commands.length - 1; i >= 0; i--) {
                undoItem.commands[i].undo();
            }

            this.redoStack.push(undoItem);
        }
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    get redoDescription() {
        let commands;
        if (this.redoStack.length > 0) {
            commands = this.redoStack[this.redoStack.length - 1].commands;
        }
        if (commands) {
            return ScrapbookUndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    redo() {
        let redoItem = this.redoStack.pop();
        if (redoItem) {
            for (let i = 0; i < redoItem.commands.length; i++) {
                redoItem.commands[i].execute();
            }

            this.undoStack.push(redoItem);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class ScrapbookStore {
    db: Database.Database;
    filePath: string;
    project: ScrapbookProject = new ScrapbookProject();

    selectedItem: ScrapbookItem | undefined;

    undoManager = new ScrapbookUndoManager();

    constructor() {
        makeObservable(this, {
            selectedItem: observable
        });
    }

    async load(filePath: string) {
        let db = new Database(filePath);
        db.defaultSafeIntegers();

        let dbItems: any;
        try {
            dbItems = db
                .prepare(
                    `SELECT id, name, description, eez_project FROM items${DB_VERSION}`
                )
                .all();
        } catch (err) {
            db.exec(`CREATE TABLE items${DB_VERSION}(
                    id TEXT PRIMARY KEY NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    description TEXT,
                    eez_project TEXT NOT NULL);`);
            dbItems = [];
        }

        this.undoManager.clear();

        runInAction(() => {
            this.project.items = [];
            this.selectedItem = undefined;
        });

        for (const dbItem of dbItems) {
            const item = new ScrapbookItem();

            item.id = dbItem.id;
            item.name = dbItem.name;
            item.description = dbItem.description;
            item.eezProject = dbItem.eez_project;

            runInAction(() => {
                this.project.items.push(item);
                if (!this.selectedItem) {
                    this.selectedItem = item;
                }
            });
        }

        this.db = db;
        this.filePath = filePath;
    }

    addNewItem(item: ScrapbookItem) {
        let index = this.project.items.length;
        let selectedItem = this.selectedItem;

        this.undoManager.executeCommand({
            execute: () => {
                this.db
                    .prepare(
                        `INSERT INTO items${DB_VERSION}(id, name, description, eez_project) VALUES(?, ?, ?, ?)`
                    )
                    .run(item.id, item.name, item.description, item.eezProject);

                this.project.items.push(item);
                this.selectedItem = item;
            },
            undo: () => {
                this.db
                    .prepare(`DELETE FROM items${DB_VERSION} WHERE id = ?`)
                    .run(item.id);

                this.project.items.splice(index, 1);
                this.selectedItem = selectedItem;
            },
            description: "Add new item"
        });
    }

    deleteItem(item: ScrapbookItem) {
        let index = this.project.items.findIndex(item1 => item1 == item);
        let selectedItem = this.selectedItem;

        this.undoManager.executeCommand({
            execute: () => {
                this.db
                    .prepare(`DELETE FROM items${DB_VERSION} WHERE id = ?`)
                    .run(item.id);

                this.project.items.splice(index, 1);
                if (selectedItem == item) {
                    this.selectedItem = undefined;
                }
            },
            undo: () => {
                this.db
                    .prepare(
                        `INSERT INTO items${DB_VERSION}(id, name, description, eez_project) VALUES(?, ?, ?, ?)`
                    )
                    .run(item.id, item.name, item.description, item.eezProject);

                this.project.items.splice(index, 0, item);
                if (selectedItem == item) {
                    this.selectedItem = item;
                }
            },
            description: "Add new item"
        });
    }

    setItemName(item: ScrapbookItem, newName: string) {
        const oldName = item.name;

        this.undoManager.executeCommand({
            execute: () => {
                this.db
                    .prepare(
                        `UPDATE items${DB_VERSION} SET name = ? WHERE id = ?`
                    )
                    .run(newName, item.id);

                item.name = newName;
            },
            undo: () => {
                this.db
                    .prepare(
                        `UPDATE items${DB_VERSION} SET name = ? WHERE id = ?`
                    )
                    .run(oldName, item.id);

                item.name = oldName;
            },
            description: "Change name"
        });
    }

    setItemDescription(item: ScrapbookItem, newDescription: string) {
        const oldDescription = item.description;

        this.undoManager.executeCommand({
            execute: () => {
                this.db
                    .prepare(
                        `UPDATE items${DB_VERSION} SET description = ? WHERE id = ?`
                    )
                    .run(newDescription, item.id);

                item.description = newDescription;
            },
            undo: () => {
                this.db
                    .prepare(
                        `UPDATE items${DB_VERSION} SET description = ? WHERE id = ?`
                    )
                    .run(oldDescription, item.id);

                item.description = oldDescription;
            },
            description: "Change description"
        });
    }

    setItemEezProject(item: ScrapbookItem, newEezProject: string) {
        const oldnewEezProject = item.description;

        this.undoManager.executeCommand({
            execute: () => {
                this.db
                    .prepare(
                        `UPDATE items${DB_VERSION} SET eez_project = ? WHERE id = ?`
                    )
                    .run(newEezProject, item.id);

                item.eezProject = newEezProject;
            },
            undo: () => {
                this.db
                    .prepare(
                        `UPDATE items${DB_VERSION} SET eez_project = ? WHERE id = ?`
                    )
                    .run(oldnewEezProject, item.id);

                item.eezProject = oldnewEezProject;
            },
            description: "Change eez-project"
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

class ScrapbookManagerModel {
    files: string[];
    selectedFile: string;

    store: ScrapbookStore = new ScrapbookStore();

    modalDialog: any;

    constructor() {
        let confJSONStr = window.localStorage.getItem("ScrapbookManagerConf");
        let conf: {
            files?: string[];
            selectedFile?: string;
        };
        if (confJSONStr) {
            conf = JSON.parse(confJSONStr);
        } else {
            conf = {
                files: []
            };
        }

        if (!conf.files) {
            conf.files = [];
        }

        this.files = conf.files.filter(filePath => fs.existsSync(filePath));
        if (
            conf.selectedFile &&
            this.files.find(filePath => filePath == conf.selectedFile)
        ) {
            this.openScrapbookFile(conf.selectedFile);
        } else {
            this.openScrapbookFile(DEFAULT_SCRAPBOOK_FILE_PATH);
        }

        makeObservable(this, {
            files: observable,
            selectedFile: observable
        });
    }

    get destinationProjectStore() {
        if (tabs.activeTab instanceof ProjectEditorTab) {
            return tabs.activeTab.projectStore;
        }
        return undefined;
    }

    save() {
        window.localStorage.setItem(
            "ScrapbookManagerConf",
            JSON.stringify({
                files: this.files,
                selectedFile: this.selectedFile
            })
        );
    }

    async createNewScrapbookFile() {
        const result = await showGenericDialog({
            dialogDefinition: {
                title: "New Scrapbook File",
                fields: [
                    {
                        name: "name",
                        displayName: "Scrabook file name",
                        type: "string",
                        validators: [
                            validators.required,
                            function (object: any, ruleName: string) {
                                const value = object[ruleName];
                                if (value == undefined) {
                                    return null;
                                }
                                if (
                                    model.files.find(
                                        filePath =>
                                            path.parse(filePath).name == value
                                    )
                                ) {
                                    return "Scrapbook file with the same name already exists";
                                }
                                return null;
                            }
                        ]
                    }
                ]
            },
            values: {
                name: ""
            }
        });

        this.openScrapbookFile(
            getUserDataPath(
                `scrapbooks${path.sep}${result.values.name}.eez-scrapbook`
            )
        );
    }

    async selectScrapbookFile() {
        const result = await dialog.showOpenDialog(getCurrentWindow(), {
            properties: ["openFile"],
            filters: [
                {
                    name: "EEZ Scrapbook files",
                    extensions: ["eez-scrapbook"]
                },
                { name: "All Files", extensions: ["*"] }
            ]
        });
        const filePaths = result.filePaths;
        if (filePaths && filePaths[0]) {
            this.openScrapbookFile(filePaths[0]);
        }
    }

    async openScrapbookFile(filePath: string) {
        console.log(filePath);

        await this.store.load(filePath);

        if (
            !this.files.find(existingFilePath => existingFilePath == filePath)
        ) {
            runInAction(() => {
                this.files.push(filePath);
            });
        }

        runInAction(() => {
            this.selectedFile = filePath;
        });

        this.save();
    }

    deleteScrapbookFile(filePath: string) {
        confirm("Are you sure?", undefined, () => {
            this.files = this.files.filter(
                existingFilePath => existingFilePath != filePath
            );
            if (this.selectedFile == filePath) {
                this.openScrapbookFile(DEFAULT_SCRAPBOOK_FILE_PATH);
            }
        });
    }

    pasteIntoNewItem(projectStore: ProjectStore) {
        pasteWithDependencies(
            projectStore,
            (destinationProjectStore: ProjectStore) => {
                const item = new ScrapbookItem();

                item.id = guid();
                item.name =
                    "From paste " + (this.store.project.items.length + 1);
                item.description = "";
                item.eezProject = getJSON(destinationProjectStore);

                this.store.addNewItem(item);
            }
        );
    }

    insertItemIntoProject(
        item: ScrapbookItem,
        destinationProjectStore: ProjectStore
    ) {
        const projectStore = ProjectStore.create({
            type: "project-editor"
        });

        const project = loadProject(projectStore, item.eezProject, false);

        projectStore.setProject(project, SCRAPBOOK_ITEM_FILE_PREFIX + item.id);

        copyObjects(
            projectStore,
            getAllObjects(project).map(object => object.object),
            destinationProjectStore
        );
    }

    openItemProject(item: ScrapbookItem) {
        const homeTabs = ProjectEditor.homeTabs;
        if (!homeTabs) {
            return;
        }

        const tabId = `${SCRAPBOOK_ITEM_FILE_PREFIX}${item.id}`;

        let projectTab = homeTabs.findProjectEditorTab(tabId, false);
        if (!projectTab) {
            projectTab = ProjectEditor.homeTabs!.addProjectTab(
                `${SCRAPBOOK_ITEM_FILE_PREFIX}${item.id}`,
                false
            );
        }

        homeTabs.makeActive(projectTab);
    }
}

const model = new ScrapbookManagerModel();

////////////////////////////////////////////////////////////////////////////////

const Items = observer(
    class Items extends React.Component {
        render() {
            return (
                <div className="EezStudio_ProjectEditorScrapbook_Items">
                    <div className="EezStudio_ProjectEditorScrapbook_Items_Toolbar">
                        <div>Items</div>
                        <div>
                            <IconAction
                                title="Paste"
                                icon="material:content_paste"
                                iconSize={22}
                                onClick={() => {
                                    if (model.destinationProjectStore) {
                                        model.pasteIntoNewItem(
                                            model.destinationProjectStore
                                        );
                                    }
                                }}
                                enabled={
                                    model.destinationProjectStore &&
                                    model.destinationProjectStore.canPaste
                                }
                            />
                            <IconAction
                                icon="material:delete"
                                onClick={() => {
                                    if (model.store.selectedItem) {
                                        model.store.deleteItem(
                                            model.store.selectedItem
                                        );
                                    }
                                }}
                                title="Delete this item"
                                enabled={model.store.selectedItem != undefined}
                            />
                        </div>
                    </div>
                    <div className="EezStudio_ProjectEditorScrapbook_Items_Body">
                        {model.store.project.items.map(item => (
                            <div
                                key={item.id}
                                className={classNames(
                                    "EezStudio_ProjectEditorScrapbook_Item",
                                    {
                                        selected:
                                            model.store.selectedItem == item
                                    }
                                )}
                                onClick={() => {
                                    runInAction(() => {
                                        model.store.selectedItem = item;
                                    });
                                }}
                            >
                                {item.name}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ItemDetails = observer(
    class ItemDetails extends React.Component {
        render() {
            const item = model.store.selectedItem;

            if (!item) {
                return null;
            }

            return (
                <div className="EezStudio_ProjectEditorScrapbook_ItemDetails">
                    <div className="EezStudio_ProjectEditorScrapbook_ItemDetails_Toolbar">
                        <div></div>
                        <div>
                            <button
                                className="btn btn-lg btn-primary"
                                onClick={() => {
                                    if (model.destinationProjectStore) {
                                        model.insertItemIntoProject(
                                            item,
                                            model.destinationProjectStore
                                        );
                                    }
                                }}
                                disabled={
                                    model.destinationProjectStore == undefined
                                }
                            >
                                Insert into Active Project
                            </button>
                            <button
                                className="btn btn-lg btn-secondary ms-2"
                                onClick={() => {
                                    model.openItemProject(item);
                                }}
                            >
                                Open in Project Editor
                            </button>
                        </div>
                        <div></div>
                    </div>
                    <div className="EezStudio_ProjectEditorScrapbook_ItemDetails_Body">
                        <form>
                            <div className="mb-3">
                                <label
                                    htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Name"
                                    className="form-label"
                                >
                                    Name:
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="EezStudio_ProjectEditorScrapbook_ItemDetails_Name"
                                    value={item.name}
                                    onChange={event => {
                                        model.store.setItemName(
                                            item,
                                            event.target.value
                                        );
                                    }}
                                    onFocus={() =>
                                        model.store.undoManager.setCombineCommands(
                                            true
                                        )
                                    }
                                    onBlur={() =>
                                        model.store.undoManager.setCombineCommands(
                                            false
                                        )
                                    }
                                />
                            </div>

                            <div className="mb-3">
                                <label
                                    htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                                    className="form-label"
                                >
                                    Description:
                                </label>
                                <textarea
                                    className="form-control"
                                    id="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                                    rows={3}
                                    value={item.description}
                                    onChange={event => {
                                        model.store.setItemDescription(
                                            item,
                                            event.target.value
                                        );
                                    }}
                                    onFocus={() =>
                                        model.store.undoManager.setCombineCommands(
                                            true
                                        )
                                    }
                                    onBlur={() =>
                                        model.store.undoManager.setCombineCommands(
                                            false
                                        )
                                    }
                                ></textarea>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    Resources in this scrapbook item:
                                </label>
                                <div className="EezStudio_ProjectEditorScrapbook_ItemDetails_Resources">
                                    {item.allObjects.map((object, i) => (
                                        <div
                                            key={i}
                                            className="EezStudio_ProjectEditorScrapbook_ItemDetails_Resources_Item"
                                        >
                                            {object.icon && (
                                                <Icon icon={object.icon} />
                                            )}
                                            <span className="EezStudio_ProjectEditorScrapbook_ItemDetails_Resources_ItemName">
                                                {object.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ScrapbookManagerDialog = observer(
    class ScrapbookManagerDialog extends React.Component {
        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "items") {
                return <Items />;
            }

            if (component === "item-details") {
                return <ItemDetails />;
            }

            return null;
        };

        render() {
            return (
                <div className="EezStudio_ProjectEditorScrapbook">
                    <div className="EezStudio_ProjectEditorScrapbook_Toolbar">
                        <div className="btn-group" role="group">
                            <select
                                className="form-select"
                                value={model.selectedFile}
                                onChange={event =>
                                    model.openScrapbookFile(event.target.value)
                                }
                            >
                                {model.files
                                    .slice()
                                    .sort(stringCompare)
                                    .map(filePath => (
                                        <option key={filePath} value={filePath}>
                                            {path.parse(filePath).name}
                                        </option>
                                    ))}
                            </select>
                            <IconAction
                                title="Create a New Scrapbook File"
                                icon="material:add"
                                onClick={() => model.createNewScrapbookFile()}
                            />
                            <IconAction
                                title="Open Scrapbook File"
                                icon={HOME_TAB_OPEN_ICON}
                                onClick={() => model.selectScrapbookFile()}
                            />
                            <IconAction
                                icon="material:delete"
                                onClick={() =>
                                    model.deleteScrapbookFile(
                                        model.selectedFile
                                    )
                                }
                                title="Delete Scrapbook File"
                                enabled={
                                    model.selectedFile !=
                                    DEFAULT_SCRAPBOOK_FILE_PATH
                                }
                            />
                        </div>
                        <div className="btn-group" role="group">
                            <IconAction
                                title="Undo"
                                icon="material:undo"
                                onClick={() => model.store.undoManager.undo()}
                                enabled={model.store.undoManager.canUndo}
                            />
                            <IconAction
                                title="Redo"
                                icon="material:redo"
                                onClick={() => model.store.undoManager.redo()}
                                enabled={model.store.undoManager.canRedo}
                            />
                        </div>
                    </div>
                    <div className="EezStudio_ProjectEditorScrapbook_Body">
                        <FlexLayoutContainer
                            model={layoutModels.scrapbook}
                            factory={this.factory}
                        />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function showScrapbookManager() {
    const result = showDialog(<ScrapbookManagerDialog />, {
        jsPanel: {
            id: "scrapbook-manager-dialog",
            title: "Scrapbook",
            width: 1280,
            height: 800,
            modeless: true
        }
    });
    model.modalDialog = result[0];
}

////////////////////////////////////////////////////////////////////////////////

export function isScrapbookItemFilePath(filePath: string) {
    return filePath.startsWith(SCRAPBOOK_ITEM_FILE_PREFIX);
}

export function getScrapbookItemEezProject(filePath: string) {
    if (!isScrapbookItemFilePath(filePath)) {
        throw "Not a scrapbook item";
    }

    const itemId = filePath.substring(SCRAPBOOK_ITEM_FILE_PREFIX.length);

    const item = model.store.project.items.find(item => (item.id = itemId));

    if (!item) {
        throw "Scrapbook item not found";
    }

    return item.eezProject;
}

export function setScrapbookItemEezProject(
    filePath: string,
    eezProject: string
) {
    if (!isScrapbookItemFilePath(filePath)) {
        throw "Not a scrapbook item";
    }

    const itemId = filePath.substring(SCRAPBOOK_ITEM_FILE_PREFIX.length);

    const item = model.store.project.items.find(item => (item.id = itemId));

    if (!item) {
        throw "Scrapbook item not found";
    }

    model.store.setItemEezProject(item, eezProject);
}

export function getScrapbookItemName(filePath: string) {
    const itemId = filePath.substring(SCRAPBOOK_ITEM_FILE_PREFIX.length);

    const item = model.store.project.items.find(item => (item.id = itemId));

    if (!item) {
        throw "not found";
    }

    return item.name;
}
