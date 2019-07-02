import React from "react";

import styled from "eez-studio-ui/styled-components";

import { EezObject, objectToString, getAncestors } from "eez-studio-shared/model/object";

////////////////////////////////////////////////////////////////////////////////

const ObjectPathSpan = styled.span`
    span:not(:first-child) {
        &::before {
            content: " / ";
        }
    }
`;

export class ObjectPath extends React.Component<
    {
        object: EezObject;
    },
    {}
> {
    render() {
        let pathComponents: JSX.Element[] = [];

        let ancestors = getAncestors(this.props.object);
        for (let i = 1; i < ancestors.length; i++) {
            pathComponents.push(<span key={i}>{objectToString(ancestors[i])}</span>);
        }

        return <ObjectPathSpan>{pathComponents}</ObjectPathSpan>;
    }
}
