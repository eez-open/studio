import React from "react";
import { observable, action, reaction } from "mobx";
import { observer } from "mobx-react";

import { styled } from "eez-studio-ui/styled-components";
import { activityLogStore, IActivityLogEntry } from "eez-studio-shared/activity-log";
import { VerticalHeaderWithBody, ToolbarHeader, Body } from "eez-studio-ui/header-with-body";
import { IHistoryItem } from "instrument/window/history/item";
import { HistoryItems, CLIPBOARD_DATA_TYPE } from "instrument/window/history/list-component";
import { createHistoryItem } from "instrument/window/history/item-factory";
import { IAppStore, History } from "instrument/window/history/history";

export class ScrapbookStore {
    @observable items: IHistoryItem[] = [];
    @observable thumbnailSize = 240;
    selection = new Selection();

    constructor(private appStore: IAppStore) {
        const itemIdsStr = localStorage.getItem(
            `instrument/${this.appStore.instrument!.id}/scrapbook/items`
        );
        if (itemIdsStr) {
            const itemIds: string[] = JSON.parse(itemIdsStr);
            if (itemIds) {
                this.items = itemIds
                    .map(itemId => {
                        const activityLogEntry = activityLogStore.findById(itemId);
                        if (activityLogEntry) {
                            return createHistoryItem(activityLogEntry, this.appStore);
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
                    `instrument/${this.appStore.instrument!.id}/scrapbook/items`,
                    JSON.stringify(items)
                )
        );

        const thumbnailSizeStr = localStorage.getItem(
            `instrument/${this.appStore.instrument!.id}/scrapbook/thumbnail-size`
        );
        if (thumbnailSizeStr) {
            this.thumbnailSize = JSON.parse(thumbnailSizeStr);
        }

        reaction(
            () => this.thumbnailSize,
            thumbnailSize =>
                localStorage.setItem(
                    `instrument/${this.appStore.instrument!.id}/scrapbook/thumbnail-size`,
                    JSON.stringify(thumbnailSize)
                )
        );
    }

    findIndexOfItemById(itemId: string) {
        const item = this.items.find(item => item.id == itemId);
        if (item) {
            return this.items.indexOf(item);
        }
        return -1;
    }

    @action
    deleteItemById(itemId: string) {
        const i = this.findIndexOfItemById(itemId);
        if (i != -1) {
            this.items.splice(i, 1);
        }
    }

    @action
    onUpdateActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.message !== undefined) {
            const i = this.findIndexOfItemById(activityLogEntry.id);
            if (i != -1) {
                this.items[i].message = activityLogEntry.message;
            }
        }
    }

    @action
    onActivityLogEntryRemoved(activityLogEntry: IActivityLogEntry) {
        this.deleteItemById(activityLogEntry.id);
    }

    deleteSelectedHistoryItems = action(() => {
        this.items = this.items.filter(item => this.selection.items.indexOf(item) == -1);
    });
}

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

    display: grid;
    grid-auto-flow: row dense;
    grid-auto-columns: max-content;
    grid-auto-rows: max-content;

    background-color: white;
`;

const DropMark = styled.div`
    position: absolute;
    width: 2px;
    background-color: ${props => props.theme.dropPlaceColor};

    > div:nth-child(1) {
        position: absolute;
        left: -3px;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid ${props => props.theme.dropPlaceColor};
    }

