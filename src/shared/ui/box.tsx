import * as React from "react";

export const CONF_BORDER_COLOR = "#d5d5d5";
const CONF_PANEL_BORDER_COLOR = "#e7eaec";

type Size = 0 | 0.5 | 1 | 2;

function getSize(value: Size | Size[] | undefined, multiplyBy: number = 10): string {
    if (Array.isArray(value)) {
        if (value.length === 2) {
            return `${getSize(value[0])} ${getSize(value[1])}`;
        }
        return `${getSize(value[0])} ${getSize(value[1])} ${getSize(value[2])} ${getSize(
            value[3]
        )}`;
    }
    return (value || 0) * multiplyBy + "px";
}

export class Box extends React.Component<
    {
        direction?: "row" | "column";
        tag?: string;
        className?: string;
        style?: React.CSSProperties;
        background?: "panel-header" | "white";
        margin?: Size | Size[];
        border?: "all" | "left" | "top" | "right" | "bottom";
        borderColor?: "lighter";
        padding?: Size | Size[];
        justify?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around";
        align?: "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
        grow?: number;
        shrink?: number;
        scrollable?: boolean;
    },
    {}
> {
    get background() {
        if (this.props.background) {
            if (this.props.background === "panel-header") {
                return "#f0f0f0";
            }
            return this.props.background;
        }
        return "transparent";
    }

    get borderColor() {
        if (this.props.borderColor === "lighter") {
            return CONF_PANEL_BORDER_COLOR;
        }
        return CONF_BORDER_COLOR;
    }

    get borderAttributes() {
        return `1px solid ${this.borderColor}`;
    }

    get grow() {
        if (this.props.grow !== undefined) {
            return this.props.grow;
        }
        if (this.props.scrollable) {
            return 1;
        }
        return 0;
    }

    render() {
        const Element = this.props.tag || "div";

        let style: React.CSSProperties = {
            display: "flex",
            flexDirection: this.props.direction || "row",
            margin: getSize(this.props.margin),
            borderLeft:
                this.props.border === "all" || this.props.border === "left"
                    ? this.borderAttributes
                    : undefined,
            borderTop:
                this.props.border === "all" || this.props.border === "top"
                    ? this.borderAttributes
                    : undefined,
            borderRight:
                this.props.border === "all" || this.props.border === "right"
                    ? this.borderAttributes
                    : undefined,
            borderBottom:
                this.props.border === "all" || this.props.border === "bottom"
                    ? this.borderAttributes
                    : undefined,
            padding: getSize(this.props.padding),
            backgroundColor: this.background,
            justifyContent: this.props.justify,
            alignItems: this.props.align,
            flexGrow: this.grow,
            flexShrink: this.props.shrink || 0,
            overflow: this.props.scrollable ? "auto" : "hidden"
        };

        if (this.props.scrollable && this.props.grow === undefined) {
            style.height = 0;
        }

        Object.assign(style, this.props.style);

        return (
            <Element style={style} className={this.props.className}>
                {this.props.children}
            </Element>
        );
    }
}
