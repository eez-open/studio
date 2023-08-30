import { observable, toJS, runInAction, makeObservable } from "mobx";
import { ipcRenderer } from "electron";
import { getCurrentWindow } from "@electron/remote";

import { watch } from "eez-studio-shared/notify";
import { guid } from "eez-studio-shared/guid";

import type { IInstrumentObjectProps } from "instrument/instrument-object";
import type { ConnectionParameters } from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";
import type { IFileUploadInstructions } from "instrument/connection/file-upload";
import {
    ConnectionBase,
    ConnectionState,
    ConnectionStatus,
    IConnection,
    ISendOptions
} from "instrument/connection/connection-base";
import { createHistoryItem } from "instrument/window/history/item-factory";
import { activityLogStore } from "instrument/window/history/activity-log";

export class IpcConnection extends ConnectionBase {
    static ipcConnections = new Map<string, IpcConnection>();

    traceEnabled: boolean = true;

    state: ConnectionState = ConnectionState.IDLE;
    errorCode: ConnectionErrorCode = ConnectionErrorCode.NONE;
    error: string | undefined;

    onSuccess?: () => void;
    onError?: (error: any) => void;

    acquireId = guid();

    resolveCallback: ((result: any) => void) | undefined;
    rejectCallback: ((result: any) => void) | undefined;

    acquireQueue: {
        acquireId: string;
        resolve: () => void;
        reject: (reason?: any) => void;
    }[] = [];

    constructor(instrument: IInstrumentObjectProps) {
        super(instrument);

        makeObservable(this, {
            state: observable,
            errorCode: observable,
            error: observable
        });

        watch(
            "instrument/" + instrument.id + "/connection",
            undefined,
            (connectionStatus: ConnectionStatus) => {
                runInAction(() => {
                    this.state = connectionStatus.state;
                    this.errorCode = connectionStatus.errorCode;
                    this.error = connectionStatus.error;
                });

                if (connectionStatus.state != ConnectionState.CONNECTED) {
                    if (this.rejectCallback) {
                        this.rejectCallback("Connection disconnected.");
                        this.rejectCallback = undefined;
                        this.resolveCallback = undefined;
                    }
                }
            }
        );

        IpcConnection.ipcConnections.set(instrument.id, this);
        if (IpcConnection.ipcConnections.size == 1) {
            IpcConnection.setupIpcListeners();
        }
    }

    static setupIpcListeners() {
        ipcRenderer.on(
            "instrument/connection/long-operation-result",
            (
                event: any,
                args: {
                    instrumentId: string;
                    error?: any;
                }
            ) => {
                const ipcConnection = IpcConnection.ipcConnections.get(
                    args.instrumentId
                );
                if (ipcConnection) {
                    if (args.error) {
                        if (ipcConnection.onError) {
                            ipcConnection.onError(args.error);
                        }
                    } else {
                        if (ipcConnection.onSuccess) {
                            ipcConnection.onSuccess();
                        }
                    }
                    ipcConnection.onError = undefined;
                    ipcConnection.onSuccess = undefined;
                } else {
                    console.error(
                        "Unknown instrument ID for the long operation:",
                        args.instrumentId
                    );
                }
            }
        );

        ipcRenderer.on(
            "instrument/connection/acquire-result",
            (
                event: any,
                args: {
                    instrumentId: string;
                    acquireId: string;
                    rejectReason?: any;
                }
            ) => {
                const ipcConnection = IpcConnection.ipcConnections.get(
                    args.instrumentId
                );
                if (ipcConnection) {
                    for (
                        let i = 0;
                        i < ipcConnection.acquireQueue.length;
                        i++
                    ) {
                        const acquireTask = ipcConnection.acquireQueue[i];
                        if (acquireTask.acquireId === args.acquireId) {
                            ipcConnection.acquireQueue.splice(i, 1);
                            if (args.rejectReason) {
                                acquireTask.reject(args.rejectReason);
                            } else {
                                acquireTask.resolve();
                            }
                            break;
                        }
                    }
                } else {
                    console.error(
                        "Unknown instrument ID for the acquire result:",
                        args.instrumentId
                    );
                }
            }
        );

        ipcRenderer.on(
            "instrument/connection/value",
            (
                event: any,
                args: {
                    instrumentId: string;
                    acquireId: string;
                    value: any;
                    error: any;
                }
            ) => {
                const ipcConnection = IpcConnection.ipcConnections.get(
                    args.instrumentId
                );

                if (ipcConnection) {
                    if (ipcConnection.acquireId === args.acquireId) {
                        ipcConnection.onValue(args.value, args.error);
                    }
                } else {
                    console.error(
                        "Unknown instrument ID for the query result:",
                        args.instrumentId
                    );
                }
            }
        );
    }

