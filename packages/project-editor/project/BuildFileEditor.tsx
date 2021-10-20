import { observer } from "mobx-react";
import React from "react";

import { CodeEditor } from "eez-studio-ui/code-editor";

import type { BuildFile } from "project-editor/project/project";
import { ProjectContext } from "./context";

@observer
export class BuildFileEditor extends React.Component<{
    buildFile: BuildFile;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    codeEditor: CodeEditor;

    onChange = (value: string) => {
        this.context.updateObject(this.props.buildFile, {
            template: value
        });
    };

    onFocus = () => {
        this.context.undoManager.setCombineCommands(true);
    };

    onBlur = () => {
        this.context.undoManager.setCombineCommands(false);
    };

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
