import { Point, Rect, ITransform, Transform } from "eez-studio-shared/geometry";

export interface IContextMenuItem {
    label: string;
    click: () => void;
}

export interface IContextMenuPopupOptions {}

export interface IContextMenu {
    appendMenuItem(menuItem: IContextMenuItem): void;
    popup(config: IContextMenuPopupOptions): void;
}

export interface IBaseObject {
    id: string;
    rect: Rect;
    boundingRect: Rect;
    selectionRects: Rect[];
    isResizable?: boolean;
    open(): void;
}

export interface IDocument {
    findObjectById(id: string): IBaseObject | undefined;

    // modify
    createObject(params: any): void;
    deleteObjects(objects: IBaseObject[]): void;

    // view
    objectFromPoint(point: Point): IBaseObject | undefined;
    getObjectsInsideRect(rect: Rect): IBaseObject[];
    resetTransform?(transform: ITransform): void;

    // misc.
    createContextMenu(objects: IBaseObject[]): IContextMenu;

    // events
    onDragStart(op: "move" | "resize"): void;
    onDragEnd(op: "move" | "resize", changed: boolean, objects: IBaseObject[]): void;
}

export interface IViewState {
    transform: Transform;
    resetTransform(): void;

    // true if there is no active user interaction (like mouse) with the designer.
    isIdle: boolean;

    // selection
    selectedObjects: IBaseObject[];
    isSelectionResizable: boolean;
    selectedObjectsBoundingRect: Rect | undefined;

    isObjectSelected(object: IBaseObject): boolean;

    selectObject(object: IBaseObject): void;
    selectObjects(objects: IBaseObject[]): void;
    deselectAllObjects(): void;

    persistentState: IViewStatePersistantState;
}

export interface IDesignerOptions {
    center?: Point;
}

export interface IDesignerContext {
    document: IDocument;
    viewState: IViewState;
    options: IDesignerOptions;
}

export interface IViewStatePersistantState {
    transform: ITransform;
    selectedObjects: string[];
}

export interface IToolbarButton {
    id: string;
    label: string;
    title: string;
    className?: string;
    onClick: (context: IDesignerContext) => void;
}

export interface IMouseHandler {
    cursor: string;
    down(context: IDesignerContext, event: MouseEvent): void;
    move(context: IDesignerContext, event: MouseEvent): void;
    up(context: IDesignerContext, event?: MouseEvent): void;
    renderInSelectionLayer?(): React.ReactNode;
}

export interface IToolHandler {
    render(context: IDesignerContext, mouseHandler: IMouseHandler | undefined): React.ReactNode;

    onClick(context: IDesignerContext, point: Point): void;

    onContextMenu(
        context: IDesignerContext,
        point: Point,
        showContextMenu: (menu: IContextMenu) => void
    ): void;

    cursor: string;

    canDrag: boolean;
    drop(context: IDesignerContext, point: Point): void;

    createMouseHandler(context: IDesignerContext, event: MouseEvent): IMouseHandler | undefined;
}
