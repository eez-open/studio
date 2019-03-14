import React from "react";
import { observable, computed, action, toJS, autorun } from "mobx";
import { observer, inject, Provider } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
import { bind } from "bind-decorator";

import { _range, _isEqual } from "eez-studio-shared/algorithm";
import { Point, Rect, ITransform, pointInRect, isRectInsideRect } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewStatePersistantState,
    IDesignerContext,
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
import {
    Widget,
    ContainerWidget,
    ListWidget,
    GridWidget,
    SelectWidget
} from "eez-studio-page-editor/widget";
import { renderBackgroundRect, renderFail, renderRootElement } from "eez-studio-page-editor/render";

////////////////////////////////////////////////////////////////////////////////

class EditorObject implements IBaseObject {
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
            let rects = [this.boundingRect];

            let listWidget = this.object._parent;
            while (
                !(listWidget instanceof ListWidget || listWidget instanceof GridWidget) &&
                listWidget instanceof Widget
            ) {
                listWidget = listWidget._parent;
            }

            if (!(listWidget instanceof ListWidget || listWidget instanceof GridWidget)) {
                return rects;
            }

            const itemWidget = listWidget.itemWidget;
            if (itemWidget) {
                let count = listWidget.data
                    ? PageContext.rootDataContext.count(listWidget.data)
                    : 0;

                if (listWidget instanceof ListWidget) {
                    for (let i = 1; i < count; i++) {
                        if (listWidget.listType === "horizontal") {
                            rects.push({
                                left: this.boundingRect.left + i * itemWidget.width,
                                top: this.boundingRect.top,
                                width: this.boundingRect.width,
                                height: this.boundingRect.height
                            });
                        } else {
                            rects.push({
                                left: this.boundingRect.left,
                                top: this.boundingRect.top + i * itemWidget.height,
                                width: this.boundingRect.width,
                                height: this.boundingRect.height
                            });
                        }
                    }
                } else {
                    const rows = Math.floor(listWidget.width / itemWidget.width);
                    const cols = Math.floor(listWidget.height / itemWidget.height);
                    for (let i = 1; i < count; i++) {
                        const row = i % rows;
                        const col = Math.floor(i / rows);

                        if (col >= cols) {
                            break;
                        }

                        rects.push({
                            left: this.boundingRect.left + row * itemWidget.width,
                            top: this.boundingRect.top + col * itemWidget.height,
                            width: this.boundingRect.width,
                            height: this.boundingRect.height
                        });
                    }
                }
            }

            return rects;
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
                const child = this.children[this.selectedIndexInSelectWidget];
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

