import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const RequestHistoryItemDiv = styled(HistoryItemDiv)`
    background-color: beige;
    max-width: 100%;
    pre {
        user-select: text;
    }
`;

@observer
export class RequestHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    render() {
        return (
            <RequestHistoryItemDiv>
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
                <pre>{this.props.historyItem.message}</pre>
            </RequestHistoryItemDiv>
        );
    }
}

export class RequestHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <RequestHistoryItemComponent historyItem={this} />;
    }
}
