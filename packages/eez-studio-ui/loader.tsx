import React from "react";
import classnames from "classnames";

export class Loader extends React.Component<
    {
        className?: string;
        size?: number;
        style?: React.CSSProperties;
        centered?: boolean;
        progressPercent?: number;
    },
    {}
> {
    render() {
        let loaderElement;

        if (this.props.progressPercent != undefined) {
            loaderElement = (
                <progress
                    value={this.props.progressPercent}
                    max={100}
                    style={{ width: 200, height: 5 }}
                ></progress>
            );
        } else {
            let className = classnames(
                "EezStudio_Loader",
                this.props.className
            );
            let size = this.props.size || 30;
            let style = Object.assign(
                {},
                {
                    width: size + "px",
                    height: size + "px"
                },
                this.props.style
            );

            loaderElement = <div className={className} style={style} />;
        }

        if (this.props.centered) {
            return (
                <div className="EezStudio_CenteredLoader">{loaderElement}</div>
            );
        }

        return loaderElement;
    }
}
