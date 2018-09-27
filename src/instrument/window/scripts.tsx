import * as React from "react";
import { observable, computed, values, action, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";

import { stringCompare } from "shared/string";

import styled from "shared/ui/styled-components";
import { AlertDanger } from "shared/ui/alert";
import { Splitter } from "shared/ui/splitter";
import { List } from "shared/ui/list";
import { ButtonAction } from "shared/ui/action";
import { CodeEditor } from "shared/ui/code-editor";

import { IShortcut } from "shortcuts/interfaces";

import { InstrumentAppStore } from "instrument/window/app-store";
import { IModel } from "instrument/window/undo";

import { Terminal } from "instrument/window/terminal/terminal";

export class ScriptsModel implements IModel {
    constructor(private appStore: InstrumentAppStore) {}

    @observable
    _newActionCode: string | undefined;
    get newActionCode() {
        return this._newActionCode;
    }
    set newActionCode(value: string | undefined) {
        runInAction(() => {
            this._newActionCode = value;
        });
        if (this.modified) {
            this.appStore.undoManager.model = this;
        } else {
            this.appStore.undoManager.model = undefined;
        }
    }

    @observable
    errorMessage: string | undefined;
    @observable
    errorLineNumber: number | undefined;
    @observable
    errorColumnNumber: number | undefined;
    @observable
    terminalVisible: boolean;

    @computed
    get selectedScript() {
        return values(this.appStore.shortcutsStore.shortcuts).find(
            script => script.id === this.appStore.navigationStore.selectedScriptId
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
            this.appStore.shortcutsStore.updateShortcut({
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

    get codeEditor() {
        return this.appStore.scriptView && this.appStore.scriptView.codeEditor;
    }

    get canUndo() {
        return this.codeEditor ? this.codeEditor.canUndo : false;
    }

    undo() {
        if (this.codeEditor) {
            this.codeEditor.undo();
        }
    }

    get canRedo() {
        return this.codeEditor ? this.codeEditor.canRedo : false;
    }

    redo() {
        if (this.codeEditor) {
            this.codeEditor.redo();
        }
    }
}

const ScriptsContainer = styled.div`
    position: relative;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    & > .ace_editor {
        flex-grow: 1;
    }
`;

@observer
export class ScriptView extends React.Component<{ appStore: InstrumentAppStore }, {}> {
    codeEditor: CodeEditor | null;

    componentDidMount() {
        this.props.appStore.scriptView = this;
    }

    componentWillUnmount() {
        this.props.appStore.scriptView = null;
    }

    render() {
        const scriptsModel = this.props.appStore.scriptsModel;

        let codeEditor;

        if (scriptsModel.selectedScript) {
            codeEditor = (
                <CodeEditor
                    ref={ref => (this.codeEditor = ref)}
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
            <ScriptsContainer>
                {scriptsModel.errorMessage && (
                    <AlertDanger className="mb-0" onDismiss={scriptsModel.dismissError}>
                        {scriptsModel.errorMessage}
                    </AlertDanger>
                )}
                {codeEditor}
            </ScriptsContainer>
        );
    }
}

@observer
class MasterView extends React.Component<{
    appStore: InstrumentAppStore;
    selectedScript: IShortcut | undefined;
    selectScript: (script: IShortcut) => void;
}> {
    @computed
    get sortedLists() {
        return Array.from(this.props.appStore.shortcutsStore.shortcuts.values())
            .sort((a, b) => stringCompare(a.name, b.name))
            .map(script => ({
                id: script.id,
                data: script,
                selected: this.props.appStore.scriptsModel.selectedScript === script
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
export class ScriptsEditor extends React.Component<{ appStore: InstrumentAppStore }> {
    render() {
        const appStore = this.props.appStore;
        const scriptsModel = this.props.appStore.scriptsModel;
        const navigationStore = this.props.appStore.navigationStore;

        return (
            <Splitter
                type="horizontal"
                sizes={scriptsModel.terminalVisible ? "50%|50%" : "100%"}
                persistId="instrument/window/scripts/splitter"
            >
                <Splitter
                    type="horizontal"
                    sizes="240px|100%"
                    persistId="instrument/lists/splitter"
                >
                    <MasterView
                        appStore={appStore}
                        selectedScript={scriptsModel.selectedScript}
                        selectScript={action(
                            (script: IShortcut) => (navigationStore.selectedScriptId = script.id)
                        )}
                    />
                    <ScriptView appStore={appStore} />
                </Splitter>

                {scriptsModel.terminalVisible &&
                    appStore.instrument && <Terminal appStore={appStore} />}
            </Splitter>
        );
    }
}

export function render(appStore: InstrumentAppStore) {
    return <ScriptsEditor appStore={appStore} />;
}

export function toolbarButtonsRender(appStore: InstrumentAppStore) {
    const scriptsModel = appStore.scriptsModel;
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
        appStore: InstrumentAppStore,
        shortcut: IShortcut,
        errorMessage: string,
        errorLineNumber: number | undefined,
        errorColumnNumber: number | undefined
    ) => {
        appStore.navigationStore.navigateToScripts();
        appStore.navigationStore.selectedScriptId = shortcut.id;
        appStore.scriptsModel.errorMessage = errorMessage;
        appStore.scriptsModel.errorLineNumber = errorLineNumber;
        appStore.scriptsModel.errorColumnNumber = errorColumnNumber;
    }
);

export function insertScpiCommandIntoCode(appStore: InstrumentAppStore, scpiCommand: string) {
    const scriptsModel = appStore.scriptsModel;

    const codeEditor = appStore.scriptView && appStore.scriptView.codeEditor;

    if (!codeEditor || !scriptsModel.selectedScript) {
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

    codeEditor.insertText(text);
}

export function insertScpiQueryIntoCode(appStore: InstrumentAppStore, scpiQuery: string) {
    const scriptsModel = appStore.scriptsModel;

    const codeEditor = appStore.scriptView && appStore.scriptView.codeEditor;

    if (!codeEditor || !scriptsModel.selectedScript) {
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

    codeEditor.insertText(text);
}
