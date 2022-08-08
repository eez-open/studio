import React from "react";
import {
    action,
    computed,
    observable,
    runInAction,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import { Point, pointDistance, Rect } from "eez-studio-shared/geometry";

import { Draggable } from "eez-studio-ui/draggable";

import { IPanel } from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";

import type { Flow } from "project-editor/flow/flow";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { Svg } from "project-editor/flow/editor/render";
import { ConnectionLines } from "project-editor/flow/editor/ConnectionLineComponent";
import {
    IMouseHandler,
    PanMouseHandler
} from "project-editor/flow/editor/mouse-handler";

import classNames from "classnames";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { getDocumentStore } from "project-editor/store";
import { getObjectIdFromPoint } from "project-editor/flow/editor/bounding-rects";

import {
    ITreeObjectAdapter,
    TreeObjectAdapter,
    TreeObjectAdapterChildren
} from "project-editor/core/objectAdapter";

import type {
    IDocument,
    IViewState,
    IEditorOptions,
    IResizeHandler,
    IDataContext
} from "project-editor/flow/flow-interfaces";
import { Transform } from "project-editor/flow/editor/transform";

import type { Component } from "project-editor/flow/component";
import { guid } from "eez-studio-shared/guid";

////////////////////////////////////////////////////////////////////////////////

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

export const FlowViewer = observer(
    class FlowViewer
        extends React.Component<{
            flow: Flow;
            transform: Transform;
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

        componentDidCatch(error: any, info: any) {
            console.error(error, info);
        }

        // interface IPanel implementation
        get selectedObject() {
            return undefined;
        }

        get selectedObjects() {
            return [];
        }
        cutSelection() {}
        copySelection() {}
        pasteSelection() {}
        deleteSelection() {}
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
                        "EezStudio_FlowCanvasContainer EezStudio_FlowEditorCanvasContainer"
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
                            </>
                        )}
                    </Canvas>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Canvas = observer(
    class Canvas extends React.Component<{
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
                this.mouseHandler.up(this.props.flowContext);
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
            if (this.mouseHandler) {
                this.mouseHandler.up(this.props.flowContext);

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
        this.transform.scale = 0.5;
    }

    get projectEditorStore() {
        return this.document.projectEditorStore;
    }

    get flowState() {
        return undefined;
    }

    get dataContext() {
        return (
            this._dataContext || this.document.projectEditorStore.dataContext
        );
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

    get children(): TreeObjectAdapterChildren {
        return [
            ...this.flow.components.map(child => this.transformer(child)),
            ...this.flow.connectionLines.map(child => this.transformer(child))
        ];
    }
}

////////////////////////////////////////////////////////////////////////////////

class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private flowContext: FlowContext
    ) {
        makeObservable(this, {
            connectionLines: computed,
            projectEditorStore: computed
        });
    }

    get connectionLines(): ITreeObjectAdapter[] {
        return (this.flow.children as ITreeObjectAdapter[]).filter(
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

    findObjectParent(object: ITreeObjectAdapter) {
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

    createContextMenu(objects: ITreeObjectAdapter[]) {
        return undefined;
    }

    duplicateSelection() {}

    pasteSelection() {}

    get projectEditorStore() {
        return getDocumentStore(this.flow.object);
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

    isObjectSelected(object: ITreeObjectAdapter): boolean {
        return false;
    }

    isObjectIdSelected(id: string): boolean {
        return false;
    }

    selectObject(object: ITreeObjectAdapter) {}

    selectObjects(objects: ITreeObjectAdapter[]) {}

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
