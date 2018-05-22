import { observable, action, reaction } from "mobx";

import { scheduleTask, Priority } from "shared/scheduler";
import { InstrumentObject, instruments } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

type SelectableHistoryItemTypes = "chart" | "all";

interface SelectHistoryItemsSpecification {
    historyItemType: SelectableHistoryItemTypes;
    message: string;
    alertDanger?: boolean;
    okButtonText: string;
    okButtonTitle: string;
    onOk(): void;
}

interface Filters {
    connectsAndDisconnects: boolean;
    scpi: boolean;
    files: boolean;
    charts: boolean;
    lists: boolean;
    notes: boolean;
    launchedScripts: boolean;
    deleted: boolean;
}

export const appStore: {
    instrument: InstrumentObject | undefined;
    helpVisible: boolean;
    searchVisible: boolean;
    filtersVisible: boolean;
    filters: Filters;
    searchViewSection: "calendar" | "sessions";
    selectHistoryItemsSpecification: SelectHistoryItemsSpecification | undefined;
    selectedHistoryItems: Map<string, boolean>;
} = observable({
    instrument: undefined,
    helpVisible: localStorage.getItem("instrument/window/help-visible") === "1" || false,
    searchVisible: localStorage.getItem("instrument/window/search-visible") === "1" || true,
    filtersVisible: localStorage.getItem("instrument/window/filters-visible") === "1" || true,
    filters: getFiltersFromLocalStorage(),
    searchViewSection:
        (localStorage.getItem("instrument/window/search/view-section") as any) || "calendar",
    selectHistoryItemsSpecification: undefined,
    selectedHistoryItems: new Map<string, boolean>()
});

function getFiltersFromLocalStorage(): Filters {
    let filtersJSON = localStorage.getItem("instrument/window/filters");
    if (filtersJSON) {
        try {
            return JSON.parse(filtersJSON);
        } catch (err) {
            console.error("getFiltersFromLocalStorage", err);
        }
    }

    return {
        connectsAndDisconnects: true,
        scpi: true,
        files: true,
        charts: true,
        lists: true,
        notes: true,
        launchedScripts: true,
        deleted: false
    };
}

reaction(
    () => JSON.stringify(appStore.filters),
    filters => {
        localStorage.setItem("instrument/window/filters", filters);
    }
);

export const toggleHelpVisible = action(() => {
    appStore.helpVisible = !appStore.helpVisible;
    localStorage.setItem("instrument/window/help-visible", appStore.helpVisible ? "1" : "0");
});

export const toggleSearchVisible = action(() => {
    appStore.searchVisible = !appStore.searchVisible;
    localStorage.setItem("instrument/window/search-visible", appStore.searchVisible ? "1" : "0");
});

export const toggleFiltersVisible = action(() => {
    appStore.filtersVisible = !appStore.filtersVisible;
    localStorage.setItem("instrument/window/filters-visible", appStore.filtersVisible ? "1" : "0");
});

export const setSearchViewSection = action((value: "calendar" | "sessions") => {
    appStore.searchViewSection = value;
    localStorage.setItem("instrument/window/search/view-section", value);
});

export const selectHistoryItems = action(
    (specification: SelectHistoryItemsSpecification | undefined) => {
        appStore.selectHistoryItemsSpecification = specification;
        appStore.selectedHistoryItems.clear();
    }
);

export function isHistoryItemSelected(id: string) {
    return appStore.selectedHistoryItems.has(id);
}

export const selectHistoryItem = action((id: string, selected: boolean) => {
    if (selected) {
        appStore.selectedHistoryItems.set(id, true);
    } else {
        appStore.selectedHistoryItems.delete(id);
    }
});

////////////////////////////////////////////////////////////////////////////////

scheduleTask(
    "Load instrument",
    Priority.High,
    action(() => {
        const instrumentId = EEZStudio.electron.ipcRenderer.sendSync("getWindowArgs");
        appStore.instrument = instruments.get(instrumentId);
    })
);
