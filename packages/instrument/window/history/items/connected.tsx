import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";

import { getConnectionParametersInfo } from "instrument/window/connection";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const ConnectedHistoryItemDiv = styled(HistoryItemDiv)`
    padding: 0;

    p {
        position: relative;
        padding: 0px 10px;
        display: inline-block;
    }

    & > p > span {
        color: darkgreen;
    }
`;

@observer
export class ConnectedHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        connectionParameters?: any;
        sessionName?: string;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {
                sessionName: this.props.historyItem.message
            };
        }
    }

    render() {
        return (
            <ConnectedHistoryItemDiv>
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
                    <span>
                        CONNECTED
                        {this.message.connectionParameters
                            ? " to " +
                              getConnectionParametersInfo(this.message.connectionParameters)
                            : ""}
                    </span>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </ConnectedHistoryItemDiv>
        );
    }
}

export class ConnectedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <ConnectedHistoryItemComponent historyItem={this} />;
    }
}
