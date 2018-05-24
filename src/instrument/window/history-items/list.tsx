import * as React from "react";
import { computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { Toolbar } from "shared/ui/toolbar";
import { IconAction } from "shared/ui/action";
import { Icon } from "shared/ui/icon";

import { navigationStore } from "instrument/window/app";
import { ChartPreview } from "instrument/window/chart-preview";

import { createTableListFromData } from "instrument/window/lists/factory";
import { findListIdByName } from "instrument/window/lists/store-renderer";
import { saveTableListData } from "instrument/window/lists/lists";

import { HistoryItem } from "instrument/window/history-item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ListHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    @computed
    get message() {
        return JSON.parse(this.props.historyItem.message);
    }

    @computed
    get list() {
        if (this.message.listData && this.message.listData.length > 0) {
            return createTableListFromData(Object.assign({}, this.message.listData[0]));
        }

        return null;
    }

    @computed
    get listId() {
        return findListIdByName(this.message.listName);
    }

    @action.bound
    onOpen() {
        if (this.listId) {
            navigationStore.selectedListId = this.listId;
        }
    }

    @bind
    onSave() {
        if (this.list) {
            saveTableListData(this.message.listName, this.list.tableListData);
        }
    }

    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_List">
                <Icon className="mr-3" icon={"material:timeline"} size={48} />
                <div>
                    <p>
                        <small className="EezStudio_HistoryItemDate text-muted">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    <div>
                        {this.message.operation === "get"
                            ? `Instrument list saved as "${this.message.listName}"`
                            : `List "${this.message.listName}" sent to instrument`}
                    </div>
                    {this.message.error && <div className="text-danger">{this.message.error}</div>}
                    {this.list && <ChartPreview data={this.list} />}
                    {
                        <Toolbar>
                            {this.listId && (
                                <IconAction
                                    icon="material:edit"
                                    title="Open List in Editor"
                                    onClick={this.onOpen}
                                />
                            )}
                            {this.list && (
                                <IconAction
                                    icon="material:save"
                                    title="Save List"
                                    onClick={this.onSave}
                                />
                            )}
                        </Toolbar>
                    }
                </div>
            </div>
        );
    }
}

export class ListHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    get listItemElement(): JSX.Element | null {
        return <ListHistoryItemComponent historyItem={this} />;
    }
}
