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
    minX: number | undefined = undefined;
    maxX: number | undefined = undefined;
    minY: number | undefined = undefined;
    maxY: number | undefined = undefined;

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
        if (
            this.minX === undefined ||
            this.maxX === undefined ||
            this.minY === undefined ||
            this.maxY === undefined
        ) {
            return {
                left: 0,
                top: 0,
                width: 1,
                height: 1
            };
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

export function midPoint(p1: Point, p2: Point) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function pointTranslateX(p: Point, offset: number) {
    return { x: p.x + offset, y: p.y };
}

export function pointTranslateY(p: Point, offset: number) {
    return { x: p.x, y: p.y + offset };
}

export function pointTranslate(p: Point, xOffset: number, yOffset: number) {
    return { x: p.x + xOffset, y: p.y + yOffset };
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
    let t = Math.max(
        0,
        Math.min(
            1,
            pointDotProduct(pointSub(p, s.p1), pointSub(s.p2, s.p1)) / l2
        )
    );
    let projection = pointAdd(s.p1, pointMul(pointSub(s.p2, s.p1), t)); // Projection falls on the segment
    return pointDistance(p, projection);
}

export function rectClone(rect: Rect): Rect {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    };
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

export function rectSegmentIntersection(
    rect: Rect,
    s: Segment
): Point | undefined {
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
        r1.left === r2.left &&
        r1.top === r2.top &&
        r1.width === r2.width &&
        r1.height === r2.height
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

////////////////////////////////////////////////////////////////////////////////

export interface Segment {
    p1: Point;
    p2: Point;
}

export function segmentSegmentIntersecttion(
    s1: Segment,
    s2: Segment
): Point | undefined {
    // http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect
    let s1_x = s1.p2.x - s1.p1.x;
    let s1_y = s1.p2.y - s1.p1.y;
    let s2_x = s2.p2.x - s2.p1.x;
    let s2_y = s2.p2.y - s2.p1.y;

    let s =
        (-s1_y * (s1.p1.x - s2.p1.x) + s1_x * (s1.p1.y - s2.p1.y)) /
        (-s2_x * s1_y + s1_x * s2_y);
    let t =
        (s2_x * (s1.p1.y - s2.p1.y) - s2_y * (s1.p1.x - s2.p1.x)) /
        (-s2_x * s1_y + s1_x * s2_y);

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

// With throw RangeError if not 0 < position < 1
// x1, y1, x2, y2, x3, y3 for quadratic curves
// x1, y1, x2, y2, x3, y3, x4, y4 for cubic curves
// Returns an array of points representing 2 curves. The curves are the same type as the split curve
export function splitCurveAt(
    position: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4?: number,
    y4?: number
) {
    var v1: Point;
    let v2: Point;
    let v3: Point;
    let v4: Point;
    let quad: boolean;
    let retPoints: number[];
    let i: number;
    let c: number;

    // =============================================================================================
    // you may remove this as the function will still work and resulting curves will still render
    // but other curve functions may not like curves with 0 length
    // =============================================================================================
    if (position <= 0 || position >= 1) {
        throw RangeError("spliteCurveAt requires position > 0 && position < 1");
    }

    // =============================================================================================
    // If you remove the above range error you may use one or both of the following commented sections
    // Splitting curves position < 0 or position > 1 will still create valid curves but they will
    // extend past the end points

    // =============================================================================================
    // Lock the position to split on the curve.
    /* optional A
                                        position = position < 0 ? 0 : position > 1 ? 1 : position;
                                        optional A end */

    // =============================================================================================
    // the next commented section will return the original curve if the split results in 0 length curve
    // You may wish to uncomment this If you desire such functionality
    /*  optional B
                                        if(position <= 0 || position >= 1){
                                            if(x4 === undefined || x4 === null){
                                                return [x1, y1, x2, y2, x3, y3];
                                            }else{
                                                return [x1, y1, x2, y2, x3, y3, x4, y4];
                                            }
                                        }
                                        optional B end */

    retPoints = []; // array of coordinates
    i = 0;
    quad = false; // presume cubic bezier
    v1 = { x: x1, y: y1 };
    v2 = { x: x2, y: y2 };
    v3 = { x: x3, y: y3 };
    if (x4 == undefined || y4 == undefined) {
        quad = true; // this is a quadratic bezier
        v4 = v3;
    } else {
        v4 = { x: x4, y: y4 };
    }
    c = position;
    retPoints[i++] = v1.x; // start point
    retPoints[i++] = v1.y;

    if (quad) {
        // split quadratic bezier
        v1.x += (v2.x - v1.x) * c;
        v1.y += (v2.y - v1.y) * c;
        retPoints[i++] = v1.x; // new control point for first curve
        retPoints[i++] = v1.y;
        v2.x += (v4.x - v2.x) * c;
        v2.y += (v4.y - v2.y) * c;
        retPoints[i++] = v1.x + (v2.x - v1.x) * c; // new end and start of first and second curves
        retPoints[i++] = v1.y + (v2.y - v1.y) * c;
        retPoints[i++] = v2.x; // new control point for second curve
        retPoints[i++] = v2.y;
        retPoints[i++] = v4.x; // new endpoint of second curve
        retPoints[i++] = v4.y;
        //=======================================================
        // return array with 2 curves
        return retPoints;
    }

    v1.x += (v2.x - v1.x) * c;
    v1.y += (v2.y - v1.y) * c;

    retPoints[i++] = v1.x; // first curve first control point
    retPoints[i++] = v1.y;

    v2.x += (v3.x - v2.x) * c;
    v2.y += (v3.y - v2.y) * c;

    v3.x += (v4.x - v3.x) * c;
    v3.y += (v4.y - v3.y) * c;

    v1.x += (v2.x - v1.x) * c;
    v1.y += (v2.y - v1.y) * c;

    retPoints[i++] = v1.x; // first curve second control point
    retPoints[i++] = v1.y;

    v2.x += (v3.x - v2.x) * c;
    v2.y += (v3.y - v2.y) * c;

    retPoints[i++] = v1.x + (v2.x - v1.x) * c; // end and start point of first second curves
    retPoints[i++] = v1.y + (v2.y - v1.y) * c;

    retPoints[i++] = v2.x; // second curve first control point
    retPoints[i++] = v2.y;

    retPoints[i++] = v3.x; // second curve second control point
    retPoints[i++] = v3.y;

    retPoints[i++] = v4.x; // endpoint of second curve
    retPoints[i++] = v4.y;

    //=======================================================
    // return array with 2 curves
    return retPoints;
}
