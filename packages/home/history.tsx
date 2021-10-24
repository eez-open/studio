import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";

import {
    IAppStore,
    SelectHistoryItemsSpecification,
    History,
    DeletedItemsHistory,
    IInstrumentObject
} from "instrument/window/history/history";
import { Filters } from "instrument/window/history/filters";
import {
    HistoryTools,
    HistoryView
} from "instrument/window/history/history-view";
import {
    DeletedHistoryItemsTools,
    DeletedHistoryItemsView
} from "instrument/window/history/deleted-history-items-view";

import { tabs } from "home/tabs-store";
import type { IUnit } from "eez-studio-shared/units";

////////////////////////////////////////////////////////////////////////////////

class HomeAppStore implements IAppStore {
    constructor(public oids?: string[]) {}

    @observable selectHistoryItemsSpecification:
        | SelectHistoryItemsSpecification
        | undefined;
    @observable selectedHistoryItems = new Map<string, boolean>();

    instrument: IInstrumentObject = {
        id: "0",
        connection: {
            abortLongOperation() {
                // @todo
            },
            isConnected: false
        },
        listsMinDwellProperty: 0,
        listsMaxDwellProperty: 0,
        firstChannel: undefined,
        getDigits: (unit: IUnit) => 3,
        listsMaxPointsProperty: 0,
        listsCurrentDigitsProperty: 0,
        listsDwellDigitsProperty: 0,
        listsVoltageDigitsProperty: 0
    };
    instrumentLists = [];

    filters: Filters = new Filters();

    history: History = new History(this, {
        loadAtStart: false
    });
    deletedItemsHistory: DeletedItemsHistory = new DeletedItemsHistory(this, {
        loadAtStart: false
    });

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
    selectHistoryItems(
        specification: SelectHistoryItemsSpecification | undefined
    ) {
        this.selectHistoryItemsSpecification = specification;
        this.selectedHistoryItems.clear();
    }

    navigationStore = tabs;

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
        this.appStore.history.load();
    }

    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.appStore = getAppStore(this.props.oids);
            this.appStore.history.load();
        }
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
export class DeletedHistoryItemsSection extends React.Component {
    constructor(props: any) {
        super(props);
        getAppStore().history.load();
    }

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
