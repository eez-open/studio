import React from "react";
import { observable, action, runInAction } from "mobx";
import { observer, inject } from "mobx-react";
import { bind } from "bind-decorator";

import { Point, pointDistance } from "eez-studio-shared/geometry";

import { Draggable } from "eez-studio-ui/draggable";

import {
    IToolHandler,
    IMouseHandler,
    IContextMenu,
    IDesignerContext
} from "eez-studio-designer/designer-interfaces";
import { PanMouseHandler } from "eez-studio-designer/mouse-handlers/pan";
import { ScrollDiv } from "eez-studio-designer/scroll-div";

////////////////////////////////////////////////////////////////////////////////

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class Canvas extends React.Component<
    {
        designerContext?: IDesignerContext;
        toolHandler: IToolHandler;
        className?: string;
        style?: React.CSSProperties;
    },
    {}
> {
    div: Element;
    svg: SVGSVGElement;
    intervalTimerIDForClientRectUpdate: any;
    deltaY = 0;

    get designerContext() {
        return this.props.designerContext!;
    }

    @observable
    private _mouseHandler: IMouseHandler | undefined;
    get mouseHandler() {
        return this._mouseHandler;
    }
    set mouseHandler(value: IMouseHandler | undefined) {
        runInAction(() => {
            this._mouseHandler = value;
            this.designerContext.viewState.isIdle = !this._mouseHandler;
        });
    }

    private buttonsAtDown: number;
    private lastMouseUpPosition: Point;
    private lastMouseUpTime: number | undefined;

    private draggable = new Draggable(this);

    scrollDiv: ScrollDiv;

    componentDidMount() {
        this.draggable.attach(this.div);

        this.intervalTimerIDForClientRectUpdate = setInterval(() => {
            const transform = this.designerContext.viewState.transform;

            let clientRect = this.div.getBoundingClientRect();
            if (
                clientRect.left !== transform.clientRect.left ||
                clientRect.top !== transform.clientRect.top ||
                clientRect.width !== transform.clientRect.width ||
                clientRect.height !== transform.clientRect.height
            ) {
                runInAction(() => {
                    transform.clientRect = clientRect;
                });
            }
        }, 0);
    }

    componentWillUnmount() {
        this.draggable.attach(null);

        if (this.intervalTimerIDForClientRectUpdate) {
            clearInterval(this.intervalTimerIDForClientRectUpdate);
            this.intervalTimerIDForClientRectUpdate = undefined;
        }
    }

    @bind
    onWheel(event: React.WheelEvent<HTMLDivElement>) {
        if (this.scrollDiv.isScrolling) {
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

    @action.bound
    onDragStart(event: PointerEvent) {
        if (this.scrollDiv.isScrolling) {
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

            if (!preventContextMenu && this.props.toolHandler && this.buttonsAtDown === 2) {
                this.props.toolHandler.onContextMenu(
                    this.designerContext,
                    transform.mouseEventToModelPoint(event),
                    (menu: IContextMenu) => {
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
                this.designerContext.viewState.transform.mouseEventToModelPoint(event.nativeEvent)
            );
        }
    }

    render() {
        let style: React.CSSProperties = {
            cursor: "default"
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

        let xt = transform.clientRect.width / 2 + transform.translate.x + transform.scrollOffset.x;
        let yt = transform.clientRect.height / 2 + transform.translate.y + transform.scrollOffset.y;

        const CENTER_LINES_COLOR = "rgba(0, 0, 0, 0.2)";
        const CENTER_LINES_WIDTH = 1 / transform.scale;
        const centerLineStyle = { stroke: CENTER_LINES_COLOR, strokeWidth: CENTER_LINES_WIDTH };

        const modelRect = transform.clientToModelRect(transform.clientRect);

        return (
            <div
                ref={ref => (this.div = ref!)}
                className={this.props.className}
                style={style}
                onClick={this.onClick}
                onWheel={this.onWheel}
            >
                <ScrollDiv
                    ref={ref => (this.scrollDiv = ref!)}
                    transform={this.designerContext.viewState.transform}
                >
                    <svg
                        ref={ref => (this.svg = ref!)}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0
                        }}
                        width={transform.clientRect.width}
                        height={transform.clientRect.height}
                    >
                        <g transform={`translate(${xt}, ${yt}) scale(${transform.scale})`}>
                            {this.designerContext.options && this.designerContext.options.center && (
                                <React.Fragment>
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
                                </React.Fragment>
                            )}
                            {this.props.children}
                        </g>
                    </svg>

                    {this.props.toolHandler.render(this.designerContext, this.mouseHandler)}
                </ScrollDiv>
            </div>
        );
    }
}
