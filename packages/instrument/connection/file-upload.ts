import {
    getFileSizeInBytes,
    openFile,
    readFile,
    closeFile
} from "eez-studio-shared/util-electron";
import { Buffer } from "buffer";

import {
    activityLogStore,
    log,
    logUpdate,
    IActivityLogEntry
} from "instrument/window/history/activity-log";

import type { FileState } from "instrument/connection/file-state";
import { FileTransfer } from "instrument/connection/file-transfer";
import type { Connection } from "instrument/connection/connection-main";
import { detectFileType, SAMPLE_LENGTH } from "instrument/connection/file-type";

export interface IFileUploadInstructions {
    sourceFilePath?: string;
    sourceData?: string | ArrayBuffer | Buffer;
    sourceFileType?: string;

    destinationFileName: string;
    destinationFolderPath: string;

    shortFileName: boolean;
    startCommandTemplate: string;
    fileSizeCommandTemplate?: string;
    sendChunkCommandTemplate: string;
    finishCommandTemplate?: string;
    abortCommandTemplate?: string;
    chunkSize: number;

    favoriteDestinationPaths?: {
        ext?: string;
        path: string;
    }[];
}

export async function upload(
    oid: number,
    instructions: IFileUploadInstructions
) {}

function arrayBufferToBuffer(ab: ArrayBuffer): Buffer {
    var buffer = Buffer.alloc(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

export class FileUpload extends FileTransfer {
    fd: any | undefined;
    fileData: Buffer | undefined;
    fileDataLength: number;
    chunkIndex: number = 0;
    dataReceived: string;
    fileType: { ext?: string; mime: string } | string;
    dataSurplus: string | undefined;

    isQuery = false;

    constructor(
        connection: Connection,
        private instructions: IFileUploadInstructions,
        private onSuccessCallback?: () => void,
        private onErrorCallback?: (error: any) => void
    ) {
        super(connection);

        this.logEntry = {
            oid: this.connection.instrument.id,
            type: "instrument/file-upload",
            message: this.serializeState()
        };

        this.logId = log(activityLogStore, this.logEntry, {
            undoable: false
        });

        // load file
        // send start
        // send 1st chunk
        // send opc?
        // send 2nd chunk
        // send opc?
        // ...
        // send finish
        this.loadData();
    }

    onError() {
        if (this.instructions.abortCommandTemplate) {
            this.connection.send(this.instructions.abortCommandTemplate, {
                log: false,
                longOperation: true
            });
        }

        if (this.onErrorCallback) {
            this.onErrorCallback(
                this.state == "abort" ? "Aborted" : this.error
            );
        }
    }

    async loadData() {
        try {
            if (this.instructions.sourceFilePath) {
                this.fileDataLength = await getFileSizeInBytes(
                    this.instructions.sourceFilePath
                );
                this.fileData = Buffer.allocUnsafe(this.fileDataLength);
                this.fd = await openFile(this.instructions.sourceFilePath);
                let inputBuffer = Buffer.alloc(SAMPLE_LENGTH);
                let { buffer } = await readFile(
                    this.fd,
                    inputBuffer,
                    0,
                    SAMPLE_LENGTH,
                    0
                );
                const fileType = detectFileType(
                    buffer,
                    this.instructions.sourceFilePath
                );
                this.fileType = {
                    ext: fileType.ext,
                    mime: fileType.mime
                };
            } else {
                const sourceData = this.instructions.sourceData!;
                this.fileData =
                    typeof sourceData == "string"
                        ? Buffer.from(sourceData, "utf8")
                        : sourceData instanceof ArrayBuffer
                        ? arrayBufferToBuffer(sourceData)
                        : sourceData;
                this.fileDataLength = this.fileData.length;
                if (this.instructions.sourceFileType) {
                    this.fileType = this.instructions.sourceFileType;
                } else {
                    const fileType = detectFileType(
                        this.fileData,
                        this.instructions.destinationFileName
                    );
                    this.fileType = {
                        ext: fileType.ext,
                        mime: fileType.mime
                    };
                }
            }

            this.state = "init";
        } catch (err) {
            console.error(err);
            this.state = "error";
            this.error = "Can't read data from the file";
        }

        this.updateLog();

        this.start();
    }

    getDestinationFilePath() {
        let fileName = this.instructions.destinationFileName.trim();

        if (!this.instructions.destinationFolderPath) {
            return fileName;
        }

        let folderPath = this.instructions.destinationFolderPath.trim();
        if (!folderPath) {
            return fileName;
        }

        if (!folderPath.endsWith("/") && !folderPath.endsWith("\\")) {
            folderPath += "/";
        }

        return folderPath + fileName;
    }

    start() {
        let startCommand = this.instructions.startCommandTemplate.replace(
            "<file>",
            '"' + this.getDestinationFilePath() + '"'
        );

        startCommand += ";*OPC?";

        this.connection.send(startCommand, {
            log: false,
            longOperation: true
        });

        if (this.instructions.fileSizeCommandTemplate) {
            this.state = "upload-filesize";
        } else {
            this.state = "upload-start";
        }

        this.updateLog();
    }

    sendFileSize() {
        let fileSizeConmmand =
            this.instructions.fileSizeCommandTemplate!.replace(
                "<filesize>",
                this.fileDataLength.toString()
            );

        fileSizeConmmand += ";*OPC?";

        this.connection.send(fileSizeConmmand, {
            log: false,
            longOperation: true
        });

        this.state = "upload-start";

        this.updateLog();
    }

    getNextChunkBlockPosition() {
        return this.chunkIndex * this.instructions.chunkSize;
    }

    getNextChunkBlockLength() {
        return Math.min(
            this.instructions.chunkSize,
            this.fileDataLength - this.getNextChunkBlockPosition()
        );
    }

    getNextChunkBlockHeader() {
        let blockLength = this.getNextChunkBlockLength().toString();
        return "#" + blockLength.length.toString() + blockLength;
    }

    async getNextChunkBlockData() {
        let position = this.getNextChunkBlockPosition();
        let length = this.getNextChunkBlockLength();

        if (this.fd) {
            let inputBuffer = Buffer.allocUnsafe(length);

            let { bytesRead, buffer } = await readFile(
                this.fd,
                inputBuffer,
                0,
                length,
                position
            );

            if (bytesRead !== length) {
                return undefined;
            }

            buffer.copy(this.fileData!, position, 0, length);

            return buffer.toString("binary");
        } else {
            return this.fileData!.slice(position, position + length).toString(
                "binary"
            );
        }
    }

    async getNextChunkBlock() {
        return (
            this.getNextChunkBlockHeader() +
            (await this.getNextChunkBlockData())
        );
    }

    async sendChunk() {
        if (
            this.chunkIndex > 0 &&
            this.chunkIndex * this.instructions.chunkSize >= this.fileDataLength
        ) {
            this.finish();
        } else {
            let nextChunkBlock = await this.getNextChunkBlock();
            if (nextChunkBlock) {
                let sendChunkCommand =
                    this.instructions.sendChunkCommandTemplate.replace(
                        "<chunk>",
                        nextChunkBlock.replace(/\$/g, "$$$$")
                    );

                sendChunkCommand += ";*OPC?";

                this.connection.send(sendChunkCommand, {
                    log: false,
                    longOperation: true
                });

                this.chunkIndex++;
            } else {
                this.state = "error";
                this.error = "Can't read data from the file";
            }

            this.updateLog();
        }
    }

    finish() {
        if (this.instructions.finishCommandTemplate) {
            this.connection.send(
                this.instructions.finishCommandTemplate + ";" + "*OPC?",
                {
                    log: false,
                    longOperation: true
                }
            );
            this.state = "upload-finish";
        } else {
            this.state = "success";
        }
        this.updateLog();
    }

    async updateLog() {
        if (this.isDone() && this.fd) {
            await closeFile(this.fd);
            this.fd = undefined;
        }

        this.logEntry.message = this.serializeState();

        if (this.state === "success") {
            if (this.fileData) {
                this.logEntry.data = this.fileData;
                this.fileData = undefined;
            }

            if (this.onSuccessCallback) {
                this.onSuccessCallback();
                this.onSuccessCallback = undefined;
            }
        }

        if (this.state === "error") {
            if (this.onErrorCallback) {
                this.onErrorCallback(this.error);
                this.onErrorCallback = undefined;
            }
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

    onData(data: string) {
        this.testAbortFlag();

        if (this.isDone()) {
            return;
        }

        this.clearTimeout();

        if (!this.dataReceived) {
            this.dataReceived = data;
        } else {
            this.dataReceived += data;
        }

        while (true) {
            let line;

            let i = this.dataReceived.indexOf("\r");
            if (i !== -1) {
                line = this.dataReceived.substring(0, i);
                this.dataReceived = this.dataReceived.substring(i + 2);
            } else {
                i = this.dataReceived.indexOf("\n");
                if (i !== -1) {
                    line = this.dataReceived.substring(0, i);
                    this.dataReceived = this.dataReceived.substring(i + 1);
                }
            }

            if (!line) {
                break;
            }

            line.split(";").forEach(data => {
                let i = data.indexOf("**ERROR");
                if (i != -1) {
                    this.state = "upload-error";

                    i += 9;

                    let j = data.indexOf("\r");
                    if (j === -1) {
                        j = data.indexOf("\n");
                        if (j === -1) {
                            j = data.length;
                        }
                    }

                    this.error = data.substring(i, j);
                    this.updateLog();
                } else {
                    if (data === "1") {
                        if (this.state === "upload-filesize") {
                            this.sendFileSize();
                        } else if (this.state === "upload-start") {
                            this.state = "progress";
                            this.sendChunk();
                        } else if (this.state === "progress") {
                            this.sendChunk();
                        } else if (this.state === "upload-finish") {
                            this.state = "success";
                            this.updateLog();
                        } else if (this.state === "upload-error") {
                            this.state = "error";
                            this.updateLog();
                        }
                    } else {
                        this.connection.send("*OPC?", {
                            log: false,
                            longOperation: true
                        });
                    }
                }
            });
        }

        this.setTimeout();
    }

    serializeState() {
        let state = {
            state: this.state,
            sourceFilePath: this.instructions.sourceFilePath,
            fileType: this.fileType,
            destinationFilePath: this.getDestinationFilePath()
        } as FileState;

        if (this.state === "progress") {
            state.dataLength = Math.min(
                this.chunkIndex * this.instructions.chunkSize,
                this.fileDataLength
            );
            state.expectedDataLength = this.fileDataLength;
            this.updateTransferSpeed(state);
        } else if (this.state === "success") {
            state.dataLength = this.fileDataLength;
        } else if (this.state === "error" || this.state === "upload-error") {
            state.error = this.error;
        }

        return JSON.stringify(state);
    }
}
