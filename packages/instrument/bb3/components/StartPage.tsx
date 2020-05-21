import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";
import { Loader } from "eez-studio-ui/loader";

import { InstrumentAppStore } from "instrument/window/app-store";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { FirmwareVersionSection } from "instrument/bb3/components/FirmwareVersionSection";
import { ScriptsSection } from "instrument/bb3/components/scripts-section/ScriptsSection";
import { ModulesSection } from "instrument/bb3/components/ModulesSection";
import { ShortcutsSection } from "instrument/bb3/components/ShortcutsSection";

const StartPageContainer = styled.div`
    margin: 20px;
    display: grid;
    grid-gap: 20px;
    grid-template-columns: calc(50% - 10px) calc(50% - 10px);
    align-items: start;
`;

export const StartPage = observer(
    ({
        appStore,
        bb3Instrument
    }: {
        appStore: InstrumentAppStore;
        bb3Instrument: BB3Instrument;
    }) => {
        if (bb3Instrument.refreshInProgress) {
            return <Loader />;
        }

        return (
            <StartPageContainer>
                <FirmwareVersionSection bb3Instrument={bb3Instrument} />
                <ModulesSection bb3Instrument={bb3Instrument} />
                <ScriptsSection bb3Instrument={bb3Instrument} />
                <ShortcutsSection appStore={appStore} />
            </StartPageContainer>
        );
    }
);
