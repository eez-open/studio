import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import * as GenericWaveformModule from "instrument/window/waveform/generic";
import * as MultiWaveformModule from "instrument/window/waveform/multi";
import * as DlogFileModule from "instrument/window/waveform/dlog-file";
import * as DlogWaveformModule from "instrument/window/waveform/dlog";

import { IHistoryItem, HistoryItem } from "instrument/window/history/item";

import * as SessionHistoryItemModule from "instrument/window/history/items/session";
import * as CreatedHistoryItemModule from "instrument/window/history/items/created";
import * as ConnectedHistoryItemModule from "instrument/window/history/items/connected";
import * as ConnectFailedHistoryItemModule from "instrument/window/history/items/connect-failed";
import * as DisconnectedHistoryItemModule from "instrument/window/history/items/disconnected";
import * as RequestHistoryItemModule from "instrument/window/history/items/request";
import * as AnswerHistoryItemModule from "instrument/window/history/items/answer";
import * as NoteHistoryItemModule from "instrument/window/history/items/note";
import * as FileHistoryItemModule from "instrument/window/history/items/file";
import * as ListHistoryItemModule from "instrument/window/history/items/list";
import * as ScriptHistoryItemModule from "instrument/window/history/items/script";

////////////////////////////////////////////////////////////////////////////////

function getFileSpecializationItem(activityLogEntry: IActivityLogEntry, appStore?: any) {
    const {
        ListHistoryItem,
        isTableList
    } = require("instrument/window/history/items/list") as typeof ListHistoryItemModule;

    if (isTableList(activityLogEntry)) {
        return new ListHistoryItem(activityLogEntry, appStore);
    }

    const {
        isDlogWaveform
    } = require("instrument/window/waveform/dlog-file") as typeof DlogFileModule;

    const {
        DlogWaveform
    } = require("instrument/window/waveform/dlog") as typeof DlogWaveformModule;

    if (isDlogWaveform(activityLogEntry)) {
        return new DlogWaveform(activityLogEntry, appStore);
    }

    const {
        isWaveform,
        Waveform
    } = require("instrument/window/waveform/generic") as typeof GenericWaveformModule;

    if (isWaveform(activityLogEntry)) {
        return new Waveform(activityLogEntry, appStore);
    }

    return undefined;
}

export function createHistoryItem(
    activityLogEntry: IActivityLogEntry,
    appStore?: any
): HistoryItem {
    if (activityLogEntry.type.startsWith("activity-log/session")) {
        const {
            SessionHistoryItem
        } = require("instrument/window/history/items/session") as typeof SessionHistoryItemModule;
        return new SessionHistoryItem(activityLogEntry, appStore);
    }

    if (
        activityLogEntry.type === "instrument/created" ||
        activityLogEntry.type === "instrument/deleted" ||
        activityLogEntry.type === "instrument/restored"
    ) {
        const {
            CreatedHistoryItem
        } = require("instrument/window/history/items/created") as typeof CreatedHistoryItemModule;
        return new CreatedHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/connected") {
        const {
            ConnectedHistoryItem
        } = require("instrument/window/history/items/connected") as typeof ConnectedHistoryItemModule;
        return new ConnectedHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/connect-failed") {
        const {
            ConnectFailedHistoryItem
        } = require("instrument/window/history/items/connect-failed") as typeof ConnectFailedHistoryItemModule;
        return new ConnectFailedHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/disconnected") {
        const {
            DisconnectedHistoryItem
        } = require("instrument/window/history/items/disconnected") as typeof DisconnectedHistoryItemModule;
        return new DisconnectedHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/request") {
        const {
            RequestHistoryItem
        } = require("instrument/window/history/items/request") as typeof RequestHistoryItemModule;
        return new RequestHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/answer") {
        const {
            AnswerHistoryItem
        } = require("instrument/window/history/items/answer") as typeof AnswerHistoryItemModule;
        return new AnswerHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "activity-log/note") {
        const {
            NoteHistoryItem
        } = require("instrument/window/history/items/note") as typeof NoteHistoryItemModule;
        return new NoteHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type.startsWith("instrument/file")) {
        if (appStore) {
            const item = getFileSpecializationItem(activityLogEntry, appStore);
            if (item) {
                return item;
            }
        }

        const {
            FileHistoryItem
        } = require("instrument/window/history/items/file") as typeof FileHistoryItemModule;
        return new FileHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/list") {
        const {
            ListHistoryItem
        } = require("instrument/window/history/items/list") as typeof ListHistoryItemModule;
        return new ListHistoryItem(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/chart") {
        const {
            MultiWaveform
        } = require("instrument/window/waveform/multi") as typeof MultiWaveformModule;
        return new MultiWaveform(activityLogEntry, appStore);
    }

    if (activityLogEntry.type === "instrument/script") {
        const {
            ScriptHistoryItem
        } = require("instrument/window/history/items/script") as typeof ScriptHistoryItemModule;
        return new ScriptHistoryItem(activityLogEntry, appStore);
    }

    throw "Unknown activity log entry";
}

export function updateHistoryItemClass(historyItem: IHistoryItem, appStore: any): IHistoryItem {
    if (historyItem.type.startsWith("instrument/file")) {
        const item = getFileSpecializationItem(historyItem, appStore);
        if (item) {
            return item;
        }
    }
    return historyItem;
}

export function getReferencedItemIds(item: IActivityLogEntry): string[] {
    if (item.type === "instrument/chart") {
        const message = JSON.parse(item.message);
        const waveformLinks: MultiWaveformModule.IWaveformLink[] = message.waveformLinks || message;
        return waveformLinks.map(waveformLink => waveformLink.id);
    }

    return [];
}

export function remapReferencedItemIds(
    item: {
        type: string;
        message: string;
    },
    oldToNewId: Map<string, string>
) {
    if (item.type === "instrument/chart") {
        const oldMessage = JSON.parse(item.message);

        const oldWaveformLinks: MultiWaveformModule.IWaveformLink[] =
            oldMessage.waveformLinks || oldMessage;

        const newWaveformLinks = oldWaveformLinks
            .map(waveformLink =>
                Object.assign({}, waveformLink, { id: oldToNewId.get(waveformLink.id) })
            )
            .filter(waveformLink => !!waveformLink.id);

        const newMessage = Object.assign(oldMessage, {
            waveformLinks: newWaveformLinks
        });

        return JSON.stringify(newMessage);
    }

    return item.message;
}
