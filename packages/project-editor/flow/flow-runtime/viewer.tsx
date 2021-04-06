import React from "react";
import {
    observable,
    computed,
    action,
    autorun,
    runInAction,
    IReactionDisposer
} from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import { Point, Rect } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import type {
    IDocument,
    IViewStatePersistantState,
    IFlowContext
} from "project-editor/flow/flow-interfaces";
import { ITransform } from "project-editor/flow/flow-editor/transform";
import { DesignerContext } from "project-editor/flow/flow-runtime/context";

import { isObjectInstanceOf } from "project-editor/core/object";
import { IPanel, getDocumentStore } from "project-editor/core/store";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { DragAndDropManager } from "project-editor/core/dd";

import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import { Svg } from "project-editor/flow/flow-editor/render";
import { ProjectContext } from "project-editor/project/context";
import { guid } from "eez-studio-shared/guid";
import { ConnectionLines } from "project-editor/flow/flow-editor/ConnectionLineComponent";
import { Selection } from "project-editor/flow/flow-runtime/selection";

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

@observer
export class Canvas extends React.Component<{
    designerContext: IFlowContext;
    pageRect?: Rect;
    dragAndDropActive: boolean;
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
    };

    componentDidMount() {
        this.div.addEventListener("wheel", this.onWheel, {
            passive: false
        });

        if (this.div) {
            this.resizeObserver.observe(this.div);
        }
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
        }

        event.preventDefault();
        event.stopPropagation();
    }

    @bind
    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();
    }

    render() {
        let style: React.CSSProperties = {};

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
                    {this.props.children}
                </div>
                <Selection
                    context={this.props.designerContext}
                    mouseHandler={undefined}
                />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const FlowViewerCanvasContainer = styled.div`
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

    &:focus {
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
    }

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

    .connection-line-path {
        marker-start: url(#lineStart);
        marker-end: url(#lineEnd);

        stroke: ${props => props.theme.connectionLineColor};

        &.selected {
            stroke: ${props => props.theme.selectedConnectionLineColor};
            marker-start: url(#selectedLineStart);
            marker-end: url(#selectedLineEnd);
        }

        &.active {
            stroke: ${props => props.theme.activeConnectionLineColor};
            stroke-dasharray: 10;
            animation: dash 10s linear infinite;
            marker-start: url(#activeLineStart);
            marker-end: url(#activeLineEnd);
        }
    }

    @keyframes dash {
        from {
            stroke-dashoffset: 0;
        }
        to {
            stroke-dashoffset: -600;
        }
    }
`;

@observer
export class FlowViewer
    extends React.Component<{
        widgetContainer: ITreeObjectAdapter;
        onFocus?: () => void;
        transitionIsActive?: boolean;
        frontFace?: boolean;
    }>
    implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    designerContext: DesignerContext = new DesignerContext(
        "eez-flow-editor-" + guid()
    );
    currentWidgetContainer?: ITreeObjectAdapter;

    @observable flowDocument: FlowDocument;

    @disposeOnUnmount dispose: IReactionDisposer;

    constructor(props: any) {
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
        }
    }

    componentDidMount() {
        this.dispose = autorun(() => {
            this.designerContext.set(
                this.flowDocument,
                this.viewStatePersistantState,
                this.onSavePersistantState,
                this.props.frontFace
            );
        });
    }

    componentDidUpdate() {
        this.updateFlowDocument();
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

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.keyCode == 27) {
            // esc
            this.designerContext.viewState.deselectAllObjects();
        }
    }

    @bind
    onDoubleClick() {
        this.designerContext.viewState.resetTransform();
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    componentWillUnmount() {
        this.designerContext.destroy();
        this.dispose();
    }

    get flow() {
        return this.flowDocument.flow.object as Flow;
    }

    render() {
        return (
            <FlowViewerCanvasContainer
                id={this.designerContext.containerId}
                tabIndex={0}
                onFocus={this.props.onFocus || this.focusHander}
                onKeyDown={this.onKeyDown}
                onDoubleClick={this.onDoubleClick}
            >
                <Canvas
                    designerContext={this.designerContext}
                    dragAndDropActive={!!DragAndDropManager.dragObject}
                    transitionIsActive={this.props.transitionIsActive}
                >
                    {this.designerContext.document && (
                        <>
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
                            {!this.props.frontFace && (
                                <AllConnectionLines
                                    designerContext={this.designerContext}
                                />
                            )}
                        </>
                    )}
                </Canvas>
            </FlowViewerCanvasContainer>
        );
    }
}
