import { bind } from "bind-decorator";

import { InstrumentObject } from "instrument/instrument-object";

import { ConnectionParameters } from "instrument/connection/interface";

import { showConnectionDialog } from "instrument/window/connection-dialog";

import { createHistoryItem } from "instrument/window/history/item-factory";

import { InstrumentAppStore } from "instrument/window/app-store";

////////////////////////////////////////////////////////////////////////////////

export function getConnectionParametersInfo(connectionParameters: ConnectionParameters) {
    if (!connectionParameters) {
        return "";
    }

    if (connectionParameters.type === "ethernet") {
        return `${connectionParameters.ethernetParameters.address}:${
            connectionParameters.ethernetParameters.port
        }`;
    } else if (connectionParameters.type === "serial") {
        return `${connectionParameters.serialParameters.port}:${
            connectionParameters.serialParameters.baudRate
        }`;
    } else {
        return `USBTMC`;
    }
}

////////////////////////////////////////////////////////////////////////////////

class Connection {
    resolveCallback: ((result: any) => void) | undefined;
    rejectCallback: ((result: any) => void) | undefined;

    constructor(private appStore: InstrumentAppStore) {
        EEZStudio.electron.ipcRenderer.on(
            "instrument/connection/value",
            (event: any, value: any) => {
                this.onValue(value);
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
            return "Connected to " + getConnectionParametersInfo(connectionParameters);
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

    acquire(traceEnabled: boolean = false) {
        const result = this.instrument.connection.acquire(
            EEZStudio.electron.remote.getCurrentWindow().id,
            traceEnabled
        );
        if (result) {
            throw new Error(result);
        }
    }

    command(command: string) {
        this.instrument.connection.send(command);
    }

    query(query: string) {
        return new Promise((resolve, reject) => {
            this.resolveCallback = resolve;
            this.rejectCallback = reject;
            this.instrument.connection.send(query);
        });
    }

    onValue(value: any) {
        if (value.logEntry !== undefined) {
            value = createHistoryItem(value.logEntry, this.appStore);
        }

        if (value.error) {
            if (this.rejectCallback) {
                this.rejectCallback(new Error(value.error));
            }
        } else {
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
