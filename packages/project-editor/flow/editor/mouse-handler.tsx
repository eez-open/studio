import React from "react";
import { observable, action, runInAction, makeObservable } from "mobx";

import { Point, Rect, rectEqual, rectClone } from "eez-studio-shared/geometry";
import {
    CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME,
    findClosestHorizontalSnapLinesToPosition,
    findClosestVerticalSnapLinesToPosition,
    SnapLines
} from "project-editor/flow/editor/snap-lines";
import { addAlphaToColor } from "eez-studio-shared/color";

import { theme } from "eez-studio-ui/theme";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    getSelectedObjectsBoundingRect,
    getObjectIdFromPoint,
    getObjectBoundingRect
} from "project-editor/flow/editor/bounding-rects";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import type { Transform } from "project-editor/flow/editor/transform";
import { generateConnectionLinePath } from "project-editor/flow/connection-line/connection-line-shape";
import type { Flow } from "project-editor/flow/flow";
import type { ConnectionLine } from "project-editor/flow/connection-line";
import { getId } from "project-editor/core/object";
import type { Component } from "project-editor/flow/component";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { LVGLWidget } from "project-editor/lvgl/widgets/Base";

////////////////////////////////////////////////////////////////////////////////

const CONNECTION_LINE_DRAW_THEME = {
    lineColor: "rgba(128, 128, 128, 1)",
    lineWidth: 2.0,
    connectedLineColor: "rgb(32, 192, 32)",
    connectedLineWidth: 2.0
};

////////////////////////////////////////////////////////////////////////////////

export interface IMouseHandler {
    cursor: string;
    lastPointerEvent: IPointerEvent;
    down(context: IFlowContext, event: IPointerEvent): void;
    move(context: IFlowContext, event: IPointerEvent): void;
    up(context: IFlowContext, cancel: boolean): void;
    render?(context: IFlowContext): React.ReactNode;
    onTransformChanged(context: IFlowContext): void;
}

export interface IPointerEvent {
    clientX: number;
    clientY: number;
    movementX: number;
    movementY: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    timeStamp: number;
}

////////////////////////////////////////////////////////////////////////////////

export function isSelectionMoveable(context: IFlowContext) {
    return context.viewState.selectedObjects.find(object => object.isMoveable);
}

////////////////////////////////////////////////////////////////////////////////

export class MouseHandler implements IMouseHandler {
    constructor() {}

    timeAtDown: number;
    elapsedTime: number;

    offsetPointAtDown: Point;
    lastOffsetPoint: Point;
    offsetDistance: Point;
    movement: Point;
    distance: number;

    modelPointAtDown: Point;
    lastModelPoint: Point;
    modelDistance: Point;

    cursor: string = "default";

    transform: Transform;

    lastPointerEvent!: IPointerEvent;

    down(context: IFlowContext, event: IPointerEvent) {
        this.transform = context.viewState.transform;

        this.timeAtDown = event.timeStamp;

        this.lastOffsetPoint = this.offsetPointAtDown =
            this.transform.pointerEventToOffsetPoint(event);
        this.offsetDistance = { x: 0, y: 0 };
        this.distance = 0;
        this.movement = { x: 0, y: 0 };

        this.modelPointAtDown = this.transform.pointerEventToPagePoint(event);
        this.modelDistance = { x: 0, y: 0 };
    }

    move(context: IFlowContext, event: IPointerEvent) {
        this.transform = context.viewState.transform;

        this.elapsedTime = event.timeStamp - this.timeAtDown;

        let offsetPoint = this.transform.pointerEventToOffsetPoint(event);

        this.offsetDistance = {
            x: offsetPoint.x - this.offsetPointAtDown.x,
            y: offsetPoint.y - this.offsetPointAtDown.y
        };

        this.distance = Math.sqrt(
            this.offsetDistance.x * this.offsetDistance.x +
                this.offsetDistance.y * this.offsetDistance.y
        );

        this.movement = {
            x: offsetPoint.x - this.lastOffsetPoint.x,
            y: offsetPoint.y - this.lastOffsetPoint.y
        };

        this.lastOffsetPoint = offsetPoint;

        this.lastModelPoint = this.transform.pointerEventToPagePoint(event);

        this.modelDistance = {
            x: this.lastModelPoint.x - this.modelPointAtDown.x,
            y: this.lastModelPoint.y - this.modelPointAtDown.y
        };
    }

    up(context: IFlowContext, cancel: boolean) {}

