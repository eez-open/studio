import * as React from "react";
import { observer } from "mobx-react";

import styled from "eez-studio-ui/styled-components";

import { EditorComponent } from "project-editor/core/metaData";

import { BitmapProperties } from "project-editor/project/features/gui/bitmap";
import { getStyleProperty } from "project-editor/project/features/gui/style";

const BitmapEditorContainer = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: center; /* align horizontal */
    align-items: center; /* align vertical */
`;

@observer
export class BitmapEditor extends EditorComponent {
    render() {
        const bitmap = this.props.editor.object as BitmapProperties;

        const style = {
            backgroundColor:
                bitmap.bpp === 32
                    ? "transparent"
                    : getStyleProperty(bitmap.style, "backgroundColor"),
            width: "100%"
        };

        return (
            <BitmapEditorContainer>
                <div>
                    <div>
                        <img src={bitmap.image} style={style} />
                    </div>
                    {bitmap.imageElement && (
                        <h4>
                            Dimension: {bitmap.imageElement.width} x {bitmap.imageElement.height}
                        </h4>
                    )}
                </div>
            </BitmapEditorContainer>
        );
    }
}
