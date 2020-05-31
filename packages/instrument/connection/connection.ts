import { observable, computed, action, autorun, toJS } from "mobx";
import { bind } from "bind-decorator";

import { IActivityLogEntry, activityLogStore, log } from "eez-studio-shared/activity-log";
import { registerSource, unregisterSource, sendMessage, watch } from "eez-studio-shared/notify";
import { isRenderer } from "eez-studio-shared/util-electron";

import { InstrumentObject } from "instrument/instrument-object";
import { EthernetInterface } from "instrument/connection/interfaces/ethernet";
import { SerialInterface } from "instrument/connection/interfaces/serial";
import { UsbTmcInterface } from "instrument/connection/interfaces/usbtmc";
import {
    CommunicationInterface,
    CommunicationInterfaceHost,
    ConnectionErrorCode,
    ConnectionParameters
} from "instrument/connection/interface";
import { FileDownload } from "instrument/connection/file-download";
import { IFileUploadInstructions, FileUpload } from "instrument/connection/file-upload";
import { parseScpiValue, ResponseType } from "instrument/scpi";

////////////////////////////////////////////////////////////////////////////////

const CONF_HOUSEKEEPING_INTERVAL = 100;
const CONF_IDN_EXPECTED_TIMEOUT = 1000;
const CONF_COMBINE_IF_BELOW_MS = 250;
const CONF_START_LONG_OPERATION_TIMEOUT = 5000;

////////////////////////////////////////////////////////////////////////////////

export enum ConnectionState {
    IDLE,
    CONNECTING,
    TESTING,
    CONNECTED,
    DISCONNECTING
}

export interface ConnectionStatus {
    state: ConnectionState;
    errorCode: ConnectionErrorCode;
    error: string | undefined;
}

interface ISendOptions {
    log?: boolean;
    longOperation?: boolean;
    queryResponseType?: ResponseType;
}

abstract class ConnectionBase {
    constructor(public instrument: InstrumentObject) {}

    abstract get state(): ConnectionState;
    abstract get errorCode(): ConnectionErrorCode;
    abstract get error(): string | undefined;

    abstract dismissError(): void;

    @computed
    get isIdle() {
        return this.state === ConnectionState.IDLE;
    }

    @computed
    get isTransitionState() {
        return (
            this.state === ConnectionState.CONNECTING ||
            this.state === ConnectionState.TESTING ||
            this.state === ConnectionState.DISCONNECTING
        );
    }

    @computed
    get isConnected() {
        return this.state === ConnectionState.CONNECTED;
    }

    abstract connect(connectionParameters?: ConnectionParameters): void;
    abstract disconnect(): void;
    abstract destroy(): void;
    abstract send(command: string, options?: ISendOptions): void;
    abstract upload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ): void;
    abstract abortLongOperation(): void;

    abstract acquire(callbackWindowId: number, traceEnabled: boolean): string | null;
    abstract release(): void;
}

export type IConnection = ConnectionBase;

export interface LongOperation {
    logId: string;
    logEntry: Partial<IActivityLogEntry>;
    abort(): void;
    onData(data: string): void;
    isDone(): boolean;
    dataSurplus: string | undefined;
    isQuery: boolean;
}

export class Connection extends ConnectionBase implements CommunicationInterfaceHost {
    @observable _state: ConnectionState = ConnectionState.IDLE;
    get state() {
        return this._state;
    }
    set state(state: ConnectionState) {
        action(() => {
            this._state = state;
        })();
    }

    @observable _errorCode: ConnectionErrorCode = ConnectionErrorCode.NONE;
    get errorCode() {
        return this._errorCode;
    }
    set errorCode(errorCode: ConnectionErrorCode) {
        action(() => {
            this._errorCode = errorCode;
        })();
    }

    @observable _error: string | undefined;
    get error() {
        return this._error;
    }
    set error(error: string | undefined) {
        action(() => {
            this._error = error;
        })();
    }

    dismissError() {
        this.error = undefined;
    }

    setError(errorCode: ConnectionErrorCode, error: string | undefined) {
        this.errorCode = errorCode;
        this.error = error;
    }

    communicationInterface: CommunicationInterface | undefined;
    disposer: any;
    notifySource: any;
    private wasConnected = false;
    connectedStartTime: number;
    data: string | undefined;
    idnExpected: boolean;
    idnExpectedTimeout: any;
    dataTimeoutId: any;
    longOperation: LongOperation | undefined;
    connectionParameters: ConnectionParameters;
    housekeepingIntervalId: any;
    callbackWindowId: number | undefined;
    traceEnabled: boolean = true;
    expectedResponseType: ResponseType | undefined;

