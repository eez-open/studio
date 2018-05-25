import * as React from "react";
import { observable, action, runInAction } from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "shared/ui/splitter";
import { Toolbar } from "shared/ui/toolbar";
import { IconAction, ButtonAction } from "shared/ui/action";

import { InstrumentObject } from "instrument/instrument-object";

import { appStore } from "instrument/window/app-store";
import { history, ISession } from "instrument/window/history";
import { IHistoryItem } from "instrument/window/history-item";

import { ShortcutsToolbar } from "instrument/window/terminal/toolbar";

import { executeShortcut } from "instrument/window/script";
import { ConnectionHistory } from "instrument/window/terminal/connection-history";
import { Search } from "instrument/window/terminal/search";
import { CommandsBrowser } from "instrument/window/terminal/commands-browser";
import { showFileUploadDialog } from "instrument/window/terminal/file-upload-dialog";
import { TerminalToolbarButtons } from "instrument/window/terminal/terminal-toolbar-buttons";

////////////////////////////////////////////////////////////////////////////////

const CONF_COMMANDS_HISTORY_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

export interface ITerminalState {
    command: string;
    selectedSession: ISession | undefined;
    selectSession: (session: ISession | undefined) => void;
}

class TerminalState {
    @observable _command: string = "";

    @observable selectedSession: ISession | undefined;

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

@observer
class Input extends React.Component<
    {
        instrument: InstrumentObject;
        sendCommand: () => void;
        handleSendFileClick: (() => void) | undefined;
    },
    {}
> {
    refs: {
        input: HTMLInputElement;
    };

    constructor(props: any) {
        super(props);

        const commandsHistoryJSON = window.localStorage.getItem(
            `instrument/${this.props.instrument.id}/window/terminal/commands-history`
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
        this.refs.input.focus();
    }

    componentDidUpdate() {
        if (this.moveCursorToTheEnd) {
            this.refs.input.selectionStart = this.refs.input.selectionEnd =
                terminalState.command.length;
            this.moveCursorToTheEnd = false;
        }
    }

    handleHelpClick() {
        appStore.toggleHelpVisible();
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
                `instrument/${this.props.instrument.id}/window/terminal/commands-history`,
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
                --historyItemIndex;
            }

            if (historyItemIndex < 0) {
                return undefined;
            }

            this.historyItemIndex = historyItemIndex;

            return this.commandsHistory[this.historyItemIndex];
        }
    }

    findNextCommand() {
        while (true) {
            let historyItemIndex = this.historyItemIndex;
            if (historyItemIndex === undefined) {
                historyItemIndex = 0;
            } else {
                ++historyItemIndex;
            }

            if (historyItemIndex >= this.commandsHistory.length) {
                return undefined;
            }

            this.historyItemIndex = historyItemIndex;

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
            <div className="EezStudio_Input">
                <div>
                    <IconAction
                        icon="material:help"
                        onClick={this.handleHelpClick}
                        title="Show/hide commands catalog"
                    />
                </div>
                <div>
                    <input
                        ref="input"
                        className="mousetrap"
                        type="text"
                        onKeyDown={this.handleKeyDown}
                        value={terminalState.command}
                        onChange={this.handleChange}
                        disabled={!this.props.instrument.connection.isConnected}
                    />
                </div>
                <div>
                    <IconAction
                        icon="material:play_arrow"
                        onClick={this.handleSendCommandClick}
                        enabled={this.props.instrument.connection.isConnected}
                        title="Run command"
                    />
                </div>
                {this.props.handleSendFileClick && (
                    <div>
                        <IconAction
                            icon="material:file_upload"
                            onClick={this.props.handleSendFileClick}
                            enabled={this.props.instrument.connection.isConnected}
                            title="Upload file"
                        />
                    </div>
                )}
            </div>
        );
    }
}

@observer
export class Terminal extends React.Component<{ instrument: InstrumentObject }, {}> {
    static history: ConnectionHistory | null;

    static moveToTopOfConnectionHistory() {
        if (Terminal.history) {
            Terminal.history.moveToTop();
        }
    }

    static moveToBottomOfConnectionHistory() {
        if (Terminal.history) {
            Terminal.history.moveToBottom();
        }
    }

