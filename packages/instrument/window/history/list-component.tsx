import React from "react";
import ReactDOM from "react-dom";
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

import { History, IAppStore } from "instrument/window/history/history";
import { IHistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const CONF_AUTO_RELOAD_TIMEOUT = 1000 / 30;
const CONF_AUTO_RELOAD_Y_THRESHOLD = 20;

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
`;

const HistoryItemRenderError = styled.div`
    background-color: ${props => addAlphaToColor(props.theme.errorColor, 0.3)};
    border-radius: 8px;
    padding: 10px;
`;

class ErrorBoundary extends React.Component<
    {},
    {
        hasError: boolean;
    }
> {
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
                <HistoryItemRenderError>Error while rendering history item!</HistoryItemRenderError>
            );
        }

        return this.props.children;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryItems extends React.Component<{
    appStore: IAppStore;
    history: History;
    historyItems: IHistoryItem[];
}> {
    render() {
        return this.props.historyItems.map(historyItem => {
            let element = historyItem.listItemElement;

            let showCheckbox = false;

            if (this.props.appStore.selectHistoryItemsSpecification) {
                if (
                    this.props.appStore.selectHistoryItemsSpecification.historyItemType === "chart"
                ) {
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
                    selected:
                        !this.props.appStore.selectHistoryItemsSpecification &&
                        historyItem.selected,
                    disablePreview: showCheckbox
                }
            );

            return (
                <HistoryItemEnclosure
                    key={historyItem.id}
                    className={className}
                    onMouseDown={event => {
                        if (this.props.appStore.selectHistoryItemsSpecification) {
                            return;
                        }

                        // this is to prevent text selection with the SHIFT key
                        if (event.shiftKey) {
                            event.preventDefault();
                        }
                    }}
                    onClick={event => {
                        if (this.props.appStore.selectHistoryItemsSpecification) {
                            return;
                        }

                        if ($(event.target).parents("#EezStudio_ModalContent").length) {
                            // ignore clicks on history items with preview in zoom mode
                            return;
                        }

                        let historyItems;
                        if (event.ctrlKey) {
                            if (historyItem.selected) {
                                historyItems = this.props.history.selection.items.slice();
                                historyItems.splice(historyItems.indexOf(historyItem), 1);
                            } else {
                                historyItems = this.props.history.selection.items.concat([
                                    historyItem
                                ]);
                            }
                        } else if (event.shiftKey) {
                            if (this.props.history.selection.items.length > 0) {
                                historyItems = this.props.history.getAllItemsBetween(
                                    this.props.history.selection.items[0],
                                    historyItem
                                );
                            } else {
                                historyItems = [historyItem];
                            }
                        } else {
                            historyItems = [historyItem];
                        }

                        this.props.history.selection.selectItems(historyItems);

                        event.preventDefault();
                    }}
                    onContextMenu={event => {
                        if (this.props.appStore.selectHistoryItemsSpecification) {
                            return;
                        }

                        if (!historyItem.selected) {
                            this.props.history.selection.selectItems([historyItem]);
                        }

                        const { Menu, MenuItem } = EEZStudio.electron.remote;
                        const menu = new Menu();

                        if (this.props.history === this.props.appStore.deletedItemsHistory) {
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
                            menu.append(
                                new MenuItem({
                                    label: "Delete",
                                    click: () => {
                                        this.props.history.deleteSelectedHistoryItems();
                                    }
                                })
                            );
                        }

                        menu.popup({});
                    }}
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
                    <ErrorBoundary>{element}</ErrorBoundary>
                </HistoryItemEnclosure>
            );
        });
    }
}

class LoadMoreButton extends React.Component<{
    icon: string;
    loadMore: () => void;
    isVisible?: boolean;
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

    componentDidMount() {
        this.autoScroll();
        this.div.addEventListener("scroll", this.onScroll);
        document.addEventListener("keydown", this.onKeyDown);

        this.lastItemInTheCenterId = undefined;
    }

    componentWillReceiveProps(props: HistoryListComponentProps) {
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
        document.removeEventListener("keydown", this.onKeyDown);
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

    lastScrollHeight: number;
    lastClientHeight: number;

    findCenterItemTimeut: any;
    lastItemInTheCenterId: string | undefined;

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

    selectAll() {
        const allItems = this.props.history.blocks.reduce(
            (previousValue: IHistoryItem[], currentValue: IHistoryItem[]) =>
                currentValue.concat(previousValue),
            []
        );
        this.props.history.selection.selectItems(allItems);
    }

    @bind
    onKeyDown(event: KeyboardEvent) {
        if (event.target && $(event.target).parents(".modal").length > 0) {
            // ignore if target is modal dialog
            return;
        }

        if (event.ctrlKey && event.keyCode == 65) {
            // Ctrl+A
            if (event.target instanceof HTMLInputElement) {
                return;
            }

            const historyDomNode = ReactDOM.findDOMNode(this);
            if (historyDomNode && $(historyDomNode).is(":visible")) {
                event.preventDefault();
                this.selectAll();
            }
        }
    }

    @bind
    async loadOlder() {
        this.autoReloadEnabled = false;

        this.fromBottom = undefined;
        this.fromTop = undefined;

        const scrollHeight = this.div.scrollHeight;

        await this.props.history.navigator.loadOlder();

        window.requestAnimationFrame(() => {
            this.div.scrollTop = this.div.scrollHeight - scrollHeight;

            this.autoReloadEnabled = true;
        });
    }

    @bind
    loadNewer() {
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
                {this.props.history.blocks.map(historyItems => {
                    if (historyItems.length === 0) {
                        return null;
                    }
                    return (
                        <HistoryItems
                            appStore={this.props.appStore}
                            key={historyItems[0].id}
                            history={this.props.history}
                            historyItems={historyItems}
                        />
                    );
                })}
                {this.props.history.navigator.hasNewer && (
                    <LoadMoreButton icon="material:expand_more" loadMore={this.loadNewer} />
                )}
            </HistoryListComponentContainer>
        );
    }
}
