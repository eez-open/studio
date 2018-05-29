import { ICanvas, IToolHandler, MouseHandler } from "shared/ui/designer";
import { Point, Rect, pointInRect } from "shared/geometry";
import { closestByClass } from "shared/util";
import { rectEqual } from "shared/geometry";
import { beginTransaction, commitTransaction } from "shared/store";

const { Menu, MenuItem } = EEZStudio.electron.remote;

// - select object with click
// - selection context menu
// - rubber band selection
// - move selection
// - resize selection

export const selectToolHandler: IToolHandler = {
    onClick(canvas: ICanvas, point: Point) {},

    onContextMenu(canvas: ICanvas, point: Point, showContextMenu: (menu: Electron.Menu) => void) {
        if (
            canvas.selectedObjects.length === 0 ||
            !pointInRect(point, canvas.selectedObjectsBoundingRect as Rect)
        ) {
            let object = canvas.objectFromPoint(point);
            if (object) {
                canvas.selectObject(object);
            } else {
                canvas.deselectAllObjects();
                return;
            }
        }

        setTimeout(() => {
            if (canvas.selectedObjects.length > 0) {
                const menu = new Menu();

                if (canvas.selectedObjects.length === 1) {
                    const object = canvas.selectedObjects[0];

                    if (object.isEditable) {
                        menu.append(
                            new MenuItem({
                                label: "Open in Tab",
                                click: () => {
                                    object.openEditor!("tab");
                                }
                            })
                        );

                        menu.append(
                            new MenuItem({
                                label: "Open in Window",
                                click: () => {
                                    object.openEditor!("window");
                                }
                            })
                        );

                        menu.append(
                            new MenuItem({
                                type: "separator"
                            })
                        );
                    }
                }

                menu.append(
                    new MenuItem({
                        label: "Delete",
                        click: () => {
                            canvas.deleteSelectedObjects();
                        }
                    })
                );

                showContextMenu(menu);
            }
        }, 0);
    },

    cursor: "default",

    canDrag: false,
    drop() {},

    createMouseHandler(canvas: ICanvas, event: MouseEvent) {
        if (closestByClass(event.target, "EezStudio_Selection_Handle")) {
            return new ResizeMouseHandler();
        }

        if (closestByClass(event.target, "EezStudio_Selection")) {
            return new DragMouseHandler();
        }

        let point = canvas.mouseEventToModelPoint(event);
        let object = canvas.objectFromPoint(point);
        if (object) {
            if (!object.selected) {
                canvas.selectObject(object);
            }
            return new DragMouseHandler();
        }

        return new RubberBandSelectionMouseHandler();
    }
};

class RubberBandSelectionMouseHandler extends MouseHandler {
    down(canvas: ICanvas, event: MouseEvent) {
        super.down(canvas, event);
        canvas.deselectAllObjects();
    }

    move(canvas: ICanvas, event: MouseEvent) {
        super.move(canvas, event);

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

        let rubberBendRect = {
            left: left,
            top: top,
            width: width,
            height: height
        };

        canvas.setRubberBendRect(rubberBendRect);

        canvas.selectObjectsInsideRect(canvas.offsetToModelRect(rubberBendRect));
    }

    up(canvas: ICanvas, event?: MouseEvent) {
        super.up(canvas, event);

        canvas.setRubberBendRect(undefined);
    }
}

class DragMouseHandler extends MouseHandler {
    rects: {
        leftStart: number;
        topStart: number;
        left: number;
        top: number;
        width: number;
        height: number;
    }[] = [];
    changed: boolean;

    down(canvas: ICanvas, event: MouseEvent) {
        super.down(canvas, event);
        canvas.hideSelection();
    }

    move(canvas: ICanvas, event: MouseEvent) {
        super.move(canvas, event);

        let objects = canvas.selectedObjects;
        for (let i = 0; i < objects.length; ++i) {
            let object = objects[i];

            let rect = {
                left: object.rect.left + this.movement.x / canvas.getScale(),
                top: object.rect.top + this.movement.y / canvas.getScale(),
                width: object.rect.width,
                height: object.rect.height
            };

            if (!rectEqual(rect, object.rect)) {
                this.changed = true;
                object.setRect(rect);
            }
        }
    }

