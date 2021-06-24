import React from "react";
import { observable, computed, action, runInAction, trace } from "mobx";
import { observer } from "mobx-react";
import { clipboard, nativeImage, SaveDialogOptions } from "electron";
import { bind } from "bind-decorator";

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

import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { SAMPLING_RATE_UNIT } from "eez-studio-shared/units";
import { IActivityLogEntry, logUpdate } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";
import * as UiPropertiesModule from "eez-studio-ui/properties";
import { Balloon } from "eez-studio-ui/balloon";
import { PropertyList, StaticRichTextProperty } from "eez-studio-ui/properties";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction, TextAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";
import * as UiBalloonModule from "eez-studio-ui/balloon";

import pdfToPng from "pdf-services/pdf-to-png";

import { FileState } from "instrument/connection/file-state";

import {
    showAddNoteDialog,
    showEditNoteDialog
} from "instrument/window/note-dialog";

import { IAppStore } from "instrument/window/history/history";
import {
    HistoryItem,
    HistoryItemDiv,
    HistoryItemDate
} from "instrument/window/history/item";
import { HistoryItemPreview } from "instrument/window/history/item-preview";

import { Waveform, convertToCsv } from "instrument/window/waveform/generic";
import { DlogWaveform } from "instrument/window/waveform/dlog";
import { convertDlogToCsv } from "instrument/connection/file-type-utils";
import { PreventDraggable } from "instrument/window/history/helper";

////////////////////////////////////////////////////////////////////////////////

const FileHistoryItemDiv = styled(HistoryItemDiv)`
    display: flex;
    flex-direction: row;
    background-color: lightsteelblue;
    padding: 10px;
    overflow: auto;

    .EezStudio_Toolbar {
        margin-top: 5px;
    }

    .EezStudio_HistoryItem_File_Note {
        position: relative;
        margin: auto;
        overflow: visible;
        border-radius: 0;
        padding: 0;
        margin-top: 10px;
        min-width: 240px;

        .EezStudio_Toolbar {
            position: absolute;
            display: none;
            top: 5px;
            right: 5px;
        }

        &:hover .EezStudio_Toolbar {
            display: block;
        }
    }

    .EezStudio_HistoryItem_File_NoNote {
        margin-bottom: 10px;
    }

    .EezStudio_HistoryItemText * {
        user-select: auto;
    }
`;

@observer
class ImagePreview extends React.Component<{
    src: string;
}> {
    @observable zoom: boolean = false;

    @action.bound
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

////////////////////////////////////////////////////////////////////////////////

// TODO create temp dir in main process
let getPdfTempDirPathPromise = getTempDirPath();

@observer
class PdfPreview extends React.Component<{
    historyItem: HistoryItem;
}> {
    @observable thumbnail: string;
    @observable url: string;
    webView: any;
    @observable zoom: boolean = false;

    constructor(props: any) {
        super(props);
    }

    @action.bound
    toggleZoom() {
        this.zoom = !this.zoom;
    }

    update() {
        if (this.zoom) {
            if (!this.url) {
                (async () => {
                    const [tempDirPath] = await getPdfTempDirPathPromise;
                    const tempFilePath =
                        tempDirPath + "/" + this.props.historyItem.id + ".pdf";
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

    @bind
    bringToFocus() {
        if (this.zoom && this.webView) {
            if (this.webView.isReady()) {
                this.webView.focus();
            } else {
                setTimeout(this.bringToFocus);
            }
        }
    }

    componentDidMount() {
        this.update();
        this.bringToFocus();
    }

    componentDidUpdate() {
        this.update();
        this.bringToFocus();
    }

    render() {
        let content;

        if (this.zoom) {
            const WebView = require("react-electron-web-view");
            content = this.url && (
                <WebView
                    ref={(ref: any) => (this.webView = ref)}
                    src={
                        "../../libs/pdfjs/web/viewer.html?file=" +
                        encodeURIComponent(this.url)
                    }
                    tabIndex={this.zoom ? 0 : undefined}
                />
            );
        } else {
            content = (
                <img src={this.thumbnail || "../instrument/_images/pdf.png"} />
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

////////////////////////////////////////////////////////////////////////////////

@observer
export class FileHistoryItemComponent extends React.Component<
    {
        appStore: IAppStore;
        historyItem: FileHistoryItem;
    },
    {}
> {
    setVisibleTimeoutId: any;

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
    async onSave() {
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

        const result = await EEZStudio.remote.dialog.showSaveDialog(
            EEZStudio.remote.getCurrentWindow(),
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
    }

    @observable onSaveAsCsvInProgress = false;

    @bind
    async onSaveAsCsv() {
        if (this.onSaveAsCsvInProgress) {
            return;
        }

        runInAction(() => (this.onSaveAsCsvInProgress = true));

        let data;

        if (this.props.historyItem instanceof DlogWaveform) {
            data = convertDlogToCsv(this.props.historyItem.data);
        } else if (this.props.historyItem instanceof Waveform) {
            data = await convertToCsv(this.props.historyItem);
        }

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

        const result = await EEZStudio.remote.dialog.showSaveDialog(
            EEZStudio.remote.getCurrentWindow(),
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
            clipboard.writeText(this.props.historyItem.data.toString());
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
                preview = this.props.historyItem.previewElement;

                actions = (
                    <Toolbar>
                        <IconAction
                            icon="material:save"
                            title="Save file"
                            onClick={this.onSave}
                        />
                        {(this.props.historyItem instanceof DlogWaveform ||
                            this.props.historyItem instanceof Waveform) && (
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
                            <PreventDraggable tag="div">
                                <PropertyList>
                                    <StaticRichTextProperty
                                        value={this.props.historyItem.note}
                                    />
                                </PropertyList>
                            </PreventDraggable>
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
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center"
                                }}
                            >
                                <div>
                                    {this.props.historyItem.sourceFilePath}
                                </div>
                                {this.props.historyItem.destinationFilePath && (
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
            <FileHistoryItemDiv>
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
                        <HistoryItemDate>
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </HistoryItemDate>
                    </p>
                    {this.props.historyItem.sourceDescriptionElement}
                    {body}
                </div>
            </FileHistoryItemDiv>
        );
    }
}

export class FileHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get info() {
        let note;
        if (this.note) {
            const { PropertyList, StaticRichTextProperty } =
                require("eez-studio-ui/properties") as typeof UiPropertiesModule;

            const { Balloon } =
                require("eez-studio-ui/balloon") as typeof UiBalloonModule;

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
                <div className="plain-text">
                    {this.fileTypeAsDisplayString + " file"}
                </div>
                {note}
            </React.Fragment>
        );
    }

    @computed
    get listItemElement(): JSX.Element | null {
        return (
            <FileHistoryItemComponent
                appStore={this.appStore!}
                historyItem={this}
            />
        );
    }

    @computed
    get previewElement(): JSX.Element | null {
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

    @computed
    get fileState(): FileState {
        return this.message ? JSON.parse(this.message) : {};
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
            this.appStore.history.options.store,
            {
                id: this.id,
                oid: this.appStore!.history.oid,
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
        trace();
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
}
