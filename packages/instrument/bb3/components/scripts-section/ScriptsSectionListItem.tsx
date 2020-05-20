import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

import { Script } from "instrument/bb3/objects/Script";

import { SelectScriptVersion } from "instrument/bb3/components/scripts-section/SelectScriptVersion";
import { ScriptActions } from "instrument/bb3/components/scripts-section/ScriptActions";

const TitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const ContentContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > div {
        &:first-child {
            flex-grow: 1;
        }

        & > button {
            margin: 5px;
            &:first-child {
                margin-left: 0;
            }
            &:last-child {
                margin-right: 0;
            }
        }
    }
`;

export const ScriptsSectionListItem = observer(({ script }: { script: Script }) => {
    return (
        <div>
            <TitleContainer>
                <h5>{script.name}</h5>
                <SelectScriptVersion script={script} />
            </TitleContainer>
            <ContentContainer>
                <div className="text-secondary">{script.description}</div>
                <ScriptActions script={script} />
            </ContentContainer>
        </div>
    );
});
