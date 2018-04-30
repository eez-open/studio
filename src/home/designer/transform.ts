import { observable, action } from "mobx";

import { Point, Rect } from "shared/geometry";

const SCALES = [
    0.05,
    0.08,
    0.1,
    0.15,
    0.2,
    0.25,
    0.33,
    0.5,
    0.67,
    0.75,
    0.8,
    0.9,
    1,
    1.1,
    1.25,
    1.5,
    1.75,
    2,
    2.5,
    3,
    4,
    5,
    6,
    7,
    8
];

export class Transform {
    constructor() {
        let transformJson = window.localStorage.getItem("home/designer/transform");
        if (transformJson) {
            let transform = JSON.parse(transformJson);
            this._translate = transform.translate;
            this._scale = transform.scale;
        }
    }

    @observable _translate: Point = { x: 0, y: 0 };
    @observable _scale: number = 1.0;

    _saveTransform() {
        window.localStorage.setItem(
            "home/designer/transform",
            JSON.stringify({
                translate: this._translate,
                scale: this._scale
            })
        );
    }

    get translate() {
        return this._translate;
    }

    set translate(point: Point) {
        action(() => {
            this._translate = point;
        })();
        this._saveTransform();
    }

    get scale() {
        return this._scale;
    }

    set scale(scale: number) {
        action(() => {
            this._scale = scale;
        })();
        this._saveTransform();
    }

    @observable
    clientRect = {
        left: 0,
        top: 0,
        width: 1,
        height: 1
    };

    @observable
    visibleClientRect = {
        left: 0,
        top: 0,
        width: 1,
        height: 1
    };

    get centerPoint() {
        let rect = this.clientToModelRect(this.visibleClientRect);
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    nextScale() {
        for (let i = 0; i < SCALES.length; ++i) {
            if (SCALES[i] - this.scale > 0.001) {
                return SCALES[i];
            }
        }

        return this.scale;
    }

    previousScale() {
        for (let i = SCALES.length - 1; i >= 0; --i) {
            if (this.scale - SCALES[i] > 0.001) {
                return SCALES[i];
            }
        }
        return this.scale;
    }

    clientToOffsetPoint(p: Point) {
        return {
            x: p.x - this.clientRect.left,
            y: p.y - this.clientRect.top
        };
    }

    mouseEventToOffsetPoint(event: MouseEvent) {
        return this.clientToOffsetPoint({
            x: event.clientX,
            y: event.clientY
        });
    }

    clientToModelPoint(clientPoint: Point) {
        let p = this.clientToOffsetPoint(clientPoint);

        p.x -= this.clientRect.width / 2;
        p.y -= this.clientRect.height / 2;

        p.x -= this.translate.x;
        p.y -= this.translate.y;

        p.x /= this.scale;
        p.y /= this.scale;

        return p;
    }

    mouseEventToModelPoint(event: MouseEvent) {
        return this.clientToModelPoint({
            x: event.clientX,
            y: event.clientY
        });
    }

    modelToOffsetPoint(p: Point) {
        p = { x: p.x, y: p.y };

        p.x *= this.scale;
        p.y *= this.scale;

        p.x += this.translate.x + this.clientRect.width / 2;
        p.y += this.translate.y + this.clientRect.height / 2;

        return p;
    }

    offsetToModelPoint(p: Point) {
        p = { x: p.x, y: p.y };

        p.x -= this.clientRect.width / 2 + this.translate.x;
        p.y -= this.clientRect.height / 2 + this.translate.y;

        p.x /= this.scale;
        p.y /= this.scale;

        return p;
    }

    modelToOffsetRect(rect: Rect) {
        let leftTop = this.modelToOffsetPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.modelToOffsetPoint({
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

    offsetToModelRect(rect: Rect) {
        let leftTop = this.offsetToModelPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.offsetToModelPoint({
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

    clientToModelRect(rect: Rect) {
        let leftTop = this.clientToModelPoint({
            x: rect.left,
            y: rect.top
        });
        let rightBottom = this.clientToModelPoint({
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
