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
    @observable map = new Map<
        string,
        {
            zIndex: number;
            rect: Rect;
        }[]
    >();

    constructor() {
        this.updateBoundingRects();
    }

    @action.bound
    updateBoundingRects() {
        const $divs = $(`[data-designer-object-id]`);

        const map = new Map<
            string,
            {
                zIndex: number;
                rect: Rect;
            }[]
        >();

        for (let i = 0; i < $divs.length; ++i) {
            const div = $divs[i];
            const id = div.getAttribute("data-designer-object-id")!;
            const rect = div.getBoundingClientRect();

            const rects = map.get(id);
            if (rects) {
                map.set(
                    id,
                    rects.concat([
                        {
                            zIndex: i,
                            rect
                        }
                    ])
                );
            } else {
                map.set(id, [
                    {
                        zIndex: i,
                        rect
                    }
                ]);
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
                    (r1[0].zIndex != r2[0].zIndex ||
                        r1[0].rect.left != r2[0].rect.left ||
                        r1[0].rect.top != r2[0].rect.top ||
                        r1[0].rect.width != r2[0].rect.width ||
                        r1[0].rect.height != r2[0].rect.height)) ||
                r1.find(
                    (r, i) =>
                        r.zIndex != r2[i].zIndex ||
                        r.rect.left != r2[i].rect.left ||
                        r.rect.top != r2[i].rect.top ||
                        r.rect.width != r2[i].rect.width ||
                        r.rect.height != r2[i].rect.height
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
        return BoundingRects.boundigRectToPageRect(
            boundingRects && boundingRects[0].rect,
            viewState
        );
    }

    getBoundingRect(object: IBaseObject, viewState: IViewState) {
        return this.getBoundingRectFromId(object.id, viewState);
    }

    getObjectIdFromPoint(document: IDocument, viewState: IViewState, point: Point) {
        let foundId: string | undefined;
        let foundZIndex: number = -1;
        point = viewState.transform.pageToClientPoint(point);
        for (const [id, boundingRects] of this.map.entries()) {
            for (const boundingRect of boundingRects) {
                if (pointInRect(point, boundingRect.rect) && document.findObjectById(id)) {
                    if (!foundId || boundingRect.zIndex > foundZIndex) {
                        foundId = id;
                        foundZIndex = boundingRect.zIndex;
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
                boundingRectBuilder.addRect(boundingRect.rect);
            }
        });
        return BoundingRects.boundigRectToPageRect(boundingRectBuilder.getRect(), viewState);
    }

    getObjectIdsInsideRect(viewState: IViewState, rect: Rect) {
        const ids: string[] = [];
        for (const [id, boundingRects] of this.map.entries()) {
            for (const boundingRect of boundingRects) {
                const pageRect = BoundingRects.boundigRectToPageRect(boundingRect.rect, viewState);
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