    @computed
    get selectedIndexInSelectWidget() {
        const selectWidget = this.object as SelectWidget;

        const selectedObjects = this.pageEditorContext.viewState.selectedObjects;
        for (let i = 0; i < selectWidget.widgets._array.length; ++i) {
            if (
                selectedObjects.find((selectedObject: EditorObject) =>
                    isAncestor(selectedObject.object, selectWidget.widgets._array[i])
                )
            ) {
                selectWidget._lastSelectedIndexInSelectWidget = i;
                return i;
            }
        }

        if (selectWidget._lastSelectedIndexInSelectWidget !== undefined) {
            return selectWidget._lastSelectedIndexInSelectWidget;
        }

        if (selectWidget.data) {
            let index: number = PageContext.rootDataContext.getEnumValue(selectWidget.data);
            if (index >= 0 && index < selectWidget.widgets._array.length) {
                return index;
            }
        }

        if (selectWidget.widgets._array.length > 0) {
            return 0;
        }

        return -1;
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

@inject("designerContext")
@observer
class ObjectComponent extends React.Component<{
    designerContext?: IDesignerContext;
    object: EditorObject;
    dataContext: IDataContext;
}> {
    renderChildren(children: EditorObject[]) {
        let ContainerDiv;

        if ((this.props.object.object as any).css) {
            ContainerDiv = styled.div`
                ${(this.props.object.object as any).css}
            `;
        } else {
            ContainerDiv = styled.div``;
        }

        let className;
        if ((this.props.object.object as any).getClassNameStr) {
            className = (this.props.object.object as any).getClassNameStr(this.props.dataContext);
        }

        return (
            <ContainerDiv
                className={className}
                style={{
                    position: "absolute",
                    left: this.props.object.rect.left,
                    top: this.props.object.rect.top,
                    width: this.props.object.rect.width,
                    height: this.props.object.rect.height
                }}
            >
                {children.map((child, i) => {
                    return (
                        <ObjectComponent
                            key={child.id}
                            object={child}
                            dataContext={this.props.dataContext}
                        />
                    );
                })}
            </ContainerDiv>
        );
    }

    get listWidget() {
        return this.props.object.object as ListWidget;
    }

    get listItemWidget() {
        return this.listWidget.itemWidget;
    }

    get listItemsCount() {
        if (this.listItemWidget && this.listWidget.data) {
            return this.props.dataContext.count(this.listWidget.data);
        } else {
            return 0;
        }
    }

    @action
    renderListItems() {
        const itemWidgetEditorObject = this.props.object.children[0];
        if (!itemWidgetEditorObject) {
            return null;
        }

        const itemRect = itemWidgetEditorObject.rect;

        return _range(this.listItemsCount).map(i => {
            let xListItem = this.props.object.rect.left;
            let yListItem = this.props.object.rect.top;

            if (this.listWidget.listType === "horizontal") {
                xListItem += i * itemRect.width;
            } else {
                yListItem += i * itemRect.height;
            }

            return (
                <div
                    key={i}
                    style={{
                        transform: `translate(${xListItem}px, ${yListItem}px)`,
                        transformOrigin: "0 0"
                    }}
                >
                    {
                        <ObjectComponent
                            object={itemWidgetEditorObject}
                            dataContext={this.props.dataContext}
                        />
                    }
                </div>
            );
        });
    }

    get gridWidget() {
        return this.props.object.object as GridWidget;
    }

    get gridItemWidget() {
        return this.gridWidget.itemWidget;
    }

    get gridItemsCount() {
        if (this.gridItemWidget && this.gridWidget.data) {
            return this.props.dataContext.count(this.gridWidget.data);
        } else {
            return 0;
        }
    }

    @action
    renderGridItems() {
        const itemWidgetEditorObject = this.props.object.children[0];
        if (!itemWidgetEditorObject) {
            return null;
        }

        const gridRect = this.props.object.rect;
        const itemRect = itemWidgetEditorObject.rect;

        return _range(this.gridItemsCount)
            .map(i => {
                const rows = Math.floor(gridRect.width / itemRect.width);
                const cols = Math.floor(gridRect.height / itemRect.height);

                const row = i % rows;
                const col = Math.floor(i / rows);

                if (col >= cols) {
                    return undefined;
                }

                let xListItem = gridRect.left + row * itemRect.width;
                let yListItem = gridRect.top + col * itemRect.height;

                return (
                    <div
                        key={i}
                        style={{
                            transform: `translate(${xListItem}px, ${yListItem}px)`,
                            transformOrigin: "0 0"
                        }}
                    >
                        {
                            <ObjectComponent
                                object={itemWidgetEditorObject}
                                dataContext={this.props.dataContext}
                            />
                        }
                    </div>
                );
            })
            .filter(item => !!item);
    }

    render() {
        if (this.props.object.object instanceof ContainerWidget) {
            return this.renderChildren(this.props.object.children);
        }

        if (this.props.object.object instanceof ListWidget) {
            return (
                <React.Fragment>
                    {renderBackgroundRect(this.props.object.object, this.props.object.rect)}
                    {this.renderListItems()}
                </React.Fragment>
            );
        }

        if (this.props.object.object instanceof GridWidget) {
            return (
                <React.Fragment>
                    {renderBackgroundRect(this.props.object.object, this.props.object.rect)}
                    {this.renderGridItems()}
                </React.Fragment>
            );
        }

        if (this.props.object.object instanceof SelectWidget) {
            const selectedChild = this.props.object.children[
                this.props.object.selectedIndexInSelectWidget
            ];

            if (selectedChild) {
                return this.renderChildren([selectedChild]);
            } else {
                return null;
            }
        }

        if (this.props.object.object instanceof Widget) {
            const rect = this.props.object.rect;

            const canvas = this.props.object.object.draw(rect, this.props.dataContext);
            if (canvas) {
                return (
                    <img
                        style={{
                            position: "absolute",
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            imageRendering: "pixelated"
                        }}
                        src={canvas.toDataURL()}
                    />
                );
            }

            try {
                const node = this.props.object.object.render(rect, this.props.dataContext);
                if (node) {
                    return (
                        <div
                            style={{
                                position: "absolute",
                                left: rect.left,
                                top: rect.top,
                                width: rect.width,
                                height: rect.height
                            }}
                        >
                            {node}
                        </div>
                    );
                }

                return renderBackgroundRect(this.props.object.object, this.props.object.rect);
            } catch (err) {
                console.error(err);
                return renderFail(rect);
            }
        }

        if (this.props.object.object instanceof Page) {
            return (
                <React.Fragment>
                    {this.props.object.object.render(this.props.dataContext)}
                    {this.renderChildren(this.props.object.children)}
                </React.Fragment>
            );
        }

        console.error("Unknown object type");
        return null;
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

    render() {
        if (this.state.hasError) {
            // TODO better error presentatin
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
                    >
                        {renderRootElement(
                            this.pageEditorContext.document.rootObjects.map(
                                (rootObject: EditorObject) => (
                                    <ObjectComponent
                                        key={rootObject.id}
                                        object={rootObject}
                                        dataContext={dataContext || PageContext.rootDataContext}
                                    />
                                )
                            )
                        )}
                    </PageEditorCanvas>
                </PageEditorCanvasContainer>
            </Provider>
        );
    }
}
