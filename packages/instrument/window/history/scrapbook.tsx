import React from "react";
import { observable, action, reaction, makeObservable } from "mobx";
import { observer } from "mobx-react";

import {
    activityLogStore,
    IActivityLogEntry
} from "eez-studio-shared/activity-log";

import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";

import type { IHistoryItem } from "instrument/window/history/item";
import {
    HistoryItems,
    CLIPBOARD_DATA_TYPE
} from "instrument/window/history/list-component";
import { createHistoryItem } from "instrument/window/history/item-factory";
import type { IAppStore, History } from "instrument/window/history/history";

function isHomeHistoryAppStore(appStore: IAppStore) {
    return appStore.instrument.id === "0";
}

class Selection {
    items: IHistoryItem[] = [];

    constructor() {
        makeObservable(this, {
            items: observable,
            selectItems: action
        });
    }

    selectItems(historyItems: IHistoryItem[]) {
        this.items.forEach(historyItem => (historyItem.selected = false));
        this.items = historyItems;
        this.items.forEach(historyItem => (historyItem.selected = true));
    }
}

class ScrapbookStore {
    _items: IHistoryItem[] = [];
    thumbnailSize = 240;
    showAll = true;
    selection = new Selection();

    constructor() {
        makeObservable<ScrapbookStore, "deleteItemById">(this, {
            _items: observable,
            thumbnailSize: observable,
            showAll: observable,
            deleteItemById: action,
            onUpdateActivityLogEntry: action,
            onActivityLogEntryRemoved: action
        });

        const itemIdsStr = localStorage.getItem(`instrument/scrapbook/items`);
        if (itemIdsStr) {
            const itemIds: string[] = JSON.parse(itemIdsStr);
            if (itemIds) {
                this._items = itemIds
                    .map(itemId => {
                        const activityLogEntry =
                            activityLogStore.findById(itemId);
                        if (activityLogEntry) {
                            return createHistoryItem(
                                activityLogStore,
                                activityLogEntry
                            );
                        }
                        return undefined;
                    })
                    .filter(item => !!item) as IHistoryItem[];
            }
        }

        reaction(
            () => this._items.map(item => item.id),
            items =>
                localStorage.setItem(
                    `instrument/scrapbook/items`,
                    JSON.stringify(items)
                )
        );

        //

        const thumbnailSizeStr = localStorage.getItem(
            `instrument/scrapbook/thumbnail-size`
        );
        if (thumbnailSizeStr) {
            this.thumbnailSize = JSON.parse(thumbnailSizeStr);
        }

        reaction(
            () => this.thumbnailSize,
            thumbnailSize =>
                localStorage.setItem(
                    `instrument/scrapbook/thumbnail-size`,
                    JSON.stringify(thumbnailSize)
                )
        );

        //

        const showAllStr = localStorage.getItem(
            `instrument/scrapbook/show-all`
        );
        if (showAllStr) {
            this.showAll = JSON.parse(showAllStr);
        }

        reaction(
            () => this.showAll,
            showAll =>
                localStorage.setItem(
                    `instrument/scrapbook/show-all`,
                    JSON.stringify(showAll)
                )
        );
    }

    items(appStore: IAppStore) {
        return this.showAll || isHomeHistoryAppStore(appStore)
            ? this._items
            : this._items.filter(item => item.oid == appStore.instrument.id);
    }

    private findIndexOfItemById(itemId: string) {
        const item = this._items.find(item => item.id == itemId);
        if (item) {
            return this._items.indexOf(item);
        }
        return -1;
    }

    private deleteItemById(itemId: string) {
        const i = this.findIndexOfItemById(itemId);
        if (i != -1) {
            this._items.splice(i, 1);
        }
    }

    insertBeforeItem(
        item: IHistoryItem | undefined,
        activityLogEntry: IActivityLogEntry
    ): void {
        let insertAt = item ? this._items.indexOf(item) : this._items.length;

        item = this._items.find(item => item.id == activityLogEntry.id);
        if (item) {
            const i = this._items.indexOf(item);
            if (i < insertAt) {
                insertAt--;
            }
            this._items.splice(i, 1);
            this._items.splice(insertAt, 0, item);
        } else {
            this._items.splice(
                insertAt,
                0,
                createHistoryItem(activityLogStore, activityLogEntry)
            );
        }
    }

    onUpdateActivityLogEntry(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.message !== undefined) {
            const i = this.findIndexOfItemById(activityLogEntry.id);
            if (i != -1) {
                this._items[i].message = activityLogEntry.message;
            }
        }
    }

    onActivityLogEntryRemoved(activityLogEntry: IActivityLogEntry) {
        this.deleteItemById(activityLogEntry.id);
    }

    deleteSelectedHistoryItems = action(() => {
        this._items = this._items.filter(
            item => this.selection.items.indexOf(item) == -1
        );
    });

    selectAllItems = action((appStore: IAppStore) => {
        this.selection.selectItems(this.items(appStore).slice());
    });
}

let _theScrapbook: ScrapbookStore;