    onTransformChanged(context: IFlowContext) {
        const transform = context.viewState.transform;

        let point = this.transform.offsetToPagePoint(this.offsetPointAtDown);
        this.offsetPointAtDown = transform.pageToOffsetPoint(point);

        point = this.transform.offsetToPagePoint(this.lastOffsetPoint);
        this.lastOffsetPoint = transform.pageToOffsetPoint(point);

        this.offsetDistance = {
            x: this.lastOffsetPoint.x - this.offsetPointAtDown.x,
            y: this.lastOffsetPoint.y - this.offsetPointAtDown.y
        };

        this.distance = Math.sqrt(
            this.offsetDistance.x * this.offsetDistance.x +
                this.offsetDistance.y * this.offsetDistance.y
        );

        this.modelPointAtDown = transform.offsetToPagePoint(
            this.offsetPointAtDown
        );
        this.lastModelPoint = transform.offsetToPagePoint(this.lastOffsetPoint);

        this.movement = {
            x: 0,
            y: 0
        };

        const pointerEvent = Object.assign({}, this.lastPointerEvent);

        point = this.transform.clientToPagePoint({
            x: pointerEvent.clientX,
            y: pointerEvent.clientY
        });
        const clientPoint = transform.pageToClientPoint(point);
        pointerEvent.movementX = clientPoint.x - pointerEvent.clientX;
        pointerEvent.movementY = clientPoint.y - pointerEvent.clientY;
        pointerEvent.clientX = clientPoint.x;
        pointerEvent.clientY = clientPoint.y;

        this.transform = transform;

        this.move(context, pointerEvent);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PanMouseHandler extends MouseHandler {
    totalMovement = {
        x: 0,
        y: 0
    };

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);
        context.viewState.transform.translateBy(this.movement);
        this.totalMovement.x += this.movement.x;
        this.totalMovement.y += this.movement.y;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPanMouseHandler extends MouseHandler {
    constructor(public lvglWidget: LVGLWidget) {
        super();
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        runInAction(() => {
            this.lvglWidget._xScroll = this.lvglWidget._xScroll2 =
                this.lvglWidget._xScroll2 - this.movement.x;
            this.lvglWidget._yScroll = this.lvglWidget._yScroll2 =
                this.lvglWidget._yScroll2 - this.movement.y;
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class RubberBandSelectionMouseHandler extends MouseHandler {
    rubberBendRect: Rect | undefined;

    constructor() {
        super();

        makeObservable(this, {
            rubberBendRect: observable,
            move: action
        });
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);
        context.viewState.deselectAllObjects();
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        let left;
        let top;
        let width;
        let height;

        if (this.offsetPointAtDown.x < this.lastOffsetPoint.x) {
            left = this.offsetPointAtDown.x;
            width = this.lastOffsetPoint.x - this.offsetPointAtDown.x;
        } else {
            left = this.lastOffsetPoint.x;
            width = this.offsetPointAtDown.x - this.lastOffsetPoint.x;
        }

        if (this.offsetPointAtDown.y < this.lastOffsetPoint.y) {
            top = this.offsetPointAtDown.y;
            height = this.lastOffsetPoint.y - this.offsetPointAtDown.y;
        } else {
            top = this.lastOffsetPoint.y;
            height = this.offsetPointAtDown.y - this.lastOffsetPoint.y;
        }

        const rubberBendRect = {
            left,
            top,
            width,
            height
        };

        this.rubberBendRect = rubberBendRect;

        context.viewState.selectObjects(
            context.document.getObjectsInsideRect(
                context.viewState.transform.offsetToPageRect(rubberBendRect)
            )
        );
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        runInAction(() => {
            this.rubberBendRect = undefined;
        });
    }

    render(context: IFlowContext) {
        return (
            this.rubberBendRect && (
                <div
                    className="EezStudio_FlowEditorSelection_RubberBend"
                    style={{
                        position: "absolute",
                        left: this.rubberBendRect.left,
                        top: this.rubberBendRect.top,
                        width: this.rubberBendRect.width,
                        height: this.rubberBendRect.height,
                        backgroundColor: addAlphaToColor(
                            theme().selectionBackgroundColor,
                            0.5
                        ),
                        border: `1px solid ${theme().selectionBackgroundColor}`
                    }}
                />
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MouseHandlerWithSnapLines extends MouseHandler {
    snapLines = new SnapLines();

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        this.snapLines.find(context);
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        this.snapLines.enabled =
            !event.shiftKey &&
            this.elapsedTime > CONF_ACTIVATE_SNAP_TO_LINES_AFTER_TIME;
    }

    render(context: IFlowContext) {
        const rect = getSelectedObjectsBoundingRect(context.viewState);
        const dxMouseDrag = context.viewState.dxMouseDrag;
        const dyMouseDrag = context.viewState.dyMouseDrag;
        if (!context.projectStore.projectTypeTraits.isDashboard) {
            rect.left += dxMouseDrag ?? 0;
            rect.top += dyMouseDrag ?? 0;
        }
        return this.snapLines.render(context, rect);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DragMouseHandler extends MouseHandlerWithSnapLines {
    selectedObjects: TreeObjectAdapter[];

    changed: boolean = false;
    rects: Rect[] = [];

    selectionBoundingRectAtDown: Rect;
    objectPositionsAtDown: Point[];

    left: number;
    top: number;

    selectionNode: HTMLElement;
    objectNodes: HTMLElement[];

    constructor() {
        super();

        makeObservable(this, {
            move: action,
            up: action
        });
    }

    getConnectionLineAlignedY(
        context: IFlowContext,
        event: IPointerEvent,
        left: number,
        top: number
    ) {
        if (!event.ctrlKey) {
            return undefined;
        }

        const dxMouseDrag = left - this.selectionBoundingRectAtDown.left;
        const dyMouseDrag = top - this.selectionBoundingRectAtDown.top;

        let foundConnectionLine;
        let foundLength = 0;

        for (const connectionLine of (context.document.flow.object as Flow)
            .connectionLines) {
            const sourceComponentIndex = this.selectedObjects.findIndex(
                selectedObject =>
                    selectedObject.object == connectionLine.sourceComponent
            );

            const targetComponentIndex = this.selectedObjects.findIndex(
                selectedObject =>
                    selectedObject.object == connectionLine.targetComponent
            );

            if (
                (sourceComponentIndex != -1 && targetComponentIndex != -1) ||
                (sourceComponentIndex == -1 && targetComponentIndex == -1)
            ) {
                continue;
            }

            let sourceOutputX;
            let sourceOutputY;
            let targetInputX;
            let targetInputY;

            const outputPos =
                connectionLine.sourceComponent.geometry.outputs[
                    connectionLine.output
                ].position;

            const inputPos =
                connectionLine.targetComponent.geometry.inputs[
                    connectionLine.input
                ].position;

            if (sourceComponentIndex != -1) {
                sourceOutputX =
                    this.objectPositionsAtDown[sourceComponentIndex].x +
                    dxMouseDrag +
                    outputPos.x;

                sourceOutputY =
                    this.objectPositionsAtDown[sourceComponentIndex].y +
                    dyMouseDrag +
                    outputPos.y;

                targetInputX =
                    connectionLine.targetComponent.geometry.left + inputPos.x;

                targetInputY =
                    connectionLine.targetComponent.geometry.top + inputPos.y;
            } else {
                sourceOutputX =
                    connectionLine.sourceComponent.geometry.left + outputPos.x;

                sourceOutputY =
                    connectionLine.sourceComponent.geometry.top + outputPos.y;

                targetInputX =
                    this.objectPositionsAtDown[targetComponentIndex].x +
                    dxMouseDrag +
                    inputPos.x;

                targetInputY =
                    this.objectPositionsAtDown[targetComponentIndex].y +
                    dyMouseDrag +
                    inputPos.y;
            }

            if (sourceOutputX < targetInputX) {
                const dx = targetInputX - sourceOutputX;
                const dy = targetInputY - sourceOutputY;
                const length = dx * dx + dy * dy;

                if (!foundConnectionLine || length < foundLength) {
                    foundConnectionLine = connectionLine;
                    foundLength = length;
                }
            }
        }

        if (!foundConnectionLine) {
            return undefined;
        }

        const sourceComponentIndex = this.selectedObjects.findIndex(
            selectedObject =>
                selectedObject.object == foundConnectionLine.sourceComponent
        );

        if (sourceComponentIndex != -1) {
            const topTarget = foundConnectionLine.targetComponent.top;
            const topBounding = this.selectionBoundingRectAtDown.top;
            const topSource =
                this.objectPositionsAtDown[sourceComponentIndex].y;

            const sourceOutputY =
                foundConnectionLine.sourceComponent.geometry.outputs[
                    foundConnectionLine.output
                ].position.y;

            const targetInputY =
                foundConnectionLine.targetComponent.geometry.inputs[
                    foundConnectionLine.input
                ].position.y;

            return (
                topTarget +
                (topBounding - topSource) -
                (sourceOutputY - targetInputY)
            );
        } else {
            const targetComponentIndex = this.selectedObjects.findIndex(
                selectedObject =>
                    selectedObject.object == foundConnectionLine.targetComponent
            );

            const topSource = foundConnectionLine.sourceComponent.top;

            const topBounding = this.selectionBoundingRectAtDown.top;
            const topTarget =
                this.objectPositionsAtDown[targetComponentIndex].y;

            const sourceOutputY =
                foundConnectionLine.sourceComponent.geometry.outputs[
                    foundConnectionLine.output
                ].position.y;

            const targetInputY =
                foundConnectionLine.targetComponent.geometry.inputs[
                    foundConnectionLine.input
                ].position.y;

            return (
                topSource +
                (topBounding - topTarget) -
                (targetInputY - sourceOutputY)
            );
        }
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        this.selectionBoundingRectAtDown = rectClone(
            getSelectedObjectsBoundingRect(context.viewState)
        );

        this.selectedObjects = context.viewState.selectedObjects.filter(
            selectedObject => selectedObject.isMoveable
        );

        this.objectPositionsAtDown = this.selectedObjects.map(object => ({
            x: object.rect.left,
            y: object.rect.top
        }));

        this.left = this.selectionBoundingRectAtDown.left;
        this.top = this.selectionBoundingRectAtDown.top;
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        this.left += this.movement.x / context.viewState.transform.scale;
        this.top += this.movement.y / context.viewState.transform.scale;

        if (this.elapsedTime < 200 && this.distance < 10) {
            return;
        }

        let { left, top } = this.snapLines.dragSnap(
            this.left,
            this.top,
            this.selectionBoundingRectAtDown.width,
            this.selectionBoundingRectAtDown.height
        );

        const connectionLineAlignedY = this.getConnectionLineAlignedY(
            context,
            event,
            left,
            top
        );
        if (connectionLineAlignedY) {
            top = connectionLineAlignedY;
        }

        const viewState = context.viewState;

        viewState.dxMouseDrag = left - this.selectionBoundingRectAtDown.left;
        viewState.dyMouseDrag = top - this.selectionBoundingRectAtDown.top;

        if (!this.selectionNode) {
            const container = document.getElementById(
                context.viewState.containerId
            )!;

            this.selectionNode = container.querySelector(
                ".EezStudio_FlowEditorSelection_Draggable"
            ) as HTMLElement;

            this.objectNodes = this.selectedObjects.map(
                selectedObject =>
                    container.querySelector(
                        `[data-eez-flow-object-id="${selectedObject.id}"]`
                    ) as HTMLElement
            );
        }

        if (!context.projectStore.projectTypeTraits.isDashboard) {
            this.selectionNode.style.transform = `translate(${Math.round(
                viewState.dxMouseDrag * context.viewState.transform.scale
            )}px, ${Math.round(
                viewState.dyMouseDrag * context.viewState.transform.scale
            )}px)`;
        }

        this.changed = false;

        for (let i = 0; i < this.selectedObjects.length; ++i) {
            const object = this.selectedObjects[i];

            this.rects[i] = {
                left: Math.round(
                    this.objectPositionsAtDown[i].x + viewState.dxMouseDrag
                ),
                top: Math.round(
                    this.objectPositionsAtDown[i].y + viewState.dyMouseDrag
                ),
                width: object.rect.width,
                height: object.rect.height
            };

            if (!rectEqual(this.rects[i], object.rect)) {
                this.changed = true;
            }

            const node = this.objectNodes[i];
            node.style.left = this.rects[i].left + "px";
            node.style.top = this.rects[i].top + "px";
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        if (this.objectNodes) {
            for (let i = 0; i < this.objectNodes.length; ++i) {
                const node = this.objectNodes[i];
                node.style.left = this.objectPositionsAtDown[i].x + "px";
                node.style.top = this.objectPositionsAtDown[i].y + "px";
            }
        }

        if (this.changed) {
            for (let i = 0; i < this.selectedObjects.length; ++i) {
                const object = this.selectedObjects[i];
                const rect = this.rects[i];
                if (!rectEqual(rect, object.rect)) {
                    object.rect = rect;
                }
            }
        }

        if (!context.projectStore.projectTypeTraits.isDashboard) {
            if (this.selectionNode) {
                this.selectionNode.style.transform = "";
                this.selectionNode.style.display = "none";
            }
        }

        context.viewState.dxMouseDrag = undefined;
        context.viewState.dyMouseDrag = undefined;

        context.document.onDragEnd();
    }
}

////////////////////////////////////////////////////////////////////////////////

type ResizeHandleType =
    | "nw-resize"
    | "n-resize"
    | "ne-resize"
    | "w-resize"
    | "e-resize"
    | "sw-resize"
    | "s-resize"
    | "se-resize";

export class ResizeMouseHandler extends MouseHandlerWithSnapLines {
    savedRect: Rect;
    rect: Rect;

    changed: boolean = false;

    object: TreeObjectAdapter;

    xSnapOffset: number = 0;
    ySnapOffset: number = 0;

    constructor(private handleType: ResizeHandleType) {
        super();

        makeObservable(this, {
            move: action
        });
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        this.object = context.viewState.selectedObjects[0];

        context.document.onDragStart();

        this.savedRect = rectClone(this.object.rect);
        this.rect = rectClone(this.object.rect);

        const rect = getObjectBoundingRect(context.viewState, this.object);
        this.xSnapOffset = rect.left - this.rect.left;
        this.ySnapOffset = rect.top - this.rect.top;
    }

    snapX(x: number) {
        x = Math.round(x);
        if (this.snapLines.enabled) {
            let findResult = findClosestVerticalSnapLinesToPosition(
                this.snapLines.lines,
                x + this.xSnapOffset
            );
            return findResult
                ? Math.round(findResult.lines[0].pos) - this.xSnapOffset
                : x;
        } else {
            return x;
        }
    }

    snapY(y: number) {
        y = Math.round(y);
        if (this.snapLines.enabled) {
            let findResult = findClosestHorizontalSnapLinesToPosition(
                this.snapLines.lines,
                y + this.ySnapOffset
            );
            return findResult
                ? Math.round(findResult.lines[0].pos) - this.ySnapOffset
                : y;
        } else {
            return y;
        }
    }

    moveTop(context: IFlowContext, savedRect: Rect, rect: Rect) {
        let bottom = rect.top + rect.height;
        rect.top = this.snapY(
            savedRect.top +
                this.offsetDistance.y / context.viewState.transform.scale
        );
        if (rect.top >= bottom) {
            rect.top = bottom - 1;
        }
        rect.height = bottom - rect.top;
    }

    moveLeft(context: IFlowContext, savedRect: Rect, rect: Rect) {
        let right = rect.left + rect.width;
        rect.left = this.snapX(
            savedRect.left +
                this.offsetDistance.x / context.viewState.transform.scale
        );
        if (rect.left >= right) {
            rect.left = right - 1;
        }
        rect.width = right - rect.left;
    }

    moveBottom(context: IFlowContext, savedRect: Rect, rect: Rect) {
        let bottom = this.snapY(
            savedRect.top +
                savedRect.height +
                this.offsetDistance.y / context.viewState.transform.scale
        );
        if (bottom <= rect.top) {
            bottom = rect.top + 1;
        }
        rect.height = bottom - rect.top;
    }

    moveRight(context: IFlowContext, savedRect: Rect, rect: Rect) {
        let right = this.snapX(
            savedRect.left +
                savedRect.width +
                this.offsetDistance.x / context.viewState.transform.scale
        );
        if (right <= rect.left) {
            right = rect.left + 1;
        }
        rect.width = right - rect.left;
    }

    resizeRect(context: IFlowContext, savedRect: Rect, rect: Rect) {
        if (this.handleType === "nw-resize") {
            this.moveTop(context, savedRect, rect);
            this.moveLeft(context, savedRect, rect);
        } else if (this.handleType === "n-resize") {
            this.moveTop(context, savedRect, rect);
        } else if (this.handleType === "ne-resize") {
            this.moveTop(context, savedRect, rect);
            this.moveRight(context, savedRect, rect);
        } else if (this.handleType === "w-resize") {
            this.moveLeft(context, savedRect, rect);
        } else if (this.handleType === "e-resize") {
            this.moveRight(context, savedRect, rect);
        } else if (this.handleType === "sw-resize") {
            this.moveBottom(context, savedRect, rect);
            this.moveLeft(context, savedRect, rect);
        } else if (this.handleType === "s-resize") {
            this.moveBottom(context, savedRect, rect);
        } else if (this.handleType === "se-resize") {
            this.moveBottom(context, savedRect, rect);
            this.moveRight(context, savedRect, rect);
        }
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        this.resizeRect(context, this.savedRect, this.rect);

        if (!rectEqual(this.rect, this.object.rect)) {
            this.changed = true;
            this.object.rect = {
                left: Math.floor(this.rect.left),
                top: Math.floor(this.rect.top),
                width: Math.floor(this.rect.width),
                height: Math.floor(this.rect.height)
            };
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        context.document.onDragEnd();
    }
}

////////////////////////////////////////////////////////////////////////////////

const lineStyle = {
    stroke: CONNECTION_LINE_DRAW_THEME.lineColor,
    strokeWidth: CONNECTION_LINE_DRAW_THEME.lineWidth,
    fill: "none"
};

const connectedLineStyle = {
    stroke: CONNECTION_LINE_DRAW_THEME.connectedLineColor,
    strokeWidth: CONNECTION_LINE_DRAW_THEME.connectedLineWidth,
    fill: "none"
};

export class NewConnectionLineFromOutputMouseHandler extends MouseHandler {
    startPoint: Point;
    endPoint: Point;
    target:
        | {
              objectId: string;
              connectionInput: string;
          }
        | undefined;

    cursor: string = "crosshair";

    sourceRect: Rect;
    targetRect: Rect | undefined;

    constructor(
        private sourceObject: TreeObjectAdapter,
        private connectionOutput: string
    ) {
        super();

        makeObservable(this, {
            startPoint: observable,
            endPoint: observable,
            target: observable.shallow,
            down: action,
            move: action,
            onTransformChanged: action
        });
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        const container = document.getElementById(
            context.viewState.containerId
        )!;

        const sourceNode = container!.querySelector(
            `[data-eez-flow-object-id="${this.sourceObject.id}"]`
        )!;

        const sourceNodeBoundingClientRect = sourceNode.getBoundingClientRect();
        this.sourceRect = context.viewState.transform.clientToOffsetRect(
            sourceNodeBoundingClientRect
        );

        const nodeOutput = getConnectionOutputNode(
            sourceNode,
            this.connectionOutput
        )!;

        const nodeOutputBoundingClientRect = nodeOutput.getBoundingClientRect();
        const nodeOutputPageRect =
            context.viewState.transform.clientToOffsetRect(
                nodeOutputBoundingClientRect
            );

        this.startPoint = {
            x: nodeOutputPageRect.left + nodeOutputPageRect.width,
            y: nodeOutputPageRect.top + nodeOutputPageRect.height / 2
        };

        this.endPoint = this.lastOffsetPoint;
        this.target = undefined;
        this.targetRect = undefined;
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        const result = getObjectIdFromPoint(
            context.document,
            context.viewState,
            this.lastModelPoint
        );

        if (
            result &&
            result.connectionInput &&
            !context.document.connectionExists(
                this.sourceObject.id,
                this.connectionOutput,
                result.id,
                result.connectionInput
            )
        ) {
            const container = document.getElementById(
                context.viewState.containerId
            )!;

            const targetNode = container!.querySelector(
                `[data-eez-flow-object-id="${result.id}"]`
            )!;

            const targetNodeBoundingClientRect =
                targetNode.getBoundingClientRect();
            this.targetRect = context.viewState.transform.clientToOffsetRect(
                targetNodeBoundingClientRect
            );

            const nodeInput = getConnectionInputNode(
                targetNode,
                result.connectionInput
            )!;

            const nodeInputBoundingClientRect =
                nodeInput.getBoundingClientRect();
            const nodeInputPageRect =
                context.viewState.transform.clientToOffsetRect(
                    nodeInputBoundingClientRect
                );

            this.endPoint = {
                x: nodeInputPageRect.left,
                y: nodeInputPageRect.top + nodeInputPageRect.height / 2
            };
            this.target = {
                objectId: result.id,
                connectionInput: result.connectionInput
            };
        } else {
            this.endPoint = this.lastOffsetPoint;
            this.target = undefined;
            this.targetRect = undefined;
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        if (!cancel) {
            if (this.target) {
                context.document.connect(
                    this.sourceObject.id,
                    this.connectionOutput,
                    this.target.objectId,
                    this.target.connectionInput
                );
            } else if (this.distance >= 20) {
                context.document.connectToNewTarget(
                    this.sourceObject.id,
                    this.connectionOutput,
                    context.viewState.transform.offsetToPagePoint(this.endPoint)
                );
            }
        }

        context.document.onDragEnd();
    }

    render(context: IFlowContext) {
        const transform = context.viewState.transform;

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        const { lineShape } = generateConnectionLinePath(
            this.startPoint,
            this.sourceRect,
            this.endPoint,
            this.targetRect
        );

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                <path
                    d={lineShape}
                    style={this.target ? connectedLineStyle : lineStyle}
                />
            </svg>
        );
    }

    onTransformChanged(context: IFlowContext) {
        const startClientPoint = this.transform.offsetToPagePoint(
            this.startPoint
        );
        this.startPoint =
            context.viewState.transform.pageToOffsetPoint(startClientPoint);

        super.onTransformChanged(context);
    }
}

export class NewConnectionLineFromInputMouseHandler extends MouseHandler {
    startPoint: Point;
    endPoint: Point;
    source:
        | {
              objectId: string;
              connectionOutput: string;
          }
        | undefined;

    cursor: string = "crosshair";

    sourceRect: Rect | undefined;
    targetRect: Rect;

    constructor(
        private targetObject: TreeObjectAdapter,
        private connectionInput: string
    ) {
        super();

        makeObservable(this, {
            startPoint: observable,
            endPoint: observable,
            source: observable.shallow,
            down: action,
            move: action,
            onTransformChanged: action
        });
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        const container = document.getElementById(
            context.viewState.containerId
        )!;

        const targetNode = container!.querySelector(
            `[data-eez-flow-object-id="${this.targetObject.id}"]`
        )!;

        const targetNodeBoundingClientRect = targetNode.getBoundingClientRect();
        this.targetRect = context.viewState.transform.clientToOffsetRect(
            targetNodeBoundingClientRect
        );

        const nodeInput = getConnectionInputNode(
            targetNode,
            this.connectionInput
        )!;

        const nodeInputBoundingClientRect = nodeInput.getBoundingClientRect();
        const nodeInputPageRect =
            context.viewState.transform.clientToOffsetRect(
                nodeInputBoundingClientRect
            );

        this.endPoint = {
            x: nodeInputPageRect.left,
            y: nodeInputPageRect.top + nodeInputPageRect.height / 2
        };

        this.startPoint = this.lastOffsetPoint;
        this.source = undefined;
        this.sourceRect = undefined;
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        const result = getObjectIdFromPoint(
            context.document,
            context.viewState,
            this.lastModelPoint
        );

        if (
            result &&
            result.connectionOutput &&
            !context.document.connectionExists(
                result.id,
                result.connectionOutput,
                this.targetObject.id,
                this.connectionInput
            )
        ) {
            const container = document.getElementById(
                context.viewState.containerId
            )!;

            const sourceNode = container!.querySelector(
                `[data-eez-flow-object-id="${result.id}"]`
            )!;

            const sourceNodeBoundingClientRect =
                sourceNode.getBoundingClientRect();
            this.sourceRect = context.viewState.transform.clientToOffsetRect(
                sourceNodeBoundingClientRect
            );

            const nodeOutput = getConnectionOutputNode(
                sourceNode,
                result.connectionOutput
            )!;

            const nodeOutputBoundingClientRect =
                nodeOutput.getBoundingClientRect();
            const nodeOutputPageRect =
                context.viewState.transform.clientToOffsetRect(
                    nodeOutputBoundingClientRect
                );

            this.startPoint = {
                x: nodeOutputPageRect.left + nodeOutputPageRect.width,
                y: nodeOutputPageRect.top + nodeOutputPageRect.height / 2
            };
            this.source = {
                objectId: result.id,
                connectionOutput: result.connectionOutput
            };
        } else {
            this.startPoint = this.lastOffsetPoint;
            this.source = undefined;
            this.sourceRect = undefined;
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        if (!cancel) {
            if (this.source) {
                context.document.connect(
                    this.source.objectId,
                    this.source.connectionOutput,
                    this.targetObject.id,
                    this.connectionInput
                );
            } else if (this.distance >= 20) {
                context.document.connectToNewSource(
                    this.targetObject.id,
                    this.connectionInput,
                    context.viewState.transform.offsetToPagePoint(
                        this.startPoint
                    )
                );
            }
        }

        context.document.onDragEnd();
    }

    render(context: IFlowContext) {
        const transform = context.viewState.transform;

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        const { lineShape } = generateConnectionLinePath(
            this.startPoint,
            this.sourceRect,
            this.endPoint,
            this.targetRect
        );

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                <path
                    d={lineShape}
                    style={this.source ? connectedLineStyle : lineStyle}
                />
            </svg>
        );
    }

    onTransformChanged(context: IFlowContext) {
        const endClientPoint = this.transform.offsetToPagePoint(this.endPoint);
        this.endPoint =
            context.viewState.transform.pageToOffsetPoint(endClientPoint);

        super.onTransformChanged(context);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MoveOutputConnectionLinesMouseHandler extends MouseHandler {
    connectionLines: ConnectionLine[] = [];
    startPoint: Point;
    source:
        | {
              objectId: string;
              connectionOutput: string;
          }
        | undefined;

    cursor: string = "crosshair";

    sourceRect: Rect | undefined;

    constructor(
        private sourceObject: TreeObjectAdapter,
        private connectionOutput: string
    ) {
        super();

        makeObservable(this, {
            connectionLines: observable,
            startPoint: observable,
            source: observable.shallow,
            down: action,
            move: action
        });
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        // get selected connection lines, but only if all selected objects are only connection lines not components
        let selectedConnectionLines: ConnectionLine[];

        if (
            context.document.selectedConnectionLines.length > 0 &&
            !context.document.selectedConnectionLines.find(
                objectAdapter =>
                    !(
                        objectAdapter.object instanceof
                        ProjectEditor.ConnectionLineClass
                    )
            )
        ) {
            selectedConnectionLines =
                context.document.selectedConnectionLines.map(
                    objectAdapter => objectAdapter.object as ConnectionLine
                );
        } else {
            selectedConnectionLines = [];
        }

        if (
            selectedConnectionLines.length > 0 &&
            !selectedConnectionLines.find(
                connectionLine =>
                    connectionLine.sourceComponent !=
                        this.sourceObject.object ||
                    connectionLine.output != this.connectionOutput
            )
        ) {
            // All selected connection lines are connected with (this.sourceObject, this.connectionOutput).
            // Work only with these lines.
            this.connectionLines = selectedConnectionLines;
        } else {
            // Work with all connection lines connected to (this.sourceObject, this.connectionOutput).
            this.connectionLines = (
                context.document.flow.object as Flow
            ).connectionLines.filter(
                connectionLine =>
                    connectionLine.sourceComponent ==
                        this.sourceObject.object &&
                    connectionLine.output == this.connectionOutput
            );
        }

        context.viewState.selectObjects(
            this.connectionLines.map(
                connectionLine =>
                    context.document.findObjectById(getId(connectionLine))!
            )
        );

        this.startPoint = this.lastOffsetPoint;
        this.source = undefined;
        this.sourceRect = undefined;
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        const result = getObjectIdFromPoint(
            context.document,
            context.viewState,
            this.lastModelPoint
        );

        if (
            result &&
            result.connectionOutput &&
            (result.id != this.sourceObject.id ||
                result.connectionOutput != this.connectionOutput)
        ) {
            const container = document.getElementById(
                context.viewState.containerId
            )!;

            const sourceNode = container!.querySelector(
                `[data-eez-flow-object-id="${result.id}"]`
            )!;

            const sourceNodeBoundingClientRect =
                sourceNode.getBoundingClientRect();
            this.sourceRect = context.viewState.transform.clientToOffsetRect(
                sourceNodeBoundingClientRect
            );

            const nodeOutput = getConnectionOutputNode(
                sourceNode,
                result.connectionOutput
            )!;

            const nodeOutputBoundingClientRect =
                nodeOutput.getBoundingClientRect();
            const nodeOutputPageRect =
                context.viewState.transform.clientToOffsetRect(
                    nodeOutputBoundingClientRect
                );

            this.startPoint = {
                x: nodeOutputPageRect.left + nodeOutputPageRect.width,
                y: nodeOutputPageRect.top + nodeOutputPageRect.height / 2
            };
            this.source = {
                objectId: result.id,
                connectionOutput: result.connectionOutput
            };
        } else {
            this.startPoint = this.lastOffsetPoint;
            this.source = undefined;
            this.sourceRect = undefined;
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        if (!cancel) {
            const source = this.source;
            if (source) {
                const sourceObject = context.projectStore.getObjectFromObjectId(
                    source.objectId
                ) as Component;

                const changes = {
                    source: sourceObject.objID,
                    output: source.connectionOutput
                };

                if (this.connectionLines.length > 0) {
                    context.projectStore.undoManager.setCombineCommands(true);

                    this.connectionLines.forEach(connectionLine => {
                        if (
                            context.document.connectionExists(
                                source.objectId,
                                source.connectionOutput,
                                getId(connectionLine.targetComponent!),
                                connectionLine.input
                            )
                        ) {
                            context.projectStore.deleteObject(connectionLine);
                        } else {
                            context.projectStore.updateObject(
                                connectionLine,
                                changes
                            );
                        }
                    });

                    context.projectStore.undoManager.setCombineCommands(false);
                }

                context.viewState.deselectAllObjects();
            }
        }

        context.document.onDragEnd();
    }

    render(context: IFlowContext) {
        const transform = context.viewState.transform;

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                {this.connectionLines.map(connectionLine => {
                    const endPoint =
                        context.viewState.transform.pageToOffsetPoint(
                            connectionLine.targetPosition
                        );

                    const targetRect =
                        context.viewState.transform.pageToOffsetRect(
                            connectionLine.targetRect
                        );

                    const { lineShape } = generateConnectionLinePath(
                        this.startPoint,
                        this.sourceRect,
                        endPoint,
                        targetRect
                    );

                    return (
                        <path
                            key={`${getId(connectionLine.targetComponent!)}${
                                connectionLine.input
                            }`}
                            d={lineShape}
                            style={this.source ? connectedLineStyle : lineStyle}
                        />
                    );
                })}
            </svg>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MoveInputConnectionLinesMouseHandler extends MouseHandler {
    connectionLines: ConnectionLine[] = [];
    endPoint: Point;
    target:
        | {
              objectId: string;
              connectionInput: string;
          }
        | undefined;

    cursor: string = "crosshair";

    targetRect: Rect | undefined;

    constructor(
        private targetObject: TreeObjectAdapter,
        private connectionInput: string
    ) {
        super();

        makeObservable(this, {
            connectionLines: observable,
            endPoint: observable,
            target: observable.shallow,
            down: action,
            move: action
        });
    }

    down(context: IFlowContext, event: IPointerEvent) {
        super.down(context, event);

        context.document.onDragStart();

        // get selected connection lines, but only if all selected objects are only connection lines not components
        let selectedConnectionLines: ConnectionLine[];

        if (
            context.document.selectedConnectionLines.length > 0 &&
            !context.document.selectedConnectionLines.find(
                objectAdapter =>
                    !(
                        objectAdapter.object instanceof
                        ProjectEditor.ConnectionLineClass
                    )
            )
        ) {
            selectedConnectionLines =
                context.document.selectedConnectionLines.map(
                    objectAdapter => objectAdapter.object as ConnectionLine
                );
        } else {
            selectedConnectionLines = [];
        }

        if (
            selectedConnectionLines.length > 0 &&
            !selectedConnectionLines.find(
                connectionLine =>
                    connectionLine.targetComponent !=
                        this.targetObject.object ||
                    connectionLine.input != this.connectionInput
            )
        ) {
            // All selected connection lines are connected with (this.targetObject, this.connectionInput).
            // Work only with these lines.
            this.connectionLines = selectedConnectionLines;
        } else {
            // Work with all connection lines connected to (this.targetObject, this.connectionInput).
            this.connectionLines = (
                context.document.flow.object as Flow
            ).connectionLines.filter(
                connectionLine =>
                    connectionLine.targetComponent ==
                        this.targetObject.object &&
                    connectionLine.input == this.connectionInput
            );
        }

        context.viewState.selectObjects(
            this.connectionLines.map(
                connectionLine =>
                    context.document.findObjectById(getId(connectionLine))!
            )
        );

        this.endPoint = this.lastOffsetPoint;
        this.target = undefined;
        this.targetRect = undefined;
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        const result = getObjectIdFromPoint(
            context.document,
            context.viewState,
            this.lastModelPoint
        );

        if (
            result &&
            result.connectionInput &&
            (result.id != this.targetObject.id ||
                result.connectionInput != this.connectionInput)
        ) {
            const container = document.getElementById(
                context.viewState.containerId
            )!;

            const targetNode = container!.querySelector(
                `[data-eez-flow-object-id="${result.id}"]`
            )!;

            const targetNodeBoundingClientRect =
                targetNode.getBoundingClientRect();
            this.targetRect = context.viewState.transform.clientToOffsetRect(
                targetNodeBoundingClientRect
            );

            const nodeInput = getConnectionInputNode(
                targetNode,
                result.connectionInput
            )!;

            const nodeInputBoundingClientRect =
                nodeInput.getBoundingClientRect();
            const nodeInputPageRect =
                context.viewState.transform.clientToOffsetRect(
                    nodeInputBoundingClientRect
                );

            this.endPoint = {
                x: nodeInputPageRect.left,
                y: nodeInputPageRect.top + nodeInputPageRect.height / 2
            };
            this.target = {
                objectId: result.id,
                connectionInput: result.connectionInput
            };
        } else {
            this.endPoint = this.lastOffsetPoint;
            this.target = undefined;
            this.targetRect = undefined;
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);

        if (!cancel) {
            const target = this.target;
            if (target) {
                const targetObject = context.projectStore.getObjectFromObjectId(
                    target.objectId
                ) as Component;

                const changes = {
                    target: targetObject.objID,
                    input: target.connectionInput
                };

                if (this.connectionLines.length > 0) {
                    context.projectStore.undoManager.setCombineCommands(true);

                    this.connectionLines.forEach(connectionLine => {
                        if (
                            context.document.connectionExists(
                                getId(connectionLine.sourceComponent!),
                                connectionLine.output,
                                target.objectId,
                                target.connectionInput
                            )
                        ) {
                            context.projectStore.deleteObject(connectionLine);
                        } else {
                            context.projectStore.updateObject(
                                connectionLine,
                                changes
                            );
                        }
                    });

                    context.projectStore.undoManager.setCombineCommands(false);
                }

                context.viewState.deselectAllObjects();
            }
        }

        context.document.onDragEnd();
    }

    render(context: IFlowContext) {
        const transform = context.viewState.transform;

        const offsetRect = transform.clientToOffsetRect(transform.clientRect);

        return (
            <svg
                width={offsetRect.width}
                height={offsetRect.height}
                style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: offsetRect.left,
                    top: offsetRect.top
                }}
            >
                {this.connectionLines.map(connectionLine => {
                    const startPoint =
                        context.viewState.transform.pageToOffsetPoint(
                            connectionLine.sourcePosition!
                        );

                    const sourceRect =
                        context.viewState.transform.pageToOffsetRect(
                            connectionLine.sourceRect
                        );

                    const { lineShape } = generateConnectionLinePath(
                        startPoint,
                        sourceRect,
                        this.endPoint,
                        this.targetRect
                    );

                    return (
                        <path
                            key={`${getId(connectionLine.sourceComponent!)}:${
                                connectionLine.output
                            }`}
                            d={lineShape}
                            style={this.target ? connectedLineStyle : lineStyle}
                        />
                    );
                })}
            </svg>
        );
    }
}

function getConnectionOutputNode(
    sourceNode: Element,
    connectionOutput: string
) {
    const outputNodes = sourceNode.querySelectorAll(
        `[data-connection-output-id="${connectionOutput}"]`
    )!;

    for (let i = 0; i < outputNodes.length; i++) {
        const outputNode = outputNodes[i];
        if (outputNode.closest(".EezStudio_ComponentEnclosure") == sourceNode) {
            return outputNode;
        }
    }

    return undefined;
}

function getConnectionInputNode(targetNode: Element, connectionInput: string) {
    const inputNodes = targetNode.querySelectorAll(
        `[data-connection-input-id="${connectionInput}"]`
    )!;

    for (let i = 0; i < inputNodes.length; i++) {
        const outputNode = inputNodes[i];
        if (outputNode.closest(".EezStudio_ComponentEnclosure") == targetNode) {
            return outputNode;
        }
    }

    return undefined;
}
