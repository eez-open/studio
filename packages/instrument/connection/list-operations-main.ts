import { ipcMain, BrowserWindow } from "electron";
import { autorun } from "mobx";

import { roundNumber } from "eez-studio-shared/roundNumber";
import {
    activityLogStore,
    IActivityLogEntry,
    log
} from "instrument/window/history/activity-log";

import type { Connection } from "instrument/connection/connection-main";

const CONF_TIMEOUT_MS = 1000;

export abstract class ListOperation {
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
                    operation:
                        this instanceof GetListOperation ? "get" : "send",
                    listName: this.listName,
                    error
                })
            };

            this.logId = log(activityLogStore, logEntry, {
                undoable: false
            });

            let browserWindow = require("electron").BrowserWindow.fromId(
                this.callbackWindowId
            )!;
            browserWindow.webContents.send(
                "instrument/connection/list-operation-result",
                {
                    error
                }
            );
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

export class GetListOperation extends ListOperation {
    listData: any = {};

    isQuery = true;

    constructor(
        connection: Connection,
        channelIndex: number,
        callbackWindowId: number
    ) {
        super(connection, channelIndex, undefined, callbackWindowId);

        this.state = "dwell";
        this.sendQueryCommand();
        this.setTimeout();
    }

    sendQueryCommand() {
        this.connection.send(
            `SOUR${this.channelIndex + 1}:LIST:${this.state}?;*OPC?`,
            {
                log: false,
                longOperation: true
            }
        );
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

            let logId = log(activityLogStore, logEntry, {
                undoable: false
            });

            let browserWindow = require("electron").BrowserWindow.fromId(
                this.callbackWindowId
            )!;
            browserWindow.webContents.send(
                "instrument/connection/list-operation-result",
                {
                    listData: [this.listData],
                    logId
                }
            );

            if (this.dataReceived) {
                this.dataSurplus = this.dataReceived;
            }
        }
    }
}

export class SendListOperation extends ListOperation {
    isQuery = false;

    constructor(
        connection: Connection,
        channelIndex: number,
        listName: string,
        private listData: any,
        callbackWindowId: number
    ) {
        super(connection, channelIndex, listName, callbackWindowId);

        const dispose = autorun(() => {
            if (connection.instrument.extension) {
                // Good. Extension is loaded. Proceed.
                this.sendCommand();
                this.setTimeout();
                dispose();
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
            const data = array
                .map((value: number) => roundNumber(value, this.digits))
                .join(",");
            this.connection.send(
                `SOUR${this.channelIndex + 1}:LIST:${this.state} ${data};*OPC?`,
                {
                    log: false,
                    longOperation: true
                }
            );
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

        log(activityLogStore, logEntry, {
            undoable: false
        });

        let browserWindow = require("electron").BrowserWindow.fromId(
            this.callbackWindowId
        )!;
        browserWindow.webContents.send(
            "instrument/connection/list-operation-result",
            {}
        );

        if (this.dataReceived) {
            this.dataSurplus = this.dataReceived;
        }
    }
}

ipcMain.on(
    "instrument/connection/get-list",
    async function (
        event: any,
        arg: {
            instrumentId: string;
            channelIndex: number;
            listData: any;
            listName: any;
            callbackWindowId: number;
        }
    ) {
        const { connections } = await import(
            "instrument/connection/connection-main"
        );
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            getListMain(
                connection as Connection,
                arg.channelIndex,
                arg.callbackWindowId
            );
        }
    }
);

function getListMain(
    connection: Connection,
    channelIndex: number,
    callbackWindowId: number
): void {
    try {
        connection.startLongOperation(
            () =>
                new GetListOperation(connection, channelIndex, callbackWindowId)
        );
    } catch (error) {
        let browserWindow = BrowserWindow.fromId(callbackWindowId)!;
        browserWindow.webContents.send(
            "instrument/connection/list-operation-result",
            {
                error
            }
        );
    }
}

ipcMain.on(
    "instrument/connection/send-list",
    async function (
        event: any,
        arg: {
            instrumentId: string;
            channelIndex: number;
            listData: any;
            listName: any;
            callbackWindowId: number;
        }
    ) {
        const { connections } = await import(
            "instrument/connection/connection-main"
        );
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
    }
);

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
        let browserWindow = BrowserWindow.fromId(callbackWindowId)!;
        browserWindow.webContents.send(
            "instrument/connection/list-operation-result",
            {
                error
            }
        );
    }
}
