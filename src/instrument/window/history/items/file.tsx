import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { clipboard, nativeImage, SaveDialogOptions } from "electron";
import * as VisibilitySensor from "react-visibility-sensor";
import { bind } from "bind-decorator";

import {
    writeBinaryData,
    formatTransferSpeed,
    getFileName,
    formatBytes,
    formatDateTimeLong,
    getTempDirPath,
    fileExists
} from "shared/util";

import * as notification from "shared/ui/notification";

import { beginTransaction, commitTransaction } from "shared/store";
import { SAMPLING_RATE_UNIT } from "shared/units";
import { IActivityLogEntry, logUpdate } from "shared/activity-log";

import * as UiPropertiesModule from "shared/ui/properties";
import { Balloon } from "shared/ui/balloon";
import { PropertyList, StaticRichTextProperty } from "shared/ui/properties";
import { Toolbar } from "shared/ui/toolbar";
import { IconAction, TextAction } from "shared/ui/action";
import { Icon } from "shared/ui/icon";
import * as UiBalloonModule from "shared/ui/balloon";

import { FileState } from "instrument/connection/file-state";

import { showAddNoteDialog, showEditNoteDialog } from "instrument/window/note-dialog";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { HistoryItemPreview } from "instrument/window/history/item-preview";

////////////////////////////////////////////////////////////////////////////////

