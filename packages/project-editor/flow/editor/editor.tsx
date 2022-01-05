import React from "react";
import { observable, computed, action, toJS, runInAction } from "mobx";
import { observer } from "mobx-react";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import {
    BoundingRectBuilder,
    Point,
    pointDistance,
    pointInRect,
    Rect,
    rectContains
} from "eez-studio-shared/geometry";
import {
    attachCssToElement,
    closestByClass,
    closestBySelector
} from "eez-studio-shared/dom";

import type { IEditorOptions } from "project-editor/flow/flow-interfaces";
import { EditorFlowContext } from "project-editor/flow/editor/context";

import {
    getObjectBoundingRect,
    getObjectIdFromPoint,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/editor/bounding-rects";

import {
    isAncestor,
    getParent,
    setParent,
    getId
} from "project-editor/core/object";
import { IPanel, isObjectInstanceOf } from "project-editor/core/store";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { DragAndDropManager } from "project-editor/core/dd";

import type { Flow, FlowTabState } from "project-editor/flow/flow";
import type { Component } from "project-editor/flow/component";
import { Svg, ComponentEnclosure } from "project-editor/flow/editor/render";
import { ProjectContext } from "project-editor/project/context";
import { ConnectionLines } from "project-editor/flow/editor/ConnectionLineComponent";
import { Draggable } from "eez-studio-ui/draggable";
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
    SnapLines
} from "project-editor/flow/editor/mouse-handler";
import { Selection } from "project-editor/flow/editor/selection";
import { setupDragScroll } from "project-editor/flow/editor/drag-scroll";
import { settingsController } from "home/settings";
import { ProjectEditor } from "project-editor/project-editor-interface";

const CONF_DOUBLE_CLICK_TIME = 350; // ms
const CONF_DOUBLE_CLICK_DISTANCE = 5; // px

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable snapLines: SnapLines | undefined;
    flowContext: EditorFlowContext | undefined;
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
                    left:
                        (dragComponent instanceof ProjectEditor.WidgetClass
                            ? flow.pageRect.left
                            : 0) + dragComponent.left,
                    top:
                        (dragComponent instanceof ProjectEditor.WidgetClass
                            ? flow.pageRect.top
                            : 0) + dragComponent.top,
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

function CenterLines({ flowContext }: { flowContext: EditorFlowContext }) {
    const transform = flowContext.viewState.transform;

    const CENTER_LINES_COLOR = settingsController.isDarkTheme ? "#444" : "#eee";
    const CENTER_LINES_WIDTH = 1 / transform.scale;

    const centerLineStyle = {
        fill: "transparent",
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
            {pageFlowRect && (
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

////////////////////////////////////////////////////////////////////////////////

@observer
export class Canvas extends React.Component<{
    flowContext: EditorFlowContext;
    pageRect?: Rect;
    dragAndDropActive: boolean;
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
                this.mouseHandler instanceof
                    NewConnectionLineFromOutputMouseHandler ||
                this.mouseHandler instanceof
                    NewConnectionLineFromInputMouseHandler ||
                this.mouseHandler instanceof
                    MoveOutputConnectionLinesMouseHandler ||
                this.mouseHandler instanceof
                    MoveInputConnectionLinesMouseHandler ||
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

    onWheel = (event: WheelEvent) => {
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

            let isMoveable = isSelectionMoveable(flowContext);

            if (
                closestByClass(event.target, "EezStudio_FlowEditorSelection") &&
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
                                flowContext.viewState.isObjectSelected(object)
                            ) {
                                flowContext.viewState.deselectObject(object);
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

    onPointerMove = action((event: React.PointerEvent<HTMLDivElement>) => {
        if (this.mouseHandler) {
            this.props.flowContext.viewState.hoveredConnectionLines = undefined;
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

        return (
            <div
                ref={(ref: any) => (this.div = ref!)}
                style={style}
                onContextMenu={this.onContextMenu}
                onPointerMove={this.onPointerMove}
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

@observer
export class FlowEditor
    extends React.Component<{
        tabState: FlowTabState;
    }>
    implements IPanel
{
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    divRef = React.createRef<HTMLDivElement>();

    currentWidgetContainer?: ITreeObjectAdapter;

    @observable options: IEditorOptions;

    @computed
    get flowContext() {
        const flowContext = new EditorFlowContext();

        flowContext.set(
            this.props.tabState,
            this.options,
            this.filterSnapLines
        );

        return flowContext;
    }

    filterSnapLines = (node: ITreeObjectAdapter) => {
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
    };

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
                this.flowContext.viewState.selectedObjects.map(selectedObject =>
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

            this.props.tabState.onEnsureSelectionVisibleIsDone();
        }
    };

    // interface IPanel implementation
    @computed
    get selectedObject() {
        return this.props.tabState.widgetContainer.selectedObjects[0];
    }
    @computed
    get selectedObjects() {
        return this.props.tabState.widgetContainer.selectedObjects;
    }
    cutSelection() {
        this.props.tabState.widgetContainer.cutSelection();
    }
    copySelection() {
        this.props.tabState.widgetContainer.copySelection();
    }
    pasteSelection() {
        this.flowContext.document.pasteSelection();
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

    @action.bound
    onDragOver(event: React.DragEvent) {
        const dragComponent = this.getDragComponent(event);
        if (dragComponent) {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";

            const flow = this.props.tabState.widgetContainer.object as Flow;

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

            if (component instanceof ProjectEditor.WidgetClass) {
                component.left = Math.round(left - flow.pageRect.left);
                component.top = Math.round(top - flow.pageRect.top);
            } else {
                component.left = Math.round(left);
                component.top = Math.round(top);
            }
        }
    }

    @action.bound
    onDrop(event: React.DragEvent) {
        event.stopPropagation();
        event.preventDefault();

        if (this.flowContext.dragComponent) {
            const flow = this.props.tabState.widgetContainer.object as Flow;

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

    onKeyDown = (event: React.KeyboardEvent) => {
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
                className="EezStudio_FlowEditorCanvasContainer"
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
                            {!this.props.tabState.frontFace && (
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
            </div>
        );
    }
}
