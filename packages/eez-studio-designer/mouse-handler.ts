import { Point } from "eez-studio-shared/geometry";
import { IDocument, IMouseHandler } from "eez-studio-designer/designer-interfaces";

export class MouseHandler implements IMouseHandler {
    constructor() {}

    offsetPointAtDown: Point;
    lastOffsetPoint: Point;
    offsetDistance: Point;
    movement: Point;

    modelPointAtDown: Point;
    lastModelPoint: Point;

    cursor: string = "default";

    down(document: IDocument, event: MouseEvent) {
        event.preventDefault();

        this.lastOffsetPoint = this.offsetPointAtDown = document.transform.mouseEventToOffsetPoint(
            event
        );
        this.offsetDistance = { x: 0, y: 0 };
        this.movement = { x: 0, y: 0 };

        this.modelPointAtDown = document.transform.mouseEventToModelPoint(event);
    }

    move(document: IDocument, event: MouseEvent) {
        event.preventDefault();

        let offsetPoint = document.transform.mouseEventToOffsetPoint(event);

        this.offsetDistance = {
            x: offsetPoint.x - this.offsetPointAtDown.x,
            y: offsetPoint.y - this.offsetPointAtDown.y
        };

        this.movement = {
            x: offsetPoint.x - this.lastOffsetPoint.x,
            y: offsetPoint.y - this.lastOffsetPoint.y
        };

        this.lastOffsetPoint = offsetPoint;

        this.lastModelPoint = document.transform.mouseEventToModelPoint(event);
    }

    up(document: IDocument, event?: MouseEvent) {
        if (event) {
            this.move(document, event);
        }
    }
}
