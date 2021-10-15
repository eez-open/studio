import { ConnectionErrorCode } from "./ConnectionErrorCode";

export interface EthernetConnectionParameters {
    address: string;
    port: number;
}

export interface SerialConnectionParameters {
    port: string;
    baudRate: number;
}

export interface UsbtmcConnectionParameters {
    idVendor: number;
    idProduct: number;
}

export interface ConnectionParameters {
    type: "ethernet" | "serial" | "usbtmc";
    ethernetParameters: EthernetConnectionParameters;
    serialParameters: SerialConnectionParameters;
    usbtmcParameters: UsbtmcConnectionParameters;
}

export interface CommunicationInterfaceHost {
    connectionParameters: ConnectionParameters;
    setError(errorCode: ConnectionErrorCode, error: string | undefined): void;
    connected(): void;
    onData(data: string): void;
    disconnected(): void;
}

export interface CommunicationInterface {
    connect(): void;
    isConnected(): boolean;
    write(data: string): void;
    disconnect(): void;
}
