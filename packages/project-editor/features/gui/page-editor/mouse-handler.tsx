import React from "react";
import { observable, action, runInAction } from "mobx";

import { Point, Rect, rectEqual, rectClone } from "eez-studio-shared/geometry";
import {
    ISnapLines,
    findSnapLines,
    findClosestHorizontalSnapLinesToPosition,
    findClosestVerticalSnapLinesToPosition,
    drawSnapLinesGeneric
} from "project-editor/features/gui/page-editor/snap-lines";
import { addAlphaToColor } from "eez-studio-shared/color";

import { theme } from "eez-studio-ui/theme";

import type {
    IDesignerContext,
    IMouseHandler,
    IPointerEvent
} from "project-editor/features/gui/page-editor/designer-interfaces";
import {
    getObjectBoundingRect,
    getSelectedObjectsBoundingRect,
    getObjectIdFromPoint
} from "project-editor/features/gui/page-editor/bounding-rects";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { Transform } from "project-editor/features/gui/page-editor/transform";

const SNAP_LINES_DRAW_THEME = {
    lineColor: "rgba(128, 128, 128, 1)",
    lineWidth: 0.5,
    closestLineColor: "rgba(0, 255, 0, 1)",
    closestLineWidth: 1
};
const CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME = 300;

const CONNECTION_LINE_DRAW_THEME = {
    lineColor: "rgba(128, 128, 128, 1)",
    lineWidth: 2.0,
    connectedLineColor: "rgba(0, 255, 0, 1)",
    connectedLineWidth: 2.0
};

export class MouseHandler implements IMouseHandler {
    constructor() {}

    timeAtDown: number;
    elapsedTime: number;

    offsetPointAtDown: Point;
    lastOffsetPoint: Point;
    offsetDistance: Point;
    movement: Point;
    distance: number;

    modelPointAtDown: Point;
    lastModelPoint: Point;

    cursor: string = "default";

    transform: Transform;

    lastPointerEvent!: IPointerEvent;

    down(context: IDesignerContext, event: IPointerEvent) {
        this.transform = context.viewState.transform;

        this.timeAtDown = new Date().getTime();

        this.lastOffsetPoint = this.offsetPointAtDown = this.transform.pointerEventToOffsetPoint(
            event
        );
        this.offsetDistance = { x: 0, y: 0 };
        this.distance = 0;
        this.movement = { x: 0, y: 0 };

        this.modelPointAtDown = this.transform.pointerEventToPagePoint(event);
    }

    move(context: IDesignerContext, event: IPointerEvent) {
        this.transform = context.viewState.transform;

        this.elapsedTime = new Date().getTime() - this.timeAtDown;

        let offsetPoint = this.transform.pointerEventToOffsetPoint(event);

        this.offsetDistance = {
            x: offsetPoint.x - this.offsetPointAtDown.x,
            y: offsetPoint.y - this.offsetPointAtDown.y
        };

        this.distance = Math.sqrt(
            this.offsetDistance.x * this.offsetDistance.x +
                this.offsetDistance.y * this.offsetDistance.y
        );

        this.movement = {
            x: offsetPoint.x - this.lastOffsetPoint.x,
            y: offsetPoint.y - this.lastOffsetPoint.y
        };

        this.lastOffsetPoint = offsetPoint;

        this.lastModelPoint = this.transform.pointerEventToPagePoint(event);
    }

    up(context: IDesignerContext) {}

