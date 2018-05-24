import { observable, computed, runInAction, action, reaction } from "mobx";
import { bind } from "bind-decorator";

import { formatDate } from "shared/util";
import { db } from "shared/db";
import {
    IActivityLogEntry,
    activityLogStore,
    IActivityLogFilterSpecification,
    logDelete,
    logUndelete
} from "shared/activity-log";
import { StoreOperation, beginTransaction, commitTransaction } from "shared/store";
import { scheduleTask, Priority } from "shared/scheduler";

import { confirm } from "shared/ui/dialog";

import * as notification from "shared/ui/notification";

import { appStore } from "instrument/window/app-store";

import { IHistoryItem } from "instrument/window/history-item";
import { createHistoryItem, updateHistoryItemClass } from "instrument/window/history-item-factory";

import {
    moveToTopOfConnectionHistory,
    moveToBottomOfConnectionHistory,
    selectHistoryItem
} from "instrument/window/terminal/terminal";

////////////////////////////////////////////////////////////////////////////////

const CONF_SINGLE_SEARCH_LIMIT = 100;
const CONF_BLOCK_SIZE = 100;

////////////////////////////////////////////////////////////////////////////////

const historyItemMap = new Map<string, IHistoryItem>();
export const historyItemBlocks = observable<IHistoryItem[]>([]);

////////////////////////////////////////////////////////////////////////////////

function findHistoryItemById(id: string) {
    for (let i = 0; i < historyItemBlocks.length; ++i) {
        const historyItems = historyItemBlocks[i];
        for (let j = 0; j < historyItems.length; ++j) {
            let historyItem = historyItems[j];
            if (historyItem.id === id) {
                return { block: historyItems, blockIndex: i, index: j };
            }
        }
    }

    return undefined;
}

export function getHistoryItemById(id: string) {
    const historyItem = historyItemMap.get(id);
    if (historyItem) {
        return historyItem;
    }

    const row = db
        .prepare(
            `SELECT id, ${
                activityLogStore.nonTransientAndNonLazyProperties
            } FROM activityLog WHERE id=?`
        )
        .get(id);

    if (row) {
        const activityLogEntry = activityLogStore.dbRowToObject(row);
        const historyItem = createHistoryItem(activityLogEntry);
        historyItemMap.set(historyItem.id, historyItem);
        return historyItem;
    }

    return undefined;
}

function filterActivityLogEntry(activityLogEntry: IActivityLogEntry) {
    if (appStore.filters.deleted) {
        return activityLogEntry.deleted;
    } else {
        if (activityLogEntry.deleted) {
            return false;
        }
    }

    if (appStore.filters.connectsAndDisconnects) {
        if (
            [
                "instrument/created",
                "instrument/connected",
                "instrument/connect-failed",
                "instrument/disconnected"
            ].indexOf(activityLogEntry.type) !== -1
        ) {
            return true;
        }
    }

    if (appStore.filters.scpi) {
        if (["instrument/request", "instrument/answer"].indexOf(activityLogEntry.type) !== -1) {
            return true;
        }
    }

    if (appStore.filters.downloadedFiles) {
        if (activityLogEntry.type === "instrument/file-download") {
            return true;
        }
    }

    if (appStore.filters.uploadedFiles) {
        if (activityLogEntry.type === "instrument/file-upload") {
            return true;
        }
    }

    if (appStore.filters.attachedFiles) {
        if (activityLogEntry.type === "instrument/file-attachment") {
            return true;
        }
    }

    if (appStore.filters.charts) {
        if (activityLogEntry.type === "instrument/chart") {
            return true;
        }
    }

    if (appStore.filters.lists) {
        if (activityLogEntry.type === "instrument/list") {
            return true;
        }
    }

    if (appStore.filters.notes) {
        if (activityLogEntry.type === "activity-log/note") {
            return true;
        }
    }

    if (appStore.filters.launchedScripts) {
        if (activityLogEntry.type === "instrument/script") {
            return true;
        }
    }

    return false;
}

