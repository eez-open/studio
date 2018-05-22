import * as React from "react";
import { observable, computed } from "mobx";

import { formatDuration } from "shared/util";
import { SAMPLING_RATE_UNIT } from "shared/units";
import { IActivityLogEntry, loadData, logDelete, logUpdate } from "shared/activity-log";
import * as UiPropertiesModule from "shared/ui/properties";
import * as UiBalloon from "shared/ui/balloon";

import { FileState } from "instrument/connection/file-state";

import * as AppStoreModule from "instrument/window/app-store";

import * as GenericWaveformModule from "instrument/window/waveform/generic";
import * as MultiWaveformModule from "instrument/window/waveform/multi";
import * as DlogWaveformModule from "instrument/window/waveform/dlog";

////////////////////////////////////////////////////////////////////////////////

export interface IHistoryItem {
    id: string;
    oid: string;
    date: Date;
    type: string;
    message: string;
    data: string;
    deleted: boolean;
    selected: boolean;
}

////////////////////////////////////////////////////////////////////////////////

export class HistoryItem implements IHistoryItem {
    id: string;
    oid: string;
    date: Date;
    type: string;
    @observable message: string;
    _data: any;
    @observable selected: boolean;
    deleted: boolean;

    constructor(activityLogEntry: IActivityLogEntry) {
        this.id = activityLogEntry.id;
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
    }

    deleteLog() {
        logDelete(this, {
            undoable: false
        });
    }

    get data() {
        if (this._data !== undefined) {
            return this._data;
        }
        this._data = loadData(this.id);
        return this._data;
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
}

////////////////////////////////////////////////////////////////////////////////

export class NoteHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    get info() {
        const {
            PropertyList,
            StaticRichTextProperty
        } = require("shared/ui/properties") as typeof UiPropertiesModule;

        const { Balloon } = require("shared/ui/balloon") as typeof UiBalloon;

        return (
            <Balloon>
                <PropertyList>
                    <StaticRichTextProperty value={this.message} />
                </PropertyList>
            </Balloon>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IScriptHistoryItemMessage {
    name: string;
    type: string;
    parameters?: any;
    done: boolean;
    error?: string;
}

export class ScriptHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    @computed
    get scriptMessage() {
        return JSON.parse(this.message) as IScriptHistoryItemMessage;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class FileHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    get info() {
        let note;
        if (this.note) {
            const {
                PropertyList,
                StaticRichTextProperty
            } = require("shared/ui/properties") as typeof UiPropertiesModule;

            const { Balloon } = require("shared/ui/balloon") as typeof UiBalloon;

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
        const { appStore } = require("instrument/window/app-store") as typeof AppStoreModule;

        let fileState = JSON.parse(this.message);

        fileState.note = value;

        logUpdate(
            {
                id: this.id,
                oid: appStore.instrument!.id,
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
        return this.fileState.direction;
    }

    @computed
    get state() {
        return this.fileState.state;
    }

    @computed
    get transferSucceeded() {
        return this.state === "success" || this.state === "download-finish";
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

////////////////////////////////////////////////////////////////////////////////

export function createHistoryItem(activityLogEntry: IActivityLogEntry) {
    if (activityLogEntry.type === "instrument/file") {
        if (EEZStudio.windowType === "instrument") {
            const {
                isWaveform,
                Waveform
            } = require("instrument/window/waveform/generic") as typeof GenericWaveformModule;

            const {
                isDlogWaveform,
                DlogWaveform
            } = require("instrument/window/waveform/dlog") as typeof DlogWaveformModule;

            if (isDlogWaveform(activityLogEntry)) {
                return new DlogWaveform(activityLogEntry);
            } else if (isWaveform(activityLogEntry)) {
                return new Waveform(activityLogEntry);
            }
        }
        return new FileHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/chart" && EEZStudio.windowType === "instrument") {
        const {
            MultiWaveform
        } = require("instrument/window/waveform/multi") as typeof MultiWaveformModule;
        return new MultiWaveform(activityLogEntry);
    }

    if (activityLogEntry.type === "activity-log/note") {
        return new NoteHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/script") {
        return new ScriptHistoryItem(activityLogEntry);
    }

    return new HistoryItem(activityLogEntry);
}

export function updateHistoryItemClass(historyItem: IHistoryItem): IHistoryItem {
    if (historyItem instanceof FileHistoryItem) {
        const {
            isDlogWaveform,
            DlogWaveform
        } = require("instrument/window/waveform/dlog") as typeof DlogWaveformModule;
        if (isDlogWaveform(historyItem) && !(historyItem instanceof DlogWaveform)) {
            return new DlogWaveform(historyItem);
        }
    }
    return historyItem;
}
