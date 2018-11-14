import * as React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const CreatedHistoryItemDiv = styled(HistoryItemDiv)`
    padding: 0;

    p {
        position: relative;
        padding: 0px 10px;
        display: inline-block;
    }
`;

@observer
export class CreatedHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    get type() {
        if (this.props.historyItem.type === "instrument/restored") {
            return "restored";
        }
        if (this.props.historyItem.type === "instrument/deleted") {
            return "deleted";
        }
        return "created";
    }

    render() {
        return (
            <CreatedHistoryItemDiv>
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
                    <span>Instrument {this.type}!</span>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </CreatedHistoryItemDiv>
        );
    }
}

export class CreatedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <CreatedHistoryItemComponent historyItem={this} />;
    }
}
