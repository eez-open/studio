import React from "react";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react";

@observer
export class SvgLabel extends React.Component<
    {
        text: string;
        x: number;
        y: number;
        horizontalAlignement?: "left" | "center" | "right";
        verticalAlignment?: "top" | "center" | "bottom";
        margin?: {
            left?: number;
            top?: number;
            right?: number;
            bottom?: number;
        };
        border?: {
            size?: number;
            color?: string;
            radius?: number;
        };
        padding?: {
            left?: number;
            top?: number;
            right?: number;
            bottom?: number;
        };
        backgroundColor?: string;
        textColor?: string;
    },
    {}
> {
    @observable contentWidth: number = 0;
    @observable contentHeight: number = 0;

    get margin() {
        return {
            left: (this.props.margin && this.props.margin.left) || 0,
            top: (this.props.margin && this.props.margin.top) || 0,
            right: (this.props.margin && this.props.margin.right) || 0,
            bottom: (this.props.margin && this.props.margin.bottom) || 0
        };
    }

    get border() {
        return {
            size:
                this.props.border && this.props.border.size !== undefined
                    ? this.props.border.size
                    : 1,
            color: (this.props.border && this.props.border.color) || "#333",
            radius:
                this.props.border && this.props.border.radius !== undefined
                    ? this.props.border.radius
                    : 4
        };
    }

    get padding() {
        return {
            left: (this.props.padding && this.props.padding.left) || 4,
            top: (this.props.padding && this.props.padding.top) || 2,
            right: (this.props.padding && this.props.padding.right) || 4,
            bottom: (this.props.padding && this.props.padding.bottom) || 2
        };
    }

    get backgroundColor() {
        return this.props.backgroundColor || "#333";
    }

    get textColor() {
        return this.props.textColor || "white";
    }

    render() {
        let { text, x, y, horizontalAlignement, verticalAlignment } = this.props;

        let totalWidth = this.margin.left + this.contentWidth + this.margin.right;
        if (horizontalAlignement === "center") {
            x -= totalWidth / 2;
        } else if (horizontalAlignement === "right") {
            x -= totalWidth;
        }

        let totalHeight = this.margin.top + this.contentHeight + this.margin.bottom;
        if (verticalAlignment === "center") {
            y -= totalHeight / 2;
        } else if (verticalAlignment === "bottom") {
            y -= totalHeight;
        }

        x = Math.round(x + this.margin.left) + 0.5;
        y = Math.round(y + this.margin.top) + 0.5;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={this.contentWidth}
                    height={this.contentHeight}
                    rx={this.border.radius}
                    ry={this.border.radius}
                    fill={this.backgroundColor}
                    stroke={this.border.color}
                    strokeWidth={this.border.size}
                />
                <text
                    ref={ref => {
                        if (ref) {
                            const bbox = ref.getBBox();
                            runInAction(() => {
                                this.contentWidth =
                                    this.padding.left + bbox.width + this.padding.right;
                                this.contentHeight =
                                    this.padding.top + bbox.height + this.padding.bottom;
                            });
                        }
                    }}
                    x={x + this.contentWidth / 2}
                    y={y + this.contentHeight / 2}
                    fill={this.textColor}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                >
                    {text}
                </text>
            </g>
        );
    }
}
