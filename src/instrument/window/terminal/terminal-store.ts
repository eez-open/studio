import { observable, runInAction } from "mobx";

class TerminalStore {
    @observable _command: string = "";

    get command() {
        return this._command;
    }

    set command(command: string) {
        runInAction(() => {
            this._command = command;
        });
    }
}

export const terminalStore = new TerminalStore();
