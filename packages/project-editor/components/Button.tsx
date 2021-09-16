import React from "react";

export class Button extends React.Component<
    {
        title: string;
        materialIcon?: string;
        customIcon?: any;
        iconSize?: number;
        onClick: (event: any) => void;
        active?: boolean;
        disabled?: boolean;
    },
    {}
> {
    static defaultProps = {
        disabled: false
    };

    render() {
        let className = "btn btn-xs btn-default EezStudio_Button";
        if (this.props.active) {
            className += " active";
        }

        let contentStyle = {
            fontSize: this.props.iconSize || (this.props.materialIcon ? 24 : 14)
        };

        let content;
        if (this.props.materialIcon) {
            content = (
                <i className="material-icons" style={contentStyle}>
                    {this.props.materialIcon}
                </i>
            );
        } else if (this.props.customIcon) {
            content = this.props.customIcon;
        } else {
            content = <span style={contentStyle}>{this.props.title}</span>;
        }

        return (
            <button
                type="button"
                className={className}
                title={this.props.title}
                onClick={this.props.onClick}
                disabled={this.props.disabled}
            >
                {content}
            </button>
        );
    }
}
