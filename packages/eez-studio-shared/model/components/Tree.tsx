import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { _filter, _map, _each } from "eez-studio-shared/algorithm";
import { hasClass } from "eez-studio-shared/dom";
import { stringCompare } from "eez-studio-shared/string";

import { Icon } from "eez-studio-ui/icon";
import styled from "eez-studio-ui/styled-components";

import {
    EezObject,
    PropertyInfo,
    isArray,
    objectToString,
    cloneObject,
    isShowOnlyChildrenInTree,
    isAncestor,
    isArrayElement,
    isObjectInstanceOf
} from "eez-studio-shared/model/object";
import {
    objectToClipboardData,
    setClipboardData,
    findPastePlaceInside
} from "eez-studio-shared/model/clipboard";
import { DocumentStore, canContainChildren } from "eez-studio-shared/model/store";
import { DragAndDropManager } from "eez-studio-shared/model/dd";
import { ITreeObjectAdapter } from "eez-studio-shared/model/objectAdapter";
import { computed } from "mobx";

////////////////////////////////////////////////////////////////////////////////

export enum DropPosition {
    DROP_POSITION_NONE,
    DROP_POSITION_BEFORE,
    DROP_POSITION_AFTER,
    DROP_POSITION_INSIDE
}

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
    cursor: pointer;
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
`;

interface TreeRowProps {
    showOnlyChildren: boolean;
    collapsable: boolean;
    rootItem: ITreeObjectAdapter;
    item: ITreeObjectAdapter;
    onDoubleClick?: (object: EezObject) => void;
    level: number;
    filter?: (object: EezObject) => boolean;
    draggable: boolean;
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

            if (!DragAndDropManager.dragObject) {
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
        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(event, objectToClipboardData(this.props.item.object));
        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);
        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, this.props.item.object);
        });
    }

    @bind
    onDrag(event: any) {
        DragAndDropManager.drag(event);
    }

    @bind
    onDragEnd(event: any) {
        DragAndDropManager.end(event);
    }

    @bind
    onMouseUp(event: React.MouseEvent<HTMLDivElement>) {
        if (event.button === 2) {
            event.preventDefault();
            event.stopPropagation();

            const position = {
                left: event.clientX,
                top: event.clientY
            };

            if (!this.props.item.selected) {
                this.props.rootItem.selectItems([this.props.item]);
            }

            setTimeout(() => {
                this.props.rootItem.showSelectionContextMenu(position);
            });
        }
    }

    @bind
    onTriangleClick(event: any) {
        event.preventDefault();
        event.stopPropagation();

        this.props.rootItem.selectItems([this.props.item]);
        this.props.item.toggleExpanded();
    }

    @bind
    onClick(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey) {
            this.props.rootItem.toggleSelected(this.props.item);
        } else {
            this.props.rootItem.selectItems([this.props.item]);
        }
    }

    @bind
    onDoubleClick(e: any) {
        e.preventDefault();
        e.stopPropagation();

        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.item.object);
        }
    }

    render() {
        let className = classNames("tree-row", {
            selected: this.props.item.selected,
            "drag-source": DragAndDropManager.dragObject === this.props.item.object
        });

        let triangle: JSX.Element | undefined;
        let labelClassName;
        if (this.props.collapsable) {
            triangle = (
                <Icon
                    icon={
                        this.props.item.expanded
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
                ref={ref => (this.row = ref!)}
                data-object-id={this.props.item.object._id}
                className={className}
                style={{ paddingLeft: this.props.level * 20 }}
                onMouseUp={this.onMouseUp}
                onClick={this.onClick}
                onDoubleClick={triangle ? this.onTriangleClick : this.onDoubleClick}
                draggable={this.props.draggable}
                onDragStart={this.onDragStart}
                onDrag={this.onDrag}
                onDragEnd={this.onDragEnd}
            >
                {triangle}
                <span className={labelClassName}>{objectToString(this.props.item.object)}</span>
            </TreeRowDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class TreeRows extends React.Component<{
    rootItem: ITreeObjectAdapter;
    item?: ITreeObjectAdapter;
    filter?: (object: EezObject) => boolean;
    collapsable?: boolean;
    sortDirection?: SortDirectionType;
    maxLevel?: number;
    onDoubleClick?: (object: EezObject) => void;
}> {
    @computed
    get allRows() {
        const { filter, collapsable, sortDirection, maxLevel } = this.props;

        const draggable = sortDirection === "none";

        const children: {
            item: ITreeObjectAdapter;
            level: number;
            draggable: boolean;
            collapsable: boolean;
        }[] = [];

        function getChildren(item: ITreeObjectAdapter) {
            let itemChildren = _map(item.children, childItem => childItem) as ITreeObjectAdapter[];

            if (sortDirection !== "none") {
                if (sortDirection === "asc") {
                    itemChildren = itemChildren.sort((a, b) =>
                        stringCompare(a.object._label, b.object._label)
                    );
                } else if (sortDirection === "desc") {
                    itemChildren = itemChildren.sort((a, b) =>
                        stringCompare(b.object._label, a.object._label)
                    );
                }
            }

            return itemChildren;
        }

        function enumChildren(childItems: ITreeObjectAdapter[], level: number) {
            childItems.forEach(childItem => {
                if (!filter || filter(childItem.object)) {
                    const showOnlyChildren =
                        childItem.children.length == 1 &&
                        isArray(childItem.object) &&
                        isShowOnlyChildrenInTree(childItem.object);

                    const childItems = getChildren(childItem);

                    if (showOnlyChildren) {
                        enumChildren(childItems, level);
                    } else {
                        const row = {
                            item: childItem,
                            level,
                            draggable,
                            collapsable: false
                        };

                        children.push(row);

                        const maxLevelReached = maxLevel !== undefined && level === maxLevel;

                        if (!maxLevelReached && childItem.expanded && childItems.length > 0) {
                            enumChildren(childItems, level + 1);
                        }

                        row.collapsable =
                            collapsable! &&
                            !maxLevelReached &&
                            ((filter && childItems.length > 0) ||
                                (!filter && canContainChildren(childItem.object)));
                    }
                }
            });
        }

        enumChildren(getChildren(this.props.item || this.props.rootItem), 0);

        return children;
    }

    render() {
        const { rootItem, onDoubleClick } = this.props;
        return this.allRows.map(row => (
            <TreeRow
                key={row.item.object._id}
                showOnlyChildren={true}
                collapsable={row.collapsable}
                rootItem={rootItem}
                item={row.item}
                onDoubleClick={onDoubleClick}
                level={row.level}
                draggable={row.draggable}
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

export type SortDirectionType = "asc" | "desc" | "none";

interface TreeProps {
    rootItem: ITreeObjectAdapter;
    item?: ITreeObjectAdapter;
    onDoubleClick?: (object: EezObject) => void;
    tabIndex?: number;
    filter?: (object: EezObject) => boolean;
    collapsable?: boolean;
    onFocus?: () => void;
    sortDirection?: SortDirectionType;
    maxLevel?: number;
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

    @bind
    onDoubleClick(object: EezObject) {
        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(object);
        }
    }

    onSelect(objectId: string) {
        let item = this.props.rootItem.getObjectAdapter(objectId);
        if (item) {
            this.props.rootItem.selectItems([item]);
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
                this.props.rootItem.cutSelection();
            } else if (event.keyCode == "C".charCodeAt(0)) {
                this.props.rootItem.copySelection();
            } else if (event.keyCode == "V".charCodeAt(0)) {
                this.props.rootItem.pasteSelection();
            }
        } else if (event.keyCode == 46) {
            // delete
            this.props.rootItem.deleteSelection();
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
        const dragObject = DragAndDropManager.dragObject;

        if (dragObject) {
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
                    let dropItem = this.props.rootItem.getObjectAdapter(objectId!)!;

                    let dropPosition: DropPosition | undefined;
                    let canDrop = false;

                    const CHILD_OFFSET = 25;

                    function checks() {
                        // check: can't drop object within itself
                        if (isAncestor(dropItem.object, dragObject!)) {
                            return;
                        }

                        // check: can't drop object if parent can't accept it
                        if (
                            !(
                                isArrayElement(dropItem.object) &&
                                isObjectInstanceOf(dragObject!, dropItem.object._parent!._classInfo)
                            )
                        ) {
                            return;
                        }

                        // check: it makes no sense to drop dragObject before or after itself
                        if (dropItem.object === dragObject) {
                            return;
                        }

                        const $row = $treeDiv.find(`[data-object-id="${dropItem.object._id}"]`);
                        const rowIndexAtCursor = $allRows.index($row);
                        if (dropPosition === DropPosition.DROP_POSITION_BEFORE) {
                            if (rowIndexAtCursor === 0) {
                                canDrop = true;
                            } else {
                                const $prevRow = $allRows.eq(rowIndexAtCursor - 1);
                                const prevObjectId = $prevRow.attr("data-object-id");
                                if (prevObjectId !== dragObject!._id) {
                                    canDrop = true;
                                }
                            }
                        } else if (dropPosition === DropPosition.DROP_POSITION_AFTER) {
                            if (rowIndexAtCursor === $allRows.length - 1) {
                                canDrop = true;
                            } else {
                                const $nextRow = $allRows.eq(rowIndexAtCursor + 1);
                                const nextObjectId = $nextRow.attr("data-object-id");
                                if (nextObjectId !== dragObject!._id) {
                                    canDrop = true;
                                }
                            }
                        }
                    }

                    if (event.nativeEvent.clientY < rowRect.top + rowRect.height / 2) {
                        dropPosition = DropPosition.DROP_POSITION_BEFORE;

                        checks();
                    } else {
                        dropPosition = DropPosition.DROP_POSITION_AFTER;

                        const $nextRow = $allRows.eq(rowIndexAtCursor + 1);
                        const nextObjectId = $nextRow.attr("data-object-id");
                        let nextItem = this.props.rootItem.getObjectAdapter(nextObjectId!)!;

                        if (
                            findPastePlaceInside(dropItem.object, dragObject._classInfo, true) &&
                            event.nativeEvent.clientX > labelRect.left + CHILD_OFFSET
                        ) {
                            // check: can't drop object within itself
                            if (!isAncestor(dropItem.object, dragObject)) {
                                if (
                                    !(
                                        rowIndexAtCursor + 1 < $allRows.length &&
                                        isAncestor(nextItem.object, dropItem.object)
                                    )
                                ) {
                                    // no child, drop inside
                                    dropPosition = DropPosition.DROP_POSITION_INSIDE;
                                    canDrop = true;
                                }
                            }
                        }

                        if (!canDrop) {
                            let canDropToItem;

                            while (true) {
                                const $row = $treeDiv.find(
                                    `[data-object-id="${dropItem.object._id}"]`
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

                                if (!nextItem) {
                                    break;
                                }

                                const parentItem = this.props.rootItem.getParent(dropItem);

                                if (!parentItem) {
                                    break;
                                }

                                if (parentItem === this.props.rootItem.getParent(nextItem)) {
                                    break;
                                }

                                dropItem = parentItem;
                            }

                            if (canDropToItem) {
                                dropItem = canDropToItem;
                                canDrop = true;
                            } else {
                                canDrop = false;
                            }
                        }
                    }

                    if (canDrop) {
                        if (
                            dropItem !== DragAndDropManager.dropObject ||
                            dropPosition !== this.dropPosition
                        ) {
                            if (dropItem !== DragAndDropManager.dropObject) {
                                DragAndDropManager.setDropObject(dropItem);
                            }

                            if (dropPosition !== this.dropPosition) {
                                this.dropPosition = dropPosition;
                            }

                            const $row = $treeDiv.find(`[data-object-id="${dropItem.object._id}"]`);
                            const rowRect = $row[0].getBoundingClientRect();

                            const $label = $row.find("span");
                            const labelRect = $label.get(0).getBoundingClientRect();

                            this.dropMarkVerticalConnectionLineHeight = undefined;

                            if (dropPosition === DropPosition.DROP_POSITION_INSIDE) {
                                this.dropMarkLeft =
                                    labelRect.left - treeDivRect.left + CHILD_OFFSET;
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

                        event.preventDefault();
                        event.stopPropagation();
                        DragAndDropManager.setDropEffect(event);

                        return;
                    }
                }
            }
        }

        this.dropPosition = undefined;
        if (DragAndDropManager.dropObject) {
            DragAndDropManager.unsetDropObject();
        }
    }

    @action.bound
    onDragLeave(event: any) {
        this.dropPosition = undefined;

        if (DragAndDropManager.dropObject) {
            DragAndDropManager.unsetDropObject();
        }
    }

    @action.bound
    onDrop(event: any) {
        if (DragAndDropManager.dropObject) {
            let dropPosition = this.dropPosition;
            this.dropPosition = undefined;

            DragAndDropManager.deleteDragItem();

            if (DragAndDropManager.dragObject) {
                let object = cloneObject(undefined, DragAndDropManager.dragObject);

                let dropItem = DragAndDropManager.dropObject as ITreeObjectAdapter;

                if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                    DocumentStore.insertObjectBefore(dropItem.object, object);
                } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                    DocumentStore.insertObjectAfter(dropItem.object, object);
                } else if (dropPosition == DropPosition.DROP_POSITION_INSIDE) {
                    let dropPlace = findPastePlaceInside(dropItem.object, object._classInfo, true);
                    if (dropPlace) {
                        if (isArray(dropPlace as EezObject)) {
                            DocumentStore.addObject(dropPlace as EezObject, object);
                        } else {
                            DocumentStore.updateObject(dropItem.object, {
                                [(dropPlace as PropertyInfo).name]: object
                            });
                        }
                    }
                }
            }

            DragAndDropManager.end(event);
        }
    }

    onContextMenu(event: React.MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    render() {
        const {
            rootItem,
            item,
            filter,
            maxLevel,
            collapsable,
            sortDirection,
            tabIndex,
            onFocus
        } = this.props;

        const className = classNames({
            collapsable,
            "drag-source": DragAndDropManager.dragObject,
            "zero-level": maxLevel === 0
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
                        pointerEvents: DragAndDropManager.dragObject ? "none" : "auto"
                    }}
                >
                    <TreeRows
                        rootItem={rootItem}
                        item={item}
                        filter={filter}
                        collapsable={collapsable}
                        sortDirection={sortDirection}
                        maxLevel={maxLevel}
                        onDoubleClick={this.onDoubleClick}
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
