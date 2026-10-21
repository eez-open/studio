import type { Rect } from "eez-studio-shared/geometry";
import { IEezObject, IMessage, MessageType } from "project-editor/core/object";
import { getLabel, Message } from "project-editor/store";
import type { Widget } from "project-editor/flow/component";
import type { PageLayout } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    isEezGuiLiteProject,
    isFirmwareProject
} from "project-editor/project/project-type-traits";
import {
    getLayoutsPage,
    getPageLayouts,
    isWidgetShownInLayout,
    isWidgetVisibleInLayout,
    newPageLayoutMessage
} from "project-editor/features/page/page-layouts";

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
        widget.allowOverlapping ||
        isOverlay(widget) ||
        widget instanceof ProjectEditor.BitmapWidgetClass ||
        widget instanceof ProjectEditor.RectangleWidgetClass
    );
}

function isOverlapping(a: Rect, b: Rect) {
    if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
        return false;
    }

    return (
        a.left < b.left + b.width &&
        b.left < a.left + a.width &&
        a.top < b.top + b.height &&
        b.top < a.top + a.height
    );
}

// Reports a warning for each child widget that overlaps some of the previous
// child widgets (i.e. widgets rendered before it), unless overlapping is allowed.
// If the page has layouts, widgets are checked in each page layout.
export function checkOverlappingChildren(
    parent: IEezObject,
    widgets: Widget[],
    allowOverlappingChildren: boolean,
    messages: IMessage[]
) {
    if (allowOverlappingChildren || !isOverlappingChildrenSupported(parent)) {
        return;
    }

    const layoutsPage = getLayoutsPage(parent);
    if (layoutsPage) {
        for (const pageLayout of getPageLayouts(layoutsPage)) {
            // children of the widget which is not built in the page layout
            if (
                parent instanceof ProjectEditor.WidgetClass &&
                !isWidgetShownInLayout(parent, pageLayout)
            ) {
                continue;
            }

            checkOverlappingChildrenInPageLayout(
                parent,
                widgets.filter(widget =>
                    isWidgetVisibleInLayout(widget, pageLayout)
                ),
                pageLayout,
                messages
            );
        }
    } else {
        checkOverlappingChildrenInPageLayout(
            parent,
            widgets,
            undefined,
            messages
        );
    }
}

function checkOverlappingChildrenInPageLayout(
    parent: IEezObject,
    widgets: Widget[],
    pageLayout: PageLayout | undefined,
    messages: IMessage[]
) {
    const rects = widgets.map(widget => widget.getRectInPageLayout(pageLayout));

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

            if (isOverlapping(rects[i], rects[j])) {
                const text = `Widget overlaps "${getLabel(previousWidget)}"${
                    pageLayout ? ` in the "${pageLayout.name}" layout` : ""
                }, enable "Allow overlapping children" in "${getLabel(
                    parent
                )}" to render it correctly`;

                messages.push(
                    pageLayout
                        ? newPageLayoutMessage(MessageType.WARNING, text, widget)
                        : new Message(MessageType.WARNING, text, widget)
                );
                break;
            }
        }
    }
}
