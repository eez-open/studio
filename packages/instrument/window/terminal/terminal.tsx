import React from "react";
import { observer } from "mobx-react";
import { action, makeObservable, observable } from "mobx";

import { Splitter } from "eez-studio-ui/splitter";
import { IconAction } from "eez-studio-ui/action";
import * as notification from "eez-studio-ui/notification";

import type { InstrumentAppStore } from "instrument/window/app-store";
import { executeShortcut } from "instrument/window/script";

import {
    HistoryView,
    HistoryTools
} from "instrument/window/history/history-view";

import { ShortcutsToolbar } from "instrument/window/terminal/toolbar";
import { CommandsBrowser } from "instrument/window/terminal/commands-browser";
import { parseScpi, SCPI_PART_QUERY } from "eez-studio-shared/scpi-parser";
import { AppBar } from "instrument/window/app";
import { TerminalState } from "instrument/window/terminal/terminalState";

////////////////////////////////////////////////////////////////////////////////

const CONF_COMMANDS_HISTORY_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

const Input = observer(
    class Input extends React.Component<{
        appStore: InstrumentAppStore;
        sendCommand: () => void;
        sendFileToInstrumentHandler: (() => void) | undefined;
        showDocumentation: boolean;
        terminalState: TerminalState;
    }> {
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
        }

        commandsHistory: string[] = [];
        historyItemIndex: number | undefined;
        moveCursorToTheEnd: boolean;

        componentDidMount() {
            this.input.focus();
        }

        componentDidUpdate() {
            if (this.moveCursorToTheEnd) {
                this.input.selectionStart = this.input.selectionEnd =
                    this.props.terminalState.command.length;
                this.moveCursorToTheEnd = false;
            }
        }

        handleHelpClick = () => {
            this.props.appStore.toggleHelpVisible();
        };

        handleChange = (event: any) => {
            this.props.terminalState.command = event.target.value;
        };

        sendCommand() {
            if (this.props.terminalState.command) {
                this.commandsHistory.push(this.props.terminalState.command);
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

                if (
                    this.historyItemIndex < 0 ||
                    this.historyItemIndex >= this.commandsHistory.length
                ) {
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

                if (
                    this.historyItemIndex < 0 ||
                    this.historyItemIndex >= this.commandsHistory.length
                ) {
                    return undefined;
                }

                return this.commandsHistory[this.historyItemIndex];
            }
        }

        handleKeyDown = (event: any) => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.sendCommand();
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                this.props.terminalState.command =
                    this.findPreviousCommand() || "";
                this.moveCursorToTheEnd = true;
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                this.props.terminalState.command = this.findNextCommand() || "";
                this.moveCursorToTheEnd = true;
            }
        };

        handleSendCommandClick = () => {
            this.sendCommand();
        };

        render() {
            return (
                <div className="EezStudio_InputContainer">
                    <div>
                        {this.props.showDocumentation && (
                            <IconAction
                                icon="material:help"
                                onClick={this.handleHelpClick}
                                title="Show/hide commands catalog"
                            />
                        )}
                    </div>
                    <div>
                        <input
                            ref={(ref: any) => (this.input = ref)}
                            className="mousetrap form-control"
                            type="text"
                            onKeyDown={this.handleKeyDown}
                            value={this.props.terminalState.command}
                            onChange={this.handleChange}
                            disabled={
                                !this.props.appStore.instrument.connection
                                    .isConnected
                            }
                        />
                    </div>
                    {this.props.appStore.instrument.commandsProtocol !=
                        "SCPI" && (
                        <div style={{ paddingLeft: 8 }}>
                            <select
                                className="form-select form-control-sm"
                                value={
                                    this.props.appStore.instrument
                                        .commandLineEnding
                                }
                                onChange={(
                                    event: React.ChangeEvent<HTMLSelectElement>
                                ) => {
                                    this.props.appStore.instrument.setCommandLineEnding(
                                        event.currentTarget.value as any
                                    );
                                }}
                            >
                                <option value="no-line-ending">
                                    No line ending
                                </option>
                                <option value="newline">Newline</option>
                                <option value="carriage-return">
                                    Carriage return
                                </option>
                                <option value="both-nl-and-cr">
                                    Both NL &amp; CR
                                </option>
                            </select>
                        </div>
                    )}
                    <div>
                        <IconAction
                            icon="material:play_arrow"
                            onClick={this.handleSendCommandClick}
                            enabled={
                                this.props.appStore.instrument.connection
                                    .isConnected
                            }
                            title="Run command"
                        />
                    </div>
                </div>
            );
        }
    }
);