    onTransformChanged(context: IDesignerContext) {
        const transform = context.viewState.transform;

        let point = this.transform.offsetToPagePoint(this.offsetPointAtDown);
        this.offsetPointAtDown = transform.pageToOffsetPoint(point);

        point = this.transform.offsetToPagePoint(this.lastOffsetPoint);
        this.lastOffsetPoint = transform.pageToOffsetPoint(point);

        this.offsetDistance = {
            x: this.lastOffsetPoint.x - this.offsetPointAtDown.x,
            y: this.lastOffsetPoint.y - this.offsetPointAtDown.y
        };

        this.distance = Math.sqrt(
            this.offsetDistance.x * this.offsetDistance.x +
                this.offsetDistance.y * this.offsetDistance.y
        );

        this.modelPointAtDown = transform.offsetToPagePoint(
            this.offsetPointAtDown
        );
        this.lastModelPoint = transform.offsetToPagePoint(this.lastOffsetPoint);

        this.movement = {
            x: 0,
            y: 0
        };

        const pointerEvent = Object.assign({}, this.lastPointerEvent);

        point = this.transform.clientToPagePoint({
            x: pointerEvent.clientX,
            y: pointerEvent.clientY
        });
        const clientPoint = transform.pageToClientPoint(point);
        pointerEvent.movementX = clientPoint.x - pointerEvent.clientX;
        pointerEvent.movementY = clientPoint.y - pointerEvent.clientY;
        pointerEvent.clientX = clientPoint.x;
        pointerEvent.clientY = clientPoint.y;

        this.transform = transform;

        this.move(context, pointerEvent);
    }
}

export class PanMouseHandler extends MouseHandler {
    totalMovement = {
        x: 0,
        y: 0
    };

    cursor = "default";

    down(context: IDesignerContext, event: IPointerEvent) {
        super.down(context, event);
    }

    move(context: IDesignerContext, event: IPointerEvent) {
        super.move(context, event);
        context.viewState.transform.translateBy(this.movement);
        this.totalMovement.x += this.movement.x;
        this.totalMovement.y += this.movement.y;
    }
}

export function isSelectionMoveable(context: IDesignerContext) {
    return !context.viewState.selectedObjects.find(
        object => !object.isMoveable
    );
}

export class RubberBandSelectionMouseHandler extends MouseHandler {
    @observable rubberBendRect: Rect | undefined;

    down(context: IDesignerContext, event: IPointerEvent) {
        super.down(context, event);
        context.viewState.deselectAllObjects();
    }

    @action
    move(context: IDesignerContext, event: IPointerEvent) {
        super.move(context, event);

        let left;
        let top;
        let width;
        let height;

        if (this.offsetPointAtDown.x < this.lastOffsetPoint.x) {
            left = this.offsetPointAtDown.x;
            width = this.lastOffsetPoint.x - this.offsetPointAtDown.x;
        } else {
            left = this.lastOffsetPoint.x;
            width = this.offsetPointAtDown.x - this.lastOffsetPoint.x;
        }

        if (this.offsetPointAtDown.y < this.lastOffsetPoint.y) {
            top = this.offsetPointAtDown.y;
            height = this.lastOffsetPoint.y - this.offsetPointAtDown.y;
        } else {
            top = this.lastOffsetPoint.y;
            height = this.offsetPointAtDown.y - this.lastOffsetPoint.y;
        }

        const rubberBendRect = {
            left,
            top,
            width,
            height
        };

        this.rubberBendRect = rubberBendRect;

        context.viewState.selectObjects(
            context.document.getObjectsInsideRect(
                context.viewState.transform.offsetToPageRect(rubberBendRect)
            )
        );
    }

    up(context: IDesignerContext) {
        super.up(context);

        runInAction(() => {
            this.rubberBendRect = undefined;
        });
    }

    render(context: IDesignerContext) {
        return (
            this.rubberBendRect && (
                <div
                    className="EezStudio_DesignerSelection_RubberBend"
                    style={{
                        position: "absolute",
                        left: this.rubberBendRect.left,
                        top: this.rubberBendRect.top,
                        width: this.rubberBendRect.width,
                        height: this.rubberBendRect.height,
                        backgroundColor: addAlphaToColor(
                            theme.selectionBackgroundColor,
                            0.5
                        ),
                        border: `1px solid ${theme.selectionBackgroundColor}`
                    }}
                />
            )
        );
    }
}

export class SnapLines {
    lines: ISnapLines;
    enabled: boolean = false;

    find(
        context: IDesignerContext,
        filterSnapLines?: (node: ITreeObjectAdapter) => boolean
    ) {
        this.lines = findSnapLines(
            context,
            {
                id: "",
                children: [context.document.page]
            } as ITreeObjectAdapter,
            filterSnapLines || context.filterSnapLines
        );
    }

