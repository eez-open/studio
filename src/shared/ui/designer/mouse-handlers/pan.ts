import { IDocument } from "shared/ui/designer/designer-interfaces";
import { MouseHandler } from "shared/ui/designer/mouse-handler";

export class PanMouseHandler extends MouseHandler {
    totalMovement = {
        x: 0,
        y: 0
    };

    cursor = "default";

    down(document: IDocument, event: MouseEvent) {
        super.down(document, event);
    }

    move(document: IDocument, event: MouseEvent) {
        super.move(document, event);
        document.transform.translateBy(this.movement);
        this.totalMovement.x += this.movement.x;
        this.totalMovement.y += this.movement.y;
    }
}
