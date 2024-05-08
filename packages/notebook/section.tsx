import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    values,
    toJS,
    autorun,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { sendSimpleMessage } from "eez-studio-shared/util-renderer";

import { Splitter } from "eez-studio-ui/splitter";
import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";
import {
    IconAction,
    DropdownIconAction,
    DropdownItem
} from "eez-studio-ui/action";
import { List as ListComponent } from "eez-studio-ui/list";
import { confirm } from "eez-studio-ui/dialog-electron";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { validators } from "eez-studio-shared/validation";

import {
    IAppStore,
    SelectHistoryItemsSpecification,
    History,
    DeletedItemsHistory,
    IInstrumentObject
} from "instrument/window/history/history";
import { Filters } from "instrument/window/history/filters";
import {
    HistoryTools,
    HistoryView
} from "instrument/window/history/history-view";
import {
    DeletedHistoryItemsTools,
    DeletedHistoryItemsView
} from "instrument/window/history/deleted-history-items-view";

import {
    INotebook,
    notebooks,
    addNotebook,
    deleteNotebook,
    updateNotebook,
    deletedNotebooks,
    itemsStore
} from "notebook/store";

import { importNotebook } from "notebook/import";

import { showDeletedNotebooksDialog } from "notebook/deleted-notebooks-dialog";
import type { IUnit } from "eez-studio-shared/units";

////////////////////////////////////////////////////////////////////////////////

class NotebooksHomeSectionStore {
    private _selectedNotebook: INotebook | undefined;
    showDeletedHistoryItems = false;

    constructor() {
        makeObservable<NotebooksHomeSectionStore, "_selectedNotebook">(this, {
            _selectedNotebook: observable,
            showDeletedHistoryItems: observable,
            appStore: computed
        });

        autorun(() => {
            if (
                this.selectedNotebook &&
                !notebooks.get(this.selectedNotebook.id)
            ) {
                runInAction(() => {
                    this._selectedNotebook = undefined;
                });
            }

            if (
                this.appStore &&
                this.appStore.deletedItemsHistory.deletedCount === 0
            ) {
                runInAction(() => {
                    this.showDeletedHistoryItems = false;
                });
            }
        });
    }

    get selectedNotebook() {
        return this._selectedNotebook;
    }

    set selectedNotebook(value: INotebook | undefined) {
        runInAction(() => {
            this._selectedNotebook = value;
            this.showDeletedHistoryItems = false;
        });
    }

    get appStore() {
        if (this._selectedNotebook) {
            return new AppStore(this._selectedNotebook.id);
        }
        return null;
    }
}

const notebooksHomeSectionStore = new NotebooksHomeSectionStore();

////////////////////////////////////////////////////////////////////////////////

