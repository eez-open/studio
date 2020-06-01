import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";

const Container = styled.div`
    & > div {
        margin: 0;
        max-width: initial;
        overflow: auto;
    }
`;

export const LatestHistoryItemSection = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (!bb3Instrument.latestHistoryItem) {
            return null;
        }
        return (
            <Section
                title="Latest history event"
                body={<Container>{bb3Instrument.latestHistoryItem.listItemElement}</Container>}
            />
        );
    }
);
