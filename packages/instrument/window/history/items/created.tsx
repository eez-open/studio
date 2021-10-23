import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import type { IActivityLogEntry } from "eez-studio-shared/activity-log";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

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
            <div className="EezStudio_CreatedHistoryItem">
                <p>
                    <small className="EezStudio_HistoryItemDate">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>Instrument {this.type}!</span>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
            </div>
        );
    }
}

export class CreatedHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return <CreatedHistoryItemComponent historyItem={this} />;
    }
}
