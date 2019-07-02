import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { _filter, _map, _each } from "eez-studio-shared/algorithm";
import { hasClass } from "eez-studio-shared/dom";

import { Icon } from "eez-studio-ui/icon";
import styled from "eez-studio-ui/styled-components";

import { ITreeAdapter, ITreeItem, DropPosition } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

const DropMarkDiv = styled.div`
    position: absolute;
    height: 0;
`;

const DropHorizontalMarkDiv = styled.div`
    position: relative;
    top: 5px;
    height: 2px;
    border-top: 2px solid ${props => props.theme.dropPlaceColor};
`;

const DropHorizontalMarkLeftArrowDiv = styled.div`
    position: relative;
    top: -5px;
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 4px solid ${props => props.theme.dropPlaceColor};
`;

const DropHorizontalMarkRightArrowDiv = styled.div`
    position: relative;
    top: -13px;
    left: calc(100% - 4px);
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-right: 4px solid ${props => props.theme.dropPlaceColor};
`;

const DropVerticalMarkDiv = styled.div`
    position: relative;
    width: 1px;
    border-left: 1px solid ${props => props.theme.dropPlaceColor};
`;

interface DropMarkProps {
    left: number;
    top: number;
    width: number;
    verticalConnectionLineHeight: number | undefined;
}

