import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDuration, formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const DisconnectedHistoryItemDiv = styled(HistoryItemDiv)`
    padding: 0;

    p {
        position: relative;
        padding: 0px 10px;
        display: inline-block;
    }

    &:before {
        border-top: none;
        top: calc(50% - 15px);
    }

    & > p > span {
        color: orange;
    }
`;

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
            <DisconnectedHistoryItemDiv>
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
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
                {this.props.historyItem.sourceDescriptionElement}
            </DisconnectedHistoryItemDiv>
        );
    }
}

export class DisconnectedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <DisconnectedHistoryItemComponent historyItem={this} />;
    }
}
