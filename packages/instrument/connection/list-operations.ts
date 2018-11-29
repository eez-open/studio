import { autorun } from "mobx";

import { isRenderer } from "eez-studio-shared/util";
import { roundNumber } from "eez-studio-shared/roundNumber";
import { activityLogStore, IActivityLogEntry, log } from "eez-studio-shared/activity-log";

import { Connection, connections } from "instrument/connection/connection";

////////////////////////////////////////////////////////////////////////////////

const CONF_TIMEOUT_MS = 1000;

////////////////////////////////////////////////////////////////////////////////

abstract class ListOperation {
    logId: string;
    logEntry: Partial<IActivityLogEntry>;
    dataReceived: string;
    state: string;
    dataSurplus: string | undefined;
    dataTimeoutId: any;
    errorLine: string;

    constructor(
        protected connection: Connection,
        protected channelIndex: number,
        protected listName: string | undefined,
        protected callbackWindowId: number
    ) {
        this.state = "dwell";
    }

    moveToNextState() {
        if (this.state === "dwell") {
            this.state = "voltage";
        } else if (this.state === "voltage") {
            this.state = "current";
        } else {
            this.state = "";
        }
    }

    sendError(error: string) {
        if (this.state) {
            this.state = "";

            let logEntry: Partial<IActivityLogEntry> = {
                oid: this.connection.instrument.id,
                type: "instrument/list",
                message: JSON.stringify({
                    operation: this instanceof GetListOperation ? "get" : "send",
                    listName: this.listName,
                    error
                })
            };

            if (!this.connection.callbackWindowId) {
                this.logId = log(activityLogStore, logEntry, {
                    undoable: false
                });

                let browserWindow = require("electron").BrowserWindow.fromId(this.callbackWindowId);
                browserWindow.webContents.send("instrument/connection/list-operation-result", {
                    error
                });
            } else {
                this.logEntry = logEntry;
            }
        }
    }

    clearTimeout() {
        if (this.dataTimeoutId) {
            clearTimeout(this.dataTimeoutId);
            this.dataTimeoutId = undefined;
        }
    }

    setTimeout() {
        if (!this.isDone()) {
            this.clearTimeout();

            this.dataTimeoutId = setTimeout(() => {
                this.dataTimeoutId = undefined;
                if (this.errorLine) {
                    this.sendError(this.errorLine);
                } else {
                    this.sendError("timeout");
                }
            }, CONF_TIMEOUT_MS);
        }
    }

    onData(data: string): void {
        if (this.isDone()) {
            return;
        }

        this.clearTimeout();

        if (!this.dataReceived) {
            this.dataReceived = data;
        } else {
            this.dataReceived += data;
        }

        let line;
        let i = this.dataReceived.indexOf("\r");
        if (i !== -1) {
            line = this.dataReceived.substring(0, i);
            this.dataReceived = this.dataReceived.substring(i + 2);
        } else {
            i = this.dataReceived.indexOf("\n");
            if (i !== -1) {
                line = this.dataReceived.substring(0, i);
                this.dataReceived = this.dataReceived.substring(i + 1);
            }
        }

        if (!line) {
            return;
        }

        if (this.errorLine) {
            this.sendError(this.errorLine);
            return;
        }

        if (line.indexOf("**ERROR") !== -1) {
            this.errorLine = line;
        } else {
            this.onLineReceived(line);
        }

        this.setTimeout();
    }

    abstract onLineReceived(line: string): void;

    abort(): void {
        this.sendError("aborted");
    }

    isDone(): boolean {
        return this.state === "";
    }
}

////////////////////////////////////////////////////////////////////////////////

export class GetListOperation extends ListOperation {
    listData: any = {};

    constructor(connection: Connection, channelIndex: number, callbackWindowId: number) {
        super(connection, channelIndex, undefined, callbackWindowId);

        this.state = "dwell";
        this.sendQueryCommand();
        this.setTimeout();
    }

    sendQueryCommand() {
        this.connection.send(`SOUR${this.channelIndex + 1}:LIST:${this.state}?;*OPC?`, {
            log: false,
            longOperation: true
        });
    }

