import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { formatDuration, formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { IAppStore } from "instrument/window/history/history";
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
        let className = classNames("EezStudio_HistoryItem EezStudio_HistoryItem_Session", {
            EezStudio_HistoryItem_SessionStart:
                this.props.historyItem.type === "activity-log/session-start",
            EezStudio_HistoryItem_SessionClose:
                this.props.historyItem.type === "activity-log/session-close"
        });

        return (
            <div className={className}>
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span className="EezStudio_HistoryItem_SessionName">
                        {this.props.historyItem.sessionName}
                    </span>
                    <span className="EezStudio_HistoryItem_SessionState">
                        {this.props.historyItem.type === "activity-log/session-start"
                            ? ` - Started`
                            : ` - Closed, Duration: ${formatDuration(
                                  this.props.historyItem.duration
                              )}`}
                    </span>
                </p>
            </div>
        );
    }
}

export class SessionHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, private appStore: IAppStore) {
        super(activityLogEntry);
    }

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
                const sessionStart = this.appStore.history.getHistoryItemById(this.sid);
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
            const sessionStart = this.appStore.history.getHistoryItemById(this.sid);
            if (sessionStart instanceof SessionHistoryItem) {
                return this.date.getTime() - sessionStart.date.getTime();
            }
        }
        return 0;
    }
}
