import { getId } from "project-editor/core/object";
import { ConnectionLine } from "project-editor/flow/flow";
import { IFlowContext } from "project-editor/flow/flow-interfaces";

export function getConnectionLineShape(
    context: IFlowContext,
    connectionLine: ConnectionLine
) {
    if (!connectionLine.sourcePosition || !connectionLine.targetPosition) {
        return undefined;
    }

    let sourcePositionX = connectionLine.sourcePosition.x;
    let sourcePositionY = connectionLine.sourcePosition.y;
    let targetPositionX = connectionLine.targetPosition.x;
    let targetPositionY = connectionLine.targetPosition.y;

    const dx = context.viewState.dxMouseDrag ?? 0;
    const dy = context.viewState.dyMouseDrag ?? 0;

    if (dx || dy) {
        if (
            context.viewState.isObjectIdSelected(
                getId(connectionLine.sourceComponent!)
            )
        ) {
            sourcePositionX += dx;
            sourcePositionY += dy;
        }

        if (
            context.viewState.isObjectIdSelected(
                getId(connectionLine.targetComponent!)
            )
        ) {
            targetPositionX += dx;
            targetPositionY += dy;
        }
    }

    const nodeHeight = Math.max(
        connectionLine.sourceRect.height,
        connectionLine.targetRect.height
    );

    return generateNodeRedLinkPath(
        sourcePositionX,
        sourcePositionY,
        targetPositionX,
        targetPositionY,
        1,
        nodeHeight
    );
}

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
        return (
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
            destY
        );
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
        return (
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
            destY
        );
    }
}
