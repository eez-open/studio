import React from "react";
import classNames from "classnames";

////////////////////////////////////////////////////////////////////////////////

export class Button extends React.Component<{
    children?: React.ReactNode;
    color: "primary" | "secondary";
    size: "small" | "medium" | "large";
    onClick: () => void;
    style?: React.CSSProperties;
    title?: string;
}> {
    render() {
        const { color, size, onClick, style } = this.props;
        const className = classNames("btn", {
            "btn-sm": size === "small",
            "btn-lg": size === "large",
            "btn-primary": color === "primary",
            "btn-secondary": color === "secondary"
        });

        return (
            <button
                className={className}
                onClick={onClick}
                style={style}
                title={this.props.title}
            >
                {this.props.children}
            </button>
        );
    }
}
