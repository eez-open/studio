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

export class Filters {
    @observable connectsAndDisconnects: boolean = true;
    @observable scpi: boolean = true;
    @observable downloadedFiles: boolean = true;
    @observable uploadedFiles: boolean = true;
    @observable attachedFiles: boolean = true;
    @observable charts: boolean = true;
    @observable lists: boolean = true;
    @observable notes: boolean = true;
    @observable launchedScripts: boolean = true;
}

class AppStore {
    @observable instrument: InstrumentObject | undefined = undefined;

    @observable
    helpVisible: boolean = localStorage.getItem("instrument/window/help-visible") === "1" || false;

    @observable
    searchVisible: boolean = localStorage.getItem("instrument/window/search-visible") === "1" ||
    true;

    @observable
    filtersVisible: boolean = localStorage.getItem("instrument/window/filters-visible") === "1" ||
    true;

    static getFiltersFromLocalStorage(): Filters {
        const filters = new Filters();

        let filtersJSON = localStorage.getItem("instrument/window/filters");
        if (filtersJSON) {
            try {
                Object.assign(filters, JSON.parse(filtersJSON));
            } catch (err) {
                console.error("getFiltersFromLocalStorage", err);
            }
        }

        return filters;
    }

    @observable filters: Filters = AppStore.getFiltersFromLocalStorage();

    @observable
    searchViewSection: "calendar" | "sessions" = (localStorage.getItem(
        "instrument/window/search/view-section"
    ) as any) || "calendar";

    @observable
    selectHistoryItemsSpecification: SelectHistoryItemsSpecification | undefined = undefined;

    @observable selectedHistoryItems: Map<string, boolean> = new Map<string, boolean>();

    constructor() {
        reaction(
            () => JSON.stringify(this.filters),
            filters => {
                localStorage.setItem("instrument/window/filters", filters);
            }
        );
    }

    @action
    toggleHelpVisible() {
        this.helpVisible = !this.helpVisible;
        localStorage.setItem("instrument/window/help-visible", this.helpVisible ? "1" : "0");
    }

    @action
    toggleSearchVisible() {
        this.searchVisible = !this.searchVisible;
        localStorage.setItem("instrument/window/search-visible", this.searchVisible ? "1" : "0");
    }

    @action
    toggleFiltersVisible() {
        this.filtersVisible = !this.filtersVisible;
        localStorage.setItem("instrument/window/filters-visible", this.filtersVisible ? "1" : "0");
    }

    @action
    setSearchViewSection(value: "calendar" | "sessions") {
        this.searchViewSection = value;
        localStorage.setItem("instrument/window/search/view-section", value);
    }

    @action
    selectHistoryItems(specification: SelectHistoryItemsSpecification | undefined) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    isHistoryItemSelected(id: string) {
        return this.selectedHistoryItems.has(id);
    }

    @action
    selectHistoryItem(id: string, selected: boolean) {
        if (selected) {
            this.selectedHistoryItems.set(id, true);
        } else {
            this.selectedHistoryItems.delete(id);
        }
    }
}

export const appStore = new AppStore();

////////////////////////////////////////////////////////////////////////////////

scheduleTask(
    "Load instrument",
    Priority.High,
    action(() => {
        const instrumentId = EEZStudio.electron.ipcRenderer.sendSync("getWindowArgs");
        appStore.instrument = instruments.get(instrumentId);
    })
);
