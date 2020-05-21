import React from "react";
import { observer } from "mobx-react";

import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

import { Section } from "instrument/bb3/components/Section";
import { ScriptsSectionSelectView } from "instrument/bb3/components/scripts-section/ScriptsSectionSelectView";
import { ScriptsSectionGlobalActions } from "instrument/bb3/components/scripts-section/ScriptsSectionGlobalActions";
import { ScriptsSectionList } from "instrument/bb3/components/scripts-section/ScriptsSectionList";

import { styled } from "eez-studio-ui/styled-components";

const HeaderControls = styled.div`
    margin-left: 50px;
    flex-grow: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

export const ScriptsSection = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        return (
            <Section
                title="MicroPython Scripts"
                titleControls={
                    <HeaderControls>
                        <ScriptsSectionSelectView instrumentOverview={instrumentOverview} />
                        <ScriptsSectionGlobalActions instrumentOverview={instrumentOverview} />
                    </HeaderControls>
                }
                body={<ScriptsSectionList scripts={instrumentOverview.selectedScriptsCollection} />}
            />
        );
    }
);
