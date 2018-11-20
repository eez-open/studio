import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { _filter, _map } from "eez-studio-shared/algorithm";

import { Icon } from "eez-studio-ui/icon";
import styled from "eez-studio-ui/styled-components";

import {
    EezObject,
    PropertyInfo,
    isArray,
    isObjectInstanceOf,
    isAncestor,
    isArrayElement,
    objectToString,
    cloneObject
} from "project-editor/core/object";
import {
    objectToClipboardData,
    setClipboardData,
    findPastePlaceInside
} from "project-editor/core/clipboard";
import { ProjectStore, canContainChildren } from "project-editor/core/store";

import { DragAndDropManager } from "project-editor/core/dd";
import { DropPosition } from "project-editor/core/dd";
import { TreeObjectAdapter, TreeObjectAdapterChildren } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

const DropMarkDiv = styled.div`
    position: absolute;
    font-size: 18px;
    margin-top: -11px;
    margin-left: -13px;
    color: ${props => props.theme.dropPlaceColor};
    -webkit-filter: drop-shadow(0px 0px 1px ${props => props.theme.dropPlaceColor});
    filter: drop-shadow(0px 0px 1px ${props => props.theme.dropPlaceColor});
    pointer-events: none;
    text-shadow: -1px 0 white, 0 1px white, 1px 0 white, 0 -1px white;
`;

interface DropMarkProps {
    level: number;
}

