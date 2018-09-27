import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { formatDuration, formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import styled from "shared/ui/styled-components";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const AnswerHistoryItemDiv = styled(HistoryItemDiv)`
    &.EezStudio_HistoryItem_SessionStart {
        margin-top: 10px;
        padding-top: 10px;
        padding-bottom: 40px;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        background: linear-gradient(rgba(0, 255, 0, 0.1), rgba(0, 255, 0, 0));
    }

    &.EezStudio_HistoryItem_SessionClose {
        margin-bottom: 10px;
        padding-top: 40px;
        padding-bottom: 10px;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
        background: linear-gradient(rgba(255, 0, 0, 0), rgba(255, 0, 0, 0.1));
    }

    .EezStudio_HistoryItemDate {
        color: #333 !important;
    }

    .EezStudio_HistoryItem_SessionName {
        padding-left: 10px;
        color: #333;
        font-size: 110%;
        font-weight: bold;
    }
`;

@observer
export class SessionHistoryItemComponent extends React.Component<
    {
        historyItem: SessionHistoryItem;
    },
    {}
> {
    render() {
        let className = classNames({
            EezStudio_HistoryItem_SessionStart:
                this.props.historyItem.type === "activity-log/session-start",
            EezStudio_HistoryItem_SessionClose:
                this.props.historyItem.type === "activity-log/session-close"
        });

        return (
            <AnswerHistoryItemDiv className={className}>
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
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
                {this.props.historyItem.sourceDescriptionElement}
            </AnswerHistoryItemDiv>
        );
    }
}

export class SessionHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
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
