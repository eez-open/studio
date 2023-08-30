import { ConnectionErrorCode } from "./ConnectionErrorCode";

export interface EthernetConnectionParameters {
    address: string;
    port: number;
}

export interface SerialConnectionParameters {
    port: string;
    baudRate: number;
    dataBits: 8 | 7 | 6 | 5;
    stopBits: 1 | 2;
    parity: "none" | "even" | "mark" | "odd" | "space";
    flowControl: "none" | "xon/xoff" | "rts/cts";
}

export interface UsbtmcConnectionParameters {
    idVendor: number;
    idProduct: number;
}

export interface VisaConnectionParameters {
    resource: string;
}

export interface WebSimulatorParameters {
    id: string;
}

export interface ConnectionParameters {
    type: "ethernet" | "serial" | "usbtmc" | "visa" | "web-simulator";

    ethernetParameters: EthernetConnectionParameters;
    serialParameters: SerialConnectionParameters;
    usbtmcParameters: UsbtmcConnectionParameters;
    visaParameters: VisaConnectionParameters;
    webSimulatorParameters: WebSimulatorParameters;

    timeout: number;
    delay: number;
}

export interface CommunicationInterfaceHost {
    connectionParameters: ConnectionParameters;
    setError(errorCode: ConnectionErrorCode, error: string | undefined): void;
    connected(): void;
    onData(data: string, endIndicatorReceived?: boolean | undefined): void;
    disconnected(): void;
}

export interface CommunicationInterface {
    connect(): void;
    isConnected(): boolean;
    write(data: string): void;
    disconnect(): void;
}
