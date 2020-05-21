import React from "react";
import { observer } from "mobx-react";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";

export const LatestHistoryItemSection = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (!bb3Instrument.latestHistoryItem) {
            return null;
        }
        return (
            <Section
                title="Latest history item"
                body={bb3Instrument.latestHistoryItem.listItemElement}
            />
        );
    }
);
