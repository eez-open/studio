import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";

////////////////////////////////////////////////////////////////////////////////

export const CreatedHistoryItemComponent = observer(
    class CreatedHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
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
                        <HistoryItemInstrumentInfo
                            appStore={this.props.appStore}
                            historyItem={this.props.historyItem}
                        />
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                        <span>Instrument {this.type}!</span>
                    </p>
                    {this.props.historyItem.getSourceDescriptionElement(
                        this.props.appStore
                    )}
                </div>
            );
        }
    }
);

export class CreatedHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <CreatedHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}
