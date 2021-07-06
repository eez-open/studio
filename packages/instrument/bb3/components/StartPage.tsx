import React from "react";
import { observer } from "mobx-react";

import { compareVersions } from "eez-studio-shared/util";
import { styled } from "eez-studio-ui/styled-components";

import { InstrumentAppStore } from "instrument/window/app-store";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { getConnection } from "instrument/window/connection";

import { FirmwareVersionSection } from "instrument/bb3/components/FirmwareVersionSection";
import { ShortcutsSection } from "instrument/bb3/components/ShortcutsSection";
import { ModulesSection } from "instrument/bb3/components/modules-section/ModulesSection";
import { ScriptsSection } from "instrument/bb3/components/scripts-section/ScriptsSection";
import { ListsSection } from "instrument/bb3/components/lists-section/ListsSection";
import { LatestHistoryItemSection } from "instrument/bb3/components/LatestHistoryItemSection";

const GRID_GAP = 40;

const StartPageContainer = styled.div`
    padding: ${GRID_GAP / 2}px;

    display: grid;
    grid-gap: ${GRID_GAP}px;
    align-items: start;

    @media (min-width: 1200px) {
        grid-template-columns: repeat(
            2,
            calc(100% / 2 - (2 - 1) * ${GRID_GAP}px / 2)
        );
    }

    section {
        margin-top: ${GRID_GAP}px;

        padding: ${GRID_GAP / 2}px;

        &:first-child {
            margin-top: 0;
        }
    }

    .EezStudio_Toolbar {
        background-color: transparent !important;
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
        const isConnected = getConnection(appStore).isConnected;

        if (!bb3Instrument.timeOfLastRefresh) {
            return null;
        }

        return (
            <StartPageContainer>
                <div>
                    {isConnected && <ShortcutsSection appStore={appStore} />}
                    <LatestHistoryItemSection bb3Instrument={bb3Instrument} />
                    {bb3Instrument.mcu.firmwareVersion && (
                        <FirmwareVersionSection bb3Instrument={bb3Instrument} />
                    )}
                    {bb3Instrument.mcu.firmwareVersion &&
                        compareVersions(
                            bb3Instrument.mcu.firmwareVersion,
                            "1.0"
                        ) > 0 && (
                            <ModulesSection
                                bb3Instrument={bb3Instrument}
                                appStore={appStore}
                            />
                        )}
                </div>
                <div>
                    {isConnected && (
                        <ScriptsSection bb3Instrument={bb3Instrument} />
                    )}
                    {isConnected && (
                        <ListsSection bb3Instrument={bb3Instrument} />
                    )}
                </div>
            </StartPageContainer>
        );
    }
);
