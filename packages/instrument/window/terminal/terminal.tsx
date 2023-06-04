import React from "react";
import { observer } from "mobx-react";

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
import { terminalState } from "./terminalState";

////////////////////////////////////////////////////////////////////////////////

const CONF_COMMANDS_HISTORY_SIZE = 1000;

////////////////////////////////////////////////////////////////////////////////

const Input = observer(
    class Input extends React.Component<
        {
            appStore: InstrumentAppStore;
            sendCommand: () => void;
            sendFileToInstrumentHandler: (() => void) | undefined;
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
            this.handleSendCommandClick =
                this.handleSendCommandClick.bind(this);
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
                    terminalState.command.length;
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
                <div className="EezStudio_InputContainer">
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
                            disabled={
                                !this.props.appStore.instrument.connection
                                    .isConnected
                            }
                        />
                    </div>
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

export class TerminalComponent extends React.Component<
    { appStore: InstrumentAppStore },
    {}
> {
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

        const terminal = (
            <div className="EezStudio_TerminalBodyContainer">
                <div className="EezStudio_TerminalBody">
                    <HistoryView
                        appStore={this.props.appStore}
                        persistId={"instrument/window/history"}
                    />
                </div>
                <Input
                    appStore={appStore}
                    sendCommand={async () => {
                        try {
                            await instrument.connection.acquire(true);

                            let hasQuery = false;
                            try {
                                const parts = parseScpi(terminalState.command);
                                hasQuery = !!parts.find(
                                    part => part.tag == SCPI_PART_QUERY
                                );
                            } catch (err) {}

                            if (hasQuery) {
                                const result =
                                    await instrument.connection.query(
                                        terminalState.command
                                    );
                                console.log(result);
                            } else {
                                instrument.connection.send(
                                    terminalState.command
                                );
                            }

                            terminalState.command = "";

                            instrument.connection.release();
                        } catch (err) {
                            notification.error(err.toString());
                        }
                    }}
                    sendFileToInstrumentHandler={
                        instrument.sendFileToInstrumentHandler
                    }
                />
                <ShortcutsToolbar
                    appStore={appStore}
                    executeShortcut={shortcut => {
                        executeShortcut(this.props.appStore, shortcut);
                    }}
                />
            </div>
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
                <CommandsBrowser
                    appStore={this.props.appStore}
                    host={terminalState}
                />
            </Splitter>
        );
    }
}

export const Terminal = observer(TerminalComponent);

export function render(appStore: InstrumentAppStore) {
    return <Terminal appStore={appStore} />;
}

export function renderToolbarButtons(appStore: InstrumentAppStore) {
    return <HistoryTools appStore={appStore} />;
}
