import { Point } from "shared/geometry";

import { IDocument, IToolHandler } from "shared/ui/designer/designer-interfaces";

export function createCreateObjectToolHandler(createObjectCallback: () => any): IToolHandler {
    function createObject(document: IDocument, point: Point) {
        let params = createObjectCallback();
        document.createObject(params);
    }

    return {
        onClick(document: IDocument, point: Point) {
            createObject(document, point);
        },

        onContextMenu(document: IDocument, point: Point): void {},

        cursor: "crosshair",

        canDrag: true,

        drop(document: IDocument, point: Point) {
            createObject(document, point);
        },

        createMouseHandler(document: IDocument, event: MouseEvent) {
            return undefined;
        }
    };
}
