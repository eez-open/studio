import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { formatDuration, formatDateTimeLong } from "eez-studio-shared/util";
import type { IActivityLogEntry } from "eez-studio-shared/activity-log";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class SessionHistoryItemComponent extends React.Component<
    {
        historyItem: SessionHistoryItem;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_SessionHistoryItem", {
            EezStudio_HistoryItem_SessionStart:
                this.props.historyItem.type === "activity-log/session-start",
            EezStudio_HistoryItem_SessionClose:
                this.props.historyItem.type === "activity-log/session-close"
        });

        return (
            <div className={className}>
                <p>
                    <small className="EezStudio_HistoryItemDate">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span className="EezStudio_HistoryItem_SessionName">
                        {this.props.historyItem.sessionName}
                    </span>
                    <span className="EezStudio_HistoryItem_SessionState">
                        {this.props.historyItem.type ===
                        "activity-log/session-start"
                            ? ` - Started`
                            : ` - Closed, Duration: ${formatDuration(
                                  this.props.historyItem.duration
                              )}`}
                    </span>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </div>
        );
    }
}

export class SessionHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    @computed
    get listItemElement(): JSX.Element | null {
        return <SessionHistoryItemComponent historyItem={this} />;
    }

    @computed
    get sessionName(): string {
        if (this.type === "activity-log/session-start") {
            try {
                return JSON.parse(this.message).sessionName;
            } catch (err) {
                return "";
            }
        } else {
            if (this.sid) {
                const sessionStart = this.appStore.history.getHistoryItemById(
                    this.sid
                );
                if (sessionStart instanceof SessionHistoryItem) {
                    return sessionStart.sessionName;
                }
            }
            return "";
        }
    }

    @computed
    get duration(): number {
        if (this.sid) {
            const sessionStart = this.appStore.history.getHistoryItemById(
                this.sid
            );
            if (sessionStart instanceof SessionHistoryItem) {
                return this.date.getTime() - sessionStart.date.getTime();
            }
        }
        return 0;
    }
}
