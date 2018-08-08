import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, action, keys } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { readBinaryFile } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { log } from "shared/activity-log";

import { IconAction, ButtonAction } from "shared/ui/action";
import { Toolbar } from "shared/ui/toolbar";
import { SideDock } from "shared/ui/side-dock";

import { IAppStore, INavigationStore } from "instrument/window/history/history";
import { HistoryListComponent } from "instrument/window/history/list-component";
import { IHistoryItem } from "instrument/window/history/item";
import { SearchResults } from "instrument/window/history/search-results";
import { FiltersComponent } from "instrument/window/history/filters";
import { Calendar } from "instrument/window/history/calendar";
import { SessionList } from "instrument/window/history/session/list-view";

import { showAddNoteDialog } from "instrument/window/note-dialog";

import { detectFileType } from "instrument/connection/file-type";

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryTools extends React.Component<{ appStore: IAppStore }, {}> {
    @bind
    addNote() {
        showAddNoteDialog(note => {
            beginTransaction("Add note");
            log(
                {
                    oid: this.props.appStore.instrument!.id,
                    type: "activity-log/note",
                    message: note
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    @bind
    attachFile() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            {
                properties: ["openFile", "multiSelections"],
                filters: [{ name: "All Files", extensions: ["*"] }]
            },
            filePaths => {
                if (filePaths) {
                    filePaths.forEach(async filePath => {
                        const data = await readBinaryFile(filePath);

                        beginTransaction("Attach file");
                        log(
                            {
                                oid: this.props.appStore.instrument!.id,
                                type: "instrument/file-attachment",
                                message: JSON.stringify({
                                    sourceFilePath: filePath,
                                    state: "success",
                                    fileType: detectFileType(data, filePath),
                                    dataLength: data.length
                                }),
                                data: data as any
                            },
                            {
                                undoable: true
                            }
                        );
                        commitTransaction();
                    });
                }
            }
        );
    }

    @bind
    addChart() {
        this.props.appStore.selectHistoryItems({
            historyItemType: "chart",
            message: "Select one or more waveform data items",
            okButtonText: "Add Chart",
            okButtonTitle: "Add chart",
            onOk: () => {
                const multiWaveformDefinition = {
                    waveformLinks: keys(this.props.appStore.selectedHistoryItems).map(id => ({
                        id
                    }))
                };

                this.props.appStore.selectHistoryItems(undefined);

                beginTransaction("Add chart");
                log(
                    {
                        oid: this.props.appStore.instrument!.id,
                        type: "instrument/chart",
                        message: JSON.stringify(multiWaveformDefinition)
                    },
                    {
                        undoable: true
                    }
                );
                commitTransaction();
            }
        });
    }

    render() {
        const { appStore } = this.props;

        let actions = [];

        if (appStore.selectHistoryItemsSpecification === undefined) {
            actions.push(
                <IconAction
                    key="addNote"
                    icon="material:comment"
                    title="Add note"
                    onClick={this.addNote}
                />,
                <IconAction
                    key="addFile"
                    icon="material:attach_file"
                    title="Attach file"
                    onClick={this.attachFile}
                />,
                <IconAction
                    key="addChart"
                    icon="material:insert_chart"
                    title="Add chart"
                    onClick={this.addChart}
                />
            );

            if (appStore.history.selection.canDelete) {
                actions.push(
                    <IconAction
                        key="delete"
                        icon="material:delete"
                        title="Delete selected history items"
                        style={{ marginLeft: 20 }}
                        onClick={appStore.history.deleteSelectedHistoryItems}
                    />
                );
            }

            if (appStore.deletedItemsHistory.deletedCount > 0) {
                const style =
                    appStore.history.selection.items.length === 0 ? { marginLeft: 20 } : undefined;

                actions.push(
                    <ButtonAction
                        key="deletedItems"
                        text={`Deleted Items (${appStore.deletedItemsHistory.deletedCount})`}
                        title="Show deleted items"
                        onClick={appStore.navigationStore.navigateToDeletedHistoryItems}
                        className="btn-sm"
                        style={style}
                    />
                );
            }
        }

        return actions;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryView extends React.Component<{
    appStore: IAppStore;
    persistId: string;
    simple?: boolean;
}> {
    animationFrameRequestId: any;
    history: HistoryListComponent | null;
    sideDock: SideDock | null;
    @observable searchText: string = "";

    @bind
    frameAnimation() {
        if (this.sideDock) {
            this.sideDock.updateSize();
        }

        this.animationFrameRequestId = window.requestAnimationFrame(this.frameAnimation);
    }

    componentDidMount() {
        this.frameAnimation();

        if (!this.props.simple) {
            this.props.appStore.navigationStore.mainHistoryView = this;
        }
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);

        if (!this.props.simple) {
            this.props.appStore.navigationStore.mainHistoryView = undefined;
        }
    }

    onSelectHistoryItemsOk() {
        this.props.appStore.selectHistoryItemsSpecification!.onOk();
    }

    @bind
    onSelectHistoryItemsCancel() {
        this.props.appStore.selectHistoryItems(undefined);
    }

    @action.bound
    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
        this.props.appStore.history.search.search(this.searchText);
    }

    render() {
        const appStore = this.props.appStore;

        const historyComponent = (
            <HistoryListComponent
                ref={ref => (this.history = ref)}
                appStore={this.props.appStore}
                history={this.props.appStore.history}
            />
        );

        if (this.props.simple) {
            return historyComponent;
        }

        const historyComponentWithTools = (
            <div className="EezStudio_History_Container" tabIndex={0}>
                {appStore.selectHistoryItemsSpecification && (
                    <div className="EezStudio_History_Header EezStudio_SlideInDownTransition">
                        <div>
                            {appStore.selectedHistoryItems.size > 0
                                ? `${appStore.selectedHistoryItems.size} selected`
                                : appStore.selectHistoryItemsSpecification.message}
                        </div>
                        <Toolbar>
                            {appStore.selectedHistoryItems.size > 0 && (
                                <ButtonAction
                                    text={appStore.selectHistoryItemsSpecification.okButtonText}
                                    title={appStore.selectHistoryItemsSpecification.okButtonTitle}
                                    className={
                                        appStore.selectHistoryItemsSpecification.alertDanger
                                            ? "btn-danger"
                                            : "btn-primary"
                                    }
                                    onClick={this.onSelectHistoryItemsOk}
                                />
                            )}
                            <ButtonAction
                                text="Cancel"
                                title="Cancel"
                                className="btn-secondary"
                                onClick={this.onSelectHistoryItemsCancel}
                            />
                        </Toolbar>
                    </div>
                )}
                <div className="EezStudio_History_Body">{historyComponent}</div>
            </div>
        );

        let searchResultsVisible = appStore.history.search.searchActive;

        let searchResultsItem = searchResultsVisible && {
            id: "searchResults",
            type: "component",
            componentName: "SearchResults",
            componentState: {},
            title: "Search results",
            isClosable: false
        };

        const filtersItem = {
            id: "filters",
            type: "component",
            componentName: "Filters",
            componentState: {},
            title: "Filters",
            isClosable: false
        };

        const calendarItem = {
            id: "calendar",
            type: "component",
            componentName: "Calendar",
            componentState: {},
            title: "Calendar",
            isClosable: false
        };

        const sessionsItem = {
            id: "sessions",
            type: "component",
            componentName: "Sessions",
            componentState: {},
            title: "Sessions",
            isClosable: false
        };

        let content;
        if (searchResultsItem) {
            content = [
                {
                    type: "column",
                    content: [
                        searchResultsItem,
                        filtersItem,
                        {
                            type: "stack",
                            content: [calendarItem, sessionsItem]
                        }
                    ]
                }
            ];
        } else {
            content = [
                {
                    type: "column",
                    content: [
                        filtersItem,
                        {
                            type: "stack",
                            content: [calendarItem, sessionsItem]
                        }
                    ]
                }
            ];
        }

        const defaultLayoutConfig = {
            settings: SideDock.DEFAULT_SETTINGS,
            dimensions: SideDock.DEFAULT_DIMENSIONS,
            content
        };

        let inputClassName = classNames("EezStudio_SearchInput", {
            empty: !this.searchText
        });

        let input = (
            <input
                type="text"
                placeholder="&#xe8b6;"
                className={inputClassName}
                value={this.searchText}
                onChange={this.onSearchChange}
            />
        );

        return (
            <SideDock
                ref={ref => (this.sideDock = ref)}
                persistId={this.props.persistId + "/side-dock"}
                layoutId={"layout/2" + (searchResultsItem ? "/with-search-results" : "")}
                defaultLayoutConfig={defaultLayoutConfig}
                registerComponents={(goldenLayout: any) => {
                    goldenLayout.registerComponent("SearchResults", function(
                        container: any,
                        props: any
                    ) {
                        ReactDOM.render(
                            <div
                                style={{
                                    position: "absolute",
                                    width: "100%",
                                    height: "100%",
                                    display: "flex"
                                }}
                            >
                                <SearchResults history={appStore.history} />
                            </div>,
                            container.getElement()[0]
                        );
                    });

                    goldenLayout.registerComponent("Filters", function(container: any, props: any) {
                        ReactDOM.render(
                            <FiltersComponent appStore={appStore} />,
                            container.getElement()[0]
                        );
                    });

                    goldenLayout.registerComponent("Calendar", function(
                        container: any,
                        props: any
                    ) {
                        ReactDOM.render(
                            <div
                                style={{
                                    height: "100%",
                                    overflow: "auto"
                                }}
                            >
                                <Calendar history={appStore.history} />
                            </div>,
                            container.getElement()[0]
                        );
                    });

                    goldenLayout.registerComponent("Sessions", function(
                        container: any,
                        props: any
                    ) {
                        ReactDOM.render(
                            <div
                                style={{
                                    position: "absolute",
                                    width: "100%",
                                    height: "100%",
                                    display: "flex"
                                }}
                            >
                                <SessionList appStore={appStore} history={appStore.history} />
                            </div>,
                            container.getElement()[0]
                        );
                    });
                }}
                header={input}
            >
                {historyComponentWithTools}
            </SideDock>
        );
    }
}

export function moveToTopOfHistory(historyView: HistoryView | undefined) {
    if (historyView && historyView.history) {
        historyView.history.moveToTop();
    }
}

export function moveToBottomOfHistory(historyView: HistoryView | undefined) {
    if (historyView && historyView.history) {
        historyView.history.moveToBottom();
    }
}

export function showHistoryItem(historyView: HistoryView | undefined, historyItem: IHistoryItem) {
    if (historyView && historyView.history) {
        historyView.history.showHistoryItem(historyItem);
    }
}

export function showSessionsList(navigationStore: INavigationStore) {
    const sideDock = navigationStore.mainHistoryView && navigationStore.mainHistoryView.sideDock;
    if (sideDock) {
        if (!sideDock.isOpen) {
            sideDock.toggleIsOpen();
        } else {
            const items = sideDock.goldenLayout.root.getItemsById("sessions");
            if (items.length === 1) {
                items[0].parent.setActiveContentItem(items[0]);
            }
            return;
        }
    }
    // try again
    setTimeout(() => showSessionsList(navigationStore), 0);
}
