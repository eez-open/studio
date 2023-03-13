import path from "path";

import React from "react";
import {
    observable,
    computed,
    values,
    action,
    runInAction,
    toJS,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { stringCompare } from "eez-studio-shared/string";
import { validators } from "eez-studio-shared/validation";
import { readTextFile } from "eez-studio-shared/util-electron";
import { _map } from "eez-studio-shared/algorithm";

import { AlertDanger } from "eez-studio-ui/alert";
import { Splitter } from "eez-studio-ui/splitter";
import { List } from "eez-studio-ui/list";
import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { CodeEditor } from "eez-studio-ui/code-editor";
import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { confirm } from "eez-studio-ui/dialog-electron";
import { Icon } from "eez-studio-ui/icon";
import * as notification from "eez-studio-ui/notification";
import { Toolbar } from "eez-studio-ui/toolbar";

import type { IShortcut } from "shortcuts/interfaces";
import { DEFAULT_TOOLBAR_BUTTON_COLOR } from "shortcuts/toolbar-button-colors";
import { showShortcutDialog } from "shortcuts/shortcut-dialog";

import type { InstrumentAppStore } from "instrument/window/app-store";
import {
    executeShortcut,
    isShorcutRunning,
    stopActiveShortcut
} from "instrument/window/script";
import type { IModel } from "instrument/window/undo";

import { Terminal } from "instrument/window/terminal/terminal";

export class ScriptsModel implements IModel {
    constructor(private appStore: InstrumentAppStore) {
        makeObservable(this, {
            _newActionCode: observable,
            errorMessage: observable,
            errorLineNumber: observable,
            errorColumnNumber: observable,
            terminalVisible: observable,
            selectedScript: computed,
            modified: computed,
            commit: action.bound,
            rollback: action.bound,
            dismissError: action.bound,
            toggleTerminal: action.bound,
            canUpload: computed
        });
    }

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

    errorMessage: string | undefined;
    errorLineNumber: number | undefined;
    errorColumnNumber: number | undefined;
    terminalVisible: boolean;

    get selectedScript() {
        return values(this.appStore.shortcutsStore.shortcuts).find(
            script =>
                script.id === this.appStore.navigationStore.selectedScriptId
        );
    }

    get modified() {
        return !!(
            this.selectedScript &&
            this.newActionCode &&
            this.selectedScript.action.data !== this.newActionCode
        );
    }

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

    rollback() {
        if (this.selectedScript) {
            this._newActionCode = undefined;
        }
    }

    dismissError() {
        this.errorMessage = undefined;
    }

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

    addScript = () => {
        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(
                                {},
                                values(this.appStore.shortcutsStore.shortcuts)
                            )
                        ]
                    },
                    {
                        name: "type",
                        type: "enum",
                        enumItems: [
                            {
                                id: "scpi-commands",
                                label: "SCPI"
                            },
                            {
                                id: "javascript",
                                label: "JavaScript"
                            },
                            {
                                id: "micropython",
                                label: "MicroPython"
                            }
                        ],
                        validators: [validators.required]
                    }
                ]
            },

            values: {
                name: "",
                type: "scpi-commands"
            }
        })
            .then(result => {
                const scriptId = this.appStore.shortcutsStore.addShortcut({
                    name: result.values.name,
                    action: {
                        type: result.values.type,
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
                if (scriptId) {
                    this.appStore.navigationStore.changeSelectedScriptId(
                        scriptId
                    );
                }
            })
            .catch(() => {});
    };

    deleteScript = () => {
        const selectedScript = this.selectedScript;
        if (selectedScript) {
            confirm("Are you sure?", undefined, () => {
                this.appStore.shortcutsStore.deleteShortcut(selectedScript);
            });
        }
    };

    run = () => {
        if (this.selectedScript) {
            executeShortcut(this.appStore, this.selectedScript);
        }
    };

    get canUpload() {
        const instrument = this.appStore.instrument;
        const connection = instrument.connection;
        return (
            this.selectedScript &&
            this.selectedScript.action.type === "micropython" &&
            connection.isConnected &&
            instrument.getFileDownloadProperty()
        );
    }

    upload = () => {
        if (this.canUpload) {
            const instrument = this.appStore.instrument;
            const connection = instrument.connection;

            connection.doUpload(
                Object.assign({}, instrument.defaultFileUploadInstructions, {
                    sourceData:
                        this.newActionCode || this.selectedScript!.action.data,
                    sourceFileType: "text/x-python",
                    destinationFileName: this.selectedScript!.name + ".py",
                    destinationFolderPath: "/Scripts"
                }),
                () => notification.success(`Script uploaded.`),
                err =>
                    notification.error(
                        `Failed to upload script: ${err.toString()}`
                    )
            );
        }
    };
}

export class ScriptViewComponent extends React.Component<
    { appStore: InstrumentAppStore },
    {}
> {
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
                        scriptsModel.selectedScript.action.type ===
                        "scpi-commands"
                            ? "scpi"
                            : scriptsModel.selectedScript.action.type ===
                              "javascript"
                            ? "javascript"
                            : "python"
                    }
                    lineNumber={scriptsModel.errorLineNumber}
                    columnNumber={scriptsModel.errorColumnNumber}
                />
            );
        }

        return (
            <div className="EezStudio_BB3_ScriptsContainer">
                {scriptsModel.errorMessage && (
                    <AlertDanger
                        className="mb-0"
                        onDismiss={scriptsModel.dismissError}
                    >
                        {scriptsModel.errorMessage}
                    </AlertDanger>
                )}
                {codeEditor}
            </div>
        );
    }
}
export const ScriptView = observer(ScriptViewComponent);

