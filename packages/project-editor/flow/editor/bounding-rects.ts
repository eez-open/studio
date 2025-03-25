import {
    BoundingRectBuilder,
    Point,
    Rect,
    isRectInsideRect
} from "eez-studio-shared/geometry";

import { DRAGGABLE_OVERLAY_ELEMENT_ID } from "eez-studio-ui/draggable";

import type {
    IDocument,
    IViewState,
    ObjectIdUnderPointer
} from "project-editor/flow/flow-interfaces";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getId } from "project-editor/core/object";

export function getObjectBoundingRect(
    viewState: IViewState,
    objectAdapter: TreeObjectAdapter
) {
    const object = objectAdapter.object;
    if (object instanceof ProjectEditor.ConnectionLineClass) {
        return {
            left: object.sourcePosition.x,
            top: object.sourcePosition.y,
            width: object.targetPosition.x - object.sourcePosition.x,
            height: object.targetPosition.y - object.sourcePosition.y
        };
    } else if (object instanceof ProjectEditor.ComponentClass) {
        if (viewState.projectStore.projectTypeTraits.isDashboard) {
            let dataFlowObjectId = getId(object);
            const container = document.getElementById(viewState.containerId);
            const el = container?.querySelector(
                `[data-eez-flow-object-id='${dataFlowObjectId}']`
            );
            if (el) {
                let rect = el.getBoundingClientRect();
                return viewState.transform.clientToPageRect(rect);
            }
        }

        return {
            left: object.absolutePositionPoint?.x ?? objectAdapter.rect.left,
            top: object.absolutePositionPoint?.y ?? objectAdapter.rect.top,
            width: objectAdapter.rect.width,
            height: objectAdapter.rect.height
        };
    } else if (
        object instanceof ProjectEditor.ActionClass ||
        object instanceof ProjectEditor.PageClass
    ) {
        return object.pageRect;
    } else {
        // if (!(object instanceof ProjectEditor.VariableClass)) {
        //     console.warn("Unexpected!");
        // }

        return {
            left: 0,
            top: 0,
            width: 0,
            height: 0
        };
    }
}

export function getSelectedObjectsBoundingRect(viewState: IViewState) {
    let boundingRectBuilder = new BoundingRectBuilder();
    for (const object of viewState.selectedObjects) {
        if (object.object instanceof ProjectEditor.ConnectionLineClass) {
            continue;
        }
        const rect = getObjectBoundingRect(viewState, object);
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
): ObjectIdUnderPointer | undefined {
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
            if (node.classList.contains("EezStudio_Page")) {
                continue;
            }
            const id = node.getAttribute("data-eez-flow-object-id");
            if (id) {
                const object = flowDocument.findObjectById(id);
                if (object) {
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

                    if (result) {
                        if (
                            object.object instanceof
                            ProjectEditor.LVGLTabWidgetClass
                        ) {
                            continue;
                        }

                        if (
                            !object.selected ||
                            (result.connectionOutput && !connectionOutput) ||
                            (result.connectionInput && !connectionInput)
                        ) {
                            continue;
                        }
                    }

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
        if (node.classList.contains("EezStudio_Page")) {
            return;
        }
        const id = node.getAttribute("data-eez-flow-object-id");
        if (id) {
            const boundingClientRect = node.getBoundingClientRect();
            const pageRect =
                viewState.transform.clientToPageRect(boundingClientRect);
            if (isRectInsideRect(pageRect, rect)) {
                if (ids.indexOf(id) == -1) {
                    ids.push(id);
                }
            }
        }
    });
    return ids;
}
