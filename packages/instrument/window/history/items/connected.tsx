import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import { getConnectionParametersInfo } from "instrument/connection/connection-renderer";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

export const ConnectedHistoryItemComponent = observer(
    class ConnectedHistoryItemComponent extends React.Component<
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
            sessionName?: string;
        } {
            if (!this.props.historyItem.message) {
                return {};
            }

            try {
                return JSON.parse(this.props.historyItem.message);
            } catch (err) {
                return {
                    sessionName: this.props.historyItem.message
                };
            }
        }

        render() {
            return (
                <div className="EezStudio_ConnectedHistoryItem">
                    <p>
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                        <span>
                            CONNECTED
                            {this.message.connectionParameters
                                ? " to " +
                                  getConnectionParametersInfo(
                                      this.message.connectionParameters
                                  )
                                : ""}
                        </span>
                    </p>
                    {this.props.historyItem.getSourceDescriptionElement(
                        this.props.appStore
                    )}
                </div>
            );
        }
    }
);

export class ConnectedHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <ConnectedHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}
