import { Rect } from "eez-studio-shared/geometry";

import { RESIZE_HANDLE_SIZE } from "project-editor/project/features/gui/page-editor/CanvasEditorHitTest";

////////////////////////////////////////////////////////////////////////////////

export function drawSelection(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    drawResizeHandles: boolean
) {
    const COLOR = "rgba(255, 255, 255, 0.3)";
    const COLOR_CORNER = "rgba(0, 0, 0, 0.6)";
    const COLOR_BORDER = "rgb(0, 0, 0)";

    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.fillStyle = COLOR;
    ctx.fill();
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (drawResizeHandles) {
        ctx.fillStyle = COLOR_CORNER;
        ctx.strokeStyle = COLOR;

        ctx.beginPath();
        ctx.rect(
            rect.left - RESIZE_HANDLE_SIZE / 2,
            rect.top - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left + rect.width / 2 - RESIZE_HANDLE_SIZE / 2,
            rect.top - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left + rect.width - RESIZE_HANDLE_SIZE / 2,
            rect.top - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left - RESIZE_HANDLE_SIZE / 2,
            rect.top + rect.height / 2 - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left + rect.width - RESIZE_HANDLE_SIZE / 2,
            rect.top + rect.height / 2 - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left - RESIZE_HANDLE_SIZE / 2,
            rect.top + rect.height - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left + rect.width / 2 - RESIZE_HANDLE_SIZE / 2,
            rect.top + rect.height - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(
            rect.left + rect.width - RESIZE_HANDLE_SIZE / 2,
            rect.top + rect.height - RESIZE_HANDLE_SIZE / 2,
            RESIZE_HANDLE_SIZE,
            RESIZE_HANDLE_SIZE
        );
        ctx.fill();
        ctx.stroke();
    }
}

export function drawSelectedDecoration(ctx: CanvasRenderingContext2D, rect: Rect) {
    const COLOR_BORDER = "rgb(0, 0, 0)";

    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);

    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
}

////////////////////////////////////////////////////////////////////////////////

export interface NodeObj {
    x: number;
    y: number;
    width: number;
    height: number;
}

////////////////////////////////////////////////////////////////////////////////
