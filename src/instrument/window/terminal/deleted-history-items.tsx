import * as React from "react";
import { action, reaction } from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "shared/ui/splitter";
import { IconAction, ButtonAction } from "shared/ui/action";

import { navigationStore, terminalNavigationItem } from "instrument/window/app";
import { appStore } from "instrument/window/app-store";
import { deletedItemsHistory } from "instrument/window/history";

import { ConnectionHistory } from "instrument/window/terminal/connection-history";
import { Search } from "instrument/window/terminal/search";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItemsToolbarButtons extends React.Component {
    render() {
        let actions = [];

        if (deletedItemsHistory.selection.items.length > 0) {
            actions.push(
                <IconAction
                    key="restore"
                    icon="material:restore"
                    title="Restore selected history items"
                    style={{ marginLeft: 20 }}
                    onClick={deletedItemsHistory.restoreSelectedHistoryItems}
                />,
                <IconAction
                    key="purge"
                    icon="material:delete_forever"
                    title="Purge selected history items"
                    onClick={deletedItemsHistory.deleteSelectedHistoryItems}
                />
            );
        }

        actions.push(
            <ButtonAction
                key="deletedItems"
                icon="material:arrow_back"
                text="Back"
                title={"Go back to the terminal"}
                onClick={action(
                    () => (navigationStore.mainNavigationSelectedItem = terminalNavigationItem)
                )}
            />
        );

        actions.push(
            <IconAction
                style={{ marginLeft: 20 }}
                key="search"
                icon="material:search"
                title="Search, Calendar, Sessions, Filter"
                onClick={() => appStore.toggleSearchVisible()}
                selected={appStore.searchVisible}
            />
        );

        return actions;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItems extends React.Component<{}, {}> {
    reactionDisposer: any;

    componentDidMount() {
        this.reactionDisposer = reaction(
            () => deletedItemsHistory.deletedCount,
            deletedCount => {
                if (deletedCount === 0) {
                    navigationStore.mainNavigationSelectedItem = terminalNavigationItem;
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
                sizes={appStore.searchVisible ? "100%|240px" : "100%"}
                persistId={
                    appStore.searchVisible
                        ? "instrument/window/deleted-history-items/splitter"
                        : undefined
                }
            >
                <div className="EezStudio_DeletedHistory_Container" tabIndex={0}>
                    <ConnectionHistory history={deletedItemsHistory} />
                </div>
                {appStore.searchVisible && <Search history={deletedItemsHistory} />}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function render() {
    return <DeletedHistoryItems />;
}

export function renderToolbarButtons() {
    return <DeletedHistoryItemsToolbarButtons />;
}
