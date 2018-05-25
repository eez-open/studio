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
import {
    StoreOperation,
    IStoreOperationOptions,
    beginTransaction,
    commitTransaction
} from "shared/store";
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

class HistoryCalendar {
    @observable minDate: Date;
    @observable maxDate: Date;
    @observable counters = new Map<string, number>();
    @observable showFirstHistoryItemAsSelectedDay: boolean = false;

    constructor(public history: History) {}

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
                            oid=? ${this.history.getFilter()}
                    )
                    GROUP BY
                        date
                    ORDER BY
                        date`
                )
                .all(appStore.instrument!.id);

            if (rows.length > 0) {
                rows.forEach(row => this.counters.set(row.date, row.count.toNumber()));
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
                                oid=? AND date >= ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, selectedDay.getTime(), CONF_BLOCK_SIZE);

            this.history.displayRows(rows);

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
                        oid=? ${this.history.getFilter()}
                    ORDER BY
                        date DESC
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, CONF_BLOCK_SIZE);

            rows.reverse();

            this.history.displayRows(rows);

            moveToBottomOfConnectionHistory();
        }
    }

    @computed
    get selectedDay() {
        if (this.showFirstHistoryItemAsSelectedDay) {
            return (
                this.history.navigator.firstHistoryItem &&
                this.history.navigator.firstHistoryItem.date
            );
        } else {
            return (
                this.history.navigator.lastHistoryItem &&
                this.history.navigator.lastHistoryItem.date
            );
        }
    }

    isSelectedDay(day: Date) {
        if (this.history.search.selectedSearchResult) {
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
        if (this.history.search.selectedSearchResult) {
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
        this.history.search.selectSearchResult(undefined);
        this.update();
    }

    @action
    selectDay(day: Date) {
        if (day > this.maxDate) {
            this.maxDate = day;
        }

        this.history.search.selectSearchResult(undefined);
        this.update(day);
    }

    @action
    incrementCounter(day: Date) {
        const key = formatDate(day, "YYYY-MM-DD");
        this.counters.set(key, (this.counters.get(key) || 0) + 1);
    }

    @action
    decrementCounter(day: Date) {
        const key = formatDate(day, "YYYY-MM-DD");
        this.counters.set(key, (this.counters.get(key) || 0) - 1);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class SearchResult {
    constructor(public logEntry: IActivityLogEntry) {}

    @observable selected = false;
}

class HistorySearch {
    @observable searchActive: boolean = false;
    @observable searchResults: SearchResult[] = [];
    @observable searchInProgress: boolean = false;
    searchText: string;
    searchLastLogDate: any;
    searchLoopTimeout: any;
    @observable selectedSearchResult: SearchResult | undefined;

    constructor(public history: History) {}

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
                    message LIKE ? ${this.history.getFilter()}
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

            const historyItem = this.history.map.get(this.selectedSearchResult.logEntry.id);
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
                                SELECT * FROM activityLog WHERE oid=? ${this.history.getFilter()} ORDER BY date
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
                                SELECT * FROM activityLog WHERE oid=? ${this.history.getFilter()} ORDER BY date DESC
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

            this.history.displayRows(rows);

            const historyItem = this.history.map.get(searchResult.logEntry.id);
            if (historyItem) {
                historyItem.selected = true;
                selectHistoryItem(historyItem);
            } else {
                console.warn("History item not found", searchResult);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class HistoryNavigator {
    @observable hasOlder = false;
    @observable hasNewer = false;

    constructor(public history: History) {}

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
                        oid=? AND date < ? ${this.history.getFilter()}`
                )
                .get(appStore.instrument!.id, firstHistoryItem.date.getTime());

            this.hasOlder = result && result.count.toNumber() > 0;
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
                        oid=? AND date > ? ${this.history.getFilter()}`
                )
                .get(appStore.instrument!.id, lastHistoryItem.date.getTime());

            this.hasNewer = result && result.count.toNumber() > 0;
        } else {
            this.hasNewer = false;
        }

        this.history.selection.selectItems([]);
    }

    get firstHistoryItem() {
        if (this.history.blocks.length > 0) {
            const firstBlock = this.history.blocks[0];
            if (firstBlock.length > 0) {
                return firstBlock[0];
            }
        }
        return undefined;
    }

    get lastHistoryItem() {
        if (this.history.blocks.length > 0) {
            const lastBlock = this.history.blocks[this.history.blocks.length - 1];
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
                                oid=? AND date < ? ${this.history.getFilter()}
                            ORDER BY
                                date DESC
                        )
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, firstHistoryItem.date.getTime(), CONF_BLOCK_SIZE);

            rows.reverse();

            if (rows.length > 0) {
                this.history.calendar.showFirstHistoryItemAsSelectedDay = true;
                this.history.blocks.splice(0, 0, this.history.rowsToHistoryItems(rows));
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
                                oid=? AND date > ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(appStore.instrument!.id, lastHistoryItem.date.getTime(), CONF_BLOCK_SIZE);

            if (rows.length > 0) {
                this.history.calendar.showFirstHistoryItemAsSelectedDay = false;
                this.history.blocks.push(this.history.rowsToHistoryItems(rows));
                this.update();
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface ISession {
    selected: boolean;
    id: string;
    activityLogEntry: IActivityLogEntry;
}

class HistorySessions {
    @observable sessions: ISession[] = [];
    @observable selectedSession: ISession | undefined;

    constructor(public history: History) {}

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
        this.sessions = this.history.rowsToHistoryItems(rows).map(activityLogEntry => ({
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
                                oid=? AND date >= ? ${this.history.getFilter()}
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

            this.history.displayRows(rows);

            moveToTopOfConnectionHistory();
        }
    }

    onActivityLogEntryCreated(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.type === "instrument/connected") {
            let i;
            for (i = 0; i < this.sessions.length; ++i) {
                if (activityLogEntry.id === this.sessions[i].activityLogEntry.id) {
                    return;
                }
                if (activityLogEntry.date < this.sessions[i].activityLogEntry.date) {
                    break;
                }
            }
            this.sessions.splice(i, 0, {
                selected: false,
                id: activityLogEntry.id,
                activityLogEntry
            });
        }
    }

    onActivityLogEntryRemoved(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.type === "instrument/connected") {
            for (let i = 0; i < this.sessions.length; ++i) {
                if (this.sessions[i].id === activityLogEntry.id) {
                    this.sessions.splice(i, 1);
                    break;
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class HistorySelection {
    @observable _items: IHistoryItem[] = [];

    constructor(public history: History) {}

    @computed
    get items() {
        return appStore.selectHistoryItemsSpecification ? [] : this._items;
    }

    @action
    selectItems(historyItems: IHistoryItem[]) {
        this._items.forEach(historyItem => (historyItem.selected = false));
        this._items = historyItems;
        this._items.forEach(historyItem => (historyItem.selected = true));
    }
}

////////////////////////////////////////////////////////////////////////////////

class FilterStats {
    @observable connectsAndDisconnects = 0;
    @observable scpi = 0;
    @observable downloadedFiles = 0;
    @observable uploadedFiles = 0;
    @observable attachedFiles = 0;
    @observable charts = 0;
    @observable lists = 0;
    @observable notes = 0;
    @observable launchedScripts = 0;

    constructor() {
        scheduleTask(
            "Get filter stats",
            Priority.Lowest,
            action(() => {
                const rows = db
                    .prepare(
                        `SELECT
                            type, count(*) AS count
                        FROM
                            activityLog
                        WHERE
                            oid=? AND NOT deleted
                        GROUP BY
                            type`
                    )
                    .all(appStore.instrument!.id);

                rows.forEach(row => {
                    this.add(row.type, row.count.toNumber());
                });
            })
        );
    }

    add(type: string, amount: number) {
        if (
            [
                "instrument/created",
                "instrument/restored",
                "instrument/connected",
                "instrument/connect-failed",
                "instrument/disconnected"
            ].indexOf(type) !== -1
        ) {
            this.connectsAndDisconnects += amount;
        } else if (["instrument/request", "instrument/answer"].indexOf(type) !== -1) {
            this.scpi += amount;
        } else if (type === "instrument/file-download") {
            this.downloadedFiles += amount;
        } else if (type === "instrument/file-upload") {
            this.uploadedFiles += amount;
        } else if (type === "instrument/file-attachment") {
            this.attachedFiles += amount;
        } else if (type === "instrument/chart") {
            this.charts += amount;
        } else if (type === "instrument/list") {
            this.lists += amount;
        } else if (type === "activity-log/note") {
            this.notes += amount;
        } else if (type === "instrument/script") {
            this.launchedScripts += amount;
        }
    }

    onActivityLogEntryCreated(activityLogEntry: IActivityLogEntry) {
        this.add(activityLogEntry.type, 1);
    }

    onActivityLogEntryRemoved(activityLogEntry: IActivityLogEntry) {
        this.add(activityLogEntry.type, -11);
    }
}

export class History {
    map = new Map<string, IHistoryItem>();
    @observable blocks: IHistoryItem[][] = [];

    calendar = new HistoryCalendar(this);
    search = new HistorySearch(this);
    navigator = new HistoryNavigator(this);
    sessions = new HistorySessions(this);
    selection = new HistorySelection(this);

    filterStats: FilterStats;

    reactionTimeout: any;

    constructor(public isDeletedItemsHistory: boolean = false) {
        scheduleTask(
            "Watch activity log",
            isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
            () => {
                activityLogStore.watch(
                    {
                        createObject: (
                            object: any,
                            op: StoreOperation,
                            options: IStoreOperationOptions
                        ) => {
                            this.onCreateActivityLogEntry(object, op, options);
                        },
                        updateObject: (
                            changes: any,
                            op: StoreOperation,
                            options: IStoreOperationOptions
                        ) => {
                            this.onUpdateActivityLogEntry(changes, op, options);
                        },
                        deleteObject: (
                            object: any,
                            op: StoreOperation,
                            options: IStoreOperationOptions
                        ) => {
                            this.onDeleteActivityLogEntry(object, op, options);
                        }
                    },
                    {
                        skipInitialQuery: true,
                        oid: appStore.instrument!.id
                    } as IActivityLogFilterSpecification
                );
            }
        );

        scheduleTask(
            "Show most recent log items",
            isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
            action(() => {
                this.calendar.update();
            })
        );

        scheduleTask(
            "Load calendar",
            isDeletedItemsHistory ? Priority.Lowest : Priority.Low,
            action(() => {
                this.calendar.load();
            })
        );

        if (!isDeletedItemsHistory) {
            scheduleTask(
                "Load sessions",
                Priority.Low,
                action(() => {
                    this.sessions.load();
                })
            );
        }

        reaction(
            () => this.getFilter(),
            filter => {
                if (this.reactionTimeout) {
                    clearTimeout(this.reactionTimeout);
                }
                this.reactionTimeout = setTimeout(() => {
                    this.reactionTimeout = undefined;
                    this.calendar.load();
                    this.calendar.update();
                    this.search.update();
                }, 10);
            }
        );

        if (!isDeletedItemsHistory) {
            this.filterStats = new FilterStats();
        }
    }

    findHistoryItemById(id: string) {
        for (let i = 0; i < this.blocks.length; ++i) {
            const historyItems = this.blocks[i];
            for (let j = 0; j < historyItems.length; ++j) {
                let historyItem = historyItems[j];
                if (historyItem.id === id) {
                    return { block: historyItems, blockIndex: i, index: j };
                }
            }
        }

        return undefined;
    }

    getHistoryItemById(id: string) {
        const historyItem = this.map.get(id);
        if (historyItem) {
            return historyItem;
        }

        const activityLogEntry = activityLogStore.findById(id);
        if (activityLogEntry) {
            const historyItem = createHistoryItem(activityLogEntry);
            this.map.set(historyItem.id, historyItem);
            return historyItem;
        }

        return undefined;
    }

    filterActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.deleted) {
            return false;
        }

        if (appStore.filters.connectsAndDisconnects) {
            if (
                [
                    "instrument/created",
                    "instrument/restored",
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

    getFilter() {
        const filters: string[] = [];

        filters.push("NOT deleted");

        const types: string[] = [];

        if (appStore.filters.connectsAndDisconnects) {
            types.push(
                "instrument/created",
                "instrument/restored",
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

        return "AND " + filters.join(" AND ");
    }

    addActivityLogEntryToBlocks(activityLogEntry: IActivityLogEntry) {
        const historyItem = createHistoryItem(activityLogEntry);
        this.map.set(historyItem.id, historyItem);

        // increment day counter in calandar
        let day = new Date(
            historyItem.date.getFullYear(),
            historyItem.date.getMonth(),
            historyItem.date.getDate()
        );
        this.calendar.incrementCounter(day);

        // find the block (according to datetime) to which it should be added
        let i;
        for (i = 0; i < this.blocks.length; ++i) {
            const historyItemBlock = this.blocks[i];
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
            if (this.blocks.length === 0) {
                this.blocks.push([historyItem]);
            } else {
                this.blocks[0].unshift(historyItem);
            }
        } else {
            // add inside existing block
            const historyItemBlock = this.blocks[i - 1];
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
    }

    removeActivityLogEntryFromBlocks(activityLogEntry: IActivityLogEntry) {
        const foundItem = this.findHistoryItemById(activityLogEntry.id);
        if (foundItem) {
            const historyItem = foundItem.block[foundItem.index];

            foundItem.block.splice(foundItem.index, 1);
            if (foundItem.block.length === 0) {
                this.blocks.splice(foundItem.blockIndex, 1);
            }

            // decrement day counter in calandar
            let day = new Date(
                historyItem.date.getFullYear(),
                historyItem.date.getMonth(),
                historyItem.date.getDate()
            );
            this.calendar.decrementCounter(day);
        }

        if (this.map.get(activityLogEntry.id)) {
            this.map.delete(activityLogEntry.id);
        } else {
            if (!this.isDeletedItemsHistory) {
                console.warn("history item not found");
            }
        }
    }

    rowsToHistoryItems(rows: any[]) {
        const historyItems: IHistoryItem[] = [];
        rows.forEach(row => {
            let historyItem = this.map.get(row.id.toString());
            if (!historyItem) {
                const activityLogEntry = activityLogStore.dbRowToObject(row);
                historyItem = createHistoryItem(activityLogEntry);
                this.map.set(historyItem.id, historyItem);
            }
            historyItems.push(historyItem);
        });
        return historyItems;
    }

    @action
    displayRows(rows: any[]) {
        this.blocks = [this.rowsToHistoryItems(rows)];
        this.navigator.update();
    }

    @action
    onCreateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        if (this.map.get(activityLogEntry.id)) {
            return;
        }

        this.sessions.onActivityLogEntryCreated(activityLogEntry);

        this.filterStats.onActivityLogEntryCreated(activityLogEntry);

        if (op === "restore") {
            // this item was restored from undo buffer,
            this.addActivityLogEntryToBlocks(activityLogEntry);
        } else {
            // This is a new history item,
            // add it to the bottom of history list (last block) ...
            if (this.navigator.hasNewer) {
                this.calendar.showRecent();
            } else {
                this.addActivityLogEntryToBlocks(activityLogEntry);
            }
            // ... and scroll to the bottom of history list.
            moveToBottomOfConnectionHistory();
        }
    }

    @action
    onUpdateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        let historyItem;

        const foundItem = this.findHistoryItemById(activityLogEntry.id);
        if (foundItem) {
            historyItem = foundItem.block[foundItem.index];
        } else {
            historyItem = this.map.get(activityLogEntry.id);
        }

        if (!historyItem) {
            if (!this.isDeletedItemsHistory) {
                console.warn("history item not found");
            }
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
            this.map.set(updatedHistoryItem.id, updatedHistoryItem);
        }
    }

    @action
    onDeleteActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        this.sessions.onActivityLogEntryRemoved(activityLogEntry);
        this.filterStats.onActivityLogEntryRemoved(activityLogEntry);
        this.removeActivityLogEntryFromBlocks(activityLogEntry);
    }

    @action.bound
    deleteSelectedHistoryItems() {
        if (this.selection.items.length > 0) {
            beginTransaction("Delete history items");

            this.selection.items.forEach(historyItem =>
                logDelete(
                    {
                        oid: appStore.instrument!.id,
                        id: historyItem.id
                    },
                    {
                        undoable: true
                    }
                )
            );

            commitTransaction();

            this.selection.selectItems([]);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class DeletedItemsHistory extends History {
    @observable deletedCount: number = 0;

    constructor() {
        super(true);

        scheduleTask(
            "Get deleted history items count",
            Priority.Lowest,
            action(() => {
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
            })
        );
    }

    filterActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        return activityLogEntry.deleted;
    }

    getFilter() {
        return "AND deleted";
    }

    @action
    onCreateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        this.removeActivityLogEntryFromBlocks(activityLogEntry);
        --this.deletedCount;
    }

    @action
    onDeleteActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        if (options.deletePermanently) {
            this.removeActivityLogEntryFromBlocks(activityLogEntry);
            --this.deletedCount;
        } else {
            // we need all properties here since only id is guaranteed from store notification when deleting object
            activityLogEntry = activityLogStore.findById(activityLogEntry.id);

            this.addActivityLogEntryToBlocks(activityLogEntry);
            ++this.deletedCount;
        }
    }

    @action.bound
    restoreSelectedHistoryItems() {
        if (this.selection.items.length > 0) {
            beginTransaction("Restore history items");

            this.selection.items.forEach(historyItem =>
                logUndelete(
                    {
                        oid: appStore.instrument!.id,
                        id: historyItem.id
                    },
                    {
                        undoable: true
                    }
                )
            );

            commitTransaction();

            this.selection.selectItems([]);
        }
    }

    @action.bound
    deleteSelectedHistoryItems() {
        if (this.selection.items.length > 0) {
            confirm("Are you sure?", "This will permanently delete selected history items.", () => {
                if (this.selection.items.length > 0) {
                    beginTransaction("Purge history items");

                    this.selection.items.forEach(historyItem =>
                        logDelete(
                            {
                                oid: appStore.instrument!.id,
                                id: historyItem.id
                            },
                            {
                                deletePermanently: true
                            }
                        )
                    );

                    commitTransaction();

                    this.selection.selectItems([]);
                }
            });
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export const history = new History();
export const deletedItemsHistory = new DeletedItemsHistory();
