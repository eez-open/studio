import React from "react";
import { observer } from "mobx-react";

import { compareVersions } from "eez-studio-shared/util";
import { styled } from "eez-studio-ui/styled-components";

import { InstrumentAppStore } from "instrument/window/app-store";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { getConnection } from "instrument/window/connection";

import { FirmwareVersionSection } from "instrument/bb3/components/FirmwareVersionSection";
import { ScriptsSection } from "instrument/bb3/components/scripts-section/ScriptsSection";
import { ModulesSection } from "instrument/bb3/components/modules-section/ModulesSection";
import { ShortcutsSection } from "instrument/bb3/components/ShortcutsSection";
import { LatestHistoryItemSection } from "instrument/bb3/components/LatestHistoryItemSection";

const GRID_GAP = 20;

const StartPageContainer = styled.div`
    margin: 20px;

    display: grid;
    grid-gap: ${GRID_GAP}px;
    align-items: start;

    @media (min-width: 1200px) {
        grid-template-columns: repeat(2, calc(100% / 2 - (2 - 1) * ${GRID_GAP}px / 2));
    }

    @media (min-width: 1600px) {
        grid-template-columns: repeat(3, calc(100% / 3 - (3 - 1) * ${GRID_GAP}px / 3));
    }

    section {
        margin-top: 50px;

        &:first-child {
            margin-top: 0;
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
        console.log(bb3Instrument);

        const isConnected = getConnection(appStore).isConnected;

        return (
            <StartPageContainer>
                <div>
                    {isConnected && <ShortcutsSection appStore={appStore} />}
                    {bb3Instrument.timeOfLastRefresh && (
                        <LatestHistoryItemSection bb3Instrument={bb3Instrument} />
                    )}
                </div>
                <div>
                    {bb3Instrument.timeOfLastRefresh && (
                        <ScriptsSection bb3Instrument={bb3Instrument} />
                    )}
                </div>
                <div>
                    {bb3Instrument.mcu.firmwareVersion && (
                        <FirmwareVersionSection bb3Instrument={bb3Instrument} />
                    )}
                    {bb3Instrument.mcu.firmwareVersion &&
                        compareVersions(bb3Instrument.mcu.firmwareVersion, "1.0") > 0 && (
                            <ModulesSection bb3Instrument={bb3Instrument} />
                        )}
                </div>
            </StartPageContainer>
        );
    }
);
