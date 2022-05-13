import { observable } from "mobx";
import {
    midPoint,
    Point,
    pointTranslate,
    Rect
} from "eez-studio-shared/geometry";
import { getId, getParent, IEezObject } from "project-editor/core/object";
import type { ConnectionLine } from "project-editor/flow/flow";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getClassInfo } from "project-editor/store";

export function getConnectionLineShape(
    context: IFlowContext,
    connectionLine: ConnectionLine
) {
    let sourcePositionX = connectionLine.sourcePosition.x;
    let sourcePositionY = connectionLine.sourcePosition.y;

    let targetPositionX = connectionLine.targetPosition.x;
    let targetPositionY = connectionLine.targetPosition.y;

    let sourceRect;
    if (connectionLine.sourceComponent) {
        sourceRect = {
            left: connectionLine.sourceComponent.absolutePositionPoint.x,
            top: connectionLine.sourceComponent.absolutePositionPoint.y,
            width: connectionLine.sourceComponent.width,
            height: connectionLine.sourceComponent.height
        };
    } else {
        sourceRect = {
            left: sourcePositionX,
            top: sourcePositionY,
            width: 1,
            height: 1
        };
    }

    let targetRect;
    if (connectionLine.targetComponent) {
        targetRect = {
            left: connectionLine.targetComponent.absolutePositionPoint.x,
            top: connectionLine.targetComponent.absolutePositionPoint.y,
            width: connectionLine.targetComponent.width,
            height: connectionLine.targetComponent.height
        };
    } else {
        targetRect = {
            left: targetPositionX,
            top: targetPositionY,
            width: 1,
            height: 1
        };
    }

    const dx = context.viewState.dxMouseDrag ?? 0;
    const dy = context.viewState.dyMouseDrag ?? 0;

    function isObjectSelected(object: IEezObject | undefined): boolean {
        if (!object) {
            return false;
        }
        const classInfo = getClassInfo(object);
        if (classInfo.isSelectable != undefined) {
            const isSelectable = classInfo.isSelectable(object);
            if (!isSelectable) {
                return false;
            }
        }
        if (context.viewState.isObjectIdSelected(getId(object))) {
            return true;
        }
        if (object instanceof ProjectEditor.ActionComponentClass) {
            return false;
        }
        return isObjectSelected(getParent(object));
    }

    if (dx || dy) {
        if (isObjectSelected(connectionLine.sourceComponent)) {
            sourcePositionX += dx;
            sourcePositionY += dy;

            sourceRect.left += dx;
            sourceRect.top += dy;
        }

        if (isObjectSelected(connectionLine.targetComponent)) {
            targetPositionX += dx;
            targetPositionY += dy;

            targetRect.left += dx;
            targetRect.top += dy;
        }
    }

    return generateConnectionLinePath(
        { x: sourcePositionX, y: sourcePositionY },
        sourceRect,
        { x: targetPositionX, y: targetPositionY },
        targetRect
    );
}

////////////////////////////////////////////////////////////////////////////////

export function generateConnectionLinePath(
    source: Point,
    sourceRect: Rect | undefined,
    target: Point,
    targetRect: Rect | undefined
) {
    if (!sourceRect || !targetRect || nodeRed.get()) {
        const nodeHeight = Math.max(
            sourceRect?.height ?? 0,
            targetRect?.height ?? 0
        );

        return generateNodeRedLinkPath(
            source.x,
            source.y,
            target.x,
            target.y,
            1,
            nodeHeight
        );
    }

    return generatePath(source, sourceRect, target, targetRect);
}

////////////////////////////////////////////////////////////////////////////////

function pointOnSegment(point1: Point, point2: Point, A: number) {
    return {
        x: point1.x + A * (point2.x - point1.x),
        y: point1.y + A * (point2.y - point1.y)
    };
}

