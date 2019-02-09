import React from "react";
import { computed, observable, action, runInAction } from "mobx";
import { observer, inject } from "mobx-react";
import { bind } from "bind-decorator";

import { Point, pointDistance, BoundingRectBuilder } from "eez-studio-shared/geometry";
import { getScrollbarWidth } from "eez-studio-shared/dom";

import { IMenu } from "eez-studio-shared/model/store";

import { Draggable } from "eez-studio-ui/draggable";
import styled from "eez-studio-ui/styled-components";

import {
    IToolHandler,
    IMouseHandler,
    IDesignerContext
} from "eez-studio-designer/designer-interfaces";
import { PanMouseHandler } from "eez-studio-designer/mouse-handlers/pan";

////////////////////////////////////////////////////////////////////////////////

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px
const CONF_AFTER_SCROLL_ADJUSTMENT_TIMEOUT = 1000; // ms

////////////////////////////////////////////////////////////////////////////////

const CanvasDiv = styled.div`
    background-color: white;
    & > * {
        user-select: none;
    }
`;

@inject("designerContext")
@observer
export class Canvas extends React.Component<{
    designerContext?: IDesignerContext;
    toolHandler: IToolHandler;
    customOverlay?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}> {
    div: Element;
    innerDiv: Element;
    clientRectChangeDetectionAnimationFrameHandle: any;
    deltaY = 0;

    get designerContext() {
        return this.props.designerContext!;
    }

    @observable
    _mouseHandler: IMouseHandler | undefined;
    get mouseHandler() {
        return this._mouseHandler;
    }
    set mouseHandler(value: IMouseHandler | undefined) {
        runInAction(() => {
            this._mouseHandler = value;
            this.designerContext.viewState.isIdle = !this._mouseHandler;
        });
    }

    buttonsAtDown: number;
    lastMouseUpPosition: Point;
    lastMouseUpTime: number | undefined;

    draggable = new Draggable(this);

    scrollLeft: number;
    scrollTop: number;
    afterScrollAdjustmentTimeout: any;

    get isScrolling() {
        return !!this.afterScrollAdjustmentTimeout;
    }

    @computed
    get boundingRect() {
        const transform = this.designerContext.viewState.transform;
        const builder = new BoundingRectBuilder();
        builder.addRect(
            transform.modelToOffsetRect(
                this.props.designerContext!.document.boundingRect || {
                    left: -50,
                    top: -50,
                    width: 100,
                    height: 100
                }
            )
        );
        builder.addRect(transform.clientToOffsetRect(transform.clientRect));
        return builder.getRect()!;
    }

    updateScroll() {
        const boundingRect = this.boundingRect;

        this.div.scrollLeft = -boundingRect.left;
        this.scrollLeft = this.div.scrollLeft;

        this.div.scrollTop = -boundingRect.top;
        this.scrollTop = this.div.scrollTop;
    }

    userScrollTimeout: any;

    @bind
    clientRectChangeDetection() {
        if ($(this.div).is(":visible")) {
            const transform = this.designerContext.viewState.transform;

            let clientRect = this.div.getBoundingClientRect();
            if (
                clientRect.left !== transform.clientRect.left ||
                clientRect.top !== transform.clientRect.top ||
                (clientRect.width && clientRect.width !== transform.clientRect.width) ||
                (clientRect.height && clientRect.height !== transform.clientRect.height)
            ) {
                runInAction(() => {
                    transform.clientRect = clientRect;
                });
            }

            if (this.div.scrollLeft !== this.scrollLeft || this.div.scrollTop !== this.scrollTop) {
                this.scrollLeft = this.div.scrollLeft;
                this.scrollTop = this.div.scrollTop;

                if (this.afterScrollAdjustmentTimeout) {
                    clearTimeout(this.afterScrollAdjustmentTimeout);
                }

                this.afterScrollAdjustmentTimeout = setTimeout(() => {
                    this.afterScrollAdjustmentTimeout = undefined;

                    const boundingRect = this.boundingRect;

                    transform.translateBy({
                        x: -(boundingRect.left + this.div.scrollLeft),
                        y: -(boundingRect.top + this.div.scrollTop)
                    });
                }, CONF_AFTER_SCROLL_ADJUSTMENT_TIMEOUT);
            }
        }

        this.clientRectChangeDetectionAnimationFrameHandle = requestAnimationFrame(
            this.clientRectChangeDetection
        );
    }

    componentDidMount() {
        this.draggable.attach(this.innerDiv);
        this.updateScroll();
        this.clientRectChangeDetection();
    }

    componentDidUpdate() {
        this.updateScroll();
    }

    componentWillUnmount() {
        this.draggable.attach(null);

        if (this.clientRectChangeDetectionAnimationFrameHandle) {
            cancelAnimationFrame(this.clientRectChangeDetectionAnimationFrameHandle);
            this.clientRectChangeDetectionAnimationFrameHandle = undefined;
        }
    }

    @bind
    onWheel(event: React.WheelEvent<HTMLDivElement>) {
        if (this.isScrolling) {
            return;
        }

        if (event.buttons === 4) {
            // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
            return;
        }

        const transform = this.designerContext.viewState.transform;

        if (event.ctrlKey) {
            this.deltaY += event.deltaY;
            if (Math.abs(this.deltaY) > 10) {
                let scale: number;
                if (this.deltaY < 0) {
                    scale = transform.nextScale();
                } else {
                    scale = transform.previousScale();
                }

                this.deltaY = 0;

                var point = transform.clientToOffsetPoint({
                    x: event.clientX,
                    y: event.clientY
                });
                let x = point.x - transform.clientRect.width / 2;
                let y = point.y - transform.clientRect.height / 2;
                let tx = x - ((x - transform.translate.x) * scale) / transform.scale;
                let ty = y - ((y - transform.translate.y) * scale) / transform.scale;

                runInAction(() => {
                    transform.scale = scale;
                    transform.translate = { x: tx, y: ty };
                });
            }
        } else {
            runInAction(() => {
                transform.translate = {
                    x: transform.translate.x - (event.shiftKey ? event.deltaY : event.deltaX),
                    y: transform.translate.y - (event.shiftKey ? event.deltaX : event.deltaY)
                };
            });
        }

        event.preventDefault();
        event.stopPropagation();
    }

    @bind
    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();
    }

    @action.bound
    onDragStart(event: PointerEvent) {
        if (this.isScrolling) {
            return;
        }

        this.buttonsAtDown = event.buttons;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.designerContext, event);
            this.mouseHandler = undefined;
        }

        if (event.buttons && event.buttons !== 1) {
            this.mouseHandler = new PanMouseHandler();
        } else {
            if (this.props.toolHandler) {
                this.mouseHandler = this.props.toolHandler.createMouseHandler(
                    this.designerContext,
                    event
                );
            }
        }

        if (this.mouseHandler) {
            this.mouseHandler.down(this.designerContext, event);
        }
    }

    @bind
    onDragMove(event: PointerEvent) {
        if (this.mouseHandler) {
            this.mouseHandler.move(this.designerContext, event);
        }
    }

    @action.bound
    onDragEnd(event: PointerEvent) {
        let preventContextMenu = false;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.designerContext, event);

            if (this.mouseHandler instanceof PanMouseHandler) {
                if (pointDistance(this.mouseHandler.totalMovement) > 10) {
                    preventContextMenu = true;
                }
            }

            this.mouseHandler = undefined;
        }

        let time = new Date().getTime();

        const transform = this.designerContext.viewState.transform;

        if (this.buttonsAtDown === 1) {
            let distance = pointDistance(
                { x: event.clientX, y: event.clientY },
                { x: this.draggable.xDragStart, y: this.draggable.yDragStart }
            );

            if (distance <= CONF_DOUBLE_CLICK_DISTANCE) {
                if (this.lastMouseUpTime !== undefined) {
                    let distance = pointDistance(
                        { x: event.clientX, y: event.clientY },
                        this.lastMouseUpPosition
                    );

                    if (
                        time - this.lastMouseUpTime <= CONF_DOUBLE_CLICK_TIME &&
                        distance <= CONF_DOUBLE_CLICK_DISTANCE
                    ) {
                        // double click
                        if (this.designerContext.viewState.selectedObjects.length === 1) {
                            const object = this.designerContext.viewState.selectedObjects[0];
                            object.open();
                        } else if (this.designerContext.viewState.selectedObjects.length === 0) {
                            this.designerContext.viewState.resetTransform();
                        }
                    }
                }

                this.lastMouseUpTime = time;
                this.lastMouseUpPosition = {
                    x: event.clientX,
                    y: event.clientY
                };
            } else {
                this.lastMouseUpTime = undefined;
            }
        } else {
            this.lastMouseUpTime = undefined;

            const anchorPosition = {
                left: event.clientX,
                top: event.clientY
            };

            if (!preventContextMenu && this.props.toolHandler && this.buttonsAtDown === 2) {
                this.props.toolHandler.onContextMenu(
                    this.designerContext,
                    transform.mouseEventToModelPoint(event),
                    (menu: IMenu) => {
                        if (this.mouseHandler) {
                            this.mouseHandler.up(this.designerContext);
                            this.mouseHandler = undefined;
                        }

                        menu.popup({}, anchorPosition);
                    }
                );
            }
        }
    }

    @bind
    onClick(event: React.MouseEvent<HTMLDivElement>) {
        if (this.props.toolHandler) {
            event.preventDefault();
            event.stopPropagation();

            this.props.toolHandler.onClick(
                this.designerContext,
                this.designerContext.viewState.transform.mouseEventToModelPoint(event.nativeEvent)
            );
        }
    }

    render() {
        let style: React.CSSProperties = {
            cursor: "default",
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            overflow: "auto"
        };
        if (this.mouseHandler) {
            style.cursor = this.mouseHandler.cursor;
        } else {
            if (this.props.toolHandler && this.props.toolHandler.cursor) {
                style.cursor = this.props.toolHandler.cursor;
            }
        }
        if (this.props.style) {
            Object.assign(style, this.props.style);
        }

        this.draggable.cursor = style.cursor;

        const transform = this.designerContext.viewState.transform;

        const CENTER_LINES_COLOR = "rgba(0, 0, 0, 0.2)";
        const CENTER_LINES_WIDTH = 1 / transform.scale;
        const centerLineStyle = { stroke: CENTER_LINES_COLOR, strokeWidth: CENTER_LINES_WIDTH };

        const modelRect = transform.clientToModelRect(transform.clientRect);

        const boundingRect = this.boundingRect;

        const xt = transform.translate.x + transform.clientRect.width / 2;
        const yt = transform.translate.y + transform.clientRect.height / 2;

        return (
            <CanvasDiv
                ref={ref => (this.div = ref!)}
                className={this.props.className}
                style={style}
                onClick={this.onClick}
                onWheel={this.onWheel}
                onContextMenu={this.onContextMenu}
            >
                <div
                    ref={ref => (this.innerDiv = ref!)}
                    style={{
                        transform: `translate(${-boundingRect.left}px, ${-boundingRect.top}px)`,
                        width: "100%",
                        height: "100%"
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: boundingRect.left,
                            top: boundingRect.top,
                            width: boundingRect.width - getScrollbarWidth(),
                            height: boundingRect.height - getScrollbarWidth(),
                            pointerEvents: "none"
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(${xt}px, ${yt}px) scale(${transform.scale})`,
                            transformOrigin: "0 0",
                            pointerEvents: "none"
                        }}
                    >
                        {this.designerContext.options && this.designerContext.options.center && (
                            <svg
                                width={modelRect.width}
                                height={modelRect.height}
                                style={{
                                    position: "absolute",
                                    left: modelRect.left,
                                    top: modelRect.top
                                }}
                                viewBox={`${modelRect.left}, ${modelRect.top}, ${
                                    modelRect.width
                                }, ${modelRect.height}`}
                            >
                                <line
                                    x1={modelRect.left}
                                    y1={this.designerContext.options.center.y}
                                    x2={modelRect.left + modelRect.width}
                                    y2={this.designerContext.options.center.y}
                                    style={centerLineStyle}
                                />
                                <line
                                    x1={this.designerContext.options.center.x}
                                    y1={modelRect.top}
                                    x2={this.designerContext.options.center.x}
                                    y2={modelRect.top + modelRect.height}
                                    style={centerLineStyle}
                                />
                            </svg>
                        )}
                        {this.props.children}
                    </div>
                    {this.props.toolHandler.render(this.designerContext, this.mouseHandler)}
                    {this.props.customOverlay}
                </div>
            </CanvasDiv>
        );
    }
}
