import {
    BoundingRectBuilder,
    Point,
    Rect,
    isRectInsideRect
} from "eez-studio-shared/geometry";

import type {
    IDocument,
    IViewState
} from "project-editor/flow/flow-interfaces";

import { DRAGGABLE_OVERLAY_ELEMENT_ID } from "eez-studio-ui/draggable";
import { ConnectionLine } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

export function getObjectBoundingRect(object: ITreeObjectAdapter) {
    const widget = object.object as Component;
    return {
        left: widget.absolutePositionPoint?.x ?? widget.left,
        top: widget.absolutePositionPoint?.y ?? widget.top,
        width: object.rect.width,
        height: object.rect.height
    };
}

export function getSelectedObjectsBoundingRect(viewState: IViewState) {
    let boundingRectBuilder = new BoundingRectBuilder();
    for (const object of viewState.selectedObjects) {
        if (object.object instanceof ConnectionLine) {
            continue;
        }
        const rect = getObjectBoundingRect(object);
        if (rect) {
            boundingRectBuilder.addRect(rect);
        }
    }
    return boundingRectBuilder.getRect();
}

export function getObjectIdFromPoint(
    flowDocument: IDocument,
    viewState: IViewState,
    point: Point
) {
    let canvas: HTMLElement | undefined = document.querySelector(
        `[id="${viewState.containerId}"] .eez-canvas`
    ) as HTMLElement;
    if (canvas?.style.pointerEvents != "none") {
        canvas = undefined;
    }
    if (canvas) {
        canvas.style.pointerEvents = "auto";
    }

    const draggableOverlayElement = document.getElementById(
        DRAGGABLE_OVERLAY_ELEMENT_ID
    );
    if (draggableOverlayElement) {
        draggableOverlayElement.style.pointerEvents = "none";
    }

    const clientPoint = viewState.transform.pageToClientPoint(point);
    const elementsAtPoint = document.elementsFromPoint(
        clientPoint.x,
        clientPoint.y
    );

    if (draggableOverlayElement) {
        draggableOverlayElement.style.pointerEvents = "auto";
    }

    if (canvas) {
        canvas.style.pointerEvents = "none";
    }

    let result;

    for (let elementAtPoint of elementsAtPoint) {
        let node = elementAtPoint.closest("[data-eez-flow-object-id]");
        if (node) {
            const id = node.getAttribute("data-eez-flow-object-id");
            if (id) {
                const object = flowDocument.findObjectById(id);
                if (object) {
                    if (result) {
                        if (!object.selected) {
                            continue;
                        }
                    }

                    const connectionInputNode = elementAtPoint.closest(
                        "[data-connection-input-id]"
                    );
                    const connectionInput =
                        (connectionInputNode &&
                            connectionInputNode.getAttribute(
                                "data-connection-input-id"
                            )) ||
                        undefined;

                    const connectionOutputNode = elementAtPoint.closest(
                        "[data-connection-output-id]"
                    );
                    const connectionOutput =
                        (connectionOutputNode &&
                            connectionOutputNode.getAttribute(
                                "data-connection-output-id"
                            )) ||
                        undefined;

                    result = {
                        id,
                        connectionInput,
                        connectionOutput
                    };
                }
            }
        }
    }

    return result;
}

export function getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
    const ids: string[] = [];
    const container = document.getElementById(viewState.containerId);
    const blocks = container!.querySelectorAll("[data-eez-flow-object-id]");
    blocks.forEach(node => {
        const id = node.getAttribute("data-eez-flow-object-id");
        if (id) {
            const boundingClientRect = node.getBoundingClientRect();
            const pageRect = viewState.transform.clientToPageRect(
                boundingClientRect
            );
            if (isRectInsideRect(pageRect, rect)) {
                if (ids.indexOf(id) == -1) {
                    ids.push(id);
                }
            }
        }
    });
    return ids;
}
