import React from "react";
import classNames from "classnames";

////////////////////////////////////////////////////////////////////////////////

export class BootstrapButton extends React.Component<{
    children?: React.ReactNode;
    color: "primary" | "secondary";
    size: "small" | "medium" | "large";
    onClick: () => void;
}> {
    render() {
        const { color, size, onClick } = this.props;
        const className = classNames("btn", {
            "btn-sm": size === "small",
            "btn-lg": size === "large",
            "btn-primary": color === "primary",
            "btn-secondary": color === "secondary"
        });

        return (
            <button className={className} onClick={onClick}>
                {this.props.children}
            </button>
        );
    }
}
