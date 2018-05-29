import * as React from "react";
import { observable, action, runInAction, reaction } from "mobx";
import { observer } from "mobx-react";
//import { DropTarget, DropTargetConnector, DropTargetMonitor } from "react-dnd";
import bind from "bind-decorator";

import { getBoundingClientRectOfChildNodes } from "shared/util";
import {
    Point,
    Rect,
    pointDistance,
    rectScale,
    rectExpand,
    BoundingRectBuilder
} from "shared/geometry";
import { ITool, MouseHandler } from "shared/ui/designer";

import {
    TransitionGroup,
    BounceEntranceTransition,
    BOUNCE_ENTRANCE_TRANSITION_DURATION
} from "shared/ui/transitions";

import { Draggable } from "shared/ui/draggable";

import { IObject } from "home/store";
import { IPage, ILayer } from "home/designer/designer-store";
import { Transform } from "home/designer/transform";
import { Selection } from "home/designer/selection";
import { PanMouseHandler } from "home/designer/mouse-handlers/pan";

const CONF_DOUBLE_CLICK_TIME = 500; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 10; // ms
const CONF_EXPAND_AMOUNT_FOR_BOUNDING_RECT = 100;
const CONF_TIMEOUT_FOR_TRANSLATE_ADJUSTMENT_AFTER_ON_SCROLL_EVENT = 1000; // 1 s
const CONF_CHANGE_SCROLL_TIMEOUT = 50; // 50 ms
const CONF_GUARD_ON_SCROLL_TIMEOUT = 50; // 50 ms

@observer
class ObjectComponent extends React.Component<
    {
        object: IObject;
        transform: Transform;
    },
    {}
> {
    element: Element;
    timeoutId: any;

    setBoundingRect(timeout: number) {
        if (!this.timeoutId) {
            this.timeoutId = setTimeout(() => {
                this.timeoutId = undefined;

                const rect = getBoundingClientRectOfChildNodes(this.element);
                if (rect) {
                    this.props.object.setBoundingRect(
                        this.props.transform.clientToModelRect(
                            rectScale(rect, 1 / window.devicePixelRatio)
                        )
                    );
                }
            }, timeout);
        }
    }

    componentDidMount() {
        this.setBoundingRect(BOUNCE_ENTRANCE_TRANSITION_DURATION);
    }

    componentDidUpdate() {
        this.setBoundingRect(10);
    }

    componentWillUnmount() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    render() {
        return (
            <g style={{ transformOrigin: "50% 50%" }}>
                <foreignObject
                    ref={ref => (this.element = ref!)}
                    data-oid={this.props.object.id}
                    x={this.props.object.rect.left}
                    y={this.props.object.rect.top}
                    width={this.props.object.rect.width}
                    height={this.props.object.rect.height}
                >
                    {this.props.object.content}
                </foreignObject>
            </g>
        );
    }
}

@observer
class Layer extends React.Component<
    {
        layer: ILayer;
        transform: Transform;
    },
    {}
> {
    render() {
        return (
            <TransitionGroup component="g" className="EezStudio_Layer">
                {this.props.layer.objects.map(obj => (
                    <BounceEntranceTransition key={obj.id}>
                        <ObjectComponent object={obj} transform={this.props.transform} />
                    </BounceEntranceTransition>
                ))}
            </TransitionGroup>
        );
    }
}

@observer
class Layers extends React.Component<
    {
        page: IPage;
        transform: Transform;
        scrollOffset: Point;
    },
    {}
> {
    render() {
        let scale = this.props.transform.scale;
        let translate = Object.assign({}, this.props.transform.translate);

        let xt =
            this.props.transform.clientRect.width / 2 + translate.x + this.props.scrollOffset.x;
        let yt =
            this.props.transform.clientRect.height / 2 + translate.y + this.props.scrollOffset.y;

        return (
            <g className="EezStudio_Layers" transform={`translate(${xt}, ${yt}) scale(${scale})`}>
                {this.props.page.layers.map(layer => (
                    <Layer key={layer.id} layer={layer} transform={this.props.transform} />
                ))}
            </g>
        );
    }
}

@observer
class Canvas extends React.Component<
    {
        page: IPage;
        transform: Transform;
        scrollOffset: Point;
    },
    {}
> {
    render() {
        return (
            <svg
                className="EezStudio_Canvas"
                width={this.props.transform.clientRect.width}
                height={this.props.transform.clientRect.height}
            >
                <Layers
                    page={this.props.page}
                    transform={this.props.transform}
                    scrollOffset={this.props.scrollOffset}
                />
            </svg>
        );
    }
}

interface PageProps {
    page: IPage;
    tool: ITool | undefined;
    selectDefaultTool: () => void;
    //connectDropTarget: any;
    //isOver: boolean;
}

@observer
class DndPage extends React.Component<PageProps, {}> {
    div: Element;
    intervalTimerIDForClientRectUpdate: any;
    deltaY = 0;

