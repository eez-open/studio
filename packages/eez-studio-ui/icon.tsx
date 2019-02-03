import React from "react";
import { observer } from "mobx-react";
import classnames from "classnames";

const MATERIAL_PREFIX = "material:";

@observer
export class Icon extends React.Component<
    {
        icon: string;
        size?: number;
        className?: string;
        style?: React.CSSProperties;
        onClick?: (event: React.MouseEvent) => void;
    },
    {}
> {
    render() {
        const { icon, size, style, className, onClick } = this.props;

        let iconSize = size || 24;

        if (icon.startsWith(MATERIAL_PREFIX)) {
            let iconClassName = classnames("EezStudio_Icon", "material-icons", className);

            let iconStyle = {
                fontSize: iconSize + "px"
            };
            if (style) {
                iconStyle = Object.assign(iconStyle, style);
            }

            return (
                <i className={iconClassName} style={iconStyle} onClick={onClick}>
                    {icon.slice(MATERIAL_PREFIX.length)}
                </i>
            );
        } else {
            let iconStyle: React.CSSProperties = {
                objectFit: "contain"
            };
            if (style) {
                iconStyle = Object.assign(iconStyle, style);
            }

            return (
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
    }
}
