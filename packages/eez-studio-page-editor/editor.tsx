import React from "react";
import { observable, computed, action, toJS, autorun } from "mobx";
import { observer, Provider } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
import { bind } from "bind-decorator";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import { Point, Rect, ITransform } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewStatePersistantState,
    IResizeHandler,
    IDesignerOptions
} from "eez-studio-designer/designer-interfaces";
import { DesignerContext } from "eez-studio-designer/context";
import { Canvas } from "eez-studio-designer/canvas";
import { selectToolHandler, getObjectIdFromPoint } from "eez-studio-designer/select-tool";
import styled from "eez-studio-ui/styled-components";

import { isObjectInstanceOf, isAncestor } from "eez-studio-shared/model/object";
import {
    DocumentStore,
    NavigationStore,
    deleteItems,
    UndoManager,
    UIStateStore
} from "eez-studio-shared/model/store";
import { ITreeObjectAdapter } from "eez-studio-shared/model/objectAdapter";
import { DragAndDropManager } from "eez-studio-shared/model/dd";

import { SnapLines } from "eez-studio-designer/select-tool";

import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { Page } from "eez-studio-page-editor/page";
import { Widget } from "eez-studio-page-editor/widget";
import { renderRootElement, WidgetComponent } from "eez-studio-page-editor/render";

////////////////////////////////////////////////////////////////////////////////

function createObjectToEditorObjectTransformer(designerContext: PageEditorContext) {
    const transformer = createTransformer(
        (treeObjectAdapter: ITreeObjectAdapter): EditorObject => {
            return new EditorObject(treeObjectAdapter, designerContext, transformer);
        }
    );
    return transformer;
}

////////////////////////////////////////////////////////////////////////////////

export class EditorObject implements IBaseObject {
    constructor(
        public treeObjectAdapter: ITreeObjectAdapter,
        private pageEditorContext: PageEditorContext,
        private transformer: ITransformer<ITreeObjectAdapter, EditorObject>
    ) {}

    get object() {
        return this.treeObjectAdapter.object as Page | Widget;
    }

    get id() {
        return this.object._id;
    }

    @computed
    get rect() {
        return this.object.rect;
    }

    set rect(value: Rect) {
        DocumentStore.updateObject(this.object, {
            left: value.left,
            top: value.top,
            width: value.width,
            height: value.height
        });
    }

    @computed
    get children(): EditorObject[] {
        let childrenObjects = this.treeObjectAdapter.children;

        if (Array.isArray(childrenObjects) && this.object instanceof Page) {
            if (this.pageEditorContext.dragWidget) {
                childrenObjects = [
                    ...childrenObjects,
                    {
                        object: this.pageEditorContext.dragWidget,
                        children: []
                    } as any
                ];
            }
        }

        return _map(childrenObjects, (object: ITreeObjectAdapter) => this.transformer(object));
    }

    get isSelectable() {
        return true;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return this.object.getResizeHandlers();
    }

    getColumnWidth(columnIndex: number): number {
        if (this.object instanceof Widget) {
            return this.object.getColumnWidth(columnIndex);
        }
        return NaN;
    }

    resizeColumn(columnIndex: number, savedColumnWidth: number, offset: number) {
        if (this.object instanceof Widget) {
            return this.object.resizeColumn(columnIndex, savedColumnWidth, offset);
        }
    }

    getRowHeight(rowIndex: number): number {
        if (this.object instanceof Widget) {
            return this.object.getRowHeight(rowIndex);
        }
        return NaN;
    }

    resizeRow(rowIndex: number, savedRowHeight: number, offset: number) {
        if (this.object instanceof Widget) {
            return this.object.resizeRow(rowIndex, savedRowHeight, offset);
        }
    }

    open() {
        if (this.object instanceof Widget) {
            return this.object.open();
        }
    }

    findObjectById(id: string): EditorObject | undefined {
        if (this.id === id) {
            return this;
        }

        for (const child of this.children) {
            const object = child && child.findObjectById(id);
            if (object) {
                return object;
            }
        }

        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable
    snapLines: SnapLines | undefined;

    pageEditorContext: PageEditorContext | undefined;
    dragWidget: Widget | undefined;

    start(pageEditorContext: PageEditorContext) {
        this.snapLines = new SnapLines();
        this.pageEditorContext = pageEditorContext;
        this.dragWidget = pageEditorContext.dragWidget;

        this.snapLines.find(pageEditorContext);
    }

    clear() {
        this.snapLines = undefined;
        this.pageEditorContext = undefined;
        this.dragWidget = undefined;
    }
}

const dragSnapLines = new DragSnapLines();

@observer
class DragSnapLinesOverlay extends React.Component {
    get dragWidgetRect() {
        return dragSnapLines.dragWidget!.rect;
    }

