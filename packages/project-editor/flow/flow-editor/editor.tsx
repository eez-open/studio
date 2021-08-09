import React from "react";
import { observable, computed, action, toJS, runInAction } from "mobx";
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
import { closestByClass, closestBySelector } from "eez-studio-shared/dom";

import type {
    IDocument,
    IViewStatePersistantState,
    IEditorOptions,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import { ITransform } from "project-editor/flow/flow-editor/transform";
import { EditorFlowContext } from "project-editor/flow/flow-editor/context";

import {
    getObjectBoundingRect,
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/flow-editor/bounding-rects";
import styled from "eez-studio-ui/styled-components";

import {
    IEezObject,
    isObjectInstanceOf,
    isAncestor,
    getParent,
    setParent,
    getId
} from "project-editor/core/object";
import { IPanel, getDocumentStore } from "project-editor/core/store";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { DragAndDropManager } from "project-editor/core/dd";

import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import {
    Svg,
    ComponentEnclosure
} from "project-editor/flow/flow-editor/render";
import { ProjectContext } from "project-editor/project/context";
import { ConnectionLines } from "project-editor/flow/flow-editor/ConnectionLineComponent";
import { Draggable } from "eez-studio-ui/draggable";
import {
    IMouseHandler,
    PanMouseHandler,
    ConnectionLineMouseHandler,
    DragMouseHandler,
    isSelectionMoveable,
    ResizeMouseHandler,
    RubberBandSelectionMouseHandler,
    SnapLines
} from "project-editor/flow/flow-editor/mouse-handler";
import { Selection } from "project-editor/flow/flow-editor/selection";
import { setupDragScroll } from "project-editor/flow/flow-editor/drag-scroll";

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable snapLines: SnapLines | undefined;
    flowContext: IFlowContext | undefined;
    dragComponent: Component | undefined;

    start(flowContext: EditorFlowContext) {
        this.snapLines = new SnapLines();
        this.flowContext = flowContext;
        this.dragComponent = flowContext.dragComponent;

        this.snapLines.find(flowContext, () => true);
    }

    clear() {
        this.snapLines = undefined;
        this.flowContext = undefined;
        this.dragComponent = undefined;
    }
}

const dragSnapLines = new DragSnapLines();

@observer
class DragSnapLinesOverlay extends React.Component {
    render() {
        if (!dragSnapLines.snapLines) {
            return null;
        }

        const flow = dragSnapLines.flowContext!.document.flow.object as Flow;
        const dragComponent = dragSnapLines.dragComponent!;

        return (
            <div style={{ left: 0, top: 0, pointerEvents: "none" }}>
                {dragSnapLines.snapLines.render(dragSnapLines.flowContext!, {
                    left: flow.pageRect.left + dragComponent.left,
                    top: flow.pageRect.top + dragComponent.top,
                    width: dragComponent.rect.width,
                    height: dragComponent.rect.height
                })}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const DragComponent = observer(
    ({ flow, flowContext }: { flow: Flow; flowContext: EditorFlowContext }) => {
        return flowContext.dragComponent ? (
            <ComponentEnclosure
                component={flowContext.dragComponent}
                left={flow.pageRect.left + flowContext.dragComponent.left}
                top={flow.pageRect.top + flowContext.dragComponent.top}
                flowContext={flowContext}
            />
        ) : null;
    }
);

////////////////////////////////////////////////////////////////////////////////

class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private flowContext: EditorFlowContext
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

    objectFromPoint(point: Point):
        | {
              id: string;
              connectionInput?: string;
              connectionOutput?: string;
          }
        | undefined {
        return getObjectIdFromPoint(this, this.flowContext.viewState, point);
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
        const ids = getObjectIdsInsideRect(this.flowContext.viewState, rect);

        const editorObjectsGroupedByParent = new Map<
            IEezObject,
            ITreeObjectAdapter[]
        >();
        let maxLengthGroup: ITreeObjectAdapter[] | undefined;

        ids.forEach(id => {
            const editorObject = this.findObjectById(id);
            if (
                editorObject &&
                !(editorObject.object instanceof ConnectionLine)
            ) {
                const parent = getParent(editorObject.object);

                let group = editorObjectsGroupedByParent.get(parent);

                if (!group) {
                    group = [editorObject];
                    editorObjectsGroupedByParent.set(parent, group);
                } else {
                    group.push(editorObject);
                }

                if (!maxLengthGroup || group.length > maxLengthGroup.length) {
                    maxLengthGroup = group;
                }
            }
        });

        return maxLengthGroup ? maxLengthGroup : [];
    }

    createContextMenu(objects: ITreeObjectAdapter[]) {
        return this.flow.createSelectionContextMenu({
            duplicateSelection: this.duplicateSelection,
            pasteSelection: this.pasteSelection
        });
    }

    duplicateSelection = () => {
        this.DocumentStore.UndoManager.setCombineCommands(true);

        this.flow.duplicateSelection();

        this.flowContext.viewState.selectedObjects.forEach(objectAdapter => {
            if (objectAdapter.object instanceof Component) {
                this.flowContext.document.DocumentStore.updateObject(
                    objectAdapter.object,
                    {
                        left: objectAdapter.object.left + 20,
                        top: objectAdapter.object.top + 20
                    }
                );
            }
        });

        this.DocumentStore.UndoManager.setCombineCommands(false);
    };

    pasteSelection = () => {
        this.DocumentStore.UndoManager.setCombineCommands(true);

        this.flow.pasteSelection();

        const rectBounding = getSelectedObjectsBoundingRect(
            this.flowContext.viewState
        );
        const rectPage = this.flowContext.viewState.transform.clientToPageRect(
            this.flowContext.viewState.transform.clientRect
        );

        const left = rectPage.left + (rectPage.width - rectBounding.width) / 2;
        const top = rectPage.top + (rectPage.height - rectBounding.height) / 2;

        this.flowContext.viewState.selectedObjects.forEach(objectAdapter => {
            if (objectAdapter.object instanceof Component) {
                this.flowContext.document.DocumentStore.updateObject(
                    objectAdapter.object,
                    {
                        left:
                            left +
                            (objectAdapter.object.left - rectBounding.left),
                        top: top + (objectAdapter.object.top - rectBounding.top)
                    }
                );
            }
        });

        this.DocumentStore.UndoManager.setCombineCommands(false);
    };

    @computed get DocumentStore() {
        return getDocumentStore(this.flow.object);
    }

    onDragStart(): void {
        this.DocumentStore.UndoManager.setCombineCommands(true);
    }

    onDragEnd(): void {
        this.DocumentStore.UndoManager.setCombineCommands(false);
    }

    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean {
        const flow = this.flow.object as Flow;

        const sourceObject = this.DocumentStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.DocumentStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        return !!flow.connectionLines.find(
            connectionLine =>
                connectionLine.source == sourceObject.wireID &&
                connectionLine.output == connectionOutput &&
                connectionLine.target == targetObject.wireID &&
                connectionLine.input == connectionInput
        );
    }

    connect(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ) {
        const flow = this.flow.object as Flow;

        const sourceObject = this.DocumentStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.DocumentStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        this.DocumentStore.addObject(flow.connectionLines, {
            source: sourceObject.wireID,
            output: connectionOutput,
            target: targetObject.wireID,
            input: connectionInput
        });
    }
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

function CenterLines({ flowContext }: { flowContext: IFlowContext }) {
    const transform = flowContext.viewState.transform;

    const CENTER_LINES_COLOR = "#eee";
    const CENTER_LINES_WIDTH = 1 / transform.scale;
    const centerLineStyle = {
        fill: "transparent",
        stroke: CENTER_LINES_COLOR,
        strokeWidth: CENTER_LINES_WIDTH
    };

    const center = flowContext.editorOptions.center!;

    const pageRect = transform.clientToPageRect(transform.clientRect);

    return (
        <Svg flowContext={flowContext}>
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

////////////////////////////////////////////////////////////////////////////////

@observer
export class Canvas extends React.Component<{
    flowContext: IFlowContext;
    pageRect?: Rect;
    dragAndDropActive: boolean;
    transitionIsActive?: boolean;
}> {
    div: HTMLDivElement;
    resizeObserver: ResizeObserver;
    clientRectChangeDetectionAnimationFrameHandle: any;
    deltaY = 0;

    dragScrollDispose: (() => void) | undefined;

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
                this.mouseHandler instanceof ConnectionLineMouseHandler ||
                this.mouseHandler instanceof DragMouseHandler ||
                this.mouseHandler instanceof ResizeMouseHandler)
        ) {
            this.dragScrollDispose = setupDragScroll(
                this.div,
                this.mouseHandler,
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

    resizeObserverCallback = () => {
        this.clientRectChangeDetectionAnimationFrameHandle = undefined;

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
    }

    @bind
    onWheel(event: WheelEvent) {
        if (event.buttons === 4) {
            // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
            return;
        }

        if (this.mouseHandler instanceof PanMouseHandler) {
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

                this.mouseHandler?.onTransformChanged(this.props.flowContext);
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

            this.mouseHandler?.onTransformChanged(this.props.flowContext);
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

            let isMoveable = isSelectionMoveable(flowContext);

            if (closestByClass(event.target, "EezStudio_FlowEditorSelection")) {
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
                        if (!flowContext.viewState.isObjectSelected(object)) {
                            if (!event.ctrlKey && !event.shiftKey) {
                                flowContext.viewState.deselectAllObjects();
                            }
                            flowContext.viewState.selectObject(object);
                            event.preventDefault();
                        }

                        isMoveable = isSelectionMoveable(flowContext);

                        if (result.connectionOutput) {
                            return new ConnectionLineMouseHandler(
                                object,
                                result.connectionOutput
                            );
                        } else {
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
                        transform: `translate(${xt}px, ${yt}px) scale(${transform.scale})`,
                        pointerEvents: this.props.dragAndDropActive
                            ? "none"
                            : "auto"
                    }}
                >
                    {this.props.flowContext.editorOptions &&
                        this.props.flowContext.editorOptions.center && (
                            <CenterLines flowContext={this.props.flowContext} />
                        )}
                    {this.props.children}
                </div>
                <Selection
                    context={this.props.flowContext}
                    mouseHandler={this.mouseHandler}
                />

                {this.mouseHandler &&
                    this.mouseHandler.render &&
                    this.mouseHandler.render(this.props.flowContext)}

                <DragSnapLinesOverlay />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface FlowEditorCanvasContainerParams {
    projectCss: string;
}

const FlowEditorCanvasContainer = styled.div<FlowEditorCanvasContainerParams>`
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: white;

    cursor: default;

    & > * {
        user-select: none;
    }

    & > div {
        position: absolute;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    /* make sure focus outline is fully visible */
    left: 2px;
    top: 2px;
    width: calc(100% - 4px);
    height: calc(100% - 4px);
    & > div {
        left: 1px;
        top: 1px;
        width: calc(100% - 2px);
        height: calc(100% - 2px);
    }

    .EezStudio_FlowEditorSelection_SelectedObject {
        pointer-events: none;
        border: 1px solid ${props => props.theme.selectionBackgroundColor};
    }

    .EezStudio_FlowEditorSelection_BoundingRect {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
        box-shadow: 2px 2px 4px rgba(128, 128, 128, 0.4);
    }

    .EezStudio_FlowEditorSelection_ResizeHandle {
        position: absolute;
        background-color: white;
        border: 1px solid ${props => props.theme.selectionBackgroundColor};
    }

    .EezStudio_FlowEditorSelection_SelectedObjectsParent {
        pointer-events: none;
        border: 2px dotted magenta;
    }

    [data-connection-output-id]:hover {
        color: ${props => props.theme.selectionColor}!important;
        background-color: ${props =>
            props.theme.selectionBackgroundColor}!important;
        cursor: crosshair;
    }

    .title [data-connection-output-id]:hover {
        color: ${props => props.theme.lightSelectionColor}!important;
        background-color: ${props =>
            props.theme.lightSelectionBackgroundColor}!important;
    }

    .connection-line-path {
        marker-start: url(#lineStart);
        marker-end: url(#lineEnd);

        stroke: ${props => props.theme.connectionLineColor};

        &.seq {
            stroke: ${props => props.theme.seqConnectionLineColor};
            marker-start: url(#seqLineStart);
            marker-end: url(#seqLineEnd);
        }

        &.selected {
            stroke: ${props => props.theme.selectedConnectionLineColor};
            marker-start: url(#selectedLineStart);
            marker-end: url(#selectedLineEnd);
        }
    }

    .connection-line:hover .connection-line-path {
        stroke: ${props => props.theme.selectedConnectionLineColor} !important;
        marker-start: url(#selectedLineStart) !important;
        marker-end: url(#selectedLineEnd) !important;
        fill: none;
    }

    ${props => props.projectCss}
`;

@observer
export class FlowEditor
    extends React.Component<{
        widgetContainer: ITreeObjectAdapter;
        viewStatePersistantState: IViewStatePersistantState | undefined;
        onSavePersistantState: (viewState: IViewStatePersistantState) => void;
        transitionIsActive?: boolean;
        frontFace: boolean;
    }>
    implements IPanel
{
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    divRef = React.createRef<HTMLDivElement>();

    currentWidgetContainer?: ITreeObjectAdapter;

    @observable options: IEditorOptions;

    _flowContext: EditorFlowContext | undefined = undefined;

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

        const flowContext = new EditorFlowContext();

        const flow = this.props.widgetContainer.object as Flow;

        flowContext.set(
            new FlowDocument(this.props.widgetContainer, flowContext),
            viewStatePersistantState,
            this.props.onSavePersistantState,
            this.props.frontFace,
            flow,
            this.context.RuntimeStore.getRunningFlow(flow),
            this.options,
            this.filterSnapLines
        );

        this._flowContext = flowContext;

        return flowContext;
    }

    @bind
    filterSnapLines(node: ITreeObjectAdapter) {
        const object = node.object;

        const selectedObjects = this.flowContext.viewState.selectedObjects;

        for (let i = 0; i < selectedObjects.length; ++i) {
            const selectedObject = selectedObjects[i].object;

            if (object === selectedObject) {
                return false;
            }

            if (
                getParent(selectedObject) === getParent(object) ||
                isAncestor(selectedObject, object)
            ) {
                return true;
            }
        }

        return false;
    }

    componentDidMount() {
        this.divRef.current?.addEventListener(
            "ensure-selection-visible",
            this.ensureSelectionVisible
        );
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
                    ".EezStudio_FlowEditorSelection"
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

    cutSelection() {
        this.props.widgetContainer.cutSelection();
    }

    copySelection() {
        this.props.widgetContainer.copySelection();
    }

    pasteSelection() {
        this.flowContext.document.pasteSelection();
    }

    deleteSelection() {
        this.props.widgetContainer.deleteSelection();
    }

    @bind
    focusHander() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    getDragComponent(event: React.DragEvent) {
        if (
            DragAndDropManager.dragObject &&
            isObjectInstanceOf(
                DragAndDropManager.dragObject,
                Component.classInfo
            ) &&
            event.dataTransfer.effectAllowed === "copy"
        ) {
            return DragAndDropManager.dragObject as Component;
        }
        return undefined;
    }

    @action.bound
    onDragOver(event: React.DragEvent) {
        const dragComponent = this.getDragComponent(event);
        if (dragComponent) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";

            const flow = this.props.widgetContainer.object as Flow;

            const component = DragAndDropManager.dragObject as Component;

            if (!this.flowContext.dragComponent) {
                this.flowContext.dragComponent = component;
                setParent(this.flowContext.dragComponent, flow.components);

                this.flowContext.viewState.selectObjects([]);

                dragSnapLines.start(this.flowContext);
            }

            dragSnapLines.snapLines!.enabled = !event.shiftKey;

            const transform = this.flowContext.viewState.transform;

            const p = transform.clientToPagePoint({
                x:
                    event.nativeEvent.clientX -
                    (component.width * transform.scale) / 2,
                y:
                    event.nativeEvent.clientY -
                    (component.height * transform.scale) / 2
            });

            const { left, top } = dragSnapLines.snapLines!.dragSnap(
                p.x,
                p.y,
                component.width,
                component.height
            );

            component.left = Math.round(left - flow.pageRect.left);
            component.top = Math.round(top - flow.pageRect.top);
        }
    }

    @action.bound
    onDrop(event: React.DragEvent) {
        event.stopPropagation();
        event.preventDefault();

        if (this.flowContext.dragComponent) {
            const flow = this.props.widgetContainer.object as Flow;

            const object = this.context.addObject(
                flow.components,
                toJS(this.flowContext.dragComponent)
            );

            this.flowContext.dragComponent = undefined;
            dragSnapLines.clear();

            setTimeout(() => {
                const objectAdapter = this.flowContext.document.findObjectById(
                    getId(object)
                );
                if (objectAdapter) {
                    const viewState = this.flowContext.viewState;
                    viewState.selectObjects([objectAdapter]);
                    this.divRef.current!.focus();
                }
            }, 0);
        }
    }

    @action.bound
    onDragLeave(event: React.DragEvent) {
        if (this.flowContext.dragComponent) {
            this.flowContext.dragComponent.left = 0;
            this.flowContext.dragComponent.top = 0;
            this.flowContext.dragComponent = undefined;

            // deselect dragComponent
            this.flowContext.viewState.deselectAllObjects();

            dragSnapLines.clear();
        }
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (
            closestBySelector(event.target, ".eez-flow-editor-capture-pointers")
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
                this.cutSelection();
            } else if (event.keyCode == "C".charCodeAt(0)) {
                this.copySelection();
            } else if (event.keyCode == "V".charCodeAt(0)) {
                this.pasteSelection();
            }
        } else if (event.keyCode == 46) {
            // delete
            this.props.widgetContainer.deleteSelection();
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
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    render() {
        const flow = this.props.widgetContainer.object as Flow;

        return (
            <FlowEditorCanvasContainer
                ref={this.divRef}
                id={this.flowContext.viewState.containerId}
                tabIndex={0}
                onFocus={this.focusHander}
                onDragOver={this.onDragOver}
                onDrop={this.onDrop}
                onDragLeave={this.onDragLeave}
                onKeyDown={this.onKeyDown}
                projectCss={this.context.project.settings.general.css}
            >
                <Canvas
                    flowContext={this.flowContext}
                    dragAndDropActive={!!DragAndDropManager.dragObject}
                    transitionIsActive={this.props.transitionIsActive}
                >
                    {this.flowContext.document && (
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
                            <DragComponent
                                flow={flow}
                                flowContext={this.flowContext}
                            />
                        </>
                    )}
                </Canvas>
            </FlowEditorCanvasContainer>
        );
    }
}
