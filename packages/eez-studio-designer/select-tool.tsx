import React from "react";
import { observable, runInAction } from "mobx";

import { closestByClass } from "eez-studio-shared/dom";
import {
    Point,
    Rect,
    pointInRect,
    rectEqual,
    rectClone,
    Transform
} from "eez-studio-shared/geometry";
import {
    INode,
    ISnapLines,
    findSnapLines,
    findClosestHorizontalSnapLinesToPosition,
    findClosestVerticalSnapLinesToPosition,
    drawSnapLinesGeneric
} from "eez-studio-shared/snap-lines";

import { IMenu } from "eez-studio-shared/model/store";

import {
    IDesignerContext,
    IToolHandler,
    IMouseHandler
} from "eez-studio-designer/designer-interfaces";
import { MouseHandler } from "eez-studio-designer/mouse-handler";
import { Selection } from "eez-studio-designer/selection";

const SNAP_LINES_DRAW_THEME = {
    lineColor: "rgba(128, 128, 128, 1)",
    lineWidth: 0.5,
    closestLineColor: "rgba(0, 255, 0, 1)",
    closestLineWidth: 1
};
const CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME = 300;

// - select object with click
// - selection context menu
// - rubber band selection
// - move selection
// - resize selection

export const selectToolHandler: IToolHandler = {
    render(context: IDesignerContext, mouseHandler: IMouseHandler | undefined) {
        return <Selection context={context} mouseHandler={mouseHandler} />;
    },

    onClick(context: IDesignerContext, point: Point) {},

    onContextMenu(context: IDesignerContext, point: Point, showContextMenu: (menu: IMenu) => void) {
        if (
            context.viewState.selectedObjects.length === 0 ||
            !pointInRect(point, context.viewState.selectedObjectsBoundingRect)
        ) {
            context.viewState.deselectAllObjects();

            let object = context.document.objectFromPoint(point);
            if (!object || (object.isSelectable !== undefined && !object.isSelectable)) {
                return;
            }

            context.viewState.selectObject(object);
        }

        setTimeout(() => {
            const menu = context.document.createContextMenu(context.viewState.selectedObjects);
            if (menu) {
                showContextMenu(menu);
            }
        }, 0);
    },

    cursor: "default",

    canDrag: false,
    drop() {},

    createMouseHandler(context: IDesignerContext, event: MouseEvent) {
        if (closestByClass(event.target, "EezStudio_DesignerSelection_Handle")) {
            return new ResizeMouseHandler();
        }

        if (closestByClass(event.target, "EezStudio_DesignerSelection")) {
            return new DragMouseHandler();
        }

        let point = context.viewState.transform.mouseEventToModelPoint(event);
        let object = context.document.objectFromPoint(point);
        if (object && (object.isSelectable === undefined || object.isSelectable)) {
            if (!context.viewState.isObjectSelected(object)) {
                if (!event.ctrlKey && !event.shiftKey) {
                    context.viewState.deselectAllObjects();
                }
                context.viewState.selectObject(object);
            }
            return new DragMouseHandler();
        }

        return new RubberBandSelectionMouseHandler();
    }
};

export class RubberBandSelectionMouseHandler extends MouseHandler {
    @observable
    rubberBendRect: Rect | undefined;

    down(context: IDesignerContext, event: MouseEvent) {
        super.down(context, event);
        context.viewState.deselectAllObjects();
    }

    move(context: IDesignerContext, event: MouseEvent) {
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

        runInAction(() => {
            this.rubberBendRect = rubberBendRect;
        });

        context.viewState.selectObjects(
            context.document.getObjectsInsideRect(
                context.viewState.transform.offsetToModelRect(rubberBendRect)
            )
        );
    }

    up(context: IDesignerContext, event?: MouseEvent) {
        super.up(context, event);

        runInAction(() => {
            this.rubberBendRect = undefined;
        });
    }

    renderInSelectionLayer(context: IDesignerContext) {
        return (
            this.rubberBendRect && (
                <div
                    className="EezStudio_DesignerSelection_RubberBend"
                    style={{
                        left: this.rubberBendRect.left,
                        top: this.rubberBendRect.top,
                        width: this.rubberBendRect.width,
                        height: this.rubberBendRect.height
                    }}
                />
            )
        );
    }
}

export class SnapLines {
    lines: ISnapLines;
    enabled: boolean = false;

    find(context: IDesignerContext, filterCallback?: (node: INode) => boolean) {
        this.lines = findSnapLines(
            {
                id: "",
                children: context.document.rootObjects
            },
            context.viewState.selectedObjects,
            filterCallback
        );
    }

