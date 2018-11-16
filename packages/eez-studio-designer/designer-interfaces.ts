import { Point, Rect, Transform } from "eez-studio-shared/geometry";

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
    selectionRects: Rect[];
    selected: boolean;
    open(): void;
}

export interface IDocument {
    createObject(params: any): void;

    // selection
    selectedObjects: IBaseObject[];
    selectionResizable: boolean;
    selectedObjectsBoundingRect: Rect | undefined;

    selectObject(object: IBaseObject): void;
    selectObjectsInsideRect(rect: Rect): void;
    deselectAllObjects(): void;

    deleteSelectedObjects(): void;

    // events
    onDragStart(op: "move" | "resize"): void;
    onDragEnd(op: "move" | "resize", changed: boolean): void;

    // view
    objectFromPoint(point: Point): IBaseObject | undefined;

    // misc.
    createContextMenu(): IContextMenu;
}

export interface IViewState {
    transform: Transform;
    resetTransform(): void;

    // true if there is no active user interaction (like mouse) with the designer.
    isIdle: boolean;
}

export interface IDesignerContext {
    document: IDocument;
    viewState: IViewState;
}

export interface IViewStatePersistanceHandler {
    load(): any;
    save(viewState: any): void;
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
