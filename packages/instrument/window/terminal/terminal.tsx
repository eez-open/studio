import React from "react";
import { observable, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
import { Splitter } from "eez-studio-ui/splitter";
import { IconAction } from "eez-studio-ui/action";

import { InstrumentAppStore } from "instrument/window/app-store";
import { executeShortcut } from "instrument/window/script";

import { ISession } from "instrument/window/history/session/store";
import { HistoryView, HistoryTools } from "instrument/window/history/history-view";

import { ShortcutsToolbar } from "instrument/window/terminal/toolbar";
import { CommandsBrowser } from "instrument/window/terminal/commands-browser";
import { showFileUploadDialog } from "instrument/window/terminal/file-upload-dialog";

////////////////////////////////////////////////////////////////////////////////

const CONF_COMMANDS_HISTORY_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

export interface ITerminalState {
    command: string;
    selectedSession: ISession | undefined;
    selectSession: (session: ISession | undefined) => void;
}

class TerminalState {
    @observable
    _command: string = "";

    @observable
    selectedSession: ISession | undefined;

    get command() {
        return this._command;
    }

    set command(command: string) {
        runInAction(() => {
            this._command = command;
        });
    }

    @action
    selectSession(selectedSession: ISession | undefined) {
        if (this.selectedSession) {
            this.selectedSession.selected = false;
        }
        this.selectedSession = selectedSession;
        if (this.selectedSession) {
            this.selectedSession.selected = true;
        }
    }
}

const terminalState = new TerminalState();

////////////////////////////////////////////////////////////////////////////////

const InputContainer = styled.div`
    background-color: ${props => props.theme.panelHeaderColor};
    padding: 10px;
    display: flex;
    flex-direction: row;
    flex-grow: 0;
    flex-shrink: 0;

    div:nth-child(1) {
        flex-shrink: 0;
    }

    div:nth-child(2) {
        flex-grow: 1;
        padding-left: 7px;

        input {
            padding-left: 5px;
            padding-right: 5px;
            width: 100%;
        }
    }

    div:nth-child(3) {
        flex-shrink: 0;
    }
`;

@observer
class Input extends React.Component<
    {
        appStore: InstrumentAppStore;
        sendCommand: () => void;
        handleSendFileClick: (() => void) | undefined;
    },
    {}
> {
    input: HTMLInputElement;

    constructor(props: any) {
        super(props);

        const commandsHistoryJSON = window.localStorage.getItem(
            `instrument/${this.props.appStore.history.oid}/window/terminal/commands-history`
        );
        if (commandsHistoryJSON) {
            try {
                this.commandsHistory = JSON.parse(commandsHistoryJSON);
            } catch (error) {
                console.error(error);
            }
        }

        this.handleHelpClick = this.handleHelpClick.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleSendCommandClick = this.handleSendCommandClick.bind(this);
    }

    commandsHistory: string[] = [];
    historyItemIndex: number | undefined;
    moveCursorToTheEnd: boolean;

    componentDidMount() {
        this.input.focus();
    }

    componentDidUpdate() {
        if (this.moveCursorToTheEnd) {
            this.input.selectionStart = this.input.selectionEnd = terminalState.command.length;
            this.moveCursorToTheEnd = false;
        }
    }

    handleHelpClick() {
        this.props.appStore.toggleHelpVisible();
    }

    handleChange(event: any) {
        terminalState.command = event.target.value;
    }

    sendCommand() {
        if (terminalState.command) {
            this.commandsHistory.push(terminalState.command);
            if (this.commandsHistory.length > CONF_COMMANDS_HISTORY_SIZE) {
                this.commandsHistory.splice(0, 1);
            }
            window.localStorage.setItem(
                `instrument/${this.props.appStore.history.oid}/window/terminal/commands-history`,
                JSON.stringify(this.commandsHistory)
            );

            this.historyItemIndex = undefined;

            this.props.sendCommand();
        }
    }

    findPreviousCommand() {
        while (true) {
            let historyItemIndex = this.historyItemIndex;
            if (historyItemIndex === undefined) {
                historyItemIndex = this.commandsHistory.length - 1;
            } else {
                if (historyItemIndex >= 0) {
                    historyItemIndex--;
                }
            }

            this.historyItemIndex = historyItemIndex;

            if (this.historyItemIndex < 0 || this.historyItemIndex >= this.commandsHistory.length) {
                return undefined;
            }

            return this.commandsHistory[this.historyItemIndex];
        }
    }

    findNextCommand() {
        while (true) {
            let historyItemIndex = this.historyItemIndex;
            if (historyItemIndex === undefined) {
                return undefined;
            } else {
                if (historyItemIndex < this.commandsHistory.length) {
                    historyItemIndex++;
                }
            }

            this.historyItemIndex = historyItemIndex;

            if (this.historyItemIndex < 0 || this.historyItemIndex >= this.commandsHistory.length) {
                return undefined;
            }

            return this.commandsHistory[this.historyItemIndex];
        }
    }

    handleKeyDown(event: any) {
        if (event.key === "Enter") {
            event.preventDefault();
            this.sendCommand();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            terminalState.command = this.findPreviousCommand() || "";
            this.moveCursorToTheEnd = true;
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            terminalState.command = this.findNextCommand() || "";
            this.moveCursorToTheEnd = true;
        }
    }

    handleSendCommandClick() {
        this.sendCommand();
    }

    render() {
        return (
            <InputContainer>
                <div>
                    <IconAction
                        icon="material:help"
                        onClick={this.handleHelpClick}
                        title="Show/hide commands catalog"
                    />
                </div>
                <div>
                    <input
                        ref={(ref: any) => (this.input = ref)}
                        className="mousetrap"
                        type="text"
                        onKeyDown={this.handleKeyDown}
                        value={terminalState.command}
                        onChange={this.handleChange}
                        disabled={!this.props.appStore.instrument!.connection.isConnected}
                    />
                </div>
                <div>
                    <IconAction
                        icon="material:play_arrow"
                        onClick={this.handleSendCommandClick}
                        enabled={this.props.appStore.instrument!.connection.isConnected}
                        title="Run command"
                    />
                </div>
                {this.props.handleSendFileClick && (
                    <div>
                        <IconAction
                            icon="material:file_upload"
                            onClick={this.props.handleSendFileClick}
                            enabled={this.props.appStore.instrument!.connection.isConnected}
                            title="Upload file"
                        />
                    </div>
                )}
            </InputContainer>
        );
    }
}

const TerminalBodyContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const TerminalBody = styled.div`
    border-bottom: 1px solid ${props => props.theme.borderColor};
    flex-grow: 1;
    overflow: auto;
    position: relative;
    display: flex;
    flex-direction: column;
`;

@observer
export class Terminal extends React.Component<{ appStore: InstrumentAppStore }, {}> {
    @bind
    onSelectHistoryItemsCancel() {
        this.props.appStore.selectHistoryItems(undefined);
    }

    componentDidMount() {
        this.props.appStore.terminal = this;
    }

    componentWillUnmount() {
        this.props.appStore.terminal = null;
    }

    render() {
        const { appStore } = this.props;
        const instrument = appStore.instrument!;

        let handleSendFileClick;
        if (this.props.appStore.instrument!.getFileDownloadProperty()) {
            const fileUploadInstructions =
                instrument.lastFileUploadInstructions || instrument.defaultFileUploadInstructions;

            if (fileUploadInstructions) {
                handleSendFileClick = () => {
                    showFileUploadDialog(fileUploadInstructions, instructions => {
                        instrument.connection.upload(instructions);
                    });
                };
            }
        }

        const terminal = (
            <TerminalBodyContainer>
                <TerminalBody>
                    <HistoryView
                        appStore={this.props.appStore}
                        persistId={"instrument/window/history"}
                    />
                </TerminalBody>
                <Input
                    appStore={appStore}
                    sendCommand={() => {
                        instrument.connection.send(terminalState.command);
                        terminalState.command = "";
                    }}
                    handleSendFileClick={handleSendFileClick}
                />
                <ShortcutsToolbar
                    appStore={appStore}
                    executeShortcut={shortcut => {
                        executeShortcut(this.props.appStore, shortcut);
                    }}
                />
            </TerminalBodyContainer>
        );

        if (!appStore.helpVisible) {
            return terminal;
        }

        return (
            <Splitter
                type="vertical"
                sizes={"50%|50%"}
                persistId={"instrument/window/terminal/splitter"}
            >
                {terminal}
                <CommandsBrowser appStore={this.props.appStore} host={terminalState} />
            </Splitter>
        );
    }
}

export function render(appStore: InstrumentAppStore) {
    return <Terminal appStore={appStore} />;
}

export function renderToolbarButtons(appStore: InstrumentAppStore) {
    return <HistoryTools appStore={appStore} />;
}
