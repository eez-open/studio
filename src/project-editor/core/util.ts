import { _isEqual } from "shared/algorithm";

////////////////////////////////////////////////////////////////////////////////

export interface Point {
    x: number;
    y: number;
}

export function pointDistanceSquared(p1: Point, p2: Point) {
    let dx = p1.x - p2.x;
    let dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}

export function pointDistance(p1: Point, p2: Point) {
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

export function pointInRect(p: Point, r: Rect) {
    return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
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

////////////////////////////////////////////////////////////////////////////////

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function rectCenter(rect: Rect): Point {
    return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
    };
}

export function rectOverlap(r1: Rect, r2: Rect) {
    return (
        r1.x < r2.x + r2.width &&
        r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height &&
        r1.y + r1.height > r2.y
    );
}

export function rectContains(r1: Rect, r2: Rect) {
    return (
        r1.x <= r2.x &&
        r1.x + r1.width >= r2.x + r2.width &&
        r1.y <= r2.y &&
        r1.y + r1.height >= r2.y + r2.height
    );
}

export function boundingRect(r1?: Rect, r2?: Rect): Rect | undefined {
    if (!r1) {
        return r2 && Object.assign({}, r2);
    }

    if (!r2) {
        return Object.assign({}, r1);
    }

    let x = Math.min(r1.x, r2.x);
    let y = Math.min(r1.y, r2.y);

    return {
        x: x,
        y: y,
        width: Math.max(r1.x + r1.width, r2.x + r2.width) - x,
        height: Math.max(r1.y + r1.height, r2.y + r2.height) - y
    };
}

export function rectSegmentIntersection(rect: Rect, s: Segment): Point | undefined {
    let topLeft = { x: rect.x, y: rect.y };
    let topRight = { x: rect.x + rect.width, y: rect.y };

    let p = segmentSegmentIntersecttion({ p1: topLeft, p2: topRight }, s);
    if (p) {
        return p;
    }

    let bottomLeft = { x: rect.x, y: rect.y + rect.height };

    p = segmentSegmentIntersecttion({ p1: topLeft, p2: bottomLeft }, s);
    if (p) {
        return p;
    }

    let bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };

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

////////////////////////////////////////////////////////////////////////////////

export function formatNumber(value: number, base: number, width: number): string {
    return ("0".repeat(width) + value.toString(base)).substr(-width).toUpperCase();
}

export function generateGuid() {
    let d = new Date().getTime();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        let r = ((d + Math.random() * 16) % 16) | 0;
        d = Math.floor(d / 16);
        return (c == "x" ? r : (r & 0x7) | 0x8).toString(16);
    });
}

export function generateObjectId() {
    return generateGuid();
}

export function confirm(message: string, detail: string | undefined, callback: () => void) {
    EEZStudio.electron.remote.dialog.showMessageBox(
        EEZStudio.electron.remote.getCurrentWindow(),
        {
            type: "question",
            title: "Project Editor - EEZ Studio",
            message: message,
            detail: detail,
            noLink: true,
            buttons: ["Yes", "No"],
            cancelId: 1
        },
        function(buttonIndex) {
            if (buttonIndex == 0) {
                callback();
            }
        }
    );
}

export function isEqual(a: any, b: any) {
    return _isEqual(a, b);
}

export function invariant(cond: boolean, message?: string) {
    if (!cond) {
        throw new Error("[eezstudio] " + (message || "Illegal State"));
    }
}

export function htmlEncode(value: string) {
    return $("<div/>")
        .text(value)
        .html();
}

export function strToColor16(colorStr: string) {
    let color24: any;

    if (colorStr && colorStr[0] == "#") {
        color24 = parseInt(colorStr.substring(1), 16);
    }

    if (color24 === undefined || isNaN(color24)) {
        return NaN;
    }

    const r = (color24 & 0xff0000) >> 16;
    const g = (color24 & 0x00ff00) >> 8;
    const b = color24 & 0x0000ff;

    // rrrrrggggggbbbbb
    let color16 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);

    return color16;
}
