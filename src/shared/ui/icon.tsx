import * as React from "react";
import { observer } from "mobx-react";
import * as classnames from "classnames";

const MATERIAL_PREFIX = "material:";

@observer
export class Icon extends React.Component<
    {
        icon: string;
        size?: number;
        className?: string;
        style?: React.CSSProperties;
    },
    {}
> {
    render() {
        let size = this.props.size || 24;
        if (this.props.icon.startsWith(MATERIAL_PREFIX)) {
            let className = classnames("EezStudio_Icon", "material-icons", this.props.className);

            let style = {
                fontSize: size + "px"
            };

            if (this.props.style) {
                style = Object.assign(style, this.props.style);
            }

            return (
                <i className={className} style={style}>
                    {this.props.icon.slice(MATERIAL_PREFIX.length)}
                </i>
            );
        } else {
            let style: React.CSSProperties = {
                objectFit: "contain"
            };
            return (
                <img
                    src={this.props.icon}
                    width={size}
                    height={size}
                    style={style}
                    className={this.props.className}
                />
            );
        }
    }
}
