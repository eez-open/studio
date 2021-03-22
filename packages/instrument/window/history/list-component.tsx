import React from "react";
import { findDOMNode } from "react-dom";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import { _debounce } from "eez-studio-shared/algorithm";
import { addAlphaToColor } from "eez-studio-shared/color";

import styled from "eez-studio-ui/styled-components";
import { Icon } from "eez-studio-ui/icon";

import { Waveform } from "instrument/window/waveform/generic";

import {
    History,
    IAppStore,
    SelectHistoryItemsSpecification
} from "instrument/window/history/history";
import { IHistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const CONF_AUTO_RELOAD_TIMEOUT = 1000 / 30;
const CONF_AUTO_RELOAD_Y_THRESHOLD = 20;

export const CLIPBOARD_DATA_TYPE = "application/eez-studio-history-item";

////////////////////////////////////////////////////////////////////////////////

const HistoryItemEnclosure = styled.div`
    margin-bottom: 5px;

    & > input {
        float: left;
        margin-top: 3px;
        margin-right: 5px;
        width: 15px;
        height: 15px;
    }

    border: 2px solid transparent;
    padding: 1px;

    &.selected {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    &.EezStudio_HistoryItemEnclosure_Session {
        width: 100%;
    }

    &.disablePreview .EezStudio_ItemPreview {
        pointer-events: none;
    }

    &.thumbs {
        .EezStudio_HistoryItemDate {
            display: none;
        }

        .EezStudio_HistoryItemText {
            display: none;
        }

        .EezStudio_Toolbar {
            display: none;
        }

        .EezStudio_Icon {
            display: none;
        }

        .EezStudio_ChartPreview {
            padding: 0 !important;
        }

        .EezStudio_ItemPreview > img,
        .EezStudio_ChartView_Preview {
            width: 240px;
        }

        .EezStudio_ChartView_Preview {
            height: 240px;
            overflow: auto;
            padding: 0;
        }

        .EezStudio_HistoryItem_File_Note {
            min-width: auto;
        }

        .EezStudio_Chart_Title {
            visibility: hidden;
        }

        .EezStudio_ChartContainer {
            pointer-events: none;
        }
    }
`;

const HistoryItemRenderError = styled.div`
    background-color: ${props => addAlphaToColor(props.theme.errorColor, 0.3)};
    border-radius: 8px;
    padding: 10px;
`;

let CachedHistoryItemThumbnailEnclosure = HistoryItemEnclosure;
let cachedHistoryItemThumbnailEnclosureThumbnailSize = 240;

function getThumbnailEnclosure(thumbnailSize: number) {
    if (thumbnailSize != cachedHistoryItemThumbnailEnclosureThumbnailSize) {
        cachedHistoryItemThumbnailEnclosureThumbnailSize = thumbnailSize;

        CachedHistoryItemThumbnailEnclosure = styled(HistoryItemEnclosure)`
            &.thumbs {
                .EezStudio_ItemPreview > img,
                .EezStudio_ChartView_Preview {
                    width: ${thumbnailSize}px;
                }
                .EezStudio_ChartView_Preview {
                    height: ${thumbnailSize}px;
                }
            }
        `;
    }

    return CachedHistoryItemThumbnailEnclosure;
}

class ErrorBoundary extends React.Component<{ id: string }, { hasError: boolean }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <HistoryItemRenderError>
                    Error while rendering history item {this.props.id}!
                </HistoryItemRenderError>
            );
        }

        return this.props.children;
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface ISelection {
    items: IHistoryItem[];
    selectItems(historyItems: IHistoryItem[]): void;
}

