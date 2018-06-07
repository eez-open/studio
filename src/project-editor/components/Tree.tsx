import * as React from "react";
import { observer } from "mobx-react";

import { _filter, _map } from "shared/algorithm";

import { Icon } from "shared/ui/icon";

import { EezObject, PropertyMetaData } from "project-editor/core/metaData";

import {
    cloneObject,
    objectToClipboardData,
    updateObject,
    addObject,
    insertObjectBefore,
    findPastePlaceInside,
    canContainChildren,
    hasAncestor,
    isArray,
    isArrayElement,
    isSameInstanceTypeAs,
    objectToString,
    setClipboardData
} from "project-editor/core/store";

import { DragAndDropManager } from "project-editor/core/dd";
import { DropPosition } from "project-editor/core/dd";
import { TreeObjectAdapter, TreeObjectAdapterChildren } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

interface DropMarkProps {
    level: number;
}

@observer
export class DropMark extends React.Component<DropMarkProps, {}> {
    render() {
        return (
            <div
                className="EezStudio_ProjectEditor_drop-mark"
                style={{ paddingLeft: this.props.level * 20 }}
            >
                <i className="material-icons">chevron_right</i>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface DropPlaceholderProps {
    level: number;
    item: TreeObjectAdapter;
}

@observer
export class DropPlaceholder extends React.Component<DropPlaceholderProps, {}> {
    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        DragAndDropManager.setDropEffect(event);

        DragAndDropManager.setDropObjectAndPosition(this.props.item, DropPosition.DROP_INSIDE);
    }

    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    render() {
        let className = "EezStudio_ProjectEditor_drop-placeholder";

        if (
            this.props.item == DragAndDropManager.dropObject &&
            DragAndDropManager.dropPosition == DropPosition.DROP_INSIDE
        ) {
            className += " drop-target";
        }

        return (
            <div
                className={className}
                style={{ marginLeft: this.props.level * 20 + 13 }}
                onDragOver={this.onDragOver.bind(this)}
                onDragLeave={this.onDragLeave.bind(this)}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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
    refs: {
        [key: string]: Element;
        row: HTMLDivElement;
    };
    index: number;

    ensureVisible() {
        setTimeout(() => {
            if (!DragAndDropManager.dragObject) {
                if ($(this.refs.row).hasClass("selected")) {
                    ($(this.refs.row)[0] as any).scrollIntoViewIfNeeded();
                }
            }
        }, 0);
    }

    componentDidMount() {
        $(this.refs.row).on("contextmenu", event => {
            event.preventDefault();

            if (this.props.item.selected) {
                this.props.rootItem.showSelectionContextMenu();
            } else {
                this.props.rootItem.selectItems([this.props.item]);
                setTimeout(() => {
                    this.props.rootItem.showSelectionContextMenu();
                });
            }
        });

        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    onDragStart(event: any) {
        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(event, objectToClipboardData(this.props.item.object));
        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);

        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, this.props.item.object);
        });
    }

    onDrag(event: any) {
        DragAndDropManager.drag(event);
    }

    onDragEnd(event: any) {
        DragAndDropManager.end(event);
    }

    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        if (hasAncestor(this.props.item.object, DragAndDropManager.dragObject)) {
            return;
        }

        DragAndDropManager.delayedOnDragOver(() => {
            if (!DragAndDropManager.dragObject) {
                return;
            }

            if (hasAncestor(this.props.item.object, DragAndDropManager.dragObject)) {
                return;
            }

            if (
                isArrayElement(this.props.item.object) &&
                DragAndDropManager.dragObject &&
                isSameInstanceTypeAs(this.props.item.object, DragAndDropManager.dragObject)
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

    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    onTriangleClick(event: any) {
        event.preventDefault();
        event.stopPropagation();

        this.props.rootItem.selectItems([this.props.item]);
        this.props.item.toggleExpanded();
    }

    onClick(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey) {
            this.props.rootItem.toggleSelected(this.props.item);
        } else {
            this.props.rootItem.selectItems([this.props.item]);
        }
    }

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
                        key={child.item.object.$eez.id}
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
                !hasAncestor(this.props.item.object, DragAndDropManager.dragObject)
            ) {
                let addDropPlaceholder = false;

                if (isArray(this.props.item.object)) {
                    if (
                        this.props.item.object.$eez.metaData ==
                        DragAndDropManager.dragObject.$eez.metaData
                    ) {
                        addDropPlaceholder = true;
                    }
                } else {
                    let place = findPastePlaceInside(
                        this.props.item.object,
                        DragAndDropManager.dragObject.$eez.metaData,
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

        let rowEnclosureClassName = "EezStudio_ProjectEditor_tree-row-enclosure";

        let row: JSX.Element | undefined;

        if (!this.props.showOnlyChildren) {
            if (DragAndDropManager.dragObject == this.props.item.object) {
                rowEnclosureClassName += " drag-source";
            }

            let className = "EezStudio_ProjectEditor_tree-row";

            if (this.props.item.selected) {
                className += " selected";
            }

            let labelText = objectToString(this.props.item.object);

            let label: JSX.Element | undefined;
            let triangle: JSX.Element | undefined;
            if (this.props.collapsable) {
                if (
                    (this.props.filter && children.length > 0) ||
                    (!this.props.filter && canContainChildren(this.props.item.object))
                ) {
                    triangle = (
                        <small
                            className="EezStudio_ProjectEditor_tree-row-triangle"
                            onClick={this.onTriangleClick.bind(this)}
                        >
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
                    label = (
                        <span className="EezStudio_ProjectEditor_tree-row-label">{labelText}</span>
                    );
                }
            } else {
                label = <span>{labelText}</span>;
            }

            row = (
                <div
                    ref="row"
                    data-object-id={this.props.item.object.$eez.id}
                    className={className}
                    style={{ paddingLeft: this.props.level * 20 }}
                    onClick={this.onClick.bind(this)}
                    onDoubleClick={
                        triangle ? this.onTriangleClick.bind(this) : this.onDoubleClick.bind(this)
                    }
                    draggable={this.props.draggable}
                    onDragStart={this.onDragStart.bind(this)}
                    onDrag={this.onDrag.bind(this)}
                    onDragEnd={this.onDragEnd.bind(this)}
                    onDragOver={this.onDragOver.bind(this)}
                    onDragLeave={this.onDragLeave.bind(this)}
                >
                    {triangle}
                    {label}
                </div>
            );
        }

        return (
            <div className={rowEnclosureClassName}>
                {row}
                {childrenRows}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

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

    refs: {
        [key: string]: Element;
        tree: HTMLDivElement;
    };

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

    onKeyDown(event: any) {
        let focusedItemId = $(this.refs.tree)
            .find(".EezStudio_ProjectEditor_tree-row.selected")
            .attr("data-object-id");

        if (!focusedItemId) {
            return;
        }

        let $focusedItem = $(this.refs.tree).find(
            `.EezStudio_ProjectEditor_tree-row[data-object-id="${focusedItemId}"]`
        );

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
                let $rows = $(this.refs.tree).find(".EezStudio_ProjectEditor_tree-row");
                let index = $rows.index($focusedItem);

                let pageSize = Math.floor($(this.refs.tree).height()! / $rows.height()!);

                if (event.keyCode == 38) {
                    // up
                    --index;
                } else if (event.keyCode == 40) {
                    // down
                    ++index;
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
                let $rows = $focusedItem.parent().find(".EezStudio_ProjectEditor_tree-row");
                if ($rows.length == 1) {
                    let $row = $($rows[0]);
                    $rows = $row
                        .parent()
                        .parent()
                        .find(".EezStudio_ProjectEditor_tree-row");
                    let newFocusedItemId = $($rows[0]).attr("data-object-id");
                    if (newFocusedItemId) {
                        this.onSelect(newFocusedItemId);
                    }
                } else {
                    $focusedItem
                        .find(".EezStudio_ProjectEditor_tree-row-triangle")
                        .trigger("click");
                }

                event.preventDefault();
            } else if (event.keyCode == 39) {
                // right
                let $rows = $focusedItem.parent().find(".EezStudio_ProjectEditor_tree-row");
                let index = $rows.index($focusedItem);

                if (index == 0) {
                    if ($rows.length > 1) {
                        let newFocusedItemId = $($rows[1]).attr("data-object-id");
                        if (newFocusedItemId) {
                            this.onSelect(newFocusedItemId);
                        }
                    } else {
                        $focusedItem
                            .find(".EezStudio_ProjectEditor_tree-row-triangle")
                            .trigger("click");
                    }
                }

                event.preventDefault();
            }
        }
    }

    onDrop(event: any) {
        if (DragAndDropManager.dropObject) {
            let dropPosition = DragAndDropManager.dropPosition;

            DragAndDropManager.deleteDragItem();

            if (DragAndDropManager.dragObject) {
                let object = cloneObject(undefined, DragAndDropManager.dragObject);

                if (dropPosition == DropPosition.DROP_BEFORE) {
                    insertObjectBefore(DragAndDropManager.dropObject.object, object);
                } else if (dropPosition == DropPosition.DROP_INSIDE) {
                    let dropPlace = findPastePlaceInside(
                        DragAndDropManager.dropObject.object,
                        object.$eez.metaData,
                        true
                    );
                    if (dropPlace) {
                        if (isArray(dropPlace as EezObject)) {
                            addObject(dropPlace as EezObject, object);
                        } else {
                            updateObject(DragAndDropManager.dropObject.object, {
                                [(dropPlace as PropertyMetaData).name]: object
                            });
                        }
                    }
                }
            }

            DragAndDropManager.end(event);
        }
    }

    render() {
        let className = "EezStudio_ProjectEditor_tree layoutCenter";

        if (this.props.collapsable) {
            className += " EezStudio_ProjectEditor_tree-collapsable";
        }

        if (DragAndDropManager.dragObject) {
            className += " drag-source";
        }

        return (
            <div
                ref="tree"
                className={className}
                style={{ overflow: "auto" }}
                tabIndex={this.props.tabIndex}
                onKeyDown={this.onKeyDown.bind(this)}
                onFocus={() => this.props.onFocus && this.props.onFocus()}
            >
                <div onDrop={this.onDrop.bind(this)}>
                    <TreeRow
                        showOnlyChildren={true}
                        collapsable={this.props.collapsable || false}
                        rootItem={this.props.rootItem}
                        item={this.props.item || this.props.rootItem}
                        onDoubleClick={this.onDoubleClick.bind(this)}
                        level={0}
                        filter={this.props.filter}
                        draggable={false}
                    />
                </div>
            </div>
        );
    }
}