function getFilter() {
    const filters: string[] = [];

    if (appStore.filters.deleted) {
        filters.push("deleted");
    } else {
        filters.push("NOT deleted");

        const types: string[] = [];

        if (appStore.filters.connectsAndDisconnects) {
            types.push(
                "instrument/created",
                "instrument/connected",
                "instrument/connect-failed",
                "instrument/disconnected"
            );
        }

        if (appStore.filters.scpi) {
            types.push("instrument/request", "instrument/answer");
        }

        if (appStore.filters.downloadedFiles) {
            types.push("instrument/file-download");
        }

        if (appStore.filters.uploadedFiles) {
            types.push("instrument/file-upload");
        }

        if (appStore.filters.attachedFiles) {
            types.push("instrument/file-attachment");
        }

        if (appStore.filters.charts) {
            types.push("instrument/chart");
        }

        if (appStore.filters.lists) {
            types.push("instrument/list");
        }

        if (appStore.filters.notes) {
            types.push("activity-log/note");
        }

        if (appStore.filters.launchedScripts) {
            types.push("instrument/script");
        }

        if (types.length > 0) {
            filters.push("(" + types.map(type => `type == "${type}"`).join(" OR ") + ")");
        } else {
            filters.push("0");
        }
    }

    return "AND " + filters.join(" AND ");
}

////////////////////////////////////////////////////////////////////////////////

function pushActivityLogEntry(activityLogEntry: IActivityLogEntry, op: StoreOperation) {
    historyNavigator.updateDeletedCount();

    if (activityLogEntry.type === "instrument/connected") {
        let i;
        for (i = 0; i < historySessions.sessions.length; ++i) {
            if (activityLogEntry.date < historySessions.sessions[i].activityLogEntry.date) {
                break;
            }
        }
        historySessions.sessions.splice(i, 0, {
            selected: false,
            id: activityLogEntry.id,
            activityLogEntry
        });
    }

    if (!filterActivityLogEntry(activityLogEntry)) {
        removeHistoryItemFromBlocks(activityLogEntry);
        return;
    }

    // add to map of all history items
    if (historyItemMap.get(activityLogEntry.id)) {
        return;
    }
    const historyItem = createHistoryItem(activityLogEntry);
    historyItemMap.set(historyItem.id, historyItem);

    // increment day counter in calandar
    let day = new Date(
        historyItem.date.getFullYear(),
        historyItem.date.getMonth(),
        historyItem.date.getDate()
    );
    historyCalendar.incrementCounter(day);

    if (op === "restore") {
        // this item was restored from undo buffer,
        // find the block (according to datetime) to which it should be added
        let i;
        for (i = 0; i < historyItemBlocks.length; ++i) {
            const historyItemBlock = historyItemBlocks[i];
            if (
                historyItemBlock.length > 0 &&
                (historyItem.date < historyItemBlock[0].date ||
                    (historyItem.date === historyItemBlock[0].date &&
                        historyItem.id < historyItemBlock[0].id))
            ) {
                break;
            }
        }

        if (i == 0) {
            // add at the beginning
            if (historyItemBlocks.length === 0) {
                historyItemBlocks.push([historyItem]);
            } else {
                historyItemBlocks[0].unshift(historyItem);
            }
        } else {
            // add inside existing block
            const historyItemBlock = historyItemBlocks[i - 1];
            let j;
            for (j = 0; j < historyItemBlock.length; ++j) {
                if (
                    historyItemBlock.length > 0 &&
                    (historyItem.date < historyItemBlock[j].date ||
                        (historyItem.date === historyItemBlock[j].date &&
                            historyItem.id < historyItemBlock[j].id))
                ) {
                    break;
                }
            }

            if (j == 0) {
                // add to the front of the block
                historyItemBlock.unshift(historyItem);
            } else if (j == historyItemBlock.length) {
                // add to the back of the block
                historyItemBlock.push(historyItem);
            } else {
                // add inside block
                historyItemBlock.splice(j, 0, historyItem);
            }
        }
    } else {
        // This is a new history item,
        // add it to the bottom of history list (last block) ...
        if (historyNavigator.hasNewer) {
            historyCalendar.showRecent();
        } else {
            if (historyItemBlocks[historyItemBlocks.length - 1].length < CONF_BLOCK_SIZE) {
                historyItemBlocks[historyItemBlocks.length - 1].push(historyItem);
            } else {
                historyItemBlocks.push([historyItem]);
            }
        }
        // ... and scroll to the bottom of history list.
        moveToBottomOfConnectionHistory();
    }
}

