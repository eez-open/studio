import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

import { Script } from "instrument/bb3/objects/script";

import { ScriptsSectionListItem } from "instrument/bb3/components/scripts-section/ScriptsSectionListItem";

const Container = styled.div`
    display: flex;
    flex-direction: column;

    & > div {
        padding: 10px;
        border-top: 1px solid ${props => props.theme.borderColor};
    }

    & > div:first-child {
        border-top: 0;
    }
`;

export const ScriptsSectionList = observer(({ scripts }: { scripts: Script[] }) => {
    if (scripts.length == 0) {
        return null;
    }

    return (
        <Container>
            {scripts.map(script => (
                <ScriptsSectionListItem key={script.name} script={script} />
            ))}
        </Container>
    );
});
