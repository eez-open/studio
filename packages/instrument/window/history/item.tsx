import React from "react";
import { observable, makeObservable, runInAction, computed } from "mobx";

import { formatDuration } from "eez-studio-shared/util";
import {
    beginTransaction,
    commitTransaction,
    type IStore
} from "eez-studio-shared/store";

import {
    activityLogStore,
    IActivityLogEntry,
    loadData,
    logDelete,
    logUpdate
} from "instrument/window/history/activity-log";
import type { IAppStore } from "instrument/window/history/history";
import {
    showAddNoteDialog,
    showEditNoteDialog
} from "instrument/window/note-dialog";
import { Balloon } from "eez-studio-ui/balloon";
import { PreventDraggable } from "instrument/window/history/helper";
import { PropertyList, StaticRichTextProperty } from "eez-studio-ui/properties";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { showAddAudioDialog } from "instrument/window/media-dialogs";
import { RECORD_AUDIO_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

export interface IHistoryItem {
    id: string;
    sid: string | null;
    oid: string;
    date: Date;
    type: string;
    message: string;
    data: string;
    deleted: boolean;
    temporary: boolean;
    selected: boolean;
    getListItemElement(
        appStore: IAppStore,
        viewType: "chat" | "thumbs"
    ): React.ReactNode;
    canBePartOfMultiChart: boolean;
    setData(data: any): void;
    dispose(): void;
}

////////////////////////////////////////////////////////////////////////////////

interface IMediaNote {
    mimeType: string;
    data: string;
}

export class HistoryItem implements IHistoryItem {
    id: string;
    sid: string | null;
    oid: string;
    date: Date;
    type: string;
    message: string;
    _data: any;
    _dataUpdated: number = 0;
    selected: boolean;
    deleted: boolean;
    temporary: boolean;
    canBePartOfMultiChart = false;

    constructor(public store: IStore, activityLogEntry: IActivityLogEntry) {
        makeObservable(this, {
            message: observable,
            selected: observable,
            _dataUpdated: observable,
            temporary: observable,

            mediaSource: computed
        });

        this.id = activityLogEntry.id;
        this.sid = activityLogEntry.sid;
        this.oid = activityLogEntry.oid;
        if (activityLogEntry.date instanceof Date) {
            this.date = activityLogEntry.date;
        } else {
            this.date = new Date(activityLogEntry.date);
        }

        this.type = activityLogEntry.type;
        this.message = activityLogEntry.message;
        this._data = activityLogEntry.data;
        this.deleted = activityLogEntry.deleted;
        this.temporary = activityLogEntry.temporary;
    }

    deleteLog() {
        logDelete(
            activityLogStore,
            {
                id: this.id,
                sid: this.sid,
                oid: this.oid,
                type: this.type
            },
            {
                undoable: false
            }
        );
    }

    get messageObject() {
        try {
            return this.message ? JSON.parse(this.message) : ({} as any);
        } catch (err) {
            return {} as any;
        }
    }

    get note(): string | undefined {
        return this.messageObject.note;
    }

    get mediaNote(): IMediaNote | undefined {
        return this.messageObject.mediaNote;
    }

    get data() {
        this._dataUpdated;
        if (this._data !== undefined) {
            return this._data;
        }
        this.loadData();
        return this._data;
    }

    setData(data: any) {
        this._data = data;

        runInAction(() => this._dataUpdated++);
    }

    loadData() {
        this._data = loadData(this.store, this.id);
        runInAction(() => this._dataUpdated++);
    }

    get info(): string | JSX.Element {
        let text;
        const type = this.type.slice("instrument/".length);
        if (this.message) {
            let message = this.message;
            if (type === "connected") {
                try {
                    let messageJs = JSON.parse(message);
                    message = messageJs.sessionName || "";
                } catch (err) {}
            } else if (type === "disconnected") {
                try {
                    let messageJs = JSON.parse(message);
                    message = formatDuration(messageJs.duration);
                } catch (err) {
                    message = "";
                }
            } else if (type === "answer") {
                message = message.slice(0, 128);
            }
            text = `${type}: ${message}`;
        } else {
            text = type;
        }
        return <div className="plain-text">{text}</div>;
    }

    getListItemElement(
        appStore: IAppStore,
        viewType: "chat" | "thumbs"
    ): React.ReactNode {
        return null;
    }

    getSourceDescriptionElement(appStore: IAppStore) {
        if (this.sid && appStore.history.options.store.getSourceDescription) {
            const source = appStore.history.options.store.getSourceDescription(
                this.sid
            );
            if (source) {
                return (
                    <p>
                        <small className="EezStudio_HistoryItemDate">{`Source: ${source}`}</small>
                    </p>
                );
            }
        }
        return null;
    }

    setNote(appStore: IAppStore, value: string | undefined) {
        let messageObject = JSON.parse(this.message);

        messageObject.note = value;

        logUpdate(
            this.store,
            {
                id: this.id,
                oid: appStore.history.oid,
                message: JSON.stringify(messageObject)
            },
            {
                undoable: true
            }
        );
    }

    onAddNote(appStore: IAppStore) {
        showAddNoteDialog(note => {
            beginTransaction("Add note");
            this.setNote(appStore, note);
            commitTransaction();
        });
    }

    onEditNote(appStore: IAppStore) {
        showEditNoteDialog(this.note!, note => {
            if (this.note !== note) {
                beginTransaction("Edit note");
                this.setNote(appStore, note);
                commitTransaction();
            }
        });
    }

    onDeleteNote(appStore: IAppStore) {
        beginTransaction("Delete note");
        this.setNote(appStore, undefined);
        commitTransaction();
    }

    renderAddNoteAction(appStore: IAppStore) {
        if (this.note != undefined) {
            return null;
        }

        return (
            <IconAction
                icon="material:comment"
                title="Add note"
                onClick={() => this.onAddNote(appStore)}
            />
        );
    }

    renderNote(appStore: IAppStore) {
        if (this.note == undefined) {
            return null;
        }
        return (
            <div
                className="EezStudio_HistoryItem_Note"
                onDoubleClick={() => this.onEditNote(appStore)}
            >
                <Balloon>
                    <PreventDraggable tag="div">
                        <PropertyList>
                            <StaticRichTextProperty value={this.note} />
                        </PropertyList>
                    </PreventDraggable>
                </Balloon>
                <Toolbar>
                    <IconAction
                        icon="material:edit"
                        title="Edit note"
                        onClick={() => this.onEditNote(appStore)}
                    />
                    <IconAction
                        icon="material:delete"
                        title="Delete note"
                        onClick={() => this.onDeleteNote(appStore)}
                    />
                </Toolbar>
            </div>
        );
    }

    renderNoteInfo() {
        if (!this.note) {
            return null;
        }

        return (
            <Balloon>
                <PropertyList>
                    <StaticRichTextProperty value={this.note} />
                </PropertyList>
            </Balloon>
        );
    }

    setMediaNote(appStore: IAppStore, value: IMediaNote | undefined) {
        let messageObject = JSON.parse(this.message);

        messageObject.mediaNote = value;

        logUpdate(
            this.store,
            {
                id: this.id,
                oid: appStore.history.oid,
                message: JSON.stringify(messageObject)
            },
            {
                undoable: true
            }
        );
    }

    onAddMediaNote(appStore: IAppStore) {
        showAddAudioDialog(mediaNote => {
            beginTransaction("Add audio note");

            const mimeType = JSON.parse(mediaNote.message).mimeType;
            const data = mediaNote.data.toString("base64");

            this.setMediaNote(appStore, {
                mimeType,
                data
            });

            commitTransaction();
        });
    }

    onDeleteMediaNote(appStore: IAppStore) {
        beginTransaction("Delete audio note");
        this.setMediaNote(appStore, undefined);
        commitTransaction();
    }

    renderAddMediaNoteAction(appStore: IAppStore) {
        if (this.mediaNote != undefined) {
            return null;
        }

        return (
            <IconAction
                icon={RECORD_AUDIO_ICON}
                title="Add audio note"
                onClick={() => this.onAddMediaNote(appStore)}
            />
        );
    }

    get mediaSource() {
        if (this.mediaNote == undefined) {
            return null;
        }

        const data = Buffer.from(this.mediaNote.data, "base64");

        const blob = new Blob([data], {
            type: this.mediaNote.mimeType
        });

        return window.URL.createObjectURL(blob);
    }

    renderMediaNote(appStore: IAppStore) {
        if (!this.mediaNote) {
            return null;
        }
        if (!this.mediaSource) {
            return null;
        }

        const isVideo = this.mediaNote.mimeType.startsWith("video");

        return (
            <PreventDraggable
                tag="div"
                className="d-inline-flex align-items-center"
            >
                {isVideo ? (
                    <video
                        controls
                        src={this.mediaSource}
                        draggable="true"
                        onDragStart={event => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                    ></video>
                ) : (
                    <audio
                        controls
                        src={this.mediaSource}
                        draggable="true"
                        onDragStart={event => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                    ></audio>
                )}

                <IconAction
                    icon="material:delete"
                    title="Delete audio note"
                    onClick={() => this.onDeleteMediaNote(appStore)}
                />
            </PreventDraggable>
        );
    }

    dispose() {}
}
