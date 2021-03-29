import { Rect } from "eez-studio-shared/geometry";

import type { IFlowContext } from "project-editor/features/gui/flow-interfaces";
import { getObjectBoundingRect } from "project-editor/features/gui/flow-editor/bounding-rects";
import { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

const MAX_SNAP_LINE_DISTANCE = 8;
const MAX_VISIBLE_SNAP_LINE_DISTANCE = 20;

////////////////////////////////////////////////////////////////////////////////

export interface ISnapLine {
    pos: number;
    node: ITreeObjectAdapter;
}

export interface IClosestSnapLines {
    diff: number;
    lines: ISnapLine[];
}

export interface ISnapLines {
    horizontalLines: ISnapLine[];
    verticalLines: ISnapLine[];
}

////////////////////////////////////////////////////////////////////////////////

export function findSnapLines(
    context: IFlowContext,
    tree: ITreeObjectAdapter,
    filterCallback?: (node: ITreeObjectAdapter) => boolean
): ISnapLines {
    function findSnapLinesInTree(
        offsetFieldName: string,
        sizeFieldName: string
    ) {
        let lines: ISnapLine[] = [];

        function findSnapLinesInNode(node: ITreeObjectAdapter) {
            function addLine(pos: number) {
                lines.push({
                    pos,
                    node
                });
            }

            if (node.object) {
                const rect: any = getObjectBoundingRect(node);
                if (!filterCallback || filterCallback(node)) {
                    addLine(rect[offsetFieldName]);
                    if (rect[sizeFieldName] > 0) {
                        addLine(rect[offsetFieldName] + rect[sizeFieldName]);
                    }
                }
            }

            for (let i = 0; i < node.children.length; i++) {
                findSnapLinesInNode((node.children as ITreeObjectAdapter[])[i]);
            }
        }

        findSnapLinesInNode(tree);

        return lines.sort((a, b) =>
            a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0
        );
    }

    return {
        horizontalLines: findSnapLinesInTree("top", "height"),
        verticalLines: findSnapLinesInTree("left", "width")
    };
}

////////////////////////////////////////////////////////////////////////////////

function findClosestSnapLinesToPosition(lines: ISnapLine[], pos: number) {
    let result: IClosestSnapLines | undefined = undefined;

    for (let i = 0; i < lines.length; i++) {
        let diff = Math.abs(pos - lines[i].pos);
        if (diff < MAX_SNAP_LINE_DISTANCE) {
            if (!result || diff < result.diff) {
                result = {
                    diff: Math.abs(pos - lines[i].pos),
                    lines: [lines[i]]
                };
            } else if (
                result &&
                diff == result.diff &&
                lines[i].pos == result.lines[0].pos
            ) {
                result.lines.push(lines[i]);
            }
        }
    }

    return result;
}

export function findClosestHorizontalSnapLinesToPosition(
    snapLines: ISnapLines,
    pos: number
) {
    return findClosestSnapLinesToPosition(snapLines.horizontalLines, pos);
}

export function findClosestVerticalSnapLinesToPosition(
    snapLines: ISnapLines,
    pos: number
) {
    return findClosestSnapLinesToPosition(snapLines.verticalLines, pos);
}

////////////////////////////////////////////////////////////////////////////////

function combineSnapLines(
    lines1: IClosestSnapLines | undefined,
    lines2: IClosestSnapLines | undefined
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

function findVerticalSnapLinesClosestToRect(snapLines: ISnapLines, rect: Rect) {
    let left = rect.left;
    let width = rect.width;
    let topLines = findClosestVerticalSnapLinesToPosition(snapLines, left);
    let bottomLines = findClosestVerticalSnapLinesToPosition(
        snapLines,
        left + width
    );
    return combineSnapLines(topLines, bottomLines);
}

function findHorizontalSnapLinesClosestToRect(
    snapLines: ISnapLines,
    rect: Rect
) {
    let top = rect.top;
    let height = rect.height;
    let leftLines = findClosestHorizontalSnapLinesToPosition(snapLines, top);
    let rightLines = findClosestHorizontalSnapLinesToPosition(
        snapLines,
        top + height
    );
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
        Math.abs(
            pos -
                ((rect as any)[offsetFieldName] + (rect as any)[sizeFieldName])
        )
    );
}

export function drawSnapLinesGeneric(
    context: IFlowContext,
    snapLines: ISnapLines,
    selectionRect: Rect,
    drawLine: (pos: number, horizontal: boolean, closest: boolean) => void
) {
    let i: ISnapLine | undefined;
    let j: ISnapLine | undefined;
    snapLines.horizontalLines.forEach(line => {
        if (line.pos <= selectionRect.top) {
            i = line;
        } else if (!j && line.pos >= selectionRect.top + selectionRect.height) {
            j = line;
        }
    });

    let k: ISnapLine | undefined;
    let l: ISnapLine | undefined;
    snapLines.verticalLines.forEach(line => {
        if (line.pos <= selectionRect.left) {
            k = line;
        } else if (!l && line.pos >= selectionRect.left + selectionRect.width) {
            l = line;
        }
    });

    snapLines = {
        horizontalLines: i && j ? [i, j] : i ? [i] : j ? [j] : [],
        verticalLines: k && l ? [k, l] : k ? [k] : l ? [l] : []
    };

    let drawnPositions: number[];

    // draw horizontal snap lines
    drawnPositions = [];
    for (let i = 0; i < snapLines.horizontalLines.length; i++) {
        let pos = snapLines.horizontalLines[i].pos;
        if (drawnPositions.indexOf(pos) == -1) {
            // do not draw multiple lines over the same position
            if (
                distanceToRect(pos, selectionRect, "top", "height") <
                MAX_VISIBLE_SNAP_LINE_DISTANCE
            ) {
                drawLine(pos, true, false);
                drawnPositions.push(pos);
            }
        }
    }

    // draw vertical snap lines
    drawnPositions = [];
    for (let i = 0; i < snapLines.verticalLines.length; i++) {
        let pos = snapLines.verticalLines[i].pos;
        if (drawnPositions.indexOf(pos) == -1) {
            // do not draw multiple lines over the same position
            if (
                distanceToRect(pos, selectionRect, "left", "width") <
                MAX_VISIBLE_SNAP_LINE_DISTANCE
            ) {
                drawLine(pos, false, false);
                drawnPositions.push(pos);
            }
        }
    }

    // draw closest horizontal snap lines
    let horizontalSnapLines = findHorizontalSnapLinesClosestToRect(
        snapLines,
        selectionRect
    );
    if (horizontalSnapLines) {
        drawnPositions = [];
        for (let i = 0; i < horizontalSnapLines.lines.length; i++) {
            let pos = horizontalSnapLines.lines[i].pos;
            if (drawnPositions.indexOf(pos) == -1) {
                drawLine(pos, true, true);
                drawnPositions.push(pos);
            }
        }
    }

    // draw closest vertical snap lines
    let verticalSnapLines = findVerticalSnapLinesClosestToRect(
        snapLines,
        selectionRect
    );
    if (verticalSnapLines) {
        drawnPositions = [];
        for (let i = 0; i < verticalSnapLines.lines.length; i++) {
            let pos = verticalSnapLines.lines[i].pos;
            if (drawnPositions.indexOf(pos) == -1) {
                drawLine(pos, false, true);
                drawnPositions.push(pos);
            }
        }
    }
}
