import React from "react";
import { observer } from "mobx-react";

import type { IAppStore } from "instrument/window/history/history";
import type { HistoryItem } from "instrument/window/history/item";
import { instruments } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

export const HistoryItemInstrumentInfo = observer(
    class AnswerHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: HistoryItem;
        },
        {}
    > {
        render() {
            let instrument;
            if (this.props.appStore.oids) {
                instrument = instruments.get(this.props.historyItem.oid);
            }

            if (!instrument) {
                return null;
            }

            return (
                <span className="EezStudio_HistoryItemInstrumentInfo">
                    [{instrument.name}]
                </span>
            );
        }
    }
);
