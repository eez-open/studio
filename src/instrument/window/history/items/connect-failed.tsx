import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { getConnectionParametersInfo } from "instrument/window/connection";

import { AppStore } from "instrument/window/app-store";
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
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Disconnected">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span className="text-danger">
                        CONNECT{this.message.connectionParameters
                            ? " to " +
                              getConnectionParametersInfo(this.message.connectionParameters)
                            : " "}{" "}
                        failed
                        {this.message.error && ": " + this.message.error}
                    </span>
                </p>
            </div>
        );
    }
}

export class ConnectFailedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore?: AppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <ConnectFailedHistoryItemComponent historyItem={this} />;
    }
}