    up(canvas: ICanvas, event?: MouseEvent) {
        super.up(canvas, event);

        if (this.changed) {
            let objects = canvas.selectedObjects;

            if (objects.length > 0) {
                beginTransaction("Move workbench items");
            } else {
                beginTransaction("Move workbench item");
            }

            for (let i = 0; i < objects.length; ++i) {
                objects[i].saveRect();
            }

            commitTransaction();
        }

        canvas.showSelection();
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

    down(canvas: ICanvas, event: MouseEvent) {
        super.down(canvas, event);
        canvas.hideSelection();

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

        this.savedBoundingRect = canvas.selectedObjectsBoundingRect!;
        this.boundingRect = {
            left: this.savedBoundingRect.left,
            top: this.savedBoundingRect.top,
            width: this.savedBoundingRect.width,
            height: this.savedBoundingRect.height
        };

        this.savedRects = [];
        this.rects = [];
        let objects = canvas.selectedObjects;
        for (let i = 0; i < objects.length; ++i) {
            let rect = objects[i].rect;

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

    moveTop(canvas: ICanvas, savedRect: Rect, rect: Rect) {
        let bottom = rect.top + rect.height;
        rect.top = savedRect.top + this.offsetDistance.y / canvas.getScale();
        if (rect.top >= bottom) {
            rect.top = bottom - 1;
        }
        rect.height = bottom - rect.top;
    }

    moveLeft(canvas: ICanvas, savedRect: Rect, rect: Rect) {
        let right = rect.left + rect.width;
        rect.left = savedRect.left + this.offsetDistance.x / canvas.getScale();
        if (rect.left >= right) {
            rect.left = right - 1;
        }
        rect.width = right - rect.left;
    }

    moveBottom(canvas: ICanvas, savedRect: Rect, rect: Rect) {
        let bottom = savedRect.top + savedRect.height + this.offsetDistance.y / canvas.getScale();
        if (bottom <= rect.top) {
            bottom = rect.top + 1;
        }
        rect.height = bottom - rect.top;
    }

    moveRight(canvas: ICanvas, savedRect: Rect, rect: Rect) {
        let right = savedRect.left + savedRect.width + this.offsetDistance.x / canvas.getScale();
        if (right <= rect.left) {
            right = rect.left + 1;
        }
        rect.width = right - rect.left;
    }

    fixAspectRatio(savedRect: Rect, rect: Rect, top: boolean, left: boolean) {
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

    resizeRect(canvas: ICanvas, savedRect: Rect, rect: Rect) {
        if (this.handleType === HandleType.TopLeft) {
            this.moveTop(canvas, savedRect, rect);
            this.moveLeft(canvas, savedRect, rect);
            this.fixAspectRatio(savedRect, rect, true, true);
        } else if (this.handleType === HandleType.Top) {
            this.moveTop(canvas, savedRect, rect);
        } else if (this.handleType === HandleType.TopRight) {
            this.moveTop(canvas, savedRect, rect);
            this.moveRight(canvas, savedRect, rect);
            this.fixAspectRatio(savedRect, rect, true, false);
        } else if (this.handleType === HandleType.Left) {
            this.moveLeft(canvas, savedRect, rect);
        } else if (this.handleType === HandleType.Right) {
            this.moveRight(canvas, savedRect, rect);
        } else if (this.handleType === HandleType.BottomLeft) {
            this.moveBottom(canvas, savedRect, rect);
            this.moveLeft(canvas, savedRect, rect);
            this.fixAspectRatio(savedRect, rect, false, true);
        } else if (this.handleType === HandleType.Bottom) {
            this.moveBottom(canvas, savedRect, rect);
        } else {
            this.moveBottom(canvas, savedRect, rect);
            this.moveRight(canvas, savedRect, rect);
            this.fixAspectRatio(savedRect, rect, false, false);
        }
    }

    move(canvas: ICanvas, event: MouseEvent) {
        super.move(canvas, event);

        this.resizeRect(canvas, this.savedBoundingRect, this.boundingRect);

        let scaleWidth = this.boundingRect.width / this.savedBoundingRect.width;
        let scaleHeight = this.boundingRect.height / this.savedBoundingRect.height;

        let objects = canvas.selectedObjects;

        for (let i = 0; i < this.rects.length; ++i) {
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
                objects[i].setRect(rect);
            }
        }
    }

    up(canvas: ICanvas, event?: MouseEvent) {
        super.up(canvas, event);

        if (this.changed) {
            let objects = canvas.selectedObjects;

            if (objects.length > 0) {
                beginTransaction("Resize workbench items");
            } else {
                beginTransaction("Resize workbench item");
            }

            for (let i = 0; i < this.rects.length; ++i) {
                objects[i].saveRect();
            }

            commitTransaction();
        }

        canvas.showSelection();
    }
}
