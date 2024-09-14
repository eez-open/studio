import React from "react";
import {
    action,
    computed,
    observable,
    runInAction,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import {
    Point,
    pointDistance,
    Rect,
    rectContains,
    rectExpand
} from "eez-studio-shared/geometry";

import { Draggable } from "eez-studio-ui/draggable";

import { IPanel, isLVGLCreateInProgress } from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";

import type { Flow } from "project-editor/flow/flow";
import type { FlowTabState } from "project-editor/flow/flow-tab-state";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { RuntimeFlowContext } from "project-editor/flow/runtime-viewer/context";

import { Svg } from "project-editor/flow/editor/render";
import {
    ConnectionLineDebugValues,
    ConnectionLines
} from "project-editor/flow/connection-line/ConnectionLineComponent";
import { getObjectBoundingRect } from "project-editor/flow/editor/bounding-rects";
import {
    IMouseHandler,
    PanMouseHandler
} from "project-editor/flow/editor/mouse-handler";

import { Selection } from "project-editor/flow/runtime-viewer/selection";
import classNames from "classnames";
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

const AllConnectionLineDebugValues = observer(
    ({ flowContext }: { flowContext: IFlowContext }) => {
        return (
            <Svg flowContext={flowContext}>
                <ConnectionLineDebugValues
                    connectionLines={
                        flowContext.document.nonSelectedConnectionLines
                    }
                    context={flowContext}
                    selected={false}
                />
                <ConnectionLineDebugValues
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

export const Canvas = observer(
    class Canvas extends React.Component<{
        children?: React.ReactNode;
        flowContext: IFlowContext;
        pageRect?: Rect;
    }> {
        div: HTMLDivElement;
        updateClientRectRequestAnimationFrameId: any;
        setOverflowTimeout: any;
        deltaY = 0;

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
            runInAction(() => {
                this._mouseHandler = value;
            });
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
                    if (
                        this.props.flowContext.projectStore.projectTypeTraits
                            .isDashboard &&
                        this.props.flowContext.projectStore.runtime &&
                        !this.props.flowContext.projectStore.runtime
                            .isDebuggerActive
                    ) {
                        // set overflow to hidden and back to auto after timeout
                        if (this.setOverflowTimeout) {
                            clearTimeout(this.setOverflowTimeout);
                            this.setOverflowTimeout = undefined;
                        }
                        this.div.style.overflow = "hidden";
                        this.setOverflowTimeout = setTimeout(() => {
                            this.setOverflowTimeout = undefined;
                            this.div.style.overflow = "auto";
                        }, 100);
                    }

                    runInAction(() => {
                        transform.clientRect = clientRect;
                    });
                }
            }

            this.updateClientRectRequestAnimationFrameId =
                requestAnimationFrame(this.updateClientRect);
        };

        componentDidMount() {
            if (
                this.props.flowContext.projectStore.runtime &&
                this.props.flowContext.projectStore.runtime.isDebuggerActive
            ) {
                this.draggable.attach(this.div);
            }

            this.div.addEventListener("wheel", this.onWheel, {
                passive: false
            });

            this.updateClientRect();
        }

        componentWillUnmount() {
            this.draggable.attach(null);

            this.div.removeEventListener("wheel", this.onWheel);

            cancelAnimationFrame(this.updateClientRectRequestAnimationFrameId);

            if (this.setOverflowTimeout) {
                clearTimeout(this.setOverflowTimeout);
                this.setOverflowTimeout = undefined;
            }
        }

        onWheel = (event: WheelEvent) => {
            if (event.buttons === 4 || this.props.flowContext.frontFace) {
                // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
                return;
            }

            const transform =
                this.props.flowContext.viewState.transform.clone();

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
        };

        onContextMenu = (event: React.MouseEvent) => {
            event.preventDefault();
        };

        createMouseHandler(event: MouseEvent) {
            const flowContext = this.props.flowContext;

            if (!event.altKey) {
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

        onDragStart(event: PointerEvent) {
            this.props.flowContext.projectStore.editorsStore.selectEditorTabForObject(
                this.props.flowContext.document.flow.object
            );

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
                    shiftKey: event.shiftKey
                };

                this.mouseHandler.move(this.props.flowContext, event);
            }
        };

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

            const runtime = this.props.flowContext.projectStore.runtime!;
            const runMode = runtime && !runtime.isDebuggerActive;

            const transform = this.props.flowContext.viewState.transform;

            let xt: number;
            let yt: number;
            let scale: number;
            if (
                runMode &&
                this.props.flowContext.projectStore.projectTypeTraits
                    .isDashboard &&
                this.props.flowContext.document.flow.object instanceof
                    ProjectEditor.PageClass &&
                this.props.flowContext.document.flow.object.scaleToFit
            ) {
                xt = 0;
                yt = 0;
                scale = 1;
            } else if (
                runMode &&
                this.props.flowContext.projectStore.projectTypeTraits
                    .isFirmware &&
                this.props.flowContext.projectStore.projectTypeTraits
                    .hasFlowSupport &&
                this.props.flowContext.projectStore.runtime instanceof
                    ProjectEditor.WasmRuntimeClass
            ) {
                xt = Math.round(
                    (transform.clientRect.width -
                        this.props.flowContext.projectStore.runtime
                            .displayWidth) /
                        2
                );

                yt = Math.round(
                    (transform.clientRect.height -
                        this.props.flowContext.projectStore.runtime
                            .displayHeight) /
                        2
                );
                if (yt < 0) {
                    yt = 0;
                }

                scale = 1;
            } else {
                xt = Math.round(
                    transform.translate.x + transform.clientRect.width / 2
                );

                yt = Math.round(
                    transform.translate.y + transform.clientRect.height / 2
                );
                if (yt < 0 && runMode) {
                    yt = 0;
                }

                scale = transform.scale;
            }

            if (
                transform.clientRect.width <= 1 ||
                transform.clientRect.height <= 1
            ) {
                style.visibility = "hidden";
            }

            const lvglCreateInProgress =
                this.props.flowContext.flowState &&
                this.props.flowContext.flowState.flow instanceof
                    ProjectEditor.PageClass &&
                isLVGLCreateInProgress(this.props.flowContext.flowState.flow);

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
                            transform: `translate(${xt}px, ${yt}px) scale(${scale})`
                        }}
                    >
                        {this.props.children}
                    </div>
                    {!runMode &&
                        (runtime.isPaused || runtime.isStopped) &&
                        !lvglCreateInProgress && (
                            <Selection
                                context={this.props.flowContext}
                                mouseHandler={undefined}
                            />
                        )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const FlowViewer = observer(
    class FlowViewer
        extends React.Component<{
            tabState: FlowTabState;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        divRef = React.createRef<HTMLDivElement>();

        constructor(props: { tabState: FlowTabState }) {
            super(props);

            makeObservable(this, {
                flowContext: computed,
                selectedObject: computed,
                selectedObjects: computed
            });
        }

        get flowContext() {
            const flowContext = new RuntimeFlowContext();

            flowContext.set(this.props.tabState);

            return flowContext;
        }

        componentDidMount() {
            this.divRef.current?.addEventListener(
                "ensure-selection-visible",
                this.ensureSelectionVisible
            );

            if (this.context.navigationStore) {
                this.context.navigationStore.mountPanel(this);
            }
        }

        componentDidCatch(error: any, info: any) {
            console.error(error, info);
        }

        componentWillUnmount() {
            this.divRef.current?.removeEventListener(
                "ensure-selection-visible",
                this.ensureSelectionVisible
            );

            setTimeout(() => {
                if (this.context.navigationStore) {
                    this.context.navigationStore.unmountPanel(this);
                }
            });
        }

        ensureSelectionVisible = () => {
            if (this.flowContext.viewState.selectedObjects.length > 0) {
                const selectionBoundingRect = rectExpand(
                    getObjectBoundingRect(
                        this.flowContext.viewState,
                        this.flowContext.viewState.targetComponent ||
                            this.flowContext.viewState.sourceComponent ||
                            this.flowContext.viewState.selectedObjects[0]
                    ),
                    20 / this.flowContext.viewState.transform.scale
                );

                let pageRect =
                    this.flowContext.viewState.transform.clientToPageRect(
                        this.flowContext.viewState.transform.clientRect
                    );

                if (!rectContains(pageRect, selectionBoundingRect)) {
                    const selectionEl = this.divRef.current?.querySelector(
                        ".EezStudio_FlowRuntimeSelection"
                    ) as HTMLDivElement;
                    if (!selectionEl) {
                        return;
                    }
                    const canvasEl = this.divRef.current?.querySelector(
                        ".eez-canvas"
                    ) as HTMLCanvasElement;
                    if (!canvasEl) {
                        return;
                    }

                    // canvasEl.style.transition = "transform 0.2s";
                    // selectionEl.style.display = "none";

                    let dx = 0;
                    let dy = 0;

                    if (pageRect.left > selectionBoundingRect.left) {
                        dx = selectionBoundingRect.left - pageRect.left;
                    } else if (
                        pageRect.left + pageRect.width <
                        selectionBoundingRect.left + selectionBoundingRect.width
                    ) {
                        dx =
                            selectionBoundingRect.left +
                            selectionBoundingRect.width -
                            (pageRect.left + pageRect.width);
                    }

                    if (pageRect.top > selectionBoundingRect.top) {
                        dy = selectionBoundingRect.top - pageRect.top;
                    } else if (
                        pageRect.top + pageRect.height <
                        selectionBoundingRect.top + selectionBoundingRect.height
                    ) {
                        dy =
                            selectionBoundingRect.top +
                            selectionBoundingRect.height -
                            (pageRect.top + pageRect.height);
                    }

                    this.flowContext.viewState.transform.translate = {
                        x:
                            this.flowContext.viewState.transform.translate.x -
                            dx * this.flowContext.viewState.transform.scale,
                        y:
                            this.flowContext.viewState.transform.translate.y -
                            dy * this.flowContext.viewState.transform.scale
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
        onFocus = () => {
            this.context.navigationStore?.setSelectedPanel(this);
        };

        getDragComponent(event: React.DragEvent) {
            return undefined;
        }

        onDoubleClick = () => {
            this.flowContext.viewState.resetTransform();
        };

        static getDerivedStateFromError(error: any) {
            return { hasError: true };
        }

        render() {
            const flow = this.props.tabState.widgetContainer.object as Flow;

            const runMode =
                this.flowContext.projectStore.runtime &&
                !this.flowContext.projectStore.runtime.isDebuggerActive;

            const renderParts =
                this.flowContext.flowState ||
                this.flowContext.flow instanceof ProjectEditor.ActionClass ||
                this.flowContext.projectStore.projectTypeTraits.isLVGL;

            const lvglCreateInProgress = isLVGLCreateInProgress(
                this.flowContext.flow
            );

            const drawConnectionLines =
                !this.props.tabState.frontFace && !lvglCreateInProgress;

            return (
                <div
                    className={classNames(
                        "EezStudio_FlowCanvasContainer EezStudio_FlowViewerCanvasContainer",
                        {
                            runMode
                        }
                    )}
                    ref={this.divRef}
                    id={this.flowContext.viewState.containerId}
                    onFocus={this.onFocus}
                    tabIndex={0}
                    onDoubleClick={runMode ? undefined : this.onDoubleClick}
                >
                    <Canvas flowContext={this.flowContext}>
                        {this.flowContext.document?.flow.object === flow && (
                            <>
                                {
                                    // render widget components
                                    <div
                                        style={{
                                            position: "absolute"
                                        }}
                                    >
                                        {renderParts &&
                                            flow.renderWidgetComponents(
                                                this.flowContext
                                            )}
                                    </div>
                                }

                                {
                                    // render connection lines
                                    renderParts &&
                                        !this.props.tabState.frontFace && (
                                            <AllConnectionLines
                                                flowContext={this.flowContext}
                                            />
                                        )
                                }

                                {
                                    // render action components
                                    <div
                                        style={{
                                            position: "absolute"
                                        }}
                                    >
                                        {renderParts &&
                                            !this.props.tabState.frontFace &&
                                            flow.renderActionComponents(
                                                this.flowContext
                                            )}
                                    </div>
                                }

                                {
                                    // render connection line debug values
                                    renderParts && drawConnectionLines && (
                                        <AllConnectionLineDebugValues
                                            flowContext={this.flowContext}
                                        />
                                    )
                                }
                            </>
                        )}
                    </Canvas>
                </div>
            );
        }
    }
);