    render() {
        if (!dragSnapLines.snapLines) {
            return null;
        }

        return (
            dragSnapLines.snapLines && (
                <div style={{ left: 0, top: 0, pointerEvents: "none" }}>
                    {dragSnapLines.snapLines.render(
                        dragSnapLines.pageEditorContext!.viewState.transform,
                        this.dragWidgetRect
                    )}
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const DragWidget = observer(
    ({
        page,
        pageEditorContext,
        dataContext
    }: {
        page: Page;
        pageEditorContext: PageEditorContext;
        dataContext: IDataContext;
    }) => {
        return pageEditorContext.dragWidget ? (
            <WidgetComponent
                widget={pageEditorContext.dragWidget}
                rect={{
                    left: page.rect.left + pageEditorContext.dragWidget.rect.left,
                    top: page.rect.top + pageEditorContext.dragWidget.rect.top,
                    width: pageEditorContext.dragWidget.rect.width,
                    height: pageEditorContext.dragWidget.rect.height
                }}
                dataContext={dataContext}
            />
        ) : null;
    }
);

////////////////////////////////////////////////////////////////////////////////

class PageEditorContext extends DesignerContext {
    @observable
    dragWidget: Widget | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class PageDocument implements IDocument {
    rootObject: EditorObject;

    constructor(private page: ITreeObjectAdapter, private pageEditorContext: PageEditorContext) {
        const transformer = createObjectToEditorObjectTransformer(pageEditorContext);
        this.rootObject = transformer(page);
    }

    get rootObjects() {
        return [this.rootObject];
    }

    findObjectById(id: string) {
        return this.rootObject.findObjectById(id);
    }

    createObject(params: any) {
        // TODO ???
    }

    deleteObjects(objects: EditorObject[]) {
        deleteItems(objects.map(editorObject => editorObject.object));
    }

    objectFromPoint(point: Point) {
        const id = getObjectIdFromPoint(this.pageEditorContext.viewState, point);
        if (!id) {
            return undefined;
        }
        return this.findObjectById(id);
    }

    resetTransform(transform: ITransform) {
        const page = this.rootObject.object as Page;
        transform.translate = {
            x: -page.WindowWidth / 2,
            y: -page.WindowHeight / 2
        };
        transform.scale = 1;
    }

    getObjectsInsideRect(rect: Rect) {
        return [];
    }

    createContextMenu(objects: IBaseObject[]) {
        return this.page.createSelectionContextMenu();
    }

    onDragStart(op: "move" | "resize"): void {
        UndoManager.setCombineCommands(true);
    }

    onDragEnd(op: "move" | "resize", changed: boolean, objects: IBaseObject[]): void {
        UndoManager.setCombineCommands(false);
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
`;

const PageEditorCanvas: typeof Canvas = styled(Canvas)`
    position: absolute;
    width: 100%;
    height: 100%;
` as any;

interface PageEditorProps {
    widgetContainer: ITreeObjectAdapter;
    onFocus?: () => void;
    dataContext?: IDataContext;
    pageRect?: Rect;
}

@observer
export class PageEditor extends React.Component<
    PageEditorProps,
    {
        hasError: boolean;
    }
> {
    pageEditorContext: PageEditorContext = new PageEditorContext();

    @observable
    pageDocument: PageDocument;

    @observable options: IDesignerOptions;

    constructor(props: PageEditorProps) {
        super(props);

        this.state = { hasError: false };

        this.pageEditorContext = new PageEditorContext();

        this.componentWillReceiveProps(props);

        autorun(() => {
            this.pageEditorContext.set(
                this.pageDocument,
                this.viewStatePersistantState,
                this.onSavePersistantState,
                this.options,
                this.filterSnapLines
            );
        });
    }

    @action
    componentWillReceiveProps(props: PageEditorProps) {
        this.pageDocument = new PageDocument(props.widgetContainer, this.pageEditorContext);

        this.options = {
            center: {
                x: 0,
                y: 0
            }
        };
    }

    @bind
    filterSnapLines(node: IBaseObject) {
        const object = (node as EditorObject).object;

        const selectedObjects = this.pageEditorContext.viewState.selectedObjects;

        for (let i = 0; i < selectedObjects.length; ++i) {
            const selectedObject = (selectedObjects[i] as EditorObject).object;

            if (object === selectedObject) {
                return false;
            }

            if (selectedObject._parent === object._parent || isAncestor(selectedObject, object)) {
                return true;
            }
        }

        return false;
    }

    @computed
    get selectedObject() {
        const selectedObject =
            this.pageEditorContext.viewState.selectedObjects.length === 1 &&
            this.pageEditorContext.viewState.selectedObjects[0];

        if (selectedObject) {
            return (selectedObject as EditorObject).object;
        }

        return undefined;
    }

    @bind
    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    savedViewState: IViewStatePersistantState | undefined;

    @computed
    get viewStatePersistantState(): IViewStatePersistantState {
        const uiState = UIStateStore.getObjectUIState(this.props.widgetContainer.object);

        let transform: ITransform | undefined;
        if (uiState && uiState.pageEditorCanvasViewState) {
            transform = uiState.pageEditorCanvasViewState.transform;
        }

        let viewState: IViewStatePersistantState = {
            transform,
            selectedObjects: this.props.widgetContainer.selectedItems.map(item => item.object._id)
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
        if (!this.pageEditorContext.dragWidget) {
            this.savedViewState = viewState;

            const uiState = UIStateStore.getObjectUIState(this.props.widgetContainer.object);
            if (
                !uiState ||
                !uiState.pageEditorCanvasViewState ||
                !_isEqual(uiState.pageEditorCanvasViewState.transform, viewState.transform)
            ) {
                UIStateStore.updateObjectUIState(this.props.widgetContainer.object, {
                    pageEditorCanvasViewState: {
                        transform: viewState.transform
                    }
                });
            }

            // selection changed in Editor => change selection in Tree
            this.props.widgetContainer.selectObjectIds(viewState.selectedObjects);
        }
    }

    getDragWidget(event: React.DragEvent) {
        if (
            DragAndDropManager.dragObject &&
            isObjectInstanceOf(DragAndDropManager.dragObject, Widget.classInfo) &&
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

            if (!this.pageEditorContext.dragWidget) {
                this.pageEditorContext.dragWidget = widget;
                this.pageEditorContext.dragWidget._parent = page.widgets;

                this.pageEditorContext.viewState.selectObjects([
                    this.pageEditorContext.document.findObjectById("WidgetPaletteItem")!
                ]);

                dragSnapLines.start(this.pageEditorContext);
            }

            dragSnapLines.snapLines!.enabled = !event.shiftKey;

            const transform = this.pageEditorContext.viewState.transform;

            const p = transform.clientToModelPoint({
                x: event.nativeEvent.clientX - (widget.rect.width * transform.scale) / 2,
                y: event.nativeEvent.clientY - (widget.rect.height * transform.scale) / 2
            });

            const { left, top } = dragSnapLines.snapLines!.dragSnap(
                p.x,
                p.y,
                widget.rect.width,
                widget.rect.height
            );

            widget.left = Math.round(left - page.rect.left).toString();
            widget.top = Math.round(top - page.rect.top).toString();
        }
    }

    @action.bound
    onDrop(event: React.DragEvent) {
        if (this.pageEditorContext.dragWidget) {
            const page = this.props.widgetContainer.object as Page;

            const object = DocumentStore.addObject(
                page.widgets,
                toJS(this.pageEditorContext.dragWidget)
            );

            this.pageEditorContext.dragWidget = undefined;
            dragSnapLines.clear();

            setTimeout(() => {
                const objectAdapter = this.pageEditorContext.document.findObjectById(object._id);
                if (objectAdapter) {
                    const viewState = this.pageEditorContext.viewState;
                    viewState.selectObjects([objectAdapter]);
                }
            }, 0);
        }
    }

    @action.bound
    onDragLeave(event: React.DragEvent) {
        if (this.pageEditorContext.dragWidget) {
            this.pageEditorContext.dragWidget = undefined;

            // deselect dragWidget
            this.pageEditorContext.viewState.deselectAllObjects();

            dragSnapLines.clear();
        }
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.keyCode == 46) {
            // delete
            this.props.widgetContainer.deleteSelection();
        } else if (event.keyCode == 27) {
            // esc
            this.pageEditorContext.viewState.deselectAllObjects();
        }
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    componentWillUnmount() {
        this.pageEditorContext.destroy();
    }

    get page() {
        return this.pageDocument.rootObject.object as Page;
    }

    render() {
        if (this.state.hasError) {
            // TODO better error presentation
            return <div>Error!</div>;
        }

        const { dataContext, onFocus } = this.props;

        const pageRect = this.props.pageRect;

        return (
            <Provider designerContext={this.pageEditorContext}>
                <PageEditorCanvasContainer
                    tabIndex={0}
                    onFocus={onFocus || this.focusHander}
                    onDragOver={this.onDragOver}
                    onDrop={this.onDrop}
                    onDragLeave={this.onDragLeave}
                    onKeyDown={this.onKeyDown}
                >
                    <PageEditorCanvas
                        toolHandler={selectToolHandler}
                        customOverlay={<DragSnapLinesOverlay />}
                        pageRect={pageRect}
                    >
                        {
                            <div
                                style={{
                                    position: "absolute",
                                    left: pageRect && pageRect.left,
                                    top: pageRect && pageRect.top,
                                    width: pageRect && pageRect.width,
                                    height: pageRect && pageRect.height
                                }}
                            >
                                {renderRootElement(
                                    <WidgetComponent
                                        widget={this.page}
                                        dataContext={dataContext || PageContext.rootDataContext}
                                    />
                                )}
                            </div>
                        }
                        <DragWidget
                            page={this.page}
                            pageEditorContext={this.pageEditorContext}
                            dataContext={dataContext || PageContext.rootDataContext}
                        />
                    </PageEditorCanvas>
                </PageEditorCanvasContainer>
            </Provider>
        );
    }
}
