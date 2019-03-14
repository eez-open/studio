import React from "react";
import { observable, computed, action, toJS, autorun } from "mobx";
import { observer, Provider } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
import { bind } from "bind-decorator";

import { _range, _isEqual } from "eez-studio-shared/algorithm";
import { Point, Rect, ITransform, pointInRect, isRectInsideRect } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewStatePersistantState,
    IResizeHandler,
    IDesignerOptions
} from "eez-studio-designer/designer-interfaces";
import { DesignerContext } from "eez-studio-designer/context";
import { Canvas } from "eez-studio-designer/canvas";
import { selectToolHandler } from "eez-studio-designer/select-tool";
import styled from "eez-studio-ui/styled-components";

import { EezObject, isObjectInstanceOf, isAncestor } from "eez-studio-shared/model/object";
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
import { Widget, SelectWidget } from "eez-studio-page-editor/widget";
import { renderRootElement } from "eez-studio-page-editor/render";

////////////////////////////////////////////////////////////////////////////////

export class EditorObject implements IBaseObject {
    constructor(
        public object: EezObject,
        private pageEditorContext: PageEditorContext,
        private transformer: ITransformer<EezObject, EditorObject>
    ) {}

    get id() {
        return this.object._id;
    }

    @computed
    get rect() {
        if (this.object instanceof Widget || this.object instanceof Page) {
            return this.object.rect;
        } else {
            console.error("Unknown object type");
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }
    }

    set rect(value: Rect) {
        if (this.object instanceof Widget || this.object instanceof Page) {
            DocumentStore.updateObject(this.object, {
                x: value.left,
                y: value.top,
                width: value.width,
                height: value.height
            });
        } else {
            console.error("Unknown object type");
        }
    }

    @computed
    get children(): EditorObject[] {
        let childrenObjects: EezObject[] | undefined;

        if (this.object instanceof Page) {
            childrenObjects = this.object.widgets._array;

            if (this.pageEditorContext.dragWidget) {
                childrenObjects = [...childrenObjects, this.pageEditorContext.dragWidget];
            }
        } else if (this.object instanceof Widget) {
            childrenObjects = this.object.getChildrenObjectsInEditor();
        }

        return childrenObjects ? childrenObjects.map(object => this.transformer(object)) : [];
    }

    @computed
    get boundingRect() {
        if (this.object instanceof Widget) {
            const rect = {
                left: this.object.x,
                top: this.object.y,
                width: this.object.width,
                height: this.object.height
            };

            let object: Widget = this.object;

            while (true) {
                let parent = object.parent;

                rect.left += parent.contentRect.left;
                rect.top += parent.contentRect.top;

                if (!(parent instanceof Widget)) {
                    break;
                }

                object = parent;
            }

            return rect;
        } else if (this.object instanceof Page) {
            return this.rect;
        } else {
            console.error("Unknown object type");
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }
    }

    @computed
    get selectionRects() {
        if (this.object instanceof Widget) {
            return [this.boundingRect];
        } else if (this.object instanceof Page) {
            return [this.rect];
        } else {
            console.error("Unknown object type");
            return [];
        }
    }

    get isSelectable() {
        if (this.object instanceof Page) {
            return false;
        } else {
            return true;
        }
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        if (this.object instanceof Page || this.object instanceof Widget) {
            return this.object.getResizeHandlers();
        }
        return false;
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

    objectFromPoint(point: Point): EditorObject | undefined {
        let foundObject: EditorObject | undefined = undefined;

        if (this.children.length > 0) {
            if (this.object instanceof SelectWidget) {
                const child = this.children[this.object.getSelectedIndex()];
                let result = child.objectFromPoint(point);
                if (result) {
                    foundObject = result;
                }
            } else {
                for (const child of this.children) {
                    let result = child.objectFromPoint(point);
                    if (result) {
                        foundObject = result;
                    }
                }
            }
        }

        if (foundObject) {
            return foundObject;
        }

        for (let i = 0; i < this.selectionRects.length; i++) {
            if (pointInRect(point, this.selectionRects[i])) {
                return this;
            }
        }

        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

function createObjectToEditorObjectTransformer(designerContext: PageEditorContext) {
    const transformer = createTransformer(
        (object: EezObject): EditorObject => {
            return new EditorObject(object, designerContext, transformer);
        }
    );
    return transformer;
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
        return {
            left: dragSnapLines.dragWidget!.x,
            top: dragSnapLines.dragWidget!.y,
            width: dragSnapLines.dragWidget!.width,
            height: dragSnapLines.dragWidget!.height
        };
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

class PageEditorContext extends DesignerContext {
    @observable
    dragWidget: Widget | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class PageDocument implements IDocument {
    rootObject: EditorObject;

    constructor(private page: ITreeObjectAdapter, pageEditorContext: PageEditorContext) {
        const transformer = createObjectToEditorObjectTransformer(pageEditorContext);
        this.rootObject = transformer(page.object);
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

    get boundingRect() {
        return this.rootObject.boundingRect;
    }

    objectFromPoint(point: Point) {
        return this.rootObject.objectFromPoint(point);
    }

    resetTransform(transform: ITransform) {
        const page = this.rootObject.object as Page;
        transform.translate = {
            x: -page.width / 2,
            y: -page.height / 2
        };
        transform.scale = 1;
    }

    getObjectsInsideRect(rect: Rect) {
        return this.rootObject.children.filter(object =>
            isRectInsideRect(object.boundingRect, rect)
        );
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
}

@observer
export class PageEditor extends React.Component<
    PageEditorProps,
    {
        hasError: boolean;
    }
> {
    static defaultProps = {};

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
                x: event.nativeEvent.clientX - (widget.width * transform.scale) / 2,
                y: event.nativeEvent.clientY - (widget.height * transform.scale) / 2
            });

            const { left, top } = dragSnapLines.snapLines!.dragSnap(
                p.x,
                p.y,
                widget.width,
                widget.height
            );

            widget.x = Math.round(left - page.x);
            widget.y = Math.round(top - page.y);
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
        return (this.pageEditorContext.document.rootObjects[0] as EditorObject).object as Page;
    }

    render() {
        if (this.state.hasError) {
            // TODO better error presentation
            return <div>Error!</div>;
        }

        const { dataContext, onFocus } = this.props;

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
                        pageRect={this.page.rect}
                    >
                        {renderRootElement(
                            this.page.render(
                                this.page.rect,
                                dataContext || PageContext.rootDataContext,
                                true
                            )
                        )}
                    </PageEditorCanvas>
                </PageEditorCanvasContainer>
            </Provider>
        );
    }
}
