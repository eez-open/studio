import { observer } from "mobx-react";
import * as React from "react";

import { EditorComponent } from "project-editor/core/metaData";

import { StyleProperties, drawStylePreview } from "project-editor/project/features/gui/style";

////////////////////////////////////////////////////////////////////////////////

@observer
export class StyleEditor extends EditorComponent {
    render() {
        let canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 320;
        drawStylePreview(canvas, this.props.editor.object as StyleProperties);

        return (
            <div className="layoutCenter">
                <img className="EezStudio_ProjectEditor_center-block" src={canvas.toDataURL()} />
            </div>
        );
    }
}
