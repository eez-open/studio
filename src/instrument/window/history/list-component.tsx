import * as React from "react";
import { findDOMNode } from "react-dom";
import { action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { Icon } from "shared/ui/icon";

import { AppStore } from "instrument/window/app-store";

import { Waveform } from "instrument/window/waveform/generic";

import { History } from "instrument/window/history/history";
import { IHistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryItems extends React.Component<{
    appStore: AppStore;
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
                `EezStudio_HistoryItemEnclosure`,
                `EezStudio_HistoryItem_${historyItem.id}`,
                {
                    selected:
                        !this.props.appStore.selectHistoryItemsSpecification && historyItem.selected
                }
            );

            return (
                <div
                    key={historyItem.id}
                    className={className}
                    onClick={event => {
                        let historyItems = [historyItem];
                        if (event.ctrlKey || event.shiftKey) {
                            historyItems = historyItems.concat(
                                ...this.props.history.selection.items
                            );
                        }
                        this.props.history.selection.selectItems(historyItems);
                    }}
                    onContextMenu={event => {
                        let historyItems = [historyItem];
                        if (event.ctrlKey || event.shiftKey) {
                            historyItems = historyItems.concat(
                                ...this.props.history.selection.items
                            );
                        }
                        this.props.history.selection.selectItems(historyItems);

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
                    {element}
                </div>
            );
        });
    }
}

@observer
export class HistoryListComponent extends React.Component<{
    appStore: AppStore;
    history: History;
}> {
    animationFrameRequestId: any;
    div: Element;
    fromBottom: number | undefined;
    fromTop: number | undefined;

    componentDidMount() {
        this.autoScroll();
        this.div.addEventListener("scroll", this.onScroll);
    }

    componentDidUpdate() {
        // make sure scroll bar is recalculated after render
        $(this.div).css("overflow", "hidden");
        setTimeout(() => {
            $(this.div).css("overflow", "auto");
        }, 1);
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
        setTimeout(() => {
            const element = $(this.div).find(`.EezStudio_HistoryItem_${historyItem.id}`)[0];
            if (element) {
                element.scrollIntoView({ block: "center" });
                setTimeout(() => {
                    element.scrollIntoView({ block: "center" });
                }, 0);
            } else {
                console.warn("History item not found", historyItem);
            }
        }, 0);
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

        this.animationFrameRequestId = window.requestAnimationFrame(this.autoScroll);
    }

    lastScrollHeight: number;
    lastClientHeight: number;

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
    }

    render() {
        return (
            <div
                ref={(ref: any) => {
                    let div = findDOMNode(ref);
                    if (div && div.parentElement) {
                        this.div = div.parentElement;
                    }
                }}
                className={"EezStudio_History"}
                onClick={event => {
                    if ($(event.target).closest(".EezStudio_HistoryItemEnclosure").length === 0) {
                        this.props.history.selection.selectItems([]);
                    }
                }}
            >
                {this.props.history.navigator.hasOlder && (
                    <button
                        className="btn btn-secondary"
                        style={{ marginBottom: 20 }}
                        onClick={() => {
                            this.fromBottom = undefined;
                            this.fromTop = undefined;

                            const scrollHeight = this.div.scrollHeight;

                            this.props.history.navigator.loadOlder();

                            window.requestAnimationFrame(() => {
                                this.div.scrollTop = this.div.scrollHeight - scrollHeight;
                            });
                        }}
                    >
                        <Icon icon="material:expand_less" /> More
                    </button>
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
                    <button
                        className="btn btn-secondary"
                        onClick={this.props.history.navigator.loadNewer}
                        style={{ marginTop: 15 }}
                    >
                        <Icon icon="material:expand_more" /> More
                    </button>
                )}
            </div>
        );
    }
}
