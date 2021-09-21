import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import update from "immutability-helper";

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

        let activeEditor = this.context.editorsStore.activeEditor;
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

@observer
export class Editors extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <div className="EezStudio_ProjectEditors">
                <div>
                    <TabsView
                        tabs={this.context.editorsStore.editors}
                        moveTab={action(
                            (dragIndex: number, hoverIndex: number) => {
                                const tab =
                                    this.context.editorsStore.editors[
                                        dragIndex
                                    ];

                                this.context.editorsStore.editors = update(
                                    this.context.editorsStore.editors,
                                    {
                                        $splice: [
                                            [dragIndex, 1],
                                            [hoverIndex, 0, tab]
                                        ]
                                    }
                                );
                            }
                        )}
                    />
                </div>
                <div id="eez-project-active-editor">
                    <Editor />
                </div>
            </div>
        );
    }
}
