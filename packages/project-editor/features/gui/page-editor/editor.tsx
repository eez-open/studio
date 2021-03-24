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

import type {
    IDocument,
    IViewStatePersistantState,
    IDesignerOptions,
    IDesignerContext,
    IMouseHandler
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { ITransform } from "project-editor/features/gui/page-editor/transform";
import { DesignerContext } from "project-editor/features/gui/page-editor/context";

import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect
} from "project-editor/features/gui/page-editor/bounding-rects";
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

import { ConnectionLine, Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/widget";
import {
    Svg,
    WidgetComponent
} from "project-editor/features/gui/page-editor/render";
import { ProjectContext } from "project-editor/project/context";
import { guid } from "eez-studio-shared/guid";
import { ConnectionLines } from "project-editor/features/gui/page-editor/ConnectionLineComponent";
import { Draggable } from "eez-studio-ui/draggable";
import {
    PanMouseHandler,
    ConnectionLineMouseHandler,
    DragMouseHandler,
    isSelectionMoveable,
    ResizeMouseHandler,
    RubberBandSelectionMouseHandler,
    SnapLines
} from "project-editor/features/gui/page-editor/mouse-handler";
import { Selection } from "project-editor/features/gui/page-editor/selection";
import { closestByClass } from "eez-studio-shared/dom";

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable snapLines: SnapLines | undefined;
    designerContext: DesignerContext | undefined;
    dragWidget: Widget | undefined;

    start(pageEditorContext: DesignerContext) {
        this.snapLines = new SnapLines();
        this.designerContext = pageEditorContext;
        this.dragWidget = pageEditorContext.dragWidget;

        this.snapLines.find(pageEditorContext, () => true);
    }

    clear() {
        this.snapLines = undefined;
        this.designerContext = undefined;
        this.dragWidget = undefined;
    }
}

const dragSnapLines = new DragSnapLines();