function interpolation3(pointsPolyline: Point[], A: number, B: number) {
    const points = new Array<Point>(
        pointsPolyline.length + (pointsPolyline.length - 2) / 2
    );

    if (pointsPolyline.length == 4) {
        points[0] = pointsPolyline[0];
        points[1] = pointOnSegment(pointsPolyline[0], pointsPolyline[1], A);
        points[2] = pointOnSegment(pointsPolyline[2], pointsPolyline[1], B);
        points[3] = midPoint(pointsPolyline[1], pointsPolyline[2]);
        points[4] = pointOnSegment(pointsPolyline[1], pointsPolyline[2], B);
        points[5] = pointOnSegment(pointsPolyline[3], pointsPolyline[2], A);
        points[6] = pointsPolyline[3];
    } else {
        points[0] = pointsPolyline[0];
        points[1] = pointOnSegment(pointsPolyline[0], pointsPolyline[1], A);
        points[2] = pointOnSegment(pointsPolyline[2], pointsPolyline[1], A);
        points[3] = midPoint(pointsPolyline[1], pointsPolyline[2]);
        points[4] = pointOnSegment(pointsPolyline[1], pointsPolyline[2], B);
        points[5] = pointOnSegment(pointsPolyline[3], pointsPolyline[2], B);
        points[6] = midPoint(pointsPolyline[2], pointsPolyline[3]);
        points[7] = pointOnSegment(pointsPolyline[2], pointsPolyline[3], B);
        points[8] = pointOnSegment(pointsPolyline[4], pointsPolyline[3], B);
        points[9] = midPoint(pointsPolyline[3], pointsPolyline[4]);
        points[10] = pointOnSegment(pointsPolyline[4], pointsPolyline[4], A);
        points[11] = pointOnSegment(pointsPolyline[5], pointsPolyline[4], A);
        points[12] = pointsPolyline[5];
    }

    return points;
}

function generatePath(
    source: Point,
    sourceRect: Rect,
    target: Point,
    targetRect: Rect
) {
    const sourceTop = {
        x: source.x,
        y: sourceRect.top
    };

    const sourceBottom = {
        x: source.x,
        y: sourceRect.top + sourceRect.height
    };

    const targetTop = {
        x: target.x,
        y: targetRect.top
    };

    const targetBottom = {
        x: target.x,
        y: targetRect.top + targetRect.height
    };

    /////
    let pointsPolyline: Point[];

    const SPACE = 30;

    const intersect = !(
        sourceBottom.y < targetTop.y || sourceTop.y > targetBottom.y
    );

    if (source.x + SPACE < target.x || (intersect && source.x < target.x)) {
        const HALF_SPACE = Math.min(SPACE, (target.x - source.x) / 2);
        pointsPolyline = [
            source,
            pointTranslate(source, HALF_SPACE, 0),
            pointTranslate(target, -HALF_SPACE, 0),
            target
        ];
    } else {
        if (intersect) {
            if (
                Math.abs(sourceTop.y - targetTop.y) <
                Math.abs(sourceBottom.y - targetBottom.y)
            ) {
                const y = Math.min(sourceTop.y, targetTop.y);
                pointsPolyline = [
                    source,
                    pointTranslate(source, SPACE, 0),
                    pointTranslate(
                        sourceTop,
                        SPACE,
                        -(sourceTop.y - y + SPACE)
                    ),
                    pointTranslate(
                        targetTop,
                        -SPACE,
                        -(targetTop.y - y + SPACE)
                    ),
                    pointTranslate(target, -SPACE, 0),
                    target
                ];
            } else {
                const y = Math.max(sourceBottom.y, targetBottom.y);
                pointsPolyline = [
                    source,
                    pointTranslate(source, SPACE, 0),
                    pointTranslate(
                        sourceBottom,
                        SPACE,
                        y - sourceBottom.y + SPACE
                    ),
                    pointTranslate(
                        targetBottom,
                        -SPACE,
                        y - targetBottom.y + SPACE
                    ),
                    pointTranslate(target, -SPACE, 0),
                    target
                ];
            }
        } else {
            if (source.y > target.y) {
                const AVAILABLE_SPACE = Math.min(
                    SPACE,
                    (sourceTop.y - targetBottom.y) / 2
                );
                pointsPolyline = [
                    source,
                    pointTranslate(source, SPACE, 0),
                    pointTranslate(sourceTop, SPACE, -AVAILABLE_SPACE),
                    pointTranslate(targetBottom, -SPACE, AVAILABLE_SPACE),
                    pointTranslate(target, -SPACE, 0),
                    target
                ];
            } else {
                const AVAILABLE_SPACE = Math.min(
                    SPACE,
                    (targetTop.y - sourceBottom.y) / 2
                );
                pointsPolyline = [
                    source,
                    pointTranslate(source, SPACE, 0),
                    pointTranslate(sourceBottom, SPACE, AVAILABLE_SPACE),
                    pointTranslate(targetTop, -SPACE, -AVAILABLE_SPACE),
                    pointTranslate(target, -SPACE, 0),
                    target
                ];
            }
        }
    }

    const points = interpolation3(pointsPolyline, 0.8, 0.98);

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 3) {
        path += ` C ${points[i].x} ${points[i].y}, ${points[i + 1].x} ${
            points[i + 1].y
        }, ${points[i + 2].x} ${points[i + 2].y}`;
    }

    return {
        lineShape: path,
        center: points.length == 8 ? midPoint(points[3], points[5]) : points[3]
    };
}

