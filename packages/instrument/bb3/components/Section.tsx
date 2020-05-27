import React from "react";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";

const HeaderContainer = styled.header`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

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
                    <div>
                        <h4 className="text-truncate">{title}</h4>
                    </div>
                    {titleControls}
                </HeaderContainer>
                <div>{body}</div>
            </section>
        );
    }
);
