import React from "react";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

import { Point, Rect } from "eez-studio-shared/geometry";
import { _each } from "eez-studio-shared/algorithm";

import { IEezObject, isAncestor } from "project-editor/core/object";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { Component } from "project-editor/flow/component";
import type { Flow } from "project-editor/flow/flow";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { getObjectBoundingRect } from "project-editor/flow/editor/bounding-rects";
import type { EditorFlowContext } from "project-editor/flow/editor/context";

////////////////////////////////////////////////////////////////////////////////

const ADD_MARGIN_RECT = false;

const MAX_SNAP_LINE_DISTANCE = 8;

const SNAP_LINES_DRAW_THEME = {
    lineColor: "red",
    lineWidth: 1,
    lineDasharray: "5 5",

    rectLineColor: "rgba(255, 0, 0, 0.4)",
    rectLineWidth: 1,
    rectLineDasharray: "none",

    marginRectLineColor: "rgba(0, 255, 0, 0.6)",
    marginRectLineWidth: 1,
    marginRectLineDasharray: "none",

    markerSize: 12,
    markerLineColor: "red",
    markerLineWidth: 2
};

export const CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME = 300;

////////////////////////////////////////////////////////////////////////////////

interface SnapRect {
    rect: Rect;
    isMarginRect: boolean;
}