    onLineReceived(line: string) {
        let parts = line.split(";");

        let array: number[];

        if (parts.length === 2) {
            array = parts[0].split(",").map(x => parseFloat(x));
        } else {
            array = [];
        }

        this.listData[this.state] = array;
        this.moveToNextState();
        if (this.state) {
            this.sendQueryCommand();
        } else {
            let logEntry: Partial<IActivityLogEntry> = {
                oid: this.connection.instrument.id,
                type: "instrument/list",
                message: JSON.stringify({
                    operation: "get",
                    listData: [this.listData]
                })
            };

            if (!this.connection.callbackWindowId) {
                let logId = log(activityLogStore, logEntry, {
                    undoable: false
                });

                let browserWindow = require("electron").BrowserWindow.fromId(this.callbackWindowId);
                browserWindow.webContents.send("instrument/connection/list-operation-result", {
                    listData: [this.listData],
                    logId
                });
            } else {
                this.logEntry = logEntry;
            }

            if (this.dataReceived) {
                this.dataSurplus = this.dataReceived;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class SendListOperation extends ListOperation {
    dataReceived: string;

    constructor(
        connection: Connection,
        channelIndex: number,
        listName: string,
        private listData: any,
        callbackWindowId: number
    ) {
        super(connection, channelIndex, listName, callbackWindowId);

        autorun(() => {
            if (connection.instrument.extension) {
                // Good. Extension is loaded. Proceed.
                this.sendCommand();
                this.setTimeout();
            }
        });
    }

    get digits() {
        if (this.state === "dwell") {
            return this.connection.instrument.listsDwellDigitsProperty;
        } else if (this.state === "voltage") {
            return this.connection.instrument.listsVoltageDigitsProperty;
        } else {
            return this.connection.instrument.listsCurrentDigitsProperty;
        }
    }

    sendCommand() {
        const array = this.listData[this.state];
        if (array.length > 0) {
            const data = array.map((value: number) => roundNumber(value, this.digits)).join(",");
            this.connection.send(`SOUR${this.channelIndex + 1}:LIST:${this.state} ${data};*OPC?`, {
                log: false,
                longOperation: true
            });
            return true;
        } else {
            this.moveToNextState();
            if (this.state) {
                this.sendCommand();
            }
            return false;
        }
    }

    onLineReceived(line: string) {
        this.moveToNextState();
        if (this.state && this.sendCommand()) {
            return;
        }

        let logEntry: Partial<IActivityLogEntry> = {
            oid: this.connection.instrument.id,
            type: "instrument/list",
            message: JSON.stringify({
                operation: "send",
                listName: this.listName,
                listData: [this.listData]
            })
        };

        if (!this.connection.callbackWindowId) {
            log(activityLogStore, logEntry, {
                undoable: false
            });

            let browserWindow = require("electron").BrowserWindow.fromId(this.callbackWindowId);
            browserWindow.webContents.send("instrument/connection/list-operation-result", {});
        } else {
            this.logEntry = logEntry;
        }

        if (this.dataReceived) {
            this.dataSurplus = this.dataReceived;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

let resolveCallback: ((result: any) => void) | undefined;
let rejectCallback: ((result: any) => void) | undefined;

////////////////////////////////////////////////////////////////////////////////

export async function getList(instrumentId: string, channelIndex: number) {
    return new Promise<any>((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;

        getListRenderer(
            instrumentId,
            channelIndex,
            EEZStudio.electron.remote.getCurrentWindow().id
        );
    });
}

function getListRenderer(instrumentId: string, channelIndex: number, callbackWindowId: number) {
    EEZStudio.electron.ipcRenderer.send("instrument/connection/get-list", {
        instrumentId,
        channelIndex,
        callbackWindowId
    });
}

if (!isRenderer()) {
    const { ipcMain } = require("electron");

    ipcMain.on("instrument/connection/get-list", function(
        event: any,
        arg: {
            instrumentId: string;
            channelIndex: number;
            callbackWindowId: number;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            getListMain(connection as Connection, arg.channelIndex, arg.callbackWindowId);
        }
    });
}

function getListMain(connection: Connection, channelIndex: number, callbackWindowId: number) {
    try {
        connection.startLongOperation(
            () => new GetListOperation(connection, channelIndex, callbackWindowId)
        );
    } catch (error) {
        let browserWindow = require("electron").BrowserWindow.fromId(callbackWindowId);
        browserWindow.webContents.send("instrument/connection/list-operation-result", {
            error
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export async function sendList(
    instrumentId: string,
    channelIndex: number,
    listName: string,
    listData: any
) {
    return new Promise<any>((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;

        sendListRenderer(
            instrumentId,
            channelIndex,
            listName,
            listData,
            EEZStudio.electron.remote.getCurrentWindow().id
        );
    });
}

function sendListRenderer(
    instrumentId: string,
    channelIndex: number,
    listName: string,
    listData: any,
    callbackWindowId: number
) {
    EEZStudio.electron.ipcRenderer.send("instrument/connection/send-list", {
        instrumentId,
        channelIndex,
        listName,
        listData,
        callbackWindowId
    });
}

if (!isRenderer()) {
    const { ipcMain } = require("electron");

    ipcMain.on("instrument/connection/send-list", function(
        event: any,
        arg: {
            instrumentId: string;
            channelIndex: number;
            listData: any;
            listName: any;
            callbackWindowId: number;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            sendListMain(
                connection as Connection,
                arg.channelIndex,
                arg.listName,
                arg.listData,
                arg.callbackWindowId
            );
        }
    });
}

function sendListMain(
    connection: Connection,
    channelIndex: number,
    listName: string,
    listData: any,
    callbackWindowId: number
): void {
    try {
        connection.startLongOperation(
            () =>
                new SendListOperation(
                    connection,
                    channelIndex,
                    listName,
                    listData,
                    callbackWindowId
                )
        );
    } catch (error) {
        let browserWindow = require("electron").BrowserWindow.fromId(callbackWindowId);
        browserWindow.webContents.send("instrument/connection/list-operation-result", {
            error
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

if (isRenderer()) {
    EEZStudio.electron.ipcRenderer.on(
        "instrument/connection/list-operation-result",
        (event: any, args: any) => {
            if (args.error) {
                if (rejectCallback) {
                    rejectCallback(args.error);
                }
            } else {
                if (resolveCallback) {
                    resolveCallback(args);
                }
            }
            rejectCallback = undefined;
            resolveCallback = undefined;
        }
    );
}