export class TerminalComponent extends React.Component<{
    appStore: InstrumentAppStore;
    showConnectionStatusBar: boolean;
    showShortcuts: boolean;
    showHelp: boolean;
    showSideBar: boolean;
}> {
    inFocus: boolean = false;

    terminalState: TerminalState;

    constructor(props: any) {
        super(props);

        makeObservable(this, {
            inFocus: observable
        });

        this.terminalState = new TerminalState(this.props.appStore.instrument);
    }

    onSelectHistoryItemsCancel = () => {
        this.props.appStore.selectHistoryItems(undefined);
    };

    componentDidMount() {
        this.props.appStore.terminal = this;
    }

    componentWillUnmount() {
        this.props.appStore.terminal = null;
    }

    render() {
        const { appStore } = this.props;
        const instrument = appStore.instrument;

        const input = (
            <Input
                appStore={appStore}
                sendCommand={async () => {
                    try {
                        await instrument.connection.acquire(true);

                        let hasQuery = false;
                        try {
                            const parts = parseScpi(this.terminalState.command);
                            hasQuery = !!parts.find(
                                part => part.tag == SCPI_PART_QUERY
                            );
                        } catch (err) {}

                        const command = this.terminalState.command;
                        this.terminalState.command = "";

                        if (hasQuery) {
                            await instrument.connection.query(command);
                        } else {
                            await instrument.connection.send(command);
                        }
                    } catch (err) {
                        notification.error(err.toString());
                    } finally {
                        instrument.connection.release();
                    }
                }}
                sendFileToInstrumentHandler={
                    instrument.sendFileToInstrumentHandler
                }
                showDocumentation={this.props.showHelp}
                terminalState={this.terminalState}
            />
        );

        let history = (
            <div className="EezStudio_TerminalBody">
                <HistoryView
                    appStore={this.props.appStore}
                    persistId={"instrument/window/history"}
                    showSideBar={this.props.showSideBar}
                />
            </div>
        );

        const terminal = (
            <div
                className="EezStudio_TerminalBodyContainer"
                onFocus={action(() => {
                    this.inFocus = true;
                })}
                onBlur={action(() => {
                    this.inFocus = false;
                })}
            >
                {this.props.showConnectionStatusBar && (
                    <AppBar appStore={appStore} selectedItem={undefined} />
                )}

                {history}

                {input}

                {this.props.showShortcuts && (
                    <ShortcutsToolbar
                        appStore={appStore}
                        executeShortcut={shortcut => {
                            executeShortcut(this.props.appStore, shortcut);
                        }}
                    />
                )}
            </div>
        );

        if (!this.props.showHelp || !appStore.helpVisible) {
            return terminal;
        }

        return (
            <Splitter
                type="vertical"
                sizes={"50%|50%"}
                persistId={"instrument/window/terminal/splitter"}
            >
                {terminal}
                <CommandsBrowser
                    appStore={this.props.appStore}
                    host={this.terminalState}
                    terminalState={this.terminalState}
                />
            </Splitter>
        );
    }
}

export const Terminal = observer(TerminalComponent);

export function render(appStore: InstrumentAppStore) {
    return (
        <Terminal
            appStore={appStore}
            showConnectionStatusBar={false}
            showShortcuts={true}
            showHelp={true}
            showSideBar={true}
        />
    );
}

export function renderToolbarButtons(appStore: InstrumentAppStore) {
    return <HistoryTools appStore={appStore} />;
}
