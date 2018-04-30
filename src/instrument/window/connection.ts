import { bind } from "bind-decorator";

import { InstrumentObject } from "instrument/instrument-object";
import { ConnectionParameters } from "instrument/connection/interface";

import { createHistoryItem } from "instrument/window/history-item";
import { showConnectionDialog } from "instrument/window/connection-dialog";

////////////////////////////////////////////////////////////////////////////////

export function getConnectionParametersInfo(connectionParameters: ConnectionParameters) {
    if (!connectionParameters) {
        return "";
    }

    if (connectionParameters.type === "ethernet") {
        return `${connectionParameters.ethernetParameters.address}:${
            connectionParameters.ethernetParameters.port
        }`;
    }

    return `${connectionParameters.serialParameters.port}:${
        connectionParameters.serialParameters.baudRate
    }`;
}

////////////////////////////////////////////////////////////////////////////////

class Connection {
    resolveCallback: ((result: any) => void) | undefined;
    rejectCallback: ((result: any) => void) | undefined;

    constructor(private instrument: InstrumentObject) {
        EEZStudio.electron.ipcRenderer.on(
            "instrument/connection/value",
            (event: any, value: any) => {
                this.onValue(value);
            }
        );
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
            this.instrument.lastConnection || this.instrument.defaultConnectionParameters,
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
            value = createHistoryItem(value.logEntry);
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

let connection: Connection | undefined = undefined;

export function getConnection(instrument: InstrumentObject) {
    if (!connection) {
        connection = new Connection(instrument);
    }
    return connection;
}
