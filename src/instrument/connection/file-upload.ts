import { log, logUpdate, IActivityLogEntry } from "shared/activity-log";

import { FileState } from "instrument/connection/file-state";
import { FileTransfer } from "instrument/connection/file-transfer";
import { Connection } from "instrument/connection/connection";
import { detectFileType, convertToPng } from "instrument/connection/file-type";

export class FileUpload extends FileTransfer {
    fileType: string;
    data: string;
    expectedDataLength: number;
    dataSurplus: string | undefined;

    constructor(connection: Connection, data: string) {
        super(connection);

        this.data = data;

        this.updateState();

        this.logEntry = {
            oid: connection.instrument.id,
            type: "instrument/file",
            message: this.serializeState()
        };

        if (this.state === "success") {
            this.logEntry.data = new Buffer(this.data, "binary");
        }

        this.logId = log(this.logEntry, {
            undoable: false
        });
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

        logUpdate(logEntryChanges, {
            undoable: false
        });
    }

    updateState() {
        if (this.state === undefined) {
            this.state = "init";
        }

        if (this.state === "init") {
            if (this.data.length >= 2) {
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
                }

                this.data = this.data.substr(0, this.expectedDataLength);

                let fileType = detectFileType(this.data);
                if (fileType.mime === "image/bmp") {
                    fileType = "image/png";
                    this.data = convertToPng(this.data);
                }

                this.fileType = fileType;

                this.state = "success";
            }
        }
    }

    serializeState() {
        let state = {
            direction: "upload",
            state: this.state
        } as FileState;

        if (this.state === "progress") {
            state.dataLength = this.data.length;
            state.expectedDataLength = this.expectedDataLength;
            this.updateTransferSpeed(state);
        } else if (this.state === "success") {
            state.dataLength = this.expectedDataLength;
            state.fileType = this.fileType;
        } else if (this.state === "error") {
            state.error = this.error;
        }

        return JSON.stringify(state);
    }
}
