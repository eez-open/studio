import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

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

export const ScriptsSection = observer(({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
    return (
        <Section
            title="MicroPython Scripts"
            titleControls={
                <HeaderControls>
                    <ScriptsSectionSelectView bb3Instrument={bb3Instrument} />
                    <ScriptsSectionGlobalActions bb3Instrument={bb3Instrument} />
                </HeaderControls>
            }
            body={
                bb3Instrument.refreshInProgress ? (
                    <Loader />
                ) : (
                    <ScriptsSectionList scripts={bb3Instrument.selectedScriptsCollection} />
                )
            }
        />
    );
});
