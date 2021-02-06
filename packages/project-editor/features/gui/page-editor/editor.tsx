import React from "react";
import { observable, computed, action, toJS, autorun } from "mobx";
import { observer, Provider } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
import { bind } from "bind-decorator";

import { _range, _isEqual, _map } from "eez-studio-shared/algorithm";
import { Point, Rect } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewStatePersistantState,
    IResizeHandler,
    IDesignerOptions
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { ITransform } from "project-editor/features/gui/page-editor/transform";
import { DesignerContext } from "project-editor/features/gui/page-editor/context";
import { Canvas } from "project-editor/features/gui/page-editor/canvas";
import {
    selectToolHandler,
    SnapLines
} from "project-editor/features/gui/page-editor/select-tool";
import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect
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
import {
    deleteItems,
    IPanel
} from "project-editor/core/store";
import { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { DragAndDropManager } from "project-editor/core/dd";

import { getProjectStore } from "project-editor/project/project";
import { Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/widget";
import { WidgetComponent } from "project-editor/features/gui/page-editor/render";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

function createObjectToEditorObjectTransformer(
    designerContext: PageEditorDesignerContext
) {
    const transformer = createTransformer(
        (treeObjectAdapter: ITreeObjectAdapter): EditorObject => {
            return new EditorObject(
                treeObjectAdapter,
                designerContext,
                transformer
            );
        }
    );
    return transformer;
}

////////////////////////////////////////////////////////////////////////////////

export class EditorObject implements IBaseObject {
    constructor(
        public treeObjectAdapter: ITreeObjectAdapter,
        private pageEditorContext: PageEditorDesignerContext,
        private transformer: ITransformer<ITreeObjectAdapter, EditorObject>
    ) {}

    get object() {
        return this.treeObjectAdapter.object as Page | Widget;
    }

    get id() {
        return getId(this.object);
    }

    @computed
    get rect() {
        return this.object;
    }

    set rect(value: Rect) {
        getProjectStore(this.treeObjectAdapter.object).updateObject(this.object, {
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

        return _map(childrenObjects, (object: ITreeObjectAdapter) =>
            this.transformer(object)
        );
    }

    get isMoveable() {
        if (this.object instanceof Widget) {
            return this.object.isMoveable;
        }
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

    resizeColumn(
        columnIndex: number,
        savedColumnWidth: number,
        offset: number
    ) {
        if (this.object instanceof Widget) {
            return this.object.resizeColumn(
                columnIndex,
                savedColumnWidth,
                offset
            );
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

    findObjectParent(editorObject: EditorObject): EditorObject | undefined {
        for (const child of this.children) {
            if (child.object === editorObject.object) {
                return this;
            }
            const parent = child.findObjectParent(editorObject);
            if (parent !== undefined) {
                return parent;
            }
        }
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable snapLines: SnapLines | undefined;
    pageEditorContext: PageEditorDesignerContext | undefined;
    dragWidget: Widget | undefined;

    start(pageEditorContext: PageEditorDesignerContext) {
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
        return dragSnapLines.dragWidget!;
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
        pageEditorContext
    }: {
        page: Page;
        pageEditorContext: PageEditorDesignerContext;
    }) => {
        return pageEditorContext.dragWidget ? (
            <WidgetComponent
                widget={pageEditorContext.dragWidget}
                left={page.left + pageEditorContext.dragWidget.left}
                top={page.top + pageEditorContext.dragWidget.top}
                dataContext={getProjectStore(page).dataContext}
            />
        ) : null;
    }
);

////////////////////////////////////////////////////////////////////////////////

class PageEditorDesignerContext extends DesignerContext {
    @observable dragWidget: Widget | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class PageDocument implements IDocument {
    constructor(
        private page: ITreeObjectAdapter,
        private pageEditorContext: PageEditorDesignerContext
    ) {}

    @computed
    get rootObject() {
        const transformer = createObjectToEditorObjectTransformer(
            this.pageEditorContext
        );
        return transformer(this.page);
    }

    get rootObjects() {
        return [this.rootObject];
    }

    findObjectById(id: string) {
        return this.rootObject.findObjectById(id);
    }

    findObjectParent(object: EditorObject) {
        if (object.object === this.rootObject.object) {
            return undefined;
        }
        return this.rootObject.findObjectParent(object);
    }

    createObject(params: any) {
        // TODO ???
    }

    deleteObjects(objects: EditorObject[]) {
        deleteItems(objects.map(editorObject => editorObject.object));
    }

    objectFromPoint(point: Point) {
        const id = getObjectIdFromPoint(
            this,
            this.pageEditorContext.viewState,
            point
        );
        if (!id) {
            return undefined;
        }
        return this.findObjectById(id);
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
        const ids = getObjectIdsInsideRect(
            this.pageEditorContext.viewState,
            rect
        );

        const editorObjectsGroupedByParent = new Map<
            IEezObject,
            EditorObject[]
        >();
        let maxLengthGroup: EditorObject[] | undefined;

        ids.forEach(id => {
            const editorObject = this.findObjectById(id);
            if (editorObject) {
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

    createContextMenu(objects: IBaseObject[]) {
        return this.page.createSelectionContextMenu();
    }

    onDragStart(op: "move" | "resize"): void {
        getProjectStore(this.page.object).UndoManager.setCombineCommands(true);
    }

    onDragEnd(
        op: "move" | "resize",
        changed: boolean,
        objects: IBaseObject[]
    ): void {
        getProjectStore(this.page.object).UndoManager.setCombineCommands(false);
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

const PageEditorCanvas = styled(Canvas)`
    position: absolute;
    width: 100%;
    height: 100%;
`;

interface PageEditorProps {
    widgetContainer: ITreeObjectAdapter;
    onFocus?: () => void;
    pageRect?: Rect;
}

@observer
export class PageEditor
    extends React.Component<PageEditorProps, { hasError: boolean }>
    implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>

    pageEditorContext: PageEditorDesignerContext = new PageEditorDesignerContext();
    currentWidgetContainer?: ITreeObjectAdapter;

    @observable pageDocument: PageDocument;

    @observable options: IDesignerOptions;

    constructor(props: PageEditorProps) {
        super(props);

        this.state = { hasError: false };

        this.updatePageDocument();
    }

    @action
    updatePageDocument() {
        if (this.props.widgetContainer != this.currentWidgetContainer) {
            this.currentWidgetContainer = this.props.widgetContainer;

            this.pageDocument = new PageDocument(
                this.props.widgetContainer,
                this.pageEditorContext
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
            this.pageEditorContext.set(
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
    filterSnapLines(node: IBaseObject) {
        const object = (node as EditorObject).object;
        if (!object) {
            return false;
        }

        const selectedObjects = this.pageEditorContext.viewState
            .selectedObjects;

        for (let i = 0; i < selectedObjects.length; ++i) {
            const selectedObject = (selectedObjects[i] as EditorObject).object;

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
        const selectedObject =
            this.pageEditorContext.viewState.selectedObjects.length === 1 &&
            this.pageEditorContext.viewState.selectedObjects[0];

        if (selectedObject) {
            return (selectedObject as EditorObject).object;
        }

        return undefined;
    }

    @computed
    get selectedObjects() {
        return this.pageEditorContext.viewState.selectedObjects.map(
            selectedObject => selectedObject.object
        );
    }

    cutSelection() {
        console.error("TODO cutSelection");
    }

    copySelection() {
        console.error("TODO copySelection");
    }

    pasteSelection() {
        console.error("TODO pasteSelection");
    }

    deleteSelection() {
        console.error("TODO deleteSelection");
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
            transform,
            selectedObjects: this.props.widgetContainer.selectedItems.map(
                item => getId(item.object)
            )
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

            // selection changed in Editor => change selection in Tree
            this.props.widgetContainer.selectObjectIds(
                viewState.selectedObjects
            );
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

            if (!this.pageEditorContext.dragWidget) {
                this.pageEditorContext.dragWidget = widget;
                setParent(this.pageEditorContext.dragWidget, page.widgets);

                this.pageEditorContext.viewState.selectObjects([
                    this.pageEditorContext.document.findObjectById(
                        "WidgetPaletteItem"
                    )!
                ]);

                dragSnapLines.start(this.pageEditorContext);
            }

            dragSnapLines.snapLines!.enabled = !event.shiftKey;

            const transform = this.pageEditorContext.viewState.transform;

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
        if (this.pageEditorContext.dragWidget) {
            const page = this.props.widgetContainer.object as Page;

            const object = this.context.addObject(
                page.widgets,
                toJS(this.pageEditorContext.dragWidget)
            );

            this.pageEditorContext.dragWidget = undefined;
            dragSnapLines.clear();

            setTimeout(() => {
                const objectAdapter = this.pageEditorContext.document.findObjectById(
                    getId(object)
                );
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
            this.pageEditorContext.dragWidget.left = 0;
            this.pageEditorContext.dragWidget.top = 0;
            this.pageEditorContext.dragWidget = undefined;

            // deselect dragWidget
            this.pageEditorContext.viewState.deselectAllObjects();

            dragSnapLines.clear();
        }
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.altKey) {
        } else if (event.shiftKey) {
            if (event.keyCode == 36) {
                // home
                this.pageEditorContext.viewState.moveSelection("home-y");
            } else if (event.keyCode == 35) {
                // end
                this.pageEditorContext.viewState.moveSelection("end-y");
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
            this.pageEditorContext.viewState.deselectAllObjects();
        } else if (event.keyCode == 37) {
            // left
            this.pageEditorContext.viewState.moveSelection("left");
        } else if (event.keyCode == 38) {
            // up
            this.pageEditorContext.viewState.moveSelection("up");
        } else if (event.keyCode == 39) {
            // right
            this.pageEditorContext.viewState.moveSelection("right");
        } else if (event.keyCode == 40) {
            // down
            this.pageEditorContext.viewState.moveSelection("down");
        } else if (event.keyCode == 36) {
            // home
            this.pageEditorContext.viewState.moveSelection("home-x");
        } else if (event.keyCode == 35) {
            // end
            this.pageEditorContext.viewState.moveSelection("end-x");
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

        const { onFocus } = this.props;

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
                                <WidgetComponent
                                    widget={this.page}
                                    dataContext={
                                        getProjectStore(
                                            this.props.widgetContainer.object
                                        ).dataContext
                                    }
                                />
                            </div>
                        }
                        <DragWidget
                            page={this.page}
                            pageEditorContext={this.pageEditorContext}
                        />
                    </PageEditorCanvas>
                </PageEditorCanvasContainer>
            </Provider>
        );
    }
}
