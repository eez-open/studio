import * as React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import * as classNames from "classnames";

import styled from "eez-studio-shared/ui/styled-components";

import { EezObject, PropertyMetaData } from "project-editor/core/metaData";

import {
    NavigationStore,
    getChildren,
    showContextMenu,
    cloneObject,
    objectToClipboardData,
    updateObject,
    addObject,
    insertObjectBefore,
    findPastePlaceInside,
    hasAncestor,
    isArray,
    isArrayElement,
    isSameInstanceTypeAs,
    objectToString,
    setClipboardData,
    getObjectFromObjectId,
    canCut,
    cutItem,
    canCopy,
    copyItem,
    canPaste,
    pasteItem,
    canDelete,
    deleteItem,
    getMetaData,
    getId
} from "project-editor/core/store";

import { DragAndDropManager, DropPosition } from "project-editor/core/dd";

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

@observer
export class DropMark extends React.Component<{}, {}> {
    render() {
        return (
            <DropMarkDiv>
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
    object: EezObject;
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

        DragAndDropManager.setDropObjectAndPosition(this.props.object, DropPosition.DROP_INSIDE);
    }

    @bind
    onDragLeave() {
        DragAndDropManager.unsetDropObjectAndPosition();
    }

    render() {
        let className = classNames({
            "drop-target":
                this.props.object == DragAndDropManager.dropObject &&
                DragAndDropManager.dropPosition == DropPosition.DROP_INSIDE
        });

        return (
            <DropPlaceholderDiv
                className={className}
                onDragOver={this.onDragOver}
                onDragLeave={this.onDragLeave}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ListItemDiv = styled.div`
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.drag-source {
        background-color: ${props => props.theme.dragSourceBackgroundColor};
        color: ${props => props.theme.dragSourceColor};
    }

    &.drop-target {
        background-color: ${props => props.theme.dropPlaceColor};
    }
`;

interface ListItemProps {
    navigationObject: EezObject;
    item: EezObject;
    onDoubleClick?: (object: EezObject) => void;
    filter?: (object: EezObject) => boolean;
}

@observer
export class ListItem extends React.Component<ListItemProps, {}> {
    item: HTMLDivElement;
    index: number;

    ensureVisible() {
        setTimeout(() => {
            if (!DragAndDropManager.dragObject) {
                if ($(this.item).hasClass("selected")) {
                    (this.item as any).scrollIntoViewIfNeeded();
                }
            }
        }, 0);
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
        setClipboardData(event, objectToClipboardData(this.props.item));
        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);

        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, this.props.item);
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

        if (hasAncestor(this.props.item, DragAndDropManager.dragObject)) {
            return;
        }

        DragAndDropManager.delayedOnDragOver(() => {
            if (!DragAndDropManager.dragObject) {
                return;
            }

            if (hasAncestor(this.props.item, DragAndDropManager.dragObject)) {
                return;
            }

            let dropPosition = DropPosition.DROP_NONE;

            if (
                isArrayElement(this.props.item) &&
                DragAndDropManager.dragObject &&
                isSameInstanceTypeAs(this.props.item, DragAndDropManager.dragObject)
            ) {
                dropPosition = DropPosition.DROP_BEFORE;
            } else {
                if (isArray(this.props.item)) {
                    if (isSameInstanceTypeAs(this.props.item, DragAndDropManager.dragObject)) {
                        dropPosition = DropPosition.DROP_INSIDE;
                    }
                } else {
                    if (
                        findPastePlaceInside(
                            this.props.item,
                            getMetaData(DragAndDropManager.dragObject),
                            true
                        )
                    ) {
                        dropPosition = DropPosition.DROP_INSIDE;
                    }
                }
            }

            if (dropPosition != DropPosition.DROP_NONE) {
                DragAndDropManager.setDropObjectAndPosition(this.props.item, dropPosition);
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
    onClick(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();

        // TODO multiple selection

        // if (e.ctrlKey) {
        //     toggleSelected(this.props.item.object);
        // } else {
        //     selectItems([this.props.item.object]);
        // }

        NavigationStore.setNavigationSelectedItem(this.props.navigationObject, this.props.item);
    }

    @bind
    onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
        if (e.button === 2) {
            let selectedItem = NavigationStore.getNavigationSelectedItem(
                this.props.navigationObject
            );

            if (this.props.item == selectedItem) {
                showContextMenu(this.props.item);
            } else {
                NavigationStore.setNavigationSelectedItem(
                    this.props.navigationObject,
                    this.props.item
                );
                setTimeout(() => {
                    showContextMenu(this.props.item);
                });
            }
        }
    }

    @bind
    onDoubleClick(e: any) {
        e.preventDefault();
        e.stopPropagation();

        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.item);
        }
    }

    render() {
        let selectedItem = NavigationStore.getNavigationSelectedItem(this.props.navigationObject);

        let className = classNames("list-item", {
            selected: this.props.item == selectedItem,
            "drag-source": DragAndDropManager.dragObject == this.props.item,
            "drop-target":
                this.props.item == DragAndDropManager.dropObject &&
                DragAndDropManager.dropPosition == DropPosition.DROP_INSIDE
        });

        const itemMetaData = getMetaData(this.props.item);

        return (
            <ListItemDiv
                innerRef={ref => (this.item = ref)}
                data-object-id={getId(this.props.item)}
                className={className}
                onMouseUp={this.onMouseUp}
                onClick={this.onClick}
                onDoubleClick={this.onDoubleClick}
                draggable={true}
                onDragStart={this.onDragStart}
                onDrag={this.onDrag}
                onDragEnd={this.onDragEnd}
                onDragOver={this.onDragOver}
                onDragLeave={this.onDragLeave}
            >
                {itemMetaData.listLabel
                    ? itemMetaData.listLabel(this.props.item)
                    : objectToString(this.props.item)}
            </ListItemDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ListOuterDiv = styled.div`
    flex-grow: 1;
    overflow: auto;
    padding: 5px;
    border: 2px dashed transparent;

    &:not(.drag-source) {
        .list-item:not(.drag-source) {
            &.selected {
                background-color: ${props => props.theme.nonFocusedSelectionBackgroundColor};
                color: ${props => props.theme.nonFocusedSelectionColor};
            }
        }

        &:focus {
            .list-item:not(.drag-source) {
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

const ListInnerDiv = styled.div`
    position: relative;
`;

interface ListProps {
    navigationObject: EezObject;
    onDoubleClick?: (object: EezObject) => void;
    tabIndex?: number;
    onFocus?: () => void;
}

@observer
export class List extends React.Component<ListProps, {}> {
    static defaultProps = {
        tabIndex: -1
    };

    list: HTMLDivElement;

    dragAndDropUpdateTimeoutId: any;

    constructor(props: ListProps) {
        super(props);

        this.state = {
            dropItem: undefined
        };
    }

    componentWillReceiveProps(nextProps: ListProps) {
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
        let item = getObjectFromObjectId(objectId);
        if (item) {
            NavigationStore.setNavigationSelectedItem(this.props.navigationObject, item);
        }
    }

    onKeyDown(event: any) {
        let focusedItemId = $(this.list)
            .find(".list-item.selected")
            .attr("data-object-id");

        if (!focusedItemId) {
            return;
        }

        let focusedItem = getObjectFromObjectId(focusedItemId);

        let $focusedItem = $(this.list).find(`.list-item[data-object-id="${focusedItemId}"]`);

        if (event.altKey) {
        } else if (event.shiftKey) {
        } else if (event.ctrlKey) {
            if (event.keyCode == "X".charCodeAt(0)) {
                if (focusedItem && canCut(focusedItem)) {
                    cutItem(focusedItem);
                }
            } else if (event.keyCode == "C".charCodeAt(0)) {
                if (focusedItem && canCopy(focusedItem)) {
                    copyItem(focusedItem);
                }
            } else if (event.keyCode == "V".charCodeAt(0)) {
                if (focusedItem && canPaste(focusedItem)) {
                    pasteItem(focusedItem);
                }
            }
        } else if (event.keyCode == 46) {
            // delete
            if (focusedItem && canDelete(focusedItem)) {
                deleteItem(focusedItem);
            }
        } else {
            if (
                event.keyCode == 38 ||
                event.keyCode == 40 ||
                event.keyCode == 33 ||
                event.keyCode == 34 ||
                event.keyCode == 36 ||
                event.keyCode == 35
            ) {
                let $rows = $(this.list).find(".list-item");
                let index = $rows.index($focusedItem);

                let pageSize = Math.floor($(this.list).height()! / $rows.height()!);

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
            }
        }
    }

    onDragOver(event: any) {
        if (!DragAndDropManager.dragObject) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        DragAndDropManager.setDropEffect(event);
    }

    onDrop(event: any) {
        if (DragAndDropManager.dropObject) {
            let dropPosition = DragAndDropManager.dropPosition;

            DragAndDropManager.deleteDragItem();

            if (DragAndDropManager.dragObject) {
                let object = cloneObject(undefined, DragAndDropManager.dragObject);

                if (dropPosition == DropPosition.DROP_BEFORE) {
                    insertObjectBefore(DragAndDropManager.dropObject, object);
                } else if (dropPosition == DropPosition.DROP_INSIDE) {
                    let dropPlace = findPastePlaceInside(
                        DragAndDropManager.dropObject,
                        getMetaData(object),
                        true
                    );
                    if (dropPlace) {
                        if (isArray(dropPlace as EezObject)) {
                            addObject(dropPlace as EezObject, object);
                        } else {
                            updateObject(DragAndDropManager.dropObject, {
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
        let className = classNames({
            "drag-source": DragAndDropManager.dragObject
        });

        let children = getChildren(this.props.navigationObject);

        let childrenElements: JSX.Element[] = [];

        children.forEach(child => {
            if (
                child == DragAndDropManager.dropObject &&
                DragAndDropManager.dropPosition == DropPosition.DROP_BEFORE
            ) {
                childrenElements.push(<DropMark key="drop-mark" />);
            }

            childrenElements.push(
                <ListItem
                    navigationObject={this.props.navigationObject}
                    key={getId(child)}
                    item={child}
                    onDoubleClick={this.props.onDoubleClick}
                />
            );
        });

        if (
            DragAndDropManager.dragObject &&
            !hasAncestor(this.props.navigationObject, DragAndDropManager.dragObject)
        ) {
            let addDropPlaceholder = false;

            if (isArray(this.props.navigationObject)) {
                if (
                    isSameInstanceTypeAs(this.props.navigationObject, DragAndDropManager.dragObject)
                ) {
                    addDropPlaceholder = true;
                }
            } else {
                let place = findPastePlaceInside(
                    this.props.navigationObject,
                    getMetaData(DragAndDropManager.dragObject),
                    true
                );
                if (place) {
                    addDropPlaceholder = true;
                }
            }

            if (addDropPlaceholder) {
                childrenElements.push(
                    <DropPlaceholder key="drop-placeholder" object={this.props.navigationObject} />
                );
            }
        }

        return (
            <ListOuterDiv
                innerRef={ref => (this.list = ref)}
                className={className}
                tabIndex={this.props.tabIndex}
                onKeyDown={this.onKeyDown.bind(this)}
                onFocus={() => this.props.onFocus && this.props.onFocus()}
            >
                <ListInnerDiv onDrop={this.onDrop.bind(this)}>{childrenElements}</ListInnerDiv>
            </ListOuterDiv>
        );
    }
}
