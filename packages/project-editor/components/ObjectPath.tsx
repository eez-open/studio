import React from "react";

import {
    IEezObject,
    objectToString,
    getAncestors
} from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

export class ObjectPath extends React.Component<
    {
        object: IEezObject;
    },
    {}
> {
    render() {
        let pathComponents: JSX.Element[] = [];

        let ancestors = getAncestors(this.props.object);
        for (let i = 1; i < ancestors.length; i++) {
            pathComponents.push(
                <span key={i}>{objectToString(ancestors[i])}</span>
            );
        }

        return (
            <span className="EezStudio_ObjectPathSpan">{pathComponents}</span>
        );
    }
}
