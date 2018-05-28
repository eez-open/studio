import * as React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { AppStore } from "instrument/window/app-store";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class CreatedHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Created">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>Instrument created!</span>
                </p>
            </div>
        );
    }
}

export class CreatedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore?: AppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <CreatedHistoryItemComponent historyItem={this} />;
    }
}
