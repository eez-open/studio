import { observer } from "mobx-react";
import React from "react";
import { bind } from "bind-decorator";

import { CodeEditor } from "eez-studio-ui/code-editor";

import { EditorComponent } from "eez-studio-shared/model/object";
import { DocumentStore, UndoManager } from "eez-studio-shared/model/store";

import { Action } from "project-editor/project/features/action/action";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GraphicalImplementationEditor extends React.Component<{}, {}> {
    render() {
        return <div />;
    }
}

////////////////////////////////////////////////////////////////////////////////

interface NativeImplementationEditorProps {
    action: Action;
}

@observer
export class NativeImplementationEditor extends React.Component<
    NativeImplementationEditorProps,
    {}
> {
    codeEditor: CodeEditor;

    @bind
    onChange(value: string) {
        DocumentStore.updateObject(this.props.action, {
            implementation: value
        });
    }

    @bind
    onFocus() {
        UndoManager.setCombineCommands(true);
    }

    @bind
    onBlur() {
        UndoManager.setCombineCommands(false);
    }

    componentDidMount() {
        this.codeEditor.resize();
    }

    componentDidUpdate() {
        this.codeEditor.resize();
    }

    render() {
        return (
            <CodeEditor
                ref={ref => (this.codeEditor = ref!)}
                mode="c_cpp"
                value={this.props.action.implementation || ""}
                onChange={this.onChange}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionEditor extends EditorComponent {
    render() {
        let action = this.props.editor.object as Action;

        if (action.implementationType == "graphical") {
            return <GraphicalImplementationEditor />;
        } else if (action.implementationType == "native") {
            return <NativeImplementationEditor action={action} />;
        } else {
            return <div />;
        }
    }
}