    dragSnap(left: number, top: number, width: number, height: number) {
        if (this.enabled) {
            let lines1 = findClosestVerticalSnapLinesToPosition(this.lines, left);
            let lines2 = findClosestVerticalSnapLinesToPosition(this.lines, left + width);

            if (lines1 && (!lines2 || lines1.diff <= lines2.diff)) {
                left = lines1.lines[0].pos;
            } else if (lines2) {
                left = lines2.lines[0].pos - width;
            }

            lines1 = findClosestHorizontalSnapLinesToPosition(this.lines, top);
            lines2 = findClosestHorizontalSnapLinesToPosition(this.lines, top + height);

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

    render(transform: Transform, selectionRect: Rect) {
        if (!this.enabled) {
            return null;
        }

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
            this.lines,
            selectionRect,
            (pos: number, horizontal: boolean, closest: boolean) => {
                const point = transform.modelToOffsetPoint({
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

    down(context: IDesignerContext, event: MouseEvent) {
        super.down(context, event);

        this.snapLines.find(context);
    }

    move(context: IDesignerContext, event: MouseEvent) {
        super.move(context, event);

        this.snapLines.enabled =
            !event.shiftKey && this.elapsedTime > CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME;
    }

    renderInSelectionLayer(context: IDesignerContext) {
        return this.snapLines.render(
            context.viewState.transform,
            context.viewState.selectedObjectsBoundingRect
        );
    }
}

export class DragMouseHandler extends MouseHandlerWithSnapLines {
    changed: boolean;

    selectionBoundingRectAtDown: Rect;
    objectPositionsAtDown: Point[];

    left: number;
    top: number;

    down(context: IDesignerContext, event: MouseEvent) {
        super.down(context, event);

        context.document.onDragStart("move");

        this.selectionBoundingRectAtDown = rectClone(context.viewState.selectedObjectsBoundingRect);

        this.objectPositionsAtDown = context.viewState.selectedObjects.map(object => ({
            x: object.rect.left,
            y: object.rect.top
        }));

        this.left = this.selectionBoundingRectAtDown.left;
        this.top = this.selectionBoundingRectAtDown.top;
    }

    move(context: IDesignerContext, event: MouseEvent) {
        super.move(context, event);

        this.left = Math.floor(this.left + this.movement.x / context.viewState.transform.scale);
        this.top = Math.floor(this.top + this.movement.y / context.viewState.transform.scale);

        const { left, top } = this.snapLines.dragSnap(
            this.left,
            this.top,
            this.selectionBoundingRectAtDown.width,
            this.selectionBoundingRectAtDown.height
        );

        for (let i = 0; i < context.viewState.selectedObjects.length; ++i) {
            const object = context.viewState.selectedObjects[i];

            let rect = {
                left:
                    this.objectPositionsAtDown[i].x +
                    (left - this.selectionBoundingRectAtDown.left),
                top: this.objectPositionsAtDown[i].y + (top - this.selectionBoundingRectAtDown.top),
                width: object.rect.width,
                height: object.rect.height
            };

            if (!rectEqual(rect, object.rect)) {
                this.changed = true;
                object.rect = rect;
            }
        }
    }

    up(context: IDesignerContext, event?: MouseEvent) {
        super.up(context, event);
        context.document.onDragEnd("move", this.changed, context.viewState.selectedObjects);
    }
}

enum HandleType {
    TopLeft,
    Top,
    TopRight,
    Left,
    Right,
    BottomLeft,
    Bottom,
    BottomRight
}

class ResizeMouseHandler extends MouseHandlerWithSnapLines {
    handleType: HandleType;

    savedBoundingRect: Rect;
    boundingRect: Rect;

    savedBoundingRects: Rect[];
    savedRects: Rect[];
    rects: Rect[];

    changed: boolean;

    down(context: IDesignerContext, event: MouseEvent) {
        super.down(context, event);

        context.document.onDragStart("resize");

        let className = (event.target as HTMLElement).className;
        if (className.indexOf("Corner") !== -1) {
            if (className.indexOf("TopLeft") !== -1) {
                this.handleType = HandleType.TopLeft;
            } else if (className.indexOf("TopRight") !== -1) {
                this.handleType = HandleType.TopRight;
            } else if (className.indexOf("BottomLeft") !== -1) {
                this.handleType = HandleType.BottomLeft;
            } else {
                this.handleType = HandleType.BottomRight;
            }
        } else {
            if (className.indexOf("Top") !== -1) {
                this.handleType = HandleType.Top;
            } else if (className.indexOf("Left") !== -1) {
                this.handleType = HandleType.Left;
            } else if (className.indexOf("Right") !== -1) {
                this.handleType = HandleType.Right;
            } else {
                this.handleType = HandleType.Bottom;
            }
        }

        this.savedBoundingRect = rectClone(context.viewState.selectedObjectsBoundingRect);
        this.boundingRect = rectClone(this.savedBoundingRect);

        this.savedBoundingRects = [];
        this.savedRects = [];
        this.rects = [];
        for (const object of context.viewState.selectedObjects) {
            const boundingRect = object.boundingRect;
            this.savedBoundingRects.push(rectClone(boundingRect));

            const rect = object.rect;
            this.savedRects.push(rectClone(rect));
            this.rects.push(rectClone(rect));
        }
    }

    snapX(x: number) {
        if (this.snapLines.enabled) {
            let lines = findClosestVerticalSnapLinesToPosition(this.snapLines.lines, x);
            return lines ? lines.lines[0].pos : x;
        } else {
            return x;
        }
    }

    snapY(y: number) {
        if (this.snapLines.enabled) {
            let lines = findClosestHorizontalSnapLinesToPosition(this.snapLines.lines, y);
            return lines ? lines.lines[0].pos : y;
        } else {
            return y;
        }
    }

    moveTop(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let bottom = rect.top + rect.height;
        rect.top = this.snapY(
            savedRect.top + this.offsetDistance.y / context.viewState.transform.scale
        );
        if (rect.top >= bottom) {
            rect.top = bottom - 1;
        }
        rect.height = bottom - rect.top;
    }

    moveLeft(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let right = rect.left + rect.width;
        rect.left = this.snapX(
            savedRect.left + this.offsetDistance.x / context.viewState.transform.scale
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

    maintainSameAspectRatio(savedRect: Rect, rect: Rect, top: boolean, left: boolean) {
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
        if (this.handleType === HandleType.TopLeft) {
            this.moveTop(context, savedRect, rect);
            this.moveLeft(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, true, true);
        } else if (this.handleType === HandleType.Top) {
            this.moveTop(context, savedRect, rect);
        } else if (this.handleType === HandleType.TopRight) {
            this.moveTop(context, savedRect, rect);
            this.moveRight(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, true, false);
        } else if (this.handleType === HandleType.Left) {
            this.moveLeft(context, savedRect, rect);
        } else if (this.handleType === HandleType.Right) {
            this.moveRight(context, savedRect, rect);
        } else if (this.handleType === HandleType.BottomLeft) {
            this.moveBottom(context, savedRect, rect);
            this.moveLeft(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, false, true);
        } else if (this.handleType === HandleType.Bottom) {
            this.moveBottom(context, savedRect, rect);
        } else {
            this.moveBottom(context, savedRect, rect);
            this.moveRight(context, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, false, false);
        }
    }

    move(context: IDesignerContext, event: MouseEvent) {
        super.move(context, event);

        this.resizeRect(context, this.savedBoundingRect, this.boundingRect);

        let scaleWidth = this.boundingRect.width / this.savedBoundingRect.width;
        let scaleHeight = this.boundingRect.height / this.savedBoundingRect.height;

        let objects = context.viewState.selectedObjects;

        for (let i = 0; i < this.rects.length; i++) {
            let savedBoundingRect = this.savedBoundingRects[i];
            let savedRect = this.savedRects[i];
            let rect = this.rects[i];

            rect.left = Math.floor(
                savedRect.left +
                    (this.boundingRect.left - this.savedBoundingRect.left) +
                    (savedBoundingRect.left - this.savedBoundingRect.left) * (scaleWidth - 1)
            );
            rect.top = Math.floor(
                savedRect.top +
                    (this.boundingRect.top - this.savedBoundingRect.top) +
                    (savedBoundingRect.top - this.savedBoundingRect.top) * (scaleHeight - 1)
            );
            rect.width = Math.floor(savedRect.width * scaleWidth);
            rect.height = Math.floor(savedRect.height * scaleHeight);

            if (!rectEqual(rect, objects[i].rect)) {
                this.changed = true;
                objects[i].rect = rect;
            }
        }
    }

    up(context: IDesignerContext, event?: MouseEvent) {
        super.up(context, event);

        context.document.onDragEnd("resize", this.changed, context.viewState.selectedObjects);
    }
}
