import { observable, action } from "mobx";

import {
    BoundingRectBuilder,
    Point,
    Rect,
    pointInRect,
    isRectInsideRect
} from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IViewState
} from "project-editor/features/gui/page-editor/designer-interfaces";

class BoundingRects {
    @observable map = new Map<string, Rect>();

    constructor() {
        this.updateBoundingRects();
    }

    @action.bound
    updateBoundingRects() {
        const $divs = $(`[data-designer-object-id]`);

        const map = new Map<string, Rect>();

        for (let i = 0; i < $divs.length; ++i) {
            const div = $divs[i];
            const id = div.getAttribute("data-designer-object-id")!;
            const rect = div.getBoundingClientRect();
            map.set(id, rect);
        }

        for (const key of this.map.keys()) {
            if (!map.has(key)) {
                this.map.delete(key);
            }
        }

        for (const key of map.keys()) {
            const r1 = map.get(key)!;
            const r2 = this.map.get(key);
            if (
                !r2 ||
                r2.left != r1.left ||
                r2.top != r1.top ||
                r2.width != r1.width ||
                r2.height != r1.height
            ) {
                this.map.set(key, r1);
            }
        }

        window.requestAnimationFrame(this.updateBoundingRects);
    }

    static boundigRectToPageRect(rect?: Rect, viewState?: IViewState) {
        if (!rect) {
            return { left: 0, top: 0, width: 1, height: 1 };
        }
        if (!viewState) {
            return rect;
        }
        return viewState.transform.clientToPageRect(rect);
    }

    getBoundingRectFromId(id: string, viewState?: IViewState) {
        return BoundingRects.boundigRectToPageRect(this.map.get(id), viewState);
    }

    getBoundingRect(object: IBaseObject, viewState: IViewState) {
        return BoundingRects.boundigRectToPageRect(this.map.get(object.id), viewState);
    }

    getObjectIdFromPoint(viewState: IViewState, point: Point) {
        let foundId: string | undefined;
        point = viewState.transform.pageToClientPoint(point);
        for (const key of this.map.keys()) {
            if (pointInRect(point, this.map.get(key)!)) {
                if (!foundId || key.length > foundId.length) {
                    foundId = key;
                }
            }
        }
        return foundId;
    }

    getDocumentBoundingRect(viewState: IViewState) {
        let boundingRectBuilder = new BoundingRectBuilder();
        this.map.forEach(rect => {
            boundingRectBuilder.addRect(rect);
        });
        return BoundingRects.boundigRectToPageRect(boundingRectBuilder.getRect(), viewState);
    }

    getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
        const ids: string[] = [];
        this.map.forEach((boundingRect: Rect, id: string) => {
            const pageRect = BoundingRects.boundigRectToPageRect(boundingRect, viewState);
            if (isRectInsideRect(pageRect, rect)) {
                ids.push(id);
            }
        });
        return ids;
    }
}

const boundingRects = new BoundingRects();

export function getObjectBoundingRectFromId(id: string, viewState?: IViewState) {
    return boundingRects.getBoundingRectFromId(id, viewState);
}

export function getObjectBoundingRect(object: IBaseObject, viewState: IViewState) {
    return boundingRects.getBoundingRect(object, viewState);
}

export function getSelectedObjectsBoundingRect(viewState: IViewState) {
    let boundingRectBuilder = new BoundingRectBuilder();
    for (const object of viewState.selectedObjects) {
        boundingRectBuilder.addRect(getObjectBoundingRect(object, viewState));
    }
    return boundingRectBuilder.getRect();
}

export function getDocumentBoundingRect(viewState: IViewState) {
    return boundingRects.getDocumentBoundingRect(viewState);
}

export function getObjectIdFromPoint(viewState: IViewState, point: Point) {
    return boundingRects.getObjectIdFromPoint(viewState, point);
}

export function getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
    return boundingRects.getObjectIdsInsideRect(viewState, rect);
}
