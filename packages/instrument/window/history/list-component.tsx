import { Menu, MenuItem } from "@electron/remote";
import { clipboard } from "electron";
import React from "react";
import { IObservableValue, action, makeObservable, runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

import type {
    History,
    IAppStore,
    SelectHistoryItemsSpecification
} from "instrument/window/history/history";
import type { IHistoryItem } from "instrument/window/history/item";
import { historySessions, SESSION_FREE_ID } from "./session/store";
import { VisibleAnimationFrameLoop } from "eez-studio-shared/dom";
import { t } from "eez-studio-shared/i18n";

////////////////////////////////////////////////////////////////////////////////

const CONF_AUTO_RELOAD_TIMEOUT = 1000 / 30;
const CONF_AUTO_RELOAD_Y_THRESHOLD = 20;

// mouse has to move this many pixels before rubber band selection starts,
// so a simple click on the empty space still deselects all items
const CONF_RUBBER_BAND_DRAG_THRESHOLD = 4;
// when mouse is this close to the top or bottom edge, the list is scrolled
const CONF_RUBBER_BAND_SCROLL_EDGE = 40;
// max. scroll speed in pixels per frame, reached when mouse is
// CONF_RUBBER_BAND_SCROLL_EDGE pixels outside of the list
const CONF_RUBBER_BAND_MAX_SCROLL_SPEED = 30;

export const CLIPBOARD_DATA_TYPE = "application/eez-studio-history-item";

////////////////////////////////////////////////////////////////////////////////

export class ErrorBoundary extends React.Component<
    { children?: React.ReactNode; id: string },
    { hasError: boolean }
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
                <div className="EezStudio_HistoryItemRenderError">
                    Error while rendering history item {this.props.id}!
                </div>
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

////////////////////////////////////////////////////////////////////////////////

const CLIPBOARD_COMMAND_PROMPT = "> ";
const CLIPBOARD_INDENT = "  "; // same width as the prompt

function indentLines(text: string, firstLinePrefix: string) {
    return text
        .split("\n")
        .map((line, i) =>
            i == 0
                ? firstLinePrefix + line
                : line.length > 0
                ? CLIPBOARD_INDENT + line
                : line
        )
        .join("\n");
}

// Commands are prefixed with a shell like prompt and answers are indented
// to line up with the command text.
function formatClipboardText(historyItem: IHistoryItem, text: string) {
    if (historyItem.type == "instrument/request") {
        return indentLines(text, CLIPBOARD_COMMAND_PROMPT);
    }
    if (historyItem.type == "instrument/answer") {
        return indentLines(text, CLIPBOARD_INDENT);
    }
    return text;
}

// Single selected image is copied as image, otherwise the text of all
// selected items (in chronological order) is copied, one item per line.
// Single item is copied as is, without prompt or indentation.
function copyHistoryItemsToClipboard(historyItems: IHistoryItem[]) {
    if (historyItems.length == 1) {
        const image = historyItems[0].getClipboardImage();
        if (image) {
            clipboard.writeImage(image);
            return;
        }
    }

    const texts: string[] = [];

    historyItems
        .slice()
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .forEach(historyItem => {
            try {
                const text = historyItem.getClipboardText();
                if (text != undefined) {
                    texts.push(
                        historyItems.length > 1
                            ? formatClipboardText(historyItem, text)
                            : text
                    );
                }
            } catch (err) {
                console.error(err);
            }
        });

    if (texts.length > 0) {
        clipboard.writeText(texts.join("\n"));
    }
}

export const HistoryItems = observer(
    class HistoryItems extends React.Component<{
        appStore: IAppStore;
        historyItems: IHistoryItem[];
        selection: ISelection;
        selectHistoryItemsSpecification:
            | SelectHistoryItemsSpecification
            | undefined;
        getAllItemsBetween: (
            fromItem: IHistoryItem,
            toItem: IHistoryItem
        ) => IHistoryItem[];
        isDeletedItemsHistory: boolean;
        deleteSelectedHistoryItems: () => void;
        viewType: "chat" | "thumbs";
        thumbnailSize: number;
        showInHistory?: () => void;
    }> {
        render() {
            return this.props.historyItems.map(historyItem => {
                let element = historyItem.getListItemElement(
                    this.props.appStore,
                    this.props.viewType
                );

                let showCheckbox = false;

                if (this.props.selectHistoryItemsSpecification) {
                    if (
                        this.props.selectHistoryItemsSpecification
                            .historyItemType === "chart"
                    ) {
                        if (historyItem.canBePartOfMultiChart) {
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
                        selected:
                            !this.props.selectHistoryItemsSpecification &&
                            historyItem.selected,
                        disablePreview: showCheckbox
                    },
                    this.props.viewType
                );

                let style;
                if (this.props.viewType === "thumbs") {
                    style = {
                        "--historyItemThumbnailSize":
                            this.props.thumbnailSize + "px"
                    } as React.CSSProperties;
                }

                return (
                    <div
                        key={historyItem.id}
                        className={className}
                        style={style}
                        data-history-item-id={historyItem.id}
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

                            if (
                                $(event.target).parents(
                                    "#EezStudio_ModalContent"
                                ).length
                            ) {
                                // ignore clicks on history items with preview in zoom mode
                                return;
                            }

                            let historyItems;
                            if (event.ctrlKey) {
                                if (historyItem.selected) {
                                    historyItems =
                                        this.props.selection.items.slice();
                                    historyItems.splice(
                                        historyItems.indexOf(historyItem),
                                        1
                                    );
                                } else {
                                    historyItems =
                                        this.props.selection.items.concat([
                                            historyItem
                                        ]);
                                }
                            } else if (event.shiftKey) {
                                if (this.props.selection.items.length > 0) {
                                    historyItems =
                                        this.props.getAllItemsBetween(
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
                            event.preventDefault();
                            event.stopPropagation();

                            if (this.props.selectHistoryItemsSpecification) {
                                return;
                            }

                            if (!historyItem.selected) {
                                this.props.selection.selectItems([historyItem]);
                            }

                            const menu = new Menu();

                            if (this.props.isDeletedItemsHistory) {
                                menu.append(
                                    new MenuItem({
                                        label: t("Restore"),
                                        click: () => {
                                            this.props.appStore.deletedItemsHistory.restoreSelectedHistoryItems();
                                        }
                                    })
                                );
                                menu.append(
                                    new MenuItem({
                                        label: t("Purge"),
                                        click: () => {
                                            this.props.appStore.deletedItemsHistory.deleteSelectedHistoryItems();
                                        }
                                    })
                                );
                            } else {
                                console.log(
                                    historyItem.sid,
                                    historySessions.selectedSession.id
                                );

                                if (
                                    (this.props.showInHistory &&
                                        historyItem.sid ==
                                            historySessions.selectedSession
                                                .id) ||
                                    (historyItem.sid == null &&
                                        historySessions.selectedSession.id ==
                                            SESSION_FREE_ID)
                                ) {
                                    menu.append(
                                        new MenuItem({
                                            label: t("Show in History"),
                                            click: this.props.showInHistory
                                        })
                                    );
                                }

                                menu.append(
                                    new MenuItem({
                                        label: t("Delete"),
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
                            console.log(event);
                            if (
                                event.target instanceof HTMLVideoElement ||
                                event.target instanceof HTMLAudioElement
                            ) {
                                return;
                            }

                            event.stopPropagation();
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData(
                                CLIPBOARD_DATA_TYPE,
                                historyItem.id
                            );
                        }}
                        onDrag={() => false}
                    >
                        {showCheckbox && (
                            <input
                                type="checkbox"
                                checked={this.props.appStore.isHistoryItemSelected(
                                    historyItem.id
                                )}
                                onChange={event => {
                                    this.props.appStore.selectHistoryItem(
                                        historyItem.id,
                                        event.target.checked
                                    );
                                }}
                            />
                        )}
                        <ErrorBoundary id={historyItem.id}>
                            {element}
                        </ErrorBoundary>
                    </div>
                );
            });
        }
    }
);

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

////////////////////////////////////////////////////////////////////////////////

interface IRubberBand {
    // Start point in the scroll content coordinates. Vertical coordinate is
    // relative to the anchor item, so it stays in place when items are
    // loaded (or removed) above it while scrolling.
    startX: number;
    startY: number;
    anchorItemId: string | undefined;
    anchorOffsetY: number;

    // last known mouse position in the client coordinates
    clientX: number;
    clientY: number;

    // true when mouse moved far enough from the start point
    active: boolean;

    // with Ctrl or Shift key, items are added to the existing selection
    additive: boolean;
    initialSelection: IHistoryItem[];

    element: HTMLDivElement | undefined;
    animationFrameId: number | undefined;
}

function isSameSelection(a: IHistoryItem[], b: IHistoryItem[]) {
    return a.length == b.length && a.every((item, i) => item === b[i]);
}

export class HistoryListComponentClass extends React.Component<{
    appStore: IAppStore;
    history: History;
    jumpToPresentCondition: IObservableValue<boolean>;
}> {
    autoScrollLoop = new VisibleAnimationFrameLoop(
        () => this.div,
        () => this.autoScroll()
    );

    fromBottom: number | undefined;
    fromTop: number | undefined = 0;

    autoReloadEnabled: boolean = true;
    timeOfLastAutoLoad: number;

    lastScrollHeight: number;
    lastClientHeight: number;

    findCenterItemTimeut: any;
    lastItemInTheCenterId: string | undefined;

    ref = React.createRef<HTMLDivElement>();

    get div() {
        return this.ref.current!.parentElement as Element;
    }

    constructor(props: any) {
        super(props);

        makeObservable(this, {
            showHistoryItem: action
        });
    }

    componentDidMount() {
        this.autoScrollLoop.start();
        this.div.addEventListener("scroll", this.onScroll);
        this.div.addEventListener("mousedown", this.onRubberBandMouseDown);
        document.addEventListener("copy", this.onCopy);

        this.lastItemInTheCenterId = undefined;
    }

    componentDidUpdate(prevProps: any) {
        if (this.props.history != prevProps.history) {
            this.fromBottom = undefined;
            this.fromTop = 0;
        }

        // // make sure scroll bar is recalculated after render
        // $(this.div).css("overflow", "hidden");
        // setTimeout(() => {
        //     $(this.div).css("overflow", "auto");
        // }, 1);

        this.lastItemInTheCenterId = undefined;
    }

    componentWillUnmount() {
        this.autoScrollLoop.stop();
        this.div.removeEventListener("scroll", this.onScroll);
        this.div.removeEventListener("mousedown", this.onRubberBandMouseDown);
        document.removeEventListener("copy", this.onCopy);
        this.endRubberBand();
    }

    ////////////////////////////////////////////////////////////////////////////
    // Rubber band selection: drag the mouse over the empty space of the list
    // to select all the items intersecting the rectangle. While dragging, the
    // list scrolls when the mouse is near (or beyond) its top or bottom edge.

    rubberBand: IRubberBand | undefined;

    onRubberBandMouseDown = (event: MouseEvent) => {
        if (
            event.button != 0 ||
            this.rubberBand ||
            this.props.appStore.selectHistoryItemsSpecification
        ) {
            return;
        }

        // start only on the empty space, mouse down on the item is used for
        // drag & drop and text selection
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const excluded = target.closest(
            ".EezStudio_HistoryItemEnclosure, button, a, input, textarea, select, [contenteditable]"
        );
        if (excluded && this.div.contains(excluded)) {
            return;
        }

        // ignore scrollbars
        const { left, top } = this.getViewportOrigin();
        if (
            event.clientX >= left + this.div.clientWidth ||
            event.clientY >= top + this.div.clientHeight
        ) {
            return;
        }

        // prevent text selection while dragging ...
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        // ... but still focus the list as before (for keyboard shortcuts)
        const focusable = this.div.closest("[tabindex]");
        if (focusable instanceof HTMLElement) {
            focusable.focus({ preventScroll: true });
        }

        const startY = event.clientY - top + this.div.scrollTop;
        const anchor = this.findAnchorItem(startY);

        this.rubberBand = {
            startX: event.clientX - left + this.div.scrollLeft,
            startY,
            anchorItemId: anchor?.id,
            anchorOffsetY: anchor ? startY - anchor.top : 0,
            clientX: event.clientX,
            clientY: event.clientY,
            active: false,
            additive: event.ctrlKey || event.shiftKey || event.metaKey,
            initialSelection: this.props.history.selection.items.slice(),
            element: undefined,
            animationFrameId: undefined
        };

        window.addEventListener("mousemove", this.onRubberBandMouseMove);
        window.addEventListener("mouseup", this.onRubberBandMouseUp);
        window.addEventListener("keydown", this.onRubberBandKeyDown, true);
        window.addEventListener("blur", this.onRubberBandWindowBlur);
    };

    onRubberBandMouseMove = (event: MouseEvent) => {
        const rubberBand = this.rubberBand;
        if (!rubberBand) {
            return;
        }

        rubberBand.clientX = event.clientX;
        rubberBand.clientY = event.clientY;

        if (!rubberBand.active) {
            const { left, top } = this.getViewportOrigin();
            const dx =
                event.clientX - left + this.div.scrollLeft - rubberBand.startX;
            const dy =
                event.clientY - top + this.div.scrollTop - rubberBand.startY;
            if (
                Math.abs(dx) < CONF_RUBBER_BAND_DRAG_THRESHOLD &&
                Math.abs(dy) < CONF_RUBBER_BAND_DRAG_THRESHOLD
            ) {
                return;
            }

            rubberBand.active = true;

            rubberBand.element = document.createElement("div");
            rubberBand.element.className = "EezStudio_HistoryRubberBand";
            document.body.appendChild(rubberBand.element);

            rubberBand.animationFrameId = requestAnimationFrame(
                this.rubberBandFrame
            );
        }

        this.updateRubberBand();
    };

    onRubberBandMouseUp = (event: MouseEvent) => {
        if (event.button != 0) {
            return;
        }
        if (this.rubberBand?.active) {
            this.suppressNextClick();
        }
        this.endRubberBand();
    };

    onRubberBandKeyDown = (event: KeyboardEvent) => {
        if (event.key == "Escape" && this.rubberBand) {
            event.preventDefault();
            event.stopPropagation();
            // cancel, i.e. restore selection from before the rubber band
            if (this.rubberBand.active) {
                this.props.history.selection.selectItems(
                    this.rubberBand.initialSelection
                );
                this.suppressNextClick();
            }
            this.endRubberBand();
        }
    };

    onRubberBandWindowBlur = () => {
        this.endRubberBand();
    };

    endRubberBand() {
        const rubberBand = this.rubberBand;
        if (!rubberBand) {
            return;
        }
        this.rubberBand = undefined;

        if (rubberBand.animationFrameId != undefined) {
            cancelAnimationFrame(rubberBand.animationFrameId);
        }
        rubberBand.element?.remove();

        window.removeEventListener("mousemove", this.onRubberBandMouseMove);
        window.removeEventListener("mouseup", this.onRubberBandMouseUp);
        window.removeEventListener("keydown", this.onRubberBandKeyDown, true);
        window.removeEventListener("blur", this.onRubberBandWindowBlur);
    }

    // Click that follows the mouse up after rubber band selection would
    // otherwise deselect all items (click on the empty space).
    suppressNextClick() {
        const suppress = (event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
        };
        window.addEventListener("click", suppress, true);
        setTimeout(() => window.removeEventListener("click", suppress, true));
    }

    // auto scroll when mouse is near the top or bottom edge
    rubberBandFrame = () => {
        const rubberBand = this.rubberBand;
        if (!rubberBand) {
            return;
        }

        const { top } = this.getViewportOrigin();
        const height = this.div.clientHeight;
        const edge = Math.min(CONF_RUBBER_BAND_SCROLL_EDGE, height / 4);

        let distance = 0;
        if (rubberBand.clientY < top + edge) {
            distance = rubberBand.clientY - (top + edge);
        } else if (rubberBand.clientY > top + height - edge) {
            distance = rubberBand.clientY - (top + height - edge);
        }

        if (distance != 0 && edge > 0) {
            const speed = Math.max(
                1,
                Math.round(
                    (Math.min(Math.abs(distance), 2 * edge) / (2 * edge)) *
                        CONF_RUBBER_BAND_MAX_SCROLL_SPEED
                )
            );

            const scrollTop = this.div.scrollTop;
            this.div.scrollTop = scrollTop + Math.sign(distance) * speed;
            if (this.div.scrollTop != scrollTop) {
                // update fromTop/fromBottom right away, otherwise autoScroll
                // could restore the old scroll position before scroll event
                this.onScroll(undefined);
            }
        }

        // also handles scrolling with the mouse wheel and loading of more items
        this.updateRubberBand();

        rubberBand.animationFrameId = requestAnimationFrame(
            this.rubberBandFrame
        );
    };

    updateRubberBand() {
        const rubberBand = this.rubberBand;
        if (!rubberBand || !rubberBand.active || !rubberBand.element) {
            return;
        }

        const div = this.div;
        const { left, top } = this.getViewportOrigin();
        const width = div.clientWidth;
        const height = div.clientHeight;

        if (rubberBand.anchorItemId != undefined) {
            const anchorElement = this.getItemElement(rubberBand.anchorItemId);
            if (anchorElement) {
                rubberBand.startY =
                    anchorElement.getBoundingClientRect().top -
                    top +
                    div.scrollTop +
                    rubberBand.anchorOffsetY;
            }
        }

        // current point is clamped to the visible part of the list
        const clamp = (value: number, max: number) =>
            Math.max(0, Math.min(value, max));
        const endX = clamp(rubberBand.clientX - left, width) + div.scrollLeft;
        const endY = clamp(rubberBand.clientY - top, height) + div.scrollTop;

        // rubber band rectangle in the scroll content coordinates
        const x1 = Math.min(rubberBand.startX, endX);
        const x2 = Math.max(rubberBand.startX, endX);
        const y1 = Math.min(rubberBand.startY, endY);
        const y2 = Math.max(rubberBand.startY, endY);

        // draw it clipped to the visible part of the list
        const visibleLeft = clamp(x1 - div.scrollLeft, width);
        const visibleRight = clamp(x2 - div.scrollLeft, width);
        const visibleTop = clamp(y1 - div.scrollTop, height);
        const visibleBottom = clamp(y2 - div.scrollTop, height);
        const style = rubberBand.element.style;
        style.left = left + visibleLeft + "px";
        style.top = top + visibleTop + "px";
        style.width = visibleRight - visibleLeft + "px";
        style.height = visibleBottom - visibleTop + "px";

        // find all the items intersecting the rubber band
        const intersectingItemIds = new Set<string>();
        this.ref.current
            ?.querySelectorAll<HTMLElement>("[data-history-item-id]")
            .forEach(element => {
                const rect = element.getBoundingClientRect();
                const itemX1 = rect.left - left + div.scrollLeft;
                const itemY1 = rect.top - top + div.scrollTop;
                const itemX2 = itemX1 + rect.width;
                const itemY2 = itemY1 + rect.height;
                if (
                    itemX1 <= x2 &&
                    itemX2 >= x1 &&
                    itemY1 <= y2 &&
                    itemY2 >= y1
                ) {
                    intersectingItemIds.add(element.dataset.historyItemId!);
                }
            });

        let historyItems = this.props.history.items.filter(historyItem =>
            intersectingItemIds.has(historyItem.id)
        );
        if (rubberBand.additive) {
            historyItems = rubberBand.initialSelection.concat(
                historyItems.filter(
                    historyItem =>
                        rubberBand.initialSelection.indexOf(historyItem) == -1
                )
            );
        }

        if (
            !isSameSelection(historyItems, this.props.history.selection.items)
        ) {
            this.props.history.selection.selectItems(historyItems);
        }
    }

    // top left corner of the list viewport (inside borders) in the client
    // coordinates
    getViewportOrigin() {
        const rect = this.div.getBoundingClientRect();
        return {
            left: rect.left + this.div.clientLeft,
            top: rect.top + this.div.clientTop
        };
    }

    getItemElement(id: string) {
        return this.ref.current?.querySelector<HTMLElement>(
            `[data-history-item-id="${id}"]`
        );
    }

    // first item below given point (in the scroll content coordinates),
    // or the last item if there is no such item
    findAnchorItem(y: number) {
        const { top } = this.getViewportOrigin();
        const elements =
            this.ref.current?.querySelectorAll<HTMLElement>(
                "[data-history-item-id]"
            ) ?? [];
        let anchor: { id: string; top: number } | undefined;
        for (const element of Array.from(elements)) {
            const rect = element.getBoundingClientRect();
            anchor = {
                id: element.dataset.historyItemId!,
                top: rect.top - top + this.div.scrollTop
            };
            if (rect.bottom - top + this.div.scrollTop >= y) {
                break;
            }
        }
        return anchor;
    }

    // Ctrl/Cmd+C (or Edit > Copy) fires "copy" event on the focused element,
    // or, if nothing is focused, on the element containing the caret
    onCopy = (event: ClipboardEvent) => {
        if (event.defaultPrevented) {
            return;
        }

        // text selected with the mouse is copied as usual
        const domSelection = window.getSelection();
        if (domSelection && !domSelection.isCollapsed) {
            return;
        }

        const target = event.target;
        if (
            !(target instanceof Node) ||
            !this.div.contains(target) ||
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            (target instanceof HTMLElement && target.isContentEditable)
        ) {
            return;
        }

        // no need for event.preventDefault(): with no text selected
        // the browser's default copy doesn't touch the clipboard
        copyHistoryItemsToClipboard(this.props.history.selection.items);
    };

    moveToTop() {
        this.fromBottom = 0;
        this.fromTop = undefined;
    }

    moveToBottom() {
        this.fromBottom = undefined;
        this.fromTop = 0;
    }

    showHistoryItem(historyItem: IHistoryItem) {
        this.autoReloadEnabled = false;

        let c = 0;

        const scrollIntoView = () => {
            const element = $(this.div).find(
                `.EezStudio_HistoryItem_${historyItem.id}`
            )[0];
            if (element) {
                element.scrollIntoView({ block: "nearest" });
            }
            if (++c < 5) {
                setTimeout(scrollIntoView, 10);
            } else {
                this.autoReloadEnabled = true;
            }
        };

        scrollIntoView();
    }

    // runs only while visible, see autoScrollLoop
    autoScroll = () => {
        if (this.fromBottom !== undefined) {
            if (this.fromBottom != this.div.scrollTop) {
                this.div.scrollTop = this.fromBottom;
            }
        } else if (this.fromTop !== undefined) {
            let scrollTop =
                this.div.scrollHeight - this.div.clientHeight - this.fromTop;
            if (scrollTop != this.div.scrollTop) {
                this.div.scrollTop = scrollTop;
            }
        }

        const jumpToPresentCondition =
            this.div.scrollHeight -
                (this.div.scrollTop + this.div.clientHeight) >
            this.div.clientHeight;
        if (jumpToPresentCondition != this.props.jumpToPresentCondition.get()) {
            runInAction(() =>
                this.props.jumpToPresentCondition.set(jumpToPresentCondition)
            );
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
                this.div.scrollHeight -
                    (this.div.scrollTop + this.div.clientHeight) <
                    CONF_AUTO_RELOAD_Y_THRESHOLD
            ) {
                this.loadNewer();
            }
        }
    };

    onScroll = (event: any) => {
        if (
            this.div.scrollHeight === this.lastScrollHeight &&
            this.div.clientHeight === this.lastClientHeight
        ) {
            if (this.fromBottom !== undefined) {
                this.fromBottom = this.div.scrollTop;
            } else if (this.fromTop !== undefined) {
                this.fromTop =
                    this.div.scrollHeight -
                    this.div.clientHeight -
                    this.div.scrollTop;
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
            const itemElements = $(this.div).find(
                ".EezStudio_HistoryItemEnclosure"
            );
            if (itemElements.length > 0) {
                let foundItemElement = itemElements[0];
                const rect = foundItemElement.getBoundingClientRect();
                let minDistance = Math.abs(
                    this.div.clientHeight - (rect.top + rect.height / 2)
                );

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

                const matches = foundItemElement.className.match(
                    /EezStudio_HistoryItem_(\d*)/
                );
                if (matches && matches.length >= 1) {
                    const itemId = matches[1];
                    if (itemId !== this.lastItemInTheCenterId) {
                        // found it
                        this.props.history.setItemInTheCenterOfTheView(itemId);
                    }
                }
            }
        }, 100);
    };

    loadOlder = async () => {
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
                item.className.indexOf("EezStudio_HistoryItemEnclosure") !==
                    -1 &&
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

            window.setTimeout(() => {
                // make sure firstItem is again at the same offset
                this.div.scrollTop = firstItem!.offsetTop - offset;

                this.autoReloadEnabled = true;
            }, 5);
        } else {
            await this.props.history.navigator.loadOlder();
        }
    };

    loadNewer = () => {
        this.fromBottom = undefined;
        this.fromTop = undefined;

        this.props.history.navigator.loadNewer();
    };

    render() {
        return (
            <div
                className="EezStudio_HistoryListComponentContainer"
                ref={this.ref}
                onClick={event => {
                    if (
                        $(event.target).closest(
                            ".EezStudio_HistoryItemEnclosure"
                        ).length === 0
                    ) {
                        this.props.history.selection.selectItems([]);
                    }
                }}
            >
                {this.props.history.navigator.hasOlder && (
                    <LoadMoreButton
                        icon="material:expand_less"
                        loadMore={this.loadOlder}
                    />
                )}
                <HistoryItems
                    appStore={this.props.appStore}
                    historyItems={this.props.history.items}
                    selection={this.props.history.selection}
                    selectHistoryItemsSpecification={
                        this.props.appStore.selectHistoryItemsSpecification
                    }
                    getAllItemsBetween={(
                        fromItem: IHistoryItem,
                        toItem: IHistoryItem
                    ) =>
                        this.props.history.getAllItemsBetween(fromItem, toItem)
                    }
                    isDeletedItemsHistory={
                        this.props.history ===
                        this.props.appStore.deletedItemsHistory
                    }
                    deleteSelectedHistoryItems={() =>
                        this.props.history.deleteSelectedHistoryItems()
                    }
                    viewType="chat"
                    thumbnailSize={480}
                />
                {this.props.history.navigator.hasNewer && (
                    <LoadMoreButton
                        icon="material:expand_more"
                        loadMore={this.loadNewer}
                    />
                )}
            </div>
        );
    }
}

export const HistoryListComponent = observer(HistoryListComponentClass);
