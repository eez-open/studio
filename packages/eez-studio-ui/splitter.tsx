import { action, observable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import { CONF_BORDER_COLOR } from "eez-studio-ui/box";
import { Draggable } from "eez-studio-ui/draggable";

const SPLITTER_SIZE = 8;

interface SplitterProps {
    type: "horizontal" | "vertical";
    className?: string;

    // For example: "240px|100%", "50%|50%", "100%|240px", "66%|34%", "240px|100%|240px"
    sizes: string;

    persistId?: string;

    overflow?: string;
    childrenOverflow?: string;

    tabIndex?: number;
    onFocus?: () => void;
}

interface IDraggableParams {
    iSplitter: number;
    xOffset: number;
    yOffset: number;
}

@observer
export class Splitter extends React.Component<SplitterProps, {}> {
    constructor(props: any) {
        super(props);
        this.calcSizes(this.props);
    }

    element: HTMLDivElement | null;

    @observable width: number = 0;
    @observable height: number = 0;

    @observable offsets: number[];
    @observable sizes: number[];
    @observable idealSizes: number[];
    @observable childIsFixed: boolean[];

    animationFrameRequestId: any;

    componentDidMount() {
        this.animationFrameCallback = this.animationFrameCallback.bind(this);
        this.animationFrameCallback();
    }

    componentWillReceiveProps(nextProps: SplitterProps) {
        this.calcSizes(nextProps);
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);
    }

    @action
    animationFrameCallback() {
        if (this.element) {
            let rect = this.element.getBoundingClientRect();
            if (rect.width !== this.width || rect.height !== this.height) {
                this.width = rect.width;
                this.height = rect.height;

                this.resize();
            }
        }

        this.animationFrameRequestId = window.requestAnimationFrame(this.animationFrameCallback);
    }

    @action
    calcSizes(props: SplitterProps) {
        // read sizes from local storage ...
        let sizesStr = props.persistId && localStorage.getItem(props.persistId);
        if (!sizesStr) {
            sizesStr = props.sizes;
        }
        let sizes = sizesStr.split("|");

        // ... or use from props if length is different
        let sizesFromProps = props.sizes.split("|");
        if (sizes.length !== sizesFromProps.length) {
            sizes = sizesFromProps;
        }

        //
        this.offsets = [];
        this.sizes = [];
        this.idealSizes = [];
        this.childIsFixed = [];

        let offset = 0;
        for (let i = 0; i < sizes.length; i++) {
            let size = parseFloat(sizes[i]);
            this.offsets.push(offset);
            offset += size;
            this.sizes.push(size);
            this.idealSizes.push(size);
            this.childIsFixed.push(sizes[i].indexOf("%") === -1);
        }

        this.resize();
    }

    @action
    resize() {
        let totalSize =
            (this.props.type === "horizontal" ? this.width : this.height) -
            (this.sizes.length - 1) * SPLITTER_SIZE;

        let totalSizeOfFixedChildren = 0;
        for (let i = 0; i < this.idealSizes.length; i++) {
            if (this.childIsFixed[i]) {
                totalSizeOfFixedChildren += this.idealSizes[i];
            }
        }

        let stretchFactorForFixedChildren;
        if (totalSizeOfFixedChildren <= totalSize) {
            stretchFactorForFixedChildren = 1;
        } else {
            stretchFactorForFixedChildren = totalSize / totalSizeOfFixedChildren;
        }

        let availableSize = totalSize;

        for (let i = 0; i < this.sizes.length; i++) {
            if (this.childIsFixed[i]) {
                this.sizes[i] = Math.floor(this.idealSizes[i] * stretchFactorForFixedChildren);
                availableSize -= this.sizes[i];
            }
        }

        let availableSizeForStretchableChildren = availableSize;
        for (let i = 0; i < this.sizes.length; i++) {
            if (!this.childIsFixed[i]) {
                this.sizes[i] = Math.floor(
                    (this.idealSizes[i] * availableSizeForStretchableChildren) / 100
                );
                availableSize -= this.sizes[i];
            }
        }

        this.sizes[0] += availableSize;

        this.offsets[0] = 0;
        for (let i = 1; i < this.sizes.length; i++) {
            this.offsets[i] = this.offsets[i - 1] + this.sizes[i - 1] + SPLITTER_SIZE;
        }
    }

    @action
    onSplitterMove(iSplitter: number, x: number, y: number) {
        let position = this.props.type === "horizontal" ? x : y;

        let size1 = position - this.offsets[iSplitter];
        if (size1 < 50) {
            size1 = 50;
            position = this.offsets[iSplitter] + 50;
        }

        let size2 = this.offsets[iSplitter + 1] + this.sizes[iSplitter + 1] - position;
        if (size2 < 50) {
            size2 = 50;
            position = this.offsets[iSplitter + 1] + this.sizes[iSplitter + 1] - 50;

            size1 = position - this.offsets[iSplitter];
            if (size1 < 50) {
                return;
            }
        }

        // compute new sizes
        this.sizes[iSplitter] = size1;
        this.sizes[iSplitter + 1] = size2;

        let sizeStretchable = 0;
        for (let i = 0; i < this.sizes.length; i++) {
            if (!this.childIsFixed[i]) {
                sizeStretchable += this.sizes[i];
            }
        }

        for (let i = 0; i < this.sizes.length; i++) {
            if (this.childIsFixed[i]) {
                this.idealSizes[i] = this.sizes[i];
            } else {
                this.idealSizes[i] = Math.round((100 * this.sizes[i]) / sizeStretchable);
            }
        }

        this.resize();

        // store ideal sizes to local storage
        let sizes = [];
        for (let i = 0; i < this.idealSizes.length; i++) {
            if (this.childIsFixed[i]) {
                sizes.push(this.idealSizes[i] + "px");
            } else {
                sizes.push(this.idealSizes[i] + "%");
            }
        }
        if (this.props.persistId) {
            localStorage.setItem(this.props.persistId, sizes.join("|"));
        }
    }

    @bind
    onDragMove(e: PointerEvent, x: number, y: number, params: IDraggableParams) {
        this.onSplitterMove(params.iSplitter, params.xOffset + x, params.yOffset + y);
    }

    render() {
        ////////////////////////////////////////////////////////////////////////////////

        let children = React.Children.toArray(this.props.children);

        ////////////////////////////////////////////////////////////////////////////////

        let childStyles: React.CSSProperties[] = [];

        let childrenOverflow =
            this.props.childrenOverflow && this.props.childrenOverflow.split("|");

        for (let i = 0; i < children.length; i++) {
            let style: React.CSSProperties = {
                position: "absolute",
                overflow: (childrenOverflow && childrenOverflow[i]) || "auto",
                boxSizing: "border-box",
                left: (this.props.type === "horizontal" ? this.offsets[i] : 0) + "px",
                top: (this.props.type === "vertical" ? this.offsets[i] : 0) + "px",
                width: (this.props.type === "horizontal" ? this.sizes[i] : this.width) + "px",
                height: (this.props.type === "vertical" ? this.sizes[i] : this.height) + "px",
                display: "flex",
                flexDirection: "column"
            };

            childStyles.push(style);
        }

        ////////////////////////////////////////////////////////////////////////////////

        let splitterStyles: React.CSSProperties[] = [];

        for (let i = 0; i < children.length - 1; i++) {
            let style: React.CSSProperties = {
                position: "absolute",
                boxSizing: "border-box",
                backgroundClip: "content-box"
            };

            if (this.props.type === "horizontal") {
                style.cursor = "col-resize";
                style.left = this.offsets[i] + this.sizes[i] + "px";
                style.top = 0;
                style.width = SPLITTER_SIZE + "px";
                style.height = "100%";

                style.borderLeft = "1px solid " + CONF_BORDER_COLOR;
                style.borderRight = "1px solid " + CONF_BORDER_COLOR;
            } else {
                style.cursor = "row-resize";
                style.left = 0;
                style.top = this.offsets[i] + this.sizes[i] + "px";
                style.width = "100%";
                style.height = SPLITTER_SIZE + "px";

                style.borderTop = "1px solid " + CONF_BORDER_COLOR;
                style.borderBottom = "1px solid " + CONF_BORDER_COLOR;
            }

            splitterStyles.push(style);
        }

        ////////////////////////////////////////////////////////////////////////////////

        let style: React.CSSProperties = {
            overflow: this.props.overflow || "hidden",
            flexGrow: 1,
            position: "relative"
        };

        const className = classNames(
            "EezStudio_Splitter",
            this.props.type === "horizontal"
                ? "EezStudio_Splitter_Horizontal"
                : "EezStudio_Splitter_Vertical"
        );

        return (
            <div
                className={this.props.className}
                ref={element => (this.element = element)}
                style={style}
                tabIndex={this.props.tabIndex}
                onFocus={this.props.onFocus}
            >
                {children.map((child, i) => (
                    <div key={"child" + i} style={childStyles[i]}>
                        {child}
                    </div>
                ))}
                {splitterStyles.map((splitterStyle, i) => (
                    <SplitterThumb
                        key={"splitter" + i}
                        cursor={splitterStyle.cursor!}
                        style={splitterStyles[i]}
                        className={className}
                        onDragStart={() => {
                            return {
                                iSplitter: i,
                                xOffset: this.props.type === "horizontal" ? this.offsets[i + 1] : 0,
                                yOffset: this.props.type === "vertical" ? this.offsets[i + 1] : 0
                            } as IDraggableParams;
                        }}
                        onDragMove={this.onDragMove}
                    />
                ))}
            </div>
        );
    }
}

class SplitterThumb extends React.Component<
    {
        className: string;
        style: React.CSSProperties;
        cursor: string;
        onDragStart(e: PointerEvent, x: number, y: number): any;
        onDragMove(e: PointerEvent, x: number, y: number, params: any): void;
    },
    {}
> {
    draggable = new Draggable(this);

    onDragStart(e: PointerEvent, x: number, y: number) {
        return this.props.onDragStart(e, x, y);
    }

    onDragMove(e: PointerEvent, x: number, y: number, params: any) {
        this.props.onDragMove(e, x, y, params);
    }

    componentWillUnmount() {
        this.draggable.attach(null);
    }

    render() {
        const { cursor, className, style } = this.props;
        this.draggable.cursor = cursor;
        return <div ref={ref => this.draggable.attach(ref)} className={className} style={style} />;
    }
}
