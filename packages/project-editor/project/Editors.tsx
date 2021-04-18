import React from "react";
import { observer } from "mobx-react";
import styled from "eez-studio-ui/styled-components";
import { TabsView } from "eez-studio-ui/tabs";
import { getEditorComponent } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

@observer
class Editor extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        let editor: JSX.Element | undefined;

        let activeEditor = this.context.EditorsStore.activeEditor;
        if (activeEditor) {
            let EditorComponent = getEditorComponent(activeEditor.object);
            if (EditorComponent) {
                editor = <EditorComponent editor={activeEditor} />;
            }
        }

        return editor || <div />;
    }
}
////////////////////////////////////////////////////////////////////////////////
const EditorsDiv = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    > div:nth-child(1) {
        background-color: ${props => props.theme.panelHeaderColor};
        border-bottom: 1px solid ${props => props.theme.borderColor};
    }
`;

@observer
export class Editors extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <EditorsDiv>
                <div>
                    <TabsView tabs={this.context.EditorsStore.editors} />
                </div>
                <Editor />
            </EditorsDiv>
        );
    }
}
