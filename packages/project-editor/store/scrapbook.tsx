import fs from "fs";
import path from "path";
import React from "react";
import {
    action,
    computed,
    IObservableValue,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import classNames from "classnames";
import Database from "better-sqlite3";

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

////////////////////////////////////////////////////////////////////////////////

const DEFAULT_SCRAPBOOK_FILE_PATH = getUserDataPath(
    "/scrapbooks/default.eez-scrapbook"
);

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
}

////////////////////////////////////////////////////////////////////////////////

class ScrapbookManagerModel {
    store: ScrapbookStore = new ScrapbookStore();

    constructor() {
        makeObservable(this, {});

        this.load();
    }

    async load() {
        try {
            await this.store.load(DEFAULT_SCRAPBOOK_FILE_PATH);
        } catch (err) {
            await fs.promises.mkdir(path.dirname(DEFAULT_SCRAPBOOK_FILE_PATH), {
                recursive: true
            });

            await this.store.load(DEFAULT_SCRAPBOOK_FILE_PATH);
        }
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
            type: "read-only"
        });

        const project = loadProject(projectStore, item.eezProject, false);

        projectStore.setProject(project, "");

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
                    {model.store.project.items.map(item => (
                        <div
                            key={item.id}
                            className={classNames(
                                "EezStudio_ProjectEditorScrapbook_Item",
                                { selected: model.store.selectedItem == item }
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
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ItemDetails = observer(
    class ItemDetails extends React.Component<{
        insertItemIntoProject: (item: ScrapbookItem) => void;
        openItemProject: (item: ScrapbookItem) => void;
    }> {
        render() {
            const item = model.store.selectedItem;

            if (!item) {
                return null;
            }

            return (
                <div className="EezStudio_ProjectEditorScrapbook_ItemDetails">
                    <div className="pb-3 d-flex justify-content-between">
                        <div>
                            <button
                                className="btn btn-lg btn-primary"
                                onClick={() =>
                                    this.props.insertItemIntoProject(item)
                                }
                            >
                                Insert into project
                            </button>
                            <button
                                className="btn btn-lg btn-secondary ms-2"
                                onClick={() => this.props.openItemProject(item)}
                            >
                                Open
                            </button>
                        </div>
                        <div>
                            <button
                                className="btn btn-lg btn-danger"
                                onClick={() => model.store.deleteItem(item)}
                            >
                                Delete this item
                            </button>
                        </div>
                    </div>
                    <div>
                        <form>
                            <div className="mb-3">
                                <label
                                    htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Name"
                                    className="form-label"
                                >
                                    Name
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
                                    Description
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
                                <label className="form-label">Objects</label>
                                <div className="ps-3">
                                    {item.allObjects.map((object, i) => (
                                        <div key={i}>
                                            <Icon icon={object.icon} />
                                            <span>{object.name}</span>
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
    class ScrapbookManagerDialog extends React.Component<{
        modalDialog: IObservableValue<any>;
        destinationProjectStore: ProjectStore;
    }> {
        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "items") {
                return <Items />;
            }

            if (component === "item-details") {
                return (
                    <ItemDetails
                        insertItemIntoProject={item => {
                            model.insertItemIntoProject(
                                item,
                                this.props.destinationProjectStore
                            );
                            this.props.modalDialog.get().close();
                        }}
                        openItemProject={item => {
                            model.openItemProject(item);
                            this.props.modalDialog.get().close();
                        }}
                    />
                );
            }

            return null;
        };

        render() {
            return (
                <div className="EezStudio_ProjectEditorScrapbook">
                    <div className="EezStudio_ProjectEditorScrapbook_Toolbar">
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
                        <div className="btn-group" role="group">
                            <IconAction
                                title="Paste"
                                icon="material:content_paste"
                                iconSize={22}
                                onClick={() =>
                                    model.pasteIntoNewItem(
                                        this.props.destinationProjectStore
                                    )
                                }
                                enabled={
                                    this.props.destinationProjectStore.canPaste
                                }
                            />
                        </div>
                    </div>
                    <div className="EezStudio_ProjectEditorScrapbook_Body">
                        <FlexLayoutContainer
                            model={
                                this.props.destinationProjectStore.layoutModels
                                    .scrapbook
                            }
                            factory={this.factory}
                        />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function showScrapbookManager(destinationProjectStore: ProjectStore) {
    const modalDialogObservable = observable.box<any>();

    const [modalDialog] = showDialog(
        <ScrapbookManagerDialog
            modalDialog={modalDialogObservable}
            destinationProjectStore={destinationProjectStore}
        />,
        {
            jsPanel: {
                id: "scrapbook-manager-dialog",
                title: "Scrapbook",
                width: 1280,
                height: 800,
                modeless: true
            }
        }
    );

    modalDialogObservable.set(modalDialog);
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