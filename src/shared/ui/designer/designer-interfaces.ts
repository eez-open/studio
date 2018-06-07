import { Point, Rect, Transform } from "shared/geometry";

////////////////////////////////////////////////////////////////////////////////

export interface IBaseObject {
    id: string;
    rect: Rect;
    selectionRects: Rect[];
    selected: boolean;
    open(): void;
}

export interface IDocument {
    transform: Transform;
    resetTransform(): void;

    createObject(params: any): void;

    // toolbox
    selectDefaultTool(): void;

    // selection
    selectedObjects: IBaseObject[];
    selectionVisible: boolean;
    selectionResizable: boolean;
    rubberBendRect: Rect | undefined;
    selectedObjectsBoundingRect: Rect | undefined;

    selectObject(object: IBaseObject): void;
    selectObjectsInsideRect(rect: Rect): void;
    deselectAllObjects(): void;

    deleteSelectedObjects(): void;

    onDragStart(op: "move" | "resize"): void;
    onDragEnd(op: "move" | "resize", changed: boolean): void;

    initContextMenu(menu: Electron.Menu): void;

    // view
    objectFromPoint(point: Point): IBaseObject | undefined;
}

export interface IToolbarButton {
    id: string;
    label: string;
    title: string;
    className?: string;
    onClick: (document: IDocument) => void;
}

export interface ITool {
    id: string;
    icon: string;
    iconSize: number;
    label: string | undefined;
    title: string;
    selected: boolean;
    toolHandler: IToolHandler;
}

export interface IMouseHandler {
    cursor: string;
    down(document: IDocument, event: MouseEvent): void;
    move(document: IDocument, event: MouseEvent): void;
    up(document: IDocument, event?: MouseEvent): void;
}

export interface IToolHandler {
    onClick(document: IDocument, point: Point): void;
    onContextMenu(
        document: IDocument,
        point: Point,
        showContextMenu: (menu: Electron.Menu) => void
    ): void;

    cursor: string;

    canDrag: boolean;
    drop(document: IDocument, point: Point): void;

    createMouseHandler(document: IDocument, event: MouseEvent): IMouseHandler | undefined;
}

export interface IToolboxGroup {
    id: string;
    label: string | undefined;
    title: string;
    tools: ITool[];
}
