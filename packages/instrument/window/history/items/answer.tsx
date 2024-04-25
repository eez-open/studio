import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "instrument/window/history/helper";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import classNames from "classnames";

////////////////////////////////////////////////////////////////////////////////

export const AnswerHistoryItemComponent = observer(
    class AnswerHistoryItemComponent extends React.Component<{
        appStore: IAppStore;
        historyItem: HistoryItem;
    }> {
        render() {
            let message = this.props.historyItem.message.trim();

            return (
                <div className="EezStudio_AnswerHistoryItem">
                    <p>
                        <HistoryItemInstrumentInfo
                            appStore={this.props.appStore}
                            historyItem={this.props.historyItem}
                        />
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    {this.props.historyItem.getSourceDescriptionElement(
                        this.props.appStore
                    )}
                    <PreventDraggable
                        tag="pre"
                        className={classNames({
                            "text-danger": message.indexOf("**ERROR") != -1
                        })}
                    >
                        {message}
                    </PreventDraggable>
                </div>
            );
        }
    }
);

export class AnswerHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <AnswerHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}
