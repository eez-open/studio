import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { layoutModels, SideDock2 } from "eez-studio-ui/side-dock";
import { SearchInput } from "eez-studio-ui/search-input";

import { IAppStore } from "instrument/window/history/history";
import {
    HistoryListComponent,
    HistoryListComponentClass
} from "instrument/window/history/list-component";
import { SearchResults } from "instrument/window/history/search-results";
import { Calendar } from "instrument/window/history/calendar";

////////////////////////////////////////////////////////////////////////////////

export const DeletedHistoryItemsTools = observer(
    class DeletedHistoryItemsTools extends React.Component<{
        appStore: IAppStore;
    }> {
        render() {
            let actions = [];

            if (
                this.props.appStore.deletedItemsHistory.selection.items.length >
                0
            ) {
                actions.push(
                    <IconAction
                        key="restore"
                        icon="material:restore"
                        title="Restore selected history items"
                        style={{ marginLeft: 20 }}
                        onClick={
                            this.props.appStore.deletedItemsHistory
                                .restoreSelectedHistoryItems
                        }
                    />,
                    <IconAction
                        key="purge"
                        color="#dc3545"
                        icon="material:delete_forever"
                        title="Purge selected history items"
                        onClick={
                            this.props.appStore.deletedItemsHistory
                                .deleteSelectedHistoryItems
                        }
                    />
                );
            } else {
                actions.push(
                    <ButtonAction
                        key="emptyTrash"
                        text="Empty Trash"
                        icon="material:delete_forever"
                        title="Purge all deleted history items"
                        className="btn-sm btn-danger"
                        onClick={
                            this.props.appStore.deletedItemsHistory.emptyTrash
                        }
                    />
                );
            }

            actions.push(
                <span
                    key="deletedItems"
                    style={{ paddingLeft: 10, paddingRight: 20 }}
                >
                    {`${
                        this.props.appStore.deletedItemsHistory.deletedCount
                    } deleted ${
                        this.props.appStore.deletedItemsHistory.deletedCount !==
                        1
                            ? "items"
                            : "item"
                    }`}
                </span>
            );

            actions.push(
                <ButtonAction
                    key="back"
                    icon="material:arrow_back"
                    text="Back"
                    title={"Go back to the terminal"}
                    onClick={
                        this.props.appStore.navigationStore.navigateToHistory
                    }
                    className="btn-secondary btn-sm"
                />
            );

            return actions;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const DeletedHistoryItemsView = observer(
    class DeletedHistoryItemsView extends React.Component<{
        children?: React.ReactNode;
        appStore: IAppStore;
        persistId: string;
    }> {
        history: HistoryListComponentClass | null;
        searchText: string = "";

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                searchText: observable,
                onSearchChange: action.bound
            });
        }

        onSelectHistoryItemsCancel = () => {
            this.props.appStore.selectHistoryItems(undefined);
        };

        onSearchChange(event: any) {
            this.searchText = $(event.target).val() as string;
            this.props.appStore.deletedItemsHistory.search.search(
                this.searchText
            );
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            const appStore = this.props.appStore;

            if (component === "SearchResults") {
                return (
                    <div
                        style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            display: "flex"
                        }}
                    >
                        <SearchResults history={appStore.deletedItemsHistory} />
                    </div>
                );
            } else if (component === "Calendar") {
                return (
                    <div
                        style={{
                            height: "100%",
                            overflow: "auto"
                        }}
                    >
                        <Calendar history={appStore.deletedItemsHistory} />
                    </div>
                );
            }

            return null;
        };

        render() {
            const historyComponent = (
                <HistoryListComponent
                    appStore={this.props.appStore}
                    ref={ref => (this.history = ref)}
                    history={this.props.appStore.deletedItemsHistory}
                />
            );

            const historyComponentWithTools = (
                <div className="EezStudio_DeletedHistoryContainer">
                    <div
                        className="EezStudio_HistoryBody"
                        onClick={event => {
                            if (
                                $(event.target).closest(
                                    ".EezStudio_HistoryItemEnclosure"
                                ).length === 0
                            ) {
                                // deselect all items
                                this.props.appStore.deletedItemsHistory.selection.selectItems(
                                    []
                                );
                            }
                        }}
                        tabIndex={0}
                    >
                        {historyComponent}
                    </div>
                </div>
            );

            let input = (
                <SearchInput
                    searchText={this.searchText}
                    onChange={this.onSearchChange}
                />
            );

            return (
                <SideDock2
                    persistId={this.props.persistId + "/side-dock"}
                    flexLayoutModel={layoutModels.getDeletedHistoryViewModel(
                        this.props.appStore.deletedItemsHistory.search
                            .searchActive
                    )}
                    factory={this.factory}
                    header={input}
                    width={420}
                >
                    {historyComponentWithTools}
                </SideDock2>
            );
        }
    }
);
