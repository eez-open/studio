import React from "react";
import { observable, action, reaction } from "mobx";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";
import { activityLogStore } from "eez-studio-shared/activity-log";
import { IHistoryItem } from "instrument/window/history/item";
import { HistoryItems } from "instrument/window/history/list-component";
import { createHistoryItem } from "instrument/window/history/item-factory";
import { IAppStore, History } from "instrument/window/history/history";

class Selection {
    @observable items: IHistoryItem[] = [];

    @action
    selectItems(historyItems: IHistoryItem[]) {
        this.items.forEach(historyItem => (historyItem.selected = false));
        this.items = historyItems;
        this.items.forEach(historyItem => (historyItem.selected = true));
    }
}

const Container = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    padding: 10px;

    overflow: auto;
`;

@observer
export class Scrapbook extends React.Component<{ appStore: IAppStore; history: History }> {
    @observable items: IHistoryItem[] = [];

    constructor(props: any) {
        super(props);
        const itemIdsStr = localStorage.getItem(
            `instrument/${this.props.appStore.instrument!.id}/scrapbook`
        );
        if (itemIdsStr) {
            const itemIds: string[] = JSON.parse(itemIdsStr);
            if (itemIds) {
                this.items = itemIds
                    .map(itemId => {
                        const activityLogItem = activityLogStore.findById(itemId);
                        if (activityLogItem) {
                            return createHistoryItem(activityLogItem, this.props.appStore);
                        }
                        return undefined;
                    })
                    .filter(item => !!item) as IHistoryItem[];
            }
        }

        reaction(
            () => this.items.map(item => item.id),
            items =>
                localStorage.setItem(
                    `instrument/${this.props.appStore.instrument!.id}/scrapbook`,
                    JSON.stringify(items)
                )
        );
    }

    allowDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    onDrop = action((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        var itemId = event.dataTransfer.getData("text");
        const activityLogItem = activityLogStore.findById(itemId);
        if (activityLogItem) {
            this.items.push(createHistoryItem(activityLogItem, this.props.appStore));
        }
    });

    getAllItemsBetween = (fromItem: IHistoryItem, toItem: IHistoryItem) => {
        const i = this.items.indexOf(fromItem);
        const j = this.items.indexOf(toItem);
        return this.items.slice(i, j + 1);
    };

    deleteSelectedHistoryItems = action(() => {
        this.items = this.items.filter(item => this.selection.items.indexOf(item) == -1);
    });

    selection = new Selection();

    render() {
        return (
            <Container onDragOver={this.allowDrop} onDrop={this.onDrop}>
                <HistoryItems
                    appStore={this.props.appStore}
                    historyItems={this.items}
                    selection={this.selection}
                    selectHistoryItemsSpecification={undefined}
                    getAllItemsBetween={this.getAllItemsBetween}
                    isDeletedItemsHistory={false}
                    deleteSelectedHistoryItems={() => this.deleteSelectedHistoryItems}
                />
            </Container>
        );
    }
}
