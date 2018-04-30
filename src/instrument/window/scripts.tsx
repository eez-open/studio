import * as React from "react";
import { observable, computed, values, action, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";

import { stringCompare } from "shared/string";

import { AlertDanger } from "shared/ui/alert";
import { Container } from "shared/ui/container";
import { Splitter } from "shared/ui/splitter";
import { List } from "shared/ui/list";
import { ButtonAction } from "shared/ui/action";
import { CodeEditor } from "shared/ui/code-editor";

import { navigationStore, scriptsNavigationItem } from "instrument/window/app";
import { appStore } from "instrument/window/app-store";
import { shortcutsStore } from "instrument/window/shortcuts";
import { IShortcut } from "shortcuts/interfaces";
import { Terminal } from "instrument/window/terminal/terminal";
import { IModel, undoManager } from "instrument/window/undo";

class ScriptsModel implements IModel {
    @observable _newActionCode: string | undefined;
    get newActionCode() {
        return this._newActionCode;
    }
    set newActionCode(value: string | undefined) {
        runInAction(() => {
            this._newActionCode = value;
        });
        if (this.modified) {
            undoManager.model = this;
        } else {
            undoManager.model = undefined;
        }
    }

    @observable errorMessage: string | undefined;
    @observable errorLineNumber: number | undefined;
    @observable errorColumnNumber: number | undefined;
    @observable terminalVisible: boolean;

    @computed
    get selectedScript() {
        return values(shortcutsStore.shortcuts).find(
            script => script.id === navigationStore.selectedScriptId
        );
    }

    @computed
    get modified() {
        return !!(
            this.selectedScript &&
            this.newActionCode &&
            this.selectedScript.action.data !== this.newActionCode
        );
    }

    @action.bound
    commit() {
        if (this.selectedScript) {
            shortcutsStore.updateShortcut({
                id: this.selectedScript.id,
                action: Object.assign({}, toJS(this.selectedScript.action), {
                    data: this.newActionCode
                })
            });
        }
        this.newActionCode = undefined;
    }

    @action.bound
    rollback() {
        if (this.selectedScript) {
            this._newActionCode = undefined;
        }
    }

    @action.bound
    dismissError() {
        this.errorMessage = undefined;
    }

    @action.bound
    toggleTerminal() {
        this.terminalVisible = !this.terminalVisible;
    }

    get canUndo() {
        return ScriptView.codeEditor ? ScriptView.codeEditor.canUndo : false;
    }

    undo() {
        if (ScriptView.codeEditor) {
            ScriptView.codeEditor.undo();
        }
    }

    get canRedo() {
        return ScriptView.codeEditor ? ScriptView.codeEditor.canRedo : false;
    }

    redo() {
        if (ScriptView.codeEditor) {
            ScriptView.codeEditor.redo();
        }
    }
}

export const scriptsModel = new ScriptsModel();

@observer
export class ScriptView extends React.Component<{}, {}> {
    static codeEditor: CodeEditor | null;

    render() {
        let codeEditor;

        if (scriptsModel.selectedScript) {
            codeEditor = (
                <CodeEditor
                    ref={ref => (ScriptView.codeEditor = ref)}
                    value={scriptsModel.selectedScript.action.data}
                    onChange={(value: string) => {
                        scriptsModel.newActionCode = value;
                    }}
                    mode={
                        scriptsModel.selectedScript.action.type === "scpi-commands"
                            ? "scpi"
                            : "javascript"
                    }
                    lineNumber={scriptsModel.errorLineNumber}
                    columnNumber={scriptsModel.errorColumnNumber}
                />
            );
        }

        return (
            <div className="EezStudio_Scripts">
                {scriptsModel.errorMessage && (
                    <AlertDanger className="mb-0" onDismiss={scriptsModel.dismissError}>
                        {scriptsModel.errorMessage}
                    </AlertDanger>
                )}
                {codeEditor}
            </div>
        );
    }
}

@observer
class MasterView extends React.Component<
{
    selectedScript: IShortcut | undefined;
    selectScript: (script: IShortcut) => void;
},
{}
> {
    @computed
    get sortedLists() {
        return Array.from(shortcutsStore.shortcuts.values())
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(script => ({
                id: script.id,
                data: script,
                selected: scriptsModel.selectedScript === script
            }));
    }

    render() {
        return (
            <List
                nodes={this.sortedLists}
                renderNode={node => <div>{node.data.name}</div>}
                selectNode={node => this.props.selectScript(node.data)}
            />
        );
    }
}

@observer
export class ScriptsEditor extends React.Component<{}, {}> {
    render() {
        return (
            <Splitter
                type="horizontal"
                sizes={scriptsModel.terminalVisible ? "50%|50%" : "100%"}
                persistId="instrument/window/scripts/splitter"
            >
                <Container>
                    <Splitter
                        type="horizontal"
                        sizes="240px|100%"
                        persistId="instrument/lists/splitter"
                    >
                        <MasterView
                            selectedScript={scriptsModel.selectedScript}
                            selectScript={action(
                                (script: IShortcut) =>
                                    (navigationStore.selectedScriptId = script.id)
                            )}
                        />
                        <ScriptView />
                    </Splitter>
                </Container>

                {scriptsModel.terminalVisible && appStore.instrument && <Terminal instrument={appStore.instrument} />}
            </Splitter>
        );
    }
}

export function render() {
    return <ScriptsEditor />;
}

export function toolbarButtonsRender() {
    return (
        <React.Fragment>
            {scriptsModel.modified && (
                <ButtonAction
                    text="Save"
                    icon="material:save"
                    className="btn-secondary"
                    title="Save changes"
                    onClick={scriptsModel.commit}
                />
            )}
            <ButtonAction
                text={scriptsModel.terminalVisible ? "Hide Terminal" : "Show Terminal"}
                className="btn-secondary"
                title={scriptsModel.terminalVisible ? "Hide terminal" : "Show terminal"}
                onClick={scriptsModel.toggleTerminal}
            />
        </React.Fragment>
    );
}

////////////////////////////////////////////////////////////////////////////////

export const showScriptError = action(
    (
        shortcut: IShortcut,
        errorMessage: string,
        errorLineNumber: number | undefined,
        errorColumnNumber: number | undefined
    ) => {
        navigationStore.mainNavigationSelectedItem = scriptsNavigationItem;
        navigationStore.selectedScriptId = shortcut.id;
        scriptsModel.errorMessage = errorMessage;
        scriptsModel.errorLineNumber = errorLineNumber;
        scriptsModel.errorColumnNumber = errorColumnNumber;
    }
);

export function insertScpiCommandIntoCode(scpiCommand: string) {
    if (!ScriptView.codeEditor || !scriptsModel.selectedScript) {
        return;
    }

    let text;

    if (scriptsModel.selectedScript.action.type === "scpi-commands") {
        text = scpiCommand;
    } else if (scriptsModel.selectedScript.action.type === "javascript") {
        text = `connection.command("${scpiCommand}");`;
    } else {
        return;
    }

    ScriptView.codeEditor.insertText(text);
}

export function insertScpiQueryIntoCode(scpiQuery: string) {
    if (!ScriptView.codeEditor || !scriptsModel.selectedScript) {
        return;
    }

    let text;

    if (scriptsModel.selectedScript.action.type === "scpi-commands") {
        text = scpiQuery;
    } else if (scriptsModel.selectedScript.action.type === "javascript") {
        text = `var <name> = await connection.query("${scpiQuery}");`;
    } else {
        return;
    }

    ScriptView.codeEditor.insertText(text);
}