@observer
class DragSnapLinesOverlay extends React.Component {
    render() {
        if (!dragSnapLines.snapLines) {
            return null;
        }

        const page = dragSnapLines.designerContext!.document.page
            .object as Page;
        const dragWidget = dragSnapLines.dragWidget!;

        return (
            <div style={{ left: 0, top: 0, pointerEvents: "none" }}>
                {dragSnapLines.snapLines.render(
                    dragSnapLines.designerContext!,
                    {
                        left: page.left + dragWidget.left,
                        top: page.top + dragWidget.top,
                        width: dragWidget._geometry?.width ?? dragWidget.width,
                        height:
                            dragWidget._geometry?.height ?? dragWidget.height
                    }
                )}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const DragWidget = observer(
    ({
        page,
        designerContext
    }: {
        page: Page;
        designerContext: DesignerContext;
    }) => {
        return designerContext.dragWidget ? (
            <WidgetComponent
                widget={designerContext.dragWidget}
                left={page.left + designerContext.dragWidget.left}
                top={page.top + designerContext.dragWidget.top}
                dataContext={designerContext.document.DocumentStore.dataContext}
                designerContext={designerContext}
            />
        ) : null;
    }
);

////////////////////////////////////////////////////////////////////////////////

class PageDocument implements IDocument {
    constructor(
        public page: ITreeObjectAdapter,
        private designerContext: DesignerContext
    ) {}

    @computed get connectionLines(): ITreeObjectAdapter[] {
        return (this.page.children as ITreeObjectAdapter[]).filter(
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
        return this.page.getObjectAdapter(id);
    }

    findObjectParent(object: ITreeObjectAdapter) {
        return this.page.getParent(object);
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
        const page = this.page.object as Page;
        transform.translate = {
            x: -page.width / 2,
            y: -page.height / 2
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
                !(editorObject.object instanceof ConnectionLine) &&
                !(
                    editorObject.object instanceof Page &&
                    editorObject.object.isAction
                )
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
        return this.page.createSelectionContextMenu();
    }

    @computed get DocumentStore() {
        return getDocumentStore(this.page.object);
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
        const page = this.page.object as Page;

        const sourceObject = this.DocumentStore.getObjectFromObjectId(
            sourceObjectId
        ) as Widget;
        const targetObject = this.DocumentStore.getObjectFromObjectId(
            targetObjectId
        ) as Widget;

        return !!(
            sourceObject.wireID &&
            targetObject.wireID &&
            page.connectionLines.find(
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
        const page = this.page.object as Page;

        const sourceObject = this.DocumentStore.getObjectFromObjectId(
            sourceObjectId
        ) as Widget;
        const targetObject = this.DocumentStore.getObjectFromObjectId(
            targetObjectId
        ) as Widget;

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

        this.DocumentStore.addObject(page.connectionLines, {
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

function CenterLines({
    designerContext
}: {
    designerContext: IDesignerContext;
}) {
    const transform = designerContext.viewState.transform;

    const CENTER_LINES_COLOR = "#ddd";
    const CENTER_LINES_WIDTH = 1 / transform.scale;
    const centerLineStyle = {
        fill: "transparent",
        stroke: CENTER_LINES_COLOR,
        strokeWidth: CENTER_LINES_WIDTH
    };
    const PAGE_RECT_LINES_COLOR = "#ddd";
    const PAGE_RECT_LINES_WIDTH = 2 / transform.scale;
    const pageRectLineStyle = {
        fill: "transparent",
        stroke: PAGE_RECT_LINES_COLOR,
        strokeWidth: PAGE_RECT_LINES_WIDTH
    };

    const center = designerContext.options.center!;

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
            <rect
                x={pageRect.left}
                y={pageRect.top}
                width={pageRect.width}
                height={pageRect.height}
                style={pageRectLineStyle}
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
    designerContext: IDesignerContext;
    style?: React.CSSProperties;
    pageRect?: Rect;
    dragAndDropActive: boolean;
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
        if ($(this.div).is(":visible")) {
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
                    {this.props.designerContext.options &&
                        this.props.designerContext.options.center && (
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

const PageEditorCanvasContainer = styled.div`
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

    .connection-line:hover > path:nth-child(3) {
        stroke: ${props => props.theme.selectedConnectionLineColor} !important;
        marker-start: url(#selectedLineStart) !important;
        marker-end: url(#selectedLineEnd) !important;
        fill: none;
    }
`;

const PageEditorCanvas = styled(Canvas)`
    position: absolute;
    width: 100%;
    height: 100%;
`;

interface PageEditorProps {
    widgetContainer: ITreeObjectAdapter;
    onFocus?: () => void;
}

@observer
export class PageEditor
    extends React.Component<PageEditorProps>
    implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    designerContext: DesignerContext = new DesignerContext(
        "eez-page-editor-" + guid()
    );
    currentWidgetContainer?: ITreeObjectAdapter;

    @observable pageDocument: PageDocument;

    @observable options: IDesignerOptions;

    constructor(props: PageEditorProps) {
        super(props);

        this.updatePageDocument();
    }

    @action
    updatePageDocument() {
        if (this.props.widgetContainer != this.currentWidgetContainer) {
            this.currentWidgetContainer = this.props.widgetContainer;

            this.pageDocument = new PageDocument(
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
                this.pageDocument,
                this.viewStatePersistantState,
                this.onSavePersistantState,
                this.options,
                this.filterSnapLines
            );
        });
    }

    componentDidUpdate() {
        this.updatePageDocument();
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
            this.props.widgetContainer.object
        );

        let transform: ITransform | undefined;
        if (uiState && uiState.pageEditorCanvasViewState) {
            transform = uiState.pageEditorCanvasViewState.transform;
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
        if (!this.designerContext.dragWidget) {
            this.savedViewState = viewState;

            const uiState = this.context.UIStateStore.getObjectUIState(
                this.props.widgetContainer.object
            );
            if (
                !uiState ||
                !uiState.pageEditorCanvasViewState ||
                !_isEqual(
                    uiState.pageEditorCanvasViewState.transform,
                    viewState.transform
                )
            ) {
                this.context.UIStateStore.updateObjectUIState(
                    this.props.widgetContainer.object,
                    {
                        pageEditorCanvasViewState: {
                            transform: viewState.transform
                        }
                    }
                );
            }
        }
    }

    getDragWidget(event: React.DragEvent) {
        if (
            DragAndDropManager.dragObject &&
            isObjectInstanceOf(
                DragAndDropManager.dragObject,
                Widget.classInfo
            ) &&
            event.dataTransfer.effectAllowed === "copy"
        ) {
            return DragAndDropManager.dragObject as Widget;
        }
        return undefined;
    }

    @action.bound
    onDragOver(event: React.DragEvent) {
        const widget = this.getDragWidget(event);
        if (widget) {
            event.preventDefault();
            event.stopPropagation();

            const page = this.props.widgetContainer.object as Page;

            const widget = DragAndDropManager.dragObject as Widget;

            if (!this.designerContext.dragWidget) {
                this.designerContext.dragWidget = widget;
                setParent(this.designerContext.dragWidget, page.widgets);

                this.designerContext.viewState.selectObjects([]);

                dragSnapLines.start(this.designerContext);
            }

            dragSnapLines.snapLines!.enabled = !event.shiftKey;

            const transform = this.designerContext.viewState.transform;

            const p = transform.clientToPagePoint({
                x:
                    event.nativeEvent.clientX -
                    (widget.width * transform.scale) / 2,
                y:
                    event.nativeEvent.clientY -
                    (widget.height * transform.scale) / 2
            });

            const { left, top } = dragSnapLines.snapLines!.dragSnap(
                p.x,
                p.y,
                widget.width,
                widget.height
            );

            widget.left = Math.round(left - page.left);
            widget.top = Math.round(top - page.top);
        }
    }

    @action.bound
    onDrop(event: React.DragEvent) {
        if (this.designerContext.dragWidget) {
            const page = this.props.widgetContainer.object as Page;

            const object = this.context.addObject(
                page.widgets,
                toJS(this.designerContext.dragWidget)
            );

            this.designerContext.dragWidget = undefined;
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
        if (this.designerContext.dragWidget) {
            this.designerContext.dragWidget.left = 0;
            this.designerContext.dragWidget.top = 0;
            this.designerContext.dragWidget = undefined;

            // deselect dragWidget
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

    get page() {
        return this.pageDocument.page.object as Page;
    }

    render() {
        const content = (
            <>
                <AllConnectionLines designerContext={this.designerContext} />
                <div
                    style={{
                        position: "absolute"
                    }}
                >
                    <WidgetComponent
                        widget={this.page}
                        dataContext={
                            this.pageDocument.DocumentStore.dataContext
                        }
                        designerContext={this.designerContext}
                    />
                </div>
                <DragWidget
                    page={this.page}
                    designerContext={this.designerContext}
                />
            </>
        );

        return (
            <PageEditorCanvasContainer
                id={this.designerContext.containerId}
                tabIndex={0}
                onFocus={this.props.onFocus || this.focusHander}
                onDragOver={this.onDragOver}
                onDrop={this.onDrop}
                onDragLeave={this.onDragLeave}
                onKeyDown={this.onKeyDown}
            >
                <PageEditorCanvas
                    designerContext={this.designerContext}
                    dragAndDropActive={!!DragAndDropManager.dragObject}
                >
                    {this.designerContext.document && content}
                </PageEditorCanvas>
            </PageEditorCanvasContainer>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const DRAG_SCROLL_BORDER_THRESHOLD = 10;
const DRAG_SCROLL_MIN_SPEED = 50; // px per second
const DRAG_SCROLL_MAX_SPEED = 800; // px per second
const DRAG_SCROLL_MAX_SPEED_AT_DISTANCE = 50; // px

function calcDragScrollSpeed(distance: number, dt: number) {
    if (distance === 0) {
        return 0;
    }

    let sign = 1;

    if (distance < 0) {
        distance = -distance;
        sign = -1;
    }

    const min = (DRAG_SCROLL_MIN_SPEED * dt) / 1000;
    const max = (DRAG_SCROLL_MAX_SPEED * dt) / 1000;

    distance = Math.min(distance, DRAG_SCROLL_MAX_SPEED_AT_DISTANCE);

    return (
        sign *
        (min + (distance / DRAG_SCROLL_MAX_SPEED_AT_DISTANCE) * (max - min))
    );
}

function setupDragScroll(
    el: HTMLElement,
    mouseHandler: IMouseHandler,
    translateBy: (point: Point) => void
) {
    let dragScrollLastTime: number | undefined;

    function onDragScroll() {
        const lastPointerEvent = mouseHandler.lastPointerEvent;
        const r = el.getBoundingClientRect();

        let tx = 0;
        let ty = 0;

        if (
            lastPointerEvent.clientX < r.left + DRAG_SCROLL_BORDER_THRESHOLD &&
            lastPointerEvent.movementX < 0
        ) {
            tx =
                r.left +
                DRAG_SCROLL_BORDER_THRESHOLD -
                lastPointerEvent.clientX;
        } else if (
            lastPointerEvent.clientX > r.right - DRAG_SCROLL_BORDER_THRESHOLD &&
            lastPointerEvent.movementX > 0
        ) {
            tx = -(
                lastPointerEvent.clientX -
                (r.right - DRAG_SCROLL_BORDER_THRESHOLD)
            );
        }

        if (
            lastPointerEvent.clientY < r.top + DRAG_SCROLL_BORDER_THRESHOLD &&
            lastPointerEvent.movementY < 0
        ) {
            ty =
                r.top + DRAG_SCROLL_BORDER_THRESHOLD - lastPointerEvent.clientY;
        } else if (
            lastPointerEvent.clientY >
                r.bottom - DRAG_SCROLL_BORDER_THRESHOLD &&
            lastPointerEvent.movementY > 0
        ) {
            ty = -(
                lastPointerEvent.clientY -
                (r.bottom - DRAG_SCROLL_BORDER_THRESHOLD)
            );
        }

        if (tx || ty) {
            if (!dragScrollLastTime) {
                dragScrollLastTime = new Date().getTime();
            } else {
                const currentTime = new Date().getTime();
                const dt = currentTime - dragScrollLastTime;
                dragScrollLastTime = currentTime;

                translateBy({
                    x: calcDragScrollSpeed(tx, dt),
                    y: calcDragScrollSpeed(ty, dt)
                });
            }
        } else {
            dragScrollLastTime = undefined;
        }

        dragScrollAnimationFrameRequest = window.requestAnimationFrame(
            onDragScroll
        );
    }

    let dragScrollAnimationFrameRequest = window.requestAnimationFrame(
        onDragScroll
    );

    return () => {
        window.cancelAnimationFrame(dragScrollAnimationFrameRequest);
    };
}
