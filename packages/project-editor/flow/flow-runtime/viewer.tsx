import React from "react";
import { action, computed, observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import {
    BoundingRectBuilder,
    Point,
    pointDistance,
    pointInRect,
    Rect,
    rectContains
} from "eez-studio-shared/geometry";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { RuntimeFlowContext } from "project-editor/flow/flow-runtime/context";

import { IPanel } from "project-editor/core/store";

import type { Flow, FlowTabState } from "project-editor/flow/flow";
import { Svg } from "project-editor/flow/flow-editor/render";
import { ProjectContext } from "project-editor/project/context";
import { ConnectionLines } from "project-editor/flow/flow-editor/ConnectionLineComponent";
import { Selection } from "project-editor/flow/flow-runtime/selection";
import {
    getObjectBoundingRect,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/flow-editor/bounding-rects";
import { attachCssToElement } from "eez-studio-shared/dom";
import { Draggable } from "eez-studio-ui/draggable";
import { IMouseHandler, PanMouseHandler } from "../flow-editor/mouse-handler";
import { ProjectEditor } from "project-editor/project-editor-interface";

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

const AllConnectionLines = observer(
    ({ flowContext }: { flowContext: IFlowContext }) => {
        return (
            <Svg flowContext={flowContext}>
                <ConnectionLines
                    connectionLines={
                        flowContext.document.nonSelectedConnectionLines
                    }
                    context={flowContext}
                    selected={false}
                />
                <ConnectionLines
                    connectionLines={
                        flowContext.document.selectedConnectionLines
                    }
                    context={flowContext}
                    selected={true}
                />
            </Svg>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

@observer
export class Canvas extends React.Component<{
    flowContext: IFlowContext;
    pageRect?: Rect;
}> {
    div: HTMLDivElement;
    resizeObserver: ResizeObserver;
    deltaY = 0;

    buttonsAtDown: number;
    lastMouseUpPosition: Point;
    lastMouseUpTime: number | undefined;

    draggable = new Draggable(this);

    constructor(props: any) {
        super(props);

        this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
    }

    @observable _mouseHandler: IMouseHandler | undefined;
    get mouseHandler() {
        return this._mouseHandler;
    }
    set mouseHandler(value: IMouseHandler | undefined) {
        runInAction(() => {
            this._mouseHandler = value;
        });
    }

    resizeObserverCallback = () => {
        if ($(this.div).is(":visible")) {
            const transform = this.props.flowContext.viewState.transform;

            let clientRect = this.div.getBoundingClientRect();
            if (
                clientRect.left !== transform.clientRect.left ||
                clientRect.top !== transform.clientRect.top ||
                (clientRect.width &&
                    clientRect.width !== transform.clientRect.width) ||
                (clientRect.height &&
                    clientRect.height !== transform.clientRect.height)
            ) {
                runInAction(() => {
                    transform.clientRect = clientRect;
                });
            }
        }
    };

    componentDidMount() {
        if (
            this.props.flowContext.DocumentStore.runtime &&
            this.props.flowContext.DocumentStore.runtime.isDebuggerActive
        ) {
            this.draggable.attach(this.div);
        }

        this.div.addEventListener("wheel", this.onWheel, {
            passive: false
        });

        if (this.div) {
            this.resizeObserver.observe(this.div);
        }
    }

    componentDidUpdate() {
        this.resizeObserverCallback();
    }

    componentWillUnmount() {
        this.draggable.attach(null);

        this.div.removeEventListener("wheel", this.onWheel);

        if (this.div) {
            this.resizeObserver.unobserve(this.div);
        }
    }

    @bind
    onWheel(event: WheelEvent) {
        if (event.buttons === 4) {
            // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
            return;
        }

        const transform = this.props.flowContext.viewState.transform.clone();

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
                let tx =
                    x - ((x - transform.translate.x) * scale) / transform.scale;
                let ty =
                    y - ((y - transform.translate.y) * scale) / transform.scale;

                transform.scale = scale;
                transform.translate = { x: tx, y: ty };

                runInAction(() => {
                    this.props.flowContext.viewState.transform = transform;
                });
            }
        } else {
            transform.translate = {
                x:
                    transform.translate.x -
                    (event.shiftKey ? event.deltaY : event.deltaX),
                y:
                    transform.translate.y -
                    (event.shiftKey ? event.deltaX : event.deltaY)
            };

            runInAction(() => {
                this.props.flowContext.viewState.transform = transform;
            });
        }

        event.preventDefault();
        event.stopPropagation();
    }

    @bind
    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();
    }

    createMouseHandler(event: MouseEvent) {
        const flowContext = this.props.flowContext;

        if (!event.altKey) {
            let point =
                flowContext.viewState.transform.pointerEventToPagePoint(event);
            const result = flowContext.document.objectFromPoint(point);
            if (result) {
                const object = flowContext.document.findObjectById(result.id);
                if (object) {
                    flowContext.viewState.deselectAllObjects();
                    flowContext.viewState.selectObject(object);
                    event.preventDefault();
                }
            } else {
                flowContext.viewState.deselectAllObjects();
            }
        }

        return undefined;
    }

    @action.bound
    onDragStart(event: PointerEvent) {
        this.buttonsAtDown = event.buttons;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.props.flowContext);
            this.mouseHandler = undefined;
        }

        if (event.buttons && event.buttons !== 1) {
            this.mouseHandler = new PanMouseHandler();
        } else {
            this.mouseHandler = this.createMouseHandler(event);
        }

        if (this.mouseHandler) {
            this.mouseHandler.lastPointerEvent = {
                clientX: event.clientX,
                clientY: event.clientY,
                movementX: event.movementX ?? 0,
                movementY: event.movementY ?? 0,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey
            };

            this.mouseHandler.down(this.props.flowContext, event);
        }
    }

    @bind
    onDragMove(event: PointerEvent) {
        if (this.mouseHandler) {
            this.mouseHandler.lastPointerEvent = {
                clientX: event.clientX,
                clientY: event.clientY,
                movementX: event.movementX
                    ? event.movementX
                    : this.mouseHandler.lastPointerEvent
                    ? this.mouseHandler.lastPointerEvent.movementX
                    : 0,
                movementY: event.movementY
                    ? event.movementY
                    : this.mouseHandler.lastPointerEvent
                    ? this.mouseHandler.lastPointerEvent.movementY
                    : 0,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey
            };

            this.mouseHandler.move(this.props.flowContext, event);
        }
    }

    @action.bound
    onDragEnd(event: PointerEvent) {
        let preventContextMenu = false;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.props.flowContext);

            if (this.mouseHandler instanceof PanMouseHandler) {
                if (pointDistance(this.mouseHandler.totalMovement) > 10) {
                    preventContextMenu = true;
                }
            }

            this.mouseHandler = undefined;
        }

        let time = new Date().getTime();

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
                        if (
                            this.props.flowContext.viewState.selectedObjects
                                .length === 1
                        ) {
                            const object =
                                this.props.flowContext.viewState
                                    .selectedObjects[0];
                            object.open();
                        } else if (
                            this.props.flowContext.viewState.selectedObjects
                                .length === 0
                        ) {
                            this.props.flowContext.viewState.resetTransform();
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

            if (!preventContextMenu && this.buttonsAtDown === 2) {
                // show context menu
                const context = this.props.flowContext;
                const point =
                    context.viewState.transform.pointerEventToPagePoint(event);
                if (
                    context.viewState.selectedObjects.length === 0 ||
                    !pointInRect(
                        point,
                        getSelectedObjectsBoundingRect(context.viewState)
                    )
                ) {
                    context.viewState.deselectAllObjects();

                    let result = context.document.objectFromPoint(point);
                    if (result) {
                        const object = context.document.findObjectById(
                            result.id
                        );
                        if (object) {
                            context.viewState.selectObject(object);
                        }
                    }
                }

                setTimeout(() => {
                    const menu = context.document.createContextMenu(
                        context.viewState.selectedObjects
                    );
                    if (menu) {
                        if (this.mouseHandler) {
                            this.mouseHandler.up(this.props.flowContext);
                            this.mouseHandler = undefined;
                        }

                        menu.popup({});
                    }
                }, 0);
            }
        }
    }

    render() {
        let style: React.CSSProperties = {};

        const transform = this.props.flowContext.viewState.transform;

        const xt = Math.round(
            transform.translate.x + transform.clientRect.width / 2
        );
        const yt = Math.round(
            transform.translate.y + transform.clientRect.height / 2
        );

        if (
            transform.clientRect.width <= 1 ||
            transform.clientRect.height <= 1
        ) {
            style.visibility = "hidden";
        }

        const runtimeStore = this.props.flowContext.DocumentStore.runtime;

        return (
            <div
                ref={(ref: any) => (this.div = ref!)}
                style={style}
                onContextMenu={this.onContextMenu}
            >
                <div
                    className="eez-canvas"
                    style={{
                        position: "absolute",
                        transform: `translate(${xt}px, ${yt}px) scale(${transform.scale})`
                    }}
                >
                    {this.props.children}
                </div>
                {runtimeStore &&
                    runtimeStore.isDebuggerActive &&
                    (runtimeStore.isPaused || runtimeStore.isStopped) && (
                        <Selection
                            context={this.props.flowContext}
                            mouseHandler={undefined}
                        />
                    )}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class FlowViewer
    extends React.Component<{
        tabState: FlowTabState;
    }>
    implements IPanel
{
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    divRef = React.createRef<HTMLDivElement>();

    @computed
    get flowContext() {
        const flowContext = new RuntimeFlowContext();

        flowContext.set(this.props.tabState);

        return flowContext;
    }

    disposeCSS: (() => void) | undefined;

    componentDidMount() {
        if (this.divRef.current) {
            this.disposeCSS = attachCssToElement(
                this.divRef.current,
                this.context.project.settings.general.css
            );
        }

        this.divRef.current?.addEventListener(
            "ensure-selection-visible",
            this.ensureSelectionVisible
        );
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    componentWillUnmount() {
        this.divRef.current?.removeEventListener(
            "ensure-selection-visible",
            this.ensureSelectionVisible
        );

        if (this.disposeCSS) {
            this.disposeCSS();
        }
    }

    ensureSelectionVisible = () => {
        if (this.flowContext.viewState.selectedObjects.length > 0) {
            const selectedObjectRects =
                this.flowContext.viewState.selectedObjects
                    .filter(
                        selectedObject =>
                            selectedObject.object instanceof
                            ProjectEditor.ComponentClass
                    )
                    .map(selectedObject =>
                        getObjectBoundingRect(selectedObject)
                    );

            let selectionBoundingRectBuilder = new BoundingRectBuilder();
            for (let i = 0; i < selectedObjectRects.length; i++) {
                selectionBoundingRectBuilder.addRect(selectedObjectRects[i]);
            }
            const selectionBoundingRect =
                selectionBoundingRectBuilder.getRect();

            let pageRect =
                this.flowContext.viewState.transform.clientToPageRect(
                    this.flowContext.viewState.transform.clientRect
                );

            if (!rectContains(pageRect, selectionBoundingRect)) {
                const selectionEl = this.divRef.current?.querySelector(
                    ".EezStudio_FlowRuntimeSelection"
                ) as HTMLDivElement;
                const canvasEl = this.divRef.current?.querySelector(
                    ".eez-canvas"
                ) as HTMLCanvasElement;

                canvasEl.style.transition = "transform 0.2s";
                selectionEl.style.display = "none";

                this.flowContext.viewState.transform.translate = {
                    x: -(
                        selectionBoundingRect.left +
                        selectionBoundingRect.width / 2
                    ),
                    y: -(
                        selectionBoundingRect.top +
                        selectionBoundingRect.height / 2
                    )
                };

                setTimeout(() => {
                    canvasEl.style.transition = "";
                    selectionEl.style.display = "block";
                }, 200);
            }
        }
    };

    @computed
    get selectedObject() {
        return this.props.tabState.widgetContainer.selectedObjects[0];
    }

    @computed
    get selectedObjects() {
        return this.props.tabState.widgetContainer.selectedObjects;
    }

    cutSelection() {}

    copySelection() {}

    pasteSelection() {}

    deleteSelection() {}

    @bind
    focusHander() {
        this.context.navigationStore.setSelectedPanel(this);
    }

    getDragComponent(event: React.DragEvent) {
        return undefined;
    }

    @bind
    onDoubleClick() {
        this.flowContext.viewState.resetTransform();
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    render() {
        const flow = this.props.tabState.widgetContainer.object as Flow;

        return (
            <div
                className="EezStudio_FlowViewerCanvasContainer"
                ref={this.divRef}
                id={this.flowContext.viewState.containerId}
                onFocus={this.focusHander}
                onDoubleClick={this.onDoubleClick}
            >
                <Canvas flowContext={this.flowContext}>
                    {this.flowContext.document?.flow.object === flow && (
                        <>
                            <div
                                style={{
                                    position: "absolute"
                                }}
                            >
                                {flow.renderComponents(this.flowContext)}
                            </div>
                            {!this.props.tabState.frontFace && (
                                <AllConnectionLines
                                    flowContext={this.flowContext}
                                />
                            )}
                        </>
                    )}
                </Canvas>
            </div>
        );
    }
}
