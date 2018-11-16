import React from "react";
import { observable, runInAction } from "mobx";

import { closestByClass } from "eez-studio-shared/dom";
import { Point, Rect, pointInRect, rectEqual } from "eez-studio-shared/geometry";

import {
    IDesignerContext,
    IToolHandler,
    IContextMenu,
    IMouseHandler
} from "eez-studio-designer/designer-interfaces";
import { MouseHandler } from "eez-studio-designer/mouse-handler";
import { Selection } from "eez-studio-designer/selection";

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

    onContextMenu(
        context: IDesignerContext,
        point: Point,
        showContextMenu: (menu: IContextMenu) => void
    ) {
        if (
            context.viewState.selectedObjects.length === 0 ||
            !pointInRect(point, context.viewState.selectedObjectsBoundingRect as Rect)
        ) {
            context.viewState.deselectAllObjects();

            let object = context.document.objectFromPoint(point);
            if (!object) {
                return;
            }

            context.viewState.selectObject(object);
        }

        setTimeout(() => {
            if (context.viewState.selectedObjects.length > 0) {
                const menu = context.document.createContextMenu(context.viewState.selectedObjects);

                menu.appendMenuItem({
                    label: "Delete",
                    click: () => {
                        context.document.deleteObjects(context.viewState.selectedObjects);
                    }
                });

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
        if (object) {
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

    renderInSelectionLayer() {
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

class DragMouseHandler extends MouseHandler {
    changed: boolean;

    down(context: IDesignerContext, event: MouseEvent) {
        super.down(context, event);
        context.document.onDragStart("move");
    }

    move(context: IDesignerContext, event: MouseEvent) {
        super.move(context, event);

        for (const object of context.viewState.selectedObjects) {
            let rect = {
                left: object.rect.left + this.movement.x / context.viewState.transform.scale,
                top: object.rect.top + this.movement.y / context.viewState.transform.scale,
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

class ResizeMouseHandler extends MouseHandler {
    handleType: HandleType;

    savedBoundingRect: Rect;
    boundingRect: Rect;

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

        this.savedBoundingRect = context.viewState.selectedObjectsBoundingRect!;
        this.boundingRect = {
            left: this.savedBoundingRect.left,
            top: this.savedBoundingRect.top,
            width: this.savedBoundingRect.width,
            height: this.savedBoundingRect.height
        };

        this.savedRects = [];
        this.rects = [];
        for (const object of context.viewState.selectedObjects) {
            let rect = object.rect;

            this.savedRects.push({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            });

            this.rects.push({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            });
        }
    }

    moveTop(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let bottom = rect.top + rect.height;
        rect.top = savedRect.top + this.offsetDistance.y / context.viewState.transform.scale;
        if (rect.top >= bottom) {
            rect.top = bottom - 1;
        }
        rect.height = bottom - rect.top;
    }

    moveLeft(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let right = rect.left + rect.width;
        rect.left = savedRect.left + this.offsetDistance.x / context.viewState.transform.scale;
        if (rect.left >= right) {
            rect.left = right - 1;
        }
        rect.width = right - rect.left;
    }

    moveBottom(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let bottom =
            savedRect.top +
            savedRect.height +
            this.offsetDistance.y / context.viewState.transform.scale;
        if (bottom <= rect.top) {
            bottom = rect.top + 1;
        }
        rect.height = bottom - rect.top;
    }

    moveRight(context: IDesignerContext, savedRect: Rect, rect: Rect) {
        let right =
            savedRect.left +
            savedRect.width +
            this.offsetDistance.x / context.viewState.transform.scale;
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
            let savedRect = this.savedRects[i];
            let rect = this.rects[i];

            rect.left =
                this.boundingRect.left +
                (savedRect.left - this.savedBoundingRect.left) * scaleWidth;
            rect.top =
                this.boundingRect.top + (savedRect.top - this.savedBoundingRect.top) * scaleHeight;
            rect.width = savedRect.width * scaleWidth;
            rect.height = savedRect.height * scaleHeight;

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
