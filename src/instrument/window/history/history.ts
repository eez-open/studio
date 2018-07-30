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

import { Filters, FilterStats } from "instrument/window/history/filters";

import { HistorySessions } from "instrument/window/history/session/store";

import { IHistoryItem } from "instrument/window/history/item";
import { createHistoryItem, updateHistoryItemClass } from "instrument/window/history/item-factory";
import {
    HistoryView,
    moveToTopOfHistory,
    moveToBottomOfHistory,
    showHistoryItem
} from "instrument/window/history/history-view";

////////////////////////////////////////////////////////////////////////////////

const CONF_SINGLE_SEARCH_LIMIT = 100;
export const CONF_BLOCK_SIZE = 100;

////////////////////////////////////////////////////////////////////////////////

export type SelectableHistoryItemTypes = "chart" | "all";

export interface SelectHistoryItemsSpecification {
    historyItemType: SelectableHistoryItemTypes;
    message: string;
    alertDanger?: boolean;
    okButtonText: string;
    okButtonTitle: string;
    onOk(): void;
}

export interface INavigationStore {
    navigateToHistory(): void;
    navigateToDeletedHistoryItems(): void;
    navigateToSessionsList(): void;
    mainHistoryView: HistoryView | undefined;
    selectedListId: string | undefined;
}

export interface IAppStore {
    selectHistoryItemsSpecification: SelectHistoryItemsSpecification | undefined;
    history: History;
    deletedItemsHistory: DeletedItemsHistory;
    isHistoryItemSelected(id: string): boolean;
    selectHistoryItem(id: string, selected: boolean): void;

    selectedHistoryItems: Map<string, boolean>;
    selectHistoryItems(specification: SelectHistoryItemsSpecification | undefined): void;

    oids?: string[];

    instrument?: {
        id: string;
        connection: {
            abortLongOperation(): void;
        };
        listsProperty?: any;
    };

    navigationStore: INavigationStore;

    searchVisible: boolean;
    toggleSearchVisible(): void;

    filters: Filters;
    filtersVisible: boolean;
    toggleFiltersVisible(): void;

    searchViewSection: "calendar" | "sessions";
    setSearchViewSection(value: "calendar" | "sessions"): void;

