import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { VerticalHeaderWithBody, ToolbarHeader, Body } from "shared/ui/header-with-body";

import {
    IAppStore,
    SelectHistoryItemsSpecification,
    History,
    DeletedItemsHistory
} from "instrument/window/history/history";
import { Filters } from "instrument/window/history/filters";
import { HistoryTools, HistoryView } from "instrument/window/history/history-view";
import {
    DeletedHistoryItemsTools,
    DeletedHistoryItemsView
} from "instrument/window/history/deleted-history-items-view";

import { navigationStore } from "home/navigation-store";

////////////////////////////////////////////////////////////////////////////////

class HomeAppStore implements IAppStore {
    constructor(public oids?: string[]) {}

    @observable
    selectHistoryItemsSpecification: SelectHistoryItemsSpecification | undefined;

    @observable
    selectedHistoryItems = new Map<string, boolean>();

    instrument: {
        id: string;
        connection: {
            abortLongOperation(): void;
        };
        listsProperty?: any;
    } = {
        id: "0",
        connection: {
            abortLongOperation() {
                // @todo
            }
        }
    };

    filters: Filters = new Filters();

    history: History = new History(this);
    deletedItemsHistory: DeletedItemsHistory = new DeletedItemsHistory(this);

    isHistoryItemSelected(id: string): boolean {
        return this.selectedHistoryItems.has(id);
    }

    @action
    selectHistoryItem(id: string, selected: boolean): void {
        if (selected) {
            this.selectedHistoryItems.set(id, true);
        } else {
            this.selectedHistoryItems.delete(id);
        }
    }

    @action
    selectHistoryItems(specification: SelectHistoryItemsSpecification | undefined) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    navigationStore = navigationStore;

    searchVisible: boolean;
    toggleSearchVisible(): void {
        // @todo
    }

    filtersVisible: boolean;
    toggleFiltersVisible(): void {
        // @todo
    }

    searchViewSection: "calendar" | "sessions" = "calendar";
    setSearchViewSection(value: "calendar" | "sessions"): void {
        // @todo
    }

    findListIdByName(listName: string): string | undefined {
        // @todo
        return undefined;
    }
}

let appStore: HomeAppStore | undefined;

export function getAppStore(oids?: string[]) {
    if (!oids || oids.length === 0) {
        if (!appStore) {
            appStore = new HomeAppStore([]);
        }
        return appStore;
    } else {
        return new HomeAppStore(oids);
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistorySection extends React.Component<{
    oids?: string[];
    simple?: boolean;
}> {
    appStore: HomeAppStore;

    constructor(props: any) {
        super(props);
        this.appStore = getAppStore(props.oids);
    }

    componentWillReceiveProps(props: any) {
        this.appStore = getAppStore(props.oids);
    }

    render() {
        const historyView = (
            <HistoryView
                appStore={this.appStore}
                persistId={"home/history"}
                simple={this.props.simple}
            />
        );

        if (this.props.simple) {
            return historyView;
        }

        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <HistoryTools appStore={this.appStore} />
                </ToolbarHeader>
                <Body>{historyView}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeletedHistoryItemsSection extends React.Component<{}> {
    render() {
        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <DeletedHistoryItemsTools appStore={getAppStore()} />
                </ToolbarHeader>
                <Body>
                    <DeletedHistoryItemsView
                        appStore={getAppStore()}
                        persistId={"home/deleted-history-items"}
                    />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
