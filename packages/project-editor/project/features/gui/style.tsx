import { observer } from "mobx-react";
import React from "react";
import styled from "eez-studio-ui/styled-components";

import { EezObject, EditorComponent } from "project-editor/model/object";

import { Style, isWidgetParentOfStyle } from "project-editor/project/features/gui/page-editor/style";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";
import { drawText } from "project-editor/project/features/gui/draw";

////////////////////////////////////////////////////////////////////////////////

export { Style, getStyleProperty } from "project-editor/project/features/gui/page-editor/style";

////////////////////////////////////////////////////////////////////////////////

const Image = styled.img`
    display: block;
    margin: auto;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
`;

@observer
export class StyleEditor extends EditorComponent {
    render() {
        let canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 320;
        drawStylePreview(canvas, this.props.editor.object as Style);

        return <Image src={canvas.toDataURL()} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

Style.classInfo.isEditorSupported = (object: EezObject) => !isWidgetParentOfStyle(object);
Style.classInfo.editorComponent = StyleEditor;

Style.classInfo.navigationComponent = ListNavigationWithContent;

export function drawStylePreview(canvas: HTMLCanvasElement, style: Style) {
    let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (ctx) {
        ctx.save();
        ctx.translate(Math.floor((canvas.width - 240) / 2), Math.floor((canvas.height - 320) / 2));
        ctx.drawImage(drawText("Hello!", 240, 160, style, false), 0, 0);
        ctx.drawImage(drawText("Hello!", 240, 160, style, true), 0, 160);
        ctx.restore();
    }
}