    dragSnap(left: number, top: number, width: number, height: number) {
        if (this.enabled) {
            let lines1 = findClosestVerticalSnapLinesToPosition(
                this.lines,
                left
            );
            let lines2 = findClosestVerticalSnapLinesToPosition(
                this.lines,
                left + width
            );

            if (lines1 && (!lines2 || lines1.diff <= lines2.diff)) {
                left = lines1.lines[0].pos;
            } else if (lines2) {
                left = lines2.lines[0].pos - width;
            }

            lines1 = findClosestHorizontalSnapLinesToPosition(this.lines, top);
            lines2 = findClosestHorizontalSnapLinesToPosition(
                this.lines,
                top + height
            );

            if (lines1 && (!lines2 || lines1.diff <= lines2.diff)) {
                top = lines1.lines[0].pos;
            } else if (lines2) {
                top = lines2.lines[0].pos - height;
            }
        }

        return {
            left,
            top
        };
    }

    render(context: IDesignerContext, selectionRect: Rect) {
        if (!this.enabled) {
            return null;
        }

        const transform = context.viewState.transform;

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        const lines: JSX.Element[] = [];

        const lineStyle = {
            stroke: SNAP_LINES_DRAW_THEME.lineColor,
            strokeWidth: SNAP_LINES_DRAW_THEME.lineWidth
        };
        const closestLineStyle = {
            stroke: SNAP_LINES_DRAW_THEME.closestLineColor,
            strokeWidth: SNAP_LINES_DRAW_THEME.closestLineWidth
        };

        drawSnapLinesGeneric(
            context,
            this.lines,
            selectionRect,
            (pos: number, horizontal: boolean, closest: boolean) => {
                const point = transform.pageToOffsetPoint({
                    x: pos,
                    y: pos
                });

                const key = pos + horizontal.toString() + closest.toString();

                if (horizontal) {
                    lines.push(
                        <line
                            key={key}
                            x1={offsetRect.left}
                            y1={point.y}
                            x2={offsetRect.left + offsetRect.width}
                            y2={point.y}
                            style={closest ? closestLineStyle : lineStyle}
                        />
                    );
                } else {
                    lines.push(
                        <line
                            key={key}
                            x1={point.x}
                            y1={offsetRect.top}
                            x2={point.x}
                            y2={offsetRect.top + offsetRect.height}
                            style={closest ? closestLineStyle : lineStyle}
                        />
                    );
                }
            }
        );

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                {lines}
            </svg>
        );
    }
}

class MouseHandlerWithSnapLines extends MouseHandler {
    snapLines = new SnapLines();

    down(context: IDesignerContext, event: IPointerEvent) {
        super.down(context, event);

        this.snapLines.find(context);
    }

    move(context: IDesignerContext, event: IPointerEvent) {
        super.move(context, event);

        this.snapLines.enabled =
            !event.shiftKey &&
            this.elapsedTime > CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME;
    }

    render(context: IDesignerContext) {
        const rect = getSelectedObjectsBoundingRect(context.viewState);
        rect.left += context.viewState.dxMouseDrag ?? 0;
        rect.top += context.viewState.dyMouseDrag ?? 0;
        return this.snapLines.render(context, rect);
    }
}

export class DragMouseHandler extends MouseHandlerWithSnapLines {
    changed: boolean = false;
    rects: Rect[] = [];

    selectionBoundingRectAtDown: Rect;
    objectPositionsAtDown: Point[];

    left: number;
    top: number;

    selectionNode: HTMLElement;
    objectNodes: HTMLElement[];

    down(context: IDesignerContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        this.selectionBoundingRectAtDown = rectClone(
            getSelectedObjectsBoundingRect(context.viewState)
        );

        this.objectPositionsAtDown = context.viewState.selectedObjects.map(
            object => ({
                x: object.rect.left,
                y: object.rect.top
            })
        );

        this.left = this.selectionBoundingRectAtDown.left;
        this.top = this.selectionBoundingRectAtDown.top;
    }

