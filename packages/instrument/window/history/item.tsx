import React from "react";
import { observable, makeObservable, runInAction } from "mobx";

import { formatDuration } from "eez-studio-shared/util";
import type { IStore } from "eez-studio-shared/store";

import {
    activityLogStore,
    IActivityLogEntry,
    loadData,
    logDelete
} from "instrument/window/history/activity-log";
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
            temporary: observable
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

    dispose() {}
}
