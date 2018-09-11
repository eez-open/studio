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
    IStore,
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

const CONF_START_SEARCH_TIMEOUT = 250;
const CONF_SINGLE_SEARCH_LIMIT = 1;
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

    filters: Filters;

    findListIdByName(listName: string): string | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class HistoryCalendar {
    @observable
    minDate: Date;
    @observable
    maxDate: Date;
    @observable
    counters = new Map<string, number>();
    @observable
    showFirstHistoryItemAsSelectedDay: boolean = false;

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
                            ${this.history.table} AS T1
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
                        ${this.history.options.store.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                ${this.history.table} AS T1
                            WHERE
                                ${
                                    this.history.oidWhereClause
                                } AND date >= ? ${this.history.getFilter()}
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
                        ${this.history.options.store.nonTransientAndNonLazyProperties}
                    FROM
                        ${this.history.table} AS T1
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

    @observable
    selected = false;
}

class HistorySearch {
    @observable
    searchActive: boolean = false;
    @observable
    searchResults: SearchResult[] = [];
    @observable
    searchInProgress: boolean = false;
    searchText: string;
    searchLastLogDate: any;
    searchLoopTimeout: any;
    @observable
    selectedSearchResult: SearchResult | undefined;
    startSearchTimeout: any;

    constructor(public history: History) {}

    update() {
        this.search("");
    }

    @action
    search(searchText: string) {
        this.stopSearch();

        if (this.startSearchTimeout) {
            clearTimeout(this.startSearchTimeout);
        }

        this.startSearchTimeout = setTimeout(() => {
            this.startSearchTimeout = undefined;
            this.doSearch(searchText);
        }, CONF_START_SEARCH_TIMEOUT);
    }

    @action
    private doSearch(searchText: string) {
        this.clearSearch();

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
                    ${this.history.options.store.nonTransientAndNonLazyProperties}
                FROM
                    ${this.history.table} AS T1
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
                const activityLogEntry = this.history.options.store.dbRowToObject(row);
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
                this.searchInProgress = false;
            });

            if (this.searchLoopTimeout) {
                clearTimeout(this.searchLoopTimeout);
            }
        }
    }

    clearSearch() {
        this.stopSearch();

        runInAction(() => {
            this.searchActive = false;
            this.searchResults.splice(0, this.searchResults.length);
        });

        this.selectSearchResult(undefined);
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
                                ${this.history.options.store.nonTransientAndNonLazyProperties}
                            FROM (
                                SELECT * FROM ${this.history.table} AS T1
                                WHERE ${this.history.oidWhereClause} ${this.history.getFilter()}
                                ORDER BY date
                            )
                            WHERE
                                date >= ?
                            LIMIT ?
                        )

                        UNION

                        SELECT * FROM (
                            SELECT
                                id,
                                ${this.history.options.store.nonTransientAndNonLazyProperties}
                            FROM (
                                SELECT * FROM ${this.history.table} AS T1
                                WHERE ${this.history.oidWhereClause} ${this.history.getFilter()}
                                ORDER BY date DESC
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
    firstHistoryItemTime: number;
    lastHistoryItemTime: number;

    @observable
    hasOlder = false;
    @observable
    hasNewer = false;

    constructor(public history: History) {}

    update() {
        if (this.firstHistoryItem) {
            this.firstHistoryItemTime = this.firstHistoryItem.date.getTime();

            const result = db
                .prepare(
                    `SELECT
                        count(*) AS count
                    FROM
                        ${this.history.table} AS T1
                    WHERE
                        ${this.history.oidWhereClause} AND date < ? ${this.history.getFilter()}`
                )
                .get(this.firstHistoryItemTime);

            this.hasOlder = result && result.count.toNumber() > 0;
        } else {
            this.hasOlder = false;
        }

        if (this.lastHistoryItem) {
            this.lastHistoryItemTime = this.lastHistoryItem.date.getTime();

            const result = db
                .prepare(
                    `SELECT
                        count(*) AS count
                    FROM
                        ${this.history.table} AS T1
                    WHERE
                        ${this.history.oidWhereClause} AND date > ? ${this.history.getFilter()}`
                )
                .get(this.lastHistoryItemTime);

            this.hasNewer = result && result.count.toNumber() > 0;
        } else {
            this.hasNewer = false;
        }

        this.history.selection.selectItems([]);
    }

    @computed
    get firstHistoryItem() {
        if (this.history.blocks.length > 0) {
            const firstBlock = this.history.blocks[0];
            if (firstBlock.length > 0) {
                return firstBlock[0];
            }
        }
        return undefined;
    }

    @computed
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
        if (this.hasOlder) {
            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${this.history.options.store.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                ${this.history.table} AS T1
                            WHERE
                                ${
                                    this.history.oidWhereClause
                                } AND date < ? ${this.history.getFilter()}
                            ORDER BY
                                date DESC
                        )
                    LIMIT ?`
                )
                .all(this.firstHistoryItemTime, CONF_BLOCK_SIZE);

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
        if (this.hasNewer) {
            const rows = db
                .prepare(
                    `SELECT
                        id,
                        ${this.history.options.store.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                ${this.history.table} AS T1
                            WHERE
                                ${
                                    this.history.oidWhereClause
                                } AND date > ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
                )
                .all(this.lastHistoryItemTime, CONF_BLOCK_SIZE);

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
    @observable
    _items: IHistoryItem[] = [];

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

interface IHistoryOptions {
    isDeletedItemsHistory: boolean;
    store: IStore;
    isSessionsSupported: boolean;
    oid?: string;
}

export class History {
    options: IHistoryOptions = Object.assign(
        {
            isDeletedItemsHistory: false,
            store: activityLogStore,
            isSessionsSupported: true
        },
        this.optionsArg
    );

    map = new Map<string, IHistoryItem>();
    @observable
    blocks: IHistoryItem[][] = [];

    calendar = new HistoryCalendar(this);
    search = new HistorySearch(this);
    navigator = new HistoryNavigator(this);
    sessions: HistorySessions;
    selection = new HistorySelection(this);

    filterStats: FilterStats = new FilterStats(this);

    reactionTimeout: any;
    reactionDisposer: any;

    get isSessionsSupported() {
        return !this.isDeletedItemsHistory && this.options.isSessionsSupported;
    }

    constructor(public appStore: IAppStore, private optionsArg?: Partial<IHistoryOptions>) {
        if (this.isSessionsSupported) {
            this.sessions = new HistorySessions(this);
        }

        scheduleTask(
            "Watch activity log",
            this.isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
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
                        oid: appStore.history.oid
                    };
                }

                let objectsToDelete: any = [];
                let deleteTimeout: any;

                this.options.store.watch(
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
                            // In case when multiple objects are deleted,
                            // this function will be called one time for each object.
                            // If we refresh UI immediatelly for each object that will be really slow.
                            // So, we collect deleted objects and refresh UI for all objects at once.
                            objectsToDelete.push(object);
                            if (deleteTimeout) {
                                clearTimeout(deleteTimeout);
                            }
                            deleteTimeout = setTimeout(
                                action(() => {
                                    deleteTimeout = undefined;
                                    for (let i = 0; i < objectsToDelete.length; ++i) {
                                        this.onDeleteActivityLogEntry(
                                            objectsToDelete[i],
                                            op,
                                            options
                                        );
                                    }
                                    objectsToDelete = [];
                                }),
                                10
                            );
                        }
                    },
                    activityLogFilterSpecification
                );
            }
        );

        scheduleTask(
            "Show most recent log items",
            this.isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
            action(() => {
                this.calendar.update();
            })
        );

        scheduleTask(
            "Load calendar",
            this.isDeletedItemsHistory ? Priority.Lowest : Priority.Low,
            action(() => {
                this.calendar.load();
            })
        );

        if (this.isSessionsSupported) {
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

    get isDeletedItemsHistory() {
        return this.options.isDeletedItemsHistory;
    }

    get table() {
        return '"' + this.options.store.storeName + '"';
    }

    get isInstrumentHistory() {
        return !this.appStore.oids;
    }

    get oid() {
        return this.options.oid || this.appStore.instrument!.id;
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
                    SELECT * FROM ${this.table} AS T2
                    WHERE
                        T2.${this.oidCond} AND
                        T2.sid = T1.id
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
                SELECT * FROM ${this.table} AS T2
                WHERE
                    T2.${this.oidCond} AND
                    T2.sid = T1.sid
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

        const activityLogEntry = this.options.store.findById(id);
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
                const activityLogEntry = this.options.store.dbRowToObject(row);
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
                            ${this.table}
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
                    this.options.store,
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

    /// Return all the history items between fromItem and toItem.
    /// This is used during mouse selection with SHIFT key.
    getAllItemsBetween(fromItem: IHistoryItem, toItem: IHistoryItem): IHistoryItem[] {
        let direction: "normal" | "reversed" | undefined = undefined;
        let done = false;

        const items: IHistoryItem[] = [];

        for (let blockIndex = 0; blockIndex < this.blocks.length; ++blockIndex) {
            const block = this.blocks[blockIndex];
            for (let itemIndex = 0; itemIndex < block.length; ++itemIndex) {
                const item = block[itemIndex];

                if (item === fromItem) {
                    if (direction) {
                        done = true;
                    } else {
                        direction = "normal";
                    }
                }

                if (item === toItem) {
                    if (direction) {
                        done = true;
                    } else {
                        direction = "reversed";
                    }
                }

                if (direction === "normal") {
                    items.push(item);
                } else if (direction === "reversed") {
                    items.unshift(item);
                }

                if (done) {
                    return items;
                }
            }
        }

        return [];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DeletedItemsHistory extends History {
    @observable
    deletedCount: number = 0;

    constructor(public appStore: IAppStore, options?: Partial<IHistoryOptions>) {
        super(
            appStore,
            Object.assign({}, options, {
                isDeletedItemsHistory: true
            })
        );

        scheduleTask("Get deleted history items count", Priority.Lowest, this.refreshDeletedCount);
    }

    @action.bound
    refreshDeletedCount() {
        const result = db
            .prepare(
                `SELECT
                    count(*) AS count
                FROM
                    ${this.table} AS T1
                WHERE
                    ${this.oidWhereClause} AND deleted`
            )
            .get();

        this.deletedCount = result ? result.count.toNumber() : 0;
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
            activityLogEntry = this.options.store.findById(activityLogEntry.id);
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
                    this.options.store,
                    {
                        oid: this.appStore.history.oid,
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
                    console.log("deleteSelectedHistoryItems STARTED");
                    beginTransaction("Purge history items");

                    this.selection.items.forEach(historyItem =>
                        logDelete(
                            this.options.store,
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
                    console.log("deleteSelectedHistoryItems FINISHED");
                }
            });
        }
    }

    @action.bound
    emptyTrash() {
        confirm(
            "Are you sure?",
            "This will permanently delete all history items from trash.",
            () => {
                db.prepare(
                    `DELETE FROM ${this.table} AS T1 WHERE ${this.oidWhereClause} AND deleted`
                ).run();

                this.selection.selectItems([]);
                this.displayRows([]);
                this.refreshDeletedCount();
            }
        );
    }
}