    @observable mouseHandler: MouseHandler | undefined;

    buttonsAtDown: number;
    lastMouseUpPosition: Point;
    lastMouseUpTime: number | undefined;

    get transform() {
        return this.props.page.transform;
    }

    draggable = new Draggable(this);

    // scroll div handling
    scrollDiv: Element;
    @observable.shallow
    boundingRect: Rect = {
        left: 0,
        top: 0,
        width: 0,
        height: 0
    };
    disposeAdjustScrollDivReaction: any;
    scrollStopTimeout: any;
    @observable.shallow
    scrollOffset: Point = {
        x: 0,
        y: 0
    };
    changeScrollTimeout: any;
    guardOnScrollTimeout: any;

    @bind
    ajdustScrollDiv() {
        const svg: SVGSVGElement = $(this.div).find("svg")[0] as any;
        const bbox = svg.getBBox();
        runInAction(() => {
            let boundingRectBuilder = new BoundingRectBuilder();

            boundingRectBuilder.addRect(
                rectExpand(
                    {
                        left: bbox.x,
                        top: bbox.y,
                        width: bbox.width,
                        height: bbox.height
                    },
                    CONF_EXPAND_AMOUNT_FOR_BOUNDING_RECT
                )
            );

            boundingRectBuilder.addRect({
                left: 0,
                top: 0,
                width: this.scrollDiv.clientWidth,
                height: this.scrollDiv.clientHeight
            });

            this.boundingRect = boundingRectBuilder.getRect()!;

            this.scrollOffset = {
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

    @action
    componentDidMount() {
        this.intervalTimerIDForClientRectUpdate = setInterval(() => {
            if (this.div) {
                let clientRect = this.div.getBoundingClientRect();
                if (
                    clientRect.left !== this.transform.clientRect.left ||
                    clientRect.top !== this.transform.clientRect.top ||
                    clientRect.width !== this.transform.clientRect.width ||
                    clientRect.height !== this.transform.clientRect.height
                ) {
                    runInAction(() => {
                        this.transform.clientRect = clientRect;
                    });
                }

                let visibleClientRect = {
                    left: clientRect.left,
                    top: clientRect.top,
                    width: clientRect.width,
                    height: clientRect.height
                };

                if (
                    visibleClientRect.left !== this.transform.visibleClientRect.left ||
                    visibleClientRect.top !== this.transform.visibleClientRect.top ||
                    visibleClientRect.width !== this.transform.visibleClientRect.width ||
                    visibleClientRect.height !== this.transform.visibleClientRect.height
                ) {
                    runInAction(() => {
                        this.transform.visibleClientRect = visibleClientRect;
                    });
                }
            }
        }, 0);

        this.draggable.attach(this.div);

        this.disposeAdjustScrollDivReaction = reaction(
            () => ({
                boundingBox: this.props.page.boundingRect,
                visibleClientRect: this.transform.visibleClientRect,
                translate: this.transform.translate,
                scale: this.transform.scale
            }),
            this.ajdustScrollDiv
        );

        this.ajdustScrollDiv();
    }

    componentWillUnmount() {
        if (this.intervalTimerIDForClientRectUpdate) {
            clearInterval(this.intervalTimerIDForClientRectUpdate);
            this.intervalTimerIDForClientRectUpdate = undefined;
        }

        this.draggable.attach(null);

        this.disposeAdjustScrollDivReaction();

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

    @action.bound
    onScroll(e: any) {
        if (this.guardOnScrollTimeout) {
            return;
        }

        if (this.scrollStopTimeout) {
            clearTimeout(this.scrollStopTimeout);
            this.scrollStopTimeout = undefined;
        }

        this.scrollOffset = {
            x: -(this.scrollDiv.scrollLeft + this.boundingRect.left),
            y: -(this.scrollDiv.scrollTop + this.boundingRect.top)
        };

        if (this.scrollOffset.x || this.scrollOffset.y) {
            this.scrollStopTimeout = setTimeout(() => {
                this.scrollStopTimeout = undefined;
                runInAction(() => {
                    this.transform.translate = {
                        x: this.transform.translate.x + this.scrollOffset.x,
                        y: this.transform.translate.y + this.scrollOffset.y
                    };
                    this.scrollOffset = {
                        x: 0,
                        y: 0
                    };
                });
            }, CONF_TIMEOUT_FOR_TRANSLATE_ADJUSTMENT_AFTER_ON_SCROLL_EVENT);
        }
    }

    @bind
    onWheel(event: React.WheelEvent<HTMLDivElement>) {
        if (this.scrollStopTimeout) {
            return;
        }

        if (event.buttons === 4) {
            // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
            return;
        }

        if (event.ctrlKey) {
            this.deltaY += event.deltaY;
            if (Math.abs(this.deltaY) > 10) {
                let scale: number;
                if (this.deltaY < 0) {
                    scale = this.transform.nextScale();
                } else {
                    scale = this.transform.previousScale();
                }

                this.deltaY = 0;

                var point = this.transform.clientToOffsetPoint({
                    x: event.clientX,
                    y: event.clientY
                });
                let x = point.x - this.transform.clientRect.width / 2;
                let y = point.y - this.transform.clientRect.height / 2;
                let tx = x - (x - this.transform.translate.x) * scale / this.transform.scale;
                let ty = y - (y - this.transform.translate.y) * scale / this.transform.scale;

                runInAction(() => {
                    this.transform.scale = scale;
                    this.transform.translate = { x: tx, y: ty };
                });
            }
        } else {
            runInAction(() => {
                this.transform.translate = {
                    x: this.transform.translate.x - (event.shiftKey ? event.deltaY : event.deltaX),
                    y: this.transform.translate.y - (event.shiftKey ? event.deltaX : event.deltaY)
                };
            });
        }

        event.preventDefault();
        event.stopPropagation();
    }

    @action.bound
    onDragStart(event: PointerEvent) {
        if (this.scrollStopTimeout) {
            return;
        }

        this.buttonsAtDown = event.buttons;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.props.page, event);
            this.mouseHandler = undefined;
        }

        if (event.buttons && event.buttons !== 1) {
            this.mouseHandler = new PanMouseHandler();
        } else {
            if (this.props.tool) {
                this.mouseHandler = this.props.tool.toolHandler.createMouseHandler(
                    this.props.page,
                    event
                );
            }
        }

        if (this.mouseHandler) {
            this.mouseHandler.down(this.props.page, event);
        }
    }

    @bind
    onDragMove(event: PointerEvent) {
        if (this.mouseHandler) {
            this.mouseHandler.move(this.props.page, event);
        }
    }

    @action.bound
    onDragEnd(event: PointerEvent) {
        let preventContextMenu = false;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.props.page, event);

            if (this.mouseHandler instanceof PanMouseHandler) {
                if (pointDistance(this.mouseHandler.totalMovement) > 10) {
                    preventContextMenu = true;
                }
            }

            this.mouseHandler = undefined;
        }

        let time = new Date().getTime();

        if (this.buttonsAtDown === 1) {
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
                    if (this.props.page.selectedObjects.length === 1) {
                        const object = this.props.page.selectedObjects[0];
                        if (object.isEditable) {
                            object.openEditor!("default");
                        }
                    } else if (this.props.page.selectedObjects.length === 0) {
                        this.transform.scale = 1;
                        this.transform.translate = {
                            x: 0,
                            y: 0
                        };
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

            if (!preventContextMenu && this.props.tool && this.buttonsAtDown === 2) {
                this.props.tool.toolHandler.onContextMenu(
                    this.props.page,
                    this.transform.mouseEventToModelPoint(event),
                    (menu: Electron.Menu) => {
                        if (this.mouseHandler) {
                            this.mouseHandler.up(this.props.page);
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
        if (this.props.tool) {
            event.preventDefault();
            event.stopPropagation();

            this.props.tool.toolHandler.onClick(
                this.props.page,
                this.transform.mouseEventToModelPoint(event.nativeEvent)
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
            if (this.props.tool && this.props.tool.toolHandler.cursor) {
                style.cursor = this.props.tool.toolHandler.cursor;
            }
        }

        this.draggable.cursor = style.cursor;

        return (
            /*this.props.connectDropTarget*/
            <div
                ref={ref => (this.div = ref!)}
                className="EezStudio_PageCanvas"
                style={style}
                onWheel={this.onWheel}
                onClick={this.onClick}
            >
                <Canvas
                    page={this.props.page}
                    transform={this.transform}
                    scrollOffset={this.scrollOffset}
                />

                {this.props.page.selectionVisible &&
                    this.props.tool &&
                    this.props.tool.id === "select" && (
                        <Selection
                            page={this.props.page}
                            transform={this.transform}
                            rubberBendRect={this.props.page.rubberBendRect}
                        />
                    )}

                <div
                    className={"EezStudio_PageScrollDiv"}
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
                            height: this.boundingRect.height
                        }}
                    />
                </div>
            </div>
        );
    }
}

// export const Page = DropTarget(
//     "ToolFromToolbox",
//     {
//         drop(props: any, monitor: DropTargetMonitor, pageComponent: DndPage) {
//             let tool: ITool = props.tool;
//             return tool.toolHandler.drop(
//                 pageComponent.props.page,
//                 pageComponent.transform.clientToModelPoint(monitor.getClientOffset())
//             );
//         },

//         canDrop() {
//             return true;
//         }
//     },
//     (connect: DropTargetConnector, monitor: DropTargetMonitor) => {
//         return {
//             connectDropTarget: connect.dropTarget(),
//             isOver: monitor.isOver(),
//             canDrop: monitor.canDrop()
//         };
//     }
// )(DndPage);
export const Page = DndPage;
