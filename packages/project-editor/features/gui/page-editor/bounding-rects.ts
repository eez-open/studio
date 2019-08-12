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
    IDocument,
    IViewState
} from "project-editor/features/gui/page-editor/designer-interfaces";

class BoundingRects {
    @observable map = new Map<string, Rect[]>();

    constructor() {
        this.updateBoundingRects();
    }

    @action.bound
    updateBoundingRects() {
        const $divs = $(`[data-designer-object-id]`);

        const map = new Map<string, Rect[]>();

        for (let i = 0; i < $divs.length; ++i) {
            const div = $divs[i];
            const id = div.getAttribute("data-designer-object-id")!;
            const rect = div.getBoundingClientRect();

            const rects = map.get(id);
            if (rects) {
                map.set(id, rects.concat([rect]));
            } else {
                map.set(id, [rect]);
            }
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
                r1.length !== r2.length ||
                (r1.length == 1 &&
                    (r1[0].left != r2[0].left ||
                        r1[0].top != r2[0].top ||
                        r1[0].width != r2[0].width ||
                        r1[0].height != r2[0].height)) ||
                r1.find(
                    (r, i) =>
                        r.left != r2[i].left ||
                        r.top != r2[i].top ||
                        r.width != r2[i].width ||
                        r.height != r2[i].height
                )
            ) {
                this.map.set(key, r1);
            }
        }

        window.requestAnimationFrame(this.updateBoundingRects);
    }

    static boundigRectToPageRect(boundingRect?: Rect, viewState?: IViewState) {
        if (!boundingRect) {
            return { left: 0, top: 0, width: 1, height: 1 };
        }
        if (!viewState) {
            return boundingRect;
        }
        return viewState.transform.clientToPageRect(boundingRect);
    }

    getBoundingRectFromId(id: string, viewState?: IViewState) {
        const boundingRects = this.map.get(id);
        return BoundingRects.boundigRectToPageRect(boundingRects && boundingRects[0], viewState);
    }

    getBoundingRect(object: IBaseObject, viewState: IViewState) {
        return this.getBoundingRectFromId(object.id, viewState);
    }

    getObjectIdFromPoint(document: IDocument, viewState: IViewState, point: Point) {
        let foundId: string | undefined;
        point = viewState.transform.pageToClientPoint(point);
        for (const [id, boundingRects] of this.map.entries()) {
            for (const boundingRect of boundingRects) {
                if (pointInRect(point, boundingRect) && document.findObjectById(id)) {
                    if (!foundId || id.length > foundId.length) {
                        foundId = id;
                    }
                }
            }
        }
        return foundId;
    }

    getDocumentBoundingRect(viewState: IViewState) {
        let boundingRectBuilder = new BoundingRectBuilder();
        this.map.forEach(boundingRects => {
            for (const boundingRect of boundingRects) {
                boundingRectBuilder.addRect(boundingRect);
            }
        });
        return BoundingRects.boundigRectToPageRect(boundingRectBuilder.getRect(), viewState);
    }

    getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
        const ids: string[] = [];
        for (const [id, boundingRects] of this.map.entries()) {
            for (const boundingRect of boundingRects) {
                const pageRect = BoundingRects.boundigRectToPageRect(boundingRect, viewState);
                if (isRectInsideRect(pageRect, rect)) {
                    ids.push(id);
                }
            }
        }
        return ids;
    }
}

const boundingRects = new BoundingRects();

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

export function getObjectIdFromPoint(document: IDocument, viewState: IViewState, point: Point) {
    return boundingRects.getObjectIdFromPoint(document, viewState, point);
}

export function getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
    return boundingRects.getObjectIdsInsideRect(viewState, rect);
}
