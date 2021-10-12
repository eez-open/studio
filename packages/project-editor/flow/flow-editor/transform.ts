import { observable, action, runInAction } from "mobx";

import { Point, Rect } from "eez-studio-shared/geometry";
import type { IPointerEvent } from "project-editor/flow/flow-editor/mouse-handler";

// prettier-ignore
const SCALES = [
    0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9,
    1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
];

export interface ITransform {
    translate: Point;
    scale: number;
}

export class Transform implements ITransform {
    @observable _translate: Point = { x: 0, y: 0 };
    @observable _scale: number = 1;

    @observable clientRect = { left: 0, top: 0, width: 1, height: 1 };

    constructor(params: ITransform) {
        Object.assign(this, params);
    }

    clone() {
        const transform = new Transform({
            translate: {
                x: this.translate.x,
                y: this.translate.y
            },
            scale: this.scale
        });
        transform.clientRect = this.clientRect;
        return transform;
    }

    get translate() {
        return this._translate;
    }

    set translate(point: Point) {
        runInAction(() => {
            this._translate = point;
        });
    }

    get scale() {
        return this._scale;
    }

    set scale(scale: number) {
        runInAction(() => {
            this._scale = scale;
        });
    }

    @action
    translateBy(translate: Point) {
        this.translate = {
            x: this.translate.x + translate.x,
            y: this.translate.y + translate.y
        };
    }

    get nextScale() {
        for (let i = 0; i < SCALES.length; i++) {
            if (SCALES[i] - this.scale > 0.001) {
                return SCALES[i];
            }
        }

        return this.scale;
    }

    get previousScale() {
        for (let i = SCALES.length - 1; i >= 0; i--) {
            if (this.scale - SCALES[i] > 0.001) {
                return SCALES[i];
            }
        }
        return this.scale;
    }

    clientToOffsetPoint(p: Point) {
        return { x: p.x - this.clientRect.left, y: p.y - this.clientRect.top };
    }

    clientToPagePoint(clientPoint: Point) {
        return this.offsetToPagePoint(this.clientToOffsetPoint(clientPoint));
    }

    offsetToClientPoint(p: Point) {
        return { x: p.x + this.clientRect.left, y: p.y + this.clientRect.top };
    }

    offsetToPagePoint(p: Point) {
        return {
            x:
                (p.x - (this.clientRect.width / 2 + this.translate.x)) /
                this.scale,
            y:
                (p.y - (this.clientRect.height / 2 + this.translate.y)) /
                this.scale
        };
    }

    pageToClientPoint(p: Point) {
        return this.offsetToClientPoint(this.pageToOffsetPoint(p));
    }

    pageToOffsetPoint(p: Point) {
        return {
            x: p.x * this.scale + this.translate.x + this.clientRect.width / 2,
            y: p.y * this.scale + this.translate.y + this.clientRect.height / 2
        };
    }

    pointerEventToClientPoint(event: IPointerEvent) {
        return { x: event.clientX, y: event.clientY };
    }

    pointerEventToOffsetPoint(event: IPointerEvent) {
        return this.clientToOffsetPoint(this.pointerEventToClientPoint(event));
    }

    pointerEventToPagePoint(event: IPointerEvent) {
        return this.clientToPagePoint(this.pointerEventToClientPoint(event));
    }

    clientToOffsetRect(rect: Rect) {
        let leftTop = this.clientToOffsetPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.clientToOffsetPoint({
            x: rect.left + rect.width,
            y: rect.top + rect.height
        });
        return {
            left: leftTop.x,
            top: leftTop.y,
            width: rightBottom.x - leftTop.x,
            height: rightBottom.y - leftTop.y
        };
    }

    clientToPageRect(rect: Rect) {
        let leftTop = this.clientToPagePoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.clientToPagePoint({
            x: rect.left + rect.width,
            y: rect.top + rect.height
        });
        return {
            left: Math.round(leftTop.x),
            top: Math.round(leftTop.y),
            width: Math.round(rightBottom.x - leftTop.x),
            height: Math.round(rightBottom.y - leftTop.y)
        };
    }

    offsetToClientRect(rect: Rect) {
        let leftTop = this.offsetToClientPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.offsetToClientPoint({
            x: rect.left + rect.width,
            y: rect.top + rect.height
        });
        return {
            left: leftTop.x,
            top: leftTop.y,
            width: rightBottom.x - leftTop.x,
            height: rightBottom.y - leftTop.y
        };
    }

    offsetToPageRect(rect: Rect) {
        let leftTop = this.offsetToPagePoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.offsetToPagePoint({
            x: rect.left + rect.width,
            y: rect.top + rect.height
        });
        return {
            left: leftTop.x,
            top: leftTop.y,
            width: rightBottom.x - leftTop.x,
            height: rightBottom.y - leftTop.y
        };
    }

    pageToOffsetRect(rect: Rect) {
        let leftTop = this.pageToOffsetPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.pageToOffsetPoint({
            x: rect.left + rect.width,
            y: rect.top + rect.height
        });
        return {
            left: leftTop.x,
            top: leftTop.y,
            width: rightBottom.x - leftTop.x,
            height: rightBottom.y - leftTop.y
        };
    }

    pageToClientRect(rect: Rect) {
        let leftTop = this.pageToClientPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.pageToClientPoint({
            x: rect.left + rect.width,
            y: rect.top + rect.height
        });
        return {
            left: leftTop.x,
            top: leftTop.y,
            width: rightBottom.x - leftTop.x,
            height: rightBottom.y - leftTop.y
        };
    }
}
