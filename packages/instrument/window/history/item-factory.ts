import type { IStore } from "eez-studio-shared/store";

import type { IActivityLogEntry } from "instrument/window/history/activity-log";

import type * as FileTypeModule from "instrument/connection/file-type";

import type * as GenericWaveformModule from "instrument/window/waveform/generic";
import type * as MultiWaveformModule from "instrument/window/waveform/multi";
import type * as DlogWaveformModule from "instrument/window/waveform/dlog";

import type { IHistoryItem, HistoryItem } from "instrument/window/history/item";

import type * as CreatedHistoryItemModule from "instrument/window/history/items/created";
import type * as ConnectedHistoryItemModule from "instrument/window/history/items/connected";
import type * as ConnectFailedHistoryItemModule from "instrument/window/history/items/connect-failed";
import type * as DisconnectedHistoryItemModule from "instrument/window/history/items/disconnected";
import type * as RequestHistoryItemModule from "instrument/window/history/items/request";
import type * as AnswerHistoryItemModule from "instrument/window/history/items/answer";
import type * as NoteHistoryItemModule from "instrument/window/history/items/note";
import type * as FileHistoryItemModule from "instrument/window/history/items/file";
import type * as ListHistoryItemModule from "instrument/window/history/items/list";
import type * as PlotterHistoryItemModule from "instrument/window/history/items/plotter";
import type * as PlotlyHistoryItemModule from "instrument/window/history/items/plotly";
import type * as ScriptHistoryItemModule from "instrument/window/history/items/script";
import type * as TabulatorHistoryItemModule from "instrument/window/history/items/tabulator";
import type * as MediaHistoryItemModule from "instrument/window/history/items/media";
import type * as UnknownHistoryItemModule from "instrument/window/history/items/unknown";

////////////////////////////////////////////////////////////////////////////////

function getFileSpecializationItem(
    store: IStore,
    activityLogEntry: IActivityLogEntry
) {
    const { ListHistoryItem, isTableList } =
        require("instrument/window/history/items/list") as typeof ListHistoryItemModule;

    if (isTableList(activityLogEntry)) {
        return new ListHistoryItem(store, activityLogEntry);
    }

    const { isDlogWaveform } =
        require("instrument/connection/file-type") as typeof FileTypeModule;

    const { DlogWaveform } =
        require("instrument/window/waveform/dlog") as typeof DlogWaveformModule;

    if (isDlogWaveform(activityLogEntry)) {
        return new DlogWaveform(store, activityLogEntry);
    }

    const { isWaveform, Waveform } =
        require("instrument/window/waveform/generic") as typeof GenericWaveformModule;

    if (isWaveform(activityLogEntry)) {
        return new Waveform(store, activityLogEntry);
    }

    return undefined;
}

export function createHistoryItem(
    store: IStore,
    activityLogEntry: IActivityLogEntry
): HistoryItem {
    if (
        activityLogEntry.type === "instrument/created" ||
        activityLogEntry.type === "instrument/deleted" ||
        activityLogEntry.type === "instrument/restored"
    ) {
        const { CreatedHistoryItem } =
            require("instrument/window/history/items/created") as typeof CreatedHistoryItemModule;
        return new CreatedHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/connected") {
        const { ConnectedHistoryItem } =
            require("instrument/window/history/items/connected") as typeof ConnectedHistoryItemModule;
        return new ConnectedHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/connect-failed") {
        const { ConnectFailedHistoryItem } =
            require("instrument/window/history/items/connect-failed") as typeof ConnectFailedHistoryItemModule;
        return new ConnectFailedHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/disconnected") {
        const { DisconnectedHistoryItem } =
            require("instrument/window/history/items/disconnected") as typeof DisconnectedHistoryItemModule;
        return new DisconnectedHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/request") {
        const { RequestHistoryItem } =
            require("instrument/window/history/items/request") as typeof RequestHistoryItemModule;
        return new RequestHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/answer") {
        const { AnswerHistoryItem } =
            require("instrument/window/history/items/answer") as typeof AnswerHistoryItemModule;
        return new AnswerHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "activity-log/note") {
        const { NoteHistoryItem } =
            require("instrument/window/history/items/note") as typeof NoteHistoryItemModule;
        return new NoteHistoryItem(store, activityLogEntry);
    }

    if (
        activityLogEntry.type.startsWith("instrument/file") ||
        activityLogEntry.type.startsWith("instrument/received")
    ) {
        const item = getFileSpecializationItem(store, activityLogEntry);
        if (item) {
            return item;
        }

        const { FileHistoryItem } =
            require("instrument/window/history/items/file") as typeof FileHistoryItemModule;

        return new FileHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/list") {
        const { ListHistoryItem } =
            require("instrument/window/history/items/list") as typeof ListHistoryItemModule;
        return new ListHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/chart") {
        const { MultiWaveform } =
            require("instrument/window/waveform/multi") as typeof MultiWaveformModule;
        return new MultiWaveform(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/plotter") {
        const { PlotterHistoryItem } =
            require("instrument/window/history/items/plotter") as typeof PlotterHistoryItemModule;
        return new PlotterHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/plotly") {
        const { PlotlyHistoryItem } =
            require("instrument/window/history/items/plotly") as typeof PlotlyHistoryItemModule;
        return new PlotlyHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/script") {
        const { ScriptHistoryItem } =
            require("instrument/window/history/items/script") as typeof ScriptHistoryItemModule;
        return new ScriptHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "instrument/tabulator") {
        const { TabulatorHistoryItem } =
            require("instrument/window/history/items/tabulator") as typeof TabulatorHistoryItemModule;
        return new TabulatorHistoryItem(store, activityLogEntry);
    }

    if (activityLogEntry.type === "activity-log/media") {
        const { MediaHistoryItem } =
            require("instrument/window/history/items/media") as typeof MediaHistoryItemModule;
        return new MediaHistoryItem(store, activityLogEntry);
    }

    const { UnknownHistoryItem } =
        require("instrument/window/history/items/unknown") as typeof UnknownHistoryItemModule;
    return new UnknownHistoryItem(store, activityLogEntry);
}

export function updateHistoryItemClass(
    store: IStore,
    historyItem: IHistoryItem
): IHistoryItem {
    if (historyItem.type.startsWith("instrument/file")) {
        const item = getFileSpecializationItem(store, historyItem);
        if (item) {
            return item;
        }
    }
    return historyItem;
}

export function getReferencedItemIds(item: IActivityLogEntry): string[] {
    if (item.type === "instrument/chart") {
        const message = JSON.parse(item.message);
        const waveformLinks: MultiWaveformModule.IWaveformLink[] =
            message.waveformLinks || message;
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
                Object.assign({}, waveformLink, {
                    id: oldToNewId.get(waveformLink.id)
                })
            )
            .filter(waveformLink => !!waveformLink.id);

        const newMessage = Object.assign(oldMessage, {
            waveformLinks: newWaveformLinks
        });

        return JSON.stringify(newMessage);
    }

    return item.message;
}

export function rowsToHistoryItems(store: IStore, rows: any[]) {
    const historyItems: IHistoryItem[] = [];
    rows.forEach(row => {
        const activityLogEntry = store.dbRowToObject(row);
        const historyItem = createHistoryItem(store, activityLogEntry);
        historyItems.push(historyItem);
    });
    return historyItems;
}