const MasterView = observer(
    class MasterView extends React.Component {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                sortedNotebooks: computed
            });
        }

        get sortedNotebooks() {
            return Array.from(notebooks.values())
                .sort((a, b) => stringCompare(a.name, b.name))
                .map(notebook => ({
                    id: notebook.id,
                    data: notebook,
                    selected:
                        notebooksHomeSectionStore.selectedNotebook !==
                            undefined &&
                        notebook.id ===
                            notebooksHomeSectionStore.selectedNotebook.id
                }));
        }

        addNotebook = () => {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "name",
                            displayName: "Notebook name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(
                                    {},
                                    values(notebooks),
                                    "Notebook with the same name already exists"
                                )
                            ]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            })
                .then(result => {
                    beginTransaction("Add notebook");
                    const notebookId = addNotebook(result.values);
                    commitTransaction();

                    setTimeout(() => {
                        notebooksHomeSectionStore.selectedNotebook =
                            notebooks.get(notebookId);

                        setTimeout(() => {
                            let element = document.querySelector(
                                `.EezStudio_Notebook_${notebookId}`
                            );
                            if (element) {
                                element.scrollIntoView();
                            }
                        }, 10);
                    }, 10);
                })
                .catch(() => {});
        };

        importNotebook = async () => {
            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                properties: ["openFile"],
                filters: [
                    {
                        name: "EEZ Notebook files",
                        extensions: ["eez-notebook"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ]
            });
            const filePaths = result.filePaths;
            if (filePaths && filePaths[0]) {
                importNotebook(filePaths[0], { showNotebook: true });
            }
        };

        removeNotebook = () => {
            confirm("Are you sure?", undefined, () => {
                beginTransaction("Remove notebook");
                deleteNotebook(
                    toJS(notebooksHomeSectionStore.selectedNotebook!)
                );
                commitTransaction();
            });
        };

        showDeletedNotebooks = () => {
            showDeletedNotebooksDialog();
        };

        changeNotebookName = () => {
            showGenericDialog({
                dialogDefinition: {
                    fields: [
                        {
                            name: "name",
                            displayName: "Name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique(
                                    notebooksHomeSectionStore.selectedNotebook,
                                    values(notebooks),
                                    "Notebook with the same name already exists"
                                )
                            ]
                        }
                    ]
                },
                values: notebooksHomeSectionStore.selectedNotebook
            })
                .then(result => {
                    beginTransaction("Rename notebook");
                    updateNotebook(
                        Object.assign(
                            {},
                            notebooksHomeSectionStore.selectedNotebook,
                            result.values
                        )
                    );
                    commitTransaction();
                })
                .catch(() => {});
        };

        render() {
            return (
                <VerticalHeaderWithBody>
                    <ToolbarHeader>
                        <DropdownIconAction
                            key="notebook/export"
                            icon="material:add"
                            iconSize={16}
                            title="Add notebook"
                        >
                            <DropdownItem
                                text="Add an empty notebook"
                                onClick={this.addNotebook}
                            />
                            <DropdownItem
                                text="Import notebook from file"
                                onClick={this.importNotebook}
                            />
                        </DropdownIconAction>
                        <IconAction
                            icon="material:delete"
                            iconSize={16}
                            title="Remove notebook"
                            enabled={
                                !!notebooksHomeSectionStore.selectedNotebook
                            }
                            onClick={this.removeNotebook}
                        />
                        <IconAction
                            icon="material:edit"
                            iconSize={16}
                            title="Change notebook name"
                            enabled={
                                !!notebooksHomeSectionStore.selectedNotebook
                            }
                            onClick={this.changeNotebookName}
                        />
                        <IconAction
                            icon="material:delete_sweep"
                            iconSize={16}
                            title="Show deleted notebooks"
                            enabled={deletedNotebooks.size > 0}
                            onClick={this.showDeletedNotebooks}
                        />
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        <ListComponent
                            nodes={this.sortedNotebooks}
                            renderNode={node => (
                                <div
                                    className={"EezStudio_Notebook_" + node.id}
                                >
                                    {node.data.name}
                                </div>
                            )}
                            selectNode={node =>
                                (notebooksHomeSectionStore.selectedNotebook =
                                    node.data)
                            }
                        />
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class AppStore implements IAppStore {
    constructor(public notebookId: string) {
        makeObservable(this, {
            selectHistoryItemsSpecification: observable,
            selectedHistoryItems: observable,
            selectHistoryItem: action,
            selectHistoryItems: action
        });

        this.history = new History(this, {
            store: itemsStore,
            isSessionsSupported: false,
            oid: this.notebookId
        });
        this.deletedItemsHistory = new DeletedItemsHistory(this, {
            store: itemsStore,
            oid: this.notebookId
        });
    }

    selectHistoryItemsSpecification:
        | SelectHistoryItemsSpecification
        | undefined;
    selectedHistoryItems = new Map<string, boolean>();

    instrument: IInstrumentObject = {
        id: "0",
        connection: {
            abortLongOperation() {
                // @todo
            },
            isConnected: false,
            isPlotterEnabled: false
        },
        listsMinDwellProperty: 0,
        listsMaxDwellProperty: 0,
        firstChannel: undefined,
        getDigits: (unit: IUnit) => 3,
        listsMaxPointsProperty: 0,
        listsCurrentDigitsProperty: 0,
        listsDwellDigitsProperty: 0,
        listsVoltageDigitsProperty: 0,
        commandsProtocol: "SCPI"
    };
    instrumentLists = [];

    filters: Filters = new Filters();

    history: History;
    deletedItemsHistory: DeletedItemsHistory;

    isHistoryItemSelected(id: string): boolean {
        return this.selectedHistoryItems.has(id);
    }

    selectHistoryItem(id: string, selected: boolean): void {
        if (selected) {
            this.selectedHistoryItems.set(id, true);
        } else {
            this.selectedHistoryItems.delete(id);
        }
    }

    selectHistoryItems(
        specification: SelectHistoryItemsSpecification | undefined
    ) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    navigationStore = {
        navigateToHistory() {
            runInAction(
                () =>
                    (notebooksHomeSectionStore.showDeletedHistoryItems = false)
            );
        },
        navigateToDeletedHistoryItems() {
            runInAction(
                () => (notebooksHomeSectionStore.showDeletedHistoryItems = true)
            );
        },
        navigateToSessionsList() {},
        mainHistoryView: undefined,
        selectedListId: undefined,
        async changeSelectedListId() {}
    };

    searchViewSection: "calendar" | "sessions" = "calendar";
    setSearchViewSection(value: "calendar" | "sessions"): void {
        // @todo
    }

    findListIdByName(listName: string): string | undefined {
        // @todo
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export const DetailsView = observer(
    class DetailsView extends React.Component {
        render() {
            if (notebooksHomeSectionStore.showDeletedHistoryItems) {
                return (
                    <VerticalHeaderWithBody>
                        <ToolbarHeader>
                            <DeletedHistoryItemsTools
                                appStore={notebooksHomeSectionStore.appStore!}
                            />
                        </ToolbarHeader>
                        <Body>
                            <DeletedHistoryItemsView
                                appStore={notebooksHomeSectionStore.appStore!}
                                persistId={"notebook/deleted-items"}
                            />
                        </Body>
                    </VerticalHeaderWithBody>
                );
            } else {
                return (
                    <VerticalHeaderWithBody>
                        <ToolbarHeader className="EezStudio_InstrumentTools">
                            <HistoryTools
                                appStore={notebooksHomeSectionStore.appStore!}
                            />
                        </ToolbarHeader>
                        <Body>
                            <HistoryView
                                appStore={notebooksHomeSectionStore.appStore!}
                                persistId={"notebook/items"}
                                showSideBar={true}
                            />
                        </Body>
                    </VerticalHeaderWithBody>
                );
            }
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const NotebooksHomeSection = observer(
    class NotebooksHomeSection extends React.Component {
        render() {
            return (
                <Splitter
                    type="horizontal"
                    sizes="240px|100%"
                    persistId="notebook/notebooks/splitter"
                >
                    <MasterView />
                    {notebooksHomeSectionStore.selectedNotebook ? (
                        <DetailsView />
                    ) : (
                        <div />
                    )}
                </Splitter>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function showNotebook(notebookId: string) {
    sendSimpleMessage("home/show-section", {
        sectionId: "notebooks",
        itemId: notebookId
    });
}

////////////////////////////////////////////////////////////////////////////////

export function renderContent() {
    return <NotebooksHomeSection />;
}

export function selectItem(itemId: string) {
    runInAction(() => {
        notebooksHomeSectionStore.selectedNotebook = notebooks.get(itemId);
    });
}