@observer
class DropMark extends React.Component<DropMarkProps, {}> {
    render() {
        const { left, top, width, verticalConnectionLineHeight } = this.props;

        return (
            <DropMarkDiv style={{ left, top, width }}>
                <DropHorizontalMarkDiv>
                    <DropHorizontalMarkLeftArrowDiv />
                    <DropHorizontalMarkRightArrowDiv />
                </DropHorizontalMarkDiv>
                {verticalConnectionLineHeight !== undefined && (
                    <DropVerticalMarkDiv
                        style={{
                            top: -verticalConnectionLineHeight + "px",
                            height: verticalConnectionLineHeight - 4 + "px"
                        }}
                    />
                )}
            </DropMarkDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const TreeRowDiv = styled.div`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.drag-source {
        background-color: ${props => props.theme.dragSourceBackgroundColor};
        color: ${props => props.theme.dragSourceColor};
    }

    &.drop-target {
        background-color: ${props => props.theme.dropTargetBackgroundColor};
        color: ${props => props.theme.dropTargetColor};
    }

    .tree-row-label {
        display: inline-block;
        margin-left: 18px;
    }

    .tree-row-triangle {
        color: #333;
    }

    .tree-row-triangle:hover {
        color: #666;
    }

    &:hover {
        & > .EditIcon {
            visibility: visible;
        }
    }

    & > .EditIcon {
        cursor: pointer;
        float: right;
        visibility: hidden;
        color: ${props => props.theme.actionTextColor};
        &:hover {
            color: ${props => props.theme.actionHoverColor};
        }
    }

    &.selected {
        & > .EditIcon {
            color: white;
            &:hover {
                color: #ddd;
            }
        }
    }
`;

interface TreeRowProps {
    treeAdapter: ITreeAdapter;
    item: ITreeItem;
    level: number;
    draggable: boolean;
    collapsable: boolean;
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
}

@observer
class TreeRow extends React.Component<TreeRowProps, {}> {
    row: HTMLDivElement;
    index: number;
    ensureVisibleTimeout: any;

    ensureVisible() {
        if (this.ensureVisibleTimeout) {
            clearTimeout(this.ensureVisibleTimeout);
        }

        this.ensureVisibleTimeout = setTimeout(() => {
            this.ensureVisibleTimeout = undefined;

            if (
                !(
                    this.props.treeAdapter.draggableAdapter &&
                    this.props.treeAdapter.draggableAdapter.isDragging
                )
            ) {
                if (hasClass(this.row, "selected")) {
                    (this.row as any).scrollIntoViewIfNeeded();
                }
            }
        }, 100);
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    @bind
    onDragStart(event: any) {
        this.props.treeAdapter.draggableAdapter!.onDragStart(this.props.item, event);
    }

    @bind
    onDrag(event: any) {
        this.props.treeAdapter.draggableAdapter!.onDrag(this.props.item, event);
    }

    @bind
    onDragEnd(event: any) {
        this.props.treeAdapter.draggableAdapter!.onDragEnd(event);
    }

    @bind
    onMouseUp(event: React.MouseEvent<HTMLDivElement>) {
        if (event.button === 2) {
            event.preventDefault();
            event.stopPropagation();

            if (!this.props.treeAdapter.isSelected(this.props.item)) {
                this.props.treeAdapter.selectItem(this.props.item);
            }

            setTimeout(() => {
                this.props.treeAdapter.showSelectionContextMenu();
            });
        }
    }

    @bind
    onTriangleClick(event: any) {
        event.preventDefault();
        event.stopPropagation();

        this.props.treeAdapter.selectItem(this.props.item);
        this.props.treeAdapter.collapsableAdapter!.toggleExpanded(this.props.item);
    }

    @bind
    onClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.ctrlKey) {
            this.props.treeAdapter.toggleSelected(this.props.item);
        } else {
            this.props.treeAdapter.selectItem(this.props.item);
        }
    }

    @bind
    onDoubleClick(e: any) {
        e.preventDefault();
        e.stopPropagation();

        this.props.treeAdapter.onDoubleClick(this.props.item);
    }

    render() {
        const {
            treeAdapter,
            item,
            collapsable,
            level,
            draggable,
            onEditItem,
            renderItem
        } = this.props;

        let className = classNames("tree-row", {
            selected: treeAdapter.isSelected(item),
            "drag-source":
                treeAdapter.draggableAdapter && treeAdapter.draggableAdapter.isDragSource(item)
        });

        let triangle: JSX.Element | undefined;
        let labelClassName;
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
                    onClick={this.onTriangleClick}
                />
            );
        } else {
            labelClassName = "tree-row-label";
        }

        return (
            <TreeRowDiv
                ref={(ref: any) => (this.row = ref!)}
                data-object-id={treeAdapter.getItemId(item)}
                className={className}
                style={{ paddingLeft: level * 20 }}
                onMouseUp={this.onMouseUp}
                onClick={this.onClick}
                onDoubleClick={triangle ? this.onTriangleClick : this.onDoubleClick}
                draggable={draggable}
                onDragStart={this.onDragStart}
                onDrag={this.onDrag}
                onDragEnd={this.onDragEnd}
            >
                {onEditItem && (
                    <Icon
                        icon="material:edit"
                        size={18}
                        className="EditIcon"
                        onClick={() => onEditItem(treeAdapter.getItemId(item))}
                    />
                )}

                {triangle}

                {renderItem ? (
                    renderItem(treeAdapter.getItemId(item))
                ) : (
                    <span className={labelClassName}>{treeAdapter.itemToString(item)}</span>
                )}
            </TreeRowDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class TreeRows extends React.Component<{
    treeAdapter: ITreeAdapter;
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
}> {
    @computed
    get allRows() {
        return this.props.treeAdapter.allRows;
    }

    render() {
        const { treeAdapter, onEditItem, renderItem } = this.props;

        return this.allRows.map(row => (
            <TreeRow
                key={this.props.treeAdapter.getItemId(row.item)}
                treeAdapter={treeAdapter}
                item={row.item}
                level={row.level}
                draggable={row.draggable}
                collapsable={row.collapsable}
                onEditItem={onEditItem}
                renderItem={renderItem}
            />
        ));
    }
}

////////////////////////////////////////////////////////////////////////////////

const TreeDiv = styled.div`
    flex-grow: 1;
    overflow: auto;
    padding: 5px;
    border: 2px dashed transparent;
    height: 100%;
    position: relative;

    &.zero-level .tree-row-label {
        margin-left: 0 !important;
    }

    &:not(.drag-source) {
        .tree-row:not(.drag-source) {
            &.selected {
                background-color: ${props => props.theme.nonFocusedSelectionBackgroundColor};
                color: ${props => props.theme.nonFocusedSelectionColor};
            }
        }

        &:focus {
            .tree-row:not(.drag-source) {
                &:hover {
                    background-color: ${props => props.theme.hoverBackgroundColor};
                    color: ${props => props.theme.hoverColor};
                }

                &.focused {
                    background-color: ${props => props.theme.focusBackgroundColor};
                    color: ${props => props.theme.focusColor};
                }

                &.selected {
                    background-color: ${props => props.theme.selectionBackgroundColor};
                    color: ${props => props.theme.selectionColor};
                }
            }
        }
    }
`;

interface TreeProps {
    treeAdapter: ITreeAdapter;
    tabIndex?: number;
    onFocus?: () => void;
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
}

@observer
export class Tree extends React.Component<TreeProps, {}> {
    static defaultProps = {
        tabIndex: -1,
        maxLevel: undefined,
        collapsable: true,
        sortDirection: "none"
    };

    treeDiv: HTMLDivElement;

    @observable dropPosition: DropPosition | undefined;
    @observable dropMarkLeft: number;
    @observable dropMarkTop: number;
    @observable dropMarkWidth: number;
    @observable dropMarkVerticalConnectionLineHeight: number | undefined;

    componentWillReceiveProps(nextProps: TreeProps) {
        this.setState({
            dropItem: undefined
        });
    }

    onSelect(objectId: string) {
        let item = this.props.treeAdapter.getItemFromId(objectId);
        if (item) {
            this.props.treeAdapter.selectItem(item);
        }
    }

    @bind
    onKeyDown(event: any) {
        let focusedItemId = $(this.treeDiv)
            .find(".tree-row.selected")
            .attr("data-object-id");

        if (!focusedItemId) {
            return;
        }

        let $focusedItem = $(this.treeDiv).find(`.tree-row[data-object-id="${focusedItemId}"]`);

        if (event.altKey) {
        } else if (event.shiftKey) {
        } else if (event.ctrlKey) {
            if (event.keyCode == "X".charCodeAt(0)) {
                this.props.treeAdapter.cutSelection();
            } else if (event.keyCode == "C".charCodeAt(0)) {
                this.props.treeAdapter.copySelection();
            } else if (event.keyCode == "V".charCodeAt(0)) {
                this.props.treeAdapter.pasteSelection();
            }
        } else if (event.keyCode == 46) {
            // delete
            this.props.treeAdapter.deleteSelection();
        } else {
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

                let pageSize = Math.floor($(this.treeDiv).height()! / $rows.height()!);

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

                let newFocusedItemId = $($rows[index]).attr("data-object-id");
                if (newFocusedItemId) {
                    this.onSelect(newFocusedItemId);
                    ($rows[index] as Element).scrollIntoView({
                        block: "nearest",
                        behavior: "auto"
                    });
                }

                event.preventDefault();
            } else if (event.keyCode == 37) {
                // left
                let $rows = $focusedItem.parent().find(".tree-row");
                if ($rows.length == 1) {
                    let $row = $($rows[0]);
                    $rows = $row
                        .parent()
                        .parent()
                        .find(".tree-row");
                    let newFocusedItemId = $($rows[0]).attr("data-object-id");
                    if (newFocusedItemId) {
                        this.onSelect(newFocusedItemId);
                    }
                } else {
                    $focusedItem.find(".tree-row-triangle").trigger("click");
                }

                event.preventDefault();
            } else if (event.keyCode == 39) {
                // right
                let $rows = $focusedItem.parent().find(".tree-row");
                let index = $rows.index($focusedItem);

                if (index == 0) {
                    if ($rows.length > 1) {
                        let newFocusedItemId = $($rows[1]).attr("data-object-id");
                        if (newFocusedItemId) {
                            this.onSelect(newFocusedItemId);
                        }
                    } else {
                        $focusedItem.find(".tree-row-triangle").trigger("click");
                    }
                }

                event.preventDefault();
            }
        }
    }

    @action.bound
    onDragOver(event: React.DragEvent) {
        const treeAdapter = this.props.treeAdapter;
        const draggableAdapter = treeAdapter.draggableAdapter!;

        const $treeDiv = $(this.treeDiv);
        const $allRows = $treeDiv.find("[data-object-id]");

        if ($allRows.length > 0) {
            const firstRowRect = $allRows.get(0).getBoundingClientRect();
            const treeDivRect = this.treeDiv.getBoundingClientRect();
            let rowIndexAtCursor = Math.floor(
                (event.nativeEvent.clientY - treeDivRect.top) / firstRowRect.height
            );

            if (rowIndexAtCursor >= 0 && rowIndexAtCursor < $allRows.length) {
                const $row = $allRows.eq(rowIndexAtCursor);
                const rowRect = $row.get(0).getBoundingClientRect();

                const $label = $row.find("span");
                const labelRect = $label.get(0).getBoundingClientRect();

                const objectId = $row.attr("data-object-id");
                let dropItem = treeAdapter.getItemFromId(objectId!)!;

                let dropPosition: DropPosition | undefined;
                let canDrop = false;

                const CHILD_OFFSET = 25;

                function checks() {
                    const $row = $treeDiv.find(
                        `[data-object-id="${treeAdapter.getItemId(dropItem)}"]`
                    );
                    const rowIndexAtCursor = $allRows.index($row);

                    let prevObjectId;
                    if (rowIndexAtCursor > 0) {
                        const $prevRow = $allRows.eq(rowIndexAtCursor - 1);
                        prevObjectId = $prevRow.attr("data-object-id");
                    }

                    let nextObjectId;
                    if (rowIndexAtCursor < $allRows.length - 1) {
                        const $nextRow = $allRows.eq(rowIndexAtCursor + 1);
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
                let nextItem = treeAdapter.getItemFromId(nextObjectId!)!;
                let nextItemParent = nextItem && treeAdapter.getItemParent(nextItem);

                if (event.nativeEvent.clientY < rowRect.top + rowRect.height / 2) {
                    dropPosition = DropPosition.DROP_POSITION_BEFORE;

                    checks();
                } else {
                    dropPosition = DropPosition.DROP_POSITION_AFTER;

                    if (
                        event.nativeEvent.clientX > labelRect.left + CHILD_OFFSET &&
                        draggableAdapter.canDropInside(dropItem) &&
                        !draggableAdapter.isAncestorOfDragObject(dropItem) &&
                        !(
                            rowIndexAtCursor + 1 < $allRows.length &&
                            treeAdapter.isAncestor(nextItem, dropItem)
                        )
                    ) {
                        dropPosition = DropPosition.DROP_POSITION_INSIDE;
                        canDrop = true;
                    } else if (dropItem === nextItemParent) {
                        dropItem = nextItem;
                        dropPosition = DropPosition.DROP_POSITION_BEFORE;
                        checks();
                    } else {
                        let canDropToItem;

                        while (true) {
                            const $row = $treeDiv.find(
                                `[data-object-id="${treeAdapter.getItemId(dropItem)}"]`
                            );

                            if ($row.length > 0) {
                                canDrop = false;

                                checks();

                                if (canDrop) {
                                    canDropToItem = dropItem;

                                    const $label = $row.find("span");
                                    const labelRect = $label.get(0).getBoundingClientRect();

                                    if (event.nativeEvent.clientX > labelRect.left) {
                                        break;
                                    }
                                }
                            }

                            const parentItem = treeAdapter.getItemParent(dropItem);

                            if (!parentItem || parentItem === nextItemParent) {
                                break;
                            }

                            dropItem = parentItem;
                        }

                        if (canDropToItem) {
                            if (treeAdapter.getItemParent(canDropToItem) === nextItemParent) {
                                dropItem = nextItem;
                                dropPosition = DropPosition.DROP_POSITION_BEFORE;
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
                            `[data-object-id="${treeAdapter.getItemId(dropItem)}"]`
                        );
                        const rowRect = $row[0].getBoundingClientRect();

                        const $label = $row.find("span");
                        const labelRect = $label.get(0).getBoundingClientRect();

                        this.dropMarkVerticalConnectionLineHeight = undefined;

                        if (dropPosition === DropPosition.DROP_POSITION_INSIDE) {
                            this.dropMarkLeft = labelRect.left - treeDivRect.left + CHILD_OFFSET;
                            this.dropMarkTop = rowRect.bottom;
                            this.dropMarkTop -= treeDivRect.top;
                            this.dropMarkWidth = rowRect.right - labelRect.left - CHILD_OFFSET;
                        } else {
                            this.dropMarkLeft = labelRect.left - treeDivRect.left;
                            if (this.dropPosition === DropPosition.DROP_POSITION_BEFORE) {
                                this.dropMarkTop = rowRect.top;
                            } else {
                                if (rowIndexAtCursor !== $allRows.index($row)) {
                                    const $row2 = $allRows.eq(rowIndexAtCursor);
                                    const rowRect2 = $row2.get(0).getBoundingClientRect();

                                    this.dropMarkTop = rowRect2.bottom;
                                    this.dropMarkVerticalConnectionLineHeight =
                                        rowRect2.bottom - rowRect.bottom;
                                } else {
                                    this.dropMarkTop = rowRect.bottom;
                                }
                            }
                            this.dropMarkTop -= treeDivRect.top;
                            this.dropMarkWidth = rowRect.right - labelRect.left;
                        }
                    }

                    draggableAdapter.onDragOver(dropItem, event);
                    return;
                }
            }
        }

        this.dropPosition = undefined;
        draggableAdapter.onDragOver(undefined, event);
    }

    @action.bound
    onDragLeave(event: any) {
        this.dropPosition = undefined;
        this.props.treeAdapter.draggableAdapter!.onDragLeave(event);
    }

    @action.bound
    onDrop(event: any) {
        if (this.props.treeAdapter.draggableAdapter!.dropItem) {
            let dropPosition = this.dropPosition;
            this.dropPosition = undefined;

            this.props.treeAdapter.draggableAdapter!.onDrop(
                dropPosition || DropPosition.DROP_POSITION_NONE,
                event
            );
        }
    }

    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    render() {
        const { treeAdapter, tabIndex, onFocus, onEditItem, renderItem } = this.props;

        const className = classNames({
            "drag-source": treeAdapter.draggableAdapter && treeAdapter.draggableAdapter.isDragging,
            "zero-level": treeAdapter.maxLevel === 0
        });

        return (
            <TreeDiv
                className={className}
                tabIndex={tabIndex}
                onKeyDown={this.onKeyDown}
                onFocus={onFocus}
                onDragOver={this.onDragOver}
                onDragLeave={this.onDragLeave}
                onDrop={this.onDrop}
                onContextMenu={this.onContextMenu}
            >
                <div
                    ref={ref => (this.treeDiv = ref!)}
                    style={{
                        pointerEvents:
                            treeAdapter.draggableAdapter && treeAdapter.draggableAdapter.isDragging
                                ? "none"
                                : "auto"
                    }}
                >
                    <TreeRows
                        treeAdapter={treeAdapter}
                        onEditItem={onEditItem}
                        renderItem={renderItem}
                    />
                    {this.dropPosition && (
                        <DropMark
                            left={this.dropMarkLeft}
                            top={this.dropMarkTop}
                            width={this.dropMarkWidth}
                            verticalConnectionLineHeight={this.dropMarkVerticalConnectionLineHeight}
                        />
                    )}
                </div>
            </TreeDiv>
        );
    }
}
