import {
    activityLogStore,
    log,
    logUpdate,
    IActivityLogEntry
} from "eez-studio-shared/activity-log";

import { FileState } from "instrument/connection/file-state";
import { FileTransfer } from "instrument/connection/file-transfer";
import { Connection } from "instrument/connection/connection";
import { detectFileType, convertBmpToPng } from "instrument/connection/file-type";

const CONF_FILE_TRANSFER_TIMEOUT_FOR_ARBITRARY_BLOCK_MS = 2500;

export class FileDownload extends FileTransfer {
    fileType:
        | {
              ext?: string;
              mime: string;
          }
        | string;
    data: string;
    expectedDataLength: number;
    dataSurplus: string | undefined;
    note: string | undefined;

    isQuery = true;

    constructor(connection: Connection, data: string, private arbitraryBlock?: boolean) {
        super(connection);

        this.data = data;

        this.updateState();

        this.logEntry = {
            oid: connection.instrument.id,
            type: "instrument/file-download",
            message: this.serializeState()
        };

        if (this.state === "success") {
            this.logEntry.data = new Buffer(this.data, "binary");
        }

        this.logId = log(activityLogStore, this.logEntry, {
            undoable: false
        });

        this.setTimeout();
    }

    get timeoutMs() {
        return this.arbitraryBlock
            ? CONF_FILE_TRANSFER_TIMEOUT_FOR_ARBITRARY_BLOCK_MS
            : super.timeoutMs;
    }

    handleTimeout() {
        if (!this.arbitraryBlock) {
            return false;
        }

        this.expectedDataLength = this.data.length;
        this.updateState();
        this.updateLog();
        return true;
    }

    onData(data: string) {
        this.testAbortFlag();
        if (this.isDone()) {
            if (this.dataSurplus) {
                this.dataSurplus += data;
            } else {
                this.dataSurplus = data;
            }
            return;
        }

        this.clearTimeout();

        this.data += data;

        this.updateState();
        this.updateLog();
        this.setTimeout();
    }

    updateLog() {
        this.logEntry.message = this.serializeState();

        if (this.state === "success") {
            this.logEntry.data = new Buffer(this.data, "binary");
        }

        let logEntryChanges: Partial<IActivityLogEntry> = {
            id: this.logId,
            oid: this.connection.instrument.id,
            message: this.logEntry.message
        };

        if ("data" in this.logEntry) {
            logEntryChanges.data = this.logEntry.data;
        }

        logUpdate(activityLogStore, logEntryChanges, {
            undoable: false
        });
    }

    updateState() {
        if (this.state === undefined) {
            this.state = "init";
        }

        if (this.state === "init") {
            if (this.arbitraryBlock) {
                this.state = "progress";
            } else {
                let n = parseInt(this.data[1]);
                if (isNaN(n)) {
                    this.state = "error";
                    this.error = "Expected the number of decimal digits";
                } else {
                    if (this.data.length >= 2 + n) {
                        let followLength = parseInt(this.data.substr(2, n));
                        if (isNaN(followLength)) {
                            this.state = "error";
                            this.error = "Expected the number of data bytes to follow";
                        } else {
                            this.expectedDataLength = followLength;
                            this.data = this.data.substr(2 + n);
                            this.state = "progress";
                        }
                    }
                }
            }
        }

        if (this.state === "progress") {
            if (this.data.length >= this.expectedDataLength) {
                if (this.data.length > this.expectedDataLength) {
                    this.dataSurplus = this.data.substr(this.expectedDataLength);
                    let i = this.dataSurplus.indexOf("\n");
                    if (i !== -1) {
                        this.dataSurplus = this.dataSurplus.substr(i + 1);
                        if (this.dataSurplus.length === 0) {
                            this.dataSurplus = undefined;
                        }
                    }

                    if (
                        this.dataSurplus &&
                        this.dataSurplus.length === 1 &&
                        this.dataSurplus.charCodeAt(0) === 0
                    ) {
                        this.dataSurplus = undefined;
                    }
                }

                this.data = this.data.substr(0, this.expectedDataLength);

                let fileType = detectFileType(this.data);
                if (fileType.mime === "image/bmp") {
                    convertBmpToPng(this.data)
                        .then(data => {
                            this.data = data;
                            this.fileType = "image/png";
                            this.state = "success";
                            this.updateLog();
                            this.clearTimeout();
                        })
                        .catch(err => {
                            console.error(err);
                            this.fileType = fileType;
                            this.state = "success";
                            this.updateLog();
                            this.clearTimeout();
                        });
                } else {
                    if (fileType.comment) {
                        this.note = JSON.stringify([{ insert: fileType.comment }]);
                        delete fileType.comment;
                    }

                    this.fileType = fileType;
                    this.state = "success";
                }
            }
        }

        return true;
    }

    serializeState() {
        let state = {
            state: this.state,
            note: this.note
        } as FileState;

        if (this.state === "progress") {
            state.dataLength = this.data.length;
            state.expectedDataLength = this.expectedDataLength;
            this.updateTransferSpeed(state);
        } else if (this.state === "success") {
            state.dataLength = this.data.length;
            state.fileType = this.fileType;
        } else if (this.state === "error") {
            state.error = this.error;
        }

        return JSON.stringify(state);
    }
}
