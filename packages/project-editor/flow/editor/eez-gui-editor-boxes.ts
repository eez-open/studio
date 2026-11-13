// The boxes of the widgets as the framework WASM laid them out in the page
// editor of an EEZ-GUI project (EezGuiEditorPage), on the display. The editor
// shows the children of rows and columns there (ContainerWidget.render), so
// the editor and the device use one layout (eez-framework gui/layout.h).

import { observable, runInAction } from "mobx";

import type { IEezObject } from "project-editor/core/object";
import type { Rect } from "eez-studio-shared/geometry";
import { getAncestorOfType } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

const pageBoxes = observable.map<IEezObject, Map<IEezObject, Rect>>(
    undefined,
    { deep: false }
);

function isSameBoxes(a: Map<IEezObject, Rect>, b: Map<IEezObject, Rect>) {
    if (a.size != b.size) {
        return false;
    }
    for (const [object, box] of a) {
        const other = b.get(object);
        if (
            !other ||
            other.left != box.left ||
            other.top != box.top ||
            other.width != box.width ||
            other.height != box.height
        ) {
            return false;
        }
    }
    return true;
}

// the boxes of the widgets of the page drawn last (the first box of a widget
// that is drawn more than once, e.g. in a list)
export function setEditorWidgetBoxes(
    page: IEezObject,
    boxes: Map<IEezObject, Rect>
) {
    const previous = pageBoxes.get(page);
    if (previous && isSameBoxes(previous, boxes)) {
        return;
    }
    runInAction(() => pageBoxes.set(page, boxes));
}

export function getEditorWidgetBox(widget: IEezObject) {
    const page = getAncestorOfType(widget, ProjectEditor.PageClass.classInfo);
    return page ? pageBoxes.get(page)?.get(widget) : undefined;
}

////////////////////////////////////////////////////////////////////////////////

// The scroll positions of the scrolling containers in the page editor, as for
// the scrollable LVGL widgets: Alt + mouse wheel or Alt + drag with the right
// or the middle button over the container (flow/editor/editor.tsx). Kept only
// in the editor, not in the project. In px from the top of the content.
const editorScrollPositions = observable.map<IEezObject, number>(undefined, {
    deep: false
});

// the position the framework drew and the largest one (it clamps the position)
const drawnScrollPositions = new WeakMap<
    IEezObject,
    { position: number; maxPosition: number }
>();

// a container of an EEZ-GUI project that scrolls vertically
export function isScrollableInEditor(object: IEezObject) {
    return (
        object instanceof ProjectEditor.ContainerWidgetClass &&
        (object as any).scroll == "vertical" &&
        (object as any).widgets.length > 0
    );
}

// the positions set in the editor (observed by the page editor drawing)
export function getEditorScrollPositions() {
    return editorScrollPositions;
}

// scrolls the widget by delta px (down if positive) from the position it was
// drawn with
export function scrollInEditor(widget: IEezObject, delta: number) {
    const drawn = drawnScrollPositions.get(widget);
    const from = drawn
        ? drawn.position
        : editorScrollPositions.get(widget) ?? 0;
    let position = Math.max(Math.round(from + delta), 0);
    if (drawn) {
        position = Math.min(position, drawn.maxPosition);
    }
    if (position != editorScrollPositions.get(widget)) {
        runInAction(() => editorScrollPositions.set(widget, position));
    }
}

export function setDrawnScrollPosition(
    widget: IEezObject,
    position: number,
    maxPosition: number
) {
    drawnScrollPositions.set(widget, { position, maxPosition });
}