@observer
export class HistoryItems extends React.Component<{
    appStore: IAppStore;
    historyItems: IHistoryItem[];
    selection: ISelection;
    selectHistoryItemsSpecification: SelectHistoryItemsSpecification | undefined;
    getAllItemsBetween: (fromItem: IHistoryItem, toItem: IHistoryItem) => IHistoryItem[];
    isDeletedItemsHistory: boolean;
    deleteSelectedHistoryItems: () => void;
    viewType: "chat" | "thumbs";
    thumbnailSize: number;
    showInHistory?: () => void;
}> {
    render() {
        return this.props.historyItems.map(historyItem => {
            let element = historyItem.listItemElement;

            let showCheckbox = false;

            if (this.props.selectHistoryItemsSpecification) {
                if (this.props.selectHistoryItemsSpecification.historyItemType === "chart") {
                    if (historyItem instanceof Waveform) {
                        showCheckbox = true;
                    } else {
                        element = <div />;
                    }
                } else {
                    showCheckbox = true;
                }
            }

            let className = classNames(
                `EezStudio_HistoryItemEnclosure EezStudio_HistoryItem_${historyItem.id}`,
                {
                    EezStudio_HistoryItemEnclosure_Session: historyItem.type.startsWith(
                        "activity-log/session"
                    ),
                    selected: !this.props.selectHistoryItemsSpecification && historyItem.selected,
                    disablePreview: showCheckbox
                },
                this.props.viewType
            );

            let Enclosure = HistoryItemEnclosure;

            if (this.props.viewType === "thumbs") {
                Enclosure = getThumbnailEnclosure(this.props.thumbnailSize);
            }

            return (
                <Enclosure
                    key={historyItem.id}
                    className={className}
                    onMouseDown={event => {
                        if (event.target instanceof HTMLAnchorElement) {
                            // ignore <a>
                            return;
                        }

                        if (this.props.selectHistoryItemsSpecification) {
                            return;
                        }

                        // this is to prevent text selection with the SHIFT key
                        if (event.shiftKey) {
                            event.preventDefault();
                        }
                    }}
                    onClick={event => {
                        if (this.props.selectHistoryItemsSpecification) {
                            return;
                        }

                        if (event.target instanceof HTMLAnchorElement) {
                            // ignore <a>
                            return;
                        }

                        if ($(event.target).parents("#EezStudio_ModalContent").length) {
                            // ignore clicks on history items with preview in zoom mode
                            return;
                        }

                        let historyItems;
                        if (event.ctrlKey) {
                            if (historyItem.selected) {
                                historyItems = this.props.selection.items.slice();
                                historyItems.splice(historyItems.indexOf(historyItem), 1);
                            } else {
                                historyItems = this.props.selection.items.concat([historyItem]);
                            }
                        } else if (event.shiftKey) {
                            if (this.props.selection.items.length > 0) {
                                historyItems = this.props.getAllItemsBetween(
                                    this.props.selection.items[0],
                                    historyItem
                                );
                            } else {
                                historyItems = [historyItem];
                            }
                        } else {
                            historyItems = [historyItem];
                        }

                        this.props.selection.selectItems(historyItems);

                        event.preventDefault();
                    }}
                    onContextMenu={event => {
                        if (this.props.selectHistoryItemsSpecification) {
                            return;
                        }

                        if (!historyItem.selected) {
                            this.props.selection.selectItems([historyItem]);
                        }

                        const { Menu, MenuItem } = EEZStudio.remote;
                        const menu = new Menu();

                        if (this.props.isDeletedItemsHistory) {
                            menu.append(
                                new MenuItem({
                                    label: "Restore",
                                    click: () => {
                                        this.props.appStore.deletedItemsHistory.restoreSelectedHistoryItems();
                                    }
                                })
                            );
                            menu.append(
                                new MenuItem({
                                    label: "Purge",
                                    click: () => {
                                        this.props.appStore.deletedItemsHistory.deleteSelectedHistoryItems();
                                    }
                                })
                            );
                        } else {
                            if (this.props.showInHistory) {
                                menu.append(
                                    new MenuItem({
                                        label: "Show in History",
                                        click: this.props.showInHistory
                                    })
                                );
                            }

                            menu.append(
                                new MenuItem({
                                    label: "Delete",
                                    click: () => {
                                        this.props.deleteSelectedHistoryItems();
                                    }
                                })
                            );
                        }

                        menu.popup({});
                    }}
                    draggable={true}
                    onDragStart={event => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(CLIPBOARD_DATA_TYPE, historyItem.id);
                    }}
                    onDrag={() => false}
                >
                    {showCheckbox && (
                        <input
                            type="checkbox"
                            checked={this.props.appStore.isHistoryItemSelected(historyItem.id)}
                            onChange={event => {
                                this.props.appStore.selectHistoryItem(
                                    historyItem.id,
                                    event.target.checked
                                );
                            }}
                        />
                    )}
                    <ErrorBoundary id={historyItem.id}>{element}</ErrorBoundary>
                </Enclosure>
            );
        });
    }
}

