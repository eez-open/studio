import type { Point } from "eez-studio-shared/geometry";
import type { IPointerEvent } from "project-editor/flow/editor/mouse-handler";

const DRAG_SCROLL_BORDER_THRESHOLD = 10;
const DRAG_SCROLL_MIN_SPEED = 50; // px per second
const DRAG_SCROLL_MAX_SPEED = 800; // px per second
const DRAG_SCROLL_MAX_SPEED_AT_DISTANCE = 50; // px

function calcDragScrollSpeed(distance: number, dt: number) {
    if (distance === 0) {
        return 0;
    }

    let sign = 1;

    if (distance < 0) {
        distance = -distance;
        sign = -1;
    }

    const min = (DRAG_SCROLL_MIN_SPEED * dt) / 1000;
    const max = (DRAG_SCROLL_MAX_SPEED * dt) / 1000;

    distance = Math.min(distance, DRAG_SCROLL_MAX_SPEED_AT_DISTANCE);

    return (
        sign *
        (min + (distance / DRAG_SCROLL_MAX_SPEED_AT_DISTANCE) * (max - min))
    );
}

export function setupDragScroll(
    el: Element,
    getLastPointerEvent: () => IPointerEvent | undefined,
    translateBy: (point: Point) => void
) {
    let dragScrollLastTime: number | undefined;

    function onDragScroll() {
        const lastPointerEvent = getLastPointerEvent();
        if (lastPointerEvent) {
            const r = el.getBoundingClientRect();

            let tx = 0;
            let ty = 0;

            if (
                lastPointerEvent.clientX <
                    r.left + DRAG_SCROLL_BORDER_THRESHOLD &&
                lastPointerEvent.movementX < 0
            ) {
                tx =
                    r.left +
                    DRAG_SCROLL_BORDER_THRESHOLD -
                    lastPointerEvent.clientX;
            } else if (
                lastPointerEvent.clientX >
                    r.right - DRAG_SCROLL_BORDER_THRESHOLD &&
                lastPointerEvent.movementX > 0
            ) {
                tx = -(
                    lastPointerEvent.clientX -
                    (r.right - DRAG_SCROLL_BORDER_THRESHOLD)
                );
            }

            if (
                lastPointerEvent.clientY <
                    r.top + DRAG_SCROLL_BORDER_THRESHOLD &&
                lastPointerEvent.movementY < 0
            ) {
                ty =
                    r.top +
                    DRAG_SCROLL_BORDER_THRESHOLD -
                    lastPointerEvent.clientY;
            } else if (
                lastPointerEvent.clientY >
                    r.bottom - DRAG_SCROLL_BORDER_THRESHOLD &&
                lastPointerEvent.movementY > 0
            ) {
                ty = -(
                    lastPointerEvent.clientY -
                    (r.bottom - DRAG_SCROLL_BORDER_THRESHOLD)
                );
            }

            if (tx || ty) {
                if (!dragScrollLastTime) {
                    dragScrollLastTime = new Date().getTime();
                } else {
                    const currentTime = new Date().getTime();
                    const dt = currentTime - dragScrollLastTime;
                    dragScrollLastTime = currentTime;

                    translateBy({
                        x: calcDragScrollSpeed(tx, dt),
                        y: calcDragScrollSpeed(ty, dt)
                    });
                }
            } else {
                dragScrollLastTime = undefined;
            }
        }

        dragScrollAnimationFrameRequest =
            window.requestAnimationFrame(onDragScroll);
    }

    let dragScrollAnimationFrameRequest =
        window.requestAnimationFrame(onDragScroll);

    return () => {
        window.cancelAnimationFrame(dragScrollAnimationFrameRequest);
    };
}
