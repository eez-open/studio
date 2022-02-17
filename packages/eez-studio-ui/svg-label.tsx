import React from "react";
import { observable, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";

export const SvgLabel = observer(
    class SvgLabel extends React.Component<
        {
            text: string;
            x: number;
            y: number;
            horizontalAlignment?: "left" | "center" | "right";
            verticalAlignment?: "top" | "center" | "bottom";
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
            textWeight?: string;
            rectStyle?: React.CSSProperties;
            textClassName?: string;
        },
        {}
    > {
        myRef = React.createRef<SVGTextElement>();

        contentWidth: number = 0;
        contentHeight: number = 0;

        constructor(props: {
            text: string;
            x: number;
            y: number;
            horizontalAlignment?: "left" | "center" | "right";
            verticalAlignment?: "top" | "center" | "bottom";
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
            textWeight?: string;
            rectStyle?: React.CSSProperties;
            textClassName?: string;
        }) {
            super(props);

            makeObservable(this, {
                contentWidth: observable,
                contentHeight: observable
            });
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

        get textWeight() {
            return this.props.textWeight || "normal";
        }

        componentDidMount() {
            if (this.myRef.current) {
                const bbox = this.myRef.current.getBBox();

                const contentWidth =
                    this.padding.left + bbox.width + this.padding.right;

                const contentHeight =
                    this.padding.top + bbox.height + this.padding.bottom;

                if (
                    contentWidth != this.contentWidth ||
                    contentHeight != this.contentHeight
                ) {
                    runInAction(() => {
                        this.contentWidth = contentWidth;
                        this.contentHeight = contentHeight;
                    });
                }
            }
        }

        componentDidUpdate() {
            setTimeout(() => this.componentDidMount(), 10);
        }

        render() {
            let {
                text,
                x,
                y,
                horizontalAlignment: horizontalAlignment,
                verticalAlignment
            } = this.props;

            if (horizontalAlignment === "center") {
                x -= this.contentWidth / 2;
            } else if (horizontalAlignment === "right") {
                x -= this.contentWidth;
            }

            if (verticalAlignment === "center") {
                y -= this.contentHeight / 2;
            } else if (verticalAlignment === "bottom") {
                y -= this.contentHeight;
            }

            x = Math.round(x) + 0.5;
            y = Math.round(y) + 0.5;

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
                        style={this.props.rectStyle}
                    />
                    <text
                        ref={this.myRef}
                        x={x + this.contentWidth / 2}
                        y={y + this.contentHeight / 2}
                        fill={this.textColor}
                        fontWeight={this.textWeight}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className={this.props.textClassName}
                    >
                        {text}
                    </text>
                </g>
            );
        }
    }
);
