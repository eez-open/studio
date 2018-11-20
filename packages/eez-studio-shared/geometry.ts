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

export function pointDotProduct(p1: Point, p2: Point) {
    return p1.x * p2.x + p1.y * p2.y;
}

export function pointAdd(p1: Point, p2: Point) {
    return {
        x: p1.x + p2.x,
        y: p1.y + p2.y
    };
}

export function pointSub(p1: Point, p2: Point) {
    return {
        x: p1.x - p2.x,
        y: p1.y - p2.y
    };
}

export function pointMul(p: Point, f: number) {
    return {
        x: p.x * f,
        y: p.y * f
    };
}

export function pointInRect(point: Point, rect: Rect) {
    return (
        point.x >= rect.left &&
        point.x < rect.left + rect.width &&
        point.y >= rect.top &&
        point.y < rect.top + rect.height
    );
}

export function pointSegmentDistance(p: Point, s: Segment) {
    // Return minimum distance between line segment vw and point p
    // http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment

    let l2 = segmentLengthSquared(s); // i.e. |s|^2 -  avoid a sqrt
    if (l2 == 0.0) {
        // s.p1 == s.p2 case
        return pointDistance(p, s.p1);
    }

    // Consider the line extending the segment, parameterized as s.p1 + t (s.p2 - s.p1).
    // We find projection of point p onto the line.
    // It falls where t = [(p-s.p1) . (s.p2-s.p1)] / |s|^2
    // We clamp t from [0,1] to handle points outside the segment s.
    let t = Math.max(0, Math.min(1, pointDotProduct(pointSub(p, s.p1), pointSub(s.p2, s.p1)) / l2));
    let projection = pointAdd(s.p1, pointMul(pointSub(s.p2, s.p1), t)); // Projection falls on the segment
    return pointDistance(p, projection);
}

export function rectCenter(rect: Rect): Point {
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

export function rectOverlap(r1: Rect, r2: Rect) {
    return (
        r1.left < r2.left + r2.width &&
        r1.left + r1.width > r2.left &&
        r1.top < r2.top + r2.height &&
        r1.top + r1.height > r2.top
    );
}

export function rectContains(r1: Rect, r2: Rect) {
    return (
        r1.left <= r2.left &&
        r1.left + r1.width >= r2.left + r2.width &&
        r1.top <= r2.top &&
        r1.top + r1.height >= r2.top + r2.height
    );
}

export function boundingRect(r1?: Rect, r2?: Rect): Rect | undefined {
    if (!r1) {
        return r2 && Object.assign({}, r2);
    }

    if (!r2) {
        return Object.assign({}, r1);
    }

    let x = Math.min(r1.left, r2.left);
    let y = Math.min(r1.top, r2.top);

    return {
        left: x,
        top: y,
        width: Math.max(r1.left + r1.width, r2.left + r2.width) - x,
        height: Math.max(r1.top + r1.height, r2.top + r2.height) - y
    };
}

export function rectSegmentIntersection(rect: Rect, s: Segment): Point | undefined {
    let topLeft = { x: rect.left, y: rect.top };
    let topRight = { x: rect.left + rect.width, y: rect.top };

    let p = segmentSegmentIntersecttion({ p1: topLeft, p2: topRight }, s);
    if (p) {
        return p;
    }

    let bottomLeft = { x: rect.left, y: rect.top + rect.height };

    p = segmentSegmentIntersecttion({ p1: topLeft, p2: bottomLeft }, s);
    if (p) {
        return p;
    }

    let bottomRight = { x: rect.left + rect.width, y: rect.top + rect.height };

    p = segmentSegmentIntersecttion({ p1: bottomLeft, p2: bottomRight }, s);
    if (p) {
        return p;
    }

    p = segmentSegmentIntersecttion({ p1: topRight, p2: bottomRight }, s);
    if (p) {
        return p;
    }

    return undefined;
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

export interface ITransform {
    translate: Point;
    scale: number;
}

export class Transform implements ITransform {
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
        for (let i = 0; i < SCALES.length; i++) {
            if (SCALES[i] - this.scale > 0.001) {
                return SCALES[i];
            }
        }

        return this.scale;
    }

    previousScale() {
        for (let i = SCALES.length - 1; i >= 0; i--) {
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

    cloneWithScrollOffsetApplied() {
        const transform = new Transform({
            translate: {
                x: this.translate.x + this.scrollOffset.x,
                y: this.translate.y + this.scrollOffset.y
            },
            scale: this.scale
        });
        transform.clientRect = this.clientRect;
        return transform;
    }

    @action
    translateBy(translate: Point) {
        this.translate = {
            x: this.translate.x + translate.x,
            y: this.translate.y + translate.y
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface Segment {
    p1: Point;
    p2: Point;
}

export function segmentSegmentIntersecttion(s1: Segment, s2: Segment): Point | undefined {
    // http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect
    let s1_x = s1.p2.x - s1.p1.x;
    let s1_y = s1.p2.y - s1.p1.y;
    let s2_x = s2.p2.x - s2.p1.x;
    let s2_y = s2.p2.y - s2.p1.y;

    let s =
        (-s1_y * (s1.p1.x - s2.p1.x) + s1_x * (s1.p1.y - s2.p1.y)) / (-s2_x * s1_y + s1_x * s2_y);
    let t =
        (s2_x * (s1.p1.y - s2.p1.y) - s2_y * (s1.p1.x - s2.p1.x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        // Collision detected
        return {
            x: s1.p1.x + t * s1_x,
            y: s1.p1.y + t * s1_y
        };
    }

    return undefined;
}

export function segmentLengthSquared(s: Segment) {
    return pointDistanceSquared(s.p1, s.p2);
}

export function segmentLength(s: Segment) {
    return pointDistance(s.p1, s.p2);
}
