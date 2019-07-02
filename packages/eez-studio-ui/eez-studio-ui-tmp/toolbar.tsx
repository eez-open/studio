import React from "react";
import { observer } from "mobx-react";
import classnames from "classnames";

@observer
export class Toolbar extends React.Component<
    {
        className?: string;
    },
    {}
> {
    render() {
        let className = classnames("EezStudio_Toolbar", this.props.className);

        return <div className={className}>{this.props.children}</div>;
    }
}
