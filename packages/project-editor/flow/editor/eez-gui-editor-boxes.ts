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
