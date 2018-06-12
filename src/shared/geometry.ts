import { observable, action, runInAction } from "mobx";

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export class BoundingRectBuilder {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;

    addRect(rect: Rect | undefined) {
        if (rect) {
            this.addPoint(rect.left, rect.top);
            this.addPoint(rect.left + rect.width, rect.top + rect.height);
        }
    }

    addPoint(x: number, y: number) {
        if (this.minX === undefined || x < this.minX) {
            this.minX = x;
        }

        if (this.maxX === undefined || x > this.maxX) {
            this.maxX = x;
        }

        if (this.minY === undefined || y < this.minY) {
            this.minY = y;
        }

        if (this.maxY === undefined || y > this.maxY) {
            this.maxY = y;
        }
    }

    getRect() {
        if (this.minX === undefined) {
            return undefined;
        }
        return {
            left: this.minX,
            top: this.minY,
            width: this.maxX - this.minX,
            height: this.maxY - this.minY
        };
    }
}

export function pointDistanceSquared(p1: Point, p2?: Point) {
    let dx = p1.x;
    let dy = p1.y;

    if (p2) {
        dx -= p2.x;
        dy -= p2.y;
    }

    return dx * dx + dy * dy;
}

export function pointDistance(p1: Point, p2?: Point) {
    return Math.sqrt(pointDistanceSquared(p1, p2));
}

export function pointInRect(point: Point, rect: Rect) {
    return (
        point.x >= rect.left &&
        point.x < rect.left + rect.width &&
        point.y >= rect.top &&
        point.y < rect.top + rect.height
    );
}

export function isRectInsideRect(r1: Rect, r2: Rect) {
    return (
        r1.left >= r2.left &&
        r1.left + r1.width <= r2.left + r2.width &&
        r1.top >= r2.top &&
        r1.top + r1.height <= r2.top + r2.height
    );
}

export function pointScale(point: Point, scale: number) {
    return {
        x: point.x * scale,
        y: point.y * scale
    };
}

export function rectScale(rect: Rect, scale: number) {
    return {
        left: rect.left * scale,
        top: rect.top * scale,
        width: rect.width * scale,
        height: rect.height * scale
    };
}

export function rectExpand(rect: Rect, amount: number) {
    return {
        left: rect.left - amount,
        top: rect.top - amount,
        width: rect.width + 2 * amount,
        height: rect.height + 2 * amount
    };
}

export function rectEqual(r1: Rect, r2: Rect) {
    return (
        r1.left === r2.left && r1.top === r2.top && r1.width === r2.width && r1.height === r2.height
    );
}

export function closestPointOnSegment(p: Point, v: Point, w: Point) {
    var l2 = pointDistanceSquared(v, w);
    if (l2 == 0) {
        return v;
    }
    var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    };
}

export function matrixToTransformString(m: SVGMatrix) {
    return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
}

const SCALES = [
    0.005,
    0.01,
    0.02,
    0.03,
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
    @observable _translate: Point;
    @observable _scale: number;

    @observable
    clientRect = {
        left: 0,
        top: 0,
        width: 1,
        height: 1
    };

    @observable
    scrollOffset = {
        x: 0,
        y: 0
    };

    constructor(params: { translate: Point; scale: number }) {
        Object.assign(this, params);
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

    get centerPoint() {
        let rect = this.clientToModelRect(this.clientRect);
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

    @action
    translateByScrollOffset() {
        this.translate = {
            x: this.translate.x + this.scrollOffset.x,
            y: this.translate.y + this.scrollOffset.y
        };
        this.scrollOffset = {
            x: 0,
            y: 0
        };
    }

    @action
    translateBy(translate: Point) {
        this.translate = {
            x: this.translate.x + translate.x,
            y: this.translate.y + translate.y
        };
    }
}
