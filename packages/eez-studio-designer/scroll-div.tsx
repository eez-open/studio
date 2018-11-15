import React from "react";
import { observable, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import bind from "bind-decorator";

import { Rect, Transform } from "eez-studio-shared/geometry";

const CONF_TIMEOUT_FOR_TRANSLATE_ADJUSTMENT_AFTER_ON_SCROLL_EVENT = 1000; // ms
const CONF_CHANGE_SCROLL_TIMEOUT = 1; // ms
const CONF_GUARD_ON_SCROLL_TIMEOUT = 50; // ms

@observer
export class ScrollDiv extends React.Component<{
    transform: Transform;
}> {
    scrollDiv: HTMLDivElement;
    div: HTMLDivElement;

    @observable
    boundingRect: Rect = {
        left: 0,
        top: 0,
        width: 0,
        height: 0
    };

    ajdustScrollDivIntervalId: any;

    private scrollStopTimeout: any;
    changeScrollTimeout: any;
    guardOnScrollTimeout: any;

    @observable scrollLeft: number = 0;
    @observable scrollTop: number = 0;

    get isScrolling() {
        return !!this.scrollStopTimeout;
    }

    componentDidMount() {
        this.ajdustScrollDivIntervalId = setInterval(this.ajdustScrollDiv, 0);
    }

    componentWillUnmount() {
        if (this.ajdustScrollDivIntervalId) {
            clearInterval(this.ajdustScrollDivIntervalId);
            this.ajdustScrollDivIntervalId = undefined;
        }

        if (this.scrollStopTimeout) {
            clearTimeout(this.scrollStopTimeout);
            this.scrollStopTimeout = undefined;
        }

        if (this.changeScrollTimeout) {
            clearTimeout(this.changeScrollTimeout);
            this.changeScrollTimeout = undefined;
        }

        if (this.guardOnScrollTimeout) {
            clearTimeout(this.guardOnScrollTimeout);
            this.guardOnScrollTimeout = undefined;
        }
    }

    @bind
    ajdustScrollDiv() {
        if (this.isScrolling) {
            return;
        }

        if (this.props.transform.clientRect.width <= 1) {
            return;
        }

        if (this.props.transform.clientRect.height <= 1) {
            return;
        }

        const svg: SVGSVGElement = this.scrollDiv.parentElement!.querySelector("svg")!;
        const bbox = svg.getBBox();

        const left = Math.min(bbox.x, 0);
        const top = Math.min(bbox.y, 0);
        const right = Math.max(bbox.x + bbox.width, this.scrollDiv.clientWidth);
        const bottom = Math.max(bbox.y + bbox.height, this.scrollDiv.clientHeight);
        const width = right - left;
        const height = bottom - top;

        if (
            left !== this.boundingRect.left ||
            top !== this.boundingRect.top ||
            width !== this.boundingRect.width ||
            height !== this.boundingRect.height
        ) {
            runInAction(() => {
                this.boundingRect.left = left;
                this.boundingRect.top = top;
                this.boundingRect.width = width;
                this.boundingRect.height = height;

                this.props.transform.scrollOffset = {
                    x: 0,
                    y: 0
                };

                if (this.changeScrollTimeout) {
                    clearTimeout(this.changeScrollTimeout);
                    this.changeScrollTimeout = undefined;
                }

                if (this.guardOnScrollTimeout) {
                    clearTimeout(this.guardOnScrollTimeout);
                    this.guardOnScrollTimeout = undefined;
                }

                this.guardOnScrollTimeout = setTimeout(() => {
                    this.guardOnScrollTimeout = undefined;
                }, CONF_CHANGE_SCROLL_TIMEOUT + CONF_GUARD_ON_SCROLL_TIMEOUT);

                this.changeScrollTimeout = setTimeout(() => {
                    this.scrollDiv.scrollLeft = -this.boundingRect.left;
                    this.scrollDiv.scrollTop = -this.boundingRect.top;
                }, CONF_CHANGE_SCROLL_TIMEOUT);
            });
        }

        runInAction(() => {
            this.scrollLeft = this.scrollDiv.scrollLeft;
            this.scrollTop = this.scrollDiv.scrollTop;
        });
    }

    @action.bound
    onScroll(e: any) {
        runInAction(() => {
            this.scrollLeft = this.scrollDiv.scrollLeft;
            this.scrollTop = this.scrollDiv.scrollTop;
        });

        this.div.style.left = this.scrollLeft + "px";
        this.div.style.top = this.scrollTop + "px";

        if (this.guardOnScrollTimeout) {
            return;
        }

        if (this.scrollStopTimeout) {
            clearTimeout(this.scrollStopTimeout);
            this.scrollStopTimeout = undefined;
        }

        this.props.transform.scrollOffset = {
            x: -(this.scrollDiv.scrollLeft + this.boundingRect.left),
            y: -(this.scrollDiv.scrollTop + this.boundingRect.top)
        };

        if (this.props.transform.scrollOffset.x || this.props.transform.scrollOffset.y) {
            this.scrollStopTimeout = setTimeout(() => {
                this.scrollStopTimeout = undefined;
                this.props.transform.translateByScrollOffset();
            }, CONF_TIMEOUT_FOR_TRANSLATE_ADJUSTMENT_AFTER_ON_SCROLL_EVENT);
        }
    }

    render() {
        return (
            <div
                ref={ref => (this.scrollDiv = ref!)}
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "auto"
                }}
                onScroll={this.onScroll}
            >
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: this.boundingRect.width,
                        height: this.boundingRect.height,
                        overflow: "hidden"
                    }}
                >
                    <div
                        ref={ref => (this.div = ref!)}
                        style={{
                            position: "absolute",
                            left: this.scrollLeft,
                            top: this.scrollTop
                        }}
                    >
                        {this.props.children}
                    </div>
                </div>
            </div>
        );
    }
}
