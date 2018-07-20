import * as React from "react";
import * as classNames from "classnames";

export class Header extends React.Component<
    {
        className?: string;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_Header", this.props.className);
        return <div className={className}>{this.props.children}</div>;
    }
}

export class ToolbarHeader extends React.Component<
    {
        className?: string;
    },
    {}
> {
    render() {
        let className = classNames(
            "EezStudio_Header",
            "EezStudio_ToolbarHeader",
            "EezStudio_Toolbar",
            this.props.className
        );
        return <div className={className}>{this.props.children}</div>;
    }
}

export class Body extends React.Component<
    {
        className?: string;
        tabIndex?: number;
        visible?: boolean;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_Body", this.props.className);

        let style: React.CSSProperties = {};
        if (this.props.visible !== undefined) {
            style.display = this.props.visible ? "flex" : "none";
        }

        return (
            <div className={className} style={style} tabIndex={this.props.tabIndex}>
                {this.props.children}
            </div>
        );
    }
}

class HeaderWithBody extends React.Component<
    {
        className?: string;
        onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_HeaderWithBody", this.props.className);
        return (
            <div className={className} onContextMenu={this.props.onContextMenu}>
                {this.props.children}
            </div>
        );
    }
}

export class VerticalHeaderWithBody extends React.Component<
    {
        className?: string;
        onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_HeaderWithBody_Vertical", this.props.className);
        return (
            <HeaderWithBody className={className} onContextMenu={this.props.onContextMenu}>
                {this.props.children}
            </HeaderWithBody>
        );
    }
}

export class HorizontalHeaderWithBody extends React.Component<
    {
        className?: string;
    },
    {}
> {
    render() {
        let className = classNames("EezStudio_HeaderWithBody_Horizontal", this.props.className);
        return <HeaderWithBody className={className}>{this.props.children}</HeaderWithBody>;
    }
}
