import {
    observable,
    action,
    runInAction,
    makeObservable,
    reaction
} from "mobx";

import type { ISession } from "instrument/window/history/session/store";

export interface ITerminalState {
    searchText: string;
    linkCommandInputWithDocumentationBrowser: boolean;
}

class TerminalState implements ITerminalState {
    _command: string = "";
    selectedSession: ISession | undefined;

    _linkCommandInputWithDocumentationBrowser: boolean;
    searchText: string;

    constructor() {
        this._linkCommandInputWithDocumentationBrowser = !(
            localStorage.getItem("linkCommandInputWithDocumentationBrowser") ===
                "false" || false
        );

        makeObservable(this, {
            _command: observable,
            selectedSession: observable,
            _linkCommandInputWithDocumentationBrowser: observable,
            searchText: observable,
            selectSession: action
        });

        reaction(
            () => this._linkCommandInputWithDocumentationBrowser,
            value => {
                localStorage.setItem(
                    "linkCommandInputWithDocumentationBrowser",
                    value ? "true" : "false"
                );
            }
        );
    }

    get command() {
        return this._command;
    }

    set command(command: string) {
        runInAction(() => {
            this._command = command;

            if (this.linkCommandInputWithDocumentationBrowser) {
                this.searchText = command.split(" ")[0];
            }
        });
    }

    get linkCommandInputWithDocumentationBrowser() {
        return this._linkCommandInputWithDocumentationBrowser;
    }

    set linkCommandInputWithDocumentationBrowser(value: boolean) {
        this._linkCommandInputWithDocumentationBrowser = value;
        if (this.linkCommandInputWithDocumentationBrowser) {
            this.searchText = this.command.split(" ")[0];
        }
    }

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

export const terminalState = new TerminalState();
