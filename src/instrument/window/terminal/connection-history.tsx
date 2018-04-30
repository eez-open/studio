import * as React from "react";
import { findDOMNode } from "react-dom";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { clipboard, nativeImage, SaveDialogOptions } from "electron";
import * as VisibilitySensor from "react-visibility-sensor";
import { bind } from "bind-decorator";

import * as notification from "shared/ui/notification";

import {
    writeBinaryData,
    formatTransferSpeed,
    getFileName,
    formatBytes,
    formatDateTimeLong,
    formatDuration
} from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { logUpdate, logDelete } from "shared/activity-log";

import { PropertyList, StaticRichTextProperty } from "shared/ui/properties";
import { Toolbar } from "shared/ui/toolbar";
import { IconAction, TextAction } from "shared/ui/action";
import { confirm } from "shared/ui/dialog";
import { Balloon } from "shared/ui/balloon";
import { Icon } from "shared/ui/icon";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { ChartsView, globalViewOptions } from "shared/ui/chart";

import { CONF_COMBINE_IF_BELOW_MS } from "instrument/conf";
import { createTableListFromData } from "instrument/window/lists/factory";
import { saveTableListData } from "instrument/window/lists/lists";
import { findListIdByName } from "instrument/window/lists/store-renderer";
import { createChartsController, ChartData } from "instrument/window/chart-factory";
import { Waveform } from "instrument/window/waveform/generic";
import { MultiWaveform } from "instrument/window/waveform/multi";
import { DlogWaveform } from "instrument/window/waveform/dlog";

import { navigationStore } from "instrument/window/app";
import { appStore, isHistoryItemSelected, selectHistoryItem } from "instrument/window/app-store";
import { historyItemBlocks, historyNavigator } from "instrument/window/history";
import { IHistoryItem, FileHistoryItem, ScriptHistoryItem } from "instrument/window/history-item";

import { getConnectionParametersInfo } from "instrument/window/connection";

import { showAddNoteDialog, showEditNoteDialog } from "instrument/window/terminal/note-dialog";

////////////////////////////////////////////////////////////////////////////////

@observer
export class RequestHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Request">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                </p>
                <pre>{this.props.historyItem.message}</pre>
            </div>
        );
    }
}

@observer
export class AnswerHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    @observable showAll: boolean = false;

    render() {
        let message = this.props.historyItem.message.trim();

        let textClassName;
        if (message.indexOf("**ERROR") != -1) {
            textClassName = "text-danger";
        }

        message = message.replace(/\"\,\"/g, '",\n"');

        let content;
        if (message.length > 1024 && !this.showAll) {
            content = (
                <div>
                    <pre className={textClassName}>{message.slice(0, 1024)}</pre>
                    <div style={{ margin: "5px 0" }}>
                        <button
                            className="btn btn-sm"
                            onClick={action(() => (this.showAll = true))}
                        >
                            Show all
                        </button>
                    </div>
                </div>
            );
        } else {
            content = <pre className={textClassName}>{message}</pre>;
        }

        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Answer">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                </p>
                {content}
            </div>
        );
    }
}

@observer
export class CreatedHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Created">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>Instrument created!</span>
                </p>
            </div>
        );
    }
}

@observer
export class ConnectedHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        connectionParameters?: any;
        sessionName?: string;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {
                sessionName: this.props.historyItem.message
            };
        }
    }

    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Connected">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>
                        CONNECTED{this.message.connectionParameters
                            ? " to " +
                              getConnectionParametersInfo(this.message.connectionParameters)
                            : ""}
                    </span>
                    <span className="EezStudio_HistoryItem_SessionName">
                        {this.message.sessionName}
                    </span>
                </p>
            </div>
        );
    }
}

@observer
export class ConnectFailedHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        connectionParameters?: any;
        error?: string;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {};
        }
    }

    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Disconnected">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span className="text-danger">
                        CONNECT{this.message.connectionParameters
                            ? " to " +
                              getConnectionParametersInfo(this.message.connectionParameters)
                            : " "}{" "}
                        failed
                        {this.message.error && ": " + this.message.error}
                    </span>
                </p>
            </div>
        );
    }
}

@observer
export class DisconnectedHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    @computed
    get message(): {
        error?: string;
        duration?: number;
    } {
        if (!this.props.historyItem.message) {
            return {};
        }

        try {
            return JSON.parse(this.props.historyItem.message);
        } catch (err) {
            return {
                error: this.props.historyItem.message
            };
        }
    }

    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Disconnected">
                <p>
                    <small className="EezStudio_HistoryItemDate text-muted">
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </small>
                    <span>
                        DISCONNECTED
                        {this.message.duration !== undefined
                            ? " after " + formatDuration(this.message.duration)
                            : ""}
                    </span>
                    {this.message.error && (
                        <span className="text-danger">/ {this.message.error}</span>
                    )}
                </p>
            </div>
        );
    }
}

