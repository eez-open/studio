import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

const HeaderContainer = styled.header`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;

    & > h4 {
        text-transform: uppercase;
        letter-spacing: 0.05rem;
        margin-bottom: 0;
    }
`;

export const Section = observer(
    ({
        title,
        titleControls,
        body
    }: {
        title: React.ReactNode;
        titleControls?: React.ReactNode;
        body: React.ReactNode;
    }) => {
        return (
            <section>
                <HeaderContainer>
                    <h4 className="text-truncate">{title}</h4>
                    {titleControls}
                </HeaderContainer>
                <div>{body}</div>
            </section>
        );
    }
);
