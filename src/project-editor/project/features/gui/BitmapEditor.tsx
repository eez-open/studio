import * as React from "react";

import { EditorComponent } from "project-editor/core/metaData";

import { BitmapProperties } from "project-editor/project/features/gui/bitmap";
import { getStyleProperty } from "project-editor/project/features/gui/style";

export class BitmapEditor extends EditorComponent {
    render() {
        let bitmap = this.props.editor.object as BitmapProperties;

        let style = {
            backgroundColor: getStyleProperty(bitmap.style, "backgroundColor")
        };

        return (
            <div className="layoutCenter EezStudio_ProjectEditor_center-content">
                <div>
                    <div>
                        <img src={bitmap.image} style={style} />
                    </div>
                    <h4>
                        Dimension: {bitmap.imageElement.width} x {bitmap.imageElement.height}
                    </h4>
                </div>
            </div>
        );
    }
}
