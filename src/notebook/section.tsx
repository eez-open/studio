import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { stringCompare } from "shared/string";

import { Splitter } from "shared/ui/splitter";
import { VerticalHeaderWithBody, ToolbarHeader, Header, Body } from "shared/ui/header-with-body";
import { IconAction } from "shared/ui/action";
import { List as ListComponent } from "shared/ui/list";

import {
    IAppStore,
    SelectHistoryItemsSpecification,
    History,
    DeletedItemsHistory
} from "instrument/window/history/history";
import { Filters } from "instrument/window/history/filters";
import { HistoryView } from "instrument/window/history/history-view";

import { INotebook, notebooks } from "notebook/store";

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
    addNotebook() {}

    @bind
    removeNotebook() {}

    render() {
        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <IconAction
                        icon="material:add"
                        iconSize={16}
                        title="Add list"
                        onClick={this.addNotebook}
                    />
                    <IconAction
                        icon="material:remove"
                        iconSize={16}
                        title="Remove list"
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

        return (
            <VerticalHeaderWithBody>
                <Header className="EezStudio_ListEditor_ListDescription">{notebook.name}</Header>
                <Body>
                    <HistoryView appStore={this.appStore} persistId={"notebook/items"} />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class NotebooksHomeSection extends React.Component {
    @observable
    selectedNotebook: INotebook;

    render() {
        return (
            <Splitter type="horizontal" sizes="150px|100%" persistId="notebook/notebooks/splitter">
                <MasterView
                    selectedNotebook={this.selectedNotebook}
                    selectNotebook={action(
                        (notebook: INotebook) => (this.selectedNotebook = notebook)
                    )}
                />
                <DetailsView notebook={this.selectedNotebook} />
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function renderNotebooksHomeSection() {
    return <NotebooksHomeSection />;
}
