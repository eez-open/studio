import React from "react";
import { observable } from "mobx";

import { formatDuration } from "eez-studio-shared/util";
import { IActivityLogEntry, loadData, logDelete } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";

import { IAppStore } from "instrument/window/history/history";

import { itemsStore, getSource } from "notebook/store";

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
    listItemElement: JSX.Element | null;
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

    constructor(activityLogEntry: IActivityLogEntry, public appStore: IAppStore) {
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

    get listItemElement(): JSX.Element | null {
        return null;
    }

    get sourceDescriptionElement() {
        if (this.appStore.history.options.store === itemsStore && this.sid) {
            const source = getSource(this.sid);
            if (source) {
                return (
                    <p>
                        <HistoryItemDate>{`Source: ${source.instrumentName}`}</HistoryItemDate>
                    </p>
                );
            }
        }
        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

export const HistoryItemDiv = styled.div`
    border-radius: 8px;
    padding: 0px 10px;
    overflow: visible;

    p,
    pre {
        margin-bottom: 0;
    }

    pre {
        user-select: auto;
    }
`;

export const HistoryItemDate = styled.small.attrs({
    className: "EezStudio_HistoryItemDate text-muted"
})`
    padding-right: 10px;
    user-select: auto;
`;