class LoadMoreButton extends React.Component<{
    icon: string;
    loadMore: () => void;
}> {
    render() {
        const { icon, loadMore } = this.props;

        return (
            <button
                className="btn btn-secondary"
                onClick={loadMore}
                style={{ marginTop: 15, marginBottom: 15 }}
            >
                <Icon icon={icon} /> More
            </button>
        );
    }
}

///

const HistoryListComponentContainer = styled.div`
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;

interface HistoryListComponentProps {
    appStore: IAppStore;
    history: History;
}

@observer
export class HistoryListComponent extends React.Component<HistoryListComponentProps> {
    animationFrameRequestId: any;
    div: Element;

    fromBottom: number | undefined;
    fromTop: number | undefined = 0;

    autoReloadEnabled: boolean = true;
    timeOfLastAutoLoad: number;

    lastScrollHeight: number;
    lastClientHeight: number;

    findCenterItemTimeut: any;
    lastItemInTheCenterId: string | undefined;

    componentDidMount() {
        this.autoScroll();
        this.div.addEventListener("scroll", this.onScroll);

        this.lastItemInTheCenterId = undefined;
    }

    UNSAFE_(props: HistoryListComponentProps) {
        if (props.history !== this.props.history) {
            this.fromBottom = undefined;
            this.fromTop = 0;
        }
    }

    componentDidUpdate() {
        // // make sure scroll bar is recalculated after render
        // $(this.div).css("overflow", "hidden");
        // setTimeout(() => {
        //     $(this.div).css("overflow", "auto");
        // }, 1);

        this.lastItemInTheCenterId = undefined;
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);
        this.div.removeEventListener("scroll", this.onScroll);
    }

    moveToTop() {
        this.fromBottom = 0;
        this.fromTop = undefined;
    }

    moveToBottom() {
        this.fromBottom = undefined;
        this.fromTop = 0;
    }

    @action
    showHistoryItem(historyItem: IHistoryItem) {
        this.autoReloadEnabled = false;

        let c = 0;

        const scrollIntoView = (() => {
            const element = $(this.div).find(`.EezStudio_HistoryItem_${historyItem.id}`)[0];
            if (element) {
                element.scrollIntoView({ block: "center" });
            }
            if (++c < 5) {
                setTimeout(scrollIntoView, 10);
            } else {
                this.autoReloadEnabled = true;
            }
        }).bind(this);

        scrollIntoView();
    }

    @bind
    autoScroll() {
        if ($(this.div).is(":visible")) {
            if (this.fromBottom !== undefined) {
                if (this.fromBottom != this.div.scrollTop) {
                    this.div.scrollTop = this.fromBottom;
                }
            } else if (this.fromTop !== undefined) {
                let scrollTop = this.div.scrollHeight - this.div.clientHeight - this.fromTop;
                if (scrollTop != this.div.scrollTop) {
                    this.div.scrollTop = scrollTop;
                }
            }
        }

        // automatically load more content
        const time = Date.now();
        if (
            this.autoReloadEnabled &&
            this.div.clientHeight > 0 &&
            this.div.scrollHeight >= this.div.clientHeight &&
            (this.timeOfLastAutoLoad === undefined ||
                time - this.timeOfLastAutoLoad > CONF_AUTO_RELOAD_TIMEOUT)
        ) {
            this.timeOfLastAutoLoad = Date.now();

            if (
                this.props.history.navigator.hasOlder &&
                this.div.scrollTop < CONF_AUTO_RELOAD_Y_THRESHOLD
            ) {
                this.loadOlder();
            }
            if (
                this.props.history.navigator.hasNewer &&
                this.div.scrollHeight - (this.div.scrollTop + this.div.clientHeight) <
                    CONF_AUTO_RELOAD_Y_THRESHOLD
            ) {
                this.loadNewer();
            }
        }

        this.animationFrameRequestId = window.requestAnimationFrame(this.autoScroll);
    }

    @bind
    onScroll(event: any) {
        if (
            this.div.scrollHeight === this.lastScrollHeight &&
            this.div.clientHeight === this.lastClientHeight
        ) {
            if (this.fromBottom !== undefined) {
                this.fromBottom = this.div.scrollTop;
            } else if (this.fromTop !== undefined) {
                this.fromTop = this.div.scrollHeight - this.div.clientHeight - this.div.scrollTop;
            }
        }

        this.lastScrollHeight = this.div.scrollHeight;
        this.lastClientHeight = this.div.clientHeight;

        // find item in the center of the view
        if (this.findCenterItemTimeut) {
            clearTimeout(this.findCenterItemTimeut);
        }
        this.findCenterItemTimeut = setTimeout(() => {
            this.findCenterItemTimeut = undefined;
            const itemElements = $(this.div).find(".EezStudio_HistoryItemEnclosure");
            if (itemElements.length > 0) {
                let foundItemElement = itemElements[0];
                const rect = foundItemElement.getBoundingClientRect();
                let minDistance = Math.abs(this.div.clientHeight - (rect.top + rect.height / 2));

                for (let i = 1; i < itemElements.length; ++i) {
                    const rect = itemElements[i].getBoundingClientRect();
                    const distance = Math.abs(
                        this.div.clientHeight / 2 - (rect.top + rect.height / 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        foundItemElement = itemElements[i];
                    }
                }

                const matches = foundItemElement.className.match(/EezStudio_HistoryItem_(\d*)/);
                if (matches && matches.length >= 1) {
                    const itemId = matches[1];
                    if (itemId !== this.lastItemInTheCenterId) {
                        // found it
                        this.props.history.setItemInTheCenterOfTheView(itemId);
                    }
                }
            }
        }, 100);
    }

    @bind
    async loadOlder() {
        this.autoReloadEnabled = false;

        this.fromBottom = undefined;
        this.fromTop = undefined;

        // when we load older items, we don't want scroll position to change

        // find first item above scrollTop
        let firstItem: HTMLDivElement | undefined;

        const items = this.div.children[0].children;
        for (let i = 0; i < items.length; ++i) {
            const item = items[i] as HTMLDivElement;
            if (
                item.className.indexOf("EezStudio_HistoryItemEnclosure") !== -1 &&
                item.offsetTop > this.div.scrollTop
            ) {
                firstItem = item;
                break;
            }
        }

        if (firstItem) {
            // remember offset of the firstItem from scrollTop
            let offset = firstItem.offsetTop - this.div.scrollTop;

            await this.props.history.navigator.loadOlder();

            window.requestAnimationFrame(() => {
                // make sure firstItem is again at the same offset
                this.div.scrollTop = firstItem!.offsetTop - offset;

                this.autoReloadEnabled = true;
            });
        } else {
            await this.props.history.navigator.loadOlder();
        }
    }

    @bind
    loadNewer() {
        this.fromBottom = undefined;
        this.fromTop = undefined;

        this.props.history.navigator.loadNewer();
    }

    render() {
        return (
            <HistoryListComponentContainer
                ref={(ref: any) => {
                    let div = findDOMNode(ref);
                    if (div && div.parentElement) {
                        this.div = div.parentElement;
                    }
                }}
                onClick={event => {
                    if ($(event.target).closest(".EezStudio_HistoryItemEnclosure").length === 0) {
                        this.props.history.selection.selectItems([]);
                    }
                }}
            >
                {this.props.history.navigator.hasOlder && (
                    <LoadMoreButton icon="material:expand_less" loadMore={this.loadOlder} />
                )}
                <HistoryItems
                    appStore={this.props.appStore}
                    historyItems={this.props.history.items}
                    selection={this.props.history.selection}
                    selectHistoryItemsSpecification={
                        this.props.appStore.selectHistoryItemsSpecification
                    }
                    getAllItemsBetween={(fromItem: IHistoryItem, toItem: IHistoryItem) =>
                        this.props.history.getAllItemsBetween(fromItem, toItem)
                    }
                    isDeletedItemsHistory={
                        this.props.history === this.props.appStore.deletedItemsHistory
                    }
                    deleteSelectedHistoryItems={() =>
                        this.props.history.deleteSelectedHistoryItems()
                    }
                    viewType="chat"
                    thumbnailSize={480}
                />
                {this.props.history.navigator.hasNewer && (
                    <LoadMoreButton icon="material:expand_more" loadMore={this.loadNewer} />
                )}
            </HistoryListComponentContainer>
        );
    }
}
