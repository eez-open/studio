import { Point, Rect } from "project-editor/core/util";
import { DisplayItem } from "project-editor/core/objectAdapter";

export interface LineConnecting {
    move(target: TreeNode | undefined, p: Point): void;
    draw(ctx: CanvasRenderingContext2D, scale: number): void;
    commit(): void;
}

export interface TreeNode {
    parent: TreeNode;
    children: TreeNode[];

    rect: Rect;
    selected: boolean;
    selectable: boolean;
    movable: boolean;
    resizable: boolean;

    item: DisplayItem;
    custom?: any;

    hitTest?: (treeNode: TreeNode, p: Point) => boolean;
    draw?: (
        treeNode: TreeNode,
        ctx: CanvasRenderingContext2D,
        scale: number,
        callback: () => void
    ) => void;
    image?: HTMLCanvasElement | undefined;
    drawSelectedDecoration?: (
        treeNode: TreeNode,
        ctx: CanvasRenderingContext2D,
        scale: number
    ) => void;
    startLineConnecting?: (treeNode: TreeNode, p: Point) => LineConnecting;
}

export enum TraverseTreeContinuation {
    CONTINUE,
    SKIP_CHILDREN,
    BREAK
}

export function traverseTree(
    node: TreeNode,
    callback: (node: TreeNode) => TraverseTreeContinuation | void
) {
    let result = callback(node);
    if (result == undefined || result === TraverseTreeContinuation.CONTINUE) {
        for (let i = 0; i < node.children.length; i++) {
            if (traverseTree(node.children[i], callback) == TraverseTreeContinuation.BREAK) {
                return TraverseTreeContinuation.BREAK;
            }
        }
    }

    return result;
}
