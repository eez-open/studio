import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { formatDuration, formatDateTimeLong } from "eez-studio-shared/util";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";

////////////////////////////////////////////////////////////////////////////////

export const SessionHistoryItemComponent = observer(
    class SessionHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: SessionHistoryItem;
        },
        {}
    > {
        render() {
            let className = classNames("EezStudio_SessionHistoryItem", {
                EezStudio_HistoryItem_SessionStart:
                    this.props.historyItem.type ===
                    "activity-log/session-start",
                EezStudio_HistoryItem_SessionClose:
                    this.props.historyItem.type === "activity-log/session-close"
            });

            return (
                <div className={className}>
                    <p>
                        <HistoryItemInstrumentInfo
                            appStore={this.props.appStore}
                            historyItem={this.props.historyItem}
                        />
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                        <span className="EezStudio_HistoryItem_SessionName">
                            {this.props.historyItem.getSessionName(
                                this.props.appStore
                            )}
                        </span>
                        <span className="EezStudio_HistoryItem_SessionState">
                            {this.props.historyItem.type ===
                            "activity-log/session-start"
                                ? ` - Started`
                                : ` - Closed, Duration: ${formatDuration(
                                      this.props.historyItem.getDuration(
                                          this.props.appStore
                                      )
                                  )}`}
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

export class SessionHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <SessionHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }

    getSessionName(appStore: IAppStore): string {
        if (this.type === "activity-log/session-start") {
            try {
                return JSON.parse(this.message).sessionName;
            } catch (err) {
                return "";
            }
        } else {
            if (this.sid) {
                const sessionStart = appStore.history.getHistoryItemById(
                    this.sid
                );
                if (sessionStart instanceof SessionHistoryItem) {
                    return sessionStart.getSessionName(appStore);
                }
            }
            return "";
        }
    }

    getDuration(appStore: IAppStore): number {
        if (this.sid) {
            const sessionStart = appStore.history.getHistoryItemById(this.sid);
            if (sessionStart instanceof SessionHistoryItem) {
                return this.date.getTime() - sessionStart.date.getTime();
            }
        }
        return 0;
    }
}
