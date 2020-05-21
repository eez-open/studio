import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

import { InstrumentAppStore } from "instrument/window/app-store";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { FirmwareVersionSection } from "instrument/bb3/components/FirmwareVersionSection";
import { ScriptsSection } from "instrument/bb3/components/scripts-section/ScriptsSection";
import { ModulesSection } from "instrument/bb3/components/ModulesSection";
import { ShortcutsSection } from "instrument/bb3/components/ShortcutsSection";
import { LatestHistoryItemSection } from "instrument/bb3/components/LatestHistoryItemSection";

const StartPageContainer = styled.div`
    margin: 20px;

    display: grid;
    grid-gap: 20px;
    align-items: start;

    @media (min-width: 1200px) {
        grid-auto-flow: column;
        grid-template-rows: auto auto auto;
        grid-template-columns: repeat(2, calc(100% / 2 - (2 - 1) * 20px / 2));

        & > :nth-child(2) {
            grid-row: span 2;
        }
    }

    @media (min-width: 1600px) {
        grid-template-rows: repeat(10, auto);
        grid-template-columns: repeat(3, calc(100% / 3 - (3 - 1) * 20px / 3));

        & > :nth-child(1) {
            grid-row: 1;
            grid-column: 1;
        }

        & > :nth-child(2) {
            grid-row: 2 / span 9;
            grid-column: 1;
        }

        & > :nth-child(3) {
            grid-row: 1;
            grid-column: 2;
        }

        & > :nth-child(4) {
            grid-row: 2 / span 9;
            grid-column: 2;
        }

        & > :nth-child(5) {
            grid-row: 1 / span 10;
            grid-column: 3;
        }
    }
`;

export const StartPage = observer(
    ({
        appStore,
        bb3Instrument
    }: {
        appStore: InstrumentAppStore;
        bb3Instrument: BB3Instrument;
    }) => {
        return (
            <StartPageContainer>
                <ShortcutsSection appStore={appStore} />
                <LatestHistoryItemSection bb3Instrument={bb3Instrument} />
                <FirmwareVersionSection bb3Instrument={bb3Instrument} />
                <ModulesSection bb3Instrument={bb3Instrument} />
                <ScriptsSection bb3Instrument={bb3Instrument} />
            </StartPageContainer>
        );
    }
);