    constructor(public instrument: InstrumentObject) {
        super(instrument);

        this.notifySource = {
            id: "instrument/" + this.instrument.id + "/connection",
            onNewTarget: (targetId: string, filterSpecification: any, inProcessTarget: boolean) => {
                this.sendConnectionStatusMessage(targetId);
            }
        };
        registerSource(this.notifySource);

        this.disposer = autorun(() => {
            this.sendConnectionStatusMessage();
        });

        if (instrument.lastConnection && instrument.autoConnect) {
            this.connect();
        }
    }

    destroy() {
        this.disconnect();
        this.disposer();
        unregisterSource(this.notifySource);
    }

    sendConnectionStatusMessage(targetId?: string) {
        let connectionStatus: ConnectionStatus = {
            state: this.state,
            errorCode: this.errorCode,
            error: this.error
        };
        sendMessage(this.notifySource, connectionStatus, targetId);
    }

    connect() {
        if (this.state !== ConnectionState.IDLE) {
            console.error("invalid state (connect)");
            return;
        }

        this.state = ConnectionState.CONNECTING;
        this.errorCode = ConnectionErrorCode.NONE;
        this.error = undefined;

        this.connectionParameters = this.instrument.lastConnection as ConnectionParameters;

        if (this.connectionParameters.type === "ethernet") {
            this.communicationInterface = new EthernetInterface(this);
        } else if (this.connectionParameters.type === "serial") {
            this.communicationInterface = new SerialInterface(this);
        } else {
            this.communicationInterface = new UsbTmcInterface(this);
        }

        this.communicationInterface!.connect();
    }

    connected() {
        this.state = ConnectionState.TESTING;

        log(
            activityLogStore,
            {
                oid: this.instrument.id,
                type: "instrument/connected",
                message: JSON.stringify({
                    connectionParameters: toJS(this.connectionParameters)
                })
            },
            {
                undoable: false
            }
        );

        this.wasConnected = true;
        this.connectedStartTime = new Date().getTime();

        this.sendIdn();

        this.housekeepingIntervalId = setInterval(this.housekeeping, CONF_HOUSEKEEPING_INTERVAL);
    }

    logRequest(data: string) {
        if (this.traceEnabled) {
            log(
                activityLogStore,
                {
                    oid: this.instrument.id,
                    type: "instrument/request",
                    message: data
                },
                {
                    undoable: false
                }
            );
        }
    }

    logAnswer(data: string) {
        if (this.traceEnabled && data.trim().length > 0) {
            log(
                activityLogStore,
                {
                    oid: this.instrument.id,
                    type: "instrument/answer",
                    message: data
                },
                {
                    undoable: false
                }
            );
        }
    }

    sendValue(value: any) {
        if (this.callbackWindowId) {
            let browserWindow = require("electron").BrowserWindow.fromId(this.callbackWindowId);
            browserWindow.webContents.send("instrument/connection/value", value);
        }
    }

    longOperationDone() {
        if (this.longOperation) {
            if (this.longOperation.isQuery) {
                this.sendValue({ logEntry: this.longOperation.logEntry });
            }
            this.longOperation = undefined;
        }
    }

    onDataLineReceived(data: string) {
        this.logAnswer(data);

        data = data.trim();
        if (data) {
            const value = parseScpiValue(data);

            this.sendValue(value);

            if (this.idnExpected) {
                clearTimeout(this.idnExpectedTimeout);
                this.idnExpectedTimeout = undefined;
                this.idnExpected = false;

                if (typeof value !== "string") {
                    this.setError(ConnectionErrorCode.NONE, "Invalid IDN value.");
                    this.disconnect();
                } else {
                    this.instrument.setIdn(value);

                    this.state = ConnectionState.CONNECTED;
                }
            }
        }
    }

    flushData() {
        if (this.longOperation) {
            this.longOperation.abort();
            this.longOperation = undefined;
        }

        if (this.dataTimeoutId) {
            clearTimeout(this.dataTimeoutId);
            this.dataTimeoutId = undefined;
        }

        if (this.data) {
            this.logAnswer(this.data);
            this.data = undefined;
        }
    }

