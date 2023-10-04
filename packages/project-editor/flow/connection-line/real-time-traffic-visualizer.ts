import { settingsController } from "home/settings";
import type { ConnectionLine } from "project-editor/flow/connection-line";
import { ProjectEditor } from "project-editor/project-editor-interface";

const MAX_ACTIVE_CONNECTION_LINES = 250;

const CIRCLE_RADIUS = "4";
const CIRCLE_FILL_COLOR_LIGHT = "#333";
const CIRCLE_FILL_COLOR_DARK = "#FFF";
const CIRCLE_TRAVEL_DURATION = 500;

const connectionLinePaths = new Map<ConnectionLine, SVGPathElement[]>();
const activeConnectionLines: {
    connectionLine: ConnectionLine;
    started: number;
    circles: Map<SVGPathElement, SVGCircleElement>;
}[] = [];
const connectionLinePointsCache = new Map<
    SVGPathElement,
    {
        x: number;
        y: number;
    }[]
>();

let requestAnimationFrameId: any = undefined;

export function registerPath(
    connectionLine: ConnectionLine,
    path: SVGPathElement
) {
    if (!ProjectEditor.getProjectStore(connectionLine).runtime) {
        return;
    }
    let paths = connectionLinePaths.get(connectionLine);
    if (!paths) {
        paths = [];
        connectionLinePaths.set(connectionLine, paths);
    }
    paths.push(path);
}

export function unregisterPath(
    connectionLine: ConnectionLine,
    path: SVGPathElement
) {
    let paths = connectionLinePaths.get(connectionLine);
    if (paths) {
        const i = paths.indexOf(path);
        if (i != -1) {
            paths.splice(i, 1);
            if (paths.length == 0) {
                connectionLinePaths.delete(connectionLine);
            }

            for (let activeConnectionLine of activeConnectionLines) {
                if (activeConnectionLine.connectionLine == connectionLine) {
                    const circle = activeConnectionLine.circles.get(path);
                    if (circle) {
                        circle.remove();
                    }
                }
            }
        }
    }

    connectionLinePointsCache.delete(path);
}

export function activateConnectionLine(connectionLine: ConnectionLine) {
    if (activeConnectionLines.length > MAX_ACTIVE_CONNECTION_LINES) {
        for (const circle of activeConnectionLines[0].circles.values()) {
            circle.remove();
        }
        activeConnectionLines.splice(0, 1);
    }
    activeConnectionLines.push({
        connectionLine,
        started: Date.now(),
        circles: new Map<SVGPathElement, SVGCircleElement>()
    });

    if (!requestAnimationFrameId) {
        requestAnimationFrameId = window.requestAnimationFrame(animate);
    }
}

function getPointAt(path: SVGPathElement, t: number) {
    let points = connectionLinePointsCache.get(path);
    if (!points) {
        const pathLength = path.getTotalLength();
        points = [];
        for (let t = 0; t <= 1.0; t += 0.01) {
            const pt = path.getPointAtLength(t * pathLength);
            points.push({
                x: Math.round(pt.x),
                y: Math.round(pt.y)
            });
        }

        connectionLinePointsCache.set(path, points);
    }

    return points[Math.floor(t * (points.length - 1))];
}

function moveCircle(circle: SVGCircleElement, path: SVGPathElement, t: number) {
    const pt = getPointAt(path, t);
    circle.style.transform = "translate3d(" + pt.x + "px," + pt.y + "px, 0)";
}

function animate() {
    requestAnimationFrameId = undefined;

    const now = Date.now();

    let i = 0;
    while (i < activeConnectionLines.length) {
        const activeConnectionLine = activeConnectionLines[i];
        const t = (now - activeConnectionLine.started) / CIRCLE_TRAVEL_DURATION;
        if (
            t > 1.0 ||
            !ProjectEditor.getProject(activeConnectionLine.connectionLine)
                ._store.runtime
        ) {
            for (const circle of activeConnectionLine.circles.values()) {
                circle.remove();
            }
            activeConnectionLines.splice(i, 1);
            continue;
        }
        i++;

        const paths = connectionLinePaths.get(
            activeConnectionLine.connectionLine
        );
        if (paths) {
            for (let path of paths) {
                let circle = activeConnectionLine.circles.get(path);
                if (!circle) {
                    const g = path.parentElement?.parentElement!;
                    circle = document.createElementNS(
                        "http://www.w3.org/2000/svg",
                        "circle"
                    ) as SVGCircleElement;
                    circle.setAttributeNS(null, "r", CIRCLE_RADIUS);
                    circle.setAttributeNS(
                        null,
                        "fill",
                        settingsController.isDarkTheme
                            ? CIRCLE_FILL_COLOR_DARK
                            : CIRCLE_FILL_COLOR_LIGHT
                    );
                    g.appendChild(circle);
                    activeConnectionLine.circles.set(path, circle);
                }
                moveCircle(circle, path, t);
            }
        }
    }

    if (activeConnectionLines.length > 0) {
        requestAnimationFrameId = window.requestAnimationFrame(animate);
    }
}
