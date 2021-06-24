import React from "react";
import { observer } from "mobx-react";
import classnames from "classnames";

import styled from "eez-studio-ui/styled-components";

const MATERIAL_PREFIX = "material:";

const IconWithOverlayContainer = styled.span`
    position: relative;
`;

const IconOverlay = styled.span`
    display: inline-block;
    position: absolute;
    font-size: 8px;
    line-height: 12px;
    font-weight: bold;
    background-color: #eee;
    border: 1px solid #bbb;
    padding: 0 1px;
    left: 12px;
    top: 12px;
`;

const AttentionContainer = styled.div`
    display: inline-block;
    position: relative;
`;

const AttentionDiv = styled.div`
    position: absolute;
    width: 6px;
    height: 6px;
    bottom: -2px;
    right: -2px;
    background-color: red;
    border-radius: 3px;
    box-shadow: 0px 0px 6px 2px rgba(255, 0, 0, 0.3);
`;

@observer
export class Icon extends React.Component<
    {
        icon: string | JSX.Element;
        size?: number;
        className?: string;
        style?: React.CSSProperties;
        onClick?: (event: React.MouseEvent) => void;
        overlayText?: string;
        attention?: boolean;
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
                    >
                        {icon.slice(MATERIAL_PREFIX.length)}
                    </i>
                );

                if (this.props.overlayText) {
                    result = (
                        <IconWithOverlayContainer>
                            {iconEl}
                            <IconOverlay>{this.props.overlayText}</IconOverlay>
                        </IconWithOverlayContainer>
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
                    />
                );
            }
        } else {
            result = React.cloneElement(icon, {
                className: classnames("EezStudio_Icon", className),
                style,
                width: iconSize,
                height: iconSize,
                onClick: onClick
            });
        }

        if (this.props.attention) {
            return (
                <AttentionContainer>
                    {result}
                    <AttentionDiv />
                </AttentionContainer>
            );
        }

        return result;
    }
}
