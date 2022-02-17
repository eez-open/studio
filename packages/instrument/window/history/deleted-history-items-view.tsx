import React from "react";
import ReactDOM from "react-dom";
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { IconAction, ButtonAction } from "eez-studio-ui/action";
import {
    SideDock,
    DockablePanels,
    SideDockComponent
} from "eez-studio-ui/side-dock";
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
                <span key="deletedItems" style={{ paddingRight: 10 }}>
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
                />
            );

            return actions;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const DeletedHistoryItemsView = observer(
    class DeletedHistoryItemsView extends React.Component<{
        appStore: IAppStore;
        persistId: string;
    }> {
        animationFrameRequestId: any;
        history: HistoryListComponentClass | null;
        sideDock: SideDockComponent | null;
        searchText: string = "";

        frameAnimation = () => {
            if (this.sideDock) {
                this.sideDock.updateSize();
            }

            this.animationFrameRequestId = window.requestAnimationFrame(
                this.frameAnimation
            );
        };

        constructor(props: { appStore: IAppStore; persistId: string }) {
            super(props);

            makeObservable(this, {
                searchText: observable,
                onSearchChange: action.bound,
                defaultLayoutConfig: computed
            });
        }

        componentDidMount() {
            this.frameAnimation();
        }

        componentWillUnmount() {
            window.cancelAnimationFrame(this.animationFrameRequestId);
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

        registerComponents = (factory: any) => {
            const appStore = this.props.appStore;

            factory.registerComponent(
                "SearchResults",
                function (container: any, props: any) {
                    ReactDOM.render(
                        <div
                            style={{
                                position: "absolute",
                                width: "100%",
                                height: "100%",
                                display: "flex"
                            }}
                        >
                            <SearchResults
                                history={appStore.deletedItemsHistory}
                            />
                        </div>,
                        container.getElement()[0]
                    );
                }
            );

            factory.registerComponent(
                "Calendar",
                function (container: any, props: any) {
                    ReactDOM.render(
                        <div
                            style={{
                                height: "100%",
                                overflow: "auto"
                            }}
                        >
                            <Calendar history={appStore.deletedItemsHistory} />
                        </div>,
                        container.getElement()[0]
                    );
                }
            );
        };

        get searchResultsComponent() {
            return {
                type: "component",
                componentName: "SearchResults",
                componentState: {},
                title: "Search results",
                isClosable: false
            };
        }

        get calendarComponent() {
            return {
                type: "component",
                componentName: "Calendar",
                componentState: {},
                title: "Calendar",
                isClosable: false
            };
        }

        get defaultLayoutConfig() {
            let content;

            if (this.props.appStore.deletedItemsHistory.search.searchActive) {
                content = [
                    {
                        type: "stack",
                        content: [
                            this.searchResultsComponent,
                            this.calendarComponent
                        ]
                    }
                ];
            } else {
                content = [
                    {
                        type: "stack",
                        content: [this.calendarComponent]
                    }
                ];
            }

            const defaultLayoutConfig = {
                settings: DockablePanels.DEFAULT_SETTINGS,
                dimensions: DockablePanels.DEFAULT_DIMENSIONS,
                content
            };

            return defaultLayoutConfig;
        }

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

            let layoutId =
                "layout/2" +
                (this.props.appStore.deletedItemsHistory.search.searchActive
                    ? "/with-search-results"
                    : "");

            return (
                <SideDock
                    ref={ref => (this.sideDock = ref)}
                    persistId={this.props.persistId + "/side-dock"}
                    layoutId={layoutId}
                    defaultLayoutConfig={this.defaultLayoutConfig}
                    registerComponents={this.registerComponents}
                    header={input}
                    width={420}
                >
                    {historyComponentWithTools}
                </SideDock>
            );
        }
    }
);
