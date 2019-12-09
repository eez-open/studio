import React from "react";
import { observable, computed, values, action, runInAction, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { stringCompare } from "eez-studio-shared/string";
import { validators } from "eez-studio-shared/validation";

import styled from "eez-studio-ui/styled-components";
import { AlertDanger } from "eez-studio-ui/alert";
import { Splitter } from "eez-studio-ui/splitter";
import { List } from "eez-studio-ui/list";
import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { CodeEditor } from "eez-studio-ui/code-editor";
import { VerticalHeaderWithBody, ToolbarHeader, Body } from "eez-studio-ui/header-with-body";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { IShortcut } from "shortcuts/interfaces";
import { DEFAULT_TOOLBAR_BUTTON_COLOR } from "shortcuts/toolbar-button-colors";

import { InstrumentAppStore } from "instrument/window/app-store";
import { executeShortcut } from "instrument/window/script";
import { IModel } from "instrument/window/undo";

import { Terminal } from "instrument/window/terminal/terminal";

export class ScriptsModel implements IModel {
    constructor(private appStore: InstrumentAppStore) {}

    @observable _newActionCode: string | undefined;

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

    @observable errorMessage: string | undefined;
    @observable errorLineNumber: number | undefined;
    @observable errorColumnNumber: number | undefined;
    @observable terminalVisible: boolean;

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

    @bind
    addScript() {
        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique({}, values(this.appStore.shortcutsStore.shortcuts))
                        ]
                    }
                ]
            },

            values: {
                name: ""
            }
        })
            .then(result => {
                this.appStore.shortcutsStore.addShortcut({
                    name: result.values.name,
                    action: {
                        type: "micropython",
                        data: ""
                    },
                    keybinding: "",
                    groupName: "",
                    showInToolbar: false,
                    toolbarButtonPosition: 0,
                    toolbarButtonColor: DEFAULT_TOOLBAR_BUTTON_COLOR,
                    requiresConfirmation: false,
                    selected: false
                });

                console.log(result);
                // beginTransaction("Add instrument list");
                // let listId = this.props.appStore.instrumentListStore.createObject({
                //     type: result.values.type,
                //     name: result.values.name,
                //     description: result.values.description,
                //     data: createEmptyListData(
                //         result.values.type,
                //         {
                //             duration: result.values.duration,
                //             numSamples: result.values.numSamples
                //         },
                //         this.props.appStore.instrument!
                //     )
                // });
                // commitTransaction();

                // this.props.appStore.navigationStore.selectedListId = listId;

                // setTimeout(() => {
                //     let element = document.querySelector(`.EezStudio_InstrumentList_${listId}`);
                //     if (element) {
                //         element.scrollIntoView();
                //     }
                // }, 10);
            })
            .catch(() => {});
    }

    @bind
    deleteScript() {}

    @bind
    run() {
        if (this.selectedScript) {
            executeShortcut(this.appStore, this.selectedScript);
        }
    }

    @bind
    upload() {}
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
        const scriptsModel = this.props.appStore.scriptsModel;

        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <IconAction
                        icon="material:add"
                        iconSize={16}
                        title="Add list"
                        onClick={scriptsModel.addScript}
                    />
                    <IconAction
                        icon="material:delete"
                        iconSize={16}
                        title="Remove list"
                        enabled={
                            scriptsModel.selectedScript &&
                            scriptsModel.selectedScript.action.type === "micropython"
                        }
                        onClick={scriptsModel.deleteScript}
                    />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <List
                        nodes={this.sortedLists}
                        renderNode={node => <div>{node.data.name}</div>}
                        selectNode={node => this.props.selectScript(node.data)}
                    />
                </Body>
            </VerticalHeaderWithBody>
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

                {scriptsModel.terminalVisible && appStore.instrument && (
                    <Terminal appStore={appStore} />
                )}
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
            {scriptsModel.selectedScript &&
                appStore.instrument!.connection.isConnected &&
                scriptsModel.selectedScript.action.type === "micropython" && (
                    <ButtonAction
                        text="Upload"
                        icon="material:file_upload"
                        className="btn-secondary"
                        title="Upload script to instrument"
                        onClick={scriptsModel.upload}
                    />
                )}
            {scriptsModel.selectedScript &&
                appStore.instrument!.connection.isConnected &&
                (scriptsModel.selectedScript.action.type === "scpi-commands" ||
                    scriptsModel.selectedScript.action.type === "javascript") && (
                    <ButtonAction
                        text="Run"
                        icon="material:play_arrow"
                        className="btn-secondary"
                        title="Run"
                        onClick={scriptsModel.run}
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
