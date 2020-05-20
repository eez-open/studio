import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

import { ScriptsSectionSelectView } from "instrument/bb3/components/scripts-section/ScriptsSectionSelectView";
import { ScriptsSectionGlobalActions } from "instrument/bb3/components/scripts-section/ScriptsSectionGlobalActions";
import { ScriptsSectionList } from "instrument/bb3/components/scripts-section/ScriptsSectionList";

const HeaderContainer = styled.div`
    display: flex;
    justify-content: flex-start;
    align-items: center;

    div:nth-child(2) {
        flex-grow: 1;
        margin-left: 50px;
    }
`;

export const ScriptsSection = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        return (
            <section>
                <header>
                    <HeaderContainer>
                        <h5>MicroPython Scripts</h5>
                        <ScriptsSectionSelectView instrumentOverview={instrumentOverview} />
                        <ScriptsSectionGlobalActions instrumentOverview={instrumentOverview} />
                    </HeaderContainer>
                </header>
                <div>
                    <ScriptsSectionList scripts={instrumentOverview.selectedScriptsCollection} />
                </div>
            </section>
        );
    }
);