    @bind
    housekeeping() {
        if (this.longOperation && this.longOperation.isDone()) {
            let dataSurplus = this.longOperation.dataSurplus;
            this.longOperationDone();
            this.data = dataSurplus;
        }

        if (!(this.communicationInterface && this.communicationInterface.isConnected())) {
            this.disconnect();
        }
    }

    onData(data: string) {
        if (this.dataTimeoutId) {
            clearTimeout(this.dataTimeoutId);
        }

        if (this.longOperation) {
            this.longOperation.onData(data);
        } else if (
            this.data === undefined &&
            (data.startsWith("#") || this.expectedResponseType === "non-standard-data-block")
        ) {
            this.longOperation = new FileDownload(
                this,
                data,
                this.expectedResponseType === "non-standard-data-block"
            );
        }

        this.expectedResponseType = undefined;

        if (this.longOperation) {
            if (!this.longOperation.isDone()) {
                return;
            }
            let dataSurplus = this.longOperation.dataSurplus;
            this.longOperationDone();
            if (dataSurplus === undefined) {
                return;
            }
            data = dataSurplus;
        }

        if (this.data === undefined) {
            this.data = data;
        } else {
            this.data += data;
        }

        let index = this.data.indexOf("\n");
        if (index !== -1) {
            index++;
            let data = this.data.substr(0, index);
            if (index < this.data.length) {
                this.data = this.data.substr(index);
            } else {
                this.data = undefined;
            }

            this.onDataLineReceived(data);
        }

        if (this.data !== undefined) {
            this.dataTimeoutId = setTimeout(() => {
                this.flushData();
            }, CONF_COMBINE_IF_BELOW_MS);
        }
    }

    send(command: string, options?: ISendOptions): void {
        const doSend = () => {
            if (!options || !options.longOperation) {
                if (this.longOperation) {
                    if (
                        this.longOperation instanceof FileDownload ||
                        this.longOperation instanceof FileUpload
                    ) {
                        return "**ERROR: file transfer in progress\n";
                    } else {
                        return "**ERROR: another operation in progress\n";
                    }
                }
            }

            if (!options || options.log === undefined || options.log) {
                this.logRequest(command);
            }

            if (
                (this.state !== ConnectionState.TESTING &&
                    this.state !== ConnectionState.CONNECTED) ||
                !this.communicationInterface
            ) {
                this.logAnswer("**ERROR: not connected\n");
                return null;
            }

            this.expectedResponseType = options && options.queryResponseType;

            this.errorCode = ConnectionErrorCode.NONE;
            this.error = undefined;

            this.communicationInterface.write(command + "\n");
            return null;
        };

        const startTime = new Date().getTime();

        const callDoSendUntilTimeout = () => {
            const err = doSend();
            if (err) {
                const currentTime = new Date().getTime();
                if (currentTime - startTime > CONF_START_LONG_OPERATION_TIMEOUT) {
                    throw err;
                } else {
                    setTimeout(callDoSendUntilTimeout, 0);
                }
            }
        };

        callDoSendUntilTimeout();
    }

    sendIdn() {
        if (this.state !== ConnectionState.TESTING && this.state !== ConnectionState.CONNECTED) {
            console.error(
                "invalid state (this.state !== ConnectionState.TESTING && this.state !== ConnectionState.CONNECTED)"
            );
            return;
        }

        if (!this.communicationInterface) {
            console.error("invalid state (!this.connectionInterfaceImplementation)");
            return;
        }

        this.send("*IDN?");
        this.flushData();
        this.idnExpected = true;
        this.idnExpectedTimeout = setTimeout(() => {
            this.setError(ConnectionErrorCode.NONE, "Timeout (no response to IDN query).");
            this.disconnect();
        }, CONF_IDN_EXPECTED_TIMEOUT);
    }

    startLongOperation(createLongOperation: () => LongOperation) {
        const startTime = new Date().getTime();

        const doStartLongOperation = (createLongOperation: () => LongOperation) => {
            if (this.state !== ConnectionState.CONNECTED || !this.communicationInterface) {
                return "not connected";
            }

            if (this.longOperation) {
                if (
                    this.longOperation instanceof FileDownload ||
                    this.longOperation instanceof FileUpload
                ) {
                    return "file transfer in progress";
                } else {
                    return "another operation in progress";
                }
            }

            this.longOperation = createLongOperation();
            return null;
        };

        const callDoStartLongOperationUntilTimeout = () => {
            const err = doStartLongOperation(createLongOperation);
            if (err) {
                const currentTime = new Date().getTime();
                if (currentTime - startTime > CONF_START_LONG_OPERATION_TIMEOUT) {
                    throw err;
                } else {
                    setTimeout(callDoStartLongOperationUntilTimeout, 0);
                }
            }
        };

        callDoStartLongOperationUntilTimeout();
    }