    > div:nth-child(2) {
        position: absolute;
        left: -3px;
        bottom: 0;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 4px solid ${props => props.theme.dropPlaceColor};
    }
`;

@observer
export class Scrapbook extends React.Component<{ appStore: IAppStore; history: History }> {
    div: HTMLDivElement;
    insertAt: number | undefined;
    @observable dropMarkLeft: number | undefined;
    @observable dropMarkTop: number;
    @observable dropMarkHeight: number;

    onDragOver = action((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        const rectContainer = this.div.getBoundingClientRect();

        const itemElements = $(this.div).find(">div.EezStudio_HistoryItemEnclosure");
        let i = 0;
        let x = rectContainer.left + 10;
        let y = rectContainer.top + 10;
        let height = 100;
        for (i = 0; i < itemElements.length; i++) {
            const rect = itemElements[i].getBoundingClientRect();
            if (
                event.nativeEvent.clientX >= rect.left &&
                event.nativeEvent.clientX <= rect.right &&
                event.nativeEvent.clientY >= rect.top &&
                event.nativeEvent.clientY <= rect.bottom
            ) {
                x = rect.left;
                y = rect.top;
                height = rect.height;
                break;
            }

            if (i == itemElements.length - 1) {
                x = rect.right;
                y = rect.top;
                height = rect.height;
            }
        }

        this.dropMarkLeft = x - rectContainer.left + this.div.scrollLeft;
        this.dropMarkTop = y - rectContainer.top + this.div.scrollTop;
        this.dropMarkHeight = height;

        this.insertAt = i;
    });

    onDragLeave = action((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        //this.dropMarkLeft = undefined;
    });

    onDrop = action((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (this.insertAt != undefined) {
            const items = this.props.appStore.scrapbook.items;
            const itemId = event.dataTransfer.getData(CLIPBOARD_DATA_TYPE);
            const activityLogEntry = activityLogStore.findById(itemId);
            if (activityLogEntry) {
                const i = this.props.appStore.scrapbook.findIndexOfItemById(itemId);
                if (i != -1) {
                    if (i < this.insertAt) {
                        this.insertAt--;
                    }
                    items.splice(i, 1);
                }

                items.splice(
                    this.insertAt,
                    0,
                    createHistoryItem(activityLogEntry, this.props.appStore)
                );
            }
        }

        this.insertAt = undefined;
        this.dropMarkLeft = undefined;
    });

    getAllItemsBetween = (fromItem: IHistoryItem, toItem: IHistoryItem) => {
        const items = this.props.appStore.scrapbook.items;
        const i = items.indexOf(fromItem);
        const j = items.indexOf(toItem);
        return items.slice(i, j + 1);
    };

    showInHistory = () => {
        console.log(this.props.appStore.scrapbook.selection.items[0].id);
        this.props.appStore.history.showItem(this.props.appStore.scrapbook.selection.items[0]);
    };

    setDiv = (ref: any) => {
        this.div = ref;
    };

    render() {
        return (
            <VerticalHeaderWithBody
                style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%"
                }}
            >
                <ToolbarHeader>
                    <span style={{ marginRight: 10 }}>Thumbnail size</span>
                    <input
                        type="range"
                        value={this.props.appStore.scrapbook.thumbnailSize}
                        onChange={action(
                            event =>
                                (this.props.appStore.scrapbook.thumbnailSize = parseInt(
                                    event.currentTarget.value
                                ))
                        )}
                        min={48}
                        max={480}
                    />
                </ToolbarHeader>
                <Body tabIndex={0}>
                    <Container
                        className="EezStudio_Scrapbook_Container"
                        ref={this.setDiv}
                        onDragOver={this.onDragOver}
                        onDragLeave={this.onDragLeave}
                        onDrop={this.onDrop}
                        tabIndex={0}
                        style={{
                            gridTemplateColumns: `repeat(auto-fit, ${
                                26 + this.props.appStore.scrapbook.thumbnailSize
                            }px)`
                        }}
                    >
                        <HistoryItems
                            appStore={this.props.appStore}
                            historyItems={this.props.appStore.scrapbook.items}
                            selection={this.props.appStore.scrapbook.selection}
                            selectHistoryItemsSpecification={undefined}
                            getAllItemsBetween={this.getAllItemsBetween}
                            isDeletedItemsHistory={false}
                            deleteSelectedHistoryItems={
                                this.props.appStore.scrapbook.deleteSelectedHistoryItems
                            }
                            viewType="thumbs"
                            thumbnailSize={this.props.appStore.scrapbook.thumbnailSize}
                            showInHistory={this.showInHistory}
                        />
                        {this.dropMarkLeft != undefined && (
                            <DropMark
                                style={{
                                    left: this.dropMarkLeft,
                                    top: this.dropMarkTop,
                                    height: this.dropMarkHeight
                                }}
                            >
                                <div />
                                <div />
                            </DropMark>
                        )}
                    </Container>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