    @action
    move(context: IDesignerContext, event: IPointerEvent) {
        super.move(context, event);

        if (this.elapsedTime < 100 && this.distance < 20) {
            return;
        }

        this.left += this.movement.x / context.viewState.transform.scale;
        this.top += this.movement.y / context.viewState.transform.scale;

        const { left, top } = this.snapLines.dragSnap(
            this.left,
            this.top,
            this.selectionBoundingRectAtDown.width,
            this.selectionBoundingRectAtDown.height
        );

        const viewState = context.viewState;

        viewState.dxMouseDrag = left - this.selectionBoundingRectAtDown.left;
        viewState.dyMouseDrag = top - this.selectionBoundingRectAtDown.top;

        if (!this.selectionNode) {
            const container = document.getElementById(
                context.viewState.containerId
            );

            this.selectionNode = container?.querySelector(
                ".EezStudio_DesignerSelection_Draggable"
            ) as HTMLElement;

            this.objectNodes = context.viewState.selectedObjects.map(
                selectedObject =>
                    container?.querySelector(
                        `[data-designer-object-id="${selectedObject.id}"]`
                    ) as HTMLElement
            );
        }

        this.selectionNode.style.transform = `translate(${Math.round(
            viewState.dxMouseDrag * context.viewState.transform.scale
        )}px, ${Math.round(
            viewState.dyMouseDrag * context.viewState.transform.scale
        )}px)`;

        this.changed = false;

        for (let i = 0; i < context.viewState.selectedObjects.length; ++i) {
            const object = context.viewState.selectedObjects[i];

            this.rects[i] = {
                left: Math.round(
                    this.objectPositionsAtDown[i].x + viewState.dxMouseDrag
                ),
                top: Math.round(
                    this.objectPositionsAtDown[i].y + viewState.dyMouseDrag
                ),
                width: object.rect.width,
                height: object.rect.height
            };

            if (!rectEqual(this.rects[i], object.rect)) {
                this.changed = true;
            }

            const node = this.objectNodes[i];
            node.style.left = this.rects[i].left + "px";
            node.style.top = this.rects[i].top + "px";
        }
    }

    @action
    up(context: IDesignerContext) {
        super.up(context);

        if (this.changed) {
            for (let i = 0; i < context.viewState.selectedObjects.length; ++i) {
                const object = context.viewState.selectedObjects[i];
                const rect = this.rects[i];
                if (!rectEqual(rect, object.rect)) {
                    object.rect = rect;
                }
            }
        }

        if (this.selectionNode) {
            this.selectionNode.style.transform = ``;
        }

        context.viewState.dxMouseDrag = undefined;
        context.viewState.dyMouseDrag = undefined;

        context.document.onDragEnd();
    }
}

type ResizeHandleType =
    | "nw-resize"
    | "n-resize"
    | "ne-resize"
    | "w-resize"
    | "e-resize"
    | "sw-resize"
    | "s-resize"
    | "se-resize";

export class ResizeMouseHandler extends MouseHandlerWithSnapLines {
    savedBoundingRect: Rect;
    boundingRect: Rect;

    savedBoundingRects: Rect[];
    savedRects: Rect[];
    rects: Rect[];

    changed: boolean = false;

    constructor(private handleType: ResizeHandleType) {
        super();
    }

    down(context: IDesignerContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        this.savedBoundingRect = rectClone(
            getSelectedObjectsBoundingRect(context.viewState)
        );
        this.boundingRect = rectClone(this.savedBoundingRect);

        this.savedBoundingRects = [];
        this.savedRects = [];
        this.rects = [];
        for (const object of context.viewState.selectedObjects) {
            const boundingRect = getObjectBoundingRect(object);
            if (boundingRect) {
                this.savedBoundingRects.push(rectClone(boundingRect));

                const rect = object.rect;
                this.savedRects.push(rectClone(rect));
                this.rects.push(rectClone(rect));
            }
        }
    }

