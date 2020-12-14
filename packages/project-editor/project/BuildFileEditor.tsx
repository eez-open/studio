import { observer } from "mobx-react";
import React from "react";
import { bind } from "bind-decorator";

import { CodeEditor } from "eez-studio-ui/code-editor";

import { DocumentStore } from "project-editor/core/store";

import { BuildFile } from "project-editor/project/project";

@observer
export class BuildFileEditor extends React.Component<{
    buildFile: BuildFile;
}> {
    codeEditor: CodeEditor;

    @bind
    onChange(value: string) {
        DocumentStore.updateObject(this.props.buildFile, {
            template: value
        });
    }

    @bind
    onFocus() {
        DocumentStore.UndoManager.setCombineCommands(true);
    }

    @bind
    onBlur() {
        DocumentStore.UndoManager.setCombineCommands(false);
    }

    componentDidMount() {
        this.codeEditor.resize();
    }

    componentDidUpdate() {
        this.codeEditor.resize();
    }

    render() {
        const { buildFile } = this.props;
        return (
            <CodeEditor
                ref={ref => (this.codeEditor = ref!)}
                mode="c_cpp"
                value={buildFile.template}
                onChange={this.onChange}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
            />
        );
    }
}
