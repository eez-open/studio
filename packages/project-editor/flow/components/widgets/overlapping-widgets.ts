import { IEezObject, IMessage, MessageType } from "project-editor/core/object";
import { getLabel, Message } from "project-editor/store";
import type { Widget } from "project-editor/flow/component";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    isEezGuiLiteProject,
    isFirmwareProject
} from "project-editor/project/project-type-traits";

// Set in the container widget flags, tells EEZ-GUI runtime to render children
// of this container (or page) correctly even if they overlap.
export const OVERLAPPING_CHILDREN_FLAG = 1 << 5;

// "Allow overlapping children" is supported only in EEZ-GUI (firmware) projects
export function isOverlappingChildrenSupported(object: IEezObject) {
    return isFirmwareProject(object) && !isEezGuiLiteProject(object);
}

function isOverlay(widget: Widget) {
    // overlay is rendered in its own buffer, so it is allowed to overlap
    return (
        widget instanceof ProjectEditor.ContainerWidgetClass && !!widget.overlay
    );
}

// these widgets are allowed to overlap (and to be overlapped)
function isIgnored(widget: Widget) {
    return (
        isOverlay(widget) ||
        widget instanceof ProjectEditor.BitmapWidgetClass ||
        widget instanceof ProjectEditor.RectangleWidgetClass
    );
}

function isOverlapping(a: Widget, b: Widget) {
    const aLeft = a.relativePosition.left;
    const aTop = a.relativePosition.top;
    const aWidth = a.componentWidth;
    const aHeight = a.componentHeight;

    const bLeft = b.relativePosition.left;
    const bTop = b.relativePosition.top;
    const bWidth = b.componentWidth;
    const bHeight = b.componentHeight;

    if (aWidth <= 0 || aHeight <= 0 || bWidth <= 0 || bHeight <= 0) {
        return false;
    }

    return (
        aLeft < bLeft + bWidth &&
        bLeft < aLeft + aWidth &&
        aTop < bTop + bHeight &&
        bTop < aTop + aHeight
    );
}

// Reports a warning for each child widget that overlaps some of the previous
// child widgets (i.e. widgets rendered before it), unless overlapping is allowed.
export function checkOverlappingChildren(
    parent: IEezObject,
    widgets: Widget[],
    allowOverlappingChildren: boolean,
    messages: IMessage[]
) {
    if (allowOverlappingChildren || !isOverlappingChildrenSupported(parent)) {
        return;
    }

    for (let i = 1; i < widgets.length; i++) {
        const widget = widgets[i];
        if (isIgnored(widget)) {
            continue;
        }

        for (let j = 0; j < i; j++) {
            const previousWidget = widgets[j];
            if (isIgnored(previousWidget)) {
                continue;
            }

            if (isOverlapping(widget, previousWidget)) {
                messages.push(
                    new Message(
                        MessageType.WARNING,
                        `Widget overlaps "${getLabel(
                            previousWidget
                        )}", enable "Allow overlapping children" in "${getLabel(
                            parent
                        )}" to render it correctly`,
                        widget
                    )
                );
                break;
            }
        }
    }
}
