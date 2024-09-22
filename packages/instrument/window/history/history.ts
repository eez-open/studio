import { ipcRenderer } from "electron";
import {
    observable,
    computed,
    runInAction,
    action,
    reaction,
    makeObservable
} from "mobx";

import { formatTransferSpeed, formatDate } from "eez-studio-shared/util";
import { db } from "eez-studio-shared/db";
import { dbQuery } from "eez-studio-shared/db-query";
import {
    IStore,
    StoreOperation,
    IStoreOperationOptions,
    beginTransaction,
    commitTransaction
} from "eez-studio-shared/store";
import { scheduleTask, Priority } from "eez-studio-shared/scheduler";

import { confirm } from "eez-studio-ui/dialog-electron";

import {
    IActivityLogEntry,
    activityLogStore,
    IActivityLogFilterSpecification,
    logDelete,
    logUndelete,
    logUpdate
} from "instrument/window/history/activity-log";

import { Filters, FilterStats } from "instrument/window/history/filters";

import {
    historySessions,
    SESSION_FREE_ID
} from "instrument/window/history/session/store";

import { IHistoryItem } from "instrument/window/history/item";
import {
    createHistoryItem,
    rowsToHistoryItems,
    updateHistoryItemClass
} from "instrument/window/history/item-factory";
import {
    HistoryViewComponent,
    moveToTopOfHistory,
    moveToBottomOfHistory,
    showHistoryItem
} from "instrument/window/history/history-view";
import { FileHistoryItem } from "instrument/window/history/items/file";
import type { ISelection } from "./list-component";
import { getScrapbookStore } from "instrument/window/history/scrapbook";
import { CONF_ITEMS_BLOCK_SIZE } from "./CONF_ITEMS_BLOCK_SIZE";
import { IUnit } from "eez-studio-shared/units";
import type { BaseList } from "instrument/window/lists/store-renderer";
import { unwatch } from "eez-studio-shared/notify";
import type { CommandsProtocolType } from "eez-studio-shared/extensions/extension";

////////////////////////////////////////////////////////////////////////////////

const CONF_START_SEARCH_TIMEOUT = 250;
const CONF_SINGLE_SEARCH_LIMIT = 1;

const CONF_MAX_NUM_OF_LOADED_ITEMS = 100;

////////////////////////////////////////////////////////////////////////////////

export type SelectableHistoryItemTypes = "chart" | "all";

export interface SelectHistoryItemsSpecification {
    historyItemType: SelectableHistoryItemTypes;
    message: string;
    alertDanger?: boolean;
    okButtonText: string;
    okButtonTitle: string;
    loading: boolean;
    onOk(): void;
}

export interface INavigationStore {
    navigateToHistory(): void;
    navigateToDeletedHistoryItems(): void;
    navigateToSessionsList(): void;
    mainHistoryView: HistoryViewComponent | undefined;
    selectedListId: string | undefined;
    changeSelectedListId(listId: string | undefined): Promise<void>;
}

export interface IScrapbookStore {
    items(appStore: IAppStore): IHistoryItem[];
    showAll: boolean;
    thumbnailSize: number;
    selection: ISelection;
    insertBeforeItem(
        item: IHistoryItem | undefined,
        activityLogEntry: IActivityLogEntry
    ): void;
    onUpdateActivityLogEntry(activityLogEntry: IActivityLogEntry): void;
    onActivityLogEntryRemoved(activityLogEntry: IActivityLogEntry): void;
    deleteSelectedHistoryItems(): void;
    selectAllItems(appStore: IAppStore): void;
}

export interface IInstrumentObject {
    id: string;
    connection: {
        isConnected: boolean;
        enablePlotter?: () => void;
        isPlotterEnabled: boolean;
        abortLongOperation(): void;
    };
    listsProperty?: any;
    sendFileToInstrumentHandler?: () => void;
    listsMinDwellProperty: number;
    listsMaxDwellProperty: number;
    firstChannel:
        | {
              maxVoltage?: number | undefined;
              maxCurrent?: number | undefined;
              maxPower?: number | undefined;
          }
        | undefined;
    getDigits(unit: IUnit): number;
    listsMaxPointsProperty: number;

    listsDwellDigitsProperty: number;
    listsVoltageDigitsProperty: number;
    listsCurrentDigitsProperty: number;
    commandsProtocol: CommandsProtocolType;
}