    upload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ) {
        try {
            this.startLongOperation(() => new FileUpload(this, instructions, onSuccess, onError));
        } catch (err) {
            this.logAnswer(`**ERROR: ${err}\n`);
        }
    }

    abortLongOperation() {
        if (this.longOperation) {
            this.longOperation.abort();
        }
    }

    disconnect() {
        if (this.state === ConnectionState.IDLE || !this.communicationInterface) {
            console.error("invalid state (disconnect)");
            return;
        }

        this.state = ConnectionState.DISCONNECTING;
        this.communicationInterface.disconnect();

        if (this.callbackWindowId) {
            let browserWindow = require("electron").BrowserWindow.fromId(this.callbackWindowId);
            browserWindow.webContents.send("instrument/connection/value", {
                error: "connection is diconnected"
            });
        }
    }

    disconnected() {
        this.communicationInterface = undefined;
        this.state = ConnectionState.IDLE;

        if (this.wasConnected) {
            this.flushData();

            let duration = new Date().getTime() - this.connectedStartTime;

            log(
                activityLogStore,
                {
                    oid: this.instrument.id,
                    type: "instrument/disconnected",
                    message: JSON.stringify({
                        duration,
                        error: this.error
                    })
                },
                {
                    undoable: false
                }
            );
            this.wasConnected = false;
        } else {
            log(
                activityLogStore,
                {
                    oid: this.instrument.id,
                    type: "instrument/connect-failed",
                    message: JSON.stringify({
                        connectionParameters: toJS(this.connectionParameters),
                        error: this.error
                    })
                },
                {
                    undoable: false
                }
            );
        }

        if (this.housekeepingIntervalId) {
            clearInterval(this.housekeepingIntervalId);
            this.housekeepingIntervalId = undefined;
        }
    }

    acquire(callbackWindowId: number, traceEnabled: true) {
        if (!this.isConnected) {
            return "not connected";
        }
        if (this.callbackWindowId) {
            return "connection resource is not available";
        }
        this.callbackWindowId = callbackWindowId;
        this.traceEnabled = traceEnabled;
        return null;
    }

    release() {
        this.callbackWindowId = undefined;
        this.traceEnabled = true;
    }
}

export class IpcConnection extends ConnectionBase {
    @observable state: ConnectionState = ConnectionState.IDLE;
    @observable errorCode: ConnectionErrorCode = ConnectionErrorCode.NONE;
    @observable error: string | undefined;

    onSuccess?: () => void;
    onError?: (error: any) => void;

    constructor(instrument: InstrumentObject) {
        super(instrument);

        watch(
            "instrument/" + instrument.id + "/connection",
            undefined,
            action((connectionStatus: ConnectionStatus) => {
                this.state = connectionStatus.state;
                this.errorCode = connectionStatus.errorCode;
                this.error = connectionStatus.error;
            })
        );

        EEZStudio.electron.ipcRenderer.on(
            "instrument/connection/long-operation-result",
            (event: any, args: any) => {
                if (args.error) {
                    if (this.onError) {
                        this.onError(args.error);
                    }
                } else {
                    if (this.onSuccess) {
                        this.onSuccess();
                    }
                }
                this.onError = undefined;
                this.onSuccess = undefined;
            }
        );
    }

    dismissError() {
        EEZStudio.electron.ipcRenderer.send("instrument/connection/dismiss-error", {
            instrumentId: this.instrument.id
        });
    }

    connect(connectionParameters?: ConnectionParameters) {
        EEZStudio.electron.ipcRenderer.send("instrument/connection/connect", {
            instrumentId: this.instrument.id,
            connectionParameters
        });
    }

    disconnect() {
        EEZStudio.electron.ipcRenderer.send("instrument/connection/disconnect", {
            instrumentId: this.instrument.id
        });
    }

    destroy() {
        EEZStudio.electron.ipcRenderer.send("instrument/connection/destroy", {
            instrumentId: this.instrument.id
        });
    }

