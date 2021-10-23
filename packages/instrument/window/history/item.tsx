import React from "react";
import { observable } from "mobx";

import { formatDuration } from "eez-studio-shared/util";
import {
    IActivityLogEntry,
    loadData,
    logDelete
} from "eez-studio-shared/activity-log";
import type { IAppStore } from "instrument/window/history/history";

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
    selected: boolean;
    getListItemElement(appStore: IAppStore): React.ReactNode;
    canBePartOfMultiChart: boolean;
}

////////////////////////////////////////////////////////////////////////////////

export class HistoryItem implements IHistoryItem {
    id: string;
    sid: string | null;
    oid: string;
    date: Date;
    type: string;
    @observable message: string;
    _data: any;
    @observable selected: boolean;
    deleted: boolean;
    canBePartOfMultiChart = false;

    constructor(
        activityLogEntry: IActivityLogEntry,
        public appStore: IAppStore
    ) {
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
    }

    deleteLog() {
        logDelete(
            this.appStore.history.options.store,
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

    get data() {
        if (this._data !== undefined) {
            return this._data;
        }
        this._data = loadData(this.appStore.history.options.store, this.id);
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

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return null;
    }

    get sourceDescriptionElement() {
        if (
            this.sid &&
            this.appStore.history.options.store.getSourceDescription
        ) {
            const source =
                this.appStore.history.options.store.getSourceDescription(
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
}
