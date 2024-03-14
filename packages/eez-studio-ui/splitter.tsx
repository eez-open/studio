import { action, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import classNames from "classnames";

import { theme } from "eez-studio-ui/theme";
import { Draggable } from "eez-studio-ui/draggable";

const SPLITTER_SIZE = 8;

interface SplitterProps {
    children?: React.ReactNode;

    type: "horizontal" | "vertical";
    className?: string;

    // For example: "240px|100%", "50%|50%", "100%|240px", "66%|34%", "240px|100%|240px"
    sizes: string;

    persistId?: string;

    overflow?: string;
    childrenOverflow?: string;

    tabIndex?: number;
    onFocus?: () => void;
    onKeyDown?: (event: any) => void;

    splitterSize?: number;

    resizeable?: boolean;

    style?: React.CSSProperties;
}

interface IDraggableParams {
    iSplitter: number;
    xOffset: number;
    yOffset: number;
}

export const Splitter = observer(
    class Splitter extends React.Component<SplitterProps, {}> {
        element: HTMLDivElement | null = null;

        width: number = 0;
        height: number = 0;

        offsets: number[] = [];
        sizes: number[] = [];
        idealSizes: number[] = [];
        childIsFixed: boolean[] = [];
        childIsCollapsed: boolean[] = [];

        resizeObserver: ResizeObserver;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                width: observable,
                height: observable,
                offsets: observable,
                sizes: observable,
                idealSizes: observable,
                childIsFixed: observable,
                childIsCollapsed: observable,
                calcSizes: action,
                resize: action,
                onSplitterMove: action
            });

            this.calcSizes(this.props);
            this.resizeObserver = new ResizeObserver(
                this.resizeObserverCallback
            );
        }

        componentDidMount() {
            if (this.element) {
                this.resizeObserver.observe(this.element);
            }
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.calcSizes(this.props);
            }
        }

        componentWillUnmount() {
            if (this.element) {
                this.resizeObserver.unobserve(this.element);
            }
        }

        resizeObserverCallback = action(() => {
            if (this.element) {
                let rect = this.element.getBoundingClientRect();

                const diff =
                    (this.props.type === "horizontal"
                        ? rect.width
                        : rect.height) -
                    (this.offsets[this.offsets.length - 1] +
                        this.sizes[this.sizes.length - 1]);

                if (
                    rect.width !== this.width ||
                    rect.height !== this.height ||
                    diff > 0
                ) {
                    this.width = rect.width;
                    this.height = rect.height;

                    this.resize();
                }
            }
        });

        calcSizes(props: SplitterProps) {
            // read sizes from local storage ...
            let sizesStr =
                props.persistId && localStorage.getItem(props.persistId);
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
            this.childIsFixed = [];
            this.childIsCollapsed = [];
            this.sizes = [];
            this.idealSizes = [];
            this.offsets = [];

            const collapsedBefore: boolean[] = [];
            const collapsedAfter: boolean[] = [];

            let totalNonCollapsedSize = 0;
            let nNonCollapsed = 0;

            for (let i = 0; i < sizes.length; i++) {
                this.childIsFixed[i] = sizes[i].indexOf("%") === -1;

                collapsedBefore[i] = sizes[i].indexOf("!") !== -1;
                collapsedAfter[i] = sizesFromProps[i].indexOf("!") !== -1;

                this.childIsCollapsed[i] = collapsedAfter[i];

                this.sizes[i] = parseFloat(sizes[i]);

                if (!collapsedBefore[i] && !collapsedAfter[i]) {
                    totalNonCollapsedSize += this.sizes[i];
                    nNonCollapsed++;
                }
            }

            let averageSize = Math.round(totalNonCollapsedSize / nNonCollapsed);

            let offset = 0;
            for (let i = 0; i < sizes.length; i++) {
                if (collapsedAfter[i]) {
                    this.sizes[i] = parseFloat(sizesFromProps[i]);
                } else if (collapsedBefore[i]) {
                    this.sizes[i] =
                        averageSize > 0
                            ? averageSize
                            : parseFloat(sizesFromProps[i]);
                }

                this.idealSizes[i] = this.sizes[i];

                this.offsets[i] = offset;
                offset += this.sizes[i];
            }

            this.resize();
        }

        isSplitterAtPosition(i: number) {
            if (!this.childIsCollapsed[i]) {
                for (let j = i + 1; j < this.sizes.length; j++) {
                    if (!this.childIsCollapsed[j]) {
                        return true;
                    }
                }
            } else if (!this.childIsCollapsed[i + 1]) {
                for (let j = i - 1; j >= 0; j--) {
                    if (!this.childIsCollapsed[j]) {
                        return true;
                    }
                }
            }
            return false;
        }

        resize() {
            let totalSize =
                this.props.type === "horizontal" ? this.width : this.height;

            for (let i = 0; i < this.sizes.length; i++) {
                if (this.childIsCollapsed[i]) {
                    totalSize -= this.sizes[i];
                }
            }

            for (let i = 0; i < this.sizes.length - 1; i++) {
                if (this.isSplitterAtPosition(i)) {
                    totalSize -= this.props.splitterSize ?? SPLITTER_SIZE;
                }
            }

            let totalSizeOfFixedChildren = 0;
            for (let i = 0; i < this.idealSizes.length; i++) {
                if (!this.childIsCollapsed[i] && this.childIsFixed[i]) {
                    totalSizeOfFixedChildren += this.idealSizes[i];
                }
            }

            let stretchFactorForFixedChildren;
            if (totalSizeOfFixedChildren <= totalSize) {
                stretchFactorForFixedChildren = 1;
            } else {
                stretchFactorForFixedChildren =
                    totalSize / totalSizeOfFixedChildren;
            }

            let availableSize = totalSize;

            for (let i = 0; i < this.sizes.length; i++) {
                if (!this.childIsCollapsed[i] && this.childIsFixed[i]) {
                    this.sizes[i] = Math.floor(
                        this.idealSizes[i] * stretchFactorForFixedChildren
                    );
                    availableSize -= this.sizes[i];
                }
            }

            let availableSizeForStretchableChildren = availableSize;
            for (let i = 0; i < this.sizes.length; i++) {
                if (!this.childIsCollapsed[i] && !this.childIsFixed[i]) {
                    this.sizes[i] = Math.floor(
                        (this.idealSizes[i] *
                            availableSizeForStretchableChildren) /
                            100
                    );
                    availableSize -= this.sizes[i];
                }
            }

            if (availableSize > 0) {
                for (let i = 0; i < this.sizes.length; i++) {
                    if (!this.childIsCollapsed[i] && !this.childIsFixed[i]) {
                        this.sizes[i] += availableSize;
                        availableSize = 0;
                        break;
                    }
                }
            }

            if (availableSize > 0) {
                for (let i = 0; i < this.sizes.length; i++) {
                    if (!this.childIsCollapsed[i] && this.childIsFixed[i]) {
                        this.sizes[i] += availableSize;
                        availableSize = 0;
                        break;
                    }
                }
            }

            this.offsets[0] = 0;
            for (let i = 1; i < this.sizes.length; i++) {
                this.offsets[i] = this.offsets[i - 1] + this.sizes[i - 1];
                if (this.isSplitterAtPosition(i - 1)) {
                    this.offsets[i] += this.props.splitterSize ?? SPLITTER_SIZE;
                }
            }
        }

        onSplitterMove(iSplitter: number, x: number, y: number) {
            let position = this.props.type === "horizontal" ? x : y;

            while (this.childIsCollapsed[iSplitter]) {
                position -= this.sizes[iSplitter];
                iSplitter--;
            }

            let size1 = position - this.offsets[iSplitter];
            if (size1 < 50) {
                size1 = 50;
            }

            for (let i = iSplitter + 1; i < this.sizes.length; i++) {
                if (!this.childIsCollapsed[i]) {
                    let size2 = this.sizes[i] + this.sizes[iSplitter] - size1;

                    if (size2 < 50) {
                        size2 = 50;

                        size1 = this.sizes[iSplitter] + this.sizes[i] - size2;
                        if (size1 < 50) {
                            return;
                        }
                    }

                    // set new sizes
                    this.sizes[iSplitter] = size1;
                    this.sizes[i] = size2;

                    break;
                }
            }

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
                    this.idealSizes[i] =
                        (100 * this.sizes[i]) / sizeStretchable;
                }
            }

            this.resize();

            // store ideal sizes to local storage
            let sizes = [];
            for (let i = 0; i < this.idealSizes.length; i++) {
                if (this.childIsFixed[i]) {
                    if (this.childIsCollapsed[i]) {
                        sizes.push(this.idealSizes[i] + "px!");
                    } else {
                        sizes.push(this.idealSizes[i] + "px");
                    }
                } else {
                    sizes.push(this.idealSizes[i] + "%");
                }
            }
            if (this.props.persistId) {
                localStorage.setItem(this.props.persistId, sizes.join("|"));
            }
        }

        onDragMove = (
            e: PointerEvent,
            x: number,
            y: number,
            params: IDraggableParams
        ) => {
            this.onSplitterMove(
                params.iSplitter,
                params.xOffset + x,
                params.yOffset + y
            );
        };

        render() {
            ////////////////////////////////////////////////////////////////////////////////

            let children = React.Children.toArray(this.props.children);

            ////////////////////////////////////////////////////////////////////////////////

            let childStyles: React.CSSProperties[] = [];

            let childrenOverflow =
                this.props.childrenOverflow &&
                this.props.childrenOverflow.split("|");

            for (let i = 0; i < children.length; i++) {
                let style: React.CSSProperties = {
                    position: "absolute",
                    overflow:
                        (childrenOverflow && childrenOverflow[i]) || "auto",
                    boxSizing: "border-box",
                    left:
                        (this.props.type === "horizontal"
                            ? this.offsets[i]
                            : 0) + "px",
                    top:
                        (this.props.type === "vertical" ? this.offsets[i] : 0) +
                        "px",
                    width:
                        (this.props.type === "horizontal"
                            ? this.sizes[i]
                            : this.width) + "px",
                    height:
                        (this.props.type === "vertical"
                            ? this.sizes[i]
                            : this.height) + "px",
                    display: "flex",
                    flexDirection: "column"
                };

                childStyles.push(style);
            }

            ////////////////////////////////////////////////////////////////////////////////

            let splitterStyles: React.CSSProperties[] = [];
            let iSplitter: number[] = [];

            for (let i = 0; i < children.length - 1; i++) {
                if (this.isSplitterAtPosition(i)) {
                    let style: React.CSSProperties = {
                        position: "absolute",
                        boxSizing: "border-box"
                    };

                    if (this.props.resizeable === false) {
                        style.pointerEvents = "none";
                        style.backgroundImage = "none";
                    }

                    if (this.props.type === "horizontal") {
                        if (this.props.resizeable !== false) {
                            style.cursor = "col-resize";
                        }
                        style.left = this.offsets[i] + this.sizes[i] + "px";
                        style.top = 0;
                        style.width =
                            this.props.splitterSize ?? SPLITTER_SIZE + "px";
                        style.height = "100%";

                        style.borderLeft = "1px solid " + theme().borderColor;
                        style.borderRight = "1px solid " + theme().borderColor;
                    } else {
                        if (this.props.resizeable !== false) {
                            style.cursor = "row-resize";
                        }
                        style.left = 0;
                        style.top = this.offsets[i] + this.sizes[i] + "px";
                        style.width = "100%";
                        style.height =
                            this.props.splitterSize ?? SPLITTER_SIZE + "px";

                        style.borderTop = "1px solid " + theme().borderColor;
                        style.borderBottom = "1px solid " + theme().borderColor;
                    }

                    splitterStyles.push(style);
                    iSplitter.push(i);
                }
            }

            ////////////////////////////////////////////////////////////////////////////////

            let style: React.CSSProperties = Object.assign(
                {},
                this.props.style,
                {
                    overflow: this.props.overflow || "hidden",
                    flexGrow: 1,
                    position: "relative"
                }
            );

            const className = classNames(
                this.props.type === "horizontal"
                    ? "EezStudio_Splitter_Horizontal"
                    : "EezStudio_Splitter_Vertical",
                "eez-flow-editor-not-capture-pointers"
            );

            return (
                <div
                    ref={element => (this.element = element)}
                    style={style}
                    tabIndex={this.props.tabIndex}
                    onFocus={this.props.onFocus}
                    onKeyDown={this.props.onKeyDown}
                    className={this.props.className}
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
                                    iSplitter: iSplitter[i],
                                    xOffset:
                                        this.props.type === "horizontal"
                                            ? this.offsets[iSplitter[i] + 1] -
                                              (this.props.splitterSize ??
                                                  SPLITTER_SIZE) /
                                                  2
                                            : 0,
                                    yOffset:
                                        this.props.type === "vertical"
                                            ? this.offsets[iSplitter[i] + 1] -
                                              (this.props.splitterSize ??
                                                  SPLITTER_SIZE) /
                                                  2
                                            : 0
                                } as IDraggableParams;
                            }}
                            onDragMove={this.onDragMove}
                        />
                    ))}
                </div>
            );
        }
    }
);

class SplitterThumb extends React.Component<
    {
        className?: string;
        style?: React.CSSProperties;
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
        return (
            <div
                ref={ref => this.draggable.attach(ref)}
                className={classNames("EezStudio_SplitterThumbDiv", className)}
                style={style}
            />
        );
    }
}