function updateHistoryItem(activityLogEntry: IActivityLogEntry) {
    let historyItem;

    const foundItem = findHistoryItemById(activityLogEntry.id);
    if (foundItem) {
        historyItem = foundItem.block[foundItem.index];
    } else {
        historyItem = historyItemMap.get(activityLogEntry.id);
    }

    if (!historyItem) {
        console.warn("history item not found");
        return;
    }

    if (activityLogEntry.message !== undefined) {
        historyItem.message = activityLogEntry.message;
    }

    const updatedHistoryItem = updateHistoryItemClass(historyItem);
    if (updatedHistoryItem !== historyItem) {
        if (foundItem) {
            foundItem.block[foundItem.index] = updatedHistoryItem;
        }
        historyItemMap.set(updatedHistoryItem.id, updatedHistoryItem);
    }
}

function removeHistoryItem(activityLogEntry: IActivityLogEntry) {
    historyNavigator.updateDeletedCount();

    // remove sesssion if found in historySessions list
    for (let i = 0; i < historySessions.sessions.length; ++i) {
        if (historySessions.sessions[i].id === activityLogEntry.id) {
            historySessions.sessions.splice(i, 1);
            break;
        }
    }

    removeHistoryItemFromBlocks(activityLogEntry);
}

function removeHistoryItemFromBlocks(activityLogEntry: IActivityLogEntry) {
    const foundItem = findHistoryItemById(activityLogEntry.id);
    if (foundItem) {
        foundItem.block.splice(foundItem.index, 1);
        if (foundItem.block.length === 0) {
            historyItemBlocks.splice(foundItem.blockIndex, 1);
        }
    }

    if (historyItemMap.get(activityLogEntry.id)) {
        historyItemMap.delete(activityLogEntry.id);
    } else {
        console.warn("history item not found");
    }
}

////////////////////////////////////////////////////////////////////////////////

function rowsToHistoryItems(rows: any[]) {
    const historyItems: IHistoryItem[] = [];
    rows.forEach(row => {
        let historyItem = historyItemMap.get(row.id.toString());
        if (!historyItem) {
            const activityLogEntry = activityLogStore.dbRowToObject(row);
            historyItem = createHistoryItem(activityLogEntry);
            historyItemMap.set(historyItem.id, historyItem);
        }
        historyItems.push(historyItem);
    });
    return historyItems;
}

function displayRows(rows: any[]) {
    runInAction(() => {
        historyItemBlocks.replace([rowsToHistoryItems(rows)]);
        historyNavigator.update();
    });
}

////////////////////////////////////////////////////////////////////////////////

class HistoryCalendar {
    @observable minDate: Date;
    @observable maxDate: Date;
    @observable counters = new Map<string, number>();
    @observable showFirstHistoryItemAsSelectedDay: boolean = false;

    @action
    load() {
        this.minDate = new Date();
        this.maxDate = new Date();
        this.counters = new Map<string, number>();

        try {
            const rows = db
                .prepare(
                    `SELECT
                        date,
                        count(*) AS count
                    FROM (
                        SELECT
                            date(date / 1000, "unixepoch", "localtime") AS date
                        FROM
                            activityLog
                        WHERE
                            oid=? ${getFilter()}
                    )
                    GROUP BY
                        date
                    ORDER BY
                        date`
                )
                .all(appStore.instrument!.id);

            if (rows.length > 0) {
                rows.forEach(row => this.counters.set(row.date, row.count));
                this.minDate = new Date(rows[0].date + " 00:00:00");
                this.maxDate = new Date();
            } else {
                this.minDate = this.maxDate = new Date();
            }
        } catch (err) {
            notification.error(err);
        }
    }

