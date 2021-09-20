import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "instrument/window/history/helper";

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

        if (message.trim().startsWith(`"`)) {
            message = message.replace(/\,\"/g, ',\n"');
        }

        let content;
        if (message.length > 1024 && !this.showAll) {
            content = (
                <PreventDraggable tag="div">
                    <pre className={textClassName}>
                        {message.slice(0, 1024)}
                    </pre>
                    <div style={{ margin: "5px 0" }}>
                        <button
                            className="btn btn-sm"
                            onClick={action(() => (this.showAll = true))}
                        >
                            Show all
                        </button>
                    </div>
                </PreventDraggable>
            );
        } else {
            content = (
                <PreventDraggable tag="pre" className={textClassName}>
                    {message}
                </PreventDraggable>
            );
        }

        return (
            <div className="EezStudio_AnswerHistoryItem">
                <p>
                    <small className="EezStudio_HistoryItemDate">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
                {content}
            </div>
        );
    }
}

export class AnswerHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <AnswerHistoryItemComponent historyItem={this} />;
    }
}
