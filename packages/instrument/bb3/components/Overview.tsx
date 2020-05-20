import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";
import { Loader } from "eez-studio-ui/loader";

import { InstrumentAppStore } from "instrument/window/app-store";
import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

import { FirmwareVersionSection } from "instrument/bb3/components/FirmwareVersionSection";
import { ScriptsSection } from "instrument/bb3/components/scripts-section/ScriptsSection";
import { ModulesSection } from "instrument/bb3/components/ModulesSection";
import { ShortcutsSection } from "instrument/bb3/components/ShortcutsSection";

const OverviewContainer = styled.div`
    margin: 20px;
    display: grid;
    grid-gap: 20px;
    grid-template-columns: calc(50% - 10px) calc(50% - 10px);
    align-items: start;

    & > section {
        border-radius: 3px;
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2);

        & > header {
            padding: 5px;
            padding-left: 10px;
            background-color: ${props => props.theme.panelHeaderColor};
            h5 {
                text-transform: uppercase;
                margin-bottom: 0;
            }
        }

        & > div {
        }
    }

    .table {
        margin-bottom: 0;
    }
`;

export const Overview = observer(
    ({
        appStore,
        instrumentOverview
    }: {
        appStore: InstrumentAppStore;
        instrumentOverview: InstrumentOverview;
    }) => {
        if (instrumentOverview.refreshInProgress) {
            return <Loader />;
        }

        return (
            <OverviewContainer>
                <FirmwareVersionSection instrumentOverview={instrumentOverview} />
                <ModulesSection instrumentOverview={instrumentOverview} />
                <ScriptsSection instrumentOverview={instrumentOverview} />
                <ShortcutsSection appStore={appStore} />
            </OverviewContainer>
        );
    }
);
