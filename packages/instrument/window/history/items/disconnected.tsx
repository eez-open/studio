import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDuration, formatDateTimeLong } from "eez-studio-shared/util";
import type { IActivityLogEntry } from "eez-studio-shared/activity-log";

import type { IAppStore } from "instrument/window/history/history";
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
            <div className="EezStudio_DisconnectedHistoryItem">
                <p>
                    <small className="EezStudio_HistoryItemDate">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>
                        DISCONNECTED
                        {this.message.duration !== undefined
                            ? " after " + formatDuration(this.message.duration)
                            : ""}
                    </span>
                    {this.message.error && (
                        <span className="text-danger">
                            / {this.message.error}
                        </span>
                    )}
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </div>
        );
    }
}

export class DisconnectedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return <DisconnectedHistoryItemComponent historyItem={this} />;
    }
}