    send(command: string) {
        let options: ISendOptions | undefined;

        // find out command name, i.e. up to parameters section which start with space
        let commandName;
        let i = command.indexOf(" ");
        if (i !== -1) {
            commandName = command.substr(0, i);
        } else {
            // no parameters
            commandName = command;
        }
        if (commandName.endsWith("?")) {
            // get expected query response
            options = {
                queryResponseType: this.instrument.getQueryResponseType(commandName)
            };
        }

        EEZStudio.electron.ipcRenderer.send("instrument/connection/send", {
            instrumentId: this.instrument.id,
            command,
            options
        });
    }

    upload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ) {
        this.onSuccess = onSuccess;
        this.onError = onError;

        EEZStudio.electron.ipcRenderer.send("instrument/connection/upload", {
            instrumentId: this.instrument.id,
            instructions,
            callbackWindowId: EEZStudio.electron.remote.getCurrentWindow().id
        });
    }

    async isLongOperationInProgress() {
        EEZStudio.electron.ipcRenderer.send("instrument/connection/abort-long-operation", {
            instrumentId: this.instrument.id
        });
    }

    abortLongOperation() {
        EEZStudio.electron.ipcRenderer.send("instrument/connection/abort-long-operation", {
            instrumentId: this.instrument.id
        });
    }

    acquire(callbackWindowId: number, traceEnabled: boolean) {
        return EEZStudio.electron.ipcRenderer.sendSync("instrument/connection/acquire", {
            instrumentId: this.instrument.id,
            callbackWindowId,
            traceEnabled
        });
    }

    release() {
        EEZStudio.electron.ipcRenderer.sendSync("instrument/connection/release", {
            instrumentId: this.instrument.id
        });
    }
}

export function setupIpcServer() {
    const { ipcMain } = require("electron");

    ipcMain.on("instrument/connection/connect", function (
        event: any,
        arg: {
            instrumentId: string;
            connectionParameters: any;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            if (arg.connectionParameters) {
                connection.instrument.setConnectionParameters(arg.connectionParameters);
            }
            connection.connect();
        }
    });

    ipcMain.on("instrument/connection/disconnect", function (
        event: any,
        arg: {
            instrumentId: string;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.disconnect();
        }
    });

    ipcMain.on("instrument/connection/destroy", function (
        event: any,
        arg: {
            instrumentId: string;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.destroy();
        }
    });

    ipcMain.on("instrument/connection/send", function (
        event: any,
        arg: {
            instrumentId: string;
            command: string;
            options?: ISendOptions;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.send(arg.command, arg.options);
        }
    });

    ipcMain.on("instrument/connection/upload", function (
        event: any,
        arg: {
            instrumentId: string;
            instructions: IFileUploadInstructions;
            callbackWindowId: number;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.instrument.setLastFileUploadInstructions(arg.instructions);

            connection.upload(
                arg.instructions,
                () => {
                    let browserWindow = require("electron").BrowserWindow.fromId(
                        arg.callbackWindowId
                    );
                    browserWindow.webContents.send(
                        "instrument/connection/long-operation-result",
                        {}
                    );
                },
                error => {
                    let browserWindow = require("electron").BrowserWindow.fromId(
                        arg.callbackWindowId
                    );
                    browserWindow.webContents.send("instrument/connection/long-operation-result", {
                        error
                    });
                }
            );
        }
    });

    ipcMain.on("instrument/connection/abort-long-operation", function (
        event: any,
        arg: {
            instrumentId: string;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.abortLongOperation();
        }
    });

    ipcMain.on("instrument/connection/dismiss-error", function (
        event: any,
        arg: {
            instrumentId: string;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.dismissError();
        }
    });

    ipcMain.on("instrument/connection/acquire", function (
        event: any,
        arg: {
            instrumentId: string;
            callbackWindowId: number;
            traceEnabled: boolean;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            event.returnValue = connection.acquire(arg.callbackWindowId, arg.traceEnabled);
        } else {
            event.returnValue = false;
        }
    });

    ipcMain.on("instrument/connection/release", function (
        event: any,
        arg: {
            instrumentId: string;
        }
    ) {
        let connection = connections.get(arg.instrumentId);
        if (connection) {
            connection.release();
        }
        event.returnValue = true;
    });
}

export const connections = observable(new Map<string, IConnection>());

export function createConnection(instrument: InstrumentObject) {
    let connection: IConnection;
    if (isRenderer()) {
        connection = new IpcConnection(instrument);
    } else {
        connection = new Connection(instrument);
    }

    action(() => {
        connections.set(instrument.id.toString(), connection);
    })();

    return connection;
}
