import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";

@observer
export class LatestHistoryItemSection extends React.Component<{
    bb3Instrument: BB3Instrument;
}> {
    @computed get listItemElement() {
        return this.props.bb3Instrument.latestHistoryItem!.getListItemElement(
            this.props.bb3Instrument.appStore
        );
    }

    render() {
        if (!this.props.bb3Instrument.latestHistoryItem) {
            return null;
        }

        return (
            <Section
                title="Latest history event"
                body={
                    <div className="EezStudio_LatestHistoryItemSection">
                        {this.listItemElement}
                    </div>
                }
            />
        );
    }
}
