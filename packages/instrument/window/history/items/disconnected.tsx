import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDuration, formatDateTimeLong } from "eez-studio-shared/util";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "../helper";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DisconnectedHistoryItemComponent extends React.Component<
    {
        appStore: IAppStore;
        historyItem: HistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        error?: string;
        duration?: number;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {
                error: this.props.historyItem.message
            };
        }
    }

    render() {
        return (
            <div className="EezStudio_DisconnectedHistoryItem">
                <p>
                    <small className="EezStudio_HistoryItemDate">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <PreventDraggable tag="span">
                        <span>
                            DISCONNECTED
                            {this.message.duration !== undefined
                                ? " after " +
                                  formatDuration(this.message.duration)
                                : ""}
                        </span>

                        {this.message.error && (
                            <span className="text-danger">
                                / {this.message.error}
                            </span>
                        )}
                    </PreventDraggable>
                </p>
                {this.props.historyItem.getSourceDescriptionElement(
                    this.props.appStore
                )}
            </div>
        );
    }
}

export class DisconnectedHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <DisconnectedHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}
