import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import { getConnectionParametersInfo } from "instrument/connection/connection-renderer";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "../helper";

////////////////////////////////////////////////////////////////////////////////

export const ConnectFailedHistoryItemComponent = observer(
    class ConnectFailedHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: HistoryItem;
        },
        {}
    > {
        constructor(props: { appStore: IAppStore; historyItem: HistoryItem }) {
            super(props);

            makeObservable(this, {
                message: computed
            });
        }

        get message(): {
            connectionParameters?: any;
            error?: string;
        } {
            if (!this.props.historyItem.message) {
                return {};
            }

            try {
                return JSON.parse(this.props.historyItem.message);
            } catch (err) {
                return {};
            }
        }

        render() {
            return (
                <div className="EezStudio_ConnectFailedHistoryItem">
                    <p>
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                        <PreventDraggable tag="span">
                            <span className="text-danger">
                                CONNECT
                                {this.message.connectionParameters
                                    ? " to " +
                                      getConnectionParametersInfo(
                                          this.message.connectionParameters
                                      )
                                    : " "}{" "}
                                failed
                                {this.message.error &&
                                    ": " + this.message.error}
                            </span>
                        </PreventDraggable>
                    </p>
                    {this.props.historyItem.getSourceDescriptionElement(
                        this.props.appStore
                    )}
                </div>
            );
        }
    }
);

export class ConnectFailedHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <ConnectFailedHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}
