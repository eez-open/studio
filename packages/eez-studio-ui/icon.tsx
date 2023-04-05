import React from "react";
import { observer } from "mobx-react";
import classnames from "classnames";

const MATERIAL_PREFIX = "material:";

export const Icon = observer(
    class Icon extends React.Component<
        {
            icon: string | JSX.Element | React.ReactNode;
            size?: number;
            className?: string;
            style?: React.CSSProperties;
            onClick?: (event: React.MouseEvent) => void;
            overlayText?: string;
            attention?: boolean;
            title?: string;
        },
        {}
    > {
        render() {
            const { icon, size, style, className, onClick } = this.props;

            let iconSize = size || 24;

            let result;

            if (typeof icon === "string") {
                if (icon.startsWith(MATERIAL_PREFIX)) {
                    let iconClassName = classnames(
                        "EezStudio_Icon",
                        "material-icons",
                        className
                    );

                    let iconStyle = {
                        fontSize: iconSize + "px"
                    };
                    if (style) {
                        iconStyle = Object.assign(iconStyle, style);
                    }

                    const iconEl = (
                        <i
                            className={iconClassName}
                            style={iconStyle}
                            onClick={onClick}
                            title={this.props.title}
                        >
                            {icon.slice(MATERIAL_PREFIX.length)}
                        </i>
                    );

                    if (this.props.overlayText) {
                        result = (
                            <div className="EezStudio_IconWithOverlayContainer">
                                {iconEl}
                                <span className="EezStudio_IconOverlay">
                                    {this.props.overlayText}
                                </span>
                            </div>
                        );
                    } else {
                        result = iconEl;
                    }
                } else {
                    let iconStyle: React.CSSProperties = {
                        objectFit: "contain"
                    };
                    if (style) {
                        iconStyle = Object.assign(iconStyle, style);
                    }

                    result = (
                        <img
                            src={icon}
                            width={iconSize}
                            height={iconSize}
                            className={className}
                            style={iconStyle}
                            onClick={onClick}
                            title={this.props.title}
                        />
                    );
                }
            } else {
                result = React.cloneElement(icon as React.ReactElement<any>, {
                    className: classnames("EezStudio_Icon", className),
                    style,
                    width: iconSize,
                    height: iconSize,
                    onClick: onClick,
                    title: this.props.title
                });
            }

            if (this.props.attention) {
                return (
                    <div className="EezStudio_AttentionContainer">
                        {result}
                        <div className="EezStudio_AttentionDiv" />
                    </div>
                );
            }

            return result;
        }
    }
);
