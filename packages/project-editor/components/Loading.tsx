import React from "react";

import { styled, keyframes } from "eez-studio-ui/styled-components";

const ContainerDiv = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
`;

const load1 = keyframes`
    0%,
    80%,
    100% {
        box-shadow: 0 0;
        height: 4em;
    }
    40% {
        box-shadow: 0 -2em;
        height: 5em;
    }
`;

const LoaderDiv = styled.div`
    background: #454545;
    animation: ${load1} 1s infinite ease-in-out;
    width: 1em;
    height: 4em;

    color: #454545;
    text-indent: -9999em;
    position: relative;
    font-size: 11px;
    transform: translateZ(0);
    transform: translateZ(0);
    animation-delay: -0.16s;

    &:before,
    &:after {
        background: #454545;
        animation: ${load1} 1s infinite ease-in-out;
        width: 1em;
        height: 4em;
        position: absolute;
        top: 0;
        content: "";
    }

    &:before {
        left: -1.5em;
        animation-delay: -0.32s;
    }

    &:after {
        left: 1.5em;
    }
`;

export class Loading extends React.Component<
    {
        size?: number;
    },
    {}
> {
    render() {
        let size = this.props.size || 10;
        return (
            <ContainerDiv style={{ height: 8 * size }}>
                <LoaderDiv style={{ fontSize: size }} />
            </ContainerDiv>
        );
    }
}
