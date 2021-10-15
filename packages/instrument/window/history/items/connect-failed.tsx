import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import type { IActivityLogEntry } from "eez-studio-shared/activity-log";

import { getConnectionParametersInfo } from "instrument/window/connection";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ConnectFailedHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        connectionParameters?: any;
        error?: string;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {};
        }
    }

    render() {
        return (
            <div className="EezStudio_ConnectFailedHistoryItem">
                <p>
                    <small className="EezStudio_HistoryItemDate">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span className="text-danger">
                        CONNECT
                        {this.message.connectionParameters
                            ? " to " +
                              getConnectionParametersInfo(
                                  this.message.connectionParameters
                              )
                            : " "}{" "}
                        failed
                        {this.message.error && ": " + this.message.error}
                    </span>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </div>
        );
    }
}

export class ConnectFailedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    @computed
    get listItemElement(): JSX.Element | null {
        return <ConnectFailedHistoryItemComponent historyItem={this} />;
    }
}