export function getScrapbookStore() {
    if (!_theScrapbook) {
        _theScrapbook = new ScrapbookStore();
    }
    return _theScrapbook;
}

export const Scrapbook = observer(
    class Scrapbook extends React.Component<{
        appStore: IAppStore;
        history: History;
    }> {
        div: HTMLDivElement;
        insertAt: number | undefined;
        dropMarkLeft: number | undefined;
        dropMarkTop: number;
        dropMarkHeight: number;

        onDragOver = action((event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();

            event.dataTransfer.dropEffect = "copy";

            const rectContainer = this.div.getBoundingClientRect();

            const itemElements = $(this.div).find(
                ">div.EezStudio_HistoryItemEnclosure"
            );
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
            this.dropMarkLeft = undefined;
        });

        onDrop = action((event: React.DragEvent<HTMLDivElement>) => {
            event.stopPropagation();
            event.preventDefault();

            if (this.insertAt != undefined) {
                const itemId = event.dataTransfer.getData(CLIPBOARD_DATA_TYPE);
                const activityLogEntry = activityLogStore.findById(itemId);
                if (activityLogEntry) {
                    const items = getScrapbookStore().items(
                        this.props.appStore
                    );
                    getScrapbookStore().insertBeforeItem(
                        this.insertAt < items.length
                            ? items[this.insertAt]
                            : undefined,
                        activityLogEntry
                    );
                }
            }

            this.insertAt = undefined;
            this.dropMarkLeft = undefined;
        });

        getAllItemsBetween = (fromItem: IHistoryItem, toItem: IHistoryItem) => {
            const items = getScrapbookStore().items(this.props.appStore);
            const i = items.indexOf(fromItem);
            const j = items.indexOf(toItem);
            return items.slice(i, j + 1);
        };

        showInHistory = () => {
            this.props.appStore.history.showItem(
                getScrapbookStore().selection.items[0]
            );
        };

        setDiv = (ref: any) => {
            this.div = ref;
        };

        constructor(props: { appStore: IAppStore; history: History }) {
            super(props);

            makeObservable(this, {
                dropMarkLeft: observable,
                dropMarkTop: observable,
                dropMarkHeight: observable
            });
        }

        render() {
            if (location.href.indexOf("home/index.html") == -1) {
                return null;
            }

            const theScrapbook = getScrapbookStore();

            return (
                <VerticalHeaderWithBody
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%"
                    }}
                >
                    <ToolbarHeader>
                        <div className="EezStudio_ScrapbookHeaderContainer">
                            {/* do not show this checkbox in Home/History tab */}
                            {isHomeHistoryAppStore(this.props.appStore) ? (
                                <div />
                            ) : (
                                <div className="form-check">
                                    <label className="form-check-label">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={theScrapbook.showAll}
                                            onChange={action(
                                                event =>
                                                    (theScrapbook.showAll =
                                                        event.target.checked)
                                            )}
                                        />
                                        Show all instruments
                                    </label>
                                </div>
                            )}
                            <div>
                                <span>Thumbnail size</span>
                                <input
                                    type="range"
                                    value={theScrapbook.thumbnailSize}
                                    onChange={action(
                                        event =>
                                            (theScrapbook.thumbnailSize =
                                                parseInt(
                                                    event.currentTarget.value
                                                ))
                                    )}
                                    min={48}
                                    max={480}
                                    className="form-range"
                                />
                            </div>
                        </div>
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        <div
                            className="EezStudio_ScrapbookContainer"
                            ref={this.setDiv}
                            onDragOver={this.onDragOver}
                            onDragLeave={this.onDragLeave}
                            onDrop={this.onDrop}
                            tabIndex={0}
                            style={{
                                gridTemplateColumns: `repeat(auto-fit, ${
                                    26 + theScrapbook.thumbnailSize
                                }px)`
                            }}
                            onClick={event => {
                                if (
                                    $(event.target).closest(
                                        ".EezStudio_HistoryItemEnclosure"
                                    ).length === 0
                                ) {
                                    theScrapbook.selection.selectItems([]);
                                }
                            }}
                        >
                            <HistoryItems
                                appStore={this.props.appStore}
                                historyItems={theScrapbook.items(
                                    this.props.appStore
                                )}
                                selection={theScrapbook.selection}
                                selectHistoryItemsSpecification={undefined}
                                getAllItemsBetween={this.getAllItemsBetween}
                                isDeletedItemsHistory={false}
                                deleteSelectedHistoryItems={
                                    theScrapbook.deleteSelectedHistoryItems
                                }
                                viewType="thumbs"
                                thumbnailSize={theScrapbook.thumbnailSize}
                                showInHistory={this.showInHistory}
                            />
                            {this.dropMarkLeft != undefined && (
                                <div
                                    className="EezStudio_DropMark"
                                    style={{
                                        left: this.dropMarkLeft,
                                        top: this.dropMarkTop,
                                        height: this.dropMarkHeight
                                    }}
                                >
                                    <div />
                                    <div />
                                </div>
                            )}
                        </div>
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);
