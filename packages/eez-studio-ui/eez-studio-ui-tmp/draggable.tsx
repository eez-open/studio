import { bind } from "bind-decorator";

import { closestBySelector } from "eez-studio-shared/dom";

////////////////////////////////////////////////////////////////////////////////

interface DraggableConfig {
    onDragStart?(e: PointerEvent, x: number, y: number): any;
    onDragMove?(e: PointerEvent, x: number, y: number, params: any): void;
    onDragEnd?(e: PointerEvent | undefined, cancel: boolean, params: any): void;
    onMove?(e: PointerEvent): void;
}

export class Draggable {
    element: Element | null = null;
    overlayElement: HTMLDivElement;
    cursor: string | undefined;
    dragging: boolean;
    xDragStart: number;
    yDragStart: number;
    params: any;
    savedBodyUserSelect: string | null;
    capturedPointerId: number;

    constructor(private config: DraggableConfig) {}

    attach(element: Element | null) {
        if (this.dragging) {
            return;
        }

        if (this.element) {
            this.finishDragging(undefined, true);
            this.element.removeEventListener("pointerdown", this.onPointerDown);
            this.element.removeEventListener("pointermove", this.onPointerMove);
        }

        this.element = element;

        if (this.element) {
            this.element.addEventListener("pointerdown", this.onPointerDown);
            this.element.addEventListener("pointermove", this.onPointerMove);
        }
    }

    @bind
    onPointerDown(e: PointerEvent) {
        if (!this.element) {
            return;
        }

        // put in focus first parent with tabindex attribute
        const parentWithTabindex = closestBySelector(this.element, "[tabindex]");
        if (parentWithTabindex) {
            parentWithTabindex.focus();
        }

        this.finishDragging(undefined, true);

        this.element.addEventListener("pointerup", this.onPointerUp);
        this.element.addEventListener("pointercancel", this.onPointerCancel);

        window.addEventListener("keydown", this.onKeyDown);

        this.overlayElement = document.createElement("div");
        this.overlayElement.style.position = "absolute";
        this.overlayElement.style.left = "0";
        this.overlayElement.style.top = "0";
        this.overlayElement.style.width = "100%";
        this.overlayElement.style.height = "100%";
        this.overlayElement.style.backgroundColor = "transparent";
        this.overlayElement.style.cursor = this.cursor || "default";
        this.overlayElement.addEventListener("pointermove", e => {
            this.finishDragging(e, true);
        });

        this.savedBodyUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";

        document.body.appendChild(this.overlayElement);

        this.capturedPointerId = e.pointerId;
        this.element.setPointerCapture(e.pointerId);

        this.dragging = true;

        this.xDragStart = e.clientX;
        this.yDragStart = e.clientY;

        if (this.config.onDragStart) {
            this.params = this.config.onDragStart(e, this.xDragStart, this.yDragStart);
        } else {
            this.params = undefined;
        }
    }

    @bind
    onPointerMove(e: PointerEvent) {
        if (this.dragging) {
            if (this.config.onDragMove) {
                this.config.onDragMove(
                    e,
                    e.clientX - this.xDragStart,
                    e.clientY - this.yDragStart,
                    this.params
                );
            }
        } else {
            if (this.config.onMove) {
                this.config.onMove(e);
            }
        }
    }

    @bind
    onPointerUp(e: PointerEvent) {
        this.finishDragging(e, false);
    }

    @bind
    onPointerCancel(e: PointerEvent) {
        this.finishDragging(e, true);
    }

    @bind
    onKeyDown(e: KeyboardEvent) {
        if (e.keyCode == 27 /* ESC */) {
            this.finishDragging(undefined, true);
        }
    }

    @bind
    finishDragging(e: PointerEvent | undefined, cancel: boolean) {
        if (!this.dragging) {
            return;
        }

        if (this.config.onDragEnd) {
            this.config.onDragEnd(e, cancel, this.params);
        }

        this.overlayElement.remove();

        document.body.style.userSelect = this.savedBodyUserSelect;

        if (this.element) {
            this.element.releasePointerCapture(this.capturedPointerId);

            this.element.removeEventListener("pointerup", this.onPointerUp);
            this.element.removeEventListener("pointercancel", this.onPointerCancel);
        }

        window.removeEventListener("keydown", this.onKeyDown);

        this.dragging = false;
    }
}
