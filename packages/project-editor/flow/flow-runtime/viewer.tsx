import React from "react";
import { computed, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import {
    BoundingRectBuilder,
    Point,
    Rect,
    rectContains
} from "eez-studio-shared/geometry";

import type {
    IDocument,
    IViewStatePersistantState,
    IFlowContext,
    IFlowState
} from "project-editor/flow/flow-interfaces";
import { ITransform } from "project-editor/flow/flow-editor/transform";
import { RuntimeFlowContext } from "project-editor/flow/flow-runtime/context";

import { IPanel, getDocumentStore } from "project-editor/core/store";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Svg } from "project-editor/flow/flow-editor/render";
import { ProjectContext } from "project-editor/project/context";
import { ConnectionLines } from "project-editor/flow/flow-editor/ConnectionLineComponent";
import { Selection } from "project-editor/flow/flow-runtime/selection";
import { getObjectBoundingRect } from "project-editor/flow/flow-editor/bounding-rects";
import { Component } from "project-editor/flow/component";
import { attachCssToElement } from "eez-studio-shared/dom";

////////////////////////////////////////////////////////////////////////////////

class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private flowContext: RuntimeFlowContext
    ) {}

    @computed get connectionLines(): ITreeObjectAdapter[] {
        return (this.flow.children as ITreeObjectAdapter[]).filter(
            editorObject => editorObject.object instanceof ConnectionLine
        );
    }

    @computed get selectedConnectionLines() {
        return this.connectionLines.filter(connectionLine =>
            this.flowContext.viewState.isObjectIdSelected(connectionLine.id)
        );
    }

    @computed get nonSelectedConnectionLines() {
        return this.connectionLines.filter(
            connectionLine =>
                !this.flowContext.viewState.isObjectIdSelected(
                    connectionLine.id
                )
        );
    }

    findObjectById(id: string) {
        return this.flow.getObjectAdapter(id);
    }

    findObjectParent(object: ITreeObjectAdapter) {
        return this.flow.getParent(object);
    }

    objectFromPoint(point: Point) {
        return undefined;
    }

    resetTransform(transform: ITransform) {
        const flow = this.flow.object as Flow;
        transform.translate = {
            x: -flow.pageRect.width / 2,
            y: -flow.pageRect.height / 2
        };
        transform.scale = 1;
    }

    getObjectsInsideRect(rect: Rect) {
        return [];
    }

    createContextMenu(objects: ITreeObjectAdapter[]) {
        return undefined;
    }

    duplicateSelection() {}

    pasteSelection() {}

    @computed get DocumentStore() {
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
    transitionIsActive?: boolean;
}> {
    div: HTMLDivElement;
    resizeObserver: ResizeObserver;
    deltaY = 0;

    buttonsAtDown: number;
    lastMouseUpPosition: Point;
    lastMouseUpTime: number | undefined;

    constructor(props: any) {
        super(props);

        this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
    }

    resizeObserverCallback = () => {
        if ($(this.div).is(":visible") && !this.props.transitionIsActive) {
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

        return (
            <div ref={(ref: any) => (this.div = ref!)} style={style}>
                <div
                    className="eez-canvas"
                    style={{
                        position: "absolute",
                        transform: `translate(${xt}px, ${yt}px) scale(${transform.scale})`
                    }}
                >
                    {this.props.children}
                </div>
                <Selection
                    context={this.props.flowContext}
                    mouseHandler={undefined}
                />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class FlowViewer
    extends React.Component<{
        widgetContainer: ITreeObjectAdapter;
        viewStatePersistantState: IViewStatePersistantState | undefined;
        onSavePersistantState: (viewState: IViewStatePersistantState) => void;
        transitionIsActive?: boolean;
        frontFace: boolean;
        flowState: IFlowState | undefined;
    }>
    implements IPanel
{
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    divRef = React.createRef<HTMLDivElement>();

    _flowContext: RuntimeFlowContext | undefined = undefined;

    get flowState() {
        return (
            this.props.flowState ||
            this.context.RuntimeStore.getFlowState(
                this.props.widgetContainer.object as Flow
            )
        );
    }

    @computed
    get flowContext() {
        let clientRect: Rect | undefined = undefined;

        if (this._flowContext) {
            clientRect = this._flowContext.viewState.transform.clientRect;
            this._flowContext.destroy();
        }

        let viewStatePersistantState = this.props.viewStatePersistantState;
        if (clientRect) {
            if (!viewStatePersistantState) {
                viewStatePersistantState = { clientRect };
            } else if (!viewStatePersistantState.clientRect) {
                viewStatePersistantState.clientRect = clientRect;
            }
        }

        const flowContext = new RuntimeFlowContext();

        flowContext.set(
            new FlowDocument(this.props.widgetContainer, flowContext),
            this.props.viewStatePersistantState,
            this.props.onSavePersistantState,
            this.props.frontFace,
            this.flowState
        );

        this._flowContext = flowContext;

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

        if (this.disposeCSS) {
            this.disposeCSS();
        }
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    componentWillUnmount() {
        if (this._flowContext) {
            this._flowContext.destroy();
        }

        this.divRef.current?.removeEventListener(
            "ensure-selection-visible",
            this.ensureSelectionVisible
        );
    }

    ensureSelectionVisible = () => {
        if (this.flowContext.viewState.selectedObjects.length > 0) {
            const selectedObjectRects =
                this.flowContext.viewState.selectedObjects
                    .filter(
                        selectedObject =>
                            selectedObject.object instanceof Component
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
        return this.props.widgetContainer.selectedObjects[0];
    }

    @computed
    get selectedObjects() {
        return this.props.widgetContainer.selectedObjects;
    }

    cutSelection() {}

    copySelection() {}

    pasteSelection() {}

    deleteSelection() {}

    @bind
    focusHander() {
        this.context.NavigationStore.setSelectedPanel(this);
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
        const flow = this.props.widgetContainer.object as Flow;

        this.flowState;

        return (
            <div
                className="EezStudio_FlowViewerCanvasContainer"
                ref={this.divRef}
                id={this.flowContext.viewState.containerId}
                tabIndex={0}
                onFocus={this.focusHander}
                onDoubleClick={this.onDoubleClick}
            >
                <Canvas
                    flowContext={this.flowContext}
                    transitionIsActive={this.props.transitionIsActive}
                >
                    {this.flowContext.document?.flow.object === flow && (
                        <>
                            <div
                                style={{
                                    position: "absolute"
                                }}
                            >
                                {flow.renderComponents(this.flowContext)}
                            </div>
                            {!this.props.frontFace && (
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
