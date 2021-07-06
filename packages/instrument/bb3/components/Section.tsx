import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

const HeaderContainer = styled.header`
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > div:first-child {
        display: flex;
        align-items: center;

        & > i {
            font-size: 28px;
            transform: translateY(2px);
        }

        & > h4 {
            display: inline-block;
            text-transform: uppercase;
            letter-spacing: 0.05rem;
            margin-bottom: 0;
        }
    }
`;

const Body = styled.div`
    & > *:first-child {
        margin-top: 20px;
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
            <section className="shadow rounded">
                <HeaderContainer>
                    <div>
                        <h4 className="text-truncate">{title}</h4>
                    </div>
                    {titleControls}
                </HeaderContainer>
                <Body>{body}</Body>
            </section>
        );
    }
);
