import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDuration, formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DisconnectedHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        error?: string;
        duration?: number;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {
                error: this.props.historyItem.message
            };
        }
    }

    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Disconnected">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>
                        DISCONNECTED
                        {this.message.duration !== undefined
                            ? " after " + formatDuration(this.message.duration)
                            : ""}
                    </span>
                    {this.message.error && (
                        <span className="text-danger">/ {this.message.error}</span>
                    )}
                </p>
            </div>
        );
    }
}

export class DisconnectedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    get listItemElement(): JSX.Element | null {
        return <DisconnectedHistoryItemComponent historyItem={this} />;
    }
}
