import { ICanvas, MouseHandler } from "shared/ui/designer";

export class PanMouseHandler extends MouseHandler {
    totalMovement = {
        x: 0,
        y: 0
    };

    cursor = "default";

    down(canvas: ICanvas, event: MouseEvent) {
        super.down(canvas, event);
    }

    move(canvas: ICanvas, event: MouseEvent) {
        super.move(canvas, event);
        canvas.translateBy(this.movement);
        this.totalMovement.x += this.movement.x;
        this.totalMovement.y += this.movement.y;
    }
}
