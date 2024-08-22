import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "instrument/window/history/helper";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";

////////////////////////////////////////////////////////////////////////////////

export const UnknownHistoryItemComponent = observer(
    class UnknownHistoryItemComponent extends React.Component<{
        appStore: IAppStore;
        historyItem: HistoryItem;
    }> {
        render() {
            let message = this.props.historyItem.message.trim();

            return (
                <div className="EezStudio_UnknownHistoryItem">
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
                    <PreventDraggable tag="pre">
                        Unknown history item: {message}
                    </PreventDraggable>
                </div>
            );
        }
    }
);

export class UnknownHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <UnknownHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}