    getActivityCount(day: Date) {
        return this.counters.get(formatDate(day, "YYYY-MM-DD")) || 0;
    }

    @action
    update(selectedDay?: Date) {
        if (selectedDay) {
            this.showFirstHistoryItemAsSelectedDay = true;

            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${activityLogStore.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                activityLog
                            WHERE
                                oid=? AND date >= ? ${getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, selectedDay.getTime(), CONF_BLOCK_SIZE);

            displayRows(rows);

            moveToTopOfConnectionHistory();
        } else {
            this.showFirstHistoryItemAsSelectedDay = false;

            // display most recent log items
            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${activityLogStore.nonTransientAndNonLazyProperties}
                    FROM
                        activityLog
                    WHERE
                        oid=? ${getFilter()}
                    ORDER BY
                        date DESC
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, CONF_BLOCK_SIZE);

            rows.reverse();

            displayRows(rows);

            moveToBottomOfConnectionHistory();
        }
    }

    @computed
    get selectedDay() {
        if (this.showFirstHistoryItemAsSelectedDay) {
            return historyNavigator.firstHistoryItem && historyNavigator.firstHistoryItem.date;
        } else {
            return historyNavigator.lastHistoryItem && historyNavigator.lastHistoryItem.date;
        }
    }

    isSelectedDay(day: Date) {
        if (historySearch.selectedSearchResult) {
            return false;
        }
        let selectedDay = this.selectedDay;
        return (
            selectedDay &&
            (day.getFullYear() === selectedDay.getFullYear() &&
                day.getMonth() === selectedDay.getMonth() &&
                day.getDate() === selectedDay.getDate())
        );
    }

    isSelectedMonth(month: Date) {
        if (historySearch.selectedSearchResult) {
            return false;
        }
        let selectedDay = this.selectedDay;
        return (
            selectedDay &&
            (month.getFullYear() === selectedDay.getFullYear() &&
                month.getMonth() === selectedDay.getMonth())
        );
    }

    @action
    showRecent() {
        historySearch.selectSearchResult(undefined);
        this.update();
    }

    @action
    selectDay(day: Date) {
        if (day > this.maxDate) {
            this.maxDate = day;
        }

        historySearch.selectSearchResult(undefined);
        this.update(day);
    }

    @action
    incrementCounter(day: Date) {
        const key = formatDate(day, "YYYY-MM-DD");
        this.counters.set(key, (this.counters.get(key) || 0) + 1);
    }
}

export const historyCalendar = new HistoryCalendar();

////////////////////////////////////////////////////////////////////////////////

export class SearchResult {
    constructor(public logEntry: IActivityLogEntry) {}

    @observable selected = false;
}

////////////////////////////////////////////////////////////////////////////////

class HistorySearch {
    @observable searchActive: boolean = false;
    @observable searchResults: SearchResult[] = [];
    @observable searchInProgress: boolean = false;
    searchText: string;
    searchLastLogDate: any;
    searchLoopTimeout: any;
    @observable selectedSearchResult: SearchResult | undefined;

    update() {
        this.search("");
    }

    @action
    search(searchText: string) {
        this.stopSearch();

        if (searchText.length < 1) {
            return;
        }

        runInAction(() => {
            this.searchActive = true;
            this.searchInProgress = true;
        });

        this.searchText = searchText;
        this.searchLastLogDate = new Date(0);

        this.searchLoop();
    }

