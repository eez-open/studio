import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    BoundingRectBuilder,
    Point,
    pointDistance,
    pointInRect,
    Rect,
    rectContains
} from "eez-studio-shared/geometry";
import { closestByClass, closestBySelector } from "eez-studio-shared/dom";

import { Draggable } from "eez-studio-ui/draggable";

import { settingsController } from "home/settings";

import { setParent, getId, getParent } from "project-editor/core/object";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { DragAndDropManager } from "project-editor/core/dd";

import {
    IPanel,
    isObjectInstanceOf,
    isLVGLCreateInProgress
} from "project-editor/store";

import type { IEditorOptions } from "project-editor/flow/flow-interfaces";
import type { Flow } from "project-editor/flow/flow";
import type { FlowTabState } from "project-editor/flow/flow-tab-state";
import type { Component } from "project-editor/flow/component";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    TimelinePathEditor,
    WidgetTimelinePathEditorHandler
} from "project-editor/flow/timeline";

import { EditorFlowContext } from "project-editor/flow/editor/context";
import {
    getObjectBoundingRect,
    getObjectIdFromPoint,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/editor/bounding-rects";
import {
    IMouseHandler,
    PanMouseHandler,
    NewConnectionLineFromOutputMouseHandler,
    NewConnectionLineFromInputMouseHandler,
    MoveInputConnectionLinesMouseHandler,
    MoveOutputConnectionLinesMouseHandler,
    DragMouseHandler,
    isSelectionMoveable,
    ResizeMouseHandler,
    RubberBandSelectionMouseHandler,
    LVGLPanMouseHandler
} from "project-editor/flow/editor/mouse-handler";
import { Svg, ComponentEnclosure } from "project-editor/flow/editor/render";
import { ConnectionLines } from "project-editor/flow/connection-line/ConnectionLineComponent";
import { Selection } from "project-editor/flow/editor/selection";
import { setupDragScroll } from "project-editor/flow/editor/drag-scroll";
import {
    DragSnapLines,
    DragSnapLinesOverlay
} from "project-editor/flow/editor/snap-lines";

// import { ConnectionLineParams } from "project-editor/flow/connection-line/connection-line-shape";

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

const DragComponent = observer(
    ({ flow, flowContext }: { flow: Flow; flowContext: EditorFlowContext }) => {
        const dragComponent = flowContext.dragComponent;
        return flowContext.dragComponent ? (
            <ComponentEnclosure
                component={flowContext.dragComponent}
                left={
                    (dragComponent instanceof ProjectEditor.WidgetClass
                        ? flow.pageRect.left
                        : 0) + flowContext.dragComponent.left
                }
                top={
                    (dragComponent instanceof ProjectEditor.WidgetClass
                        ? flow.pageRect.top
                        : 0) + flowContext.dragComponent.top
                }
                flowContext={flowContext}
            />
        ) : null;
    }
);

////////////////////////////////////////////////////////////////////////////////

const AllConnectionLines = observer(
    ({ flowContext }: { flowContext: EditorFlowContext }) => {
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
                        flowContext.document.selectedAndHoveredConnectionLines
                    }
                    context={flowContext}
                    selected={true}
                />
            </Svg>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const CenterLines = observer(
    class CenterLines extends React.Component<{
        flowContext: EditorFlowContext;
    }> {
        render() {
            const { flowContext } = this.props;

            const transform = flowContext.viewState.transform;

            const CENTER_LINES_COLOR = settingsController.isDarkTheme
                ? "#444"
                : "#eee";
            const CENTER_LINES_WIDTH = 1 / transform.scale;

            const centerLineStyle = {
                fill: "url(#page-background)",
                stroke: CENTER_LINES_COLOR,
                strokeWidth: CENTER_LINES_WIDTH
            };

            const center = flowContext.editorOptions.center!;

            const pageRect = transform.clientToPageRect(transform.clientRect);

            let pageFlowRect;
            if (flowContext.flow instanceof ProjectEditor.PageClass) {
                pageFlowRect = flowContext.flow.pageRect;
            }

            return (
                <Svg flowContext={flowContext}>
                    {pageFlowRect &&
                        !flowContext.projectStore.project.settings.general
                            .circularDisplay &&
                        flowContext.projectStore.project.settings.general
                            .displayBorderRadius == 0 && (
                            <rect
                                x={pageFlowRect.left}
                                y={pageFlowRect.top}
                                width={pageFlowRect.width}
                                height={pageFlowRect.height}
                                style={centerLineStyle}
                            />
                        )}
                    <line
                        x1={pageRect.left}
                        y1={center.y}
                        x2={pageRect.left + pageRect.width}
                        y2={center.y}
                        style={centerLineStyle}
                    />
                    <line
                        x1={center.x}
                        y1={pageRect.top}
                        x2={center.x}
                        y2={pageRect.top + pageRect.height}
                        style={centerLineStyle}
                    />
                </Svg>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Canvas = observer(
    class Canvas extends React.Component<{
        children?: React.ReactNode;
        flowContext: EditorFlowContext;
        pageRect?: Rect;
        dragAndDropActive: boolean;
        dragSnapLines: DragSnapLines;
    }> {
        div: HTMLDivElement;
        updateClientRectRequestAnimationFrameId: any;
        deltaY = 0;

        dragScrollDispose: (() => void) | undefined;

        buttonsAtDown: number;
        lastMouseUpPosition: Point;
        lastMouseUpTime: number | undefined;

        draggable = new Draggable(this);

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                _mouseHandler: observable,
                onDragStart: action.bound,
                onDragEnd: action.bound
            });
        }

        _mouseHandler: IMouseHandler | undefined;
        get mouseHandler() {
            return this._mouseHandler;
        }
        set mouseHandler(value: IMouseHandler | undefined) {
            if (this.dragScrollDispose) {
                this.dragScrollDispose();
                this.dragScrollDispose = undefined;
            }

            runInAction(() => {
                this._mouseHandler = value;
            });

            if (
                this.mouseHandler &&
                (this.mouseHandler instanceof RubberBandSelectionMouseHandler ||
                    this.mouseHandler instanceof
                        NewConnectionLineFromOutputMouseHandler ||
                    this.mouseHandler instanceof
                        NewConnectionLineFromInputMouseHandler ||
                    this.mouseHandler instanceof
                        MoveOutputConnectionLinesMouseHandler ||
                    this.mouseHandler instanceof
                        MoveInputConnectionLinesMouseHandler ||
                    this.mouseHandler instanceof DragMouseHandler ||
                    this.mouseHandler instanceof ResizeMouseHandler ||
                    this.mouseHandler instanceof
                        WidgetTimelinePathEditorHandler)
            ) {
                this.dragScrollDispose = setupDragScroll(
                    this.div,
                    () => this.mouseHandler?.lastPointerEvent,
                    (point: Point) => {
                        const newTransform =
                            this.props.flowContext.viewState.transform.clone();
                        newTransform.translateBy(point);

                        runInAction(() => {
                            this.props.flowContext.viewState.transform =
                                newTransform;
                        });

                        this.mouseHandler?.onTransformChanged(
                            this.props.flowContext
                        );
                    }
                );
            }

            if (this.mouseHandler) {
                this.div.style.cursor = this.mouseHandler.cursor;
            } else {
                this.div.style.cursor = "";
            }
        }

        updateClientRect = () => {
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

            this.updateClientRectRequestAnimationFrameId =
                requestAnimationFrame(this.updateClientRect);
        };

        componentDidMount() {
            this.draggable.attach(this.div);

            this.div.addEventListener("wheel", this.onWheel, {
                passive: false
            });

            this.updateClientRect();
        }

        componentWillUnmount() {
            this.draggable.attach(null);

            this.div.removeEventListener("wheel", this.onWheel);

            cancelAnimationFrame(this.updateClientRectRequestAnimationFrameId);
        }

        onWheel = (event: WheelEvent) => {
            if (event.buttons === 4) {
                // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
                return;
            }

            if (
                this.mouseHandler instanceof PanMouseHandler ||
                this.mouseHandler instanceof LVGLPanMouseHandler
            ) {
                return;
            }

            const transform =
                this.props.flowContext.viewState.transform.clone();

            const flowContext = this.props.flowContext;

            let deltaX = event.deltaX;
            let deltaY = event.deltaY;

            if (
                event.altKey &&
                flowContext.projectStore.projectTypeTraits.isLVGL
            ) {
                let point =
                    flowContext.viewState.transform.pointerEventToPagePoint(
                        event
                    );
                const object = flowContext.document.objectFromPoint(point);
                if (object) {
                    const objectAdapter = flowContext.document.findObjectById(
                        object.id
                    );
                    if (objectAdapter) {
                        let object = objectAdapter.object;
                        while (object) {
                            if (
                                object instanceof ProjectEditor.LVGLWidgetClass
                            ) {
                                const lvglWidget = object;
                                if (
                                    lvglWidget.widgetFlags.indexOf(
                                        "SCROLLABLE"
                                    ) != -1 &&
                                    lvglWidget.children.length > 0
                                ) {
                                    if (Math.abs(deltaX) == 100) deltaX /= 5;
                                    if (Math.abs(deltaY) == 100) deltaY /= 5;

                                    let xScroll =
                                        lvglWidget._xScroll2 +
                                        (event.shiftKey ? deltaY : deltaX);

                                    let yScroll =
                                        lvglWidget._yScroll2 +
                                        (event.shiftKey ? deltaX : deltaY);

                                    runInAction(() => {
                                        lvglWidget._xScroll =
                                            lvglWidget._xScroll2 = xScroll;
                                        lvglWidget._yScroll =
                                            lvglWidget._yScroll2 = yScroll;
                                    });

                                    break;
                                }
                            }
                            object = getParent(object);
                        }
                    }
                }
            } else if (event.ctrlKey) {
                this.deltaY += deltaY;
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
                        x -
                        ((x - transform.translate.x) * scale) / transform.scale;
                    let ty =
                        y -
                        ((y - transform.translate.y) * scale) / transform.scale;

                    transform.scale = scale;
                    transform.translate = { x: tx, y: ty };

                    runInAction(() => {
                        this.props.flowContext.viewState.transform = transform;
                    });

                    this.mouseHandler?.onTransformChanged(
                        this.props.flowContext
                    );
                }
            } else {
                transform.translate = {
                    x:
                        transform.translate.x -
                        (event.shiftKey ? deltaY : deltaX),
                    y:
                        transform.translate.y -
                        (event.shiftKey ? deltaX : deltaY)
                };

                runInAction(() => {
                    this.props.flowContext.viewState.transform = transform;
                });

                this.mouseHandler?.onTransformChanged(this.props.flowContext);
            }

            event.preventDefault();
            event.stopPropagation();
        };

        onDraggableWheel(event: WheelEvent) {
            this.onWheel(event);
        }

        onContextMenu = (event: React.MouseEvent) => {
            event.preventDefault();
        };

        createMouseHandler(event: MouseEvent) {
            const flowContext = this.props.flowContext;

            if (!event.altKey) {
                if (
                    closestByClass(
                        event.target,
                        "EezStudio_FlowEditorSelection_ResizeHandle"
                    )
                ) {
                    const cursor = (event.target as HTMLElement).style.cursor;
                    if (
                        cursor === "nw-resize" ||
                        cursor === "n-resize" ||
                        cursor === "ne-resize" ||
                        cursor === "w-resize" ||
                        cursor === "e-resize" ||
                        cursor === "sw-resize" ||
                        cursor === "s-resize" ||
                        cursor === "se-resize"
                    ) {
                        return new ResizeMouseHandler(cursor);
                    }
                    return undefined;
                }

                let el: HTMLElement = closestByClass(
                    event.target,
                    WidgetTimelinePathEditorHandler.CLASS_NAME
                );
                if (el) {
                    return new WidgetTimelinePathEditorHandler(
                        el.getAttribute(
                            WidgetTimelinePathEditorHandler.DATA_ATTR_NAME
                        )!
                    );
                }

                let isMoveable = isSelectionMoveable(flowContext);

                if (
                    closestByClass(
                        event.target,
                        "EezStudio_FlowEditorSelection"
                    ) &&
                    !event.shiftKey &&
                    !event.ctrlKey
                ) {
                    return isMoveable ? new DragMouseHandler() : undefined;
                } else {
                    let point =
                        flowContext.viewState.transform.pointerEventToPagePoint(
                            event
                        );
                    const result = flowContext.document.objectFromPoint(point);
                    if (result) {
                        const object = flowContext.document.findObjectById(
                            result.id
                        );
                        if (object) {
                            if (result.connectionOutput) {
                                if (event.shiftKey) {
                                    return new MoveOutputConnectionLinesMouseHandler(
                                        object,
                                        result.connectionOutput
                                    );
                                } else {
                                    return new NewConnectionLineFromOutputMouseHandler(
                                        object,
                                        result.connectionOutput
                                    );
                                }
                            } else if (result.connectionInput) {
                                if (event.shiftKey) {
                                    return new MoveInputConnectionLinesMouseHandler(
                                        object,
                                        result.connectionInput
                                    );
                                } else {
                                    return new NewConnectionLineFromInputMouseHandler(
                                        object,
                                        result.connectionInput
                                    );
                                }
                            } else {
                                if (!event.ctrlKey && !event.shiftKey) {
                                    flowContext.viewState.deselectAllObjects();
                                }
                                if (
                                    flowContext.viewState.isObjectSelected(
                                        object
                                    )
                                ) {
                                    flowContext.viewState.deselectObject(
                                        object
                                    );
                                } else {
                                    flowContext.viewState.selectObject(object);
                                }
                                event.preventDefault();

                                isMoveable = isSelectionMoveable(flowContext);

                                return isMoveable
                                    ? new DragMouseHandler()
                                    : undefined;
                            }
                        }
                    }
                }
            }

            return new RubberBandSelectionMouseHandler();
        }

        onDragStart(event: PointerEvent) {
            this.props.flowContext.projectStore.editorsStore.selectEditorTabForObject(
                this.props.flowContext.flow
            );

            this.buttonsAtDown = event.buttons;

            if (this.mouseHandler) {
                this.mouseHandler.up(this.props.flowContext, true);
                this.mouseHandler = undefined;
            }

            if (event.buttons && event.buttons !== 1) {
                const flowContext = this.props.flowContext;
                if (
                    event.altKey &&
                    flowContext.projectStore.projectTypeTraits.isLVGL
                ) {
                    let point =
                        flowContext.viewState.transform.pointerEventToPagePoint(
                            event
                        );
                    const object = flowContext.document.objectFromPoint(point);
                    if (object) {
                        const objectAdapter =
                            flowContext.document.findObjectById(object.id);
                        if (objectAdapter) {
                            let object = objectAdapter.object;
                            while (true) {
                                if (
                                    object instanceof
                                    ProjectEditor.LVGLWidgetClass
                                ) {
                                    const lvglWidget = object;
                                    if (
                                        lvglWidget.widgetFlags.indexOf(
                                            "SCROLLABLE"
                                        ) != -1 &&
                                        lvglWidget.children.length > 0
                                    ) {
                                        this.mouseHandler =
                                            new LVGLPanMouseHandler(lvglWidget);
                                        break;
                                    }
                                }
                                object = getParent(object);
                            }
                        }
                    }
                }

                if (!this.mouseHandler) {
                    this.mouseHandler = new PanMouseHandler();
                }
            } else {
                if (event.altKey) {
                    if (!this.mouseHandler) {
                        this.mouseHandler = new PanMouseHandler();
                    }
                } else {
                    this.mouseHandler = this.createMouseHandler(event);
                }
            }

            if (this.mouseHandler) {
                this.mouseHandler.lastPointerEvent = {
                    clientX: event.clientX,
                    clientY: event.clientY,
                    movementX: event.movementX ?? 0,
                    movementY: event.movementY ?? 0,
                    ctrlKey: event.ctrlKey,
                    shiftKey: event.shiftKey,
                    timeStamp: event.timeStamp
                };

                this.mouseHandler.down(this.props.flowContext, event);
            }
        }

        onDragMove = (event: PointerEvent) => {
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
                    shiftKey: event.shiftKey,
                    timeStamp: event.timeStamp
                };

                this.mouseHandler.move(this.props.flowContext, event);
            }
        };

        onDragEnd(event: PointerEvent, cancel: boolean) {
            let preventContextMenu = false;

            if (this.mouseHandler) {
                this.mouseHandler.up(this.props.flowContext, cancel);

                if (this.mouseHandler instanceof PanMouseHandler) {
                    if (pointDistance(this.mouseHandler.totalMovement) > 10) {
                        preventContextMenu = true;
                    }
                } else if (this.mouseHandler instanceof LVGLPanMouseHandler) {
                    preventContextMenu = true;
                }

                this.mouseHandler = undefined;
            }

            let time = new Date().getTime();

            if (this.buttonsAtDown === 1) {
                let distance = pointDistance(
                    { x: event.clientX, y: event.clientY },
                    {
                        x: this.draggable.xDragStart,
                        y: this.draggable.yDragStart
                    }
                );

                if (distance <= CONF_DOUBLE_CLICK_DISTANCE) {
                    if (this.lastMouseUpTime !== undefined) {
                        let distance = pointDistance(
                            { x: event.clientX, y: event.clientY },
                            this.lastMouseUpPosition
                        );

                        if (
                            time - this.lastMouseUpTime <=
                                CONF_DOUBLE_CLICK_TIME &&
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
                        context.viewState.transform.pointerEventToPagePoint(
                            event
                        );
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
                            context.viewState.selectedObjects,
                            { atPoint: point }
                        );
                        if (menu) {
                            if (this.mouseHandler) {
                                this.mouseHandler.up(
                                    this.props.flowContext,
                                    true
                                );
                                this.mouseHandler = undefined;
                            }

                            menu.popup();
                        }
                    }, 0);
                }
            }
        }

        onPointerMove = action((event: React.PointerEvent<HTMLDivElement>) => {
            if (this.mouseHandler) {
                this.props.flowContext.viewState.hoveredConnectionLines =
                    undefined;
            } else {
                this.props.flowContext.viewState.hoveredConnectionLines =
                    getObjectIdFromPoint(
                        this.props.flowContext.document,
                        this.props.flowContext.viewState,
                        this.props.flowContext.viewState.transform.pointerEventToPagePoint(
                            event
                        )
                    );
            }
        });

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

            if (this.props.dragAndDropActive) {
                style.pointerEvents = "none";
            }

            return (
                <div
                    ref={(ref: any) => (this.div = ref!)}
                    className={classNames({
                        EezStudio_FlowCanvasContainer_DragAndDropActive:
                            this.props.dragAndDropActive
                    })}
                    style={style}
                    onContextMenu={this.onContextMenu}
                    onPointerMove={this.onPointerMove}
                >
                    <div
                        className="eez-canvas"
                        style={{
                            position: "absolute",
                            transform: `translate(${xt}px, ${yt}px) scale(${transform.scale})`
                        }}
                    >
                        {this.props.flowContext.editorOptions &&
                            this.props.flowContext.editorOptions.center && (
                                <CenterLines
                                    flowContext={this.props.flowContext}
                                />
                            )}
                        {this.props.children}
                    </div>
                    {!isLVGLCreateInProgress(this.props.flowContext.flow) && (
                        <Selection
                            context={this.props.flowContext}
                            mouseHandler={this.mouseHandler}
                        />
                    )}

                    {this.mouseHandler &&
                        this.mouseHandler.render &&
                        this.mouseHandler.render(this.props.flowContext)}

                    <DragSnapLinesOverlay
                        dragSnapLines={this.props.dragSnapLines}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const FlowEditor = observer(
    class FlowEditor
        extends React.Component<{
            tabState: FlowTabState;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        divRef = React.createRef<HTMLDivElement>();

        currentWidgetContainer?: TreeObjectAdapter;

        options: IEditorOptions;

        dragSnapLines = new DragSnapLines();

        constructor(props: { tabState: FlowTabState }) {
            super(props);

            makeObservable(this, {
                options: observable,
                flowContext: computed,
                selectedObject: computed,
                selectedObjects: computed,
                onDragOver: action.bound,
                onDrop: action.bound,
                onDragLeave: action.bound
            });
        }

        get flowContext() {
            const flowContext = new EditorFlowContext();

            flowContext.set(this.props.tabState, this.options);

            return flowContext;
        }

        componentDidMount() {
            this.divRef.current?.addEventListener(
                "ensure-selection-visible",
                this.ensureSelectionVisible
            );

            this.context.navigationStore.mountPanel(this);
        }

        componentDidCatch(error: any, info: any) {
            console.error(error, info);
        }

        componentWillUnmount() {
            this.divRef.current?.removeEventListener(
                "ensure-selection-visible",
                this.ensureSelectionVisible
            );

            this.context.navigationStore.unmountPanel(this);
        }

        ensureSelectionVisible = () => {
            if (this.flowContext.viewState.selectedObjects.length > 0) {
                const selectedObjectRects =
                    this.flowContext.viewState.selectedObjects.map(
                        selectedObject =>
                            getObjectBoundingRect(
                                this.flowContext.viewState,
                                selectedObject
                            )
                    );

                let selectionBoundingRectBuilder = new BoundingRectBuilder();
                for (let i = 0; i < selectedObjectRects.length; i++) {
                    selectionBoundingRectBuilder.addRect(
                        selectedObjectRects[i]
                    );
                }
                const selectionBoundingRect =
                    selectionBoundingRectBuilder.getRect();

                let pageRect =
                    this.flowContext.viewState.transform.clientToPageRect(
                        this.flowContext.viewState.transform.clientRect
                    );

                if (!rectContains(pageRect, selectionBoundingRect)) {
                    // const selectionEl = this.divRef.current?.querySelector(
                    //     ".EezStudio_FlowEditorSelection"
                    // ) as HTMLDivElement;
                    // const canvasEl = this.divRef.current?.querySelector(
                    //     ".eez-canvas"
                    // ) as HTMLCanvasElement;

                    // canvasEl.style.transition = "transform 0.2s";
                    // selectionEl.style.display = "none";

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

                    // setTimeout(() => {
                    //     canvasEl.style.transition = "";
                    //     selectionEl.style.display = "block";
                    // }, 200);
                }

                this.props.tabState.onEnsureSelectionVisibleIsDone();
            }
        };

        // interface IPanel implementation
        get selectedObject() {
            return this.props.tabState.widgetContainer.selectedObjects[0];
        }
        get selectedObjects() {
            return this.props.tabState.widgetContainer.selectedObjects;
        }
        canCut() {
            return this.props.tabState.widgetContainer.canCut();
        }
        cutSelection() {
            this.props.tabState.widgetContainer.cutSelection();
        }
        canCopy() {
            return this.props.tabState.widgetContainer.canCopy();
        }
        copySelection() {
            this.props.tabState.widgetContainer.copySelection();
        }
        canPaste() {
            return this.props.tabState.widgetContainer.canPaste();
        }
        pasteSelection() {
            this.flowContext.document.pasteSelection();
        }
        canDelete() {
            return this.props.tabState.widgetContainer.canDelete();
        }
        deleteSelection() {
            this.props.tabState.widgetContainer.deleteSelection();
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        getDragComponent(event: React.DragEvent) {
            if (
                DragAndDropManager.dragObject &&
                isObjectInstanceOf(
                    DragAndDropManager.dragObject,
                    ProjectEditor.ComponentClass.classInfo
                ) &&
                event.dataTransfer.effectAllowed === "copy"
            ) {
                return DragAndDropManager.dragObject as Component;
            }
            return undefined;
        }

        dragTimeoutId: any;
        dragClientX: number;
        dragClientY: number;

        onDragOver(event: React.DragEvent) {
            const dragComponent = this.getDragComponent(event);
            if (dragComponent) {
                event.preventDefault();
                event.stopPropagation();

                if (
                    this.props.tabState.flow instanceof
                        ProjectEditor.ActionClass &&
                    dragComponent instanceof ProjectEditor.WidgetClass
                ) {
                    // prevent widget drop onto Action flow
                    event.dataTransfer.dropEffect = "none";
                    return;
                }

                event.dataTransfer.dropEffect = "copy";

                const flow = this.props.tabState.widgetContainer.object as Flow;
                const component = DragAndDropManager.dragObject as Component;

                let debounce;

                if (!this.flowContext.dragComponent) {
                    this.flowContext.dragComponent = component;
                    setParent(this.flowContext.dragComponent, flow.components);

                    this.flowContext.viewState.selectObjects([]);

                    this.dragSnapLines.start(this.flowContext);

                    debounce = false;
                } else {
                    debounce = true;
                }

                this.dragSnapLines.snapLines!.enabled = !event.shiftKey;

                this.dragClientX = event.nativeEvent.clientX;
                this.dragClientY = event.nativeEvent.clientY;

                const DEBOUNCE_TIMEOUT = 16;
                if (debounce) {
                    if (this.dragTimeoutId) {
                        return;
                    }
                    this.dragTimeoutId = setTimeout(
                        this.setDragPosition,
                        DEBOUNCE_TIMEOUT
                    );
                } else {
                    this.setDragPosition();
                }
            }
        }

        setDragPosition = action(() => {
            this.dragTimeoutId = undefined;

            const component = this.flowContext.dragComponent;
            if (!component) {
                return;
            }

            const flow = this.props.tabState.widgetContainer.object as Flow;

            const transform = this.flowContext.viewState.transform;
            const position = transform.clientToPagePoint({
                x: this.dragClientX - (component.width * transform.scale) / 2,
                y: this.dragClientY - (component.height * transform.scale) / 2
            });

            let left = position.x;
            let top = position.y;

            if (this.dragSnapLines.snapLines) {
                ({ left, top } = this.dragSnapLines.snapLines.dragSnap(
                    left,
                    top,
                    component.width,
                    component.height
                ));
            }

            if (component instanceof ProjectEditor.WidgetClass) {
                component.left = Math.round(left - flow.pageRect.left);
                component.top = Math.round(top - flow.pageRect.top);
            } else {
                component.left = Math.round(left);
                component.top = Math.round(top);
            }
        });

        onDrop(event: React.DragEvent) {
            event.stopPropagation();
            event.preventDefault();

            if (this.flowContext.dragComponent) {
                const flow = this.props.tabState.widgetContainer.object as Flow;

                let object = this.context.addObject(
                    flow.components,
                    this.flowContext.dragComponent
                );

                this.flowContext.dragComponent = undefined;
                this.dragSnapLines.clear();

                setTimeout(() => {
                    const objectAdapter =
                        this.flowContext.document.findObjectById(getId(object));
                    if (objectAdapter) {
                        const viewState = this.flowContext.viewState;
                        viewState.selectObjects([objectAdapter]);
                        this.divRef.current!.focus();
                    }
                }, 0);
            }
        }

        onDragLeave(event: React.DragEvent) {
            if (this.flowContext.dragComponent) {
                this.flowContext.dragComponent.left = 0;
                this.flowContext.dragComponent.top = 0;
                this.flowContext.dragComponent = undefined;

                // deselect dragComponent
                this.flowContext.viewState.deselectAllObjects();

                this.dragSnapLines.clear();
            }
        }

        onKeyDown = (event: React.KeyboardEvent) => {
            if (
                closestBySelector(
                    event.target,
                    ".eez-flow-editor-capture-pointers"
                )
            ) {
                return;
            }

            if (event.altKey) {
            } else if (event.shiftKey) {
                if (event.keyCode == 36) {
                    // home
                    this.flowContext.viewState.moveSelection("home-y");
                } else if (event.keyCode == 35) {
                    // end
                    this.flowContext.viewState.moveSelection("end-y");
                }
            } else if (event.ctrlKey) {
                if (event.keyCode == "X".charCodeAt(0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.cutSelection();
                } else if (event.keyCode == "C".charCodeAt(0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.copySelection();
                } else if (event.keyCode == "V".charCodeAt(0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.context.paste();
                }
            } else if (event.keyCode == 46) {
                // delete
                this.props.tabState.widgetContainer.deleteSelection();
            } else if (event.keyCode == 27) {
                // esc
                this.flowContext.viewState.deselectAllObjects();
            } else if (event.keyCode == 37) {
                // left
                this.flowContext.viewState.moveSelection("left");
            } else if (event.keyCode == 38) {
                // up
                this.flowContext.viewState.moveSelection("up");
            } else if (event.keyCode == 39) {
                // right
                this.flowContext.viewState.moveSelection("right");
            } else if (event.keyCode == 40) {
                // down
                this.flowContext.viewState.moveSelection("down");
            } else if (event.keyCode == 36) {
                // home
                this.flowContext.viewState.moveSelection("home-x");
            } else if (event.keyCode == 35) {
                // end
                this.flowContext.viewState.moveSelection("end-x");
            }
        };

        static getDerivedStateFromError(error: any) {
            return { hasError: true };
        }

        render() {
            const flow = this.props.tabState.widgetContainer.object as Flow;

            return (
                <div
                    className={classNames(
                        "EezStudio_FlowCanvasContainer EezStudio_FlowEditorCanvasContainer"
                    )}
                    ref={this.divRef}
                    id={this.flowContext.viewState.containerId}
                    onFocus={this.onFocus}
                    tabIndex={0}
                    onDragOver={this.onDragOver}
                    onDrop={this.onDrop}
                    onDragLeave={this.onDragLeave}
                    onKeyDown={this.onKeyDown}
                >
                    <Canvas
                        flowContext={this.flowContext}
                        dragAndDropActive={!!DragAndDropManager.dragObject}
                        dragSnapLines={this.dragSnapLines}
                    >
                        {this.flowContext.document && (
                            <>
                                {
                                    // render widget components
                                    <div
                                        style={{
                                            position: "absolute"
                                        }}
                                    >
                                        {flow.renderWidgetComponents(
                                            this.flowContext
                                        )}
                                    </div>
                                }

                                {
                                    // render connection lines
                                    !this.props.tabState.frontFace &&
                                        !isLVGLCreateInProgress(
                                            this.flowContext.flow
                                        ) && (
                                            <AllConnectionLines
                                                flowContext={this.flowContext}
                                            />
                                        )
                                }

                                {
                                    // render action components
                                    !isLVGLCreateInProgress(
                                        this.flowContext.flow
                                    ) && (
                                        <div
                                            style={{
                                                position: "absolute"
                                            }}
                                        >
                                            {flow.renderActionComponents(
                                                this.flowContext
                                            )}
                                        </div>
                                    )
                                }

                                <TimelinePathEditor
                                    flowContext={this.flowContext}
                                />

                                <DragComponent
                                    flow={flow}
                                    flowContext={this.flowContext}
                                />
                            </>
                        )}
                    </Canvas>

                    {/* <ConnectionLineParams /> */}
                </div>
            );
        }
    }
);
