import { computed, makeObservable } from "mobx";

import type { IActivityLogEntry } from "instrument/window/history/activity-log";

import type { IInstrumentObjectProps } from "instrument/instrument-object";
import type { ConnectionParameters } from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";
import type { IFileUploadInstructions } from "instrument/connection/file-upload";
import type { IResponseTypeType } from "instrument/scpi";

////////////////////////////////////////////////////////////////////////////////

export enum ConnectionState {
    IDLE,
    CONNECTING,
    TESTING,
    CONNECTED,
    DISCONNECTING
}

export interface ConnectionStatus {
    state: ConnectionState;
    errorCode: ConnectionErrorCode;
    error: string | undefined;
}

export interface ISendOptions {
    log?: boolean;
    longOperation?: boolean;
    queryResponseType?: IResponseTypeType;
}

export abstract class ConnectionBase {
    constructor(public instrument: IInstrumentObjectProps) {
        makeObservable(this, {
            isIdle: computed,
            isTransitionState: computed,
            isConnected: computed
        });
    }

    abstract get state(): ConnectionState;
    abstract get errorCode(): ConnectionErrorCode;
    abstract get error(): string | undefined;

    abstract dismissError(): void;

    get isIdle() {
        return this.state === ConnectionState.IDLE;
    }

    get isTransitionState() {
        return (
            this.state === ConnectionState.CONNECTING ||
            this.state === ConnectionState.TESTING ||
            this.state === ConnectionState.DISCONNECTING
        );
    }

    get isConnected() {
        return this.state === ConnectionState.CONNECTED;
    }

    abstract connect(connectionParameters?: ConnectionParameters): void;
    abstract disconnect(): void;
    abstract destroy(): void;
    abstract send(command: string, options?: ISendOptions): void;
    abstract doUpload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ): void;
    abstract abortLongOperation(): void;

    abstract doAcquire(
        instrumentId: string,
        acquireId: string,
        callbackWindowId: number,
        traceEnabled: boolean
    ): void;
    abstract doRelease(): void;

    // only in renderer
    abstract get interfaceInfo(): string | undefined;
    abstract acquire(traceEnabled: boolean): Promise<void>;
    abstract command(command: string): void;
    abstract query(query: string): Promise<any>;
    abstract upload(
        instructions: IFileUploadInstructions,
        onSuccess?: () => void,
        onError?: (error: any) => void
    ): void;
    abstract release(): void;
}

export type IConnection = ConnectionBase;

export interface LongOperation {
    logId: string;
    logEntry: Partial<IActivityLogEntry>;
    abort(): void;
    onData(data: string): void;
    isDone(): boolean;
    dataSurplus: string | undefined;
    isQuery: boolean;
}
