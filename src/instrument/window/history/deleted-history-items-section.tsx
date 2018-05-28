import * as React from "react";
import { reaction } from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "shared/ui/splitter";
import { IconAction, ButtonAction } from "shared/ui/action";

import { AppStore } from "instrument/window/app-store";

import { Search } from "instrument/window/search/search";

import { HistoryListComponent } from "instrument/window/history/list-component";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItemsToolbarButtons extends React.Component<{ appStore: AppStore }> {
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
                onClick={this.props.appStore.navigationStore.navigateToTerminal}
            />
        );

        actions.push(
            <IconAction
                style={{ marginLeft: 20 }}
                key="search"
                icon="material:search"
                title="Search, Calendar, Sessions, Filter"
                onClick={() => this.props.appStore.toggleSearchVisible()}
                selected={this.props.appStore.searchVisible}
            />
        );

        return actions;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItemsSection extends React.Component<{ appStore: AppStore }, {}> {
    reactionDisposer: any;

    componentDidMount() {
        this.reactionDisposer = reaction(
            () => this.props.appStore.deletedItemsHistory.deletedCount,
            deletedCount => {
                if (deletedCount === 0) {
                    this.props.appStore.navigationStore.navigateToTerminal();
                }
            }
        );
    }

    componentWillUnmount() {
        this.reactionDisposer();
    }

    render() {
        return (
            <Splitter
                type="horizontal"
                sizes={this.props.appStore.searchVisible ? "100%|240px" : "100%"}
                persistId={
                    this.props.appStore.searchVisible
                        ? "instrument/window/deleted-history-items/splitter"
                        : undefined
                }
            >
                <div className="EezStudio_DeletedHistory_Container" tabIndex={0}>
                    <HistoryListComponent
                        appStore={this.props.appStore}
                        history={this.props.appStore.deletedItemsHistory}
                    />
                </div>
                {this.props.appStore.searchVisible && (
                    <Search
                        appStore={this.props.appStore}
                        history={this.props.appStore.deletedItemsHistory}
                    />
                )}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function render(appStore: AppStore) {
    return <DeletedHistoryItemsSection appStore={appStore} />;
}

export function renderToolbarButtons(appStore: AppStore) {
    return <DeletedHistoryItemsToolbarButtons appStore={appStore} />;
}
