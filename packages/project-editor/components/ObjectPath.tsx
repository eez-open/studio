import React from "react";

import styled from "eez-studio-ui/styled-components";

import { objectToString, getAncestors } from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

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
