import * as React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { HistoryItem } from "instrument/window/history-item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class RequestHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Request">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                </p>
                <pre>{this.props.historyItem.message}</pre>
            </div>
        );
    }
}

export class RequestHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    get listItemElement(): JSX.Element | null {
        return <RequestHistoryItemComponent historyItem={this} />;
    }
}
