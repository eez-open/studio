import { Point } from "eez-studio-shared/geometry";
import {
    IDesignerContext,
    IMouseHandler
} from "project-editor/project/features/gui/page-editor/designer-interfaces";

export class MouseHandler implements IMouseHandler {
    constructor() {}

    timeAtDown: number;
    elapsedTime: number;

    offsetPointAtDown: Point;
    lastOffsetPoint: Point;
    offsetDistance: Point;
    movement: Point;
    distance: number;

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
        this.distance = 0;
        this.movement = { x: 0, y: 0 };

        this.modelPointAtDown = context.viewState.transform.mouseEventToPagePoint(event);
    }

    move(context: IDesignerContext, event: MouseEvent) {
        event.preventDefault();

        this.elapsedTime = new Date().getTime() - this.timeAtDown;

        let offsetPoint = context.viewState.transform.mouseEventToOffsetPoint(event);

        this.offsetDistance = {
            x: offsetPoint.x - this.offsetPointAtDown.x,
            y: offsetPoint.y - this.offsetPointAtDown.y
        };

        this.distance = Math.sqrt(
            this.offsetDistance.x * this.offsetDistance.x +
                this.offsetDistance.y * this.offsetDistance.y
        );

        this.movement = {
            x: offsetPoint.x - this.lastOffsetPoint.x,
            y: offsetPoint.y - this.lastOffsetPoint.y
        };

        this.lastOffsetPoint = offsetPoint;

        this.lastModelPoint = context.viewState.transform.mouseEventToPagePoint(event);
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

export class PanMouseHandler extends MouseHandler {
    totalMovement = {
        x: 0,
        y: 0
    };

    cursor = "default";

    down(context: IDesignerContext, event: MouseEvent) {
        super.down(context, event);
    }

    move(context: IDesignerContext, event: MouseEvent) {
        super.move(context, event);
        context.viewState.transform.translateBy(this.movement);
        this.totalMovement.x += this.movement.x;
        this.totalMovement.y += this.movement.y;
    }
}
