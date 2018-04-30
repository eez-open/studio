import { Point, Rect } from "project-editor/core/util";

import { TreeNode } from "project-editor/components/CanvasEditorTreeNode";

////////////////////////////////////////////////////////////////////////////////

const SNAP_LINES_COLOR = "rgba(128, 128, 128, 1)";
const SNAP_LINES_LINE_WIDTH = 0.5;

const CLOSEST_SNAP_LINES_COLOR = "rgba(0, 255, 0, 1)";
const CLOSEST_SNAP_LINES_LINE_WIDTH = 1;

const MAX_SNAP_LINE_DISTANCE = 8;
const MAX_VISIBLE_SNAP_LINE_DISTANCE = 20;

////////////////////////////////////////////////////////////////////////////////

interface SnapLine {
    pos: number;
    node: TreeNode;
}

interface ClosestSnapLines {
    diff: number;
    lines: SnapLine[];
}

export interface SnapLines {
    horizontalLines: SnapLine[];
    verticalLines: SnapLine[];
}

////////////////////////////////////////////////////////////////////////////////

export function findSnapLines(
    tree: TreeNode,
    excludeNodes: TreeNode[],
    filterCallback: (node: TreeNode) => boolean
): SnapLines {
    function findSnapLinesInTree(offsetFieldName: string, sizeFieldName: string) {
        let lines: SnapLine[] = [];

        function findSnapLinesInNode(node: TreeNode) {
            if (!excludeNodes.find(excludeNode => excludeNode == node)) {
                if (node.rect) {
                    let rect: any = node.rect;
                    if (!filterCallback || filterCallback(node)) {
                        lines.push({
                            pos: rect[offsetFieldName],
                            node: node
                        });

                        if (rect[sizeFieldName] > 0) {
                            lines.push({
                                pos: rect[offsetFieldName] + rect[sizeFieldName],
                                node: node
                            });
                        }
                    }
                }

                for (let i = 0; i < node.children.length; ++i) {
                    findSnapLinesInNode(node.children[i]);
                }
            }
        }

        findSnapLinesInNode(tree);

        return lines.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
    }

    return {
        horizontalLines: findSnapLinesInTree("y", "height"),
        verticalLines: findSnapLinesInTree("x", "width")
    };
}

////////////////////////////////////////////////////////////////////////////////

function findClosestSnapLinesToPosition(lines: SnapLine[], pos: number) {
    let result: ClosestSnapLines | undefined = undefined;

    for (let i = 0; i < lines.length; ++i) {
        let diff = Math.abs(pos - lines[i].pos);
        if (diff < MAX_SNAP_LINE_DISTANCE) {
            if (!result || diff < result.diff) {
                result = {
                    diff: Math.abs(pos - lines[i].pos),
                    lines: [lines[i]]
                };
            } else if (result && diff == result.diff && lines[i].pos == result.lines[0].pos) {
                result.lines.push(lines[i]);
            }
        }
    }

    return result;
}

export function findClosestHorizontalSnapLinesToPosition(snapLines: SnapLines, pos: number) {
    return findClosestSnapLinesToPosition(snapLines.horizontalLines, pos);
}

export function findClosestVerticalSnapLinesToPosition(snapLines: SnapLines, pos: number) {
    return findClosestSnapLinesToPosition(snapLines.verticalLines, pos);
}

////////////////////////////////////////////////////////////////////////////////

function combineSnapLines(
    lines1: ClosestSnapLines | undefined,
    lines2: ClosestSnapLines | undefined
) {
    if (lines1 && !lines2) {
        return lines1;
    } else if (lines2 && !lines1) {
        return lines2;
    } else if (lines1 && lines2) {
        if (lines1.diff < lines2.diff) {
            return lines1;
        } else if (lines2.diff < lines1.diff) {
            return lines2;
        } else {
            return {
                diff: lines1.diff,
                lines: lines1.lines.concat(lines2.lines)
            };
        }
    }
    return undefined;
}

