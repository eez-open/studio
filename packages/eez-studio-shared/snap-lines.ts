import { Point, Rect } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

const MAX_SNAP_LINE_DISTANCE = 8;
const MAX_VISIBLE_SNAP_LINE_DISTANCE = 20;

////////////////////////////////////////////////////////////////////////////////

export interface INode {
    id: string;
    rect?: Rect;
    children: INode[];
}

export interface ISnapLine {
    pos: number;
    node: INode;
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
    tree: INode,
    excludeNodes: INode[],
    filterCallback?: (node: INode) => boolean
): ISnapLines {
    function findSnapLinesInTree(offsetFieldName: string, sizeFieldName: string) {
        let lines: ISnapLine[] = [];

        function findSnapLinesInNode(node: INode) {
            if (excludeNodes.indexOf(node) === -1) {
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

                for (let i = 0; i < node.children.length; i++) {
                    findSnapLinesInNode(node.children[i]);
                }
            }
        }

        findSnapLinesInNode(tree);

        return lines.sort((a, b) => (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0));
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
            } else if (result && diff == result.diff && lines[i].pos == result.lines[0].pos) {
                result.lines.push(lines[i]);
            }
        }
    }

    return result;
}

export function findClosestHorizontalSnapLinesToPosition(snapLines: ISnapLines, pos: number) {
    return findClosestSnapLinesToPosition(snapLines.horizontalLines, pos);
}

export function findClosestVerticalSnapLinesToPosition(snapLines: ISnapLines, pos: number) {
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
    let bottomLines = findClosestVerticalSnapLinesToPosition(snapLines, left + width);
    return combineSnapLines(topLines, bottomLines);
}

function findHorizontalSnapLinesClosestToRect(snapLines: ISnapLines, rect: Rect) {
    let top = rect.top;
    let height = rect.height;
    let leftLines = findClosestHorizontalSnapLinesToPosition(snapLines, top);
    let rightLines = findClosestHorizontalSnapLinesToPosition(snapLines, top + height);
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

export function drawSnapLinesGeneric(
    snapLines: ISnapLines,
    selectionRect: Rect,
    drawLine: (pos: number, horizontal: boolean, closest: boolean) => void
) {
    let drawnPositions: number[];

    // draw horizontal snap lines
    drawnPositions = [];
    for (let i = 0; i < snapLines.horizontalLines.length; i++) {
        let pos = snapLines.horizontalLines[i].pos;
        if (drawnPositions.indexOf(pos) == -1) {
            // do not draw multiple lines over the same position
            if (
                distanceToRect(pos, selectionRect, "top", "height") < MAX_VISIBLE_SNAP_LINE_DISTANCE
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
                distanceToRect(pos, selectionRect, "left", "width") < MAX_VISIBLE_SNAP_LINE_DISTANCE
            ) {
                drawLine(pos, false, false);
                drawnPositions.push(pos);
            }
        }
    }

    // draw closest horizontal snap lines
    let horizontalSnapLines = findHorizontalSnapLinesClosestToRect(snapLines, selectionRect);
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
    let verticalSnapLines = findVerticalSnapLinesClosestToRect(snapLines, selectionRect);
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

export interface IDrawTheme {
    lineColor: string;
    lineWidth: number;
    closestLineColor: string;
    closestLineWidth: number;
}

export function drawSnapLines(
    ctx: CanvasRenderingContext2D,
    topLeft: Point,
    bottomRight: Point,
    snapLines: ISnapLines,
    selectionRect: Rect,
    scale: number,
    theme: IDrawTheme
) {
    drawSnapLinesGeneric(
        snapLines,
        selectionRect,
        (pos: number, horizontal: boolean, closest: boolean) => {
            if (closest) {
                ctx.strokeStyle = theme.closestLineColor;
                ctx.lineWidth = theme.closestLineWidth / scale;
            } else {
                ctx.strokeStyle = theme.lineColor;
                ctx.lineWidth = theme.lineWidth / scale;
            }
            ctx.beginPath();
            if (horizontal) {
                ctx.moveTo(topLeft.x, pos);
                ctx.lineTo(bottomRight.x, pos);
            } else {
                ctx.moveTo(pos, topLeft.y);
                ctx.lineTo(pos, bottomRight.y);
            }
            ctx.stroke();
        }
    );
}
