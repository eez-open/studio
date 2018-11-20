import { Point, Rect, pointInRect } from "eez-studio-shared/geometry";

import {
    TreeNode,
    traverseTree,
    TraverseTreeContinuation
} from "project-editor/project/features/gui/page-editor/CanvasEditorTreeNode";
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

export function nodesFromPoint(tree: TreeNode, p: Point) {
    let result: TreeNode[] = [];

    traverseTree(tree, node => {
        if (
            node != tree &&
            ((node.hitTest && node.hitTest(node, p)) || (node.rect && pointInRect(p, node.rect)))
        ) {
            result.push(node);
        }
        return TraverseTreeContinuation.CONTINUE;
    });

    return result;
}

export function drawTree(
    ctx: CanvasRenderingContext2D,
    tree: TreeNode,
    scale: number,
    callback: () => void
) {
    traverseTree(tree, node => {
        if (node.draw) {
            node.draw(node, ctx, scale, callback);
        } else if (node.image && node.image.width && node.image.height) {
            ctx.drawImage(node.image, node.rect.left, node.rect.top);
            if (
                node.rect.left < tree.rect.left ||
                node.rect.left + node.rect.width > tree.rect.left + tree.rect.width ||
                node.rect.top < tree.rect.top ||
                node.rect.top + node.rect.height > tree.rect.top + tree.rect.height
            ) {
                ctx.save();

                ctx.beginPath();
                ctx.rect(node.rect.left, node.rect.top, node.rect.width, node.rect.height);
                ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
                ctx.stroke();

                ctx.clip();

                ctx.beginPath();

                let OFFSET = 12;

                for (
                    let y = OFFSET + 0.5;
                    y <
                    Math.max(node.rect.width, node.rect.height) +
                        Math.min(node.rect.width, node.rect.height);
                    y += OFFSET
                ) {
                    ctx.moveTo(node.rect.left, node.rect.top + y);
                    ctx.lineTo(node.rect.left + y, node.rect.top);
                }

                ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
                ctx.stroke();

                ctx.restore();

                // ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                // ctx.fillRect(node.rect.x, node.rect.y, node.rect.width, node.rect.height);
            }
        }
    });
}