    dismissError() {
        ipcRenderer.send("instrument/connection/dismiss-error", {
            instrumentId: this.instrument.id
        });
    }

    connect(connectionParameters?: ConnectionParameters) {
        ipcRenderer.send("instrument/connection/connect", {
            instrumentId: this.instrument.id,
            connectionParameters: toJS(connectionParameters)
        });
    }

    disconnect() {
        ipcRenderer.send("instrument/connection/disconnect", {
            instrumentId: this.instrument.id
        });
    }

    destroy() {
        ipcRenderer.send("instrument/connection/destroy", {
            instrumentId: this.instrument.id
        });
    }

    async send(command: string, options: ISendOptions | undefined) {
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
            options = Object.assign(options || {}, {
                queryResponseType: await this.instrument.getQueryResponseType(
                    commandName
                )
            });
        } else {
            if (
                await this.instrument.isCommandSendsBackDataBlock(commandName)
            ) {
                options = Object.assign(options || {}, {
                    queryResponseType: "non-standard-data-block"
                });
            }
        }

        if (!this.traceEnabled) {
            if (!options) {
                options = {};
            }
            options.log = false;
        }

        ipcRenderer.send("instrument/connection/send", {
            instrumentId: this.instrument.id,
            command,
            options
        });
    }

    doUpload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ) {
        this.onSuccess = onSuccess;
        this.onError = onError;

        ipcRenderer.send("instrument/connection/upload", {
            instrumentId: this.instrument.id,
            instructions: toJS(instructions),
            callbackWindowId: getCurrentWindow().id
        });
    }

    async isLongOperationInProgress() {
        ipcRenderer.send("instrument/connection/abort-long-operation", {
            instrumentId: this.instrument.id
        });
    }

    abortLongOperation() {
        ipcRenderer.send("instrument/connection/abort-long-operation", {
            instrumentId: this.instrument.id
        });
    }

    async doAcquire(
        instrumentId: string,
        acquireId: string,
        callbackWindowId: number,
        traceEnabled: boolean
    ) {
        return new Promise<void>((resolve, reject) => {
            this.acquireQueue.push({
                acquireId,
                resolve,
                reject
            });

            ipcRenderer.send("instrument/connection/acquire", {
                instrumentId,
                acquireId,
                callbackWindowId,
                traceEnabled
            });
        });
    }

    doRelease() {
        ipcRenderer.sendSync("instrument/connection/release", {
            instrumentId: this.instrument.id
        });
    }

    get interfaceInfo() {
        let connectionParameters = this.instrument.lastConnection;
        if (connectionParameters) {
            return (
                "Connected to " +
                getConnectionParametersInfo(connectionParameters)
            );
        } else {
            return undefined;
        }
    }

    async acquire(traceEnabled: boolean) {
        await this.doAcquire(
            this.instrument.id,
            this.acquireId,
            getCurrentWindow().id,
            traceEnabled
        );
        this.traceEnabled = traceEnabled;
    }

    async command(command: string, options?: ISendOptions) {
        await this.send(command, options);
    }

    query(query: string, options?: ISendOptions) {
        return new Promise<any>((resolve, reject) => {
            if (this.isConnected) {
                this.resolveCallback = resolve;
                this.rejectCallback = reject;
                this.send(
                    query,
                    Object.assign(options || {}, { isQuery: true })
                );
            } else {
                reject("not connected");
            }
        });
    }

    upload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ) {
        this.doUpload(instructions, onSuccess, onError);
    }

    onValue(value: any, error: any) {
        if (error) {
            if (this.rejectCallback) {
                this.rejectCallback(error);
            }
        } else {
            if (value.logEntry !== undefined) {
                value = createHistoryItem(activityLogStore, value.logEntry);
            }

            if (this.resolveCallback) {
                this.resolveCallback(value);
            }
        }

        this.rejectCallback = undefined;
        this.resolveCallback = undefined;
    }

    release() {
        this.doRelease();
        this.traceEnabled = true;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getConnectionParametersInfo(
    connectionParameters: ConnectionParameters
) {
    if (!connectionParameters) {
        return "";
    }

    if (connectionParameters.type === "ethernet") {
        return `${connectionParameters.ethernetParameters.address}:${connectionParameters.ethernetParameters.port}`;
    } else if (connectionParameters.type === "serial") {
        return `${connectionParameters.serialParameters.port}:${connectionParameters.serialParameters.baudRate}`;
    } else if (connectionParameters.type === "usbtmc") {
        return `USBTMC`;
    } else if (connectionParameters.type === "web-simulator") {
        return `WebSimulator`;
    } else {
        return "VISA";
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IWebSimulatorDebugger {
    onMessageToDebugger(data: string): void;
    stop(): void;
}

export class WebSimulatorMessageDispatcher {
    iframes = new Map<string, MessageEventSource>();
    writeMessages = new Map<string, ArrayBuffer[]>();
    webSimulatorDebuggers = new Map<string, IWebSimulatorDebugger>();

    constructor() {
        ipcRenderer.on(
            "web-simulator-connection-write",
            (event: any, simulatorID: string, data: ArrayBuffer) => {
                const iframeWindow = this.iframes.get(simulatorID);
                if (iframeWindow) {
                    try {
                        iframeWindow.postMessage({
                            msgId: "web-simulator-connection-scpi-write",
                            data
                        });
                    } catch (err) {
                        this.iframes.delete(simulatorID);
                    }
                } else {
                    const messages = this.writeMessages.get(simulatorID) ?? [];
                    messages.push(data);
                    this.writeMessages.set(simulatorID, messages);
                }
            }
        );

        window.addEventListener("message", e => {
            const source = e.source;
            const data = e.data;
            if (source) {
                if (data.msgId == "web-simulator-loaded") {
                    const simulatorID = data.simulatorID;
                    if (simulatorID) {
                        this.iframes.set(data.simulatorID, source);

                        const messages = this.writeMessages.get(
                            data.simulatorID
                        );
                        if (messages) {
                            messages.forEach(data =>
                                source.postMessage({
                                    msgId: "web-simulator-connection-scpi-write",
                                    data
                                })
                            );
                        }
                    }
                } else if (data.msgId == "web-simulator-write-scpi-buffer") {
                    ipcRenderer.send(
                        "web-simulator-connection-on-data",
                        data.simulatorID,
                        data.scpiOutputBuffer
                    );
                } else if (
                    data.msgId == "web-simulator-write-debugger-buffer"
                ) {
                    const webSimulatorDebugger = this.webSimulatorDebuggers.get(
                        data.simulatorID
                    );
                    if (webSimulatorDebugger) {
                        function arrayBufferToBinaryString(data: ArrayBuffer) {
                            const buffer = Buffer.from(data);
                            return buffer.toString("binary");
                        }
                        webSimulatorDebugger.onMessageToDebugger(
                            arrayBufferToBinaryString(data.debuggerOutputBuffer)
                        );
                    }
                }
            }
        });
    }

    connectDebugger(
        simulatorID: string,
        webSimulatorDebugger: IWebSimulatorDebugger
    ) {
        const currentWebSimulatorDebugger =
            this.webSimulatorDebuggers.get(simulatorID);
        if (currentWebSimulatorDebugger) {
            currentWebSimulatorDebugger.stop();
        }
        this.webSimulatorDebuggers.set(simulatorID, webSimulatorDebugger);

        const iframeWindow = this.iframes.get(simulatorID);
        if (iframeWindow) {
            iframeWindow.postMessage({
                msgId: "web-simulator-connection-debugger-client-connected"
            });
        }
    }

    disconnectDebugger(simulatorID: string) {
        const iframeWindow = this.iframes.get(simulatorID);
        if (iframeWindow) {
            iframeWindow.postMessage({
                msgId: "web-simulator-connection-debugger-client-disconnected"
            });
        }
        this.webSimulatorDebuggers.delete(simulatorID);
    }

    sendMessageFromDebugger(simulatorID: string, data: string) {
        const iframeWindow = this.iframes.get(simulatorID);
        if (iframeWindow) {
            try {
                function binaryStringToArrayBuffer(data: string) {
                    const buffer = Buffer.from(data, "binary");
                    return buffer.buffer.slice(
                        buffer.byteOffset,
                        buffer.byteOffset + buffer.byteLength
                    );
                }

                iframeWindow.postMessage({
                    msgId: "web-simulator-connection-debugger-write",
                    data: binaryStringToArrayBuffer(data)
                });
            } catch (err) {
                console.error(err);
            }
        }
    }
}

export const webSimulatorMessageDispatcher =
    new WebSimulatorMessageDispatcher();

////////////////////////////////////////////////////////////////////////////////

export const connections = observable(new Map<string, IConnection>());

export function createRendererProcessConnection(
    instrument: IInstrumentObjectProps
) {
    const connection = new IpcConnection(instrument);
    runInAction(() => connections.set(instrument.id.toString(), connection));
    return connection;
}