    @bind
    searchLoop() {
        this.searchLoopTimeout = undefined;

        // (
        //     (
        //         (
        //             type = "instrument/request" OR
        //             type = "instrument/answer" OR
        //             type = "activity-log/note"
        //         ) AND
        //             message LIKE ?
        //     )

        //     OR

        //     ((type = "instrument/file-download" || type = "instrument/file-upload" || type = "instrument/file-attachment") AND json_extract(message, '$.note') LIKE ?)
        // )

        const rows = db
            .prepare(
                `SELECT
                    id,
                    ${activityLogStore.nonTransientAndNonLazyProperties}
                FROM
                    activityLog
                WHERE
                    oid=? AND
                    date > ? AND
                    message LIKE ? ${getFilter()}
                ORDER BY
                    date
                LIMIT
                    ?`
            )
            .all(
                appStore.instrument!.id,
                this.searchLastLogDate.getTime(),
                "%" + this.searchText + "%",
                CONF_SINGLE_SEARCH_LIMIT
            );

        runInAction(() => {
            rows.forEach(row => {
                const activityLogEntry = activityLogStore.dbRowToObject(row);
                this.searchResults.push(new SearchResult(activityLogEntry));
                if (activityLogEntry.date > this.searchLastLogDate) {
                    this.searchLastLogDate = activityLogEntry.date;
                }
            });
        });

        if (rows.length >= CONF_SINGLE_SEARCH_LIMIT) {
            this.searchLoopTimeout = setTimeout(this.searchLoop, 0);
        } else {
            runInAction(() => {
                this.searchInProgress = false;
            });
        }
    }

    stopSearch() {
        if (this.searchActive) {
            runInAction(() => {
                this.searchActive = false;
                this.searchInProgress = false;
                this.searchResults.splice(0, this.searchResults.length);
            });

            this.selectSearchResult(undefined);

            if (this.searchLoopTimeout) {
                clearTimeout(this.searchLoopTimeout);
            }
        }
    }

    @action
    selectSearchResult(searchResult: SearchResult | undefined) {
        if (this.selectedSearchResult) {
            this.selectedSearchResult.selected = false;

            const historyItem = historyItemMap.get(this.selectedSearchResult.logEntry.id);
            if (historyItem) {
                historyItem.selected = false;
            }
        }

        this.selectedSearchResult = searchResult;

        if (searchResult) {
            searchResult.selected = true;

            const rows = db
                .prepare(
                    `SELECT * FROM (
                        SELECT * FROM (
                            SELECT
                                id,
                                ${activityLogStore.nonTransientAndNonLazyProperties}
                            FROM (
                                SELECT * FROM activityLog WHERE oid=? ${getFilter()} ORDER BY date
                            )
                            WHERE
                                date >= ?
                            LIMIT ?
                        )

                        UNION

                        SELECT * FROM (
                            SELECT
                                id,
                                ${activityLogStore.nonTransientAndNonLazyProperties}
                            FROM (
                                SELECT * FROM activityLog WHERE oid=? ${getFilter()} ORDER BY date DESC
                            )
                            WHERE
                                date < ?
                            LIMIT ?
                        )
                    ) ORDER BY date`
                )
                .all(
                    appStore.instrument!.id,
                    searchResult.logEntry.date.getTime(),
                    CONF_BLOCK_SIZE / 2,
                    appStore.instrument!.id,
                    searchResult.logEntry.date.getTime(),
                    CONF_BLOCK_SIZE / 2
                );

            displayRows(rows);

            const historyItem = historyItemMap.get(searchResult.logEntry.id);
            if (historyItem) {
                historyItem.selected = true;
                selectHistoryItem(historyItem);
            } else {
                console.warn("History item not found", searchResult);
            }
        }
    }
}

export const historySearch = new HistorySearch();

///

class HistoryNavigator {
    @observable hasOlder = false;
    @observable hasNewer = false;

    @observable _selectedHistoryItems: IHistoryItem[] = [];

    @observable deletedCount: number = 0;
    updateDeletedCountTimer: any;

    @computed
    get selectedHistoryItems() {
        return appStore.selectHistoryItemsSpecification ? [] : this._selectedHistoryItems;
    }

