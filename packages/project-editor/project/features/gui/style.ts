import { EezObject } from "eez-studio-shared/model/object";

import { Style, isWidgetParentOfStyle } from "eez-studio-page-editor/style";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

import { drawText } from "project-editor/project/features/gui/draw";
import { StyleEditor } from "project-editor/project/features/gui/StyleEditor";

export { Style, getStyleProperty } from "eez-studio-page-editor/style";

Style.classInfo.isEditorSupported = (object: EezObject) => !isWidgetParentOfStyle(object);
Style.classInfo.editorComponent = StyleEditor;

Style.classInfo.navigationComponent = ListNavigationWithContent;

export function drawStylePreview(canvas: HTMLCanvasElement, style: Style) {
    let ctx = <CanvasRenderingContext2D>canvas.getContext("2d");
    ctx.save();
    ctx.translate(Math.floor((canvas.width - 240) / 2), Math.floor((canvas.height - 320) / 2));
    ctx.drawImage(drawText("Hello!", 240, 160, style, false), 0, 0);
    ctx.drawImage(drawText("Hello!", 240, 160, style, true), 0, 160);
    ctx.restore();
}
