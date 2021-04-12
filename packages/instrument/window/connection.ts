import { bind } from "bind-decorator";

import { InstrumentObject } from "instrument/instrument-object";

import { ConnectionParameters } from "instrument/connection/interface";
import { IFileUploadInstructions } from "instrument/connection/file-upload";

import { showConnectionDialog } from "instrument/window/connection-dialog";

import { createHistoryItem } from "instrument/window/history/item-factory";

import { InstrumentAppStore } from "instrument/window/app-store";
import { guid } from "eez-studio-shared/guid";

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
    } else {
        return `USBTMC`;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Connection {
    acquireId = guid();
    resolveCallback: ((result: any) => void) | undefined;
    rejectCallback: ((result: any) => void) | undefined;

    constructor(private appStore: InstrumentAppStore) {
        EEZStudio.electron.ipcRenderer.on(
            "instrument/connection/value",
            (
                event: any,
                args: {
                    acquireId: string;
                    value: any;
                    error: any;
                }
            ) => {
                if (this.acquireId === args.acquireId) {
                    this.onValue(args.value, args.error);
                }
            }
        );
    }

    get instrument() {
        return this.appStore.instrument!;
    }

    get isConnected() {
        return this.instrument.connection.isConnected;
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

    @bind
    handleConnect(connectionParameters: ConnectionParameters) {
        if (!connectionParameters && !this.instrument.lastConnection) {
            connectionParameters = this.instrument.defaultConnectionParameters;
        }
        this.instrument.connection.connect(connectionParameters);
    }

    openConnectDialog() {
        showConnectionDialog(
            this.instrument.getConnectionParameters([
                this.instrument.lastConnection,
                this.instrument.defaultConnectionParameters
            ]),
            this.handleConnect,
            this.instrument.availableConnections,
            this.instrument.serialBaudRates
        );
    }

    async acquire(traceEnabled: boolean = false) {
        await this.instrument.connection.acquire(
            this.acquireId,
            EEZStudio.remote.getCurrentWindow().id,
            traceEnabled
        );
    }

    command(command: string) {
        this.instrument.connection.send(command);
    }

    query(query: string) {
        return new Promise<any>((resolve, reject) => {
            if (this.isConnected) {
                this.resolveCallback = resolve;
                this.rejectCallback = reject;
                this.instrument.connection.send(query);
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
        this.instrument.connection.upload(instructions, onSuccess, onError);
    }

    onValue(value: any, error: any) {
        if (error) {
            if (this.rejectCallback) {
                this.rejectCallback(new Error(error));
            }
        } else {
            if (value.logEntry !== undefined) {
                value = createHistoryItem(value.logEntry, this.appStore);
            }

            if (this.resolveCallback) {
                this.resolveCallback(value);
            }
        }

        this.rejectCallback = undefined;
        this.resolveCallback = undefined;
    }

    release() {
        this.instrument.connection.release();
    }
}

////////////////////////////////////////////////////////////////////////////////

const connections = new Map<InstrumentObject, Connection>();

export function getConnection(appStore: InstrumentAppStore) {
    const instrument = appStore.instrument!;
    let connection = connections.get(instrument);
    if (!connection) {
        connection = new Connection(appStore);
        connections.set(instrument, connection);
    }
    return connection;
}
