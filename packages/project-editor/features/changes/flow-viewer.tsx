import React from "react";
import {
    action,
    computed,
    observable,
    runInAction,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Point, pointDistance, Rect } from "eez-studio-shared/geometry";

import { Draggable } from "eez-studio-ui/draggable";

import { IPanel } from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";

import { Flow } from "project-editor/flow/flow";
import { ConnectionLine } from "project-editor/flow/connection-line";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { Svg } from "project-editor/flow/editor/render";
import { ConnectionLineShape } from "project-editor/flow/connection-line/ConnectionLineComponent";
import {
    IMouseHandler,
    PanMouseHandler
} from "project-editor/flow/editor/mouse-handler";

import { ProjectEditor } from "project-editor/project-editor-interface";

import { getProjectStore } from "project-editor/store";
import { getObjectIdFromPoint } from "project-editor/flow/editor/bounding-rects";

import { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import type {
    IDocument,
    IViewState,
    IEditorOptions,
    IResizeHandler,
    IDataContext
} from "project-editor/flow/flow-interfaces";
import { Transform } from "project-editor/flow/editor/transform";

import { Component, Widget } from "project-editor/flow/component";
import { guid } from "eez-studio-shared/guid";
import { ChangedFlowObjects, ChangeOperations } from "./state";

////////////////////////////////////////////////////////////////////////////////

export const DEFAULT_SCALE = 0.75;

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

export const FlowViewer = observer(
    class FlowViewer
        extends React.Component<{
            title: string;
            legend?: boolean;
            flow: Flow;
            transform: Transform;
            changedObjects: ChangedFlowObjects;
            selectedObject: Component | ConnectionLine | undefined;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        divRef = React.createRef<HTMLDivElement>();

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                flowContext: computed
            });
        }

        get flowContext() {
            const flowContext = new FlowContext(
                this.props.flow,
                this.props.transform
            );
            return flowContext;
        }

        componentDidMount() {
            this.context.navigationStore.mountPanel(this);
        }

        componentDidCatch(error: any, info: any) {
            console.error(error, info);
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
        }

        // interface IPanel implementation
        get selectedObject() {
            return undefined;
        }

        get selectedObjects() {
            return [];
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
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
            const flow = this.props.flow;

            return (
                <div
                    className={classNames(
                        "EezStudio_FlowCanvasContainer EezStudio_ChangesFlowViewerCanvasContainer"
                    )}
                    ref={this.divRef}
                    id={this.flowContext.viewState.containerId}
                    onFocus={this.onFocus}
                    tabIndex={0}
                    onDoubleClick={this.onDoubleClick}
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
                                        {flow.renderWidgetComponents(
                                            this.flowContext
                                        )}
                                    </div>
                                }

                                {
                                    // render connection lines
                                    <AllConnectionLines
                                        flowContext={this.flowContext}
                                        changedObjects={
                                            this.props.changedObjects
                                        }
                                        selectedObject={
                                            this.props.selectedObject
                                        }
                                    />
                                }

                                {
                                    // render action components
                                    <div
                                        style={{
                                            position: "absolute"
                                        }}
                                    >
                                        {flow.renderActionComponents(
                                            this.flowContext
                                        )}
                                    </div>
                                }

                                {
                                    //  mark changed objects
                                    <div
                                        style={{
                                            position: "absolute"
                                        }}
                                    >
                                        {this.props.changedObjects.map(
                                            changedObject => {
                                                if (
                                                    changedObject.object instanceof
                                                    ProjectEditor.ComponentClass
                                                ) {
                                                    const component =
                                                        changedObject.object;
                                                    return (
                                                        <div
                                                            key={
                                                                component.objID
                                                            }
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                left:
                                                                    component
                                                                        .absolutePositionPoint
                                                                        .x - 2,
                                                                top:
                                                                    component
                                                                        .absolutePositionPoint
                                                                        .y - 2,
                                                                width:
                                                                    component.width +
                                                                    4,
                                                                height:
                                                                    component.height +
                                                                    4,
                                                                borderRadius:
                                                                    component instanceof
                                                                    Widget
                                                                        ? 0
                                                                        : 6
                                                            }}
                                                            className={classNames(
                                                                "EezStudio_ChangesFlowViewer_ChangedObject",
                                                                changedObject.operation,
                                                                {
                                                                    selected:
                                                                        this
                                                                            .props
                                                                            .selectedObject ==
                                                                        changedObject.object
                                                                }
                                                            )}
                                                        ></div>
                                                    );
                                                }

                                                return null;
                                            }
                                        )}
                                    </div>
                                }
                            </>
                        )}
                    </Canvas>
                    <h6 className="EezStudio_ChangesFlowViewer_Title shadow-sm p-1 m-2 border rounded">
                        {this.props.title}
                    </h6>
                    {this.props.legend === true && (
                        <h6 className="EezStudio_ChangesFlowViewer_Legend shadow-sm p-1 m-2 border rounded">
                            <span className="bullet added"></span>
                            <span>ADDED</span>
                            <span className="bullet removed"></span>
                            <span>REMOVED</span>
                            <span className="bullet updated"></span>
                            <span>UPDATED</span>
                        </h6>
                    )}
                </div>
            );
        }
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
        resizeObserver: ResizeObserver;
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

            this.resizeObserver = new ResizeObserver(
                this.resizeObserverCallback
            );
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

        _setOverflowTimeout: any;
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
            this.draggable.attach(this.div);

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

            if (this._setOverflowTimeout) {
                clearTimeout(this._setOverflowTimeout);
                this._setOverflowTimeout = undefined;
            }
        }

        onWheel = (event: WheelEvent) => {
            if (event.buttons === 4 || this.props.flowContext.frontFace) {
                // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
                return;
            }

            if (event.ctrlKey) {
                this.deltaY += event.deltaY;
                if (Math.abs(this.deltaY) > 10) {
                    const transform =
                        this.props.flowContext.viewState.transform;

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

                    runInAction(() => {
                        this.props.flowContext.viewState.transform.scale =
                            scale;
                        this.props.flowContext.viewState.transform.translate = {
                            x: tx,
                            y: ty
                        };
                    });
                }
            } else {
                runInAction(() => {
                    const transform =
                        this.props.flowContext.viewState.transform;
                    this.props.flowContext.viewState.transform.translate = {
                        x:
                            transform.translate.x -
                            (event.shiftKey ? event.deltaY : event.deltaX),
                        y:
                            transform.translate.y -
                            (event.shiftKey ? event.deltaX : event.deltaY)
                    };
                });
            }

            event.preventDefault();
            event.stopPropagation();
        };

        onDragStart(event: PointerEvent) {
            this.buttonsAtDown = event.buttons;

            if (this.mouseHandler) {
                this.mouseHandler.up(this.props.flowContext, true);
                this.mouseHandler = undefined;
            }

            if (event.buttons && event.buttons !== 1) {
                this.mouseHandler = new PanMouseHandler();
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
            if (this.mouseHandler) {
                this.mouseHandler.up(this.props.flowContext, cancel);

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
                            this.props.flowContext.viewState.resetTransform();
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

            const scale = transform.scale;

            if (
                transform.clientRect.width <= 1 ||
                transform.clientRect.height <= 1
            ) {
                style.visibility = "hidden";
            }

            return (
                <div ref={(ref: any) => (this.div = ref!)} style={style}>
                    <div
                        className="eez-canvas"
                        style={{
                            position: "absolute",
                            transform: `translate(${xt}px, ${yt}px) scale(${scale})`
                        }}
                    >
                        {this.props.children}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const colors = {
    added: "green",
    removed: "red",
    updated: "#999"
};

function getChangeOperationFilter(operation: ChangeOperations) {
    return { color: colors[operation] };
}

const AllConnectionLines = observer(
    ({
        flowContext,
        changedObjects,
        selectedObject
    }: {
        flowContext: IFlowContext;
        changedObjects: ChangedFlowObjects;
        selectedObject: Component | ConnectionLine | undefined;
    }) => {
        return (
            <Svg flowContext={flowContext}>
                {flowContext.document.nonSelectedConnectionLines.map(
                    connectionLineAdapter => {
                        const changedObject = changedObjects.find(
                            changedObject =>
                                changedObject.object ==
                                connectionLineAdapter.object
                        );

                        return (
                            <ConnectionLineShape
                                key={connectionLineAdapter.id}
                                connectionLineAdapter={connectionLineAdapter}
                                context={flowContext}
                                selected={
                                    changedObject
                                        ? changedObject.object == selectedObject
                                        : false
                                }
                                shadow={
                                    changedObject
                                        ? getChangeOperationFilter(
                                              changedObject.operation
                                          )
                                        : undefined
                                }
                            />
                        );
                    }
                )}
            </Svg>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

class FlowContext implements IFlowContext {
    containerId = guid();
    document: IDocument;

    viewState: ViewState = new ViewState(this);
    editorOptions: IEditorOptions = {};
    _dataContext: IDataContext;

    constructor(public flow: Flow, public transform: Transform) {
        this.document = new FlowDocument(
            new FlowTreeObjectAdapter(this.flow),
            this
        );
        this.editorOptions = {};

        makeObservable(this, {
            flowState: computed,
            resetTransform: action
        });
    }

    resetTransform() {
        this.transform.translate = { x: 0, y: 0 };
        this.transform.scale = DEFAULT_SCALE;
    }

    get projectStore() {
        return this.document.projectStore;
    }

    get flowState() {
        return undefined;
    }

    get dataContext() {
        return this._dataContext || this.document.projectStore.dataContext;
    }

    get frontFace() {
        return false;
    }

    overrideDataContext(dataContextOverridesObject: any): IFlowContext {
        if (!dataContextOverridesObject) {
            return this;
        }
        return Object.assign(new FlowContext(this.flow, this.transform), this, {
            _dataContext: this.dataContext.createWithDefaultValueOverrides(
                dataContextOverridesObject
            )
        });
    }

    overrideFlowState(component: Component): IFlowContext {
        return this;
    }
}

////////////////////////////////////////////////////////////////////////////////

class FlowTreeObjectAdapter extends TreeObjectAdapter {
    constructor(private flow: Flow) {
        super(flow);
    }

    get children() {
        return [
            ...this.flow.components.map(child => this.transformer(child)),
            ...this.flow.connectionLines.map(child => this.transformer(child))
        ];
    }
}

////////////////////////////////////////////////////////////////////////////////

class FlowDocument implements IDocument {
    constructor(
        public flow: TreeObjectAdapter,
        private flowContext: FlowContext
    ) {
        makeObservable(this, {
            connectionLines: computed,
            projectStore: computed
        });
    }

    get connectionLines() {
        return (this.flow.children as TreeObjectAdapter[]).filter(
            editorObject =>
                editorObject.object instanceof ProjectEditor.ConnectionLineClass
        );
    }

    get selectedConnectionLines() {
        return [];
    }

    get nonSelectedConnectionLines() {
        return this.connectionLines;
    }

    findObjectById(id: string) {
        return this.flow.getObjectAdapter(id);
    }

    findObjectParent(object: TreeObjectAdapter) {
        return this.flow.getParent(object);
    }

    objectFromPoint(point: Point):
        | {
              id: string;
              connectionInput?: string;
              connectionOutput?: string;
          }
        | undefined {
        return getObjectIdFromPoint(this, this.flowContext.viewState, point);
    }

    getObjectsInsideRect(rect: Rect) {
        return [];
    }

    createContextMenu(objects: TreeObjectAdapter[]) {
        return undefined;
    }

    duplicateSelection() {}

    pasteSelection() {}

    get projectStore() {
        return getProjectStore(this.flow.object);
    }

    onDragStart(): void {}

    onDragEnd(): void {}

    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean {
        return false;
    }

    connect(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ) {}

    connectToNewTarget(
        sourceObjectId: string,
        connectionOutput: string,
        atPoint: Point
    ) {}
    connectToNewSource(
        targetObjectId: string,
        connectionInput: string,
        atPoint: Point
    ) {}
}

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    get transform() {
        return this.flowContext.transform;
    }

    set transform(transform: Transform) {
        this.flowContext.transform = transform;
    }

    dxMouseDrag: number | undefined;
    dyMouseDrag: number | undefined;

    constructor(public flowContext: FlowContext) {
        makeObservable(this, {
            dxMouseDrag: observable,
            dyMouseDrag: observable
        });
    }

    get projectStore() {
        return this.flowContext.projectStore;
    }

    get document() {
        return this.flowContext.document;
    }

    get containerId() {
        return this.flowContext.containerId;
    }

    resetTransform() {
        this.flowContext.resetTransform();
    }

    getResizeHandlers(): IResizeHandler[] | undefined {
        return undefined;
    }

    get selectedObjects() {
        return [];
    }

    get connectionLine() {
        return undefined;
    }

    get sourceComponent() {
        return undefined;
    }

    get targetComponent() {
        return undefined;
    }

    isObjectSelected(object: TreeObjectAdapter): boolean {
        return false;
    }

    isObjectIdSelected(id: string): boolean {
        return false;
    }

    selectObject(object: TreeObjectAdapter) {}

    selectObjects(objects: TreeObjectAdapter[]) {}

    deselectAllObjects(): void {}

    moveSelection(
        where:
            | "left"
            | "up"
            | "right"
            | "down"
            | "home-x"
            | "end-x"
            | "home-y"
            | "end-y"
    ) {}
}