    @action
    selectHistoryItems(historyItems: IHistoryItem[]) {
        this._selectedHistoryItems.forEach(historyItem => (historyItem.selected = false));
        this._selectedHistoryItems = historyItems;
        this._selectedHistoryItems.forEach(historyItem => (historyItem.selected = true));
    }

    @action.bound
    deleteHistoryItems() {
        if (historyNavigator.selectedHistoryItems.length > 0) {
            beginTransaction("Delete history items");

            historyNavigator.selectedHistoryItems.forEach(historyItem =>
                logDelete(historyItem, {
                    undoable: true
                })
            );

            commitTransaction();

            historyNavigator.selectHistoryItems([]);
        }
    }

    @action.bound
    restoreHistoryItems() {
        if (historyNavigator.selectedHistoryItems.length > 0) {
            beginTransaction("Restore history items");

            historyNavigator.selectedHistoryItems.forEach(historyItem =>
                logUndelete(historyItem, {
                    undoable: true
                })
            );

            commitTransaction();

            historyNavigator.selectHistoryItems([]);
        }
    }

    @action.bound
    purgeHistoryItems() {
        if (historyNavigator.selectedHistoryItems.length > 0) {
            confirm("Are you sure?", "This will permanently delete selected history items.", () => {
                if (historyNavigator.selectedHistoryItems.length > 0) {
                    beginTransaction("Purge history items");

                    historyNavigator.selectedHistoryItems.forEach(historyItem =>
                        logDelete(historyItem, {
                            undoable: false
                        })
                    );

                    commitTransaction();

                    historyNavigator.selectHistoryItems([]);
                }
            });
        }
    }

    update() {
        const firstHistoryItem = this.firstHistoryItem;
        if (firstHistoryItem) {
            const result = db
                .prepare(
                    `SELECT
                        count(*) AS count
                    FROM
                        activityLog
                    WHERE
                        oid=? AND date < ? ${getFilter()}`
                )
                .get(appStore.instrument!.id, firstHistoryItem.date.getTime());

            this.hasOlder = result && result.count > 0;
        } else {
            this.hasOlder = false;
        }

        const lastHistoryItem = this.lastHistoryItem;
        if (lastHistoryItem) {
            const result = db
                .prepare(
                    `SELECT
                        count(*) AS count
                    FROM
                        activityLog
                    WHERE
                        oid=? AND date > ? ${getFilter()}`
                )
                .get(appStore.instrument!.id, lastHistoryItem.date.getTime());

            this.hasNewer = result && result.count > 0;
        } else {
            this.hasNewer = false;
        }

        this.selectHistoryItems([]);

        this.updateDeletedCount();
    }

    updateDeletedCount() {
        if (this.updateDeletedCountTimer) {
            clearTimeout(this.updateDeletedCountTimer);
        }

        this.updateDeletedCountTimer = setTimeout(
            action(() => {
                this.updateDeletedCountTimer = undefined;

                const result = db
                    .prepare(
                        `SELECT
                    count(*) AS count
                FROM
                    activityLog
                WHERE
                    oid=? AND deleted`
                    )
                    .get(appStore.instrument!.id);

                this.deletedCount = result ? result.count : 0;

                if (this.deletedCount == 0 && appStore.filters.deleted) {
                    appStore.filters.deleted = false;
                }
            }),
            100
        );
    }

    get firstHistoryItem() {
        if (historyItemBlocks.length > 0) {
            const firstBlock = historyItemBlocks[0];
            if (firstBlock.length > 0) {
                return firstBlock[0];
            }
        }
        return undefined;
    }

    get lastHistoryItem() {
        if (historyItemBlocks.length > 0) {
            const lastBlock = historyItemBlocks[historyItemBlocks.length - 1];
            if (lastBlock.length > 0) {
                return lastBlock[lastBlock.length - 1];
            }
        }
        return undefined;
    }

