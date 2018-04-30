export enum ConnectionErrorCode {
    NONE,
    NOT_FOUND,
    CLOSED_BY_INSTRUMENT,
    UNKNOWN
}

export interface EthernetConnectionParameters {
    address: string;
    port: number;
}

export interface SerialConnectionParameters {
    port: string;
    baudRate: number;
}

export interface ConnectionParameters {
    type: "ethernet" | "serial";
    ethernetParameters: EthernetConnectionParameters;
    serialParameters: SerialConnectionParameters;
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
    write(data: string): void;
    disconnect(): void;
}
