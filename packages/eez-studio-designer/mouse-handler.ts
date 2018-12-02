import { Point } from "eez-studio-shared/geometry";
import { IDesignerContext, IMouseHandler } from "eez-studio-designer/designer-interfaces";

export class MouseHandler implements IMouseHandler {
    constructor() {}

    timeAtDown: number;
    elapsedTime: number;

    offsetPointAtDown: Point;
    lastOffsetPoint: Point;
    offsetDistance: Point;
    movement: Point;

    modelPointAtDown: Point;
    lastModelPoint: Point;

    cursor: string = "default";

    down(context: IDesignerContext, event: MouseEvent) {
        event.preventDefault();

        this.timeAtDown = new Date().getTime();

        this.lastOffsetPoint = this.offsetPointAtDown = context.viewState.transform.mouseEventToOffsetPoint(
            event
        );
        this.offsetDistance = { x: 0, y: 0 };
        this.movement = { x: 0, y: 0 };

        this.modelPointAtDown = context.viewState.transform.mouseEventToModelPoint(event);
    }

    move(context: IDesignerContext, event: MouseEvent) {
        event.preventDefault();

        this.elapsedTime = new Date().getTime() - this.timeAtDown;

        let offsetPoint = context.viewState.transform.mouseEventToOffsetPoint(event);

        this.offsetDistance = {
            x: offsetPoint.x - this.offsetPointAtDown.x,
            y: offsetPoint.y - this.offsetPointAtDown.y
        };

        this.movement = {
            x: offsetPoint.x - this.lastOffsetPoint.x,
            y: offsetPoint.y - this.lastOffsetPoint.y
        };

        this.lastOffsetPoint = offsetPoint;

        this.lastModelPoint = context.viewState.transform.mouseEventToModelPoint(event);
    }

    up(context: IDesignerContext, event?: MouseEvent) {
        if (event) {
            this.move(context, event);
        }
    }

    get selectionVisible() {
        return true;
    }
}