    snapX(x: number) {
        if (this.snapLines.enabled) {
            let lines = findClosestVerticalSnapLinesToPosition(
                this.snapLines.lines,
                x
            );
            return lines ? lines.lines[0].pos : x;
        } else {
            return x;
        }
    }

    snapY(y: number) {
        if (this.snapLines.enabled) {
            let lines = findClosestHorizontalSnapLinesToPosition(
                this.snapLines.lines,
                y
            );
            return lines ? lines.lines[0].pos : y;
        } else {
            return y;
        }
    }

    moveTop(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let bottom = rect.top + rect.height;
        rect.top = this.snapY(
            savedRect.top +
                this.offsetDistance.y / context.viewState.transform.scale
        );
        if (rect.top >= bottom) {
            rect.top = bottom - 1;
        }
        rect.height = bottom - rect.top;
    }

    moveLeft(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let right = rect.left + rect.width;
        rect.left = this.snapX(
            savedRect.left +
                this.offsetDistance.x / context.viewState.transform.scale
        );
        if (rect.left >= right) {
            rect.left = right - 1;
        }
        rect.width = right - rect.left;
    }

    moveBottom(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let bottom = this.snapY(
            savedRect.top +
                savedRect.height +
                this.offsetDistance.y / context.viewState.transform.scale
        );
        if (bottom <= rect.top) {
            bottom = rect.top + 1;
        }
        rect.height = bottom - rect.top;
    }

    moveRight(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let right = this.snapX(
            savedRect.left +
                savedRect.width +
                this.offsetDistance.x / context.viewState.transform.scale
        );
        if (right <= rect.left) {
            right = rect.left + 1;
        }
        rect.width = right - rect.left;
    }

    maintainSameAspectRatio(
        savedRect: Rect,
        rect: Rect,
        top: boolean,
        left: boolean
    ) {
        let startAspectRatio = savedRect.width / savedRect.height;

        let width;
        let height;

        if (rect.width / rect.height > startAspectRatio) {
            width = rect.height * startAspectRatio;
            height = rect.height;
        } else {
            width = rect.width;
            height = rect.width / startAspectRatio;
        }

        if (top) {
            rect.top += rect.height - height;
        }

        if (left) {
            rect.left += rect.width - width;
        }

        rect.width = width;
        rect.height = height;
    }

    resizeRect(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        if (this.handleType === "nw-resize") {
            this.moveTop(context, savedRect, rect);
            this.moveLeft(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, true, true);
        } else if (this.handleType === "n-resize") {
            this.moveTop(context, savedRect, rect);
        } else if (this.handleType === "ne-resize") {
            this.moveTop(context, savedRect, rect);
            this.moveRight(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, true, false);
        } else if (this.handleType === "w-resize") {
            this.moveLeft(context, savedRect, rect);
        } else if (this.handleType === "e-resize") {
            this.moveRight(context, savedRect, rect);
        } else if (this.handleType === "sw-resize") {
            this.moveBottom(context, savedRect, rect);
            this.moveLeft(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, false, true);
        } else if (this.handleType === "s-resize") {
            this.moveBottom(context, savedRect, rect);
        } else if (this.handleType === "se-resize") {
            this.moveBottom(context, savedRect, rect);
            this.moveRight(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, false, false);
        }
    }

    @action
    move(context: IDesignerContext, event: IPointerEvent) {
        super.move(context, event);

        this.resizeRect(context, this.savedBoundingRect, this.boundingRect);

        let scaleWidth = this.boundingRect.width / this.savedBoundingRect.width;
        let scaleHeight =
            this.boundingRect.height / this.savedBoundingRect.height;

        let objects = context.viewState.selectedObjects;

        for (let i = 0; i < this.rects.length; i++) {
            let savedBoundingRect = this.savedBoundingRects[i];
            let savedRect = this.savedRects[i];
            let rect = this.rects[i];

            rect.left = Math.floor(
                savedRect.left +
                    (this.boundingRect.left - this.savedBoundingRect.left) +
                    (savedBoundingRect.left - this.savedBoundingRect.left) *
                        (scaleWidth - 1)
            );
            rect.top = Math.floor(
                savedRect.top +
                    (this.boundingRect.top - this.savedBoundingRect.top) +
                    (savedBoundingRect.top - this.savedBoundingRect.top) *
                        (scaleHeight - 1)
            );
            rect.width = Math.floor(savedRect.width * scaleWidth);
            rect.height = Math.floor(savedRect.height * scaleHeight);

            if (!rectEqual(rect, objects[i].rect)) {
                this.changed = true;
                objects[i].rect = rect;
            }
        }
    }