interface ISnapLine {
    pos: number;
    rects: SnapRect[];
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

export function findSnapLines(flowContext: IFlowContext): ISnapLines {
    const selectedObjects = flowContext.viewState.selectedObjects.map(
        objectAdapter => objectAdapter.object
    );

    const isSelectedObject = (object: IEezObject) => {
        return selectedObjects.find(
            selectedObject =>
                selectedObject == object || isAncestor(object, selectedObject)
        );
    };

    let horizontalLines: ISnapLine[] = [];
    let verticalLines: ISnapLine[] = [];

    function findRect(rect: Rect, rects: SnapRect[]) {
        return rects.find(
            snapRect =>
                snapRect.rect.left == rect.left &&
                snapRect.rect.top == rect.top &&
                snapRect.rect.width == rect.width &&
                snapRect.rect.height == rect.height
        );
    }

    function addLine(
        lines: ISnapLine[],
        pos: number,
        rect: Rect,
        isMarginRect: boolean
    ) {
        const line = lines.find(line => line.pos == pos);
        if (line) {
            if (!findRect(rect, line.rects)) {
                line.rects.push({
                    rect,
                    isMarginRect
                });
            }
        } else {
            lines.push({
                pos,
                rects: [
                    {
                        rect,
                        isMarginRect
                    }
                ]
            });
        }
    }

    function addLines(rect: Rect, isMarginRect: boolean) {
        addLine(verticalLines, rect.left, rect, isMarginRect);
        if (rect.width > 0) {
            if (!isMarginRect) {
                addLine(
                    verticalLines,
                    rect.left + rect.width / 2,
                    rect,
                    isMarginRect
                );
            }
            addLine(verticalLines, rect.left + rect.width, rect, isMarginRect);
        }

        addLine(horizontalLines, rect.top, rect, isMarginRect);
        if (rect.width > 0) {
            if (!isMarginRect) {
                addLine(
                    horizontalLines,
                    rect.top + rect.height / 2,
                    rect,
                    isMarginRect
                );
            }
            addLine(
                horizontalLines,
                rect.top + rect.height,
                rect,
                isMarginRect
            );
        }
    }

    function findSnapLinesInNode(node: TreeObjectAdapter) {
        if (
            node.object &&
            (node.object instanceof ProjectEditor.PageClass ||
                node.object instanceof ProjectEditor.ComponentClass) &&
            !isSelectedObject(node.object)
        ) {
            const rect1 = getObjectBoundingRect(node);
            addLines(rect1, false);

            if (ADD_MARGIN_RECT) {
                const marginRect = Object.assign({}, rect1);

                if (
                    node.object instanceof ProjectEditor.PageClass ||
                    node.object instanceof ProjectEditor.ContainerWidgetClass
                ) {
                    // add inner margin for page and container
                    marginRect.left += 10;
                    marginRect.top += 10;
                    marginRect.width -= 20;
                    marginRect.height -= 20;
                    if (marginRect.width > 0 && marginRect.height > 0) {
                        addLines(marginRect, true);
                    }
                } else {
                    // add outer margin for all other widgets
                    marginRect.left -= 10;
                    marginRect.top -= 10;
                    marginRect.width += 20;
                    marginRect.height += 20;
                    addLines(marginRect, true);
                }
            }
        }

        _each(node.children, (item: any) => findSnapLinesInNode(item));
    }

    findSnapLinesInNode(flowContext.document.flow);

    const sortByPos = (a: ISnapLine, b: ISnapLine) =>
        a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0;

    horizontalLines.sort(sortByPos);
    verticalLines.sort(sortByPos);

    return { horizontalLines, verticalLines };
}

////////////////////////////////////////////////////////////////////////////////

function findClosestSnapLinesToPosition(lines: ISnapLine[], pos: number) {
    let result: IClosestSnapLines | undefined;

    for (let i = 0; i < lines.length; i++) {
        let diff = Math.abs(pos - lines[i].pos);
        if (diff < MAX_SNAP_LINE_DISTANCE) {
            if (!result || diff < result.diff) {
                result = {
                    diff,
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

export function drawSnapLinesGeneric(
    snapLines: ISnapLines,
    selectionRect: Rect,
    drawLine: (horizontal: boolean, line: ISnapLine) => void
) {
    {
        const horizontalLines: ISnapLine[] = [];
        snapLines.horizontalLines.forEach(line => {
            if (
                line.pos == selectionRect.top ||
                Math.abs(
                    line.pos - (selectionRect.top + selectionRect.height / 2)
                ) < 1 ||
                line.pos == selectionRect.top + selectionRect.height
            ) {
                horizontalLines.push(line);
            }
        });

        let drawnPositions = [];

        for (const line of horizontalLines) {
            if (drawnPositions.indexOf(line.pos) == -1) {
                drawLine(true, line);
                drawnPositions.push(line.pos);
            }
        }
    }

    {
        const verticalLines: ISnapLine[] = [];

        snapLines.verticalLines.forEach(line => {
            if (
                line.pos == selectionRect.left ||
                Math.abs(
                    line.pos - (selectionRect.left + selectionRect.width / 2)
                ) < 1 ||
                line.pos == selectionRect.left + selectionRect.width
            ) {
                verticalLines.push(line);
            }
        });

        let drawnPositions = [];

        for (const line of verticalLines) {
            if (drawnPositions.indexOf(line.pos) == -1) {
                drawLine(false, line);
                drawnPositions.push(line.pos);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class SnapLines {
    lines: ISnapLines;
    enabled: boolean = false;

    find(context: IFlowContext) {
        this.lines = findSnapLines(context);
    }

    findSnapPosition(
        pos: number,
        findFunc: (
            snapLines: ISnapLines,
            pos: number
        ) => IClosestSnapLines | undefined,
        offsets: number[]
    ) {
        const arr = offsets
            .map(offset => ({
                findResult: findFunc(this.lines, pos + offset),
                offset
            }))
            .filter(item => item.findResult != undefined);

        if (arr.length == 0) {
            return pos;
        }

        arr.sort((a, b) =>
            a.findResult!.diff < b.findResult!.diff
                ? -1
                : a.findResult!.diff > b.findResult!.diff
                ? 1
                : 0
        );

        if (!arr[0].findResult) {
            return pos;
        }

        return Math.round(arr[0].findResult.lines[0].pos - arr[0].offset);
    }

    dragSnap(left: number, top: number, width: number, height: number) {
        if (this.enabled) {
            left = this.findSnapPosition(
                left,
                findClosestVerticalSnapLinesToPosition,
                [0, width / 2, width]
            );

            top = this.findSnapPosition(
                top,
                findClosestHorizontalSnapLinesToPosition,
                [0, height / 2, height]
            );
        }

        return {
            left,
            top
        };
    }

    render(flowContext: IFlowContext, selectionRect: Rect) {
        if (!this.enabled) {
            return null;
        }

        const transform = flowContext.viewState.transform;

        const lines: JSX.Element[] = [];

        const lineStyle: React.CSSProperties = {
            stroke: SNAP_LINES_DRAW_THEME.lineColor,
            strokeWidth: SNAP_LINES_DRAW_THEME.lineWidth,
            strokeDasharray: SNAP_LINES_DRAW_THEME.lineDasharray
        };

        const rects: JSX.Element[] = [];

        const rectStyle: React.CSSProperties = {
            stroke: SNAP_LINES_DRAW_THEME.rectLineColor,
            strokeWidth: SNAP_LINES_DRAW_THEME.rectLineWidth,
            strokeDasharray: SNAP_LINES_DRAW_THEME.rectLineDasharray
        };

        const marginRectStyle: React.CSSProperties = {
            stroke: SNAP_LINES_DRAW_THEME.marginRectLineColor,
            strokeWidth: SNAP_LINES_DRAW_THEME.marginRectLineWidth,
            strokeDasharray: SNAP_LINES_DRAW_THEME.marginRectLineDasharray
        };

        drawSnapLinesGeneric(
            this.lines,
            selectionRect,
            (horizontal: boolean, line: ISnapLine) => {
                const key = line.pos + horizontal.toString();

                let points: Point[] = [];

                if (horizontal) {
                    if (
                        line.pos == selectionRect.top ||
                        line.pos == selectionRect.top + selectionRect.height
                    ) {
                        points.push({
                            x: selectionRect.left,
                            y: line.pos
                        });

                        points.push({
                            x: selectionRect.left + selectionRect.width,
                            y: line.pos
                        });
                    } else {
                        points.push({
                            x:
                                selectionRect.left +
                                Math.round(selectionRect.width / 2),
                            y: line.pos
                        });
                    }

                    line.rects.forEach(snapRect => {
                        points.push({
                            x: snapRect.rect.left,
                            y: line.pos
                        });
                        points.push({
                            x: snapRect.rect.left + snapRect.rect.width,
                            y: line.pos
                        });
                    });

                    points.sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0));
                } else {
                    if (
                        line.pos == selectionRect.left ||
                        line.pos == selectionRect.left + selectionRect.width
                    ) {
                        points.push({
                            x: line.pos,
                            y: selectionRect.top
                        });

                        points.push({
                            x: line.pos,
                            y: selectionRect.top + selectionRect.height
                        });
                    } else {
                        points.push({
                            x: line.pos,
                            y:
                                selectionRect.top +
                                Math.round(selectionRect.height / 2)
                        });
                    }

                    line.rects.forEach(snapRect => {
                        points.push({
                            x: line.pos,
                            y: snapRect.rect.top
                        });
                        points.push({
                            x: line.pos,
                            y: snapRect.rect.top + snapRect.rect.height
                        });
                    });

                    points.sort((a, b) => (a.y < b.y ? -1 : a.y > b.y ? 1 : 0));
                }

                lines.push(
                    <polyline
                        key={key}
                        points={points
                            .map(point => {
                                point = transform.pageToOffsetPoint(point);
                                return `${point.x},${point.y}`;
                            })
                            .join(" ")}
                        style={lineStyle}
                        markerStart="url(#dot)"
                        markerMid="url(#dot)"
                        markerEnd="url(#dot)"
                    />
                );

                line.rects.forEach(snapRect => {
                    const rect = transform.pageToOffsetRect(snapRect.rect);
                    rects.push(
                        <rect
                            key={rects.length}
                            x={rect.left}
                            y={rect.top}
                            width={rect.width}
                            height={rect.height}
                            style={
                                snapRect.isMarginRect
                                    ? marginRectStyle
                                    : rectStyle
                            }
                            fill="none"
                        />
                    );
                });
            }
        );

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        const m = SNAP_LINES_DRAW_THEME.markerSize;

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                <marker
                    id="dot"
                    viewBox={`0 0 ${m} ${m}`}
                    refX={m / 2}
                    refY={m / 2}
                    markerWidth={m / 2}
                    markerHeight={m / 2}
                >
                    <line
                        x1="0"
                        y1="0"
                        x2={m}
                        y2={m}
                        stroke={SNAP_LINES_DRAW_THEME.markerLineColor}
                        strokeWidth={SNAP_LINES_DRAW_THEME.markerLineWidth}
                    />
                    <line
                        x1={m}
                        y1="0"
                        x2="0"
                        y2={m}
                        stroke={SNAP_LINES_DRAW_THEME.markerLineColor}
                        strokeWidth={SNAP_LINES_DRAW_THEME.markerLineWidth}
                    />
                </marker>
                {rects}
                {lines}
            </svg>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DragSnapLines {
    snapLines: SnapLines | undefined;
    flowContext: EditorFlowContext | undefined;
    dragComponent: Component | undefined;

    constructor() {
        makeObservable(this, {
            snapLines: observable
        });
    }

    start(flowContext: EditorFlowContext) {
        this.snapLines = new SnapLines();
        this.flowContext = flowContext;
        this.dragComponent = flowContext.dragComponent;

        this.snapLines.find(flowContext);
    }

    clear() {
        this.snapLines = undefined;
        this.flowContext = undefined;
        this.dragComponent = undefined;
    }
}

export const DragSnapLinesOverlay = observer(
    class DragSnapLinesOverlay extends React.Component<{
        dragSnapLines: DragSnapLines;
    }> {
        render() {
            const { dragSnapLines } = this.props;

            if (!dragSnapLines.snapLines) {
                return null;
            }

            const flow = dragSnapLines.flowContext!.document.flow
                .object as Flow;
            const dragComponent = dragSnapLines.dragComponent!;

            return (
                <div style={{ left: 0, top: 0, pointerEvents: "none" }}>
                    {dragSnapLines.snapLines.render(
                        dragSnapLines.flowContext!,
                        {
                            left:
                                (dragComponent instanceof
                                ProjectEditor.WidgetClass
                                    ? flow.pageRect.left
                                    : 0) + dragComponent.left,
                            top:
                                (dragComponent instanceof
                                ProjectEditor.WidgetClass
                                    ? flow.pageRect.top
                                    : 0) + dragComponent.top,
                            width: dragComponent.rect.width,
                            height: dragComponent.rect.height
                        }
                    )}
                </div>
            );
        }
    }
);
