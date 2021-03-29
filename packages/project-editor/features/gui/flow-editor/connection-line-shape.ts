import { getId } from "project-editor/core/object";
import { ConnectionLine } from "project-editor/features/gui/flow";
import { IDesignerContext } from "./designer-interfaces";

export function getConnectionLineShape(
    context: IDesignerContext,
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

    return generateNodeRedLinkPath(
        sourcePositionX,
        sourcePositionY,
        targetPositionX,
        targetPositionY,
        1
    );
}

// Node-RED algorithm
const lineCurveScale = 0.75;
const node_width = 100;
const node_height = 30;
function generateNodeRedLinkPath(
    origX: number,
    origY: number,
    destX: number,
    destY: number,
    sc: number
) {
    var dy = destY - origY;
    var dx = destX - origX;
    var delta = Math.sqrt(dy * dy + dx * dx);
    var scale = lineCurveScale;
    var scaleY = 0;
    if (dx * sc > 0) {
        if (delta < node_width) {
            scale = 0.75 - 0.75 * ((node_width - delta) / node_width);
            // scale += 2 * (Math.min(5 * node_width, Math.abs(dx)) / (5 * node_width));
            // if (Math.abs(dy) < 3 * node_height) {
            //     scaleY =
            //         (dy > 0 ? 0.5 : -0.5) *
            //         ((3 * node_height - Math.abs(dy)) / (3 * node_height)) *
            //         (Math.min(node_width, Math.abs(dx)) / node_width);
            // }
        }
    } else {
        scale =
            0.4 -
            0.2 *
                Math.max(
                    0,
                    (node_width - Math.min(Math.abs(dx), Math.abs(dy))) /
                        node_width
                );
    }
    if (dx * sc > 0) {
        return (
            "M " +
            origX +
            " " +
            origY +
            " C " +
            (origX + sc * (node_width * scale)) +
            " " +
            (origY + scaleY * node_height) +
            " " +
            (destX - sc * scale * node_width) +
            " " +
            (destY - scaleY * node_height) +
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
            midY = destY + node_height;
        }
        var cp_height = node_height / 2;
        var y1 = (destY + midY) / 2;
        var topX = origX + sc * node_width * scale;
        var topY =
            dy > 0
                ? Math.min(y1 - dy / 2, origY + cp_height)
                : Math.max(y1 - dy / 2, origY - cp_height);
        var bottomX = destX - sc * node_width * scale;
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
