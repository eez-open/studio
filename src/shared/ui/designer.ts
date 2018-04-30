import { Point, Rect } from "shared/geometry";
import { beginTransaction, commitTransaction } from "shared/store";
import { IBaseObject } from "shared/model/base-object";

////////////////////////////////////////////////////////////////////////////////

export interface ICanvas {
    createObject(type: string, oid: string, rect: Rect): void;

    // toolbox
    selectDefaultTool(): void;

    // selection
    selectedObjects: IBaseObject[];
    deselectAllObjects(): void;
    selectObject(object: IBaseObject): void;
    deleteSelectedObjects(): void;
    setRubberBendRect(rect: Rect | undefined): void;
    selectObjectsInsideRect(rect: Rect): void;
    showSelection(): void;
    hideSelection(): void;
    selectedObjectsBoundingRect: Rect | undefined;

    // view
    centerPoint: Point;
    translateBy(translate: Point): void;
    mouseEventToOffsetPoint(event: MouseEvent): Point;
    mouseEventToModelPoint(event: MouseEvent): Point;
    offsetToModelRect(rect: Rect): Rect;
    objectFromPoint(point: Point): IBaseObject | undefined;
    getScale(): number;
}

export interface IToolbarButton {
    id: string;
    label: string;
    title: string;
    className?: string;
    onClick: (canvas: ICanvas) => void;
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

export interface IToolHandler {
    onClick(canvas: ICanvas, point: Point): void;
    onContextMenu(
        canvas: ICanvas,
        point: Point,
        showContextMenu: (menu: Electron.Menu) => void
    ): void;

    cursor: string;

    canDrag: boolean;
    drop(canvas: ICanvas, point: Point): void;

    createMouseHandler(canvas: ICanvas, event: MouseEvent): MouseHandler | undefined;
}

export interface IToolboxGroup {
    id: string;
    label: string | undefined;
    title: string;
    tools: ITool[];
}

////////////////////////////////////////////////////////////////////////////////

export class MouseHandler {
    constructor() {}

    offsetPointAtDown: Point;
    lastOffsetPoint: Point;
    offsetDistance: Point;
    movement: Point;

    modelPointAtDown: Point;
    lastModelPoint: Point;

    cursor: string = "default";

    down(canvas: ICanvas, event: MouseEvent) {
        event.preventDefault();

        this.lastOffsetPoint = this.offsetPointAtDown = canvas.mouseEventToOffsetPoint(event);
        this.offsetDistance = { x: 0, y: 0 };
        this.movement = { x: 0, y: 0 };

        this.modelPointAtDown = canvas.mouseEventToModelPoint(event);
    }

    move(canvas: ICanvas, event: MouseEvent) {
        event.preventDefault();

        let offsetPoint = canvas.mouseEventToOffsetPoint(event);

        this.offsetDistance = {
            x: offsetPoint.x - this.offsetPointAtDown.x,
            y: offsetPoint.y - this.offsetPointAtDown.y
        };

        this.movement = {
            x: offsetPoint.x - this.lastOffsetPoint.x,
            y: offsetPoint.y - this.lastOffsetPoint.y
        };

        this.lastOffsetPoint = offsetPoint;

        this.lastModelPoint = canvas.mouseEventToModelPoint(event);
    }

    up(canvas: ICanvas, event?: MouseEvent) {
        if (event) {
            this.move(canvas, event);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export function createCreateObjectToolHandler(
    label: string,
    createObjectCallback: () => { type: string; oid: string; rect: Rect }
): IToolHandler {
    function createObject(canvas: ICanvas, point: Point) {
        beginTransaction(label);
        let { type, oid, rect } = createObjectCallback();
        canvas.createObject(type, oid, {
            left: point.x - rect.width / 2,
            top: point.y - rect.height / 2,
            width: rect.width,
            height: rect.height
        });
        commitTransaction();
    }

    return {
        onClick(canvas: ICanvas, point: Point) {
            createObject(canvas, point);
        },

        onContextMenu(canvas: ICanvas, point: Point): void {},

        cursor: "crosshair",

        canDrag: true,

        drop(canvas: ICanvas, point: Point) {
            createObject(canvas, point);
        },

        createMouseHandler(canvas: ICanvas, event: MouseEvent) {
            return undefined;
        }
    };
}
