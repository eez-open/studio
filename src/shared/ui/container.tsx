import * as React from "react";
import * as classNames from "classnames";

export class Container extends React.Component<{ className?: string }, {}> {
    render() {
        return (
            <div className={classNames("EezStudio_Container", this.props.className)}>
                {this.props.children}
            </div>
        );
    }
}
