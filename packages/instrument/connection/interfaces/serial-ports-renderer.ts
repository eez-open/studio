import { ipcRenderer } from "electron";
import { guid } from "eez-studio-shared/guid";

export async function getSerialPorts(): Promise<
    {
        path: string;
        manufacturer?: string;
        productId?: string;
        pnpId?: string;
    }[]
> {
    return await ipcRenderer.invoke("getSerialPorts");
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
    ipcRenderer.send("newSerialPortConnection", {
        connectionId,
        params
    });
    connections.set(connectionId, callbacks);
    return connectionId;
}

export function disconnect(connectionId: string) {
    ipcRenderer.send("serialPortConnectionDisconnect", {
        connectionId
    });
}

export function write(connectionId: string, data: string) {
    ipcRenderer.send("serialPortConnectionWrite", {
        connectionId,
        data
    });
}

const connections = new Map<string, SerialConnectionCallbacks>();

ipcRenderer.on("serialPortConnected", (event, args) => {
    const callbacks = connections.get(args.connectionId);
    if (callbacks) {
        callbacks.onConnected();
    }
});

ipcRenderer.on("serialPortData", (event, args) => {
    const callbacks = connections.get(args.connectionId);
    if (callbacks) {
        callbacks.onData(args.data);
    }
});

ipcRenderer.on("serialPortError", (event, args) => {
    const callbacks = connections.get(args.connectionId);
    if (callbacks) {
        callbacks.onError(args.err);
    }
});

ipcRenderer.on("serialPortDisconnected", (event, args) => {
    const callbacks = connections.get(args.connectionId);
    if (callbacks) {
        callbacks.onDisconnected();
    }
});