@observer
export class DropMark extends React.Component<DropMarkProps, {}> {
    render() {
        return (
            <DropMarkDiv style={{ paddingLeft: this.props.level * 20 }}>
                <i className="material-icons">chevron_right</i>
            </DropMarkDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const DropPlaceholderDiv = styled.div`
    margin: 1px;
    border: 1px dotted ${props => props.theme.dropPlaceColor};
    height: 10px;

    &.drop-target {
        background-color: ${props => props.theme.dropPlaceColor};
    }
`;

interface DropPlaceholderProps {
    level: number;
    item: TreeObjectAdapter;
}

@observer
export class DropPlaceholder extends React.Component<DropPlaceholderProps, {}> {
    @bind
    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        DragAndDropManager.setDropEffect(event);

        DragAndDropManager.setDropObjectAndPosition(this.props.item, DropPosition.DROP_INSIDE);
    }

    @bind
    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    render() {
        let className = classNames({
            "drop-target":
                this.props.item == DragAndDropManager.dropObject &&
                DragAndDropManager.dropPosition == DropPosition.DROP_INSIDE
        });

        return (
            <DropPlaceholderDiv
                className={className}
                style={{ marginLeft: this.props.level * 20 + 13 }}
                onDragOver={this.onDragOver}
                onDragLeave={this.onDragLeave}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const TreeRowEnclosureDiv = styled.div`
    &.drag-source {
        background-color: ${props => props.theme.dragSourceBackgroundColor};
        color: ${props => props.theme.dragSourceColor};
    }
`;

const TreeRowDiv = styled.div`
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .tree-row-label {
        display: inline-block;
        margin-left: 13px;
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
    rootItem: TreeObjectAdapter;
    item: TreeObjectAdapter;
    onDoubleClick?: (object: EezObject) => void;
    level: number;
    filter?: (object: EezObject) => boolean;
    draggable: boolean;
}

@observer
export class TreeRow extends React.Component<TreeRowProps, {}> {
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
                if ($(this.row).hasClass("selected")) {
                    ($(this.row)[0] as any).scrollIntoViewIfNeeded();
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
    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        if (isAncestor(this.props.item.object, DragAndDropManager.dragObject)) {
            return;
        }

        DragAndDropManager.delayedOnDragOver(() => {
            if (!DragAndDropManager.dragObject) {
                return;
            }

            if (isAncestor(this.props.item.object, DragAndDropManager.dragObject)) {
                return;
            }

            if (
                isArrayElement(this.props.item.object) &&
                DragAndDropManager.dragObject &&
                isObjectInstanceOf(
                    DragAndDropManager.dragObject,
                    this.props.item.object._parent!._classInfo
                )
            ) {
                DragAndDropManager.setDropObjectAndPosition(
                    this.props.item,
                    DropPosition.DROP_BEFORE
                );
            }
        });

        event.preventDefault();
        event.stopPropagation();
        DragAndDropManager.setDropEffect(event);
    }

    @bind
    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    @bind
    onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
        if (e.button === 2) {
            if (this.props.item.selected) {
                this.props.rootItem.showSelectionContextMenu();
            } else {
                this.props.rootItem.selectItems([this.props.item]);
                setTimeout(() => {
                    this.props.rootItem.showSelectionContextMenu();
                });
            }
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
        let itemChildren: TreeObjectAdapterChildren = this.props.item.children;

        if (this.props.filter) {
            let filter = this.props.filter;
            itemChildren = _filter(this.props.item.children, (item: any) => {
                return filter(item.object);
            }) as any;
        }

        let children: {
            item: TreeObjectAdapter;
            draggable: boolean;
        }[] = _map(itemChildren, item => ({
            item: item as any,
            draggable: true
        }));

        let childrenRows: JSX.Element[] = [];

        if (!this.props.collapsable || this.props.showOnlyChildren || this.props.item.expanded) {
            let childrenLevel = this.props.showOnlyChildren
                ? this.props.level
                : this.props.level + 1;

            children.forEach(child => {
                if (
                    child.item == DragAndDropManager.dropObject &&
                    DragAndDropManager.dropPosition == DropPosition.DROP_BEFORE
                ) {
                    childrenRows.push(<DropMark key="drop-mark" level={childrenLevel} />);
                }

                childrenRows.push(
                    <TreeRow
                        key={child.item.object._id}
                        showOnlyChildren={children.length == 1 && isArray(child.item.object)}
                        rootItem={this.props.rootItem}
                        item={child.item}
                        level={childrenLevel}
                        collapsable={this.props.collapsable}
                        onDoubleClick={this.props.onDoubleClick}
                        filter={this.props.filter}
                        draggable={child.draggable}
                    />
                );
            });

            if (
                DragAndDropManager.dragObject &&
                !isAncestor(this.props.item.object, DragAndDropManager.dragObject)
            ) {
                let addDropPlaceholder = false;

                if (isArray(this.props.item.object)) {
                    if (
                        isObjectInstanceOf(
                            DragAndDropManager.dragObject,
                            this.props.item.object._classInfo
                        )
                    ) {
                        addDropPlaceholder = true;
                    }
                } else {
                    let place = findPastePlaceInside(
                        this.props.item.object,
                        DragAndDropManager.dragObject._classInfo,
                        true
                    );
                    if (place) {
                        addDropPlaceholder = true;
                    }
                }

                if (addDropPlaceholder) {
                    childrenRows.push(
                        <DropPlaceholder
                            key="drop-placeholder"
                            level={childrenLevel}
                            item={this.props.item}
                        />
                    );
                }
            }
        }

        let rowEnclosureClassName = classNames("tree-row-enclosure", {
            "drag-source":
                !this.props.showOnlyChildren &&
                DragAndDropManager.dragObject == this.props.item.object
        });

        let row: JSX.Element | undefined;

        if (!this.props.showOnlyChildren) {
            let className = classNames("tree-row", {
                selected: this.props.item.selected
            });

            let labelText = objectToString(this.props.item.object);

            let label: JSX.Element | undefined;
            let triangle: JSX.Element | undefined;
            if (this.props.collapsable) {
                if (
                    (this.props.filter && children.length > 0) ||
                    (!this.props.filter && canContainChildren(this.props.item.object))
                ) {
                    triangle = (
                        <small className="tree-row-triangle" onClick={this.onTriangleClick}>
                            <Icon
                                icon={
                                    this.props.item.expanded
                                        ? "material:keyboard_arrow_down"
                                        : "material:keyboard_arrow_right"
                                }
                                size={18}
                            />
                        </small>
                    );
                    label = <span>{labelText}</span>;
                } else {
                    label = <span className="tree-row-label">{labelText}</span>;
                }
            } else {
                label = <span>{labelText}</span>;
            }

            row = (
                <TreeRowDiv
                    innerRef={ref => (this.row = ref)}
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
                    onDragOver={this.onDragOver}
                    onDragLeave={this.onDragLeave}
                >
                    {triangle}
                    {label}
                </TreeRowDiv>
            );
        }

        return (
            <TreeRowEnclosureDiv className={rowEnclosureClassName}>
                {row}
                {childrenRows}
            </TreeRowEnclosureDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const TreeOuterDiv = styled.div`
    flex-grow: 1;
    overflow: auto;
    padding: 5px;
    border: 2px dashed transparent;

    &:not(.drag-source) {
        .tree-row-enclosure:not(.drag-source) {
            .tree-row {
                &.selected {
                    background-color: ${props => props.theme.nonFocusedSelectionBackgroundColor};
                    color: ${props => props.theme.nonFocusedSelectionColor};
                }
            }
        }

        &:focus {
            .tree-row-enclosure:not(.drag-source) {
                .tree-row {
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
    }
`;

const TreeInnerDiv = styled.div`
    position: relative;
`;

interface TreeProps {
    rootItem: TreeObjectAdapter;
    item?: TreeObjectAdapter;
    onDoubleClick?: (object: EezObject) => void;
    tabIndex?: number;
    filter?: (object: EezObject) => boolean;
    collapsable?: boolean;
    onFocus?: () => void;
}

@observer
export class Tree extends React.Component<TreeProps, {}> {
    static defaultProps = {
        tabIndex: -1,
        maxLevel: undefined,
        collapsable: false
    };

    tree: HTMLDivElement;

    dragAndDropUpdateTimeoutId: any;

    constructor(props: TreeProps) {
        super(props);

        this.state = {
            dropItem: undefined
        };
    }

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
        let focusedItemId = $(this.tree)
            .find(".tree-row.selected")
            .attr("data-object-id");

        if (!focusedItemId) {
            return;
        }

        let $focusedItem = $(this.tree).find(`.tree-row[data-object-id="${focusedItemId}"]`);

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
                let $rows = $(this.tree).find(".tree-row");
                let index = $rows.index($focusedItem);

                let pageSize = Math.floor($(this.tree).height()! / $rows.height()!);

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

    @bind
    onDrop(event: any) {
        if (DragAndDropManager.dropObject) {
            let dropPosition = DragAndDropManager.dropPosition;

            DragAndDropManager.deleteDragItem();

            if (DragAndDropManager.dragObject) {
                let object = cloneObject(undefined, DragAndDropManager.dragObject);

                if (dropPosition == DropPosition.DROP_BEFORE) {
                    ProjectStore.insertObjectBefore(DragAndDropManager.dropObject.object, object);
                } else if (dropPosition == DropPosition.DROP_INSIDE) {
                    let dropPlace = findPastePlaceInside(
                        DragAndDropManager.dropObject.object,
                        object._classInfo,
                        true
                    );
                    if (dropPlace) {
                        if (isArray(dropPlace as EezObject)) {
                            ProjectStore.addObject(dropPlace as EezObject, object);
                        } else {
                            ProjectStore.updateObject(DragAndDropManager.dropObject.object, {
                                [(dropPlace as PropertyInfo).name]: object
                            });
                        }
                    }
                }
            }

            DragAndDropManager.end(event);
        }
    }

    render() {
        const className = classNames({
            collapsable: this.props.collapsable,
            "drag-source": DragAndDropManager.dragObject
        });

        return (
            <TreeOuterDiv
                innerRef={ref => (this.tree = ref)}
                className={className}
                tabIndex={this.props.tabIndex}
                onKeyDown={this.onKeyDown}
                onFocus={() => this.props.onFocus && this.props.onFocus()}
            >
                <TreeInnerDiv onDrop={this.onDrop}>
                    <TreeRow
                        showOnlyChildren={true}
                        collapsable={this.props.collapsable || false}
                        rootItem={this.props.rootItem}
                        item={this.props.item || this.props.rootItem}
                        onDoubleClick={this.onDoubleClick}
                        level={0}
                        filter={this.props.filter}
                        draggable={false}
                    />
                </TreeInnerDiv>
            </TreeOuterDiv>
        );
    }
}