    @action.bound
    loadOlder() {
        const firstHistoryItem = this.firstHistoryItem;
        if (firstHistoryItem) {
            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${activityLogStore.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                activityLog
                            WHERE
                                oid=? AND date < ? ${getFilter()}
                            ORDER BY
                                date DESC
                        )
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, firstHistoryItem.date.getTime(), CONF_BLOCK_SIZE);

            rows.reverse();

            if (rows.length > 0) {
                historyCalendar.showFirstHistoryItemAsSelectedDay = true;
                historyItemBlocks.splice(0, 0, rowsToHistoryItems(rows));
                this.update();
            }
        }
    }

    @action.bound
    loadNewer() {
        const lastHistoryItem = this.lastHistoryItem;
        if (lastHistoryItem) {
            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${activityLogStore.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                activityLog
                            WHERE
                                oid=? AND date > ? ${getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, lastHistoryItem.date.getTime(), CONF_BLOCK_SIZE);

            if (rows.length > 0) {
                historyCalendar.showFirstHistoryItemAsSelectedDay = false;
                historyItemBlocks.push(rowsToHistoryItems(rows));
                this.update();
            }
        }
    }
}

export const historyNavigator = new HistoryNavigator();

////////////////////////////////////////////////////////////////////////////////

let reactionTimeout: any;

reaction(
    () => getFilter(),
    filter => {
        if (reactionTimeout) {
            clearTimeout(reactionTimeout);
        }
        reactionTimeout = setTimeout(() => {
            reactionTimeout = undefined;
            historyCalendar.load();
            historyCalendar.update();
            historySearch.update();
        }, 10);
    }
);

////////////////////////////////////////////////////////////////////////////////

export interface ISession {
    selected: boolean;
    id: string;
    activityLogEntry: IActivityLogEntry;
}

class HistorySessions {
    @observable sessions: ISession[] = [];
    @observable selectedSession: ISession | undefined;

    @action
    load() {
        const rows = db
            .prepare(
                `SELECT
                    id,
                    ${activityLogStore.nonTransientAndNonLazyProperties}
                FROM
                    activityLog
                WHERE
                    oid=? AND type = "instrument/connected"`
            )
            .all(appStore.instrument!.id);
        this.sessions = rowsToHistoryItems(rows).map(activityLogEntry => ({
            selected: false,
            id: activityLogEntry.id,
            activityLogEntry
        }));
    }

    @action.bound
    selectSession(selectedSession: ISession | undefined) {
        if (this.selectedSession) {
            this.selectedSession.selected = false;
        }
        this.selectedSession = selectedSession;
        if (this.selectedSession) {
            this.selectedSession.selected = true;
        }

        if (selectedSession) {
            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${activityLogStore.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                activityLog
                            WHERE
                                oid=? AND date >= ? ${getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(
                    appStore.instrument!.id,
                    selectedSession.activityLogEntry.date.getTime(),
                    CONF_BLOCK_SIZE
                );

            displayRows(rows);

            moveToTopOfConnectionHistory();
        }
    }
}

export const historySessions = new HistorySessions();

////////////////////////////////////////////////////////////////////////////////

scheduleTask("Watch activity log", Priority.Middle, () => {
    activityLogStore.watch(
        {
            createObject(object: any, op: StoreOperation) {
                runInAction(() => pushActivityLogEntry(object, op));
            },
            updateObject(changes: any) {
                updateHistoryItem(changes);
            },
            deleteObject(object: any) {
                runInAction(() => removeHistoryItem(object));
            }
        },
        {
            skipInitialQuery: true,
            oid: appStore.instrument!.id
        } as IActivityLogFilterSpecification
    );
});

scheduleTask(
    "Show most recent log items",
    Priority.Middle,
    action(() => {
        historyCalendar.update();
    })
);

scheduleTask(
    "Load calendar",
    Priority.Low,
    action(() => {
        historyCalendar.load();
    })
);

scheduleTask(
    "Load sessions ",
    Priority.Low,
    action(() => {
        historySessions.load();
    })
);
