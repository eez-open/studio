import { IActivityLogEntry } from "shared/activity-log";

import { Connection } from "instrument/connection/connection";
import { FileState, FileStateState } from "instrument/connection/file-state";

const CONF_FILE_TRANSFER_TIMEOUT_MS = 5 * 1000;

export abstract class FileTransfer {
    logId: string;
    logEntry: Partial<IActivityLogEntry>;
    state: FileStateState;
    error: string | undefined;
    dataTimeoutId: any;
    lastDataLength: number;
    lastTime: number;
    lastTransferSpeed: number;
    abortFlag: boolean;

    constructor(protected connection: Connection) {}

    isDone() {
        return (
            this.state === "success" ||
            this.state === "abort" ||
            this.state === "timeout" ||
            this.state === "error"
        );
    }

    abstract updateLog(): void;

    abort() {
        this.abortFlag = true;
    }

    onError() {}

    testAbortFlag() {
        if (!this.isDone() && this.abortFlag) {
            this.clearTimeout();
            if (this.state === "upload-error") {
                this.state = "error";
            } else {
                this.state = "abort";
                this.onError();
            }
            this.updateLog();
            return true;
        }
        return false;
    }

    clearTimeout() {
        if (this.dataTimeoutId) {
            clearTimeout(this.dataTimeoutId);
            this.dataTimeoutId = undefined;
        }
    }

    setTimeout() {
        if (!this.isDone()) {
            this.clearTimeout();

            this.dataTimeoutId = setTimeout(() => {
                this.dataTimeoutId = undefined;
                if (this.state === "upload-error") {
                    this.state = "error";
                } else {
                    this.state = "timeout";
                    this.onError();
                }
                this.updateLog();
            }, CONF_FILE_TRANSFER_TIMEOUT_MS);
        }
    }

    updateTransferSpeed(state: FileState) {
        let time = new Date().getTime();
        if (this.lastTransferSpeed !== undefined) {
            let timeSpan = time - this.lastTime;
            if (timeSpan >= 1000) {
                this.lastTransferSpeed = 1000 * (state.dataLength - this.lastDataLength) / timeSpan;
                this.lastDataLength = state.dataLength;
                this.lastTime = time;
            }
        } else {
            this.lastTransferSpeed = 0;
            this.lastDataLength = state.dataLength;
            this.lastTime = time;
        }
        state.transferSpeed = this.lastTransferSpeed;
    }
}
