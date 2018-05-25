import { IActivityLogEntry } from "shared/activity-log";

import { IHistoryItem, HistoryItem } from "instrument/window/history-item";

import * as GenericWaveformModule from "instrument/window/waveform/generic";
import * as MultiWaveformModule from "instrument/window/waveform/multi";
import * as DlogWaveformModule from "instrument/window/waveform/dlog";

import * as CreatedHistoryItemModule from "instrument/window/history-items/created";
import * as ConnectedHistoryItemModule from "instrument/window/history-items/connected";
import * as ConnectFailedHistoryItemModule from "instrument/window/history-items/connect-failed";
import * as DisconnectedHistoryItemModule from "instrument/window/history-items/disconnected";
import * as RequestHistoryItemModule from "instrument/window/history-items/request";
import * as AnswerHistoryItemModule from "instrument/window/history-items/answer";
import * as NoteHistoryItemModule from "instrument/window/history-items/note";
import * as FileHistoryItemModule from "instrument/window/history-items/file";
import * as ListHistoryItemModule from "instrument/window/history-items/list";
import * as ScriptHistoryItemModule from "instrument/window/history-items/script";

////////////////////////////////////////////////////////////////////////////////

export function createHistoryItem(activityLogEntry: IActivityLogEntry) {
    if (
        activityLogEntry.type === "instrument/created" ||
        activityLogEntry.type === "instrument/restored"
    ) {
        const {
            CreatedHistoryItem
        } = require("instrument/window/history-items/created") as typeof CreatedHistoryItemModule;
        return new CreatedHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/connected") {
        const {
            ConnectedHistoryItem
        } = require("instrument/window/history-items/connected") as typeof ConnectedHistoryItemModule;
        return new ConnectedHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/connect-failed") {
        const {
            ConnectFailedHistoryItem
        } = require("instrument/window/history-items/connect-failed") as typeof ConnectFailedHistoryItemModule;
        return new ConnectFailedHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/disconnected") {
        const {
            DisconnectedHistoryItem
        } = require("instrument/window/history-items/disconnected") as typeof DisconnectedHistoryItemModule;
        return new DisconnectedHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/request") {
        const {
            RequestHistoryItem
        } = require("instrument/window/history-items/request") as typeof RequestHistoryItemModule;
        return new RequestHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/answer") {
        const {
            AnswerHistoryItem
        } = require("instrument/window/history-items/answer") as typeof AnswerHistoryItemModule;
        return new AnswerHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "activity-log/note") {
        const {
            NoteHistoryItem
        } = require("instrument/window/history-items/note") as typeof NoteHistoryItemModule;
        return new NoteHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type.startsWith("instrument/file")) {
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

        const {
            FileHistoryItem
        } = require("instrument/window/history-items/file") as typeof FileHistoryItemModule;
        return new FileHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/list") {
        const {
            ListHistoryItem
        } = require("instrument/window/history-items/list") as typeof ListHistoryItemModule;
        return new ListHistoryItem(activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/chart") {
        if (EEZStudio.windowType === "instrument") {
            const {
                MultiWaveform
            } = require("instrument/window/waveform/multi") as typeof MultiWaveformModule;
            return new MultiWaveform(activityLogEntry);
        } else {
            return new HistoryItem(activityLogEntry);
        }
    }

    if (activityLogEntry.type === "instrument/script") {
        const {
            ScriptHistoryItem
        } = require("instrument/window/history-items/script") as typeof ScriptHistoryItemModule;
        return new ScriptHistoryItem(activityLogEntry);
    }

    throw "Unknown activity log entry";
}

export function updateHistoryItemClass(historyItem: IHistoryItem): IHistoryItem {
    if (historyItem.type.startsWith("instrument/file")) {
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
