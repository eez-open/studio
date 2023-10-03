import { guid } from "eez-studio-shared/guid";
import { SerialPort } from "serialport";

export async function getSerialPorts(): Promise<
    {
        path: string;
        manufacturer?: string;
        productId?: string;
        pnpId?: string;
    }[]
> {
    return await SerialPort.list();
}

export interface SerialConnectionConstructorParams {
    port: string;
    baudRate: number;
    dataBits: 8 | 7 | 6 | 5;
    stopBits: 1 | 2;
    parity: "none" | "even" | "mark" | "odd" | "space";
}

export interface SerialConnectionCallbacks {
    onConnected(): void;
    onData(data: string): void;
    onError(err: any): void;
    onDisconnected(): void;
}

export function connect(
    params: SerialConnectionConstructorParams,
    callbacks: SerialConnectionCallbacks
) {
    const connectionId = guid();

    connections.set(
        connectionId,
        new Connection(callbacks, connectionId, params)
    );

    return connectionId;
}

export function disconnect(connectionId: string) {
    const connection = connections.get(connectionId);
    if (connection) {
        connection.disconnect();
    }
}

export function write(connectionId: string, data: string) {
    const connection = connections.get(connectionId);
    if (connection) {
        connection.write(data);
    }
}

export function getSerialPort(connectionId: string) {
    const connection = connections.get(connectionId);
    if (connection) {
        return connection.port;
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

const CONF_CHUNK_SIZE = 64;

class Connection {
    port: SerialPort | undefined;
    connectedCalled: boolean = false;
    dataToWrite: string | undefined;

    constructor(
        public callbacks: SerialConnectionCallbacks,
        public connectionId: string,
        params: SerialConnectionConstructorParams
    ) {
        try {
            this.port = new SerialPort(
                {
                    ...params,
                    path: params.port,
                    rtscts: false
                },
                (err: any) => {
                    if (err) {
                        this.callbacks.onError(err);
                    } else {
                        if (!this.connectedCalled) {
                            this.connectedCalled = true;
                            this.callbacks.onConnected();
                        }
                    }
                }
            );
        } catch (err) {
            this.callbacks.onError("Invalid port!");
            return;
        }

        this.port.on("open", () => {
            if (!this.connectedCalled) {
                this.connectedCalled = true;
                this.callbacks.onConnected();
            }
        });

        this.port.on("close", (err: any) => {
            this.disconnect();
        });

        this.port.on("error", (err: any) => {
            this.callbacks.onError(err);
        });

        this.port.on("data", (data: any) => {
            this.callbacks.onData(data.toString("binary"));
        });
    }

    disconnect() {
        if (this.port) {
            this.port.close();
            this.port = undefined;
        }

        this.callbacks.onDisconnected();

        connections.delete(this.connectionId);
    }

    sendNextChunkCallback = () => {
        if (this.port && this.dataToWrite) {
            let nextChunk;
            if (this.dataToWrite.length <= CONF_CHUNK_SIZE) {
                nextChunk = this.dataToWrite;
                this.dataToWrite = undefined;
            } else {
                nextChunk = this.dataToWrite.slice(0, CONF_CHUNK_SIZE);
                this.dataToWrite = this.dataToWrite.slice(CONF_CHUNK_SIZE);
            }

            this.port.write(nextChunk, "binary");

            if (this.dataToWrite) {
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    };

    write(data: string) {
        if (this.port) {
            if (this.dataToWrite) {
                this.dataToWrite += data;
            } else {
                this.dataToWrite = data;
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    }
}

const connections = new Map<string, Connection>();
