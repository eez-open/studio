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
