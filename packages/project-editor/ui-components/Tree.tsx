import React from "react";
import { observable, computed, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { hasClass } from "eez-studio-shared/dom";

import { Icon } from "eez-studio-ui/icon";

import {
    TreeAdapter,
    DropPosition,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

const DropMark = observer(
    ({
        left,
        top,
        width,
        verticalConnectionLineHeight
    }: {
        left: number;
        top: number;
        width: number;
        verticalConnectionLineHeight: number | undefined;
    }) => (
        <div className="DropMark" style={{ left, top, width }}>
            <div>
                <div />
                <div />
            </div>
            {verticalConnectionLineHeight !== undefined && (
                <div
                    style={{
                        top: -verticalConnectionLineHeight + "px",
                        height: verticalConnectionLineHeight - 4 + "px"
                    }}
                />
            )}
        </div>
    )
);

////////////////////////////////////////////////////////////////////////////////

const TreeRow = observer(
    class TreeRow extends React.Component<{
        treeAdapter: TreeAdapter;
        item: TreeObjectAdapter;
        level: number;
        draggable: boolean;
        onDragStart: (event: any) => void;
        onDrag: (event: any) => void;
        onDragEnd: (event: any) => void;
        onClick: (event: any) => void;
        onMouseUp: (event: any) => void;
        onDoubleClick: (event: any) => void;
        collapsable: boolean;
        onToggleCollapse: (event: any) => void;
        onEditItem?: (itemId: string) => void;
        renderItem?: (itemId: string) => React.ReactNode;
    }> {
        ref = React.createRef<HTMLDivElement>();

        ensureVisibleTimeout: any;

        componentDidMount() {
            this.ensureVisibleTimeout = setTimeout(() => {
                this.ensureVisibleTimeout = undefined;

                if (
                    !(
                        this.props.treeAdapter.draggableAdapter &&
                        this.props.treeAdapter.draggableAdapter.isDragging
                    )
                ) {
                    if (hasClass(this.ref.current, "selected")) {
                        this.ref.current!.scrollIntoView({ block: "center" });
                    }
                }
            }, 100);
        }

        componentWillUnmount(): void {
            if (this.ensureVisibleTimeout) {
                clearTimeout(this.ensureVisibleTimeout);
                this.ensureVisibleTimeout = undefined;
            }
        }

        render() {
            const {
                treeAdapter,
                item,
                level,
                collapsable,
                onToggleCollapse,
                onEditItem
            } = this.props;

            let className = classNames("tree-row", {
                selected: treeAdapter.isSelected(item),
                "drag-source":
                    treeAdapter.draggableAdapter &&
                    treeAdapter.draggableAdapter.isDragSource(item)
            });

            let triangle: JSX.Element | undefined;
            if (collapsable) {
                triangle = (
                    <Icon
                        icon={
                            treeAdapter.collapsableAdapter!.isExpanded(item)
                                ? "material:keyboard_arrow_down"
                                : "material:keyboard_arrow_right"
                        }
                        size={18}
                        className="tree-row-triangle"
                        onClick={onToggleCollapse}
                    />
                );
            }

            return (
                <div
                    ref={this.ref}
                    data-object-id={treeAdapter.getItemId(item)}
                    className={className}
                    style={{
                        paddingLeft:
                            treeAdapter.maxLevel === 0
                                ? 4
                                : (triangle ? 0 : 18) + level * 18
                    }}
                    onMouseUp={this.props.onMouseUp}
                    onClick={this.props.onClick}
                    onDoubleClick={this.props.onDoubleClick}
                    draggable={this.props.draggable}
                    onDragStart={this.props.onDragStart}
                    onDrag={this.props.onDrag}
                    onDragEnd={this.props.onDragEnd}
                >
                    {triangle}

                    {this.props.renderItem ? (
                        this.props.renderItem(treeAdapter.getItemId(item))
                    ) : (
                        <span style={{ flex: 1 }}>
                            {treeAdapter.itemToString(item)}
                        </span>
                    )}

                    {onEditItem && (
                        <Icon
                            icon="material:edit"
                            size={18}
                            className="EditIcon"
                            onClick={() =>
                                onEditItem(treeAdapter.getItemId(item))
                            }
                        />
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

interface TreeProps {
    treeAdapter: TreeAdapter;
    tabIndex?: number;
    onFocus?: () => void;
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
    onFilesDrop?: (files: File[]) => void;
}

export const Tree = observer(
    class Tree extends React.Component<TreeProps, {}> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        static defaultProps = {
            tabIndex: -1,
            maxLevel: undefined,
            collapsable: true,
            sortDirection: "none"
        };

        treeDiv: HTMLDivElement;

        dropPosition: DropPosition | undefined;
        dropMarkLeft: number;
        dropMarkTop: number;
        dropMarkWidth: number;
        dropMarkVerticalConnectionLineHeight: number | undefined;

        constructor(props: TreeProps) {
            super(props);

            makeObservable(this, {
                dropPosition: observable,
                dropMarkLeft: observable,
                dropMarkTop: observable,
                dropMarkWidth: observable,
                dropMarkVerticalConnectionLineHeight: observable,
                allRows: computed,
                onDragOver: action.bound,
                onDragLeave: action.bound,
                onDrop: action.bound
            });
        }

        get allRows() {
            return this.props.treeAdapter.allRows;
        }

        componentDidUpdate(prevProps: any) {
            if (this.props != prevProps) {
                this.setState({
                    dropItem: undefined
                });
            }
        }

        onSelect(objectId: string) {
            let item = this.props.treeAdapter.getItemFromId(objectId);
            if (item) {
                this.props.treeAdapter.selectItem(item);
            }
        }

        onKeyDown = (event: any) => {
            if (event.altKey) {
            } else if (event.shiftKey) {
            } else if (event.ctrlKey) {
                if (event.keyCode == "X".charCodeAt(0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.props.treeAdapter.cutSelection();
                } else if (event.keyCode == "C".charCodeAt(0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.props.treeAdapter.copySelection();
                } else if (event.keyCode == "V".charCodeAt(0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.context.paste();
                }
            } else {
                let focusedItemId = $(this.treeDiv)
                    .find(".tree-row.selected")
                    .attr("data-object-id");

                if (!focusedItemId) {
                    return;
                }

                let $focusedItem = $(this.treeDiv).find(
                    `.tree-row[data-object-id="${focusedItemId}"]`
                );

                if (
                    event.keyCode == 38 ||
                    event.keyCode == 40 ||
                    event.keyCode == 33 ||
                    event.keyCode == 34 ||
                    event.keyCode == 36 ||
                    event.keyCode == 35
                ) {
                    let $rows = $(this.treeDiv).find(".tree-row");
                    let index = $rows.index($focusedItem);

                    let pageSize = Math.floor(
                        $(this.treeDiv).height()! / $rows.height()!
                    );

                    if (event.keyCode == 38) {
                        // up
                        index--;
                    } else if (event.keyCode == 40) {
                        // down
                        index++;
                    } else if (event.keyCode == 33) {
                        // page up
                        index -= pageSize;
                    } else if (event.keyCode == 34) {
                        // page down
                        index += pageSize;
                    } else if (event.keyCode == 36) {
                        // home
                        index = 0;
                    } else if (event.keyCode == 35) {
                        // end
                        index = $rows.length - 1;
                    }

                    if (index < 0) {
                        index = 0;
                    } else if (index >= $rows.length) {
                        index = $rows.length - 1;
                    }

                    let newFocusedItemId = $($rows[index]).attr(
                        "data-object-id"
                    );
                    if (newFocusedItemId) {
                        this.onSelect(newFocusedItemId);
                        ($rows[index] as Element).scrollIntoView({
                            block: "nearest",
                            behavior: "auto"
                        });
                    }

                    event.preventDefault();
                } else if (event.keyCode == 37 || event.keyCode == 39) {
                    // left
                    let $rows = $focusedItem.parent().find(".tree-row");
                    if ($rows.length == 1) {
                        let $row = $($rows[0]);
                        $rows = $row.parent().parent().find(".tree-row");
                        let newFocusedItemId = $($rows[0]).attr(
                            "data-object-id"
                        );
                        if (newFocusedItemId) {
                            this.onSelect(newFocusedItemId);
                        }
                    } else {
                        $focusedItem
                            .find(".tree-row-triangle")
                            .trigger("click");
                    }

                    event.preventDefault();
                } else if (event.keyCode == 13) {
                    let item = this.props.treeAdapter.getItemFromId(
                        $focusedItem.attr("data-object-id")!
                    );
                    if (item) {
                        this.props.treeAdapter.onClick(item);
                    }
                }
            }
        };

        onDragOver(event: React.DragEvent) {
            if (isFileData(event)) {
                if (this.props.onFilesDrop) {
                    event.stopPropagation();
                    event.preventDefault();
                }
                return;
            }

            if (
                event.dataTransfer.types.indexOf(
                    "application/eez-studio-tab"
                ) >= 0
            ) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "none";
                return;
            }

            const treeAdapter = this.props.treeAdapter;
            const draggableAdapter = treeAdapter.draggableAdapter!;

            if (this.props.treeAdapter.draggable) {
                const $treeDiv = $(this.treeDiv);
                const $allRows = $treeDiv.find("[data-object-id]");

                if ($allRows.length > 0) {
                    const firstRowRect = $allRows
                        .get(0)!
                        .getBoundingClientRect();
                    const treeDivRect = this.treeDiv.getBoundingClientRect();
                    let rowIndexAtCursor = Math.floor(
                        (event.nativeEvent.clientY - treeDivRect.top) /
                            firstRowRect.height
                    );

                    if (
                        rowIndexAtCursor >= 0 &&
                        rowIndexAtCursor < $allRows.length
                    ) {
                        const $row = $allRows.eq(rowIndexAtCursor);
                        const rowRect = $row.get(0)!.getBoundingClientRect();

                        const $label = $row.find("span");
                        const labelRect = $label
                            .get(0)!
                            .getBoundingClientRect();

                        const objectId = $row.attr("data-object-id");
                        let dropItem = treeAdapter.getItemFromId(objectId!)!;

                        let dropPosition: DropPosition | undefined;
                        let canDrop = false;

                        const CHILD_OFFSET = 25;

                        function checks() {
                            const $row = $treeDiv.find(
                                `[data-object-id="${treeAdapter.getItemId(
                                    dropItem
                                )}"]`
                            );
                            const rowIndexAtCursor = $allRows.index($row);

                            let prevObjectId;
                            if (rowIndexAtCursor > 0) {
                                const $prevRow = $allRows.eq(
                                    rowIndexAtCursor - 1
                                );
                                prevObjectId = $prevRow.attr("data-object-id");
                            }

                            let nextObjectId;
                            if (rowIndexAtCursor < $allRows.length - 1) {
                                const $nextRow = $allRows.eq(
                                    rowIndexAtCursor + 1
                                );
                                nextObjectId = $nextRow.attr("data-object-id");
                            }

                            canDrop = draggableAdapter.canDrop(
                                dropItem,
                                dropPosition!,
                                prevObjectId,
                                nextObjectId
                            );
                        }

                        const $nextRow = $allRows.eq(rowIndexAtCursor + 1);
                        const nextObjectId = $nextRow.attr("data-object-id");
                        let nextItem = nextObjectId
                            ? treeAdapter.getItemFromId(nextObjectId!)
                            : undefined;
                        let nextItemParent =
                            nextItem && treeAdapter.getItemParent(nextItem);

                        if (
                            event.nativeEvent.clientY <
                            rowRect.top + rowRect.height / 2
                        ) {
                            dropPosition = DropPosition.DROP_POSITION_BEFORE;

                            checks();
                        } else {
                            dropPosition = DropPosition.DROP_POSITION_AFTER;

                            if (
                                event.nativeEvent.clientX >
                                    labelRect.left + CHILD_OFFSET &&
                                draggableAdapter.canDropInside(dropItem) &&
                                !draggableAdapter.isAncestorOfDragObject(
                                    dropItem
                                ) &&
                                !(
                                    rowIndexAtCursor + 1 < $allRows.length &&
                                    treeAdapter.isAncestor(nextItem!, dropItem)
                                )
                            ) {
                                dropPosition =
                                    DropPosition.DROP_POSITION_INSIDE;
                                canDrop = true;
                            } else if (dropItem === nextItemParent) {
                                dropItem = nextItem!;
                                dropPosition =
                                    DropPosition.DROP_POSITION_BEFORE;
                                checks();
                            } else {
                                let canDropToItem;

                                while (true) {
                                    const $row = $treeDiv.find(
                                        `[data-object-id="${treeAdapter.getItemId(
                                            dropItem
                                        )}"]`
                                    );

                                    if ($row.length > 0) {
                                        canDrop = false;

                                        checks();

                                        if (canDrop) {
                                            canDropToItem = dropItem;

                                            const $label = $row.find("span");
                                            const labelRect = $label
                                                .get(0)!
                                                .getBoundingClientRect();

                                            if (
                                                event.nativeEvent.clientX >
                                                labelRect.left
                                            ) {
                                                break;
                                            }
                                        }
                                    }

                                    const parentItem =
                                        treeAdapter.getItemParent(dropItem);

                                    if (
                                        !parentItem ||
                                        parentItem === nextItemParent
                                    ) {
                                        break;
                                    }

                                    dropItem = parentItem;
                                }

                                if (canDropToItem) {
                                    if (
                                        treeAdapter.getItemParent(
                                            canDropToItem
                                        ) === nextItemParent
                                    ) {
                                        dropItem = nextItem!;
                                        dropPosition =
                                            DropPosition.DROP_POSITION_BEFORE;
                                        checks();
                                    } else {
                                        dropItem = canDropToItem;
                                        canDrop = true;
                                    }
                                } else {
                                    canDrop = false;
                                }
                            }
                        }

                        if (canDrop) {
                            if (
                                dropItem !== draggableAdapter.dropItem ||
                                dropPosition !== this.dropPosition
                            ) {
                                if (dropPosition !== this.dropPosition) {
                                    this.dropPosition = dropPosition;
                                }

                                const $row = $treeDiv.find(
                                    `[data-object-id="${treeAdapter.getItemId(
                                        dropItem
                                    )}"]`
                                );
                                const rowRect = $row[0].getBoundingClientRect();

                                const $label = $row.find("span");
                                const labelRect = $label
                                    .get(0)!
                                    .getBoundingClientRect();

                                this.dropMarkVerticalConnectionLineHeight =
                                    undefined;

                                if (
                                    dropPosition ===
                                    DropPosition.DROP_POSITION_INSIDE
                                ) {
                                    this.dropMarkLeft =
                                        labelRect.left -
                                        treeDivRect.left +
                                        CHILD_OFFSET;
                                    this.dropMarkTop = rowRect.bottom;
                                    this.dropMarkTop -= treeDivRect.top;
                                    this.dropMarkWidth =
                                        rowRect.right -
                                        labelRect.left -
                                        CHILD_OFFSET;
                                } else {
                                    this.dropMarkLeft =
                                        labelRect.left - treeDivRect.left;
                                    if (
                                        this.dropPosition ===
                                        DropPosition.DROP_POSITION_BEFORE
                                    ) {
                                        this.dropMarkTop = rowRect.top;
                                    } else {
                                        if (
                                            rowIndexAtCursor !==
                                            $allRows.index($row)
                                        ) {
                                            const $row2 =
                                                $allRows.eq(rowIndexAtCursor);
                                            const rowRect2 = $row2
                                                .get(0)!
                                                .getBoundingClientRect();

                                            this.dropMarkTop = rowRect2.bottom;
                                            this.dropMarkVerticalConnectionLineHeight =
                                                rowRect2.bottom -
                                                rowRect.bottom;
                                        } else {
                                            this.dropMarkTop = rowRect.bottom;
                                        }
                                    }
                                    this.dropMarkTop -= treeDivRect.top;
                                    this.dropMarkWidth =
                                        rowRect.right - labelRect.left;
                                }
                            }

                            draggableAdapter.onDragOver(dropItem, event);
                            return;
                        }
                    }
                } else {
                    this.dropMarkTop = 0;
                    this.dropMarkWidth = $treeDiv.width() || 100;
                    this.dropPosition = DropPosition.DROP_POSITION_INSIDE;
                    draggableAdapter.onDragOver(
                        this.props.treeAdapter.rootItem,
                        event
                    );
                    return;
                }
            }

            this.dropPosition = undefined;
            draggableAdapter.onDragOver(undefined, event);
        }

        onDragLeave(event: any) {
            if (isFileData(event)) {
                return;
            }

            this.dropPosition = undefined;
            this.props.treeAdapter.draggableAdapter!.onDragLeave(event);
        }

        onDrop(event: React.DragEvent) {
            event.stopPropagation();
            event.preventDefault();

            if (isFileData(event)) {
                if (this.props.onFilesDrop) {
                    const files: File[] = [];
                    for (let i = 0; i < event.dataTransfer.items.length; i++) {
                        const item = event.dataTransfer.items[i];
                        const file = item.getAsFile();
                        if (file) {
                            files.push(file);
                        }
                    }
                    this.props.onFilesDrop(files);
                }
                return;
            }

            if (this.props.treeAdapter.draggableAdapter!.dropItem) {
                let dropPosition = this.dropPosition;
                this.dropPosition = undefined;

                this.props.treeAdapter.draggableAdapter!.onDrop(
                    dropPosition || DropPosition.DROP_POSITION_NONE,
                    event
                );
            }
        }

        onClick = (event: React.MouseEvent<HTMLDivElement>) => {
            //event.preventDefault();
            //event.stopPropagation();

            this.props.treeAdapter.selectItems([]);
        };

        onMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.button == 2) {
                //event.preventDefault();
                //event.stopPropagation();

                this.props.treeAdapter.selectItems([]);
            }
        };

        onRowDragStart = (event: React.DragEvent<HTMLDivElement>) => {
            event.stopPropagation();
            let item = this.props.treeAdapter.getItemFromId(
                $(event.target).attr("data-object-id")!
            );
            this.props.treeAdapter.draggableAdapter!.onDragStart(item!, event);
        };

        onRowDrag = (event: any) => {
            let item = this.props.treeAdapter.getItemFromId(
                $(event.target).attr("data-object-id")!
            );
            this.props.treeAdapter.draggableAdapter!.onDrag(item!, event);
        };

        onRowDragEnd = (event: any) => {
            this.props.treeAdapter.draggableAdapter!.onDragEnd(event);
        };

        onRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
            if (!(event.nativeEvent.target instanceof HTMLInputElement)) {
                event.preventDefault();
                event.stopPropagation();
            }

            const $rowDiv = $(event.target).closest(
                ".tree-row[data-object-id]"
            );
            let item = this.props.treeAdapter.getItemFromId(
                $rowDiv.attr("data-object-id")!
            )!;
            if (event.shiftKey) {
                const $treeDiv = $rowDiv.parent();
                const $selectedItems = $treeDiv.find(".tree-row.selected");
                if ($selectedItems.length > 0) {
                    let $rows = $treeDiv.find(".tree-row");

                    let iFirst = $rows.index(
                        $selectedItems.first() as JQuery<HTMLElement>
                    );
                    let iLast = $rows.index(
                        $selectedItems.last() as JQuery<HTMLElement>
                    );
                    let iThisItem = $rows.index(
                        $treeDiv.find(
                            `.tree-row[data-object-id="${this.props.treeAdapter.getItemId(
                                item
                            )}"]`
                        ) as JQuery<HTMLElement>
                    );

                    let iFrom;
                    let iTo;
                    if (iThisItem <= iFirst) {
                        iFrom = iThisItem;
                        iTo = iLast;
                    } else if (iThisItem >= iLast) {
                        iFrom = iFirst;
                        iTo = iThisItem;
                    } else if (iThisItem - iFirst > iLast - iThisItem) {
                        iFrom = iFirst;
                        iTo = iThisItem;
                    } else {
                        iFrom = iThisItem;
                        iTo = iLast;
                    }

                    const items = [];
                    for (let i = iFrom; i <= iTo; i++) {
                        const id = $($rows.get(i)!).attr("data-object-id");
                        if (id) {
                            const item =
                                this.props.treeAdapter.getItemFromId(id);
                            if (item) {
                                items.push(item);
                            }
                        }
                    }

                    this.props.treeAdapter.selectItems(items);
                    return;
                } else {
                    this.props.treeAdapter.selectItem(item);
                }
            } else if (event.ctrlKey) {
                this.props.treeAdapter.toggleSelected(item);
            } else {
                this.props.treeAdapter.selectItem(item);
                this.props.treeAdapter.onClick(item);
            }
        };

        onRowMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.button === 2) {
                event.preventDefault();
                event.stopPropagation();

                const $rowDiv = $(event.target).closest(
                    ".tree-row[data-object-id]"
                );
                let item = this.props.treeAdapter.getItemFromId(
                    $rowDiv.attr("data-object-id")!
                )!;

                if (!this.props.treeAdapter.isSelected(item)) {
                    this.props.treeAdapter.selectItem(item);
                }
            }
        };

        onRowDoubleClick = (event: any) => {
            event.preventDefault();
            event.stopPropagation();

            const $rowDiv = $(event.target).closest(
                ".tree-row[data-object-id]"
            );
            let item = this.props.treeAdapter.getItemFromId(
                $rowDiv.attr("data-object-id")!
            )!;
            let row = this.props.treeAdapter.allRows.find(
                row => row.item == item
            )!;
            if (row.collapsable) {
                this.props.treeAdapter.selectItem(item);
                this.props.treeAdapter.collapsableAdapter!.toggleExpanded(item);
            } else {
                this.props.treeAdapter.onDoubleClick(item);
            }
        };

        onRowToggleCollapse = (event: any) => {
            event.preventDefault();
            event.stopPropagation();

            const $rowDiv = $(event.target).closest(
                ".tree-row[data-object-id]"
            );
            let item = this.props.treeAdapter.getItemFromId(
                $rowDiv.attr("data-object-id")!
            )!;
            this.props.treeAdapter.selectItem(item);
            this.props.treeAdapter.collapsableAdapter!.toggleExpanded(item);
        };

        onContextMenu = (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.props.treeAdapter.showSelectionContextMenu();
        };

        render() {
            const { treeAdapter, tabIndex, onFocus, onEditItem, renderItem } =
                this.props;

            const className = classNames("EezStudio_Tree", {
                "drag-source":
                    treeAdapter.draggableAdapter &&
                    treeAdapter.draggableAdapter.isDragging
            });

            return (
                <div
                    className={className}
                    tabIndex={tabIndex}
                    onKeyDown={this.onKeyDown}
                    onFocus={onFocus}
                    onDragOver={this.onDragOver}
                    onDragLeave={this.onDragLeave}
                    onDrop={this.onDrop}
                    onContextMenu={this.onContextMenu}
                    onClick={this.onClick}
                    onMouseUp={this.onMouseUp}
                >
                    <div
                        ref={ref => (this.treeDiv = ref!)}
                        style={{
                            pointerEvents:
                                treeAdapter.draggableAdapter &&
                                treeAdapter.draggableAdapter.isDragging
                                    ? "none"
                                    : "auto",
                            position: "relative"
                        }}
                    >
                        {this.allRows.map(row => (
                            <TreeRow
                                key={treeAdapter.getItemId(row.item)}
                                treeAdapter={treeAdapter}
                                item={row.item}
                                level={row.level}
                                draggable={
                                    this.props.treeAdapter.draggable &&
                                    row.draggable
                                }
                                onDragStart={this.onRowDragStart}
                                onDrag={this.onRowDrag}
                                onDragEnd={this.onRowDragEnd}
                                onClick={this.onRowClick}
                                onMouseUp={this.onRowMouseUp}
                                onDoubleClick={this.onRowDoubleClick}
                                collapsable={
                                    row.collapsable &&
                                    treeAdapter.getShowTreeCollapseIcon(
                                        row.item
                                    )
                                }
                                onToggleCollapse={this.onRowToggleCollapse}
                                onEditItem={onEditItem}
                                renderItem={renderItem}
                            />
                        ))}

                        {this.dropPosition && (
                            <DropMark
                                left={this.dropMarkLeft}
                                top={this.dropMarkTop}
                                width={this.dropMarkWidth}
                                verticalConnectionLineHeight={
                                    this.dropMarkVerticalConnectionLineHeight
                                }
                            />
                        )}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

function isFileData(event: React.DragEvent) {
    if (!event.dataTransfer.items) {
        return false;
    }

    if (event.dataTransfer.items.length == 0) {
        return false;
    }

    for (let i = 0; i < event.dataTransfer.items.length; i++) {
        const item = event.dataTransfer.items[i];
        if (item.kind !== "file") {
            return false;
        }
    }

    return true;
}