    up(context: IDesignerContext) {
        super.up(context);

        context.document.onDragEnd();
    }
}

export class ConnectionLineMouseHandler extends MouseHandler {
    @observable startPoint: Point;
    @observable endPoint: Point;
    @observable.shallow target:
        | {
              objectId: string;
              connectionInput: string;
          }
        | undefined;

    constructor(
        private sourceObject: ITreeObjectAdapter,
        private connectionOutput: string
    ) {
        super();
    }

    @action
    down(context: IDesignerContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        this.connectionOutput;

        const container = document.getElementById(
            context.viewState.containerId
        )!;
        const node = container!.querySelector(
            `[data-designer-object-id="${this.sourceObject.id}"] [data-connection-output-id="${this.connectionOutput}"]`
        )!;

        const boundingClientRect = node.getBoundingClientRect();
        const pageRect = context.viewState.transform.clientToOffsetRect(
            boundingClientRect
        );

        this.startPoint = {
            x: pageRect.left + pageRect.width + 2,
            y: pageRect.top + pageRect.height / 2
        };

        this.endPoint = this.startPoint;
        this.target = undefined;
    }

    @action
    move(context: IDesignerContext, event: IPointerEvent) {
        super.move(context, event);

        const result = getObjectIdFromPoint(
            context.document,
            context.viewState,
            this.lastModelPoint
        );

        if (
            result &&
            result.connectionInput &&
            !context.document.connectionExists(
                this.sourceObject.id,
                this.connectionOutput,
                result.id,
                result.connectionInput
            )
        ) {
            const container = document.getElementById(
                context.viewState.containerId
            )!;
            const node = container!.querySelector(
                `[data-designer-object-id="${result.id}"] [data-connection-input-id="${result.connectionInput}"]`
            )!;

            const boundingClientRect = node.getBoundingClientRect();
            const pageRect = context.viewState.transform.clientToOffsetRect(
                boundingClientRect
            );

            this.endPoint = {
                x: pageRect.left - 2,
                y: pageRect.top + pageRect.height / 2
            };
            this.target = {
                objectId: result.id,
                connectionInput: result.connectionInput
            };
        } else {
            this.endPoint = this.lastOffsetPoint;
            this.target = undefined;
        }
    }

    up(context: IDesignerContext) {
        super.up(context);

        if (this.target) {
            context.document.connect(
                this.sourceObject.id,
                this.connectionOutput,
                this.target.objectId,
                this.target.connectionInput
            );
        }

        context.document.onDragEnd();
    }

    render(context: IDesignerContext) {
        const transform = context.viewState.transform;

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        const lineStyle = {
            stroke: CONNECTION_LINE_DRAW_THEME.lineColor,
            strokeWidth: CONNECTION_LINE_DRAW_THEME.lineWidth
        };
        const connectedLineStyle = {
            stroke: CONNECTION_LINE_DRAW_THEME.connectedLineColor,
            strokeWidth: CONNECTION_LINE_DRAW_THEME.connectedLineWidth
        };

        const line = (
            <line
                x1={this.startPoint.x}
                y1={this.startPoint.y}
                x2={this.endPoint.x}
                y2={this.endPoint.y}
                style={this.target ? connectedLineStyle : lineStyle}
            />
        );

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                {line}
            </svg>
        );
    }

    @action
    onTransformChanged(context: IDesignerContext) {
        const startClientPoint = this.transform.offsetToPagePoint(
            this.startPoint
        );
        this.startPoint = context.viewState.transform.pageToOffsetPoint(
            startClientPoint
        );

        super.onTransformChanged(context);
    }
}