function getScriptIcon(script: IShortcut) {
    if (script.action.type === "scpi-commands") {
        return <Icon icon="../instrument/_images/scpi.png" />;
    } else if (script.action.type === "javascript") {
        return <Icon icon="../instrument/_images/javascript.png" />;
    } else {
        return <Icon icon="../instrument/_images/micropython.png" />;
    }
}

const MasterView = observer(
    class MasterView extends React.Component<{
        appStore: InstrumentAppStore;
        selectedScript: IShortcut | undefined;
        selectScript: (script: IShortcut) => void;
    }> {
        constructor(props: {
            appStore: InstrumentAppStore;
            selectedScript: IShortcut | undefined;
            selectScript: (script: IShortcut) => void;
        }) {
            super(props);

            makeObservable(this, {
                sortedLists: computed
            });
        }

        get sortedLists() {
            return Array.from(
                this.props.appStore.shortcutsStore.shortcuts.values()
            )
                .sort((a, b) => stringCompare(a.name, b.name))
                .map(script => ({
                    id: script.id,
                    data: script,
                    selected:
                        this.props.appStore.scriptsModel.selectedScript ===
                        script
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
                            title="Add script"
                            onClick={scriptsModel.addScript}
                        />
                        <IconAction
                            icon="material:delete"
                            iconSize={16}
                            title="Delete script"
                            enabled={!!scriptsModel.selectedScript}
                            onClick={scriptsModel.deleteScript}
                        />
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        <List
                            nodes={this.sortedLists}
                            renderNode={node => (
                                <div>
                                    {getScriptIcon(node.data)} {node.data.name}
                                </div>
                            )}
                            selectNode={node =>
                                this.props.selectScript(node.data)
                            }
                        />
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

export const ScriptHeader = observer(
    class ScriptHeader extends React.Component<{
        appStore: InstrumentAppStore;
    }> {
        editShortcut = () => {
            const selectedScript =
                this.props.appStore.scriptsModel.selectedScript;
            if (!selectedScript) {
                return;
            }

            showShortcutDialog(
                this.props.appStore.shortcutsStore,
                this.props.appStore.groupsStore,
                selectedScript,
                shortcut => {
                    this.props.appStore.shortcutsStore.updateShortcut!(
                        shortcut
                    );
                },
                undefined,
                undefined,
                undefined,
                true
            );
        };

        searchAndReplace = action(() => {
            if (this.props.appStore.scriptsModel.codeEditor) {
                this.props.appStore.scriptsModel.codeEditor.openSearchbox();
            }
        });

        render() {
            return (
                <Header className="EezStudio_ScriptsHeaderContainer">
                    <Toolbar
                        style={{
                            display: "flex",
                            justifyContent: "space-between"
                        }}
                    >
                        <ButtonAction
                            text="Edit Shortcut"
                            className="btn-secondary btn-sm"
                            title="Edit shortcut"
                            onClick={this.editShortcut}
                        />
                        <ButtonAction
                            text="Search and replace"
                            icon="material:search"
                            iconSize={20}
                            className="btn-secondary btn-sm"
                            title="Search and replace"
                            onClick={this.searchAndReplace}
                        />
                    </Toolbar>
                </Header>
            );
        }
    }
);

export const DetailsView = observer(
    class DetailsView extends React.Component<{
        appStore: InstrumentAppStore;
    }> {
        render() {
            const { appStore } = this.props;
            return this.props.appStore.scriptsModel.selectedScript ? (
                <VerticalHeaderWithBody>
                    <ScriptHeader appStore={appStore} />
                    <Body>
                        <ScriptView appStore={appStore} />
                    </Body>
                </VerticalHeaderWithBody>
            ) : null;
        }
    }
);

export const ScriptsEditor = observer(
    class ScriptsEditor extends React.Component<{
        appStore: InstrumentAppStore;
    }> {
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
                            selectScript={(script: IShortcut) =>
                                navigationStore.changeSelectedScriptId(
                                    script.id
                                )
                            }
                        />
                        <DetailsView appStore={appStore} />
                    </Splitter>

                    {scriptsModel.terminalVisible && appStore.instrument && (
                        <Terminal appStore={appStore} />
                    )}
                </Splitter>
            );
        }
    }
);

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
            {scriptsModel.canUpload && (
                <ButtonAction
                    text="Upload"
                    icon="material:file_upload"
                    className="btn-secondary"
                    title="Upload script to instrument"
                    onClick={scriptsModel.upload}
                />
            )}
            {!isShorcutRunning() &&
                scriptsModel.selectedScript &&
                appStore.instrument.connection.isConnected &&
                (scriptsModel.selectedScript.action.type === "scpi-commands" ||
                    scriptsModel.selectedScript.action.type ===
                        "javascript") && (
                    <ButtonAction
                        text="Run"
                        icon="material:play_arrow"
                        className="btn-secondary"
                        title="Run"
                        onClick={scriptsModel.run}
                    />
                )}
            {isShorcutRunning() && (
                <ButtonAction
                    text="Stop"
                    icon="material:stop"
                    className="btn-danger"
                    title="Stop"
                    onClick={stopActiveShortcut}
                />
            )}
            <ButtonAction
                text={
                    scriptsModel.terminalVisible
                        ? "Hide Terminal"
                        : "Show Terminal"
                }
                className="btn-secondary"
                title={
                    scriptsModel.terminalVisible
                        ? "Hide terminal"
                        : "Show terminal"
                }
                onClick={scriptsModel.toggleTerminal}
            />
        </React.Fragment>
    );
}

export async function importScript(
    appStore: InstrumentAppStore,
    filePath: string
) {
    const isMicroPython = filePath.toLowerCase().endsWith(".py");
    const isJavaScript = filePath.toLowerCase().endsWith(".js");
    if (!isMicroPython && !isJavaScript) {
        return false;
    }

    const scriptSourceText = await readTextFile(filePath);

    const name = path.basename(filePath, filePath.slice(-3));

    const script = values(appStore.shortcutsStore.shortcuts).find(
        script => script.name === name
    );

    let scriptId: string | undefined;
    if (script) {
        scriptId = script.id;

        if (scriptId == appStore.navigationStore.selectedScriptId) {
            appStore.scriptsModel.newActionCode = scriptSourceText;
            return;
        }

        appStore.shortcutsStore.updateShortcut({
            id: scriptId,
            action: Object.assign({}, toJS(script.action), {
                data: scriptSourceText
            })
        });
    } else {
        scriptId = appStore.shortcutsStore.addShortcut({
            name,
            action: {
                type: isMicroPython ? "micropython" : "javascript",
                data: scriptSourceText
            },
            keybinding: "",
            groupName: "",
            showInToolbar: false,
            toolbarButtonPosition: 0,
            toolbarButtonColor: DEFAULT_TOOLBAR_BUTTON_COLOR,
            requiresConfirmation: false,
            selected: false
        });
    }

    if (scriptId) {
        appStore.navigationStore.navigateToScripts();
        appStore.navigationStore.changeSelectedScriptId(scriptId);
    }

    return true;
}