interface IUndoManager {
    addCommand(
        transactionLabel: string,
        store: IStore,
        object: any,
        command: ICommand
    ): void;
}

export interface ICommand {
    execute: () => void;
    undo: () => void;
}

export interface IAppStore {
    selectHistoryItemsSpecification:
        | SelectHistoryItemsSpecification
        | undefined;
    history: History;
    deletedItemsHistory: DeletedItemsHistory;
    isHistoryItemSelected(id: string): boolean;
    selectHistoryItem(id: string, selected: boolean): void;

    selectedHistoryItems: Map<string, boolean>;
    selectHistoryItems(
        specification: SelectHistoryItemsSpecification | undefined
    ): void;

    oids?: string[];

    instrument: IInstrumentObject;
    instrumentListStore?: IStore;
    instrumentLists: BaseList[];
    undoManager?: IUndoManager;

    navigationStore: INavigationStore;

    filters: Filters;

    findListIdByName(listName: string): string | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class HistoryCalendar {
    minDate: Date;
    maxDate: Date;

    // "YYYY-MM-DD" -> number of items at date
    counters = new Map<string, number>();
    showFirstHistoryItemAsSelectedDay: boolean = false;

    lastSelectedDay: Date;

    constructor(public history: History) {
        makeObservable(this, {
            minDate: observable,
            maxDate: observable,
            counters: observable,
            showFirstHistoryItemAsSelectedDay: observable,
            lastSelectedDay: observable,
            load: action,
            update: action,
            selectedDay: computed,
            showRecent: action,
            selectDay: action,
            incrementCounter: action,
            decrementCounter: action
        });
    }

    async load() {
        this.minDate = new Date();
        this.maxDate = new Date();
        this.counters = new Map<string, number>();

        try {
            const rows = await dbQuery(
                "HistoryCalendar load " +
                    ((this.history as any).emptyTrash
                        ? " for deleted items"
                        : ""),
                `SELECT
                        date,
                        count(*) AS count
                    FROM (
                        SELECT
                            date(date / 1000, 'unixepoch', 'localtime') AS date
                        FROM
                            ${this.history.table} AS T1
                        WHERE
                            ${
                                this.history.oidWhereClause
                            } ${this.history.getFilter()}
                    )
                    GROUP BY
                        date
                    ORDER BY
                        date`
            ).all();

            runInAction(() => {
                if (rows.length > 0) {
                    rows.forEach(row =>
                        this.counters.set(row.date, Number(row.count))
                    );
                    this.minDate = new Date(rows[0].date + " 00:00:00");
                    this.maxDate = new Date();
                } else {
                    this.minDate = this.maxDate = new Date();
                }
            });
        } catch (err) {
            console.error(err);
        }
    }

    getActivityCount(day: Date) {
        return this.counters.get(formatDate(day, "YYYY-MM-DD")) || 0;
    }

    async update(selectedDay?: Date) {
        if (selectedDay) {
            this.lastSelectedDay = selectedDay;
            this.showFirstHistoryItemAsSelectedDay = false;

            const rows = await dbQuery(
                "HistoryCalendar update selected day" +
                    ((this.history as any).emptyTrash
                        ? " for deleted items"
                        : ""),
                `SELECT
                        id,
                        ${
                            this.history.options.store
                                .nonTransientAndNonLazyProperties
                        }
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
            ).all(selectedDay.getTime(), CONF_ITEMS_BLOCK_SIZE);

            this.history.displayRows(rows);

            moveToTopOfHistory(
                this.history.appStore.navigationStore.mainHistoryView
            );
        } else {
            this.lastSelectedDay = new Date();
            this.showFirstHistoryItemAsSelectedDay = false;

            // display most recent log items
            const rows = await dbQuery(
                "HistoryCalendar update no selected day" +
                    ((this.history as any).emptyTrash
                        ? " for deleted items"
                        : ""),
                `SELECT
                        id,
                        ${
                            this.history.options.store
                                .nonTransientAndNonLazyProperties
                        }
                    FROM
                        ${this.history.table} AS T1
                    WHERE
                        ${
                            this.history.oidWhereClause
                        } ${this.history.getFilter()}
                    ORDER BY
                        date DESC
                    LIMIT ?`
            ).all(CONF_ITEMS_BLOCK_SIZE);

            rows.reverse();

            this.history.displayRows(rows);

            moveToBottomOfHistory(
                this.history.appStore.navigationStore.mainHistoryView
            );
        }
    }

    get selectedDay() {
        if (this.history.selection.items.length > 0) {
            return this.history.selection.items[0].date;
        }

        if (this.lastSelectedDay) {
            if (this.history.items.length == 0) {
                return this.lastSelectedDay;
            }

            const dateFrom = this.history.items[0].date;
            const dateTo =
                this.history.items[this.history.items.length - 1].date;
            if (
                this.lastSelectedDay >= dateFrom &&
                this.lastSelectedDay <= dateTo
            ) {
                return this.lastSelectedDay;
            }

            return this.history.items[Math.floor(this.history.items.length / 2)]
                .date;
        }

        if (this.history.itemInTheCenterOfTheView) {
            return this.history.itemInTheCenterOfTheView.date;
        }

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
            day.getFullYear() === selectedDay.getFullYear() &&
            day.getMonth() === selectedDay.getMonth() &&
            day.getDate() === selectedDay.getDate()
        );
    }

    isSelectedMonth(month: Date) {
        if (this.history.search.selectedSearchResult) {
            return false;
        }
        let selectedDay = this.selectedDay;
        return (
            selectedDay &&
            month.getFullYear() === selectedDay.getFullYear() &&
            month.getMonth() === selectedDay.getMonth()
        );
    }

    async showRecent() {
        this.history.search.selectSearchResult(undefined);
        await this.update();
    }

    selectDay(day: Date) {
        if (day > this.maxDate) {
            this.maxDate = day;
        }

        this.history.search.selectSearchResult(undefined);
        this.update(day);
    }

    incrementCounter(day: Date) {
        const key = formatDate(day, "YYYY-MM-DD");
        this.counters.set(key, (this.counters.get(key) || 0) + 1);
    }

    decrementCounter(day: Date) {
        const key = formatDate(day, "YYYY-MM-DD");
        this.counters.set(key, (this.counters.get(key) || 0) - 1);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class SearchResult {
    constructor(public logEntry: IActivityLogEntry) {
        makeObservable(this, {
            selected: observable
        });
    }

    selected = false;
}

class HistorySearch {
    searchActive: boolean = false;
    searchResults: SearchResult[] = [];
    searchInProgress: boolean = false;
    searchText: string;
    searchLastLogDate: any;
    searchLoopTimeout: any;
    selectedSearchResult: SearchResult | undefined;
    startSearchTimeout: any;

    constructor(public history: History) {
        makeObservable<HistorySearch, "doSearch">(this, {
            searchActive: observable,
            searchResults: observable,
            searchInProgress: observable,
            selectedSearchResult: observable,
            search: action,
            doSearch: action,
            selectSearchResult: action
        });
    }

    update() {
        this.search(this.searchText ?? "");
    }

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

    searchLoop = async () => {
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

        const rows = await dbQuery(
            "HistoryCalendar searchLoop" +
                ((this.history as any).emptyTrash ? " for deleted items" : ""),
            `SELECT
                    id,
                    ${
                        this.history.options.store
                            .nonTransientAndNonLazyProperties
                    }
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
        ).all(
            this.searchLastLogDate.getTime(),
            "%" + this.searchText + "%",
            CONF_SINGLE_SEARCH_LIMIT
        );

        rows.forEach(
            action(row => {
                const activityLogEntry =
                    this.history.options.store.dbRowToObject(row);
                this.searchResults.push(new SearchResult(activityLogEntry));
                if (activityLogEntry.date > this.searchLastLogDate) {
                    this.searchLastLogDate = activityLogEntry.date;
                }
            })
        );

        if (rows.length >= CONF_SINGLE_SEARCH_LIMIT) {
            this.searchLoopTimeout = setTimeout(this.searchLoop, 0);
        } else {
            runInAction(() => {
                this.searchInProgress = false;
            });
        }
    };

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

    async selectSearchResult(searchResult: SearchResult | undefined) {
        if (this.selectedSearchResult) {
            this.selectedSearchResult.selected = false;

            const foundItem = this.history.findHistoryItemById(
                this.selectedSearchResult.logEntry.id
            );
            if (foundItem) {
                foundItem.historyItem.selected = false;
            }
        }

        this.selectedSearchResult = searchResult;

        if (searchResult) {
            searchResult.selected = true;

            const rows = await dbQuery(
                "HistoryCalendar selectSearchResult" +
                    ((this.history as any).emptyTrash
                        ? " for deleted items"
                        : ""),
                `SELECT * FROM (
                        SELECT * FROM (
                            SELECT
                                id,
                                ${
                                    this.history.options.store
                                        .nonTransientAndNonLazyProperties
                                }
                            FROM (
                                SELECT * FROM ${this.history.table} AS T1
                                WHERE ${
                                    this.history.oidWhereClause
                                } ${this.history.getFilter()}
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
                                ${
                                    this.history.options.store
                                        .nonTransientAndNonLazyProperties
                                }
                            FROM (
                                SELECT * FROM ${this.history.table} AS T1
                                WHERE ${
                                    this.history.oidWhereClause
                                } ${this.history.getFilter()}
                                ORDER BY date DESC
                            )
                            WHERE
                                date < ?
                            LIMIT ?
                        )
                    ) ORDER BY date`
            ).all(
                searchResult.logEntry.date.getTime(),
                Math.round(CONF_ITEMS_BLOCK_SIZE / 2),
                searchResult.logEntry.date.getTime(),
                Math.round(CONF_ITEMS_BLOCK_SIZE / 2)
            );

            this.history.displayRows(rows);

            const foundItem = this.history.findHistoryItemById(
                searchResult.logEntry.id
            );
            if (foundItem) {
                runInAction(() => {
                    foundItem.historyItem.selected = true;
                });
                showHistoryItem(
                    this.history.appStore.navigationStore.mainHistoryView,
                    foundItem.historyItem
                );
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

    hasOlder = false;
    hasNewer = false;

    constructor(public history: History) {
        makeObservable(this, {
            hasOlder: observable,
            hasNewer: observable,
            update: action,
            firstHistoryItem: computed,
            lastHistoryItem: computed,
            loadOlder: action.bound,
            loadNewer: action.bound
        });
    }

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
                        ${
                            this.history.oidWhereClause
                        } AND date < ? ${this.history.getFilter()}`
                )
                .get(this.firstHistoryItemTime);

            this.hasOlder = result && Number(result.count) > 0;
        } else {
            this.hasOlder = false;
        }

        const selectHistoryItemsSpecification =
            this.history.appStore.selectHistoryItemsSpecification;
        if (
            selectHistoryItemsSpecification &&
            selectHistoryItemsSpecification.historyItemType == "chart"
        ) {
            runInAction(
                () => (selectHistoryItemsSpecification.loading = false)
            );
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
                        ${
                            this.history.oidWhereClause
                        } AND date > ? ${this.history.getFilter()}`
                )
                .get(this.lastHistoryItemTime);

            this.hasNewer = result && Number(result.count) > 0;
        } else {
            this.hasNewer = false;
        }
    }

    get firstHistoryItem() {
        return this.history.items.length > 0
            ? this.history.items[0]
            : undefined;
    }

    get lastHistoryItem() {
        return this.history.items.length > 0
            ? this.history.items[this.history.items.length - 1]
            : undefined;
    }

    async loadOlder() {
        if (this.hasOlder) {
            const rows = await dbQuery(
                "HistoryCalendar loadOlder" +
                    ((this.history as any).emptyTrash
                        ? " for deleted items"
                        : ""),
                `SELECT
                        id,
                        ${
                            this.history.options.store
                                .nonTransientAndNonLazyProperties
                        }
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
            ).all(this.firstHistoryItemTime, CONF_ITEMS_BLOCK_SIZE);

            rows.reverse();

            if (rows.length > 0) {
                runInAction(() => {
                    this.history.calendar.showFirstHistoryItemAsSelectedDay =
                        true;
                    this.history.addRowsToStart(
                        this.history.rowsToHistoryItems(rows)
                    );
                });
                this.update();
            }
        }
    }

    async loadNewer() {
        if (this.hasNewer) {
            const rows = await dbQuery(
                "HistoryCalendar loadNewer" +
                    ((this.history as any).emptyTrash
                        ? " for deleted items"
                        : ""),
                `SELECT
                        id,
                        ${
                            this.history.options.store
                                .nonTransientAndNonLazyProperties
                        }
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
            ).all(this.lastHistoryItemTime, CONF_ITEMS_BLOCK_SIZE);

            if (rows.length > 0) {
                runInAction(() => {
                    this.history.calendar.showFirstHistoryItemAsSelectedDay =
                        false;
                    this.history.addRowsToEnd(
                        this.history.rowsToHistoryItems(rows)
                    );
                });
                this.update();
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class HistorySelection {
    _items: IHistoryItem[] = [];

    constructor(public history: History) {
        makeObservable(this, {
            _items: observable,
            canConvertToChart: computed,
            canStorePermanently: computed,
            canDelete: computed,
            items: computed,
            selectItems: action
        });
    }

    get canConvertToChart() {
        const items = this.items.filter(
            item => item.type == "instrument/answer"
        );
        return items.length > 0;
    }

    get canStorePermanently() {
        const items = this.items.filter(item => item.temporary);
        return items.length > 0;
    }

    get canDelete() {
        return this.items.length > 0;
    }

    get items() {
        return this.history.appStore.selectHistoryItemsSpecification
            ? []
            : this._items;
    }

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
    loadAtStart: boolean;
}

export class History {
    options: IHistoryOptions;

    loaded = false;

    items: IHistoryItem[] = [];

    calendar = new HistoryCalendar(this);
    search = new HistorySearch(this);
    navigator = new HistoryNavigator(this);
    selection = new HistorySelection(this);

    filterStats: FilterStats = new FilterStats(this);

    reactionTimeout: any;
    reactionDisposer: any;

    optionsStoreWatchId: string | undefined;

    terminated: boolean = false;

    get isSessionsSupported() {
        return !this.isDeletedItemsHistory && this.options.isSessionsSupported;
    }

    constructor(
        public appStore: IAppStore,
        private optionsArg?: Partial<IHistoryOptions>
    ) {
        makeObservable(this, {
            items: observable,
            freeSomeHistoryItemsFromTopIfTooMany: action,
            freeSomeHistoryItemsFromBottomIfTooMany: action,
            displayRows: action,
            addRowsToStart: action,
            addRowsToEnd: action,
            onCreateActivityLogEntry: action,
            onUpdateActivityLogEntry: action,
            onDeleteActivityLogEntry: action,
            convertToChart: action.bound,
            storeSelectedHistoryItemsPermanently: action.bound,
            deleteSelectedHistoryItems: action.bound,
            itemInTheCenterOfTheView: observable,
            setItemInTheCenterOfTheView: action,
            sendFileStatus: computed
        });

        this.options = Object.assign(
            {
                isDeletedItemsHistory: false,
                store: activityLogStore,
                isSessionsSupported: true,
                loadAtStart: true
            },
            this.optionsArg
        );

        scheduleTask(
            "Watch activity log",
            this.isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
            async () => {
                if (this.terminated) {
                    return;
                }

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

                this.optionsStoreWatchId = this.options.store.watch(
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
                                    for (
                                        let i = 0;
                                        i < objectsToDelete.length;
                                        ++i
                                    ) {
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

        if (this.options.loadAtStart) {
            this.load();
        }

        this.reactionDisposer = reaction(
            () => ({
                filter: this.getFilter(),
                selectedSession: this.isSessionsSupported
                    ? historySessions.selectedSession
                    : undefined
            }),
            () => {
                if (this.reactionTimeout) {
                    clearTimeout(this.reactionTimeout);
                }
                this.reactionTimeout = setTimeout(() => {
                    this.reactionTimeout = undefined;
                    this.calendar.load();
                    this.calendar.update();
                    //this.filterStats.update();
                    this.search.update();
                }, 10);
            }
        );
    }

    load() {
        if (!this.loaded) {
            this.loaded = true;

            scheduleTask(
                "Show most recent log items",
                this.isDeletedItemsHistory ? Priority.Lowest : Priority.Middle,
                action(() => this.calendar.update())
            );

            scheduleTask(
                "Load calendar",
                this.isDeletedItemsHistory ? Priority.Lowest : Priority.Low,
                action(() => this.calendar.load())
            );
        }
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
        return this.options.oid || this.appStore.instrument.id;
    }

    get oidCond() {
        if (this.appStore.oids) {
            if (this.appStore.oids.length > 0) {
                const oids = this.appStore.oids
                    .map(oid => `'` + oid + `'`)
                    .join(",");
                return `oid IN(${oids})`;
            } else {
                return "oid=oid";
            }
        } else {
            return `oid='${this.oid}'`;
        }
    }

    get sessionCond() {
        return this.isSessionsSupported &&
            historySessions.selectedSession.id != SESSION_FREE_ID
            ? `(sid = ${historySessions.selectedSession.id})`
            : "1";
    }

    get oidWhereClause() {
        return `(${this.sessionCond} AND ${this.oidCond})`;
    }

    onTerminate() {
        this.reactionDisposer();
        if (this.reactionTimeout) {
            clearTimeout(this.reactionTimeout);
        }
        this.items.forEach(item => item.dispose());
        if (this.optionsStoreWatchId) {
            unwatch(this.optionsStoreWatchId);
        }
        this.terminated = true;
    }

    findHistoryItemById(id: string) {
        for (let i = 0; i < this.items.length; i++) {
            let historyItem = this.items[i];
            if (historyItem.id === id) {
                return { historyItem, index: i };
            }
        }
        return undefined;
    }

    getHistoryItemById(id: string) {
        const foundItem = this.findHistoryItemById(id);
        if (foundItem) {
            return foundItem.historyItem;
        }

        const activityLogEntry = this.options.store.findById(id);
        if (activityLogEntry) {
            return createHistoryItem(this.options.store, activityLogEntry);
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
        let filter = "AND NOT deleted AND " + this.appStore.filters.sqlFilter;

        if (
            this.appStore.selectHistoryItemsSpecification &&
            this.appStore.selectHistoryItemsSpecification.historyItemType ==
                "chart"
        ) {
            filter +=
                ` AND message IS NOT NULL` +
                ` AND json_valid(message)` +
                ` AND json_extract(message, '$.state') = 'success'` +
                ` AND json_extract(message, '$.dataLength') > 0` +
                ` AND instr('text/csv,application/eez-binary-list,application/eez-raw', json_extract(message, '$.fileType.mime'))`;
        }

        return filter;
    }

    rowsToHistoryItems(rows: any[]) {
        return rowsToHistoryItems(this.options.store, rows);
    }

    addActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        const historyItem = createHistoryItem(
            this.options.store,
            activityLogEntry
        );

        this.filterStats.onHistoryItemCreated(historyItem);

        // increment day counter in calandar
        let day = new Date(
            historyItem.date.getFullYear(),
            historyItem.date.getMonth(),
            historyItem.date.getDate()
        );
        this.calendar.incrementCounter(day);

        let j;
        for (j = 0; j < this.items.length; j++) {
            if (this.items[j].id == historyItem.id) {
                // duplicate
                j = -1;
                break;
            }

            if (
                this.items.length > 0 &&
                (historyItem.date < this.items[j].date ||
                    (historyItem.date === this.items[j].date &&
                        historyItem.id < this.items[j].id))
            ) {
                break;
            }
        }

        if (j != -1) {
            if (j == 0) {
                // add to the front
                this.items.unshift(historyItem);
            } else if (j == this.items.length) {
                // add to the back
                this.items.push(historyItem);
            } else {
                // add inside
                this.items.splice(j, 0, historyItem);
            }
        }

        return historyItem;
    }

    removeActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        const foundItem = this.findHistoryItemById(activityLogEntry.id);
        if (foundItem) {
            this.items[foundItem.index].dispose();
            this.items.splice(foundItem.index, 1);

            this.filterStats.onHistoryItemRemoved(foundItem.historyItem);

            // decrement day counter in calandar
            let day = new Date(
                foundItem.historyItem.date.getFullYear(),
                foundItem.historyItem.date.getMonth(),
                foundItem.historyItem.date.getDate()
            );
            this.calendar.decrementCounter(day);

            return true;
        }
        return false;
    }

    displayRows(rows: any[]) {
        this.items.forEach(item => item.dispose());
        this.items = this.rowsToHistoryItems(rows);
        this.itemInTheCenterOfTheView = undefined;
        this.navigator.update();
    }

    freeSomeHistoryItemsFromTopIfTooMany() {
        while (this.items.length > CONF_MAX_NUM_OF_LOADED_ITEMS) {
            this.items[0].dispose();
            this.items.splice(0, 1);
        }
    }

    removeDuplicates() {
        const items: IHistoryItem[] = [];

        this.items.forEach(item => {
            if (items.find(item2 => item.id == item2.id)) {
                // duplicate
                item.dispose();
            } else {
                items.push(item);
            }
        });

        if (items.length != this.items.length) {
            this.items = items;
        }
    }

    addRowsToEnd(items: IHistoryItem[]) {
        this.items.push(...items);
        this.removeDuplicates();
        this.freeSomeHistoryItemsFromTopIfTooMany();
    }

    freeSomeHistoryItemsFromBottomIfTooMany() {
        while (this.items.length > CONF_MAX_NUM_OF_LOADED_ITEMS) {
            this.items[this.items.length - 1].dispose();
            this.items.splice(this.items.length - 1, 1);
        }
    }

    addRowsToStart(items: IHistoryItem[]) {
        this.items.splice(0, 0, ...items);
        this.removeDuplicates();
        this.freeSomeHistoryItemsFromBottomIfTooMany();
    }

    async onCreateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        const foundItem = this.findHistoryItemById(activityLogEntry.id);
        if (foundItem) {
            return;
        }

        if (op === "restore") {
            // this item was restored from undo buffer,
            this.addActivityLogEntry(activityLogEntry);
        } else {
            const historyItem = this.addActivityLogEntry(activityLogEntry);
            showHistoryItem(
                this.appStore.navigationStore.mainHistoryView,
                historyItem
            );
        }
    }

    onUpdateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        getScrapbookStore().onUpdateActivityLogEntry(activityLogEntry);

        const foundItem = this.findHistoryItemById(activityLogEntry.id);
        if (!foundItem) {
            return;
        }

        if (
            activityLogEntry.message !== undefined &&
            foundItem.historyItem.message !== activityLogEntry.message
        ) {
            foundItem.historyItem.message = activityLogEntry.message;
            const updatedHistoryItem = updateHistoryItemClass(
                this.options.store,
                foundItem.historyItem
            );
            if (updatedHistoryItem !== foundItem.historyItem) {
                this.items[foundItem.index] = updatedHistoryItem;
            }
        }

        if (activityLogEntry.data !== undefined) {
            foundItem.historyItem.setData(activityLogEntry.data);
        }

        if (activityLogEntry.temporary != undefined) {
            runInAction(() => {
                foundItem.historyItem.temporary = activityLogEntry.temporary;
            });
        }
    }

    onDeleteActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        getScrapbookStore().onActivityLogEntryRemoved(activityLogEntry);

        this.removeActivityLogEntry(activityLogEntry);
    }

    convertToChart() {
        const items = this.selection.items.filter(
            item => item.type == "instrument/answer"
        );

        if (items.length == 0) {
            return;
        }

        ipcRenderer.send("instrument/connection/create-plotter", {
            instrumentId: this.appStore.instrument.id,
            answerIds: items.map(item => item.id)
        });

        this.selection.selectItems([]);
    }

    storeSelectedHistoryItemsPermanently() {
        const items = this.selection.items.filter(item => item.temporary);
        if (items.length == 0) {
            return;
        }

        beginTransaction("Store history items permanently");

        items.forEach(historyItem => {
            logUpdate(
                this.options.store,
                {
                    oid: historyItem.oid,
                    id: historyItem.id,
                    temporary: false
                },
                {
                    undoable: true
                }
            );
        });

        commitTransaction();

        this.selection.selectItems([]);
    }

    deleteSelectedHistoryItems() {
        if (this.selection.items.length == 0) {
            return;
        }

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

        setTimeout(() => {
            if (this.items.length < CONF_ITEMS_BLOCK_SIZE) {
                if (this.navigator.hasOlder) {
                    this.navigator.loadOlder();
                } else {
                    this.navigator.loadNewer();
                }
            }
        }, 100);
    }

    /// Return all the history items between fromItem and toItem.
    /// This is used during mouse selection with SHIFT key.
    getAllItemsBetween(
        fromItem: IHistoryItem,
        toItem: IHistoryItem
    ): IHistoryItem[] {
        let direction: "normal" | "reversed" | undefined = undefined;
        let done = false;

        const items: IHistoryItem[] = [];

        for (let itemIndex = 0; itemIndex < this.items.length; ++itemIndex) {
            const item = this.items[itemIndex];

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

        return [];
    }

    itemInTheCenterOfTheView: IHistoryItem | undefined;

    setItemInTheCenterOfTheView(id: string) {
        const foundItem = this.findHistoryItemById(id);
        if (foundItem) {
            this.itemInTheCenterOfTheView = foundItem.historyItem;
        } else {
            this.itemInTheCenterOfTheView = undefined;
        }
    }

    async showItem(historyItem: IHistoryItem) {
        const rows = await dbQuery(
            "HistoryCalendar showItem " +
                ((this as any).emptyTrash ? " for deleted items" : ""),
            `SELECT
                    id,
                    ${this.options.store.nonTransientAndNonLazyProperties}
                FROM
                    (
                        SELECT
                            *
                        FROM
                            ${this.table} AS T1
                        WHERE
                            ${
                                this.oidWhereClause
                            } AND id >= ? ${this.getFilter()}
                        ORDER BY
                            id
                    )
                LIMIT ?`
        ).all(historyItem.id, CONF_ITEMS_BLOCK_SIZE);

        this.displayRows(rows);

        moveToTopOfHistory(this.appStore.navigationStore.mainHistoryView);
    }

    getDirectionInfo(historyItem: FileHistoryItem) {
        if (historyItem.direction === "upload") {
            return "Sending file ...";
        } else if (historyItem.direction === "download") {
            return "Receiving file ...";
        } else if (historyItem.direction === "plotter") {
            return "Waiting for data ...";
        } else {
            return "Attaching file ...";
        }
    }

    get sendFileStatus() {
        if (this.items.length > 0) {
            const lastItem = this.items[this.items.length - 1];
            if (lastItem instanceof FileHistoryItem) {
                if (lastItem.expectedDataLength) {
                    let percent = lastItem.expectedDataLength
                        ? Math.floor(
                              (100 * lastItem.dataLength) /
                                  lastItem.expectedDataLength
                          )
                        : 0;
                    let transferSpeed = formatTransferSpeed(
                        lastItem.transferSpeed
                    );
                    return `${this.getDirectionInfo(lastItem)} ${percent}% (${
                        lastItem.dataLength
                    } of ${lastItem.expectedDataLength}) ${transferSpeed}`;
                }
            }
        }
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DeletedItemsHistory extends History {
    deletedCount: number = 0;

    constructor(
        public appStore: IAppStore,
        options?: Partial<IHistoryOptions>
    ) {
        super(
            appStore,
            Object.assign({}, options, {
                isDeletedItemsHistory: true
            })
        );

        makeObservable(this, {
            deletedCount: observable,
            refreshDeletedCount: action.bound,
            restoreSelectedHistoryItems: action.bound,
            emptyTrash: action.bound
        });

        scheduleTask(
            "Get deleted history items count",
            Priority.Lowest,
            this.refreshDeletedCount
        );
    }

    async refreshDeletedCount() {
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

        runInAction(() => {
            this.deletedCount = result ? Number(result.count) : 0;
        });
    }

    filterActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        return activityLogEntry.deleted;
    }

    getFilter() {
        return "AND deleted";
    }

    async onCreateActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        if (op === "restore") {
            if (this.removeActivityLogEntry(activityLogEntry)) {
                this.deletedCount--;
            }
        }
    }

    onDeleteActivityLogEntry(
        activityLogEntry: IActivityLogEntry,
        op: StoreOperation,
        options: IStoreOperationOptions
    ) {
        if (options.deletePermanently) {
            if (this.removeActivityLogEntry(activityLogEntry)) {
                this.deletedCount--;
            }
        } else {
            // we need all properties here since only id is guaranteed from store notification when deleting object
            activityLogEntry = this.options.store.findById(activityLogEntry.id);
            if (activityLogEntry) {
                this.addActivityLogEntry(activityLogEntry);
                this.deletedCount++;
            }
        }
    }

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

    deleteSelectedHistoryItems() {
        if (this.selection.items.length > 0) {
            confirm(
                "Are you sure?",
                "This will permanently delete selected history items.",
                () => {
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
                }
            );
        }
    }

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