    findListIdByName(listName: string): string | undefined;
}

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
                            ${this.history.oidWhereClause} ${this.history.getFilter()}
                    )
                    GROUP BY
                        date
                    ORDER BY
                        date`
                )
                .all();

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
                            ${this.history.oidWhereClause} AND date >= ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(selectedDay.getTime(), CONF_BLOCK_SIZE);

            this.history.displayRows(rows);

            moveToTopOfHistory(this.history.appStore.navigationStore.mainHistoryView);
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
                        ${this.history.oidWhereClause} ${this.history.getFilter()}
                    ORDER BY
                        date DESC
                    LIMIT ?`
                )
                .all(CONF_BLOCK_SIZE);

            rows.reverse();

            this.history.displayRows(rows);

            moveToBottomOfHistory(this.history.appStore.navigationStore.mainHistoryView);
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
                    ${this.history.oidWhereClause} AND
                    date > ? AND
                    message LIKE ? ${this.history.getFilter()}
                ORDER BY
                    date
                LIMIT
                    ?`
            )
            .all(
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
                                SELECT * FROM activityLog WHERE ${
                                    this.history.oidWhereClause
                                } ${this.history.getFilter()} ORDER BY date
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
                                SELECT * FROM activityLog WHERE ${
                                    this.history.oidWhereClause
                                } ${this.history.getFilter()} ORDER BY date DESC
                            )
                            WHERE
                                date < ?
                            LIMIT ?
                        )
                    ) ORDER BY date`
                )
                .all(
                    searchResult.logEntry.date.getTime(),
                    CONF_BLOCK_SIZE / 2,
                    searchResult.logEntry.date.getTime(),
                    CONF_BLOCK_SIZE / 2
                );

            this.history.displayRows(rows);

            const historyItem = this.history.map.get(searchResult.logEntry.id);
            if (historyItem) {
                historyItem.selected = true;
                showHistoryItem(this.history.appStore.navigationStore.mainHistoryView, historyItem);
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
                        ${this.history.oidWhereClause} AND date < ? ${this.history.getFilter()}`
                )
                .get(firstHistoryItem.date.getTime());

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
                        ${this.history.oidWhereClause} AND date > ? ${this.history.getFilter()}`
                )
                .get(lastHistoryItem.date.getTime());

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
                                ${
                                    this.history.oidWhereClause
                                } AND date < ? ${this.history.getFilter()}
                            ORDER BY
                                date DESC
                        )
                    LIMIT ?`
                )
                .all(firstHistoryItem.date.getTime(), CONF_BLOCK_SIZE);

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
                                ${
                                    this.history.oidWhereClause
                                } AND date > ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(lastHistoryItem.date.getTime(), CONF_BLOCK_SIZE);

            if (rows.length > 0) {
                this.history.calendar.showFirstHistoryItemAsSelectedDay = false;
                this.history.blocks.push(this.history.rowsToHistoryItems(rows));
                this.update();
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class HistorySelection {
    @observable _items: IHistoryItem[] = [];

    constructor(public history: History) {}

    @computed
    get canDelete() {
        if (this.items.length === 0) {
            return false;
        }

        for (let i = 0; i < this.items.length; ++i) {
            if (this.items[i].type.startsWith("activity-log/session")) {
                return false;
            }
        }

        return true;
    }

    @computed
    get items() {
        return this.history.appStore.selectHistoryItemsSpecification ? [] : this._items;
    }

    @action
    selectItems(historyItems: IHistoryItem[]) {
        this._items.forEach(historyItem => (historyItem.selected = false));
        this._items = historyItems;
        this._items.forEach(historyItem => (historyItem.selected = true));
    }
}

////////////////////////////////////////////////////////////////////////////////

export class History {
    map = new Map<string, IHistoryItem>();
    @observable blocks: IHistoryItem[][] = [];

    calendar = new HistoryCalendar(this);
    search = new HistorySearch(this);
    navigator = new HistoryNavigator(this);
    sessions: HistorySessions;
    selection = new HistorySelection(this);

    filterStats: FilterStats = new FilterStats(this);

    reactionTimeout: any;
    reactionDisposer: any;

    constructor(public appStore: IAppStore, public isDeletedItemsHistory: boolean = false) {
        if (!isDeletedItemsHistory) {
            this.sessions = new HistorySessions(this);
        }

        scheduleTask(
            "Watch activity log",
            isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
            () => {
                let activityLogFilterSpecification: IActivityLogFilterSpecification;

                if (this.appStore.oids) {
                    activityLogFilterSpecification = {
                        skipInitialQuery: true,
                        oids: this.appStore.oids
                    };
                } else {
                    activityLogFilterSpecification = {
                        skipInitialQuery: true,
                        oid: appStore.instrument!.id
                    };
                }

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
                    activityLogFilterSpecification
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

        this.reactionDisposer = reaction(
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
    }

    get isInstrumentHistory() {
        return !this.appStore.oids;
    }

    get oid() {
        return this.appStore.instrument!.id;
    }

    get oidCond() {
        if (this.appStore.oids) {
            if (this.appStore.oids.length > 0) {
                const oids = this.appStore.oids.map(oid => '"' + oid + '"').join(",");
                return `oid IN(${oids})`;
            } else {
                return "oid=oid";
            }
        } else {
            return `oid="${this.oid}"`;
        }
    }

    get sessionStartCond() {
        if (this.appStore.oids && this.appStore.oids.length === 0) {
            return "1";
        }

        return `(
            type='activity-log/session-start' AND
            (
                json_extract(message, '$.sessionCloseId') IS NULL OR
                EXISTS(
                    SELECT * FROM activityLog AS activityLog2
                    WHERE
                        activityLog2.${this.oidCond} AND
                        activityLog2.sid = activityLog.id
                )
            )
        )`;
    }

    get sessionCloseCond() {
        if (this.appStore.oids && this.appStore.oids.length === 0) {
            return "1";
        }

        return `(
            type='activity-log/session-close' AND
            EXISTS(
                SELECT * FROM activityLog AS activityLog2
                WHERE
                    activityLog2.${this.oidCond} AND
                    activityLog2.sid = activityLog.sid
            )
        )`;
    }

    get oidWhereClause() {
        return `(${this.sessionStartCond} OR ${this.sessionCloseCond} OR ${this.oidCond})`;
    }

    onTerminate() {
        this.reactionDisposer();
    }

    findHistoryItemById(id: string) {
        for (let i = 0; i < this.blocks.length; i++) {
            const historyItems = this.blocks[i];
            for (let j = 0; j < historyItems.length; j++) {
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
            const historyItem = createHistoryItem(activityLogEntry, this.appStore);
            this.map.set(historyItem.id, historyItem);
            return historyItem;
        }

        return undefined;
    }

    filterActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.deleted) {
            return false;
        }

        return this.appStore.filters.filterActivityLogEntry(activityLogEntry);
    }

    getFilter() {
        return "AND NOT deleted AND " + this.appStore.filters.getFilter();
    }

    addActivityLogEntryToBlocks(activityLogEntry: IActivityLogEntry) {
        const historyItem = createHistoryItem(activityLogEntry, this.appStore);
        this.map.set(historyItem.id, historyItem);

        this.filterStats.onHistoryItemCreated(historyItem);

        // increment day counter in calandar
        let day = new Date(
            historyItem.date.getFullYear(),
            historyItem.date.getMonth(),
            historyItem.date.getDate()
        );
        this.calendar.incrementCounter(day);

        // find the block (according to datetime) to which it should be added
        let i;
        for (i = 0; i < this.blocks.length; i++) {
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
            for (j = 0; j < historyItemBlock.length; j++) {
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

        return historyItem;
    }

    removeActivityLogEntryFromBlocks(activityLogEntry: IActivityLogEntry) {
        const foundItem = this.findHistoryItemById(activityLogEntry.id);
        if (foundItem) {
            const historyItem = foundItem.block[foundItem.index];

            foundItem.block.splice(foundItem.index, 1);
            if (foundItem.block.length === 0) {
                this.blocks.splice(foundItem.blockIndex, 1);
            }

            this.filterStats.onHistoryItemRemoved(historyItem);

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
                historyItem = createHistoryItem(activityLogEntry, this.appStore);
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
        if (activityLogEntry.type === "activity-log/session-close") {
            if (this.isInstrumentHistory) {
                const result = db
                    .prepare(
                        `SELECT
                            count(*) AS count
                        FROM
                            activityLog
                        WHERE
                            oid = ${this.oid} AND sid=${activityLogEntry.sid}`
                    )
                    .get();

                // if instrument IS NOT used in this session ...
                if (!(result && result.count.toNumber() > 0)) {
                    // ... no need to show session close item and also remove session start item.
                    const sessionStart: Partial<IActivityLogEntry> = {
                        id: activityLogEntry.sid as string,
                        oid: "0",
                        type: "activity-log/session-start"
                    };
                    if (this.sessions) {
                        this.sessions.onActivityLogEntryRemoved(sessionStart as IActivityLogEntry);
                    }
                    this.removeActivityLogEntryFromBlocks(sessionStart as IActivityLogEntry);
                    return;
                }
            }
        }

        if (this.map.get(activityLogEntry.id)) {
            return;
        }

        if (this.sessions) {
            this.sessions.onActivityLogEntryCreated(activityLogEntry);
        }

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
            moveToBottomOfHistory(this.appStore.navigationStore.mainHistoryView);
        }
    }

    @action
    onUpdateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        let historyItem;

        if (this.sessions) {
            this.sessions.onActivityLogEntryUpdated(activityLogEntry);
        }

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

        const updatedHistoryItem = updateHistoryItemClass(historyItem, this.appStore);
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
        if (this.sessions) {
            this.sessions.onActivityLogEntryRemoved(activityLogEntry);
        }
        this.removeActivityLogEntryFromBlocks(activityLogEntry);
    }

    @action.bound
    deleteSelectedHistoryItems() {
        if (this.selection.items.length > 0) {
            beginTransaction("Delete history items");

            this.selection.items.forEach(historyItem =>
                logDelete(
                    {
                        oid: historyItem.oid,
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

export class DeletedItemsHistory extends History {
    @observable deletedCount: number = 0;

    constructor(public appStore: IAppStore) {
        super(appStore, true);

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
                            ${this.oidWhereClause} AND deleted`
                    )
                    .get();

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
        if (op === "restore") {
            this.removeActivityLogEntryFromBlocks(activityLogEntry);
            this.deletedCount--;
        }
    }

    @action
    onDeleteActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        if (options.deletePermanently) {
            this.removeActivityLogEntryFromBlocks(activityLogEntry);
            this.deletedCount--;
        } else {
            // we need all properties here since only id is guaranteed from store notification when deleting object
            activityLogEntry = activityLogStore.findById(activityLogEntry.id);
            if (activityLogEntry) {
                this.addActivityLogEntryToBlocks(activityLogEntry);
                this.deletedCount++;
            }
        }
    }

    @action.bound
    restoreSelectedHistoryItems() {
        if (this.selection.items.length > 0) {
            beginTransaction("Restore history items");

            this.selection.items.forEach(historyItem =>
                logUndelete(
                    {
                        oid: this.appStore.instrument!.id,
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
                                oid: historyItem.oid,
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