////////////////////////////////////////////////////////////////////////////////

// Node-RED algorithm
const LINE_CURVE_SCALE = 0.75;
const NODE_WIDTH = 100;
function generateNodeRedLinkPath(
    origX: number,
    origY: number,
    destX: number,
    destY: number,
    sc: number,
    nodeHeight: number
) {
    var dy = destY - origY;
    var dx = destX - origX;
    var delta = Math.sqrt(dy * dy + dx * dx);
    var scale = LINE_CURVE_SCALE;
    var scaleY = 0;
    if (dx * sc > 0) {
        if (delta < NODE_WIDTH) {
            scale = 0.75 - 0.75 * ((NODE_WIDTH - delta) / NODE_WIDTH);
        }
    } else {
        scale =
            0.4 -
            0.2 *
                Math.max(
                    0,
                    (NODE_WIDTH - Math.min(Math.abs(dx), Math.abs(dy))) /
                        NODE_WIDTH
                );
    }

    if (dx * sc > 0) {
        return {
            lineShape:
                "M " +
                origX +
                " " +
                origY +
                " C " +
                (origX + sc * (NODE_WIDTH * scale)) +
                " " +
                (origY + scaleY * nodeHeight) +
                " " +
                (destX - sc * scale * NODE_WIDTH) +
                " " +
                (destY - scaleY * nodeHeight) +
                " " +
                destX +
                " " +
                destY,
            center: { x: (origX + destX) / 2, y: (origY + destY) / 2 }
        };
    } else {
        var midX = Math.floor(destX - dx / 2);
        var midY = Math.floor(destY - dy / 2);
        //
        if (dy === 0) {
            midY = destY + nodeHeight;
        }
        var cp_height = nodeHeight / 2;
        var y1 = (destY + midY) / 2;
        var topX = origX + sc * NODE_WIDTH * scale;
        var topY =
            dy > 0
                ? Math.min(y1 - dy / 2, origY + cp_height)
                : Math.max(y1 - dy / 2, origY - cp_height);
        var bottomX = destX - sc * NODE_WIDTH * scale;
        var bottomY =
            dy > 0
                ? Math.max(y1, destY - cp_height)
                : Math.min(y1, destY + cp_height);
        var x1 = (origX + topX) / 2;
        var scy = dy > 0 ? 1 : -1;
        var cp = [
            // Orig -> Top
            [x1, origY],
            [
                topX,
                dy > 0
                    ? Math.max(origY, topY - cp_height)
                    : Math.min(origY, topY + cp_height)
            ],
            // Top -> Mid
            // [Mirror previous cp]
            [
                x1,
                dy > 0
                    ? Math.min(midY, topY + cp_height)
                    : Math.max(midY, topY - cp_height)
            ],
            // Mid -> Bottom
            // [Mirror previous cp]
            [
                bottomX,
                dy > 0
                    ? Math.max(midY, bottomY - cp_height)
                    : Math.min(midY, bottomY + cp_height)
            ],
            // Bottom -> Dest
            // [Mirror previous cp]
            [(destX + bottomX) / 2, destY]
        ];
        if (cp[2][1] === topY + scy * cp_height) {
            if (Math.abs(dy) < cp_height * 10) {
                cp[1][1] = topY - (scy * cp_height) / 2;
                cp[3][1] = bottomY - (scy * cp_height) / 2;
            }
            cp[2][0] = topX;
        }
        return {
            lineShape:
                "M " +
                origX +
                " " +
                origY +
                " C " +
                cp[0][0] +
                " " +
                cp[0][1] +
                " " +
                cp[1][0] +
                " " +
                cp[1][1] +
                " " +
                topX +
                " " +
                topY +
                " S " +
                cp[2][0] +
                " " +
                cp[2][1] +
                " " +
                midX +
                " " +
                midY +
                " S " +
                cp[3][0] +
                " " +
                cp[3][1] +
                " " +
                bottomX +
                " " +
                bottomY +
                " S " +
                cp[4][0] +
                " " +
                cp[4][1] +
                " " +
                destX +
                " " +
                destY,
            center: { x: midX, y: midY }
        };
    }
}

const nodeRed = observable.box<boolean>(false);

document.addEventListener("keydown", event => {
    if (event.ctrlKey && event.shiftKey && event.key == "N") {
        nodeRed.set(!nodeRed.get());
    }
});
