import { IDesignerContext } from "eez-studio-designer/designer-interfaces";
import { MouseHandler } from "eez-studio-designer/mouse-handler";

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
