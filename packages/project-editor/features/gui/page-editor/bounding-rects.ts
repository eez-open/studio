import {
    BoundingRectBuilder,
    Point,
    Rect,
    isRectInsideRect
} from "eez-studio-shared/geometry";

import {
    IDocument,
    IViewState
} from "project-editor/features/gui/page-editor/designer-interfaces";

import { DRAGGABLE_OVERLAY_ELEMENT_ID } from "eez-studio-ui/draggable";
import { ConnectionLine } from "../page";
import { Widget } from "../widget";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

export function getObjectBoundingRect(object: ITreeObjectAdapter) {
    const widget = object.object as Widget;
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
    pageDocument: IDocument,
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
        canvas.style.pointerEvents = "all";
    }

    const draggableOverlayElement = document.getElementById(
        DRAGGABLE_OVERLAY_ELEMENT_ID
    );
    if (draggableOverlayElement) {
        draggableOverlayElement.style.pointerEvents = "none";
    }

    const clientPoint = viewState.transform.pageToClientPoint(point);
    const elementAtPoint = document.elementFromPoint(
        clientPoint.x,
        clientPoint.y
    );

    if (draggableOverlayElement) {
        draggableOverlayElement.style.pointerEvents = "all";
    }

    if (canvas) {
        canvas.style.pointerEvents = "none";
    }

    if (elementAtPoint) {
        let node = elementAtPoint.closest("[data-designer-object-id]");
        if (node) {
            const id = node.getAttribute("data-designer-object-id");
            if (id && pageDocument.findObjectById(id)) {
                const connectionInputNode = elementAtPoint.closest(
                    ".eez-connection-input"
                );
                const connectionInput =
                    (connectionInputNode &&
                        connectionInputNode.getAttribute(
                            "data-connection-input-id"
                        )) ||
                    undefined;

                const connectionOutputNode = elementAtPoint.closest(
                    ".eez-connection-output"
                );
                const connectionOutput =
                    (connectionOutputNode &&
                        connectionOutputNode.getAttribute(
                            "data-connection-output-id"
                        )) ||
                    undefined;

                return {
                    id,
                    connectionInput,
                    connectionOutput
                };
            }
        }
    }

    return undefined;
}

export function getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
    const ids: string[] = [];
    const container = document.getElementById(viewState.containerId);
    const blocks = container!.querySelectorAll("[data-designer-object-id]");
    blocks.forEach(node => {
        const id = node.getAttribute("data-designer-object-id");
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