function findVerticalSnapLinesClosestToRect(snapLines: SnapLines, rect: Rect) {
    let x = rect.x;
    let width = rect.width;
    let topLines = findClosestVerticalSnapLinesToPosition(snapLines, x);
    let bottomLines = findClosestVerticalSnapLinesToPosition(snapLines, x + width);
    return combineSnapLines(topLines, bottomLines);
}

function findHorizontalSnapLinesClosestToRect(snapLines: SnapLines, rect: Rect) {
    let y = rect.y;
    let height = rect.height;
    let leftLines = findClosestHorizontalSnapLinesToPosition(snapLines, y);
    let rightLines = findClosestHorizontalSnapLinesToPosition(snapLines, y + height);
    return combineSnapLines(leftLines, rightLines);
}

function distanceToRect(
    pos: number,
    rect: Rect,
    offsetFieldName: string,
    sizeFieldName: string
): number {
    return Math.min(
        Math.abs(pos - (rect as any)[offsetFieldName]),
        Math.abs(pos - ((rect as any)[offsetFieldName] + (rect as any)[sizeFieldName]))
    );
}

export function drawSnapLines(
    ctx: CanvasRenderingContext2D,
    topLeft: Point,
    bottomRight: Point,
    snapLines: SnapLines,
    selectionRect: Rect,
    scale: number
) {
    ctx.strokeStyle = SNAP_LINES_COLOR;
    ctx.lineWidth = SNAP_LINES_LINE_WIDTH / scale;

    let drawnPositions: number[];

    // draw horizontal snap lines
    drawnPositions = [];
    for (let i = 0; i < snapLines.horizontalLines.length; ++i) {
        let pos = snapLines.horizontalLines[i].pos;
        if (drawnPositions.indexOf(pos) == -1) {
            // do not draw multiple lines over the same position
            if (
                distanceToRect(pos, selectionRect, "y", "height") < MAX_VISIBLE_SNAP_LINE_DISTANCE
            ) {
                ctx.beginPath();
                ctx.moveTo(topLeft.x, pos);
                ctx.lineTo(bottomRight.x, pos);
                ctx.stroke();
                drawnPositions.push(pos);
            }
        }
    }

    // draw vertical snap lines
    drawnPositions = [];
    for (let i = 0; i < snapLines.verticalLines.length; ++i) {
        let pos = snapLines.verticalLines[i].pos;
        if (drawnPositions.indexOf(pos) == -1) {
            // do not draw multiple lines over the same position
            if (distanceToRect(pos, selectionRect, "x", "width") < MAX_VISIBLE_SNAP_LINE_DISTANCE) {
                ctx.beginPath();
                ctx.moveTo(pos, topLeft.y);
                ctx.lineTo(pos, bottomRight.y);
                ctx.stroke();
                drawnPositions.push(pos);
            }
        }
    }

    // draw snap lines closest to mouse operation target
    ctx.strokeStyle = CLOSEST_SNAP_LINES_COLOR;
    ctx.lineWidth = CLOSEST_SNAP_LINES_LINE_WIDTH / scale;

    // draw closest horizontal snap lines
    let horizontalSnapLines = findHorizontalSnapLinesClosestToRect(snapLines, selectionRect);
    if (horizontalSnapLines) {
        drawnPositions = [];
        for (let i = 0; i < horizontalSnapLines.lines.length; ++i) {
            let pos = horizontalSnapLines.lines[i].pos;
            if (drawnPositions.indexOf(pos) == -1) {
                ctx.beginPath();
                ctx.moveTo(topLeft.x, pos);
                ctx.lineTo(bottomRight.x, pos);
                ctx.stroke();
                drawnPositions.push(pos);
            }
        }
    }

    // draw closest vertical snap lines
    let verticalSnapLines = findVerticalSnapLinesClosestToRect(snapLines, selectionRect);
    if (verticalSnapLines) {
        drawnPositions = [];
        for (let i = 0; i < verticalSnapLines.lines.length; ++i) {
            let pos = verticalSnapLines.lines[i].pos;
            if (drawnPositions.indexOf(pos) == -1) {
                ctx.beginPath();
                ctx.moveTo(pos, topLeft.y);
                ctx.lineTo(pos, bottomRight.y);
                ctx.stroke();
                drawnPositions.push(pos);
            }
        }
    }
}
