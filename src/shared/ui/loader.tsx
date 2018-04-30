import * as React from "react";
import * as classnames from "classnames";

export class Loader extends React.Component<{ className?: string; size?: number }, {}> {
    render() {
        let className = classnames("EezStudio_Loader", this.props.className);
        let size = this.props.size || 30;
        let style = {
            width: size + "px",
            height: size + "px"
        };
        return <div className={className} style={style} />;
    }
}
