import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import { getConnectionParametersInfo } from "instrument/window/connection";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

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
            <HistoryItemDiv className="EezStudio_HistoryItem_Disconnected">
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
                    <span className="text-danger">
                        CONNECT
                        {this.message.connectionParameters
                            ? " to " +
                              getConnectionParametersInfo(this.message.connectionParameters)
                            : " "}{" "}
                        failed
                        {this.message.error && ": " + this.message.error}
                    </span>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </HistoryItemDiv>
        );
    }
}

export class ConnectFailedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <ConnectFailedHistoryItemComponent historyItem={this} />;
    }
}
