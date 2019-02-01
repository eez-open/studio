import React from "react";
import { observable, computed, reaction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { Rect } from "eez-studio-shared/geometry";

import { PropertyType, PropertyInfo, getProperty } from "eez-studio-shared/model/object";

import { PropertyProps } from "eez-studio-shared/model/components/PropertyGrid";

////////////////////////////////////////////////////////////////////////////////

const PIN_TO_LEFT = 1;
const PIN_TO_RIGHT = 2;
const PIN_TO_TOP = 4;
const PIN_TO_BOTTOM = 8;

const FIX_WIDTH = 1;
const FIX_HEIGHT = 2;

export interface IResizing {
    pinToEdge: number;
    fixSize: number;
}

////////////////////////////////////////////////////////////////////////////////

export function resizeWidget(
    rectWidgetOriginal: Rect,
    rectContainerOriginal: Rect,
    rectContainer: Rect,
    resizing?: IResizing
) {
    const pinToLeft = resizing && resizing.pinToEdge & PIN_TO_LEFT;
    const pinToRight = resizing && resizing.pinToEdge & PIN_TO_RIGHT;
    const pinToTop = resizing && resizing.pinToEdge & PIN_TO_TOP;
    const pinToBottom = resizing && resizing.pinToEdge & PIN_TO_BOTTOM;

    const fixedWidth = resizing && resizing.fixSize & FIX_WIDTH;
    const fixedHeight = resizing && resizing.fixSize & FIX_HEIGHT;

    let left = rectWidgetOriginal.left;
    let right = rectWidgetOriginal.left + rectWidgetOriginal.width;

    if (pinToLeft) {
        // left = left;
    } else {
        if (!fixedWidth) {
            left = (rectWidgetOriginal.left * rectContainer.width) / rectContainerOriginal.width;
        }
    }

    if (pinToRight) {
        right = rectContainer.width - (rectContainerOriginal.width - right);
    } else {
        if (!fixedWidth) {
            right = (right * rectContainer.width) / rectContainerOriginal.width;
        }
    }

    if (fixedWidth) {
        if (pinToLeft && !pinToRight) {
            right = left + rectWidgetOriginal.width;
        } else if (pinToRight && !pinToLeft) {
            left = right - rectWidgetOriginal.width;
        } else if (!pinToLeft && !pinToRight) {
            const center =
                ((rectWidgetOriginal.left + rectWidgetOriginal.width / 2) * rectContainer.width) /
                rectContainerOriginal.width;
            left = center - rectWidgetOriginal.width / 2;
            right = left + rectWidgetOriginal.width;
        }
    }

    let top = rectWidgetOriginal.top;
    let bottom = rectWidgetOriginal.top + rectWidgetOriginal.height;

    if (pinToTop) {
        //top = top;
    } else {
        if (!fixedHeight) {
            top = (rectWidgetOriginal.top * rectContainer.height) / rectContainerOriginal.height;
        }
    }

    if (pinToBottom) {
        bottom = rectContainer.height - (rectContainerOriginal.height - bottom);
    } else {
        if (!fixedHeight) {
            bottom = (bottom * rectContainer.height) / rectContainerOriginal.height;
        }
    }

    if (fixedHeight) {
        if (pinToTop && !pinToBottom) {
            bottom = top + rectWidgetOriginal.height;
        } else if (pinToBottom && !pinToTop) {
            top = bottom - rectWidgetOriginal.height;
        } else if (!pinToTop && !pinToBottom) {
            const center =
                ((rectWidgetOriginal.top + rectWidgetOriginal.height / 2) * rectContainer.height) /
                rectContainerOriginal.height;
            top = center - rectWidgetOriginal.height / 2;
            bottom = top + rectWidgetOriginal.height;
        }
    }

    return {
        left,
        top,
        width: right - left,
        height: bottom - top
    };
}

////////////////////////////////////////////////////////////////////////////////

const X1 = 5.5;
const Y1 = 0.5;
const W = 80;
const H = 60;
const G1 = 4;
const G2 = 20;
const X2 = X1 + W + G2;
const X3 = X2 + W + G2;
const TH = 20;
const LH = 10;

const G3 = 4;
const WL1 = 16;
const HL1 = 10;
const WL2 = 8;
const HL2 = Math.max(W, H) / 2;

const RFC = "#fff";
const RSC = "#ddd";
const LCD = "#DDD";
const LCE = "#999";
const LCA = "blue";

// preview rect colors
const PRFC = "#eee";
const PRSC = "#ddd";
const PCRFC = "#fff";
const PCRSC = "#ddd";
const PWRFC = "#0f0";
const PWRSC = "#0f0";

const ANIMATION_OPEN_CLOSE_DURATION = 500;
const ANIMATION_SUSTAIN_DURATION = 1000;

@observer
export class ResizingProperty extends React.Component<PropertyProps> {
    constructor(props: any) {
        super(props);

        this.animateReactionDisposer = this.animateReaction(props);
    }

    componentWillReceiveProps(nextProps: any) {
        this.animateReactionDisposer();
        this.animateReactionDisposer = this.animateReaction(nextProps);
    }

    componentWillUnmount() {
        this.animateReactionDisposer();
    }

    @computed
    get resizing() {
        return getProperty(this.props.object, this.props.propertyInfo.name) as IResizing;
    }

    @computed
    get pinToEdge() {
        return (this.resizing && this.resizing.pinToEdge) || 0;
    }

    @computed
    get fixSize() {
        return (this.resizing && this.resizing.fixSize) || 0;
    }

    @computed
    get isFixWidth() {
        return (this.fixSize & FIX_WIDTH) !== 0;
    }

    @computed
    get isFixHeight() {
        return (this.fixSize & FIX_HEIGHT) !== 0;
    }

    @computed
    get isPinToLeftAllowed() {
        return !(this.isPinToRight && this.isFixWidth);
    }

    @computed
    get isPinToRightAllowed() {
        return !(this.isPinToLeft && this.isFixWidth);
    }

    @computed
    get isPinToTopAllowed() {
        return !(this.isPinToBottom && this.isFixHeight);
    }

    @computed
    get isPinToBottomAllowed() {
        return !(this.isPinToTop && this.isFixHeight);
    }

    @computed
    get isFixWidthAllowed() {
        return !(this.isPinToLeft && this.isPinToRight);
    }

    @computed
    get isFixHeightAllowed() {
        return !(this.isPinToTop && this.isPinToBottom);
    }

    @computed
    get isPinToLeft() {
        return (this.pinToEdge & PIN_TO_LEFT) !== 0;
    }

    @computed
    get isPinToRight() {
        return (this.pinToEdge & PIN_TO_RIGHT) !== 0;
    }

    @computed
    get isPinToTop() {
        return (this.pinToEdge & PIN_TO_TOP) !== 0;
    }

    @computed
    get isPinToBottom() {
        return (this.pinToEdge & PIN_TO_BOTTOM) !== 0;
    }

    @bind
    togglePinToLeft() {
        if (!this.isPinToLeftAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.isPinToLeft
                    ? this.pinToEdge & ~PIN_TO_LEFT
                    : this.pinToEdge | PIN_TO_LEFT,
                fixSize: this.fixSize
            }
        });
    }

    @bind
    togglePinToRight() {
        if (!this.isPinToRightAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.isPinToRight
                    ? this.pinToEdge & ~PIN_TO_RIGHT
                    : this.pinToEdge | PIN_TO_RIGHT,
                fixSize: this.fixSize
            }
        });
    }

    @bind
    togglePinToTop() {
        if (!this.isPinToTopAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.isPinToTop
                    ? this.pinToEdge & ~PIN_TO_TOP
                    : this.pinToEdge | PIN_TO_TOP,
                fixSize: this.fixSize
            }
        });
    }

    @bind
    togglePinToBottom() {
        if (!this.isPinToBottomAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.isPinToBottom
                    ? this.pinToEdge & ~PIN_TO_BOTTOM
                    : this.pinToEdge | PIN_TO_BOTTOM,
                fixSize: this.fixSize
            }
        });
    }

    @bind
    togglePinToAll() {
        const isPinToAll =
            this.isPinToLeft && this.isPinToRight && this.isPinToTop && this.isPinToBottom;
        this.props.updateObject({
            resizing: {
                pinToEdge: isPinToAll ? 0 : PIN_TO_LEFT | PIN_TO_RIGHT | PIN_TO_TOP | PIN_TO_BOTTOM,
                fixSize: isPinToAll ? this.fixSize : 0
            }
        });
    }

    @bind
    toggleFixWidth() {
        if (!this.isFixWidthAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.pinToEdge,
                fixSize: this.isFixWidth ? this.fixSize & ~FIX_WIDTH : this.fixSize | FIX_WIDTH
            }
        });
    }

    @bind
    toggleFixHeight() {
        if (!this.isFixHeightAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.pinToEdge,
                fixSize: this.isFixHeight ? this.fixSize & ~FIX_HEIGHT : this.fixSize | FIX_HEIGHT
            }
        });
    }

    @computed
    get isFixAllAllowed() {
        return this.isFixWidthAllowed && this.isFixHeightAllowed;
    }

    @bind
    toggleFixAll() {
        if (!this.isFixAllAllowed) {
            return;
        }
        this.props.updateObject({
            resizing: {
                pinToEdge: this.pinToEdge,
                fixSize: this.isFixWidth && this.isFixHeight ? 0 : FIX_WIDTH | FIX_HEIGHT
            }
        });
    }

    // make sure animation is shown if properties are changed
    animateReactionDisposer: any;

    originalContainerRect: Rect = {
        left: 5,
        top: 5,
        width: 20,
        height: 20
    };

    originalWidgetRect: Rect = {
        left: 6,
        top: 6,
        width: 8,
        height: 8
    };

    @observable
    widgetRect: Rect = this.originalWidgetRect;

    @observable
    containerRect: Rect = this.originalContainerRect;

    animationFrameHandle: any;
    finalWidgetRect: Rect;
    finalContainerRect: Rect;
    animationStart: number;

    animateReaction(props: any) {
        return reaction(
            () => {
                const resizing = getProperty(props.object, props.propertyInfo.name) as IResizing;
                return {
                    pinToEdge: (resizing && resizing.pinToEdge) || 0,
                    fixSize: (resizing && resizing.fixSize) || 0
                };
            },
            () => this.startAnimation(true)
        );
    }

    @bind
    animationFrame() {
        this.animationFrameHandle = undefined;

        let t = (new Date().getTime() - this.animationStart) / ANIMATION_OPEN_CLOSE_DURATION;

        let done = false;

        const x = ANIMATION_SUSTAIN_DURATION / ANIMATION_OPEN_CLOSE_DURATION;

        if (t > 1 && t <= x + 1) {
            t = 1;
        } else if (t > x + 1) {
            t = x + 2 - t;
            if (t <= 0) {
                t = 0;
                done = true;
            }
        }

        this.widgetRect = {
            left:
                this.originalWidgetRect.left +
                t * (this.finalWidgetRect.left - this.originalWidgetRect.left),
            top:
                this.originalWidgetRect.top +
                t * (this.finalWidgetRect.top - this.originalWidgetRect.top),
            width:
                this.originalWidgetRect.width +
                t * (this.finalWidgetRect.width - this.originalWidgetRect.width),
            height:
                this.originalWidgetRect.height +
                t * (this.finalWidgetRect.height - this.originalWidgetRect.height)
        };

        this.containerRect = {
            left:
                this.originalContainerRect.left +
                t * (this.finalContainerRect.left - this.originalContainerRect.left),
            top:
                this.originalContainerRect.top +
                t * (this.finalContainerRect.top - this.originalContainerRect.top),
            width:
                this.originalContainerRect.width +
                t * (this.finalContainerRect.width - this.originalContainerRect.width),
            height:
                this.originalContainerRect.height +
                t * (this.finalContainerRect.height - this.originalContainerRect.height)
        };

        if (!done) {
            this.animationFrameHandle = requestAnimationFrame(this.animationFrame);
        }
    }

    @bind
    startAnimation(interrupt: boolean) {
        if (this.animationFrameHandle) {
            if (!interrupt) {
                return;
            }

            cancelAnimationFrame(this.animationFrameHandle);
            this.animationFrameHandle = undefined;
        }

        this.finalContainerRect = {
            left: this.originalContainerRect.left,
            top: this.originalContainerRect.top,
            width: W - 2 * this.originalContainerRect.left,
            height: H - 2 * this.originalContainerRect.top
        };

        this.finalWidgetRect = resizeWidget(
            this.originalWidgetRect,
            this.originalContainerRect,
            this.finalContainerRect,
            this.resizing
        );

        this.animationStart = new Date().getTime();

        this.animationFrameHandle = requestAnimationFrame(this.animationFrame);
    }

    render() {
        const pinToLeft = (
            <g onClick={this.togglePinToLeft}>
                <rect x={X1 + G3} y={Y1 + H / 2 - WL1 / 2} width={HL1} height={WL1} fill={RFC} />
                <line
                    x1={X1 + G3}
                    y1={Y1 + H / 2 - WL1 / 2}
                    x2={X1 + G3}
                    y2={Y1 + H / 2 + WL1 / 2}
                    stroke={this.isPinToLeftAllowed ? (this.isPinToLeft ? LCA : LCE) : LCD}
                />
                <line
                    x1={X1 + G3}
                    y1={Y1 + H / 2}
                    x2={X1 + G3 + HL1}
                    y2={Y1 + H / 2}
                    stroke={this.isPinToLeftAllowed ? (this.isPinToLeft ? LCA : LCE) : LCD}
                />
            </g>
        );

        const pinToRight = (
            <g onClick={this.togglePinToRight}>
                <rect
                    x={X1 + W - G3 - HL1}
                    y={Y1 + H / 2 - WL1 / 2}
                    width={HL1}
                    height={WL1}
                    fill={RFC}
                />
                <line
                    x1={X1 + W - G3}
                    y1={Y1 + H / 2 - WL1 / 2}
                    x2={X1 + W - G3}
                    y2={Y1 + H / 2 + WL1 / 2}
                    stroke={this.isPinToRightAllowed ? (this.isPinToRight ? LCA : LCE) : LCD}
                />
                <line
                    x1={X1 + W - G3 - HL1}
                    y1={Y1 + H / 2}
                    x2={X1 + W - G3}
                    y2={Y1 + H / 2}
                    stroke={this.isPinToRightAllowed ? (this.isPinToRight ? LCA : LCE) : LCD}
                />
            </g>
        );

        const pinToTop = (
            <g onClick={this.togglePinToTop}>
                <rect x={X1 + W / 2 - WL1 / 2} y={Y1 + G3} width={WL1} height={HL1} fill={RFC} />
                <line
                    x1={X1 + W / 2 - WL1 / 2}
                    y1={Y1 + G3}
                    x2={X1 + W / 2 + WL1 / 2}
                    y2={Y1 + G3}
                    stroke={this.isPinToTopAllowed ? (this.isPinToTop ? LCA : LCE) : LCD}
                />
                <line
                    x1={X1 + W / 2}
                    y1={Y1 + G3}
                    x2={X1 + W / 2}
                    y2={Y1 + G3 + HL1}
                    stroke={this.isPinToTopAllowed ? (this.isPinToTop ? LCA : LCE) : LCD}
                />
            </g>
        );

        const pinToBottom = (
            <g onClick={this.togglePinToBottom}>
                <rect
                    x={X1 + W / 2 - WL1 / 2}
                    y={Y1 + H - G3 - HL1}
                    width={WL1}
                    height={HL1}
                    fill={RFC}
                />
                <line
                    x1={X1 + W / 2 - WL1 / 2}
                    y1={Y1 + H - G3}
                    x2={X1 + W / 2 + WL1 / 2}
                    y2={Y1 + H - G3}
                    stroke={this.isPinToBottomAllowed ? (this.isPinToBottom ? LCA : LCE) : LCD}
                />
                <line
                    x1={X1 + W / 2}
                    y1={Y1 + H - G3}
                    x2={X1 + W / 2}
                    y2={Y1 + H - G3 - HL1}
                    stroke={this.isPinToBottomAllowed ? (this.isPinToBottom ? LCA : LCE) : LCD}
                />
            </g>
        );

        const pinToEdge = (
            <g>
                <rect x={X1} y={Y1} width={W} height={H} fill={RFC} stroke={RSC} />
                <text
                    x={X1 + W / 2}
                    y={H + G1 + LH}
                    fontSize="80%"
                    style={{ textAnchor: "middle" }}
                >
                    Pin to edge
                </text>
                {pinToLeft}
                {pinToRight}
                {pinToTop}
                {pinToBottom}
                <rect
                    x={X1 + W / 2 - HL1 / 2}
                    y={Y1 + H / 2 - HL1 / 2}
                    width={HL1}
                    height={HL1}
                    fill={RFC}
                    stroke={LCE}
                    onClick={this.togglePinToAll}
                />
            </g>
        );

        ////////////////////////////////////////////////////////////////////////////////

        const fixWidth = (
            <g>
                <g onClick={this.toggleFixWidth}>
                    <rect
                        x={X2 + G3}
                        y={Y1 + H / 2 - WL2 / 2}
                        width={HL2}
                        height={WL2}
                        fill={RFC}
                    />
                    <line
                        x1={X2 + G3}
                        y1={Y1 + H / 2 - WL2 / 2}
                        x2={X2 + G3}
                        y2={Y1 + H / 2 + WL2 / 2}
                        stroke={this.isFixWidthAllowed ? (this.isFixWidth ? LCA : LCE) : LCD}
                    />
                    <line
                        x1={X2 + G3}
                        y1={Y1 + H / 2}
                        x2={X2 + G3 + HL2}
                        y2={Y1 + H / 2}
                        stroke={this.isFixWidthAllowed ? (this.isFixWidth ? LCA : LCE) : LCD}
                    />
                </g>
                <g onClick={this.toggleFixWidth}>
                    <rect
                        x={X2 + W - G3 - HL2}
                        y={Y1 + H / 2 - WL2 / 2}
                        width={HL2}
                        height={WL2}
                        fill={RFC}
                    />
                    <line
                        x1={X2 + W - G3}
                        y1={Y1 + H / 2 - WL2 / 2}
                        x2={X2 + W - G3}
                        y2={Y1 + H / 2 + WL2 / 2}
                        stroke={this.isFixWidthAllowed ? (this.isFixWidth ? LCA : LCE) : LCD}
                    />
                    <line
                        x1={X2 + W - G3 - HL2}
                        y1={Y1 + H / 2}
                        x2={X2 + W - G3}
                        y2={Y1 + H / 2}
                        stroke={this.isFixWidthAllowed ? (this.isFixWidth ? LCA : LCE) : LCD}
                    />
                </g>
            </g>
        );

        const fixHeight = (
            <g>
                <g onClick={this.toggleFixHeight}>
                    <rect
                        x={X2 + W / 2 - WL2 / 2}
                        y={Y1 + G3}
                        width={WL2}
                        height={HL2}
                        fill={RFC}
                    />
                    <line
                        x1={X2 + W / 2 - WL2 / 2}
                        y1={Y1 + G3}
                        x2={X2 + W / 2 + WL2 / 2}
                        y2={Y1 + G3}
                        stroke={this.isFixHeightAllowed ? (this.isFixHeight ? LCA : LCE) : LCD}
                    />
                    <line
                        x1={X2 + W / 2}
                        y1={Y1 + G3}
                        x2={X2 + W / 2}
                        y2={Y1 + G3 + HL2}
                        stroke={this.isFixHeightAllowed ? (this.isFixHeight ? LCA : LCE) : LCD}
                    />
                </g>
                <g onClick={this.toggleFixHeight}>
                    <rect
                        x={X2 + W / 2 - WL2 / 2}
                        y={Y1 + H - G3 - HL2}
                        width={WL2}
                        height={HL2}
                        fill={RFC}
                    />
                    <line
                        x1={X2 + W / 2 - WL2 / 2}
                        y1={Y1 + H - G3}
                        x2={X2 + W / 2 + WL2 / 2}
                        y2={Y1 + H - G3}
                        stroke={this.isFixHeightAllowed ? (this.isFixHeight ? LCA : LCE) : LCD}
                    />
                    <line
                        x1={X2 + W / 2}
                        y1={Y1 + H - G3}
                        x2={X2 + W / 2}
                        y2={Y1 + H - G3 - HL2}
                        stroke={this.isFixHeightAllowed ? (this.isFixHeight ? LCA : LCE) : LCD}
                    />
                </g>
            </g>
        );

        const fixSize = (
            <g>
                <rect x={X2} y={Y1} width={W} height={H} fill={RFC} stroke={RSC} />
                <text
                    x={X2 + W / 2}
                    y={H + G1 + LH}
                    fontSize="80%"
                    style={{ textAnchor: "middle" }}
                >
                    Fix size
                </text>
                {fixWidth}
                {fixHeight}
                <rect
                    x={X2 + W / 2 - HL1 / 2}
                    y={Y1 + H / 2 - HL1 / 2}
                    width={HL1}
                    height={HL1}
                    fill={RFC}
                    stroke={this.isFixAllAllowed ? LCE : LCD}
                    onClick={this.toggleFixAll}
                />
            </g>
        );

        ////////////////////////////////////////////////////////////////////////////////

        const preview = (
            <g onMouseEnter={() => this.startAnimation(false)}>
                <rect x={X3} y={Y1} width={W} height={H} fill={PRFC} stroke={PRSC} />
                <text
                    x={X3 + W / 2}
                    y={H + G1 + LH}
                    fontSize="80%"
                    style={{ textAnchor: "middle" }}
                >
                    Preview
                </text>
                <rect
                    x={X3 + this.containerRect.left}
                    y={Y1 + this.containerRect.top}
                    width={this.containerRect.width}
                    height={this.containerRect.height}
                    fill={PCRFC}
                    stroke={PCRSC}
                />
                <rect
                    x={X3 + this.containerRect.left + this.widgetRect.left}
                    y={Y1 + this.containerRect.top + this.widgetRect.top}
                    width={this.widgetRect.width}
                    height={this.widgetRect.height}
                    fill={PWRFC}
                    stroke={PWRSC}
                />
            </g>
        );

        ////////////////////////////////////////////////////////////////////////////////

        return (
            <svg width={X3 + W + X1} height={Y1 + H + G1 + TH}>
                {pinToEdge}
                {fixSize}
                {preview}
            </svg>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export const resizingProperty: PropertyInfo = {
    name: "resizing",
    type: PropertyType.Any,
    propertyGridGroup: {
        id: "resizing",
        title: "Resizing"
    },
    propertyGridComponent: ResizingProperty
};
