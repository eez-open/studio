import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { AppStore } from "instrument/window/app-store";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class AnswerHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    @observable showAll: boolean = false;

    render() {
        let message = this.props.historyItem.message.trim();

        let textClassName;
        if (message.indexOf("**ERROR") != -1) {
            textClassName = "text-danger";
        }

        message = message.replace(/\"\,\"/g, '",\n"');

        let content;
        if (message.length > 1024 && !this.showAll) {
            content = (
                <div>
                    <pre className={textClassName}>{message.slice(0, 1024)}</pre>
                    <div style={{ margin: "5px 0" }}>
                        <button
                            className="btn btn-sm"
                            onClick={action(() => (this.showAll = true))}
                        >
                            Show all
                        </button>
                    </div>
                </div>
            );
        } else {
            content = <pre className={textClassName}>{message}</pre>;
        }

        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Answer">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                </p>
                {content}
            </div>
        );
    }
}

export class AnswerHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore?: AppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <AnswerHistoryItemComponent historyItem={this} />;
    }
}
