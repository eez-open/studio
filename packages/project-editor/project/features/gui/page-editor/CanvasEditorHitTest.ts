import { Point, Rect } from "eez-studio-shared/geometry";

import { TreeNode } from "eez-studio-page-editor/widget-tree";

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
                Math.abs(selectionRect.left - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.NW;
            }
            if (
                Math.abs(selectionRect.left + selectionRect.width / 2 - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.N;
            }
            if (
                Math.abs(selectionRect.left + selectionRect.width - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.NE;
            }
            if (
                Math.abs(selectionRect.left - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top + selectionRect.height / 2 - p.y) <=
                    RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.W;
            }
            if (
                Math.abs(selectionRect.left + selectionRect.width - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top + selectionRect.height / 2 - p.y) <=
                    RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.E;
            }
            if (
                Math.abs(selectionRect.left - p.x) <= RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top + selectionRect.height - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.SW;
            }
            if (
                Math.abs(selectionRect.left + selectionRect.width / 2 - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top + selectionRect.height - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.S;
            }
            if (
                Math.abs(selectionRect.left + selectionRect.width - p.x) <=
                    RESIZE_HANDLE_SIZE / 2 &&
                Math.abs(selectionRect.top + selectionRect.height - p.y) <= RESIZE_HANDLE_SIZE / 2
            ) {
                return HitRegion.SE;
            }
        }

        if (
            p.x >= selectionRect.left &&
            p.x < selectionRect.left + selectionRect.width &&
            p.y >= selectionRect.top &&
            p.y < selectionRect.top + selectionRect.height
        ) {
            return HitRegion.INSIDE;
        }
    }

    return HitRegion.OUTSIDE;
}
