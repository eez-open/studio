import * as React from "react";
import * as ReactDOM from "react-dom";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { IconAction, ButtonAction } from "shared/ui/action";
import { SideDock } from "shared/ui/side-dock";

import { IAppStore } from "instrument/window/history/history";
import { HistoryListComponent } from "instrument/window/history/list-component";
import { SearchResults } from "instrument/window/history/search-results";
import { Calendar } from "instrument/window/history/calendar";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItemsTools extends React.Component<{ appStore: IAppStore }> {
    render() {
        let actions = [];

        if (this.props.appStore.deletedItemsHistory.selection.items.length > 0) {
            actions.push(
                <IconAction
                    key="restore"
                    icon="material:restore"
                    title="Restore selected history items"
                    style={{ marginLeft: 20 }}
                    onClick={this.props.appStore.deletedItemsHistory.restoreSelectedHistoryItems}
                />,
                <IconAction
                    key="purge"
                    icon="material:delete_forever"
                    title="Purge selected history items"
                    onClick={this.props.appStore.deletedItemsHistory.deleteSelectedHistoryItems}
                />
            );
        }

        actions.push(
            <ButtonAction
                key="deletedItems"
                icon="material:arrow_back"
                text="Back"
                title={"Go back to the terminal"}
                onClick={this.props.appStore.navigationStore.navigateToHistory}
            />
        );

        return actions;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItemsView extends React.Component<{
    appStore: IAppStore;
    persistId: string;
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
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);
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
        this.props.appStore.deletedItemsHistory.search.search(this.searchText);
    }

    render() {
        const appStore = this.props.appStore;

        const historyComponent = (
            <HistoryListComponent
                appStore={this.props.appStore}
                ref={ref => (this.history = ref)}
                history={this.props.appStore.deletedItemsHistory}
            />
        );

        let searchResultsVisible = appStore.deletedItemsHistory.search.searchActive;

        let searchResultsComponent = searchResultsVisible && {
            type: "component",
            componentName: "SearchResults",
            componentState: {},
            title: "Search results",
            isClosable: false
        };

        const calendarComponent = {
            type: "component",
            componentName: "Calendar",
            componentState: {},
            title: "Calendar",
            isClosable: false
        };

        let content;
        if (searchResultsComponent) {
            content = [
                {
                    type: "column",
                    content: [searchResultsComponent, calendarComponent]
                }
            ];
        } else {
            content = [
                {
                    type: "column",
                    content: [calendarComponent]
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
                //onKeyDown={this.onSearchChange}
            />
        );

        return (
            <SideDock
                ref={ref => (this.sideDock = ref)}
                persistId={this.props.persistId + "/side-dock"}
                layoutId={"layout/1" + (searchResultsComponent ? "/with-search-results" : "")}
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
                                <Calendar history={appStore.deletedItemsHistory} />
                            </div>,
                            container.getElement()[0]
                        );
                    });
                }}
                header={input}
            >
                {historyComponent}
            </SideDock>
        );
    }
}
