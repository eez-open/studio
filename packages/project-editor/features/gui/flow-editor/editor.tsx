import React from "react";
import { observable, computed, action, toJS, autorun, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import {
    Point,
    pointDistance,
    pointInRect,
    Rect
} from "eez-studio-shared/geometry";
import { closestByClass } from "eez-studio-shared/dom";

import type {
    IDocument,
    IViewStatePersistantState,
    IEditorOptions,
    IFlowContext
} from "project-editor/features/gui/flow-interfaces";
import { ITransform } from "project-editor/features/gui/flow-editor/transform";
import { DesignerContext } from "project-editor/features/gui/flow-editor/context";

import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect
} from "project-editor/features/gui/flow-editor/bounding-rects";
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

import { ConnectionLine, Flow } from "project-editor/features/gui/flow";
import { Component } from "project-editor/features/gui/component";
import {
    Svg,
    ComponentEnclosure
} from "project-editor/features/gui/flow-editor/render";
import { ProjectContext } from "project-editor/project/context";
import { guid } from "eez-studio-shared/guid";
import { ConnectionLines } from "project-editor/features/gui/flow-editor/ConnectionLineComponent";
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
} from "project-editor/features/gui/flow-editor/mouse-handler";
import { Selection } from "project-editor/features/gui/flow-editor/selection";
import { setupDragScroll } from "project-editor/features/gui/flow-editor/drag-scroll";

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable snapLines: SnapLines | undefined;
    designerContext: DesignerContext | undefined;
    dragComponent: Component | undefined;

    start(context: DesignerContext) {
        this.snapLines = new SnapLines();
        this.designerContext = context;
        this.dragComponent = context.dragComponent;

        this.snapLines.find(context, () => true);
    }

    clear() {
        this.snapLines = undefined;
        this.designerContext = undefined;
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

        const flow = dragSnapLines.designerContext!.document.flow
            .object as Flow;
        const dragComponent = dragSnapLines.dragComponent!;

        return (
            <div style={{ left: 0, top: 0, pointerEvents: "none" }}>
                {dragSnapLines.snapLines.render(
                    dragSnapLines.designerContext!,
                    {
                        left: flow.pageRect.left + dragComponent.left,
                        top: flow.pageRect.top + dragComponent.top,
                        width:
                            dragComponent._geometry?.width ??
                            dragComponent.width,
                        height:
                            dragComponent._geometry?.height ??
                            dragComponent.height
                    }
                )}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const DragComponent = observer(
    ({
        flow,
        designerContext
    }: {
        flow: Flow;
        designerContext: DesignerContext;
    }) => {
        return designerContext.dragComponent ? (
            <ComponentEnclosure
                component={designerContext.dragComponent}
                left={flow.pageRect.left + designerContext.dragComponent.left}
                top={flow.pageRect.top + designerContext.dragComponent.top}
                dataContext={designerContext.document.DocumentStore.dataContext}
                designerContext={designerContext}
            />
        ) : null;
    }
);

////////////////////////////////////////////////////////////////////////////////

class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private designerContext: DesignerContext
    ) {}

    @computed get connectionLines(): ITreeObjectAdapter[] {
        return (this.flow.children as ITreeObjectAdapter[]).filter(
            editorObject => editorObject.object instanceof ConnectionLine
        );
    }

    @computed get selectedConnectionLines() {
        return this.connectionLines.filter(connectionLine =>
            this.designerContext.viewState.isObjectIdSelected(connectionLine.id)
        );
    }

    @computed get nonSelectedConnectionLines() {
        return this.connectionLines.filter(
            connectionLine =>
                !this.designerContext.viewState.isObjectIdSelected(
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

    objectFromPoint(
        point: Point
    ):
        | {
              id: string;
              connectionInput?: string;
              connectionOutput?: string;
          }
        | undefined {
        return getObjectIdFromPoint(
            this,
            this.designerContext.viewState,
            point
        );
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
        const ids = getObjectIdsInsideRect(
            this.designerContext.viewState,
            rect
        );

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
        return this.flow.createSelectionContextMenu();
    }

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

        return !!(
            sourceObject.wireID &&
            targetObject.wireID &&
            flow.connectionLines.find(
                connectionLine =>
                    connectionLine.source == sourceObject.wireID &&
                    connectionLine.output == connectionOutput &&
                    connectionLine.target == targetObject.wireID &&
                    connectionLine.input == connectionInput
            )
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

        if (!sourceObject.wireID) {
            this.DocumentStore.updateObject(sourceObject, {
                wireID: guid()
            });
        }

        if (!targetObject.wireID) {
            this.DocumentStore.updateObject(targetObject, {
                wireID: guid()
            });
        }

        this.DocumentStore.addObject(flow.connectionLines, {
            source: sourceObject.wireID,
            output: connectionOutput,
            target: targetObject.wireID,
            input: connectionInput
        });
    }
}

const AllConnectionLines = observer(
    ({ designerContext }: { designerContext: DesignerContext }) => {
        return (
            <Svg designerContext={designerContext}>
                <ConnectionLines
                    connectionLines={
                        designerContext.document.nonSelectedConnectionLines
                    }
                    context={designerContext}
                    selected={false}
                />
                <ConnectionLines
                    connectionLines={
                        designerContext.document.selectedConnectionLines
                    }
                    context={designerContext}
                    selected={true}
                />
            </Svg>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

function CenterLines({ designerContext }: { designerContext: IFlowContext }) {
    const transform = designerContext.viewState.transform;

    const CENTER_LINES_COLOR = "#ddd";
    const CENTER_LINES_WIDTH = 1 / transform.scale;
    const centerLineStyle = {
        fill: "transparent",
        stroke: CENTER_LINES_COLOR,
        strokeWidth: CENTER_LINES_WIDTH
    };

    const center = designerContext.editorOptions.center!;

    const pageRect = transform.clientToPageRect(transform.clientRect);

    return (
        <Svg designerContext={designerContext}>
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

@observer
export class Canvas extends React.Component<{
    designerContext: IFlowContext;
    style?: React.CSSProperties;
    pageRect?: Rect;
    dragAndDropActive: boolean;
    transitionIsActive?: boolean;
}> {
    div: HTMLDivElement;
    clientRectChangeDetectionAnimationFrameHandle: any;
    deltaY = 0;

    dragScrollDispose: (() => void) | undefined;

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
                    const newTransform = this.props.designerContext.viewState.transform.clone();
                    newTransform.translateBy(point);

                    runInAction(() => {
                        this.props.designerContext.viewState.transform = newTransform;
                    });

                    this.mouseHandler?.onTransformChanged(
                        this.props.designerContext
                    );
                }
            );
        }
    }

    buttonsAtDown: number;
    lastMouseUpPosition: Point;
    lastMouseUpTime: number | undefined;

    draggable = new Draggable(this);

    @bind
    clientRectChangeDetection() {
        this.clientRectChangeDetectionAnimationFrameHandle = undefined;

        if ($(this.div).is(":visible") && !this.props.transitionIsActive) {
            const transform = this.props.designerContext.viewState.transform;

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

        this.clientRectChangeDetectionAnimationFrameHandle = requestAnimationFrame(
            this.clientRectChangeDetection
        );
    }

    componentDidMount() {
        this.draggable.attach(this.div);
        this.clientRectChangeDetection();

        this.div.addEventListener("wheel", this.onWheel, {
            passive: false
        });
    }

    componentWillUnmount() {
        this.draggable.attach(null);

        if (this.clientRectChangeDetectionAnimationFrameHandle) {
            cancelAnimationFrame(
                this.clientRectChangeDetectionAnimationFrameHandle
            );
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

        if (this.mouseHandler instanceof PanMouseHandler) {
            return;
        }

        const transform = this.props.designerContext.viewState.transform.clone();

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
                    this.props.designerContext.viewState.transform = transform;
                });

                this.mouseHandler?.onTransformChanged(
                    this.props.designerContext
                );
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
                this.props.designerContext.viewState.transform = transform;
            });

            this.mouseHandler?.onTransformChanged(this.props.designerContext);
        }

        event.preventDefault();
        event.stopPropagation();
    }

    @bind
    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();
    }

    createMouseHandler(event: MouseEvent) {
        const context = this.props.designerContext;

        if (!event.altKey) {
            if (
                closestByClass(
                    event.target,
                    "EezStudio_DesignerSelection_ResizeHandle"
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

            const isMoveable = isSelectionMoveable(context);

            if (closestByClass(event.target, "EezStudio_DesignerSelection")) {
                return isMoveable ? new DragMouseHandler() : undefined;
            } else {
                let point = context.viewState.transform.pointerEventToPagePoint(
                    event
                );
                const result = context.document.objectFromPoint(point);
                if (result) {
                    const object = context.document.findObjectById(result.id);
                    if (object) {
                        if (!context.viewState.isObjectSelected(object)) {
                            if (!event.ctrlKey && !event.shiftKey) {
                                context.viewState.deselectAllObjects();
                            }
                            context.viewState.selectObject(object);
                        }

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
            this.mouseHandler.up(this.props.designerContext);
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

            this.mouseHandler.down(this.props.designerContext, event);
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

            this.mouseHandler.move(this.props.designerContext, event);
        }
    }

    @action.bound
    onDragEnd(event: PointerEvent) {
        let preventContextMenu = false;

        if (this.mouseHandler) {
            this.mouseHandler.up(this.props.designerContext);

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
                            this.props.designerContext.viewState.selectedObjects
                                .length === 1
                        ) {
                            const object = this.props.designerContext.viewState
                                .selectedObjects[0];
                            object.open();
                        } else if (
                            this.props.designerContext.viewState.selectedObjects
                                .length === 0
                        ) {
                            this.props.designerContext.viewState.resetTransform();
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
                const context = this.props.designerContext;
                const point = context.viewState.transform.pointerEventToPagePoint(
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
                    if (!result) {
                        return;
                    }

                    const object = context.document.findObjectById(result.id);
                    if (!object) {
                        return;
                    }

                    context.viewState.selectObject(object);
                }

                setTimeout(() => {
                    const menu = context.document.createContextMenu(
                        context.viewState.selectedObjects
                    );
                    if (menu) {
                        if (this.mouseHandler) {
                            this.mouseHandler.up(this.props.designerContext);
                            this.mouseHandler = undefined;
                        }

                        menu.popup({});
                    }
                }, 0);
            }
        }
    }

    render() {
        let style: React.CSSProperties = {
            position: "absolute",
            overflow: "hidden",
            width: "100%",
            height: "100%"
        };
        if (this.mouseHandler) {
            style.cursor = this.mouseHandler.cursor;
        }
        if (this.props.style) {
            Object.assign(style, this.props.style);
        }

        this.draggable.cursor = style.cursor;

        const transform = this.props.designerContext.viewState.transform;

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
            <CanvasDiv
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
                    {this.props.designerContext.editorOptions &&
                        this.props.designerContext.editorOptions.center && (
                            <CenterLines
                                designerContext={this.props.designerContext}
                            />
                        )}
                    {this.props.children}
                </div>
                <Selection
                    context={this.props.designerContext}
                    mouseHandler={this.mouseHandler}
                />

                {this.mouseHandler &&
                    this.mouseHandler.render &&
                    this.mouseHandler.render(this.props.designerContext)}

                <DragSnapLinesOverlay />
            </CanvasDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const FlowEditorCanvasContainer = styled.div`
    flex-grow: 1;
    display: flex;
    position: relative;

    .EezStudio_DesignerSelection_SelectedObject {
        border: 1px solid #333;
    }

    .EezStudio_DesignerSelection_BoundingRect {
        border: 2px solid black;
        background-color: rgba(255, 255, 255, 0.3);
    }

    .EezStudio_DesignerSelection_ResizeHandle {
        background-color: rgba(0, 0, 0, 0.6);
    }

    .eez-connection-output:hover {
        color: ${props => props.theme.selectionColor};
        background-color: ${props => props.theme.selectionBackgroundColor};
    }

    .connection-line:hover > path:nth-child(3) {
        stroke: ${props => props.theme.selectedConnectionLineColor} !important;
        marker-start: url(#selectedLineStart) !important;
        marker-end: url(#selectedLineEnd) !important;
        fill: none;
    }
`;

const FlowEditorCanvas = styled(Canvas)`
    position: absolute;
    width: 100%;
    height: 100%;
`;

interface FlowEditorProps {
    widgetContainer: ITreeObjectAdapter;
    onFocus?: () => void;
    transitionIsActive?: boolean;
    frontFace?: boolean;
}

@observer
export class FlowEditor
    extends React.Component<FlowEditorProps>
    implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    designerContext: DesignerContext = new DesignerContext(
        "eez-flow-editor-" + guid()
    );
    currentWidgetContainer?: ITreeObjectAdapter;

    @observable flowDocument: FlowDocument;

    @observable options: IEditorOptions;

    constructor(props: FlowEditorProps) {
        super(props);

        this.updateFlowDocument();
    }

    @action
    updateFlowDocument() {
        if (this.props.widgetContainer != this.currentWidgetContainer) {
            this.currentWidgetContainer = this.props.widgetContainer;

            this.flowDocument = new FlowDocument(
                this.props.widgetContainer,
                this.designerContext
            );

            this.options = {
                center: {
                    x: 0,
                    y: 0
                }
            };
        }
    }

    componentDidMount() {
        autorun(() => {
            this.designerContext.set(
                this.flowDocument,
                this.viewStatePersistantState,
                this.onSavePersistantState,
                this.options,
                this.filterSnapLines,
                this.props.frontFace
            );
        });
    }

    componentDidUpdate() {
        this.updateFlowDocument();
    }

    @bind
    filterSnapLines(node: ITreeObjectAdapter) {
        const object = node.object;

        const selectedObjects = this.designerContext.viewState.selectedObjects;

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
        this.props.widgetContainer.pasteSelection();
    }

    deleteSelection() {
        this.props.widgetContainer.deleteSelection();
    }

    @bind
    focusHander() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    savedViewState: IViewStatePersistantState | undefined;

    @computed
    get viewStatePersistantState(): IViewStatePersistantState {
        const uiState = this.context.UIStateStore.getObjectUIState(
            this.props.widgetContainer.object,
            this.props.frontFace ? "front" : "back"
        );

        let transform: ITransform | undefined;
        if (uiState && uiState.flowEditorCanvasViewState) {
            transform = uiState.flowEditorCanvasViewState.transform;
        }

        let viewState: IViewStatePersistantState = {
            transform
        };

        if (!this.savedViewState) {
            // selection changed in Tree => change selection in Editor
            return viewState;
        }

        // return existing viewState from editor
        viewState = this.savedViewState;
        this.savedViewState = undefined;
        return viewState;
    }

    @bind
    onSavePersistantState(viewState: IViewStatePersistantState) {
        if (!this.designerContext.dragComponent) {
            this.savedViewState = viewState;

            const uiState = this.context.UIStateStore.getObjectUIState(
                this.props.widgetContainer.object,
                this.props.frontFace ? "front" : "back"
            );
            if (
                !uiState ||
                !uiState.flowEditorCanvasViewState ||
                !_isEqual(
                    uiState.flowEditorCanvasViewState.transform,
                    viewState.transform
                )
            ) {
                this.context.UIStateStore.updateObjectUIState(
                    this.props.widgetContainer.object,
                    this.props.frontFace ? "front" : "back",
                    {
                        flowEditorCanvasViewState: {
                            transform: viewState.transform
                        }
                    }
                );
            }
        }
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

            const flow = this.props.widgetContainer.object as Flow;

            const component = DragAndDropManager.dragObject as Component;

            if (!this.designerContext.dragComponent) {
                this.designerContext.dragComponent = component;
                setParent(this.designerContext.dragComponent, flow.components);

                this.designerContext.viewState.selectObjects([]);

                dragSnapLines.start(this.designerContext);
            }

            dragSnapLines.snapLines!.enabled = !event.shiftKey;

            const transform = this.designerContext.viewState.transform;

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
        if (this.designerContext.dragComponent) {
            const flow = this.props.widgetContainer.object as Flow;

            const object = this.context.addObject(
                flow.components,
                toJS(this.designerContext.dragComponent)
            );

            this.designerContext.dragComponent = undefined;
            dragSnapLines.clear();

            setTimeout(() => {
                const objectAdapter = this.designerContext.document.findObjectById(
                    getId(object)
                );
                if (objectAdapter) {
                    const viewState = this.designerContext.viewState;
                    viewState.selectObjects([objectAdapter]);
                }
            }, 0);
        }
    }

    @action.bound
    onDragLeave(event: React.DragEvent) {
        if (this.designerContext.dragComponent) {
            this.designerContext.dragComponent.left = 0;
            this.designerContext.dragComponent.top = 0;
            this.designerContext.dragComponent = undefined;

            // deselect dragComponent
            this.designerContext.viewState.deselectAllObjects();

            dragSnapLines.clear();
        }
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.altKey) {
        } else if (event.shiftKey) {
            if (event.keyCode == 36) {
                // home
                this.designerContext.viewState.moveSelection("home-y");
            } else if (event.keyCode == 35) {
                // end
                this.designerContext.viewState.moveSelection("end-y");
            }
        } else if (event.ctrlKey) {
            if (event.keyCode == "X".charCodeAt(0)) {
                this.props.widgetContainer.cutSelection();
            } else if (event.keyCode == "C".charCodeAt(0)) {
                this.props.widgetContainer.copySelection();
            } else if (event.keyCode == "V".charCodeAt(0)) {
                this.props.widgetContainer.pasteSelection();
            }
        } else if (event.keyCode == 46) {
            // delete
            this.props.widgetContainer.deleteSelection();
        } else if (event.keyCode == 27) {
            // esc
            this.designerContext.viewState.deselectAllObjects();
        } else if (event.keyCode == 37) {
            // left
            this.designerContext.viewState.moveSelection("left");
        } else if (event.keyCode == 38) {
            // up
            this.designerContext.viewState.moveSelection("up");
        } else if (event.keyCode == 39) {
            // right
            this.designerContext.viewState.moveSelection("right");
        } else if (event.keyCode == 40) {
            // down
            this.designerContext.viewState.moveSelection("down");
        } else if (event.keyCode == 36) {
            // home
            this.designerContext.viewState.moveSelection("home-x");
        } else if (event.keyCode == 35) {
            // end
            this.designerContext.viewState.moveSelection("end-x");
        }
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    componentWillUnmount() {
        this.designerContext.destroy();
    }

    get flow() {
        return this.flowDocument.flow.object as Flow;
    }

    render() {
        return (
            <FlowEditorCanvasContainer
                id={this.designerContext.containerId}
                tabIndex={0}
                onFocus={this.props.onFocus || this.focusHander}
                onDragOver={this.onDragOver}
                onDrop={this.onDrop}
                onDragLeave={this.onDragLeave}
                onKeyDown={this.onKeyDown}
            >
                <FlowEditorCanvas
                    designerContext={this.designerContext}
                    dragAndDropActive={!!DragAndDropManager.dragObject}
                    transitionIsActive={this.props.transitionIsActive}
                >
                    {this.designerContext.document && (
                        <>
                            {!this.props.frontFace && (
                                <AllConnectionLines
                                    designerContext={this.designerContext}
                                />
                            )}
                            <div
                                style={{
                                    position: "absolute"
                                }}
                            >
                                {(this.designerContext.document.flow
                                    .object as Flow).renderComponents(
                                    this.designerContext
                                )}
                            </div>
                            <DragComponent
                                flow={this.flow}
                                designerContext={this.designerContext}
                            />
                        </>
                    )}
                </FlowEditorCanvas>
            </FlowEditorCanvasContainer>
        );
    }
}