@observer
export class NoteHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    @bind
    handleEditNote() {
        showEditNoteDialog(this.props.historyItem.message, note => {
            beginTransaction("Edit note");
            logUpdate(
                {
                    id: this.props.historyItem.id,
                    oid: appStore.instrument!.id,
                    message: note
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    @bind
    handleDeleteNote() {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Delete note");
            logDelete(this.props.historyItem, {
                undoable: true
            });
            commitTransaction();
        });
    }

    render() {
        return (
            <div
                className="EezStudio_HistoryItem EezStudio_HistoryItem_Note"
                onDoubleClick={this.handleEditNote}
            >
                <Balloon>
                    <p>
                        <small className="EezStudio_HistoryItemDate text-muted">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    <PropertyList>
                        <StaticRichTextProperty value={this.props.historyItem.message} />
                    </PropertyList>
                </Balloon>
                <Toolbar>
                    <IconAction
                        icon="material:edit"
                        title="Edit note"
                        onClick={this.handleEditNote}
                    />
                    <IconAction
                        icon="material:delete"
                        title="Delete note"
                        onClick={this.handleDeleteNote}
                    />
                </Toolbar>
            </div>
        );
    }
}

@observer
class ImagePreview extends React.Component<
    {
        src: string;
    },
    {}
> {
    @observable zoom: boolean = false;

    @action.bound
    toggleZoom() {
        this.zoom = !this.zoom;
    }

    render() {
        const img = <img src={this.props.src} onClick={this.toggleZoom} />;

        if (this.zoom) {
            return (
                <VerticalHeaderWithBody className="EezStudio_ImagePreview zoom">
                    <Header>
                        <Toolbar />
                        <Toolbar>
                            <IconAction
                                icon="material:close"
                                iconSize={24}
                                title="Leave full screen mode"
                                onClick={this.toggleZoom}
                            />
                        </Toolbar>
                    </Header>
                    <Body>{img}</Body>
                </VerticalHeaderWithBody>
            );
        } else {
            return <div className="EezStudio_ImagePreview">{img}</div>;
        }
    }
}

@observer
export class FileHistoryItemComponent extends React.Component<
    {
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
        appStore.instrument!.connection.abortLongOperation();
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

        let fileExtension;
        if (typeof this.props.historyItem.fileType === "string") {
            if (this.props.historyItem.fileType === "image") {
                fileExtension = "png";
            } else if (this.props.historyItem.fileType.startsWith("image/")) {
                fileExtension = this.props.historyItem.fileType.slice("image/".length);
            } else if (this.props.historyItem.fileType === "CSV") {
                fileExtension = "csv";
            }
        } else {
            fileExtension = this.props.historyItem.fileType.ext;
        }

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
        if (this.props.historyItem.direction === "download") {
            return "Sending file ...";
        } else {
            return "Receiving file ...";
        }
    }

    render() {
        let showCheckbox = false;

        let body;
        if (
            !this.props.historyItem.state ||
            this.props.historyItem.state === "init" ||
            this.props.historyItem.state === "download-filesize" ||
            this.props.historyItem.state === "download-start"
        ) {
            body = <div>{this.getDirectionInfo()}</div>;
        } else if (this.props.historyItem.state === "progress") {
            let percent = this.props.historyItem.expectedDataLength
                ? Math.floor(
                      100 *
                          this.props.historyItem.dataLength /
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
                    {this.props.historyItem.direction === "download" && (
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
            this.props.historyItem.state === "download-error"
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
            let preview;
            let actions;

            if (this.props.historyItem.fileType) {
                if (this.props.historyItem.isImage) {
                    let imageData =
                        "data:image/png;base64," +
                        Buffer.from(this.props.historyItem.data, "binary").toString("base64");
                    preview = <ImagePreview src={imageData} />;
                } else {
                    if (
                        this.props.historyItem instanceof Waveform ||
                        this.props.historyItem instanceof DlogWaveform
                    ) {
                        preview = <ChartPreview data={this.props.historyItem} />;
                        if (
                            appStore.selectHistoryItemsSpecification &&
                            appStore.selectHistoryItemsSpecification.historyItemType === "chart"
                        ) {
                            showCheckbox = true;
                        }
                    }
                }

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
                    {!showCheckbox && actions}
                    {!showCheckbox && note}
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
                    {!showCheckbox && (
                        <Icon
                            className="mr-3"
                            icon={
                                this.props.historyItem.direction === "download"
                                    ? "material:file_upload"
                                    : "material:file_download"
                            }
                            size={48}
                        />
                    )}
                    {showCheckbox && (
                        <div className="EezStudio_HistoryItem_Checkbox">
                            <input
                                type="checkbox"
                                checked={isHistoryItemSelected(this.props.historyItem.id)}
                                onChange={event =>
                                    selectHistoryItem(
                                        this.props.historyItem.id,
                                        event.target.checked
                                    )
                                }
                            />
                        </div>
                    )}
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

interface ChartPreviewProps {
    data: ChartData;
}

@observer
export class ChartPreview extends React.Component<ChartPreviewProps, {}> {
    @observable data: ChartData = this.props.data;
    @observable zoom: boolean = false;

    @action.bound
    toggleZoom() {
        this.zoom = !this.zoom;
    }

    @computed
    get chartsController() {
        return createChartsController(this.data, "split", this.zoom ? "interactive" : "preview");
    }

    @action
    componentWillReceiveProps(nextProps: ChartPreviewProps) {
        this.data = nextProps.data;
    }

    render() {
        let className = classNames("EezStudio_HistoryItem_Charts", {
            zoom: this.zoom,
            EezStudio_HistoryItem_Charts_BlackBackground: globalViewOptions.blackBackground
        });

        if (this.zoom) {
            let toolbar;
            if (
                this.props.data instanceof Waveform ||
                this.props.data instanceof MultiWaveform ||
                this.props.data instanceof DlogWaveform
            ) {
                toolbar = this.props.data.renderToolbar(this.chartsController);
            } else {
                toolbar = <Toolbar />;
            }

            return (
                <VerticalHeaderWithBody className={className}>
                    <Header>
                        {toolbar}
                        <Toolbar>
                            <IconAction
                                icon="material:close"
                                iconSize={24}
                                title="Leave full screen mode"
                                onClick={this.toggleZoom}
                            />
                        </Toolbar>
                    </Header>
                    <Body>
                        <ChartsView chartsController={this.chartsController} tabIndex={0} />
                    </Body>
                </VerticalHeaderWithBody>
            );
        } else {
            return (
                <div className={className} onClick={this.toggleZoom}>
                    <ChartsView chartsController={this.chartsController} />
                </div>
            );
        }
    }
}

@observer
export class ListHistoryItem extends React.Component<
    {
        historyItem: IHistoryItem;
    },
    {}
> {
    @computed
    get message() {
        return JSON.parse(this.props.historyItem.message);
    }

    @computed
    get list() {
        if (this.message.listData && this.message.listData.length > 0) {
            return createTableListFromData(Object.assign({}, this.message.listData[0]));
        }

        return null;
    }

    @computed
    get listId() {
        return findListIdByName(this.message.listName);
    }

    @action.bound
    onOpen() {
        if (this.listId) {
            navigationStore.selectedListId = this.listId;
        }
    }

    @bind
    onSave() {
        if (this.list) {
            saveTableListData(this.message.listName, this.list.tableListData);
        }
    }

    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_List">
                <Icon className="mr-3" icon={"material:timeline"} size={48} />
                <div>
                    <p>
                        <small className="EezStudio_HistoryItemDate text-muted">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    <div>
                        {this.message.operation === "get"
                            ? `Instrument list saved as "${this.message.listName}"`
                            : `List "${this.message.listName}" sent to instrument`}
                    </div>
                    {this.message.error && <div className="text-danger">{this.message.error}</div>}
                    {this.list && <ChartPreview data={this.list} />}
                    {
                        <Toolbar>
                            {this.listId && (
                                <IconAction
                                    icon="material:edit"
                                    title="Open List in Editor"
                                    onClick={this.onOpen}
                                />
                            )}
                            {this.list && (
                                <IconAction
                                    icon="material:save"
                                    title="Save List"
                                    onClick={this.onSave}
                                />
                            )}
                        </Toolbar>
                    }
                </div>
            </div>
        );
    }
}

@observer
export class ChartHistoryItem extends React.Component<
    {
        historyItem: MultiWaveform;
    },
    {}
> {
    @action.bound
    onVisibilityChange(isVisible: boolean) {
        this.props.historyItem.isVisible = isVisible;
    }

    render() {
        return (
            <VisibilitySensor partialVisibility={true} onChange={this.onVisibilityChange}>
                <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Chart">
                    <Icon className="mr-3" icon={"material:insert_chart"} size={48} />
                    <div>
                        <p>
                            <small className="EezStudio_HistoryItemDate text-muted">
                                {formatDateTimeLong(this.props.historyItem.date)}
                            </small>
                        </p>
                        <ChartPreview data={this.props.historyItem} />
                    </div>
                </div>
            </VisibilitySensor>
        );
    }
}

@observer
export class ScriptHistoryItemComponent extends React.Component<
    {
        historyItem: ScriptHistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Script">
                <Icon className="mr-3" icon={"material:slideshow"} size={48} />
                <div>
                    <p>
                        <small className="EezStudio_HistoryItemDate text-muted">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    <table className="table">
                        <tbody>
                            <tr>
                                <td>Name</td>
                                <td>{this.props.historyItem.scriptMessage.name}</td>
                            </tr>
                            <tr>
                                <td>Type</td>
                                <td>{this.props.historyItem.scriptMessage.type}</td>
                            </tr>
                            {this.props.historyItem.scriptMessage.parameters && (
                                <tr>
                                    <td>Parameters</td>
                                    <td>
                                        <pre>
                                            {JSON.stringify(
                                                this.props.historyItem.scriptMessage.parameters
                                            )}
                                        </pre>
                                    </td>
                                </tr>
                            )}
                            {this.props.historyItem.scriptMessage.done && (
                                <tr>
                                    <td>Result:</td>
                                    <td>
                                        {this.props.historyItem.scriptMessage.error ? (
                                            <div className="text-danger">
                                                {this.props.historyItem.scriptMessage.error}
                                            </div>
                                        ) : (
                                            "Success"
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

function getTime(date: Date | string | number) {
    if (date instanceof Date) {
        return date.getTime();
    } else if (typeof date === "string") {
        return new Date(date).getTime();
    } else {
        return date;
    }
}

@observer
export class HistoryItems extends React.Component<{ historyItems: IHistoryItem[] }> {
    render() {
        let lastAnswerHistoryItem: IHistoryItem | undefined;
        let historyItemElements: JSX.Element[] = [];

        function historyItemsPush(historyItem: IHistoryItem, element: JSX.Element) {
            if (historyItem.type !== "instrument/created") {
                if (appStore.selectHistoryItemsSpecification) {
                    if (appStore.selectHistoryItemsSpecification.historyItemType === "chart") {
                        if (!(historyItem instanceof Waveform)) {
                            element = <div />;
                        }
                    }
                }
            }

            let className = classNames(
                `EezStudio_HistoryItemContainer`,
                `EezStudio_HistoryItem_${historyItem.id}`,
                {
                    selected: historyItem.selected
                }
            );

            historyItemElements.push(
                <div key={historyItem.id} className={className}>
                    {element}
                </div>
            );
        }

        function flushAnswer() {
            if (lastAnswerHistoryItem) {
                if (lastAnswerHistoryItem.message.trim().length > 0) {
                    historyItemsPush(
                        lastAnswerHistoryItem,
                        <AnswerHistoryItem historyItem={lastAnswerHistoryItem} />
                    );
                }
                lastAnswerHistoryItem = undefined;
            }
        }

        this.props.historyItems.forEach(historyItem => {
            if (historyItem.type === "instrument/answer") {
                if (
                    lastAnswerHistoryItem &&
                    getTime(historyItem.date) - getTime(lastAnswerHistoryItem.date) <
                        CONF_COMBINE_IF_BELOW_MS
                ) {
                    lastAnswerHistoryItem.message += historyItem.message;
                } else {
                    flushAnswer();
                    lastAnswerHistoryItem = { ...historyItem };
                }
            } else {
                flushAnswer();

                if (historyItem.type === "instrument/request") {
                    historyItemsPush(historyItem, <RequestHistoryItem historyItem={historyItem} />);
                } else if (historyItem.type === "instrument/created") {
                    historyItemsPush(historyItem, <CreatedHistoryItem historyItem={historyItem} />);
                } else if (historyItem.type === "instrument/connected") {
                    historyItemsPush(
                        historyItem,
                        <ConnectedHistoryItem historyItem={historyItem} />
                    );
                } else if (historyItem.type === "instrument/connect-failed") {
                    historyItemsPush(
                        historyItem,
                        <ConnectFailedHistoryItem historyItem={historyItem} />
                    );
                } else if (historyItem.type === "instrument/disconnected") {
                    historyItemsPush(
                        historyItem,
                        <DisconnectedHistoryItem historyItem={historyItem} />
                    );
                } else if (historyItem.type === "activity-log/note") {
                    historyItemsPush(historyItem, <NoteHistoryItem historyItem={historyItem} />);
                } else if (historyItem.type === "instrument/file") {
                    historyItemsPush(
                        historyItem,
                        <FileHistoryItemComponent historyItem={historyItem as FileHistoryItem} />
                    );
                } else if (historyItem.type === "instrument/list") {
                    historyItemsPush(historyItem, <ListHistoryItem historyItem={historyItem} />);
                } else if (historyItem.type === "instrument/chart") {
                    historyItemsPush(
                        historyItem,
                        <ChartHistoryItem historyItem={historyItem as MultiWaveform} />
                    );
                } else if (historyItem.type === "instrument/script") {
                    historyItemsPush(
                        historyItem,
                        <ScriptHistoryItemComponent
                            historyItem={historyItem as ScriptHistoryItem}
                        />
                    );
                }
            }
        });

        flushAnswer();

        return historyItemElements;
    }
}

@observer
export class History extends React.Component<{}, {}> {
    animationFrameRequestId: any;
    div: Element;
    fromBottom: number | undefined;
    fromTop: number | undefined;

    componentDidMount() {
        this.autoScroll();
        this.div.addEventListener("scroll", this.onScroll);
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);

        this.div.removeEventListener("scroll", this.onScroll);
    }

    moveToTop() {
        this.fromBottom = 0;
        this.fromTop = undefined;
    }

    moveToBottom() {
        this.fromBottom = undefined;
        this.fromTop = 0;
    }

    @action
    selectHistoryItem(historyItem: IHistoryItem) {
        setTimeout(() => {
            const element = $(this.div).find(`.EezStudio_HistoryItem_${historyItem.id}`)[0];
            if (element) {
                element.scrollIntoView({ block: "center" });
                setTimeout(() => {
                    element.scrollIntoView({ block: "center" });
                }, 0);
            } else {
                console.warn("History item not found", historyItem);
            }
        }, 0);
    }

    @bind
    autoScroll() {
        if ($(this.div).is(":visible")) {
            if (this.fromBottom !== undefined) {
                if (this.fromBottom != this.div.scrollTop) {
                    this.div.scrollTop = this.fromBottom;
                }
            } else if (this.fromTop !== undefined) {
                let scrollTop = this.div.scrollHeight - this.div.clientHeight - this.fromTop;
                if (scrollTop != this.div.scrollTop) {
                    this.div.scrollTop = scrollTop;
                }
            }
        }

        this.animationFrameRequestId = window.requestAnimationFrame(this.autoScroll);
    }

    lastScrollHeight: number;
    lastClientHeight: number;

    @bind
    onScroll(event: any) {
        if (
            this.div.scrollHeight === this.lastScrollHeight &&
            this.div.clientHeight === this.lastClientHeight
        ) {
            if (this.fromBottom !== undefined) {
                this.fromBottom = this.div.scrollTop;
            } else if (this.fromTop !== undefined) {
                this.fromTop = this.div.scrollHeight - this.div.clientHeight - this.div.scrollTop;
            }
        }

        this.lastScrollHeight = this.div.scrollHeight;
        this.lastClientHeight = this.div.clientHeight;
    }

    render() {
        return (
            <div
                ref={(ref: any) => {
                    let div = findDOMNode(ref);
                    if (div && div.parentElement) {
                        this.div = div.parentElement;
                    }
                }}
                className="EezStudio_History"
            >
                {historyNavigator.hasOlder && (
                    <button
                        className="btn btn-secondary"
                        style={{ marginBottom: 20 }}
                        onClick={() => {
                            this.fromBottom = undefined;
                            this.fromTop = undefined;

                            const scrollHeight = this.div.scrollHeight;

                            historyNavigator.loadOlder();

                            window.requestAnimationFrame(() => {
                                this.div.scrollTop = this.div.scrollHeight - scrollHeight;
                            });
                        }}
                    >
                        <Icon icon="material:expand_less" /> More
                    </button>
                )}
                {historyItemBlocks.map(historyItems => {
                    if (historyItems.length === 0) {
                        return null;
                    }
                    return <HistoryItems key={historyItems[0].id} historyItems={historyItems} />;
                })}
                {historyNavigator.hasNewer && (
                    <button
                        className="btn btn-secondary"
                        onClick={historyNavigator.loadNewer}
                        style={{ marginTop: 15 }}
                    >
                        <Icon icon="material:expand_more" /> More
                    </button>
                )}
            </div>
        );
    }
}