    static selectHistoryItem(historyItem: IHistoryItem) {
        if (Terminal.history) {
            Terminal.history.selectHistoryItem(historyItem);
        }
    }

    onSelectHistoryItemsOk() {
        appStore.selectHistoryItemsSpecification!.onOk();
    }

    onSelectHistoryItemsCancel() {
        appStore.selectHistoryItems(undefined);
    }

    render() {
        let handleSendFileClick;
        if (this.props.instrument.getFileDownloadProperty()) {
            const fileUploadInstructions =
                this.props.instrument.lastFileUploadInstructions ||
                this.props.instrument.defaultFileUploadInstructions;

            if (fileUploadInstructions) {
                handleSendFileClick = () => {
                    showFileUploadDialog(fileUploadInstructions, instructions => {
                        this.props.instrument.connection.upload(instructions);
                    });
                };
            }
        }

        return (
            <Splitter
                type="vertical"
                sizes={appStore.helpVisible ? "50%|50%" : "100%"}
                persistId={
                    appStore.helpVisible ? "instrument/window/terminal/splitter1" : undefined
                }
            >
                <div className="EezStudio_Terminal">
                    <div className="EezStudio_TerminalBody">
                        <Splitter
                            type="horizontal"
                            sizes={appStore.searchVisible ? "100%|240px" : "100%"}
                            persistId={
                                appStore.searchVisible
                                    ? "instrument/window/terminal/splitter2"
                                    : undefined
                            }
                        >
                            <div className="EezStudio_History_Container" tabIndex={0}>
                                {appStore.selectHistoryItemsSpecification && (
                                    <div className="EezStudio_History_Header EezStudio_SlideInDownTransition">
                                        <div>
                                            {appStore.selectedHistoryItems.size > 0
                                                ? `${appStore.selectedHistoryItems.size} selected`
                                                : appStore.selectHistoryItemsSpecification.message}
                                        </div>
                                        <Toolbar>
                                            {appStore.selectedHistoryItems.size > 0 && (
                                                <ButtonAction
                                                    text={
                                                        appStore.selectHistoryItemsSpecification
                                                            .okButtonText
                                                    }
                                                    title={
                                                        appStore.selectHistoryItemsSpecification
                                                            .okButtonTitle
                                                    }
                                                    className={
                                                        appStore.selectHistoryItemsSpecification
                                                            .alertDanger
                                                            ? "btn-danger"
                                                            : "btn-primary"
                                                    }
                                                    onClick={this.onSelectHistoryItemsOk}
                                                />
                                            )}
                                            <ButtonAction
                                                text="Cancel"
                                                title="Cancel"
                                                className="btn-secondary"
                                                onClick={this.onSelectHistoryItemsCancel}
                                            />
                                        </Toolbar>
                                    </div>
                                )}
                                <div className="EezStudio_History_Body">
                                    <ConnectionHistory
                                        ref={ref => (Terminal.history = ref)}
                                        history={history}
                                    />
                                </div>
                            </div>
                            {appStore.searchVisible && <Search history={history} />}
                        </Splitter>
                    </div>
                    <Input
                        instrument={this.props.instrument}
                        sendCommand={() => {
                            this.props.instrument.connection.send(terminalState.command);
                            terminalState.command = "";
                        }}
                        handleSendFileClick={handleSendFileClick}
                    />
                    <ShortcutsToolbar
                        executeShortcut={shortcut => {
                            executeShortcut(this.props.instrument, shortcut);
                        }}
                    />
                </div>

                {appStore.helpVisible && <CommandsBrowser host={terminalState} />}
            </Splitter>
        );
    }
}

export function render(instrument: InstrumentObject) {
    return <Terminal instrument={instrument} />;
}

export function renderToolbarButtons(instrument: InstrumentObject) {
    return <TerminalToolbarButtons instrument={instrument} />;
}

export function moveToTopOfConnectionHistory() {
    Terminal.moveToTopOfConnectionHistory();
}

export function moveToBottomOfConnectionHistory() {
    Terminal.moveToBottomOfConnectionHistory();
}

export function selectHistoryItem(historyItem: IHistoryItem) {
    Terminal.selectHistoryItem(historyItem);
}