@observer
class ImagePreview extends React.Component<{
    src: string;
}> {
    preview: HistoryItemPreview | null;

    @bind
    toggleZoom(event: React.MouseEvent<HTMLElement>) {
        if (this.preview) {
            this.preview.toggleZoom(event);
        }
    }

    render() {
        return (
            <HistoryItemPreview
                ref={ref => (this.preview = ref)}
                className="EezStudio_ImagePreview"
            >
                <img src={this.props.src} onClick={this.toggleZoom} />
            </HistoryItemPreview>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

// TODO create temp dir in main process
let getPdfTempDirPathPromise = getTempDirPath();

@observer
class PdfPreview extends React.Component<{
    data: any;
    fileName: string;
}> {
    @observable url: string;
    preview: HistoryItemPreview | null;
    iframe: HTMLIFrameElement | null;

    get zoom() {
        return this.preview && this.preview.zoom;
    }

    @computed
    get urlWithParams() {
        if (!this.url) {
            return "";
        }

        if (this.zoom) {
            return this.url;
        }

        return this.url + "#view=FitV&toolbar=0";
    }

    componentDidMount() {
        (async () => {
            const tempDirPath = await getPdfTempDirPathPromise;
            const tempFilePath = tempDirPath + "/" + this.props.fileName;
            let exists = await fileExists(tempFilePath);
            if (!exists) {
                await writeBinaryData(tempFilePath, this.props.data);
            }
            return new URL(`file:///${tempFilePath}`).href;
        })().then(action((url: string) => (this.url = url)));

        if (this.zoom && this.iframe) {
            this.iframe.focus();
        }
    }

    componentDidUpdate() {
        if (this.zoom && this.iframe) {
            this.iframe.focus();
        }
    }

    render() {
        return (
            <HistoryItemPreview ref={ref => (this.preview = ref)} className="EezStudio_PdfPreview">
                <iframe
                    ref={ref => (this.iframe = ref)}
                    src={this.urlWithParams}
                    tabIndex={this.zoom ? 0 : undefined}
                />
            </HistoryItemPreview>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class FileHistoryItemComponent extends React.Component<
    {
        appStore: IAppStore;
        historyItem: FileHistoryItem;
    },
    {}
> {
    element: HTMLDivElement | null;

    @action.bound
    onVisibilityChange(isVisible: boolean) {
        this.props.historyItem.isVisible = isVisible;
    }

    @bind
    onAbortFileTransfer() {
        this.props.appStore.instrument!.connection.abortLongOperation();
    }

    @bind
    onAddNote() {
        showAddNoteDialog(note => {
            beginTransaction("Add file note");
            this.props.historyItem.note = note;
            commitTransaction();
        });
    }

    @bind
    onEditNote() {
        showEditNoteDialog(this.props.historyItem.note!, note => {
            if (this.props.historyItem.note !== note) {
                beginTransaction("Edit file note");
                this.props.historyItem.note = note;
                commitTransaction();
            }
        });
    }

    @bind
    onDeleteNote() {
        beginTransaction("Delete file note");
        this.props.historyItem.note = undefined;
        commitTransaction();
    }

    @bind
    onSave() {
        let filters = [];

        let fileExtension = this.props.historyItem.fileExtension;

        if (fileExtension) {
            filters.push({
                name: fileExtension.toUpperCase() + " Files",
                extensions: [fileExtension]
            });
        }

        filters.push({ name: "All Files", extensions: ["*"] });

        let options: SaveDialogOptions = {
            filters: filters
        };
        if (this.props.historyItem.sourceFilePath) {
            options.defaultPath = getFileName(this.props.historyItem.sourceFilePath);
        }

        EEZStudio.electron.remote.dialog.showSaveDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            options,
            async (filePath: any) => {
                if (filePath) {
                    await writeBinaryData(filePath, this.props.historyItem.data);
                    notification.success(`Saved to "${filePath}"`);
                }
            }
        );
    }

    @bind
    onCopy() {
        if (this.props.historyItem.isImage) {
            let image = nativeImage.createFromBuffer(
                Buffer.from(this.props.historyItem.data, "binary")
            );
            clipboard.writeImage(image);
            notification.success("Image copied to the clipboard");
        } else if (this.props.historyItem.isText) {
            clipboard.writeText(this.props.historyItem.data);
            notification.success("Text copied to the clipboard");
        }
    }

    getDirectionInfo() {
        if (this.props.historyItem.direction === "upload") {
            return "Sending file ...";
        } else if (this.props.historyItem.direction === "download") {
            return "Receiving file ...";
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
            let transferSpeed = formatTransferSpeed(this.props.historyItem.transferSpeed);
            body = (
                <div>
                    <div>{this.getDirectionInfo()}</div>
                    <div>
                        {`${percent}% (${this.props.historyItem.dataLength} of ${
                            this.props.historyItem.expectedDataLength
                        }) ${transferSpeed}`}
                    </div>
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
                preview = this.props.historyItem.previewElement;

                actions = (
                    <Toolbar>
                        <IconAction icon="material:save" title="Save file" onClick={this.onSave} />
                        <IconAction
                            icon="material:content_copy"
                            title="Copy to clipboard"
                            onClick={this.onCopy}
                        />
                        {!this.props.historyItem.note && (
                            <IconAction
                                icon="material:comment"
                                title="Add note"
                                onClick={this.onAddNote}
                            />
                        )}
                    </Toolbar>
                );
            }

            let note;
            if (this.props.historyItem.note) {
                note = (
                    <div
                        className="EezStudio_HistoryItem_File_Note"
                        onDoubleClick={this.onEditNote}
                    >
                        <Balloon>
                            <PropertyList>
                                <StaticRichTextProperty value={this.props.historyItem.note} />
                            </PropertyList>
                        </Balloon>
                        <Toolbar>
                            <IconAction
                                icon="material:edit"
                                title="Edit note"
                                onClick={this.onEditNote}
                            />
                            <IconAction
                                icon="material:delete"
                                title="Delete note"
                                onClick={this.onDeleteNote}
                            />
                        </Toolbar>
                    </div>
                );
            }

            body = (
                <div>
                    <div className="EezStudio_HistoryItemText mb-1">
                        {this.props.historyItem.sourceFilePath && (
                            <div style={{ display: "flex", alignItems: "center" }}>
                                <div>{this.props.historyItem.sourceFilePath}</div>
                                {this.props.historyItem.destinationFilePath && (
                                    <React.Fragment>
                                        <Icon icon="material:arrow_forward" />
                                        <div>{this.props.historyItem.destinationFilePath}</div>
                                    </React.Fragment>
                                )}
                            </div>
                        )}
                        <div className="mb-1">
                            {this.props.historyItem.fileTypeAsDisplayString +
                                ", " +
                                formatBytes(this.props.historyItem.fileLength)}
                        </div>
                        {this.props.historyItem.description}
                    </div>
                    {preview}
                    {actions}
                    {note}
                </div>
            );
        } else {
            body = this.props.historyItem.state;
        }

        return (
            <VisibilitySensor partialVisibility={true} onChange={this.onVisibilityChange}>
                <div
                    ref={ref => (this.element = ref)}
                    className="EezStudio_HistoryItem EezStudio_HistoryItem_File"
                >
                    <Icon
                        className="mr-3"
                        icon={
                            this.props.historyItem.direction === "upload"
                                ? "material:file_upload"
                                : this.props.historyItem.direction === "download"
                                    ? "material:file_download"
                                    : "material:attach_file"
                        }
                        size={48}
                    />
                    <div>
                        <p>
                            <small className="EezStudio_HistoryItemDate text-muted">
                                {formatDateTimeLong(this.props.historyItem.date)}
                            </small>
                        </p>

                        {body}
                    </div>
                </div>
            </VisibilitySensor>
        );
    }
}

export class FileHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, public appStore?: IAppStore) {
        super(activityLogEntry);
    }

    get info() {
        let note;
        if (this.note) {
            const {
                PropertyList,
                StaticRichTextProperty
            } = require("shared/ui/properties") as typeof UiPropertiesModule;

            const { Balloon } = require("shared/ui/balloon") as typeof UiBalloonModule;

            note = (
                <Balloon>
                    <PropertyList>
                        <StaticRichTextProperty value={this.note} />
                    </PropertyList>
                </Balloon>
            );
        }

        return (
            <React.Fragment>
                <div className="plain-text">{this.fileTypeAsDisplayString + " file"}</div>
                {note}
            </React.Fragment>
        );
    }

    get listItemElement(): JSX.Element | null {
        return <FileHistoryItemComponent appStore={this.appStore!} historyItem={this} />;
    }

    get previewElement(): JSX.Element | null {
        if (this.isImage) {
            let imageData =
                "data:image/" +
                this.fileExtension +
                ";base64," +
                Buffer.from(this.data, "binary").toString("base64");
            return <ImagePreview src={imageData} />;
        } else if (this.isPdf) {
            return (
                <PdfPreview
                    data={this.data}
                    fileName={getFileName(this.fileState.sourceFilePath)}
                />
            );
        }
        return null;
    }

    @computed
    get fileState(): FileState {
        return JSON.parse(this.message);
    }

    @computed
    get fileLength() {
        if (typeof this.fileState.dataLength === "number") {
            return this.fileState.dataLength;
        }

        if (this.data) {
            return this.data.length;
        }

        return 0;
    }

    @computed
    get note() {
        return this.fileState.note;
    }

    set note(value: string | undefined) {
        let fileState = JSON.parse(this.message);

        fileState.note = value;

        logUpdate(
            {
                id: this.id,
                oid: this.appStore!.instrument!.id,
                message: JSON.stringify(fileState)
            },
            {
                undoable: true
            }
        );
    }

    @computed
    get fileType() {
        return this.fileState.fileType;
    }

    @computed
    get fileTypeAsDisplayString() {
        if (!this.fileType) {
            return "unknown";
        }

        if (typeof this.fileType === "string") {
            return this.fileType;
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

    @computed
    get sourceFilePath() {
        return this.fileState.sourceFilePath;
    }

    @computed
    get destinationFilePath() {
        return this.fileState.destinationFilePath;
    }

    @computed
    get isImage() {
        if (!this.fileType) {
            return false;
        }

        if (typeof this.fileType === "string") {
            return this.fileType.startsWith("image");
        }

        return this.fileType.mime.startsWith("image");
    }

    @computed
    get isPdf() {
        if (!this.fileType) {
            return false;
        }

        if (typeof this.fileType === "string") {
            return this.fileType.startsWith("application/pdf");
        }

        return this.fileType.mime.startsWith("application/pdf");
    }

    @computed
    get isText() {
        if (!this.fileType) {
            return false;
        }

        if (typeof this.fileType === "string") {
            return this.fileType === "CSV";
        }

        return this.fileType.mime.startsWith("text");
    }

    @computed
    get direction() {
        if (this.type === "instrument/file-download") {
            return "download";
        }
        if (this.type === "instrument/file-upload") {
            return "upload";
        }
        return "attachment";
    }

    @computed
    get state() {
        return this.fileState.state;
    }

    @computed
    get transferSucceeded() {
        return this.state === "success" || this.state === "upload-finish";
    }

    @computed
    get expectedDataLength() {
        return this.fileState.expectedDataLength;
    }

    @computed
    get dataLength() {
        return this.fileState.dataLength;
    }

    @computed
    get transferSpeed() {
        return this.fileState.transferSpeed;
    }

    @computed
    get error() {
        return this.fileState.error;
    }

    @computed
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
            firstRow = firstRow.replace(/(.*Sampling rate: )(.*)/, (match, a, b) => {
                return a + SAMPLING_RATE_UNIT.formatValue(parseFloat(b), 0, " ");
            });
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

    @observable isVisible: boolean;
}
