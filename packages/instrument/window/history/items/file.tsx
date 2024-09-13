import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import { clipboard, nativeImage, SaveDialogOptions } from "electron";

import {
    formatTransferSpeed,
    formatDateTimeLong
} from "eez-studio-shared/util";
import {
    writeBinaryData,
    getFileName,
    getFileNameWithoutExtension,
    getTempDirPath,
    fileExists
} from "eez-studio-shared/util-electron";
import { formatBytes } from "eez-studio-shared/formatBytes";

import * as notification from "eez-studio-ui/notification";

import type { IStore } from "eez-studio-shared/store";
import { SAMPLING_RATE_UNIT } from "eez-studio-shared/units";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction, TextAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import pdfToPng from "pdf-services/pdf-to-png";

import { IActivityLogEntry } from "instrument/window/history/activity-log";

import { FileState } from "instrument/connection/file-state";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { HistoryItemPreview } from "instrument/window/history/item-preview";

import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { PLOTTER_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const ImagePreview = observer(
    class ImagePreview extends React.Component<{
        src: string;
    }> {
        zoom: boolean = false;

        constructor(props: { src: string }) {
            super(props);

            makeObservable(this, {
                zoom: observable,
                toggleZoom: action.bound
            });
        }

        toggleZoom() {
            this.zoom = !this.zoom;
        }

        render() {
            return (
                <HistoryItemPreview
                    className="EezStudio_ImagePreview"
                    zoom={this.zoom}
                    toggleZoom={this.toggleZoom}
                    enableUnzoomWithEsc={true}
                >
                    <img
                        src={this.props.src}
                        onClick={this.zoom ? this.toggleZoom : undefined}
                        draggable="false"
                    />
                </HistoryItemPreview>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

// TODO create temp dir in main process
let getPdfTempDirPathPromise = getTempDirPath();

const PdfPreview = observer(
    class PdfPreview extends React.Component<{
        historyItem: HistoryItem;
    }> {
        thumbnail: string;
        url: string;
        zoom: boolean = false;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                thumbnail: observable,
                url: observable,
                zoom: observable,
                toggleZoom: action.bound
            });
        }

        toggleZoom() {
            this.zoom = !this.zoom;
        }

        update() {
            if (this.zoom) {
                if (!this.url) {
                    (async () => {
                        const [tempDirPath] = await getPdfTempDirPathPromise;
                        const tempFilePath =
                            tempDirPath +
                            "/" +
                            this.props.historyItem.id +
                            ".pdf";
                        let exists = await fileExists(tempFilePath);
                        if (!exists) {
                            await writeBinaryData(
                                tempFilePath,
                                this.props.historyItem.data
                            );
                        }
                        return new URL(`file:///${tempFilePath}`).href;
                    })().then(
                        action((url: string) => {
                            this.url = url;
                        })
                    );
                }
            } else {
                if (!this.thumbnail) {
                    pdfToPng(this.props.historyItem.data)
                        .then(result => {
                            runInAction(() => (this.thumbnail = result));
                        })
                        .catch(error => {
                            console.error("PDF to PNG error", error);
                        });
                }
            }
        }

        componentDidMount() {
            this.update();
        }

        componentDidUpdate() {
            this.update();
        }

        render() {
            let content;

            if (this.zoom) {
                content = this.url && (
                    <webview
                        src={
                            "../../libs/pdfjs/web/viewer.html?file=" +
                            encodeURIComponent(this.url)
                        }
                        tabIndex={this.zoom ? 0 : undefined}
                    />
                );
            } else {
                content = (
                    <img
                        src={this.thumbnail || "../instrument/_images/pdf.png"}
                    />
                );
            }

            return (
                <HistoryItemPreview
                    className="EezStudio_PdfPreview"
                    zoom={this.zoom}
                    toggleZoom={this.toggleZoom}
                    enableUnzoomWithEsc={true}
                >
                    {content}
                </HistoryItemPreview>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const FileHistoryItemComponent = observer(
    class FileHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: FileHistoryItem;
        },
        {}
    > {
        setVisibleTimeoutId: any;

        onAbortFileTransfer = () => {
            this.props.appStore.instrument.connection.abortLongOperation();
        };

        onSave = async () => {
            let filters = [];

            let fileExtension = this.props.historyItem.fileExtension;

            if (fileExtension) {
                fileExtension = fileExtension.toLowerCase();
                filters.push({
                    name: fileExtension.toUpperCase() + " Files",
                    extensions: [fileExtension]
                });
            }

            filters.push({ name: "All Files", extensions: ["*"] });

            let options: SaveDialogOptions = { filters };
            if (this.props.historyItem.sourceFilePath) {
                options.defaultPath = getFileName(
                    this.props.historyItem.sourceFilePath
                );
            }

            const result = await dialog.showSaveDialog(
                getCurrentWindow(),
                options
            );

            let filePath = result.filePath;
            if (filePath) {
                if (
                    fileExtension &&
                    !filePath.toLowerCase().endsWith(fileExtension)
                ) {
                    filePath += "." + fileExtension;
                }

                await writeBinaryData(filePath, this.props.historyItem.data);
                notification.success(`Saved as "${filePath}"`);
            }
        };

        onSaveAsCsvInProgress = false;

        onSaveAsCsv = async () => {
            const convertToCsv = this.props.historyItem.convertToCsv;
            if (!convertToCsv) {
                return;
            }

            if (this.onSaveAsCsvInProgress) {
                return;
            }

            runInAction(() => (this.onSaveAsCsvInProgress = true));

            let data = await convertToCsv();

            if (!data) {
                notification.error(`Failed to convert to CSV!`);
                runInAction(() => (this.onSaveAsCsvInProgress = false));
                return;
            }

            let options: SaveDialogOptions = {
                filters: [
                    {
                        name: "CSV Files",
                        extensions: ["csv"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ]
            };
            if (this.props.historyItem.sourceFilePath) {
                options.defaultPath = getFileNameWithoutExtension(
                    this.props.historyItem.sourceFilePath
                );
            }

            const result = await dialog.showSaveDialog(
                getCurrentWindow(),
                options
            );

            let filePath = result.filePath;
            if (filePath) {
                if (!filePath.toLowerCase().endsWith("csv")) {
                    filePath += ".csv";
                }

                try {
                    await writeBinaryData(filePath, data);
                    notification.success(`Saved as "${filePath}"`);
                } catch (err) {
                    console.error(err);
                    notification.error(err.toString());
                }
            }

            runInAction(() => (this.onSaveAsCsvInProgress = false));
        };

        onCopy = () => {
            if (this.props.historyItem.isImage) {
                let image = nativeImage.createFromBuffer(
                    Buffer.from(this.props.historyItem.data, "binary")
                );
                clipboard.writeImage(image);
                notification.success("Image copied to the clipboard");
            } else if (this.props.historyItem.isText) {
                clipboard.writeText(this.props.historyItem.data.toString());
                notification.success("Text copied to the clipboard");
            }
        };

        constructor(props: {
            appStore: IAppStore;
            historyItem: FileHistoryItem;
        }) {
            super(props);

            makeObservable(this, {
                onSaveAsCsvInProgress: observable
            });
        }

        getDirectionInfo() {
            if (this.props.historyItem.direction === "upload") {
                return "Sending file ...";
            } else if (this.props.historyItem.direction === "download") {
                return "Receiving file ...";
            } else if (this.props.historyItem.direction === "plotter") {
                return "Waiting for data ...";
            } else {
                return "Attaching file ...";
            }
        }

        render() {
            let body;
            if (
                !this.props.historyItem.state ||
                this.props.historyItem.state === "init" ||
                this.props.historyItem.state === "upload-filesize" ||
                this.props.historyItem.state === "upload-start"
            ) {
                body = <div>{this.getDirectionInfo()}</div>;
            } else if (this.props.historyItem.state === "progress") {
                let percent = this.props.historyItem.expectedDataLength
                    ? Math.floor(
                          (100 * this.props.historyItem.dataLength) /
                              this.props.historyItem.expectedDataLength
                      )
                    : 0;
                let progress;
                if (this.props.historyItem.expectedDataLength) {
                    let transferSpeed = formatTransferSpeed(
                        this.props.historyItem.transferSpeed
                    );
                    progress = `${percent}% (${this.props.historyItem.dataLength} of ${this.props.historyItem.expectedDataLength}) ${transferSpeed}`;
                } else {
                    progress = `${this.props.historyItem.dataLength} bytes`;
                }
                body = (
                    <div>
                        <div>{this.getDirectionInfo()}</div>
                        <div>{progress}</div>
                        {this.props.historyItem.direction === "upload" && (
                            <Toolbar>
                                <TextAction
                                    text="Abort"
                                    title="Abort file transfer"
                                    onClick={this.onAbortFileTransfer}
                                />
                            </Toolbar>
                        )}
                    </div>
                );
            } else if (
                this.props.historyItem.state === "error" ||
                this.props.historyItem.state === "upload-error"
            ) {
                body = (
                    <div className="text-danger">
                        <div>Failed!</div>
                        <div>{this.props.historyItem.error}</div>
                    </div>
                );
            } else if (this.props.historyItem.state === "timeout") {
                body = (
                    <div className="text-danger">
                        <div>Timeout!</div>
                    </div>
                );
            } else if (this.props.historyItem.state === "abort") {
                body = (
                    <div className="text-danger">
                        <div>Aborted!</div>
                    </div>
                );
            } else if (this.props.historyItem.transferSucceeded) {
                let preview: JSX.Element | null = null;
                let actions;

                if (this.props.historyItem.fileType) {
                    preview = this.props.historyItem.getPreviewElement(
                        this.props.appStore
                    );

                    if (this.props.historyItem.state !== "live") {
                        actions = (
                            <Toolbar>
                                {this.props.historyItem.direction !=
                                    "plotter" && (
                                    <IconAction
                                        icon="material:save"
                                        title="Save file"
                                        onClick={this.onSave}
                                    />
                                )}
                                {this.props.historyItem.convertToCsv && (
                                    <IconAction
                                        icon="material:save"
                                        title="Save as CSV file"
                                        onClick={this.onSaveAsCsv}
                                        overlayText={"CSV"}
                                        enabled={!this.onSaveAsCsvInProgress}
                                    />
                                )}
                                {(this.props.historyItem.isImage ||
                                    this.props.historyItem.isText) && (
                                    <IconAction
                                        icon="material:content_copy"
                                        title="Copy to clipboard"
                                        onClick={this.onCopy}
                                    />
                                )}
                                {this.props.historyItem.renderAddNoteAction(
                                    this.props.appStore
                                )}
                                {this.props.historyItem.renderAddMediaNoteAction(
                                    this.props.appStore
                                )}
                            </Toolbar>
                        );
                    }
                }

                body = (
                    <div>
                        <div className="EezStudio_HistoryItemText mb-1">
                            {this.props.historyItem.sourceFilePath && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center"
                                    }}
                                >
                                    <div>
                                        {this.props.historyItem.sourceFilePath}
                                    </div>
                                    {this.props.historyItem
                                        .destinationFilePath && (
                                        <React.Fragment>
                                            <Icon icon="material:arrow_forward" />
                                            <div>
                                                {
                                                    this.props.historyItem
                                                        .destinationFilePath
                                                }
                                            </div>
                                        </React.Fragment>
                                    )}
                                </div>
                            )}
                            <div className="mb-1">
                                {(this.props.historyItem.fileTypeAsDisplayString
                                    ? this.props.historyItem
                                          .fileTypeAsDisplayString + ", "
                                    : "") +
                                    formatBytes(
                                        this.props.historyItem.fileLength
                                    )}
                            </div>
                            {this.props.historyItem.description}
                        </div>
                        {preview}
                        {actions}
                        {this.props.historyItem.renderNote(this.props.appStore)}
                        {this.props.historyItem.renderMediaNote(
                            this.props.appStore
                        )}
                    </div>
                );
            } else {
                body = this.props.historyItem.state;
            }

            return (
                <div className="EezStudio_FileHistoryItem">
                    <Icon
                        className="me-3"
                        icon={
                            this.props.historyItem.direction === "upload"
                                ? "material:file_upload"
                                : this.props.historyItem.direction ===
                                  "download"
                                ? "material:file_download"
                                : this.props.historyItem.direction === "plotter"
                                ? PLOTTER_ICON
                                : "material:attach_file"
                        }
                        size={48}
                    />
                    <div>
                        <p>
                            <HistoryItemInstrumentInfo
                                appStore={this.props.appStore}
                                historyItem={this.props.historyItem}
                            />
                            <small className="EezStudio_HistoryItemDate">
                                {formatDateTimeLong(
                                    this.props.historyItem.date
                                )}
                            </small>
                        </p>
                        {this.props.historyItem.getSourceDescriptionElement(
                            this.props.appStore
                        )}
                        {body}
                    </div>
                </div>
            );
        }
    }
);

export class FileHistoryItem extends HistoryItem {
    constructor(store: IStore, activityLogEntry: IActivityLogEntry) {
        super(store, activityLogEntry);

        makeObservable(this, {
            fileState: computed,
            fileLength: computed,
            fileType: computed,
            fileTypeAsDisplayString: computed,
            sourceFilePath: computed,
            destinationFilePath: computed,
            isImage: computed,
            isPdf: computed,
            isText: computed,
            direction: computed,
            state: computed,
            transferSucceeded: computed,
            expectedDataLength: computed,
            dataLength: computed,
            transferSpeed: computed,
            error: computed,
            description: computed
        });
    }

    get info() {
        return (
            <React.Fragment>
                {this.fileTypeAsDisplayString && (
                    <div className="plain-text">
                        {this.fileTypeAsDisplayString + " file"}
                    </div>
                )}
                {this.renderNoteInfo()}
            </React.Fragment>
        );
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <FileHistoryItemComponent appStore={appStore!} historyItem={this} />
        );
    }

    getPreviewElement(appStore: IAppStore): JSX.Element | null {
        if (!this.data) {
            return null;
        }

        if (this.isImage) {
            let imageData =
                "data:image/" +
                this.fileExtension +
                ";base64," +
                Buffer.from(this.data, "binary").toString("base64");
            return <ImagePreview src={imageData} />;
        } else if (this.isPdf) {
            return <PdfPreview historyItem={this} />;
        }
        return null;
    }

    get fileState() {
        return this.messageObject as FileState;
    }

    get fileLength() {
        if (typeof this.fileState.dataLength === "number") {
            return this.fileState.dataLength;
        }

        if (this.data) {
            return this.data.length;
        }

        return 0;
    }

    get fileType() {
        return this.fileState.fileType;
    }

    get fileTypeAsDisplayString() {
        if (!this.fileType) {
            return "unknown";
        }

        if (typeof this.fileType === "string") {
            return this.fileType;
        }

        if (this.direction === "plotter") {
            return undefined;
        }

        return this.fileType.mime;
    }

    get fileExtension() {
        let fileExtension;
        if (typeof this.fileType === "string") {
            if (this.fileType === "image") {
                fileExtension = "png";
            } else if (this.fileType.startsWith("image/")) {
                fileExtension = this.fileType.slice("image/".length);
            } else if (this.fileType === "CSV") {
                fileExtension = "csv";
            }
        } else {
            fileExtension = this.fileType.ext;
        }
        return fileExtension;
    }

    get sourceFilePath() {
        return this.fileState.sourceFilePath;
    }

    get destinationFilePath() {
        return this.fileState.destinationFilePath;
    }

    get isImage() {
        if (!this.fileType) {
            return false;
        }

        if (typeof this.fileType === "string") {
            return this.fileType.startsWith("image");
        }

        return this.fileType.mime.startsWith("image");
    }

    get isPdf() {
        if (!this.fileType) {
            return false;
        }

        if (typeof this.fileType === "string") {
            return this.fileType.startsWith("application/pdf");
        }

        return this.fileType.mime.startsWith("application/pdf");
    }

    get isText() {
        if (!this.fileType) {
            return false;
        }

        if (typeof this.fileType === "string") {
            return this.fileType === "CSV";
        }

        return this.fileType.mime.startsWith("text");
    }

    get direction() {
        if (this.type === "instrument/file-download") {
            return "download";
        }
        if (this.type === "instrument/file-upload") {
            return "upload";
        }
        if (this.type === "instrument/plotter") {
            return "plotter";
        }
        return "attachment";
    }

    get state() {
        return this.fileState.state;
    }

    get transferSucceeded() {
        return (
            this.state === "success" ||
            this.state === "upload-finish" ||
            this.state == "live"
        );
    }

    get expectedDataLength() {
        return this.fileState.expectedDataLength;
    }

    get dataLength() {
        return this.fileState.dataLength;
    }

    get transferSpeed() {
        return this.fileState.transferSpeed;
    }

    get error() {
        return this.fileState.error;
    }

    get description() {
        if (!this.fileState.description) {
            return null;
        }

        let index = this.fileState.description.indexOf(", Preamble:");
        if (index === -1) {
            return <p>{this.fileState.description}</p>;
        }

        let firstRow = this.fileState.description.slice(0, index);

        try {
            // add unit to sample rate
            firstRow = firstRow.replace(
                /(.*Sampling rate: )(.*)/,
                (match, a, b) => {
                    return (
                        a +
                        SAMPLING_RATE_UNIT.formatValue(parseFloat(b), 0, " ")
                    );
                }
            );
        } catch (err) {
            console.error(err);
        }

        let secondRow = this.fileState.description
            .slice(index + 2)
            .split(",")
            .join(", ");

        return (
            <React.Fragment>
                <p>{firstRow}</p>
                <p>{secondRow}</p>
            </React.Fragment>
        );
    }

    convertToCsv?: () => Promise<string | Buffer | undefined> | undefined =
        undefined;
}
