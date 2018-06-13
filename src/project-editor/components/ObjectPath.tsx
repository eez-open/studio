import * as React from "react";

import { objectToString, getAncestors } from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

////////////////////////////////////////////////////////////////////////////////

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

        return <span className="EezStudio_ProjectEditor_item-path">{pathComponents}</span>;
    }
}
