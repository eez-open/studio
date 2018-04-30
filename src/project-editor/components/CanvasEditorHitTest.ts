import { Point, Rect } from "project-editor/core/util";

import { TreeNode } from "project-editor/components/CanvasEditorTreeNode";

export const RESIZE_HANDLE_SIZE = 8;

export enum HitRegion {
    OUTSIDE,
    INSIDE,
    NW,
    N,
    NE,
    W,
    E,
    SW,
    S,
    SE
}

export interface HitTestResult {
    region: HitRegion;
    node: TreeNode | undefined;
    nodes: TreeNode[] | undefined;
}

export function hitTestSelectionRect(selectionRect: Rect, p: Point, resizable: boolean) {
    if (selectionRect) {
        if (resizable) {
            if (
                Math.abs(selectionRect.x - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.NW;
            }
            if (
                Math.abs(selectionRect.x + selectionRect.width / 2 - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.N;
            }
            if (
                Math.abs(selectionRect.x + selectionRect.width - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.NE;
            }
            if (
                Math.abs(selectionRect.x - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y + selectionRect.height / 2 - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.W;
            }
            if (
                Math.abs(selectionRect.x + selectionRect.width - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y + selectionRect.height / 2 - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.E;
            }
            if (
                Math.abs(selectionRect.x - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y + selectionRect.height - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.SW;
            }
            if (
                Math.abs(selectionRect.x + selectionRect.width / 2 - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y + selectionRect.height - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.S;
            }
            if (
                Math.abs(selectionRect.x + selectionRect.width - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.y + selectionRect.height - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.SE;
            }
        }

        if (
            p.x >= selectionRect.x &&
            p.x < selectionRect.x + selectionRect.width &&
            p.y >= selectionRect.y &&
            p.y < selectionRect.y + selectionRect.height
        ) {
            return HitRegion.INSIDE;
        }
    }

    return HitRegion.OUTSIDE;
}
