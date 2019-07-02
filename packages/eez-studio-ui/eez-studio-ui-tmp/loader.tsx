import React from "react";
import classnames from "classnames";

export class Loader extends React.Component<
    { className?: string; size?: number; style?: React.CSSProperties },
    {}
> {
    render() {
        let className = classnames("EezStudio_Loader", this.props.className);
        let size = this.props.size || 30;
        let style = Object.assign(
            {},
            {
                width: size + "px",
                height: size + "px"
            },
            this.props.style
        );
        return <div className={className} style={style} />;
    }
}
