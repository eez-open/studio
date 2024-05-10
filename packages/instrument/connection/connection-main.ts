import {
    observable,
    action,
    autorun,
    toJS,
    runInAction,
    makeObservable
} from "mobx";

import {
    activityLogStore,
    log,
    logUpdate
} from "instrument/window/history/activity-log";
import {
    registerSource,
    unregisterSource,
    sendMessage
} from "eez-studio-shared/notify";

import {
    instruments,
    type InstrumentObject
} from "instrument/instrument-object";
import { EthernetInterface } from "instrument/connection/interfaces/ethernet";
import { SerialInterface } from "instrument/connection/interfaces/serial";
import { UsbTmcInterface } from "instrument/connection/interfaces/usbtmc";
import { VisaInterface } from "instrument/connection/interfaces/visa";
import { WebSimulatorInterface } from "instrument/connection/interfaces/web-simulator";
import type {
    CommunicationInterface,
    CommunicationInterfaceHost,
    ConnectionParameters
} from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";
import { FileDownload } from "instrument/connection/file-download";
import {
    IFileUploadInstructions,
    FileUpload
} from "instrument/connection/file-upload";
import { parseScpiValue, IResponseTypeType } from "instrument/scpi";
import {
    ConnectionBase,
    ConnectionState,
    ConnectionStatus,
    IConnection,
    ISendOptions,
    LongOperation
} from "instrument/connection/connection-base";
import { Plotter } from "instrument/connection/plotter";

////////////////////////////////////////////////////////////////////////////////

const CONF_HOUSEKEEPING_INTERVAL = 100;
const CONF_IDN_EXPECTED_TIMEOUT = 2000;
const CONF_SCPI_COMBINE_IF_BELOW_MS = 250;
const CONF_ACQUIRE_TIMEOUT = 3000;

const COMMAND_LINE_ENDING = {
    "no-line-ending": "",
    newline: "\n",
    "carriage-return": "\r",
    "both-nl-and-cr": "\r\n"
};

const MAX_ANSWER_LOG_ENTRY_MESSAGE_LENGTH = 100 * 1024;

////////////////////////////////////////////////////////////////////////////////

