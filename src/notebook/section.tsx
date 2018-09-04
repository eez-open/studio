import * as React from "react";
import { observable, computed, action, runInAction, values, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { stringCompare } from "shared/string";
import { beginTransaction, commitTransaction } from "shared/store";
import { sendSimpleMessage } from "shared/util";

import { Splitter } from "shared/ui/splitter";
import { VerticalHeaderWithBody, ToolbarHeader, Body } from "shared/ui/header-with-body";
import { IconAction, DropdownIconAction, DropdownItem } from "shared/ui/action";
import { List as ListComponent } from "shared/ui/list";
import { confirm } from "shared/ui/dialog";
import { showGenericDialog } from "shared/ui/generic-dialog";

import { validators } from "shared/model/validation";

import {
    IAppStore,
    SelectHistoryItemsSpecification,
    History,
    DeletedItemsHistory
} from "instrument/window/history/history";
import { Filters } from "instrument/window/history/filters";
import { HistoryView } from "instrument/window/history/history-view";

import { INotebook, notebooks, addNotebook, deleteNotebook } from "notebook/store";
import { importNotebook } from "notebook/import";

////////////////////////////////////////////////////////////////////////////////

class NotebooksHomeSectionStore {
    @observable
    selectedNotebook: INotebook | undefined;
}

const notebooksHomeSectionStore = new NotebooksHomeSectionStore();

////////////////////////////////////////////////////////////////////////////////

@observer
class MasterView extends React.Component<{
    selectedNotebook: INotebook | undefined;
    selectNotebook: (notebook: INotebook) => void;
}> {
    @computed
    get sortedNotebooks() {
        return Array.from(notebooks.values())
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(notebook => ({
                id: notebook.id,
                data: notebook,
                selected:
                    this.props.selectedNotebook !== undefined &&
                    notebook.id === this.props.selectedNotebook.id
            }));
    }

    @bind
    addNotebook() {
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
                    this.props.selectNotebook(notebooks.get(notebookId)!);

                    setTimeout(() => {
                        let element = document.querySelector(`.EezStudio_Notebook_${notebookId}`);
                        if (element) {
                            element.scrollIntoView();
                        }
                    }, 10);
                }, 10);
            })
            .catch(() => {});
    }

    @bind
    importNotebook() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [
                    { name: "EEZ Notebook files", extensions: ["eez-notebook"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            },
            filePaths => {
                if (filePaths && filePaths[0]) {
                    importNotebook(filePaths[0], { showNotebook: true });
                }
            }
        );
    }

    @bind
    removeNotebook() {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Remove notebook");
            deleteNotebook(toJS(this.props.selectedNotebook!));
            commitTransaction();
        });
    }

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
                        <DropdownItem text="Add an empty notebook" onClick={this.addNotebook} />
                        <DropdownItem
                            text="Import notebook from file"
                            onClick={this.importNotebook}
                        />
                    </DropdownIconAction>
                    <IconAction
                        icon="material:remove"
                        iconSize={16}
                        title="Remove notebook"
                        enabled={!!this.props.selectedNotebook}
                        onClick={this.removeNotebook}
                    />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <ListComponent
                        nodes={this.sortedNotebooks}
                        renderNode={node => (
                            <div className={"EezStudio_Notebook_" + node.id}>{node.data.name}</div>
                        )}
                        selectNode={node => this.props.selectNotebook(node.data)}
                    />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class AppStore implements IAppStore {
    constructor(public oids?: string[]) {}

    @observable
    selectHistoryItemsSpecification: SelectHistoryItemsSpecification | undefined;

    @observable
    selectedHistoryItems = new Map<string, boolean>();

    instrument: {
        id: string;
        connection: {
            abortLongOperation(): void;
        };
        listsProperty?: any;
    } = {
        id: "0",
        connection: {
            abortLongOperation() {
                // @todo
            }
        }
    };

    filters: Filters = new Filters();

    history: History = new History(this, {
        table: `"notebook/items"`,
        isSessionsSupported: false
    });
    deletedItemsHistory: DeletedItemsHistory = new DeletedItemsHistory(this, {
        table: `"notebook/items"`
    });

    isHistoryItemSelected(id: string): boolean {
        return this.selectedHistoryItems.has(id);
    }

    @action
    selectHistoryItem(id: string, selected: boolean): void {
        if (selected) {
            this.selectedHistoryItems.set(id, true);
        } else {
            this.selectedHistoryItems.delete(id);
        }
    }

    @action
    selectHistoryItems(specification: SelectHistoryItemsSpecification | undefined) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    navigationStore = {
        navigateToHistory() {
            // @todo
            console.log("TODO");
        },
        navigateToDeletedHistoryItems() {
            // @todo
            console.log("TODO");
        },
        navigateToSessionsList() {
            // @todo
            console.log("TODO");
        },
        mainHistoryView: undefined,
        selectedListId: undefined
    };

    searchVisible: boolean;
    toggleSearchVisible(): void {
        // @todo
    }

    filtersVisible: boolean;
    toggleFiltersVisible(): void {
        // @todo
    }

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

@observer
export class DetailsView extends React.Component<{ notebook: INotebook | undefined }, {}> {
    @computed
    get appStore() {
        return new AppStore([this.props.notebook!.id]);
    }

    render() {
        const { notebook } = this.props;

        if (!notebook) {
            return null;
        }

        return <HistoryView appStore={this.appStore} persistId={"notebook/items"} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class NotebooksHomeSection extends React.Component {
    render() {
        return (
            <Splitter type="horizontal" sizes="240px|100%" persistId="notebook/notebooks/splitter">
                <MasterView
                    selectedNotebook={notebooksHomeSectionStore.selectedNotebook}
                    selectNotebook={action(
                        (notebook: INotebook) =>
                            (notebooksHomeSectionStore.selectedNotebook = notebook)
                    )}
                />
                <DetailsView notebook={notebooksHomeSectionStore.selectedNotebook} />
            </Splitter>
        );
    }
}

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
