import { closestByClass } from "shared/util";
import { Point, Rect, pointInRect, rectEqual } from "shared/geometry";

import { IDocument, IToolHandler } from "shared/ui/designer/designer-interfaces";
import { MouseHandler } from "shared/ui/designer/mouse-handler";

const { Menu, MenuItem } = EEZStudio.electron.remote;

// - select object with click
// - selection context menu
// - rubber band selection
// - move selection
// - resize selection

export const selectToolHandler: IToolHandler = {
    onClick(document: IDocument, point: Point) {},

    onContextMenu(
        document: IDocument,
        point: Point,
        showContextMenu: (menu: Electron.Menu) => void
    ) {
        if (
            document.selectedObjects.length === 0 ||
            !pointInRect(point, document.selectedObjectsBoundingRect as Rect)
        ) {
            document.deselectAllObjects();

            let object = document.objectFromPoint(point);
            if (!object) {
                return;
            }

            document.selectObject(object);
        }

        setTimeout(() => {
            if (document.selectedObjects.length > 0) {
                const menu = new Menu();

                document.initContextMenu(menu);

                menu.append(
                    new MenuItem({
                        label: "Delete",
                        click: () => {
                            document.deleteSelectedObjects();
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

    createMouseHandler(document: IDocument, event: MouseEvent) {
        if (closestByClass(event.target, "EezStudio_DesignerSelection_Handle")) {
            return new ResizeMouseHandler();
        }

        if (closestByClass(event.target, "EezStudio_DesignerSelection")) {
            return new DragMouseHandler();
        }

        let point = document.transform.mouseEventToModelPoint(event);
        let object = document.objectFromPoint(point);
        if (object) {
            if (!object.selected) {
                if (!event.ctrlKey && !event.shiftKey) {
                    document.deselectAllObjects();
                }
                document.selectObject(object);
            }
            return new DragMouseHandler();
        }

        return new RubberBandSelectionMouseHandler();
    }
};

class RubberBandSelectionMouseHandler extends MouseHandler {
    down(document: IDocument, event: MouseEvent) {
        super.down(document, event);
        document.deselectAllObjects();
    }

    move(document: IDocument, event: MouseEvent) {
        super.move(document, event);

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

        document.rubberBendRect = rubberBendRect;

        document.selectObjectsInsideRect(document.transform.offsetToModelRect(rubberBendRect));
    }

    up(document: IDocument, event?: MouseEvent) {
        super.up(document, event);

        document.rubberBendRect = undefined;
    }
}

class DragMouseHandler extends MouseHandler {
    changed: boolean;

    down(document: IDocument, event: MouseEvent) {
        super.down(document, event);
        document.onDragStart("move");
    }

    move(document: IDocument, event: MouseEvent) {
        super.move(document, event);

        let objects = document.selectedObjects;
        for (let i = 0; i < objects.length; i++) {
            let object = objects[i];

            let rect = {
                left: object.rect.left + this.movement.x / document.transform.scale,
                top: object.rect.top + this.movement.y / document.transform.scale,
                width: object.rect.width,
                height: object.rect.height
            };

            if (!rectEqual(rect, object.rect)) {
                this.changed = true;
                object.rect = rect;
            }
        }
    }

    up(document: IDocument, event?: MouseEvent) {
        super.up(document, event);
        document.onDragEnd("move", this.changed);
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

    down(document: IDocument, event: MouseEvent) {
        super.down(document, event);

        document.onDragStart("resize");

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

        this.savedBoundingRect = document.selectedObjectsBoundingRect!;
        this.boundingRect = {
            left: this.savedBoundingRect.left,
            top: this.savedBoundingRect.top,
            width: this.savedBoundingRect.width,
            height: this.savedBoundingRect.height
        };

        this.savedRects = [];
        this.rects = [];
        let objects = document.selectedObjects;
        for (let i = 0; i < objects.length; i++) {
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

    moveTop(document: IDocument, savedRect: Rect, rect: Rect) {
        let bottom = rect.top + rect.height;
        rect.top = savedRect.top + this.offsetDistance.y / document.transform.scale;
        if (rect.top >= bottom) {
            rect.top = bottom - 1;
        }
        rect.height = bottom - rect.top;
    }

    moveLeft(document: IDocument, savedRect: Rect, rect: Rect) {
        let right = rect.left + rect.width;
        rect.left = savedRect.left + this.offsetDistance.x / document.transform.scale;
        if (rect.left >= right) {
            rect.left = right - 1;
        }
        rect.width = right - rect.left;
    }

    moveBottom(document: IDocument, savedRect: Rect, rect: Rect) {
        let bottom =
            savedRect.top + savedRect.height + this.offsetDistance.y / document.transform.scale;
        if (bottom <= rect.top) {
            bottom = rect.top + 1;
        }
        rect.height = bottom - rect.top;
    }

    moveRight(document: IDocument, savedRect: Rect, rect: Rect) {
        let right =
            savedRect.left + savedRect.width + this.offsetDistance.x / document.transform.scale;
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

    resizeRect(document: IDocument, savedRect: Rect, rect: Rect) {
        if (this.handleType === HandleType.TopLeft) {
            this.moveTop(document, savedRect, rect);
            this.moveLeft(document, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, true, true);
        } else if (this.handleType === HandleType.Top) {
            this.moveTop(document, savedRect, rect);
        } else if (this.handleType === HandleType.TopRight) {
            this.moveTop(document, savedRect, rect);
            this.moveRight(document, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, true, false);
        } else if (this.handleType === HandleType.Left) {
            this.moveLeft(document, savedRect, rect);
        } else if (this.handleType === HandleType.Right) {
            this.moveRight(document, savedRect, rect);
        } else if (this.handleType === HandleType.BottomLeft) {
            this.moveBottom(document, savedRect, rect);
            this.moveLeft(document, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, false, true);
        } else if (this.handleType === HandleType.Bottom) {
            this.moveBottom(document, savedRect, rect);
        } else {
            this.moveBottom(document, savedRect, rect);
            this.moveRight(document, savedRect, rect);
            //this.maintainSameAspectRatio(savedRect, rect, false, false);
        }
    }

    move(document: IDocument, event: MouseEvent) {
        super.move(document, event);

        this.resizeRect(document, this.savedBoundingRect, this.boundingRect);

        let scaleWidth = this.boundingRect.width / this.savedBoundingRect.width;
        let scaleHeight = this.boundingRect.height / this.savedBoundingRect.height;

        let objects = document.selectedObjects;

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

    up(document: IDocument, event?: MouseEvent) {
        super.up(document, event);

        document.onDragEnd("resize", this.changed);
    }
}