export class Connection
    extends ConnectionBase
    implements CommunicationInterfaceHost
{
    _state: ConnectionState = ConnectionState.IDLE;
    get state() {
        return this._state;
    }
    set state(state: ConnectionState) {
        action(() => {
            this._state = state;
        })();
    }

    _errorCode: ConnectionErrorCode = ConnectionErrorCode.NONE;
    get errorCode() {
        return this._errorCode;
    }
    set errorCode(errorCode: ConnectionErrorCode) {
        action(() => {
            this._errorCode = errorCode;
        })();
    }

    _error: string | undefined;
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

    instrumentId: string | undefined;
    acquireId: string | undefined;
    callbackWindowId: number | undefined;

    traceEnabled: boolean = true;
    expectedResponseType: IResponseTypeType | undefined;

    sendTimeoutId: any;

    lastAnswerActivityLogId: any;
    lastAnswerActivityLogMessage: string;

    _onReadCallback: ((data: string | undefined) => void) | undefined;

    constructor(public instrument: InstrumentObject) {
        super(instrument);

        makeObservable(this, {
            _state: observable,
            _errorCode: observable,
            _error: observable,
            longOperation: observable
        });

        this.notifySource = {
            id: "instrument/" + this.instrument.id + "/connection",
            onNewTarget: (
                targetId: string,
                filterSpecification: any,
                inProcessTarget: boolean
            ) => {
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
            error: this.error,
            isPlotterEnabled: this.isPlotterEnabled
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

        this.connectionParameters = this.instrument
            .lastConnection as ConnectionParameters;

        if (!this.connectionParameters) {
            this.setError(
                ConnectionErrorCode.NOT_FOUND,
                "No connection interface defined"
            );
            this.disconnected();
            return;
        }

        if (this.connectionParameters.type === "ethernet") {
            this.communicationInterface = new EthernetInterface(this);
        } else if (this.connectionParameters.type === "serial") {
            this.communicationInterface = new SerialInterface(this);
        } else if (this.connectionParameters.type === "usbtmc") {
            this.communicationInterface = new UsbTmcInterface(this);
        } else if (this.connectionParameters.type === "web-simulator") {
            this.communicationInterface = new WebSimulatorInterface(this);
        } else {
            this.communicationInterface = new VisaInterface(this);
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

        if (this.instrument.commandsProtocol == "SCPI") {
            this.sendIdn();
        } else {
            this.state = ConnectionState.CONNECTED;
        }

        this.housekeepingIntervalId = setInterval(
            this.housekeeping,
            CONF_HOUSEKEEPING_INTERVAL
        );
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

            this.lastAnswerActivityLogId = undefined;
            this.lastAnswerActivityLogMessage = "";
        }
    }

    logAnswer(data: string) {
        if (this.traceEnabled && data.trim().length > 0) {
            if (this.lastAnswerActivityLogId != undefined) {
                this.lastAnswerActivityLogMessage += data;

                logUpdate(
                    activityLogStore,
                    {
                        id: this.lastAnswerActivityLogId,
                        oid: this.instrument.id,
                        message: this.lastAnswerActivityLogMessage
                    },
                    {
                        undoable: false
                    }
                );

                if (
                    this.lastAnswerActivityLogMessage.length >
                    MAX_ANSWER_LOG_ENTRY_MESSAGE_LENGTH
                ) {
                    this.lastAnswerActivityLogId = undefined;
                    this.lastAnswerActivityLogMessage = "";
                }
            } else {
                const id = log(
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

                if (this.instrument.commandsProtocol != "SCPI") {
                    this.lastAnswerActivityLogId = id;
                    this.lastAnswerActivityLogMessage = data;
                }
            }
        }
    }

    sendValue(value: any) {
        if (this.callbackWindowId) {
            let browserWindow = require("electron").BrowserWindow.fromId(
                this.callbackWindowId
            )!;
            if (browserWindow) {
                browserWindow.webContents.send("instrument/connection/value", {
                    instrumentId: this.instrumentId,
                    acquireId: this.acquireId,
                    value
                });
            }
        }
    }

    sendTimeout() {
        if (this.callbackWindowId) {
            let browserWindow = require("electron").BrowserWindow.fromId(
                this.callbackWindowId
            )!;
            if (browserWindow) {
                browserWindow.webContents.send("instrument/connection/value", {
                    instrumentId: this.instrumentId,
                    acquireId: this.acquireId,
                    value: null,
                    error: "Timeout"
                });
            }
        }
    }

    longOperationDone() {
        if (this.sendTimeoutId) {
            clearTimeout(this.sendTimeoutId);
            this.sendTimeoutId = undefined;
        }

        if (this.longOperation) {
            if (this.longOperation.isQuery && this.longOperation.logEntry) {
                this.sendValue({ logEntry: this.longOperation.logEntry });
            }
            runInAction(() => {
                this.longOperation = undefined;
            });
        }
    }

    onDataLineReceived(data: string) {
        this.logAnswer(data);

        data = data.trim();
        if (data) {
            const value = parseScpiValue(data);

            if (this.sendTimeoutId) {
                clearTimeout(this.sendTimeoutId);
                this.sendTimeoutId = undefined;
            }

            this.sendValue(value);

            if (this.idnExpected) {
                this.idnExpected = false;

                if (this.idnExpectedTimeout) {
                    clearTimeout(this.idnExpectedTimeout);
                    this.idnExpectedTimeout = undefined;
                }

                if (typeof value !== "string") {
                    this.setError(
                        ConnectionErrorCode.NONE,
                        "Invalid IDN value."
                    );
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
            runInAction(() => {
                this.longOperation = undefined;
            });
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

    housekeeping = () => {
        if (this.acquireQueue.length > 0) {
            const acquireTask = this.acquireQueue[0];
            if (Date.now() - acquireTask.requestTime > CONF_ACQUIRE_TIMEOUT) {
                this.acquireQueue.shift()!;

                const browserWindow = require("electron").BrowserWindow.fromId(
                    acquireTask.callbackWindowId
                )!;
                if (browserWindow) {
                    browserWindow.webContents.send(
                        "instrument/connection/acquire-result",
                        {
                            instrumentId: acquireTask.instrumentId,
                            acquireId: acquireTask.acquireId,
                            rejectReason: "timeout"
                        }
                    );
                }
            }
        }

        if (this.longOperation && this.longOperation.isDone()) {
            let dataSurplus = this.longOperation.dataSurplus;
            this.longOperationDone();
            this.data = dataSurplus;
        }

        if (
            !(
                this.communicationInterface &&
                this.communicationInterface.isConnected()
            )
        ) {
            this.disconnect();
        }
    };

    onData(data: string, endIndicatorReceived?: boolean | undefined) {
        if (this._onReadCallback) {
            this._onReadCallback(data);
            return;
        }

        if (this.dataTimeoutId) {
            clearTimeout(this.dataTimeoutId);
        }

        if (this.longOperation) {
            this.longOperation.onData(data);
        } else if (
            this.instrument.commandsProtocol == "SCPI" &&
            this.data === undefined &&
            (data.startsWith("#") ||
                this.expectedResponseType === "non-standard-data-block")
        ) {
            runInAction(() => {
                this.longOperation = new FileDownload(
                    this,
                    data,
                    this.expectedResponseType === "non-standard-data-block"
                );
            });
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

        if (typeof endIndicatorReceived == "boolean") {
            if (endIndicatorReceived) {
                this.onDataLineReceived(this.data);
                this.data = undefined;
            }
        } else if (this.instrument.commandsProtocol == "SCPI") {
            let index = this.data.indexOf("\n");

            if (index == -1) {
                index = this.data.indexOf("\r");
            }

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
        }

        if (this.data !== undefined) {
            if (this.instrument.commandsProtocol == "SCPI") {
                this.dataTimeoutId = setTimeout(() => {
                    this.flushData();
                }, CONF_SCPI_COMBINE_IF_BELOW_MS);
            } else {
                if (this.state == ConnectionState.CONNECTED) {
                    this.logAnswer(this.data);
                }
                this.data = undefined;
            }
        }
    }

    sendQueue: { command: string; delay: number }[] = [];
    lastSend: number | undefined;

    dumpSendQueue() {
        if (this.sendQueue.length > 0) {
            let now = new Date().getTime();
            let delay = this.sendQueue[0].delay;
            if (this.lastSend == undefined || now - this.lastSend >= delay) {
                this.lastSend = now;
                this.communicationInterface!.write(this.sendQueue[0].command);
                this.sendQueue.shift();
                this.dumpSendQueue();
            } else {
                setTimeout(() => {
                    this.dumpSendQueue();
                }, delay - (now - this.lastSend));
            }
        }
    }

    send(command: string, options?: ISendOptions): void {
        if (this.instrument.commandsProtocol == "SCPI") {
            if (!options || !options.longOperation) {
                if (this.longOperation) {
                    if (
                        this.longOperation instanceof FileDownload ||
                        this.longOperation instanceof FileUpload
                    ) {
                        this.logAnswer("**ERROR: file transfer in progress\n");
                    } else {
                        this.logAnswer(
                            "**ERROR: another operation in progress\n"
                        );
                    }
                    return;
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
            return;
        }

        this.expectedResponseType = options && options.queryResponseType;

        this.errorCode = ConnectionErrorCode.NONE;
        this.error = undefined;

        const delay =
            options && options.delay != undefined
                ? options.delay
                : this.connectionParameters.delay ?? 0;

        if (this.instrument.commandsProtocol == "SCPI") {
            this.sendQueue.push({
                command: command + "\n",
                delay
            });
        } else {
            this.sendQueue.push({
                command:
                    command +
                    (COMMAND_LINE_ENDING[this.instrument.commandLineEnding] ||
                        ""),
                delay
            });
        }

        this.dumpSendQueue();

        if (options && options.isQuery) {
            const timeout =
                options.timeout != undefined
                    ? options.timeout
                    : this.connectionParameters.timeout ?? 60000;

            this.sendTimeoutId = setTimeout(() => {
                this.sendTimeoutId = undefined;
                this.sendTimeout();
            }, timeout);
        }
    }

    sendIdn() {
        if (
            this.state !== ConnectionState.TESTING &&
            this.state !== ConnectionState.CONNECTED
        ) {
            console.error(
                "invalid state (this.state !== ConnectionState.TESTING && this.state !== ConnectionState.CONNECTED)"
            );
            return;
        }

        if (!this.communicationInterface) {
            console.error(
                "invalid state (!this.connectionInterfaceImplementation)"
            );
            return;
        }

        this.idnExpected = true;

        this.idnExpectedTimeout = setTimeout(() => {
            this.idnExpectedTimeout = undefined;

            this.setError(
                ConnectionErrorCode.NONE,
                "Timeout (no response to IDN query)."
            );
            this.disconnect();
        }, CONF_IDN_EXPECTED_TIMEOUT);

        this.send("*IDN?");
        this.flushData();
    }

    startLongOperation(
        createLongOperation: () => LongOperation,
        checkState: boolean = true
    ) {
        if (
            checkState &&
            (this.state !== ConnectionState.CONNECTED ||
                !this.communicationInterface)
        ) {
            this.logAnswer("not connected");
            return;
        }

        if (this.longOperation) {
            if (
                this.longOperation instanceof FileDownload ||
                this.longOperation instanceof FileUpload
            ) {
                this.logAnswer("file transfer in progress");
            } else {
                throw this.logAnswer("another operation in progress");
            }
            return;
        }

        runInAction(() => {
            this.longOperation = createLongOperation();
        });
    }

    doUpload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ) {
        try {
            this.startLongOperation(
                () => new FileUpload(this, instructions, onSuccess, onError)
            );
        } catch (err) {
            this.logAnswer(`**ERROR: ${err}\n`);
        }
    }

    enablePlotter() {
        try {
            this.startLongOperation(
                () => new Plotter(this, this.instrument),
                false
            );
        } catch (err) {
            this.logAnswer(`**ERROR: ${err}\n`);
        }
    }

    get isPlotterEnabled() {
        return this.longOperation && this.longOperation instanceof Plotter
            ? true
            : false;
    }

    abortLongOperation() {
        if (this.longOperation) {
            this.longOperation.abort();

            if (this.longOperation.isDone()) {
                let dataSurplus = this.longOperation.dataSurplus;
                this.longOperationDone();
                this.data = dataSurplus;
            }
        }
    }

    disconnect() {
        if (
            this.state === ConnectionState.IDLE ||
            !this.communicationInterface
        ) {
            console.error("invalid state (disconnect)");
            return;
        }

        this.state = ConnectionState.DISCONNECTING;
        this.communicationInterface.disconnect();

        if (this.callbackWindowId) {
            let browserWindow = require("electron").BrowserWindow.fromId(
                this.callbackWindowId
            )!;
            if (browserWindow) {
                browserWindow.webContents.send("instrument/connection/value", {
                    instrumentId: this.instrumentId,
                    acquireId: this.acquireId,
                    error: "connection is diconnected"
                });
            }
        }
    }

    disconnected() {
        this.communicationInterface = undefined;
        this.state = ConnectionState.IDLE;
        this.lastAnswerActivityLogId = undefined;

        this.sendQueue = [];

        if (this._onReadCallback) {
            this._onReadCallback(undefined);
            this._onReadCallback = undefined;
        }

        if (this.sendTimeoutId) {
            clearTimeout(this.sendTimeoutId);
            this.sendTimeoutId = undefined;
        }

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

        this.doRelease();
    }

    acquireQueue: {
        requestTime: number;
        instrumentId: string;
        acquireId: string;
        callbackWindowId: number;
        traceEnabled: boolean;
    }[] = [];

    async doAcquire(
        instrumentId: string,
        acquireId: string,
        callbackWindowId: number,
        traceEnabled: boolean
    ) {
        let browserWindow =
            require("electron").BrowserWindow.fromId(callbackWindowId)!;

        if (this.isConnected) {
            if (this.callbackWindowId != undefined) {
                this.acquireQueue.push({
                    requestTime: Date.now(),
                    instrumentId,
                    acquireId,
                    callbackWindowId,
                    traceEnabled
                });
            } else {
                this.instrumentId = instrumentId;
                this.acquireId = acquireId;
                this.callbackWindowId = callbackWindowId;
                this.traceEnabled = traceEnabled;

                if (browserWindow) {
                    browserWindow.webContents.send(
                        "instrument/connection/acquire-result",
                        {
                            instrumentId,
                            acquireId
                        }
                    );
                }
            }
        } else {
            if (browserWindow) {
                browserWindow.webContents.send(
                    "instrument/connection/acquire-result",
                    {
                        instrumentId,
                        acquireId,
                        rejectReason: "not connected"
                    }
                );
            }
        }
    }

    doRelease() {
        this.callbackWindowId = undefined;
        this.acquireId = undefined;
        this.traceEnabled = true;

        const acquireTask = this.acquireQueue.shift();
        if (acquireTask) {
            this.doAcquire(
                acquireTask.instrumentId,
                acquireTask.acquireId,
                acquireTask.callbackWindowId,
                acquireTask.traceEnabled
            );
        }
    }

    onRead(callback: (data: string | undefined) => void) {
        this._onReadCallback = callback;
    }

    offRead(callback: (data: string | undefined) => void) {
        this._onReadCallback = undefined;
    }

    // no need to implement these in main process connection
    get interfaceInfo() {
        return undefined;
    }
    async acquire(traceEnabled: boolean) {}
    async command(command: string) {}
    async query(query: string) {}
    upload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ) {}
    release() {}
}

export function setupIpcServer() {
    const { ipcMain } = require("electron");

    ipcMain.on(
        "instrument/connection/connect",
        function (
            event: any,
            arg: {
                instrumentId: string;
                connectionParameters: any;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                if (arg.connectionParameters) {
                    connection.instrument.setConnectionParameters(
                        arg.connectionParameters
                    );
                }
                connection.connect();
            }
        }
    );

    ipcMain.on(
        "instrument/connection/disconnect",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.disconnect();
            }
        }
    );

    ipcMain.on(
        "instrument/connection/destroy",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.destroy();
            }
        }
    );

    ipcMain.on(
        "instrument/connection/send",
        function (
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
        }
    );

    ipcMain.on(
        "instrument/connection/upload",
        function (
            event: any,
            arg: {
                instrumentId: string;
                instructions: IFileUploadInstructions;
                callbackWindowId: number;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.instrument.setLastFileUploadInstructions(
                    arg.instructions
                );

                connection.doUpload(
                    arg.instructions,
                    () => {
                        let browserWindow =
                            require("electron").BrowserWindow.fromId(
                                arg.callbackWindowId
                            )!;
                        if (browserWindow) {
                            browserWindow.webContents.send(
                                "instrument/connection/long-operation-result",
                                {
                                    instrumentId: arg.instrumentId
                                }
                            );
                        }
                    },
                    error => {
                        let browserWindow =
                            require("electron").BrowserWindow.fromId(
                                arg.callbackWindowId
                            )!;
                        if (browserWindow) {
                            browserWindow.webContents.send(
                                "instrument/connection/long-operation-result",
                                {
                                    instrumentId: arg.instrumentId,
                                    error
                                }
                            );
                        }
                    }
                );
            }
        }
    );

    ipcMain.on(
        "instrument/connection/enable-plotter",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.enablePlotter();
            }
        }
    );

    ipcMain.on(
        "instrument/connection/create-plotter",
        function (
            event: Electron.IpcMainEvent,
            arg: {
                instrumentId: string;
                answerIds: string[];
            }
        ) {
            if (!Plotter.createPlotter(arg.instrumentId, arg.answerIds)) {
                event.sender.send("create-plotter-no-data");
            }
        }
    );

    ipcMain.on(
        "instrument/connection/abort-long-operation",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.abortLongOperation();
            }
        }
    );

    ipcMain.on(
        "instrument/connection/dismiss-error",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.dismissError();
            }
        }
    );

    ipcMain.on(
        "instrument/connection/acquire",
        function (
            event: any,
            arg: {
                instrumentId: string;
                acquireId: string;
                callbackWindowId: number;
                traceEnabled: boolean;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.doAcquire(
                    arg.instrumentId,
                    arg.acquireId,
                    arg.callbackWindowId,
                    arg.traceEnabled
                );
            } else {
                let browserWindow = require("electron").BrowserWindow.fromId(
                    arg.callbackWindowId
                )!;
                if (browserWindow) {
                    browserWindow.webContents.send(
                        "instrument/connection/acquire-result",
                        {
                            instrumentId: arg.instrumentId,
                            acquireId: arg.acquireId,
                            rejectReason: "not connected"
                        }
                    );
                }
            }
        }
    );

    ipcMain.on(
        "instrument/connection/release",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.doRelease();
            }
            event.returnValue = true;
        }
    );

    ipcMain.on(
        "instrument/connection/on-read-callback",
        function (
            event: any,
            arg: {
                instrumentId: string;
                callbackWindowId: number;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.onRead(data => {
                    let browserWindow =
                        require("electron").BrowserWindow.fromId(
                            arg.callbackWindowId
                        )!;
                    if (browserWindow) {
                        browserWindow.webContents.send(
                            "instrument/connection/on-data",
                            {
                                instrumentId: arg.instrumentId,
                                data
                            }
                        );
                    }
                });
            }
        }
    );

    ipcMain.on(
        "instrument/connection/off-read-callback",
        function (
            event: any,
            arg: {
                instrumentId: string;
            }
        ) {
            let connection = connections.get(arg.instrumentId);
            if (connection) {
                connection.offRead(() => {});
            }
        }
    );
}

export const connections = observable(new Map<string, IConnection>());

export function createMainProcessConnection(instrument: InstrumentObject) {
    const connection = new Connection(instrument);
    runInAction(() => connections.set(instrument.id.toString(), connection));
    return connection;
}

export function closeConnections() {
    instruments.forEach(instrument => {
        if (instrument.connection.isConnected) {
            instrument.connection.disconnect();
        } else {
            instrument.connection.abortLongOperation();
        }
    });
}
