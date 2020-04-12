import React from "react";
import { computed, observable, action, runInAction } from "mobx";
import { observer, inject } from "mobx-react";
import { bind } from "bind-decorator";

import { Point, pointDistance, Rect, BoundingRectBuilder } from "eez-studio-shared/geometry";

import { Draggable } from "eez-studio-ui/draggable";
import styled from "eez-studio-ui/styled-components";

import {
    IToolHandler,
    IMouseHandler,
    IDesignerContext
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { PanMouseHandler } from "project-editor/features/gui/page-editor/mouse-handler";

////////////////////////////////////////////////////////////////////////////////

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

const CanvasDiv = styled.div`
    cursor: default;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
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
    pageRect?: Rect;
}> {
    div: HTMLDivElement;
    innerDiv: Element;
    clientRectChangeDetectionAnimationFrameHandle: any;
    deltaY = 0;

    get designerContext() {
        return this.props.designerContext!;
    }

    @observable _mouseHandler: IMouseHandler | undefined;
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

    @computed
    get boundingOffsetRect() {
        const transform = this.designerContext.viewState.transform;
        const builder = new BoundingRectBuilder();
        builder.addRect(transform.clientToOffsetRect(transform.clientRect));
        return builder.getRect()!;
    }

    updateScroll() {
        const boundingRect = this.boundingOffsetRect;

        this.div.scrollLeft = -boundingRect.left;
        this.scrollLeft = this.div.scrollLeft;

        this.div.scrollTop = -boundingRect.top;
        this.scrollTop = this.div.scrollTop;

        if (
            this.boundingOffsetRect.width >
            this.designerContext.viewState.transform.clientRect.width
        ) {
            this.div.style.overflowX = "auto";
        } else {
            this.div.style.overflowX = "hidden";
        }

        if (
            this.boundingOffsetRect.height >
            this.designerContext.viewState.transform.clientRect.height
        ) {
            this.div.style.overflowY = "auto";
        } else {
            this.div.style.overflowY = "hidden";
        }
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
        }

        this.clientRectChangeDetectionAnimationFrameHandle = requestAnimationFrame(
            this.clientRectChangeDetection
        );
    }

    componentDidMount() {
        this.draggable.attach(this.innerDiv);
        this.updateScroll();
        this.clientRectChangeDetection();

        this.div.addEventListener("wheel", this.onWheel, {
            passive: false
        });
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

        this.div.removeEventListener("wheel", this.onWheel);
    }

    @bind
    onWheel(event: WheelEvent) {
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
                    scale = transform.nextScale;
                } else {
                    scale = transform.previousScale;
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

            if (!preventContextMenu && this.props.toolHandler && this.buttonsAtDown === 2) {
                this.props.toolHandler.onContextMenu(
                    this.designerContext,
                    transform.mouseEventToPagePoint(event),
                    (menu: Electron.Menu) => {
                        if (this.mouseHandler) {
                            this.mouseHandler.up(this.designerContext);
                            this.mouseHandler = undefined;
                        }

                        menu.popup({});
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
                this.designerContext.viewState.transform.mouseEventToPagePoint(event.nativeEvent)
            );
        }
    }

    @action.bound
    onScroll() {
        // TODO
        // currently, scrolling by using scroll bars are disabled
        this.div.scrollLeft = this.scrollLeft;
        this.div.scrollTop = this.scrollTop;
    }

    render() {
        let style: React.CSSProperties = {};
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

        const CENTER_LINES_COLOR = "#ddd";
        const CENTER_LINES_WIDTH = 1 / transform.scale;
        const centerLineStyle = {
            fill: "transparent",
            stroke: CENTER_LINES_COLOR,
            strokeWidth: CENTER_LINES_WIDTH
        };
        const PAGE_RECT_LINES_COLOR = "#ddd";
        const PAGE_RECT_LINES_WIDTH = 2 / transform.scale;
        const pageRectLineStyle = {
            fill: "transparent",
            stroke: PAGE_RECT_LINES_COLOR,
            strokeWidth: PAGE_RECT_LINES_WIDTH
        };

        const pageRect = transform.clientToPageRect(transform.clientRect);

        const boundingOffsetRect = this.boundingOffsetRect;

        const xt = transform.translate.x + transform.clientRect.width / 2;
        const yt = transform.translate.y + transform.clientRect.height / 2;

        return (
            <CanvasDiv
                ref={(ref: any) => (this.div = ref!)}
                className={this.props.className}
                style={style}
                onClick={this.onClick}
                onContextMenu={this.onContextMenu}
                onScroll={this.onScroll}
            >
                <div
                    ref={ref => (this.innerDiv = ref!)}
                    style={{
                        transform: `translate(${-boundingOffsetRect.left}px, ${-boundingOffsetRect.top}px)`,
                        width: "100%",
                        height: "100%"
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(${xt}px, ${yt}px) scale(${transform.scale})`,
                            transformOrigin: "0 0",
                            pointerEvents: "none"
                        }}
                    >
                        {this.props.children}
                        {this.designerContext.options && this.designerContext.options.center && (
                            <svg
                                width={pageRect.width}
                                height={pageRect.height}
                                style={{
                                    position: "absolute",
                                    left: pageRect.left,
                                    top: pageRect.top
                                }}
                                viewBox={`${pageRect.left}, ${pageRect.top}, ${pageRect.width}, ${pageRect.height}`}
                            >
                                <line
                                    x1={pageRect.left}
                                    y1={this.designerContext.options.center.y}
                                    x2={pageRect.left + pageRect.width}
                                    y2={this.designerContext.options.center.y}
                                    style={centerLineStyle}
                                />
                                <line
                                    x1={this.designerContext.options.center.x}
                                    y1={pageRect.top}
                                    x2={this.designerContext.options.center.x}
                                    y2={pageRect.top + pageRect.height}
                                    style={centerLineStyle}
                                />
                                {this.props.pageRect && (
                                    <rect
                                        x={this.props.pageRect.left}
                                        y={this.props.pageRect.top}
                                        width={this.props.pageRect.width}
                                        height={this.props.pageRect.height}
                                        style={pageRectLineStyle}
                                    />
                                )}
                            </svg>
                        )}
                    </div>
                    {this.props.toolHandler.render(this.designerContext, this.mouseHandler)}
                    {this.props.customOverlay}
                </div>
            </CanvasDiv>
        );
    }
}
